import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { MEDIA_LOCALE, MEDIA_SECTION } from './dto/page-content.dto';

type PageContentInput = {
    section: string;
    key: string;
    value: string;
    locale?: string;
    is_active?: boolean;
};

type AdminListFilters = {
    locale?: string;
    section?: string;
    is_active?: string | boolean;
};

const MEDIA_KEY_PATTERN = /^[a-z0-9_]{1,100}$/;
// page_contents.value is a TEXT column on most installs (64 KB)
const MEDIA_MAX_BYTES = 60000;

@Injectable()
export class PageContentService {
    constructor(private readonly prisma: PrismaService) { }

    // ─────────────────────────── Public ───────────────────────────

    /** { section: { key: value } } — texts only (media is served separately) */
    async getPublicContents(locale = 'ar') {
        const contents = await this.prisma.client.page_contents.findMany({
            where: {
                locale,
                is_active: true,
                NOT: { section: MEDIA_SECTION },
            },
            orderBy: [
                { section: 'asc' },
                { key: 'asc' },
                { id: 'asc' },
            ],
        });

        return this.groupContents(contents);
    }

    /** { key: parsedJson } — images & lists managed by the superadmin */
    async getPublicMedia() {
        const rows = await this.prisma.client.page_contents.findMany({
            where: { section: MEDIA_SECTION, locale: MEDIA_LOCALE, is_active: true },
            orderBy: [{ key: 'asc' }, { id: 'asc' }],
        });

        return rows.reduce((acc: Record<string, any>, row: any) => {
            acc[row.key] = this.parseMediaValue(row.value);
            return acc;
        }, {});
    }

    // ─────────────────────────── Texts (admin) ───────────────────────────

    async listAdminContents(filters: AdminListFilters = {}) {
        const where: any = { NOT: { section: MEDIA_SECTION } };

        if (filters.locale) where.locale = filters.locale;
        if (filters.section && filters.section !== MEDIA_SECTION) where.section = filters.section;
        if (filters.is_active !== undefined && filters.is_active !== '') {
            where.is_active = filters.is_active === true || filters.is_active === 'true';
        }

        const contents = await this.prisma.client.page_contents.findMany({
            where,
            orderBy: [
                { section: 'asc' },
                { key: 'asc' },
                { locale: 'asc' },
                { id: 'asc' },
            ],
        });

        return contents.map((content) => this.serializeContent(content));
    }

    async getAdminContentById(id: number) {
        const content = await this.findTextOrFail(id);
        return this.serializeContent(content);
    }

    /**
     * Creates the text, or updates it when the same section/key/locale already
     * exists — so overriding a default landing-page sentence never duplicates rows.
     */
    async createContent(data: PageContentInput) {
        this.assertNotMedia(data.section);
        const locale = data.locale ?? 'ar';

        const existing = await this.prisma.client.page_contents.findFirst({
            where: { section: data.section, key: data.key, locale },
        });

        if (existing) {
            const updated = await this.prisma.client.page_contents.update({
                where: { id: existing.id },
                data: {
                    value: data.value,
                    is_active: data.is_active ?? true,
                },
            });
            return this.serializeContent(updated);
        }

        const content = await this.prisma.client.page_contents.create({
            data: {
                section: data.section,
                key: data.key,
                value: data.value,
                locale,
                is_active: data.is_active ?? true,
            },
        });

        return this.serializeContent(content);
    }

    async updateContent(id: number, data: Partial<PageContentInput>) {
        await this.findTextOrFail(id);
        if (data.section !== undefined) this.assertNotMedia(data.section);

        const updated = await this.prisma.client.page_contents.update({
            where: { id },
            data: {
                ...(data.section !== undefined ? { section: data.section } : {}),
                ...(data.key !== undefined ? { key: data.key } : {}),
                ...(data.value !== undefined ? { value: data.value } : {}),
                ...(data.locale !== undefined ? { locale: data.locale } : {}),
                ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
            },
        });

        return this.serializeContent(updated);
    }

    async setActiveState(id: number, isActive: boolean) {
        return this.updateContent(id, { is_active: isActive });
    }

    async deleteContent(id: number) {
        await this.findTextOrFail(id);

        await this.prisma.client.page_contents.delete({
            where: { id },
        });

        return { success: true };
    }

    // ─────────────────────────── Media (superadmin) ───────────────────────────

    async listAdminMedia() {
        const rows = await this.prisma.client.page_contents.findMany({
            where: { section: MEDIA_SECTION, locale: MEDIA_LOCALE },
            orderBy: [{ key: 'asc' }, { id: 'asc' }],
        });

        return rows.map((row: any) => ({
            ...this.serializeContent(row),
            value: this.parseMediaValue(row.value),
        }));
    }

    async setMedia(key: string, value: any) {
        this.assertMediaKey(key);

        const serialized = JSON.stringify(value ?? null);
        if (Buffer.byteLength(serialized, 'utf8') > MEDIA_MAX_BYTES) {
            throw new BadRequestException('Content is too large, reduce the number of items');
        }

        const existing = await this.prisma.client.page_contents.findFirst({
            where: { section: MEDIA_SECTION, key, locale: MEDIA_LOCALE },
        });

        const row = existing
            ? await this.prisma.client.page_contents.update({
                where: { id: existing.id },
                data: { value: serialized, is_active: true },
            })
            : await this.prisma.client.page_contents.create({
                data: {
                    section: MEDIA_SECTION,
                    key,
                    value: serialized,
                    locale: MEDIA_LOCALE,
                    is_active: true,
                },
            });

        return { ...this.serializeContent(row), value: this.parseMediaValue(row.value) };
    }

    /** Removes the override → the landing page falls back to its built-in default */
    async resetMedia(key: string) {
        this.assertMediaKey(key);
        await this.prisma.client.page_contents.deleteMany({
            where: { section: MEDIA_SECTION, key, locale: MEDIA_LOCALE },
        });
        return { success: true };
    }

    // ─────────────────────────── Helpers ───────────────────────────

    private async findTextOrFail(id: number) {
        if (!Number.isInteger(id) || id <= 0) {
            throw new NotFoundException('Page content not found');
        }

        const existing = await this.prisma.client.page_contents.findUnique({
            where: { id },
        });

        // Media rows are hidden from the text endpoints so a normal admin
        // cannot overwrite superadmin-managed images through them.
        if (!existing || existing.section === MEDIA_SECTION) {
            throw new NotFoundException('Page content not found');
        }

        return existing;
    }

    private assertNotMedia(section?: string) {
        if (section === MEDIA_SECTION) {
            throw new BadRequestException(`Section "${MEDIA_SECTION}" is reserved, use the media endpoints`);
        }
    }

    private assertMediaKey(key: string) {
        if (!MEDIA_KEY_PATTERN.test(key ?? '')) {
            throw new BadRequestException('Invalid media key');
        }
    }

    private parseMediaValue(value: string) {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    private groupContents(contents: any[]) {
        const grouped = contents.reduce((acc: Record<string, Record<string, string>>, item) => {
            if (!acc[item.section]) {
                acc[item.section] = {};
            }

            acc[item.section][item.key] = item.value;
            return acc;
        }, {});

        return grouped;
    }

    private serializeContent(content: any) {
        return {
            ...content,
            id: Number(content.id),
            is_active: Boolean(content.is_active),
        };
    }
}
