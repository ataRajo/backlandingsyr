import { Controller, Get, Query } from '@nestjs/common';
import { TemplateService } from './template.service';

@Controller('api/template')
export class TemplateController {

    constructor(private readonly templateService: TemplateService) { }

    @Get()
    async getAllTemplates(
        @Query('city_id') cityId?: string,
        @Query('region_id') regionId?: string,
    ) {
        return await this.templateService.getAllTemplates({
            cityId: cityId ? Number(cityId) : undefined,
            regionId: regionId ? Number(regionId) : undefined,
        });
    }

}
