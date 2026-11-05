import { Controller, Get } from '@nestjs/common';
import { RegionService } from './region.service';

@Controller('api/region')
export class RegionController {
    constructor(private readonly regionService: RegionService) { }

    @Get()
    async getAllRegions() {
        return await this.regionService.getAllRegions();
    }
}
