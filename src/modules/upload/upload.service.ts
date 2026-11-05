import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';

export const UPLOADS_ROOT = join(process.cwd(), 'uploads');
export const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8 MB

const ALLOWED_FOLDERS = ['landing', 'news', 'customers'] as const;
export type UploadFolder = (typeof ALLOWED_FOLDERS)[number];

// Only raster formats. SVG is intentionally NOT allowed (it can carry scripts).
const MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

@Injectable()
export class UploadService {
    isAllowedMime(mime?: string) {
        return !!mime && mime in MIME_TO_EXT;
    }

    resolveFolder(folder?: string): UploadFolder {
        return (ALLOWED_FOLDERS as readonly string[]).includes(folder ?? '')
            ? (folder as UploadFolder)
            : 'landing';
    }

    async saveImage(file: { buffer: Buffer; mimetype: string; size: number } | undefined, folder?: string) {
        if (!file || !file.buffer) {
            throw new BadRequestException('No file uploaded (expected field name "file")');
        }

        if (!this.isAllowedMime(file.mimetype)) {
            throw new BadRequestException('Only JPG, PNG, WEBP and GIF images are allowed');
        }

        if (!this.matchesSignature(file.buffer, file.mimetype)) {
            throw new BadRequestException('File content does not match its image type');
        }

        const target = this.resolveFolder(folder);
        const dir = join(UPLOADS_ROOT, target);
        await fs.mkdir(dir, { recursive: true });

        const filename = `${Date.now()}-${randomUUID()}.${MIME_TO_EXT[file.mimetype]}`;
        await fs.writeFile(join(dir, filename), file.buffer);

        return {
            // Relative path — the frontend prefixes it with the API base URL.
            url: `/uploads/${target}/${filename}`,
            size: file.size,
            mimetype: file.mimetype,
        };
    }

    /** Magic-byte check so a renamed .php/.html can't sneak in as "image/png". */
    private matchesSignature(buf: Buffer, mime: string) {
        if (buf.length < 12) return false;
        switch (mime) {
            case 'image/jpeg':
                return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
            case 'image/png':
                return buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
            case 'image/gif':
                return buf.subarray(0, 4).toString('ascii') === 'GIF8';
            case 'image/webp':
                return buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP';
            default:
                return false;
        }
    }
}
