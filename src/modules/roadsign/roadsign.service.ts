import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { RoadsignDto } from './roadsign.dto';
import { PrismaService } from 'src/database/prisma.service';
import { TemplateService } from '../template/template.service';

@Injectable()
export class RoadsignService {
    private readonly logger = new Logger(RoadsignService.name);

    constructor(
        private readonly http: HttpService,
        private readonly prisma: PrismaService,
    ) { }

    async getAllRoadsigns(data: RoadsignDto) {
        try {
            const response = await firstValueFrom(
                this.http.get(process.env.SYRIAN_BASE_URL + '/road-signs', {
                    params: data,
                }),
            )
            return response.data;
        } catch (error) {
            const axiosError = error as AxiosError;

            this.logger.error(
                `Failed to fetch road signs from upstream API (params: ${JSON.stringify(data)}): ${axiosError.message}`,
                axiosError.response?.data ? JSON.stringify(axiosError.response.data) : axiosError.stack,
            );

            throw new HttpException(
                'تعذر جلب اللوحات حالياً، يرجى المحاولة مرة أخرى',
                HttpStatus.BAD_GATEWAY,
            );
        }
    }


    async getRoadsignById(id: number) {
        return await this.prisma.road_signs.findUnique({
            where: {
                id: id
            }
        });
    }
}
