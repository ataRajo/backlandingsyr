import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/index-browser';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TemplateService {

    constructor(
        private readonly prisma: PrismaService
    ) { }

    async getAllTemplates(filters?: { cityId?: number; regionId?: number }) {
        const prisma = this.prisma.client as any;

        const roadSignWhere: Record<string, any> = {};
        if (filters?.cityId && !Number.isNaN(filters.cityId)) {
            roadSignWhere.city_id = BigInt(filters.cityId);
        }
        if (filters?.regionId && !Number.isNaN(filters.regionId)) {
            roadSignWhere.region_id = BigInt(filters.regionId);
        }

        const templates = await prisma.templates.findMany({
            where: Object.keys(roadSignWhere).length
                ? { road_signs: { some: roadSignWhere } }
                : undefined,
            orderBy: {
                id: 'asc',
            },
            include: {
                products: {
                    select: {
                        type: true,
                        price: true,
                    },
                    orderBy: {
                        type: 'asc',
                    },
                },
            },
        });

        return templates.map((template) => this.serializeTemplate(template));
    }

    getTemplateById(id: any) {
        return this.prisma.client.templates.findUnique({
            where: {
                id: id
            }
        });
    }

    async getTemplatePrice(templateId: any, productTypeId: number) {
        const price = await this.prisma.client.products.findFirst({
            select: {
                price: true
            },
            where: {
                type: productTypeId,
                template_id: templateId,
            }
        })

        return price?.price ?? new Decimal(0);
    }

    async updateLandingPrice(templateId: bigint | number, landingPrice?: number | string | null) {
        const prisma = this.prisma.client as any;
        const updatedTemplate = await prisma.templates.update({
            where: {
                id: templateId,
            },
            data: landingPrice === undefined
                ? {}
                : {
                    landing_price: landingPrice === null ? null : new Decimal(String(landingPrice)),
                },
            include: {
                products: {
                    select: {
                        type: true,
                        price: true,
                    },
                    orderBy: {
                        type: 'asc',
                    },
                },
            },
        });

        return this.serializeTemplate(updatedTemplate);
    }

    private serializeTemplate(template: any) {
        const basePrices = Array.isArray(template.products)
            ? template.products.map((product: any) => ({
                type: Number(product.type),
                price: Number(product.price ?? 0),
            }))
            : [];

        const landingPrice = template.landing_price === null || template.landing_price === undefined
            ? null
            : Number(template.landing_price);

        return {
            ...template,
            id: template.id?.toString?.() ?? template.id,
            user_id: template.user_id?.toString?.() ?? template.user_id,
            advertising_space: Number(template.advertising_space ?? 0),
            printing_space: Number(template.printing_space ?? 0),
            landing_price: landingPrice,
            products: basePrices,
            base_prices: basePrices,
            price: landingPrice ?? basePrices[0]?.price ?? 0,
        };
    }


}
