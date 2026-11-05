import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { ChatActor } from './chat.types';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { SocketSendMessageDto } from './dto/socket-send-message.dto';

@Injectable()
@WebSocketGateway({
    namespace: '/chat',
    cors: {
        origin: true,
        credentials: true,
    },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    private readonly logger = new Logger(ChatGateway.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly chatService: ChatService,
    ) { }

    async handleConnection(client: Socket) {
        try {
            const actor = await this.authenticateClient(client);
            client.data.actor = actor;

            if (this.isAdminActor(actor)) {
                await client.join(this.adminRoom());
                client.emit('chat:ready', {
                    role: actor.account_type,
                    scope: 'admin',
                });
                return;
            }

            await client.join(this.customerRoom(actor.sub));
            client.emit('chat:ready', {
                role: actor.account_type,
                scope: 'customer',
            });
        } catch (error) {
            const message = error instanceof UnauthorizedException ? error.message : 'Socket connection failed';

            this.logger.warn(`${message} for socket ${client.id}`);
            client.emit('chat:error', { message });
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket) {
        client.data.actor = undefined;
    }

    @SubscribeMessage('conversations:list')
    async listConversations(
        @ConnectedSocket() client: Socket,
        @MessageBody() query: ListConversationsQueryDto,
    ) {
        console.log('List conversations query:', query);
        return this.chatService.listConversations(this.requireActor(client), query);
    }

    @SubscribeMessage('conversations:create')
    async createConversation(
        @ConnectedSocket() client: Socket,
        @MessageBody() body: CreateConversationDto,
    ) {
        const conversation = await this.chatService.createConversation(this.requireActor(client), body);
        this.broadcastConversation(conversation);
        return conversation;
    }

    @SubscribeMessage('messages:list')
    async listMessages(
        @ConnectedSocket() client: Socket,
        @MessageBody() body: { conversationId: string; query?: ListMessagesQueryDto },
    ) {
        if (!body?.conversationId) {
            throw new BadRequestException('conversationId is required');
        }

        return this.chatService.getMessages(
            this.requireActor(client),
            body.conversationId,
            body.query ?? { page: 1, limit: 50 },
        );
    }

    @SubscribeMessage('messages:send')
    async sendMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() body: SocketSendMessageDto,
    ) {
        const result = await this.chatService.sendMessage(
            this.requireActor(client),
            body.conversationId,
            {
                content: body.content,
                customer_id: body.customer_id,
            },
        );

        this.broadcastMessage(result);
        return result;
    }

    broadcastConversation(conversation: any) {
        const customerRoom = this.customerRoom(conversation.customer_id);
        this.server.to(this.adminRoom()).emit('conversation:new', conversation);
        this.server.to(customerRoom).emit('conversation:new', conversation);
    }

    broadcastMessage(payload: { conversation: any; message: any }) {
        const customerRoom = this.customerRoom(payload.conversation.customer_id);
        this.server.to(this.adminRoom()).emit('message:new', payload);
        this.server.to(customerRoom).emit('message:new', payload);
    }

    private async authenticateClient(client: Socket) {
        const token = this.extractToken(client);

        if (!token) {
            throw new UnauthorizedException('Missing authentication token');
        }

        try {
            const payload = await this.jwtService.verifyAsync(token);

            if (!payload?.sub || !payload?.account_type) {
                throw new UnauthorizedException('Invalid authentication token');
            }

            return {
                sub: String(payload.sub),
                email: payload.email ?? null,
                username: payload.username ?? null,
                account_type: payload.account_type,
            } as ChatActor;
        } catch {
            throw new UnauthorizedException('Invalid authentication token');
        }
    }

    private requireActor(client: Socket) {
        const actor = client.data.actor as ChatActor | undefined;

        if (!actor) {
            throw new UnauthorizedException('Socket is not authenticated');
        }

        return actor;
    }

    private extractToken(client: Socket) {
        const authToken = client.handshake.auth?.token;

        if (typeof authToken === 'string' && authToken.length > 0) {
            return authToken.replace(/^Bearer\s+/i, '');
        }

        const header = client.handshake.headers.authorization;

        if (typeof header === 'string') {
            const [type, token] = header.split(' ');

            if (type === 'Bearer' && token) {
                return token;
            }
        }

        return undefined;
    }

    private isAdminActor(actor: ChatActor) {
        return actor.account_type === 'admin' || actor.account_type === 'superadmin';
    }

    private adminRoom() {
        return 'admins';
    }

    private customerRoom(customerId: string | bigint) {
        return `customer:${customerId.toString()}`;
    }
}