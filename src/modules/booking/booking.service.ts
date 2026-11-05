import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { timestamp } from 'rxjs';
import { PrismaService } from 'src/database/prisma.service';
import { RoadsignService } from '../roadsign/roadsign.service';
import { TemplateService } from '../template/template.service';
import { Decimal } from '@prisma/client/runtime/index-browser';

@Injectable()
export class BookingService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly roadsignService: RoadsignService,
        private readonly templateService: TemplateService,
    ) { }

    async getBookings(actor: any, filters: any) {
        const bookings = await this.prisma.client.bookings.findMany({
            select: {
                id: true,
                type: true,
                status: true,
                start_date: true,
                end_date: true,
                created_at: true,
                booking_road_sign: {
                    select: {
                        road_signs: true,
                    }
                }
            },
            where: {
                customer_id: actor.account_type === 'customer' ? Number(actor.sub) : undefined,
                // تطبيق الفلاتر إذا كانت موجودة
                start_date: filters.start_date ? { gte: new Date(filters.start_date) } : undefined,
                end_date: filters.end_date ? { lte: new Date(filters.end_date) } : undefined,
                booking_road_sign: filters.roadsign_id ? {
                    some: {
                        road_sign_id: Number(filters.roadsign_id)
                    }
                } : undefined,
            },

        })

        const cleanBookings = bookings.map(booking => {
            const { booking_road_sign, ...restOfBooking } = booking;
            return {
                ...restOfBooking,
                // تحويل مصفوفة الوسيط إلى مصفوفة لوحات صافية
                roadsigns: booking_road_sign.map(item => item.road_signs).filter(Boolean)
            };
        });

        return cleanBookings;
    }

    async createBooking(actor: any, data: any) {

        const bookingData = this.resolveBookingData(data, actor);

        // التحقق من توفر كل لوحة قبل إنشاء الحجز
        for (const sign of bookingData.booking_road_sign.create) {
            const isAvailable = await this.checkAvailability(actor, sign.road_sign_id, bookingData.start_date, bookingData.end_date);
            if (!isAvailable) {
                throw new HttpException(`Roadsign with ID ${sign.road_sign_id} is not available for the selected dates.`, 400);
            }
        }

        const totalPrice = await this.calculateBookPrice(
            bookingData.start_date,
            bookingData.end_date,
            bookingData.printing_id,
            bookingData.product_type,
            bookingData.booking_road_sign.create.map((sign: any) => sign.road_sign_id)
        )

        const { totalAdvertisingSpace, totalPrintingSpace } = await this.calculateBookingSpaces(
            bookingData.booking_road_sign.create,
        );

        bookingData['total_price'] = totalPrice;
        bookingData['total_advertising_space'] = totalAdvertisingSpace;
        bookingData['total_printing_space'] = totalPrintingSpace;

        const created = await this.prisma.client.bookings.create({
            data: bookingData,
        });

        return created;
    }

    private async checkAvailability(actore: any, roadsignId: number, startDate: Date, endDate: Date): Promise<boolean> {
        const data = {
            roadsign_id: roadsignId,
            start_date: startDate,
            end_date: endDate,
        }
        const bookings = await this.getBookings(actore, data);

        return bookings.length === 0 ? true : false;
    }

    private async calculateBookPrice(startDate: Date, endDate: Date, prinitngType?: any, productType: number = 0, roadSingsIds: number[] = []) {
        const units = this.calculateUnits(startDate, endDate);

        const printing = await this.prisma.printings.findFirst({
            select: {
                price: true
            },
            where: {
                id: prinitngType,
            }
        })

        let roadsignPrice: Decimal = new Decimal(0);
        for (const roadsignId of roadSingsIds) {
            const roadsign = await this.roadsignService.getRoadsignById(roadsignId);
            if (!roadsign) {
                throw new NotFoundException('roadsign with id ' + roadsignId + ' not found')
            }
            roadsignPrice = await this.templateService.getTemplatePrice(roadsign.template_id, productType);
        }

        const templatePrice = new Decimal(units).mul(roadsignPrice);

        return templatePrice.add(printing?.price ?? 0);
    }

    private async calculateBookingSpaces(bookingRoadSigns: any[]) {
        let totalAdvertisingSpace = 0;
        let totalPrintingSpace = 0;

        for (const bookingRoadSign of bookingRoadSigns) {
            const roadsign = await this.prisma.road_signs.findUnique({
                where: {
                    id: bookingRoadSign.road_sign_id,
                },
                select: {
                    templates: {
                        select: {
                            advertising_space: true,
                            printing_space: true,
                        },
                    },
                },
            });

            if (!roadsign) {
                throw new NotFoundException('roadsign with id ' + bookingRoadSign.road_sign_id + ' not found');
            }

            const advertisingSpace = Number(roadsign.templates?.advertising_space ?? 0);
            const printingSpace = Number(roadsign.templates?.printing_space ?? 0);
            const bookingFaces = Number(bookingRoadSign.booking_faces ?? 0);
            const reservedPanels = Number(bookingRoadSign.number_of_reserved_panels ?? 0);
            const multiplier = bookingFaces * reservedPanels;

            totalAdvertisingSpace += advertisingSpace * multiplier;
            totalPrintingSpace += printingSpace * multiplier;
        }

        return {
            totalAdvertisingSpace,
            totalPrintingSpace,
        };
    }

    private calculateUnits(startDate: Date, endDate: Date) {
        const days = this.getDysBetween(startDate, endDate);
        return Math.ceil(days / 14);

    }
    private getDysBetween(startDate: Date, endDate: Date): number {
        return Math.max((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24), 0);
    }

    private resolveBookingData(data: any, actor: any) {
        const { type, start_date, end_date, roadsigns, product_type } = data;

        // التأكد من أن roadsigns مصفوفة لتجنب أي Crash
        const safeRoadsigns = Array.isArray(roadsigns) ? roadsigns : [];


        return {
            customer_id: Number(actor.sub),
            type: 1,
            start_date: new Date(start_date),
            end_date: new Date(end_date),
            approvement_status: 1,
            printing_price: 0,
            product_type: product_type,
            printing_id: Number(data.printing_id),
            units: safeRoadsigns.length,
            created_at: new Date(Date.now()),
            updated_at: new Date(Date.now()),
            // تحويل المصفوفة القادمة إلى الشكل المتوافق مع جدول الوسيط في Prisma

            booking_road_sign: {
                create: safeRoadsigns.map((sign: any) => ({
                    road_sign_id: Number(sign.road_sign_id),
                    booking_faces: Number(sign.booking_faces),
                    number_of_reserved_panels: Number(sign.number_of_reserved_panels),
                    face_price: 0,
                    total_faces_price: 1,
                    days_of_reservation: 1,
                    units: 1,
                    // تحويل التواريخ الخاصة بكل لوحة إلى صيغة كائن التاريخ Date Object
                    start_date: new Date(sign.start_date),
                    end_date: new Date(sign.end_date),
                    created_at: new Date(Date.now()),
                    updated_at: new Date(Date.now()),
                }))
            }
        };
    }
}
