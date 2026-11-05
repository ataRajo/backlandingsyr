import { Controller, Get, Post, Body, UsePipes, ValidationPipe, UseGuards, Delete, Param } from '@nestjs/common';
import { SeoDTO } from './seoDTO';
import { PrismaService } from 'src/database/prisma.service';
import { AuthGuard } from 'src/guards/auth.guard';
import { SuperAdminGuard } from 'src/guards/superadmin.guard';

@Controller('api/seo')
export class SeoController {
    constructor(private readonly prisma: PrismaService) { }


    @Get()
    async getSeoData() {
        // Fetches all SEO records from the database
        return await this.prisma.seo.findMany();
    }

    @UseGuards(SuperAdminGuard)
    @Delete(':id')
    async deleteSeoData(@Param('id') id: number) {
        // Deletes all SEO records from the database
        await this.prisma.seo.delete({
            where: { id: id },
        });
    }

    @UseGuards(SuperAdminGuard)
    @Post()
    @UsePipes(new ValidationPipe({ whitelist: true }))
    async createSeoData(@Body() seoDto: SeoDTO) {
        const { description } = seoDto;

        const newSeoRecord = await this.prisma.seo.create({
            data: {
                description: description,
            },
        });

        return {
            message: "SEO data created successfully",
            data: newSeoRecord,
        };
    }
}