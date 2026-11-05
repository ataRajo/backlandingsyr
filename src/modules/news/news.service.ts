import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';

type NewsInput = {
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  image_url?: string | null;
  is_active?: boolean;
  published_at?: string | Date | null;
};

@Injectable()
export class NewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublicNews() {
    const prisma = this.prisma.client as any;
    const items = await prisma.news.findMany({
      where: {
        is_active: true,
      },
      orderBy: [
        { published_at: 'desc' },
        { created_at: 'desc' },
        { id: 'desc' },
      ],
    });

    return items.map((item: any) => this.serializeNews(item));
  }

  async getPublicNewsById(id: number) {
    const prisma = this.prisma.client as any;
    const item = await prisma.news.findFirst({
      where: {
        id,
        is_active: true,
      },
    });

    if (!item) {
      throw new NotFoundException('News not found');
    }

    return this.serializeNews(item);
  }

  async listAdminNews() {
    const prisma = this.prisma.client as any;
    const items = await prisma.news.findMany({
      orderBy: [
        { published_at: 'desc' },
        { created_at: 'desc' },
        { id: 'desc' },
      ],
    });

    return items.map((item: any) => this.serializeNews(item));
  }

  async getAdminNewsById(id: number) {
    const prisma = this.prisma.client as any;
    const item = await prisma.news.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('News not found');
    }

    return this.serializeNews(item);
  }

  async createNews(data: NewsInput) {
    const prisma = this.prisma.client as any;
    const created = await prisma.news.create({
      data: {
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt ?? null,
        content: data.content,
        image_url: data.image_url ?? null,
        is_active: data.is_active ?? true,
        published_at: data.published_at ? new Date(data.published_at) : null,
      },
    });

    return this.serializeNews(created);
  }

  async updateNews(id: number, data: Partial<NewsInput>) {
    const prisma = this.prisma.client as any;
    const existing = await prisma.news.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('News not found');
    }

    const updated = await prisma.news.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.excerpt !== undefined ? { excerpt: data.excerpt } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.image_url !== undefined ? { image_url: data.image_url } : {}),
        ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
        ...(data.published_at !== undefined
          ? { published_at: data.published_at ? new Date(data.published_at) : null }
          : {}),
      },
    });

    return this.serializeNews(updated);
  }

  async setActiveState(id: number, isActive: boolean) {
    return this.updateNews(id, { is_active: isActive });
  }

  async toggleActiveState(id: number) {
    const existing = await this.getAdminNewsById(id);
    return this.updateNews(id, { is_active: !existing.is_active });
  }

  async deleteNews(id: number) {
    const prisma = this.prisma.client as any;
    const existing = await prisma.news.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('News not found');
    }

    await prisma.news.delete({
      where: { id },
    });

    return { success: true };
  }

  private serializeNews(news: any) {
    return {
      ...news,
      id: news.id?.toString?.() ?? news.id,
      image_url: news.image_url ?? null,
      is_active: Boolean(news.is_active),
    };
  }
}