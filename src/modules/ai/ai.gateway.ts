import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../database/prisma.service';

/** What the AI employee needs from the company's systems. */
export interface AiGateway {
    cities(): Promise<any[]>;
    regions(): Promise<any[]>;
    printings(): Promise<any[]>;
    roadsigns(params: Record<string, any>): Promise<any[]>;
    calculate(payload: any): Promise<any>;
}

const TTL_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 20000;

export const unwrap = (x: any): any[] =>
    Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : [];

/**
 * Same data sources the public endpoints use (SYRIAN_BASE_URL + local printings table),
 * called directly instead of over HTTP. There is NO mock fallback on purpose:
 * if a source fails the agent must say so instead of inventing data.
 */
@Injectable()
export class AiDataService implements AiGateway {
    private cache = new Map<string, { t: number; v: any }>();

    constructor(
        private readonly http: HttpService,
        private readonly prisma: PrismaService,
    ) { }

    private async cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
        const hit = this.cache.get(key);
        if (hit && Date.now() - hit.t < TTL_MS) return hit.v;
        const v = await fn();
        this.cache.set(key, { t: Date.now(), v });
        return v;
    }

    private async upstream(path: string, params?: Record<string, any>) {
        const clean = Object.fromEntries(
            Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== ''),
        );
        const res = await firstValueFrom(
            this.http.get(process.env.SYRIAN_BASE_URL + path, { params: clean, timeout: TIMEOUT_MS }),
        );
        return res.data;
    }

    cities() {
        return this.cached('cities', async () => unwrap(await this.upstream('/cities')));
    }

    regions() {
        return this.cached('regions', async () => unwrap(await this.upstream('/regions')));
    }

    printings() {
        return this.cached('printings', async () => {
            const rows = await this.prisma.client.printings.findMany({ orderBy: { id: 'asc' } });
            return rows.map((p: any) => ({ id: Number(p.id), type: p.type, price: Number(p.price ?? 0) }));
        });
    }

    async roadsigns(params: Record<string, any>) {
        return unwrap(await this.upstream('/road-signs', params));
    }

    async calculate(payload: any) {
        const url = process.env.AI_CALC_URL || 'https://tsyrback.addresses.sy/api/get-calculate-Amount';
        const res = await firstValueFrom(this.http.post(url, payload, { timeout: TIMEOUT_MS }));
        return res.data;
    }
}
