import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class PrintingsService {
    constructor(private readonly prisma: PrismaService) { }

    async getAllPrintings() {
        const printings = await this.prisma.client.printings.findMany({
            orderBy: {
                id: 'asc',
            },
        });

        return printings.map((printing) => ({
            id: printing.id?.toString?.() ?? printing.id,
            type: printing.type,
            price: Number(printing.price ?? 0),
            created_at: printing.created_at,
            updated_at: printing.updated_at,
        }));
    }

    async getPrintingById(id: bigint | number) {
        const printing = await this.prisma.client.printings.findUnique({
            where: {
                id,
            },
        });

        if (!printing) {
            return null;
        }

        return {
            id: printing.id?.toString?.() ?? printing.id,
            type: printing.type,
            price: Number(printing.price ?? 0),
            created_at: printing.created_at,
            updated_at: printing.updated_at,
        };
    }
}