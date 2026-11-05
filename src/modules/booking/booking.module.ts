import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { RoadsignModule } from '../roadsign/roadsign.module';
import { TemplateModule } from '../template/template.module';
import { AuthGuard } from 'src/guards/auth.guard';

@Module({
  imports:[RoadsignModule , TemplateModule],
  providers: [BookingService, AuthGuard],
  controllers: [BookingController]
})
export class BookingModule {}
