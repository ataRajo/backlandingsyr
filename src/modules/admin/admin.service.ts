import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { PrismaService } from 'src/database/prisma.service';
import { TemplateService } from '../template/template.service';
import * as bcrypt from 'bcrypt';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@Injectable()
export class AdminService {
    private readonly adminRoleName = 'admin';
    private readonly adminModelTypes = ['App\\Models\\User', 'users', 'User'];
    private readonly customerModelTypes = ['App\\Models\\Customer'];
    private readonly customerMediaCollection = 'license_images';

    constructor(
        private readonly prisma: PrismaService,
        private readonly templateService: TemplateService,
    ) { }

    async getCustomers() {
        const prisma = this.prisma.client as any;
        const customers = await prisma.customers.findMany({
            orderBy: [
                { created_at: 'desc' },
                { id: 'desc' },
            ],
            select: this.customerSelect,
        });

        return this.attachCustomerMedia(customers);
    }

    async createCustomer(data: CreateCustomerDto) {
        const prisma = this.prisma.client as any;
        const now = new Date();
        const created = await prisma.customers.create({
            data: {
                full_name: data.full_name.trim(),
                company_name: data.company_name?.trim() || null,
                email: data.email?.trim() || null,
                phone_number: data.phone_number?.trim() || null,
                address: data.address?.trim() || null,
                status: data.status ?? '1',
                license_image: this.cleanLicensePath(data.license_image),
                created_at: now,
                updated_at: now,
            },
            select: this.customerSelect,
        });

        const [customer] = await this.attachCustomerMedia([created]);
        return customer;
    }

    async updateCustomer(customerId: bigint, data: UpdateCustomerDto) {
        const prisma = this.prisma.client as any;
        const existing = await prisma.customers.findUnique({ where: { id: customerId }, select: { id: true } });
        if (!existing) {
            throw new NotFoundException('Customer not found');
        }

        const text = (value?: string) => (value === undefined ? undefined : value.trim() || null);

        const updated = await prisma.customers.update({
            where: { id: customerId },
            data: {
                ...(data.full_name !== undefined ? { full_name: data.full_name.trim() } : {}),
                ...(data.company_name !== undefined ? { company_name: text(data.company_name) } : {}),
                ...(data.email !== undefined ? { email: text(data.email) } : {}),
                ...(data.phone_number !== undefined ? { phone_number: text(data.phone_number) } : {}),
                ...(data.address !== undefined ? { address: text(data.address) } : {}),
                ...(data.status !== undefined ? { status: data.status } : {}),
                ...(data.license_image !== undefined ? { license_image: this.cleanLicensePath(data.license_image) } : {}),
                updated_at: new Date(),
            },
            select: this.customerSelect,
        });

        const [customer] = await this.attachCustomerMedia([updated]);
        return customer;
    }

    async getBestCustomers() {
        const prisma = this.prisma.client as any;
        const customers = await prisma.customers.findMany({
            where: {
                is_best_customer: true,
            },
            orderBy: [
                { best_customer_order: 'asc' },
                { created_at: 'desc' },
            ],
            select: {
                id: true,
                full_name: true,
                company_name: true,
                phone_number: true,
                email: true,
                is_best_customer: true,
                best_customer_order: true,
                license_image: true,
                created_at: true,
            },
        });

        return this.attachCustomerMedia(customers);
    }

    async updateBestCustomer(customerId: bigint | number, data: { is_best_customer?: boolean; best_customer_order?: number }) {
        const prisma = this.prisma.client as any;
        const updatedCustomer = await prisma.customers.update({
            where: {
                id: customerId,
            },
            data: {
                ...(data.is_best_customer !== undefined ? { is_best_customer: data.is_best_customer } : {}),
                ...(data.best_customer_order !== undefined ? { best_customer_order: Number(data.best_customer_order) } : {}),
            },
            select: {
                id: true,
                full_name: true,
                company_name: true,
                phone_number: true,
                email: true,
                is_best_customer: true,
                best_customer_order: true,
                created_at: true,
            },
        });

        return {
            ...updatedCustomer,
            id: updatedCustomer.id.toString(),
        };
    }

    async listLandingTemplates() {
        return this.templateService.getAllTemplates();
    }

    async updateLandingTemplatePrice(templateId: bigint | number, landingPrice?: number | string | null) {
        const existingTemplate = await this.templateService.getTemplateById(templateId);

        if (!existingTemplate) {
            throw new NotFoundException('Template not found');
        }

        return this.templateService.updateLandingPrice(templateId, landingPrice);
    }

    async getAdmins() {
        const prisma = this.prisma.client as any;
        const roleAssignments = await prisma.model_has_roles.findMany({
            where: {
                model_type: {
                    in: this.adminModelTypes,
                },
                roles: {
                    name: this.adminRoleName,
                },
            },
            select: {
                model_id: true,
            },
        });

        const adminIds = [...new Set(roleAssignments.map((item: any) => BigInt(item.model_id)))];
        if (adminIds.length === 0) {
            return [];
        }

        const admins = await prisma.users.findMany({
            where: {
                id: { in: adminIds },
            },
            select: {
                id: true,
                username: true,
                full_name: true,
                phone_number: true,
                email: true,
                address: true,
                department: true,
                created_at: true,
                updated_at: true,
            },
            orderBy: {
                created_at: 'desc',
            },
        });

        return admins.map((admin: any) => this.serializeAdmin(admin));
    }

    async getAdminById(id: bigint | number) {
        const admins = await this.getAdmins();
        const admin = admins.find((item: any) => item.id === id.toString());

        if (!admin) {
            throw new NotFoundException('Admin not found');
        }

        return admin;
    }

