import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('api/chat')
@UseGuards(AuthGuard)
export class ChatController {
    constructor(
        private readonly chatService: ChatService,
        private readonly chatGateway: ChatGateway,
    ) { }

    @Get('conversations')
    async listConversations(@Req() req: any, @Query() query: ListConversationsQueryDto) {
        return this.chatService.listConversations(req.user, query);
    }

    @Post('conversations')
    async createConversation(@Req() req: any, @Body() body: CreateConversationDto) {
        const conversation = await this.chatService.createConversation(req.user, body);
        this.chatGateway.broadcastConversation(conversation);
        return conversation;
    }

    @Get('conversations/:conversationId/messages')
    async listMessages(
        @Req() req: any,
        @Param('conversationId') conversationId: string,
        @Query() query: ListMessagesQueryDto,
    ) {
        return this.chatService.getMessages(req.user, conversationId, query);
    }

    @Post('conversations/:conversationId/messages')
    async sendMessage(
        @Req() req: any,
        @Param('conversationId') conversationId: string,
        @Body() body: SendMessageDto,
    ) {
        const result = await this.chatService.sendMessage(req.user, conversationId, body);
        this.chatGateway.broadcastMessage(result);
        return result;
    }
}