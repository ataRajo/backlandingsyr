import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from 'src/guards/admin.guard';
import { NewsService } from './news.service';

@Controller('api/news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  getPublicNews() {
    return this.newsService.listPublicNews();
  }

  @Get('show/:id')
  getPublicNewsById(@Param('id') id: string) {
    return this.newsService.getPublicNewsById(Number(id));
  }

  @Get('admin')
  @UseGuards(AdminGuard)
  listAdminNews() {
    return this.newsService.listAdminNews();
  }

  @Get('admin/:id')
  @UseGuards(AdminGuard)
  getAdminNewsById(@Param('id') id: string) {
    return this.newsService.getAdminNewsById(Number(id));
  }

  @Post('admin')
  @UseGuards(AdminGuard)
  createNews(
    @Body()
    body: {
      title: string;
      slug: string;
      excerpt?: string | null;
      content: string;
      image_url?: string | null;
      is_active?: boolean;
      published_at?: string | Date | null;
    },
  ) {
    return this.newsService.createNews(body);
  }

  @Patch('admin/:id')
  @UseGuards(AdminGuard)
  updateNews(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      slug?: string;
      excerpt?: string | null;
      content?: string;
      image_url?: string | null;
      is_active?: boolean;
      published_at?: string | Date | null;
    },
  ) {
    return this.newsService.updateNews(Number(id), body);
  }

  @Patch('admin/:id/toggle-status')
  @UseGuards(AdminGuard)
  toggleNewsStatus(@Param('id') id: string) {
    return this.newsService.toggleActiveState(Number(id));
  }

  @Patch('admin/:id/activate')
  @UseGuards(AdminGuard)
  activateNews(@Param('id') id: string) {
    return this.newsService.setActiveState(Number(id), true);
  }

  @Patch('admin/:id/deactivate')
  @UseGuards(AdminGuard)
  deactivateNews(@Param('id') id: string) {
    return this.newsService.setActiveState(Number(id), false);
  }

  @Delete('admin/:id')
  @UseGuards(AdminGuard)
  deleteNews(@Param('id') id: string) {
    return this.newsService.deleteNews(Number(id));
  }
}