    async createAdmin(data: CreateAdminDto) {
        const prisma = this.prisma.client as any;
        await this.ensureAdminRole();

        const existingUser = await prisma.users.findFirst({
            where: {
                OR: [
                    { email: data.email },
                    { phone_number: data.phone_number },
                    { username: data.username },
                ],
            },
        });

        if (existingUser) {
            throw new NotFoundException('Admin credentials already in use');
        }

        const hashedPassword = await bcrypt.hash(data.password, 10);
        const createdAdmin = await prisma.users.create({
            data: {
                username: data.username,
                email: data.email,
                phone_number: data.phone_number,
                password: hashedPassword,
                full_name: data.full_name,
                address: data.address,
                department: 'landing-admin',
            },
        });

        await prisma.model_has_roles.create({
            data: {
                role_id: BigInt((await this.ensureAdminRole()).id),
                model_type: 'App\\Models\\User',
                model_id: BigInt(createdAdmin.id),
            },
        });

        return this.serializeAdmin(createdAdmin);
    }

    async updateAdmin(id: bigint | number, data: UpdateAdminDto) {
        const prisma = this.prisma.client as any;
        await this.ensureAdminRole();

        const existingAdmin = await prisma.users.findUnique({
            where: {
                id,
            },
        });

        if (!existingAdmin) {
            throw new NotFoundException('Admin not found');
        }

        const updatedAdmin = await prisma.users.update({
            where: {
                id,
            },
            data: {
                ...(data.username !== undefined ? { username: data.username } : {}),
                ...(data.email !== undefined ? { email: data.email } : {}),
                ...(data.phone_number !== undefined ? { phone_number: data.phone_number } : {}),
                ...(data.full_name !== undefined ? { full_name: data.full_name } : {}),
                ...(data.address !== undefined ? { address: data.address } : {}),
                ...(data.password !== undefined ? { password: await bcrypt.hash(data.password, 10) } : {}),
            },
        });

        return this.serializeAdmin(updatedAdmin);
    }

    async deleteAdmin(id: bigint | number) {
        const prisma = this.prisma.client as any;
        await prisma.model_has_roles.deleteMany({
            where: {
                model_id: id,
                model_type: {
                    in: this.adminModelTypes,
                },
            },
        });

        await prisma.users.delete({
            where: {
                id,
            },
        });

        return {
            success: true,
        };
    }

    private async ensureAdminRole() {
        const prisma = this.prisma.client as any;
        const role = await prisma.roles.findFirst({
            where: {
                name: this.adminRoleName,
            },
        });

        if (role) {
            return role;
        }

        return prisma.roles.create({
            data: {
                name: this.adminRoleName,
                guard_name: 'web',
            },
        });
    }

    private serializeAdmin(admin: any) {
        return {
            ...admin,
            id: admin.id?.toString?.() ?? admin.id,
        };
    }

    private async attachCustomerMedia(customers: any[]) {
        if (customers.length === 0) {
            return [];
        }

        const prisma = this.prisma.client as any;
        const customerIds = customers.map((customer) => BigInt(customer.id));
        const mediaRows = await prisma.media.findMany({
            where: {
                model_type: {
                    in: this.customerModelTypes,
                },
                collection_name: this.customerMediaCollection,
                model_id: {
                    in: customerIds,
                },
            },
            orderBy: [
                { order_column: 'asc' },
                { id: 'asc' },
            ],
        });

        const mediaByCustomerId = new Map<string, any[]>();
        for (const media of mediaRows) {
            const customerId = media.model_id.toString();
            const list = mediaByCustomerId.get(customerId) ?? [];
            list.push(this.serializeMedia(media));
            mediaByCustomerId.set(customerId, list);
        }

        return customers.map((customer) => {
            const customerId = customer.id.toString();
            const media = mediaByCustomerId.get(customerId) ?? [];

            return {
                ...customer,
                id: customerId,
                // A license uploaded from this dashboard wins over the legacy media-library one
                license_image: this.isLocalUpload(customer.license_image)
                    ? customer.license_image
                    : media[0]?.original_url ?? null,
            };
        });
    }

    private readonly customerSelect = {
        id: true,
        full_name: true,
        company_name: true,
        phone_number: true,
        email: true,
        address: true,
        status: true,
        license_image: true,
        is_best_customer: true,
        best_customer_order: true,
        created_at: true,
        updated_at: true,
    };

    private isLocalUpload(path?: string | null) {
        return typeof path === 'string' && path.startsWith('/uploads/customers/');
    }

    /** Only accept paths produced by our own upload endpoint; '' clears the license. */
    private cleanLicensePath(path?: string) {
        if (!path) return null;
        if (!this.isLocalUpload(path) || path.includes('..')) {
            throw new BadRequestException('Invalid license image path');
        }
        return path;
    }

    private serializeMedia(media: any) {
        const fileUrl = this.buildMediaUrl(media);

        return {
            ...media,
            id: media.id?.toString?.() ?? media.id,
            model_id: media.model_id?.toString?.() ?? media.model_id,
            size: media.size?.toString?.() ?? media.size,
            original_url: fileUrl,
            preview_url: '',
        };
    }

    private buildMediaUrl(media: any) {
        const baseUrl = (process.env.SYRIAN_BASE_URL ?? '').replace(/\/api\/?$/, '');

        if (!baseUrl) {
            return `/storage/${media.id}/${media.file_name}`;
        }

        return `${baseUrl}/storage/${media.id}/${media.file_name}`;
    }
}