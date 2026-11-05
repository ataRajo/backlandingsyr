import { Module } from '@nestjs/common';
import { RoadsignService } from './roadsign.service';
import { RoadsignController } from './roadsign.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [RoadsignService],
  controllers: [RoadsignController],
  exports: [RoadsignService]
})
export class RoadsignModule { }
