import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class RegionService {
    constructor(private readonly http: HttpService) { }

    async getAllRegions() {
        const response = await firstValueFrom(
            this.http.get(process.env.SYRIAN_BASE_URL + '/regions')
        );
        return response.data;
    }
}
