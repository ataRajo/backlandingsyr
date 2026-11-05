import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiDataService } from './ai.gateway';

// PrismaService comes from the global PrismaModule.
@Module({
    imports: [HttpModule],
    controllers: [AiController],
    providers: [AiService, AiDataService],
})
export class AiModule { }
