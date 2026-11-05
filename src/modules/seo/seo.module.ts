import { Module } from '@nestjs/common';
import { SeoController } from './seo.controller';
import { PrismaService } from 'src/database/prisma.service';
import { JwtModule } from '@nestjs/jwt'; // 👈 مطلوب من أجل AuthGuard و SuperAdminGuard

@Module({
    controllers: [SeoController],
})
export class SeoModule { }