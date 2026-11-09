import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../guards/admin.guard';
import { AiLogService } from './ai.log';

/** Admins and superadmins can read what customers asked Salma. */
@Controller('api/admin/ai-conversations')
@UseGuards(AdminGuard)
export class AiAdminController {
    constructor(private readonly log: AiLogService) { }

    @Get()
    list(@Query('page') page?: string, @Query('limit') limit?: string, @Query('q') q?: string) {
        return this.log.list(Number(page) || 1, Number(limit) || 20, q?.trim() || undefined);
    }

    @Get(':id')
    async one(@Param('id', ParseIntPipe) id: number) {
        const row = await this.log.get(id);
        if (!row) throw new NotFoundException();
        return row;
    }
}
