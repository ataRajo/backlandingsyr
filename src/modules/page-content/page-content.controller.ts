import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from 'src/guards/admin.guard';
import { SuperAdminGuard } from 'src/guards/superadmin.guard';
import { PageContentService } from './page-content.service';
import { CreatePageContentDto, SetMediaDto, UpdatePageContentDto } from './dto/page-content.dto';

@Controller('api/page-contents')
export class PageContentController {
    constructor(private readonly pageContentService: PageContentService) { }

    // ── Public ───────────────────────────────────────────────────────────

    /** Texts of one language: { section: { key: value } } */
    @Get('public')
    getPublicContents(@Query('locale') locale?: string) {
        return this.pageContentService.getPublicContents(locale ?? 'ar');
    }

    /** Images & lists of the landing page: { key: json } */
    @Get('media')
    getPublicMedia() {
        return this.pageContentService.getPublicMedia();
    }

    // ── Media (superadmin only) ─────────────────────────────────────────

    @Get('media/admin')
    @UseGuards(SuperAdminGuard)
    listAdminMedia() {
        return this.pageContentService.listAdminMedia();
    }

    @Put('media/admin/:key')
    @UseGuards(SuperAdminGuard)
    setMedia(@Param('key') key: string, @Body() body: SetMediaDto) {
        return this.pageContentService.setMedia(key, body.value);
    }

    @Delete('media/admin/:key')
    @UseGuards(SuperAdminGuard)
    resetMedia(@Param('key') key: string) {
        return this.pageContentService.resetMedia(key);
    }

    // ── Texts (admin + superadmin) ──────────────────────────────────────

    @Get('admin')
    @UseGuards(AdminGuard)
    listAdminContents(
        @Query('locale') locale?: string,
        @Query('section') section?: string,
        @Query('is_active') isActive?: string,
    ) {
        return this.pageContentService.listAdminContents({ locale, section, is_active: isActive });
    }

    @Get('admin/:id')
    @UseGuards(AdminGuard)
    getAdminContent(@Param('id', ParseIntPipe) id: number) {
        return this.pageContentService.getAdminContentById(id);
    }

    @Post('admin')
    @UseGuards(AdminGuard)
    createContent(@Body() body: CreatePageContentDto) {
        return this.pageContentService.createContent(body);
    }

    @Patch('admin/:id')
    @UseGuards(AdminGuard)
    updateContent(@Param('id', ParseIntPipe) id: number, @Body() body: UpdatePageContentDto) {
        return this.pageContentService.updateContent(id, body);
    }

    @Patch('admin/:id/activate')
    @UseGuards(AdminGuard)
    activateContent(@Param('id', ParseIntPipe) id: number) {
        return this.pageContentService.setActiveState(id, true);
    }

    @Patch('admin/:id/deactivate')
    @UseGuards(AdminGuard)
    deactivateContent(@Param('id', ParseIntPipe) id: number) {
        return this.pageContentService.setActiveState(id, false);
    }

    @Delete('admin/:id')
    @UseGuards(AdminGuard)
    deleteContent(@Param('id', ParseIntPipe) id: number) {
        return this.pageContentService.deleteContent(id);
    }
}
