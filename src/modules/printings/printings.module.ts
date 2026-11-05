import { Module } from '@nestjs/common';
import { PrintingsController } from './printings.controller';
import { PrintingsService } from './printings.service';

@Module({
  controllers: [PrintingsController],
  providers: [PrintingsService],
})
export class PrintingsModule {}