import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { BookingService } from './booking.service';
import { AuthGuard } from 'src/guards/auth.guard';
import { CreateBookingDto } from './dtos/cratebooking.dto';

@Controller('api/booking')
export class BookingController {

    constructor(private readonly bookingService: BookingService) { }

    @Get()
    @UseGuards(AuthGuard)
    async getBookings(@Req() req: any, @Query() filters: any) {
        return this.bookingService.getBookings(req.user, filters);
    }

    @Post()
    @UseGuards(AuthGuard)
    async crateBooking(@Req() req: any, @Body() createBookingDto: CreateBookingDto) {
        return this.bookingService.createBooking(req.user, createBookingDto);
    }
}
