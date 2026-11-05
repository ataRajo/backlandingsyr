import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class CityService {

    constructor(private readonly http: HttpService) { }

    async getCities() {
        const response = await firstValueFrom(this.http.get(process.env.SYRIAN_BASE_URL + '/cities'));
        return response.data;
    }
}
