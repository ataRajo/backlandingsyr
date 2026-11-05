import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { PaymentService } from './payment.service';

@Controller('api/payment')
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) { }

    @Get()
    @UseGuards(AuthGuard)
    async getPayments(@Req() req: any) {
        return this.paymentService.getPayments(req.user);
    }

    @Get(':id')
    @UseGuards(AuthGuard)
    async getById(@Param('id') id: number | bigint) {
        const payment = await this.paymentService.getById(id);
        if (!payment) {
            return { message: 'Payment not found' };
        }
        return payment;
    }
}
