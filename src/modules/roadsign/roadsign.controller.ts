import { Controller, Get, Query } from '@nestjs/common';
import { RoadsignDto } from './roadsign.dto';
import { RoadsignService } from './roadsign.service';

@Controller('api/roadsign')
export class RoadsignController {
    constructor(private readonly roadsignService: RoadsignService) { }

    @Get()
    async getAllRoadsigns(@Query() roadsignDto: RoadsignDto) {
        return this.roadsignService.getAllRoadsigns(roadsignDto);
    }

}
