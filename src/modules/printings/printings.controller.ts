import { Controller, Get, Param } from '@nestjs/common';
import { PrintingsService } from './printings.service';

@Controller('api/printings')
export class PrintingsController {
    constructor(private readonly printingsService: PrintingsService) { }

    @Get()
    async getAllPrintings() {
        return this.printingsService.getAllPrintings();
    }

    @Get(':id')
    async getPrintingById(@Param('id') id: string) {
        return this.printingsService.getPrintingById(BigInt(id));
    }
}