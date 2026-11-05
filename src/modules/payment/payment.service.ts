import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class PaymentService {

    constructor(private readonly prisma: PrismaService) { }

    async getPayments(actor: any) {
        console.log('Actor:', actor); // Debugging line to check the actor object
        const payments = actor.account_type === 'admin'
            ? await this.prisma.client.payments.findMany()
            : await this.prisma.client.payments.findMany({
                where: { customer_id: actor.sub }
            });

        return payments.map(payment => ({
            ...payment,
            id: Number(payment.id),        // or Number() if it fits
            user_id: Number(payment.user_id) ?? null,
            customer_id: Number(payment.customer_id) ?? null,
            // Add any other BigInt fields here
        }));
    }

    async getById(id: number | bigint) {
        const payment = this.prisma.client.payments.findUnique({
            where: { id: typeof id === 'bigint' ? id : BigInt(id) }
        })

        return payment.then(payment => ({
            ...payment,
            id: Number(payment.id),        // or Number() if it fits
            user_id: Number(payment.user_id) ?? null,
            customer_id: Number(payment.customer_id) ?? null,
            // Add any other BigInt fields here
        }))
    }
}