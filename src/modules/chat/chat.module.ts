import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { PrismaModule } from 'src/database/prisma.module';
import { AuthGuard } from 'src/guards/auth.guard';

@Module({
    imports: [PrismaModule],
    controllers: [ChatController],
    providers: [ChatService, ChatGateway, AuthGuard],
    exports: [ChatService],
})
export class ChatModule { }