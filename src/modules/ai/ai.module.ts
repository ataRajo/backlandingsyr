import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiDataService } from './ai.gateway';
import { AiLogService } from './ai.log';
import { AiAdminController } from './ai.admin.controller';

// PrismaService comes from the global PrismaModule.
@Module({
    imports: [HttpModule],
    controllers: [AiController, AiAdminController],
    providers: [AiService, AiDataService, AiLogService],
})
export class AiModule { }
