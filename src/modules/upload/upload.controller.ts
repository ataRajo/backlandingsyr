import { Controller, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminGuard } from 'src/guards/admin.guard';
import { MAX_IMAGE_SIZE, UploadService } from './upload.service';

@Controller('api/uploads')
export class UploadController {
    constructor(private readonly uploadService: UploadService) { }

    /**
     * POST /api/uploads/image?folder=landing|news
     * multipart/form-data, field name: "file"
     * → { url: "/uploads/landing/<name>.jpg", size, mimetype }
     *
     * Admins can upload (needed for news images). Using an image on the
     * landing page (billboards, pricing, slides…) is restricted to the
     * superadmin by the /api/page-contents/media endpoints.
     */
    @Post('image')
    @UseGuards(AdminGuard)
    @UseInterceptors(
        FileInterceptor('file', {
            limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
        }),
    )
    uploadImage(@UploadedFile() file: any, @Query('folder') folder?: string) {
        return this.uploadService.saveImage(file, folder);
    }
}
