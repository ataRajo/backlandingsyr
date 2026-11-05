import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { ChatActor, ChatConversationStatus, ChatPagination, ChatSendMessageInput } from './chat.types';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';

type SenderType = 'admin' | 'customer';

@Injectable()
export class ChatService {
    private readonly adminAccountTypes: ChatActor['account_type'][] = ['admin', 'superadmin'];

    constructor(private readonly prisma: PrismaService) { }

    async listConversations(actor: ChatActor, query: ListConversationsQueryDto) {
        const prisma = this.prisma.client as any;
        const { skip, take } = this.resolvePagination(query);

        const conversations = await prisma.chat_conversations.findMany({
            where: this.resolveConversationScope(actor, query.status),
            orderBy: [
                { last_message_at: 'desc' },
                { created_at: 'desc' },
                { id: 'desc' },
            ],
            skip,
            take,
            include: this.conversationInclude(),
        });

        return conversations.map((conversation: any) => this.serializeConversation(conversation));
    }

    async createConversation(actor: ChatActor, data: CreateConversationDto) {
        const prisma = this.prisma.client as any;
        const customerId = this.resolveCustomerId(actor, data.customer_id);

        const existingOpenConversation = await prisma.chat_conversations.findFirst({
            where: {
                customer_id: customerId,
                status: 'open',
            },
            orderBy: {
                created_at: 'desc',
            },
            include: this.conversationInclude(),
        });

        if (existingOpenConversation) {
            return this.serializeConversation(existingOpenConversation);
        }

        const createdConversation = await prisma.chat_conversations.create({
            data: {
                customer_id: customerId,
                created_by_user_id: this.isAdminActor(actor) ? this.parseBigInt(actor.sub, 'admin id') : null,
                assigned_admin_id: this.isAdminActor(actor) ? this.parseBigInt(actor.sub, 'admin id') : null,
                status: 'open',
            },
            include: this.conversationInclude(),
        });

        return this.serializeConversation(createdConversation);
    }

    async getMessages(actor: ChatActor, conversationId: string, query: ListMessagesQueryDto) {
        const prisma = this.prisma.client as any;
        const conversation = await this.assertConversationAccess(actor, conversationId);
        const { skip, take } = this.resolvePagination(query);

        const messages = await prisma.chat_messages.findMany({
            where: {
                conversation_id: conversation.id,
            },
            orderBy: [
                { created_at: 'asc' },
                { id: 'asc' },
            ],
            skip,
            take,
            include: this.messageInclude(),
        });

        return {
            conversation: this.serializeConversation(conversation),
            items: messages.map((message: any) => this.serializeMessage(message)),
            pagination: {
                page: query.page ?? 1,
                limit: query.limit ?? 50,
            },
        };
    }

    async sendMessage(actor: ChatActor, conversationId: string | null | undefined, data: ChatSendMessageInput) {
        const prisma = this.prisma.client as any;
        const normalizedContent = data.content.trim();

        if (!normalizedContent) {
            throw new BadRequestException('Message content is required');
        }

        const conversation = conversationId
            ? await this.assertConversationAccess(actor, conversationId)
            : await this.resolveConversationForSend(actor, data);

        const sender = this.resolveSender(actor);
        const now = new Date();

        const createdMessage = await prisma.chat_messages.create({
            data: {
                conversation_id: conversation.id,
                sender_type: sender.sender_type,
                sender_user_id: sender.sender_user_id,
                sender_customer_id: sender.sender_customer_id,
                content: normalizedContent,
                metadata: null,
            },
            include: this.messageInclude(),
        });

        const updatedConversation = await prisma.chat_conversations.update({
            where: {
                id: conversation.id,
            },
            data: {
                status: 'open',
                last_message_at: now,
                ...(sender.sender_type === 'admin' && !conversation.assigned_admin_id
                    ? { assigned_admin_id: sender.sender_user_id }
                    : {}),
            },
            include: this.conversationInclude(),
        });

        return {
            conversation: this.serializeConversation(updatedConversation),
            message: this.serializeMessage(createdMessage),
        };
    }

    async assertConversationAccess(actor: ChatActor, conversationId: string) {
        const prisma = this.prisma.client as any;
        const id = this.parseBigInt(conversationId, 'conversation id');
        const conversation = await prisma.chat_conversations.findUnique({
            where: {
                id,
            },
            include: this.conversationInclude(),
        });

        if (!conversation) {
            throw new NotFoundException('Conversation not found');
        }

        if (!this.isAdminActor(actor) && conversation.customer_id.toString() !== actor.sub) {
            throw new ForbiddenException('You cannot access this conversation');
        }

        return conversation;
    }

    private async resolveConversationForSend(actor: ChatActor, data: ChatSendMessageInput) {
        if (this.isAdminActor(actor)) {
            if (!data.customer_id) {
                throw new BadRequestException('customer_id is required for admin messages without conversationId');
            }

            return this.createOrReuseOpenConversation(this.parseBigInt(data.customer_id, 'customer id'), actor);
        }

        return this.createOrReuseOpenConversation(this.parseBigInt(actor.sub, 'customer id'), actor);
    }

    private async createOrReuseOpenConversation(customerId: bigint, actor: ChatActor) {
        const prisma = this.prisma.client as any;
        const existingOpenConversation = await prisma.chat_conversations.findFirst({
            where: {
                customer_id: customerId,
                status: 'open',
            },
            orderBy: {
                created_at: 'desc',
            },
            include: this.conversationInclude(),
        });

        if (existingOpenConversation) {
            return existingOpenConversation;
        }

        return prisma.chat_conversations.create({
            data: {
                customer_id: customerId,
                created_by_user_id: this.isAdminActor(actor) ? this.parseBigInt(actor.sub, 'admin id') : null,
                assigned_admin_id: this.isAdminActor(actor) ? this.parseBigInt(actor.sub, 'admin id') : null,
                status: 'open',
            },
            include: this.conversationInclude(),
        });
    }

    private resolveConversationScope(actor: ChatActor, status?: ChatConversationStatus) {
        if (this.isAdminActor(actor)) {
            return status ? { status } : {};
        }

        return {
            customer_id: this.parseBigInt(actor.sub, 'customer id'),
            ...(status ? { status } : {}),
        };
    }

    private resolveCustomerId(actor: ChatActor, requestedCustomerId?: string) {
        if (!this.isAdminActor(actor)) {
            const actorCustomerId = this.parseBigInt(actor.sub, 'customer id');

            if (requestedCustomerId && this.parseBigInt(requestedCustomerId, 'customer id') !== actorCustomerId) {
                throw new ForbiddenException('You cannot create conversations for another customer');
            }

            return actorCustomerId;
        }

        if (!requestedCustomerId) {
            throw new BadRequestException('customer_id is required for admin users');
        }

        return this.parseBigInt(requestedCustomerId, 'customer id');
    }

    private resolveSender(actor: ChatActor) {
        if (this.isAdminActor(actor)) {
            return {
                sender_type: 'admin' as SenderType,
                sender_user_id: this.parseBigInt(actor.sub, 'admin id'),
                sender_customer_id: null,
            };
        }

        if (actor.account_type !== 'customer') {
            throw new UnauthorizedException('Unsupported chat account type');
        }

        return {
            sender_type: 'customer' as SenderType,
            sender_user_id: null,
            sender_customer_id: this.parseBigInt(actor.sub, 'customer id'),
        };
    }

    private isAdminActor(actor: ChatActor) {
        return this.adminAccountTypes.includes(actor?.account_type);
    }

    private parseBigInt(value: string | number | bigint, label: string) {
        try {
            return BigInt(value);
        } catch {
            throw new BadRequestException(`Invalid ${label}`);
        }
    }

    private resolvePagination(query: ChatPagination) {
        const page = Math.max(Number(query?.page ?? 1), 1);
        const limit = Math.min(Math.max(Number(query?.limit ?? 20), 1), 200);

        return {
            skip: (page - 1) * limit,
            take: limit,
        };
    }

    private conversationInclude() {
        return {
            customer: {
                select: {
                    id: true,
                    full_name: true,
                    company_name: true,
                    phone_number: true,
                    email: true,
                    username: true,
                },
            },
            assigned_admin: {
                select: {
                    id: true,
                    username: true,
                    full_name: true,
                    email: true,
                    phone_number: true,
                },
            },
            messages: {
                take: 1,
                orderBy: {
                    created_at: 'desc',
                },
                include: this.messageInclude(),
            },
        };
    }

    private messageInclude() {
        return {
            sender_user: {
                select: {
                    id: true,
                    username: true,
                    full_name: true,
                    email: true,
                },
            },
            sender_customer: {
                select: {
                    id: true,
                    full_name: true,
                    company_name: true,
                    email: true,
                    phone_number: true,
                },
            },
        };
    }

    private serializeConversation(conversation: any) {
        const latestMessage = Array.isArray(conversation?.messages) ? conversation.messages[0] ?? null : null;

        return this.serialize({
            ...conversation,
            latest_message: latestMessage,
            messages: undefined,
        });
    }

    private serializeMessage(message: any) {
        return this.serialize(message);
    }

    private serialize(value: any): any {
        if (value === null || value === undefined) {
            return value;
        }

        if (Array.isArray(value)) {
            return value.map((item) => this.serialize(item));
        }

        if (value instanceof Date) {
            return value;
        }

        if (
            typeof value === 'object' &&
            typeof value.toString === 'function' &&
            typeof value.toFixed === 'function' &&
            typeof value.toNumber === 'function'
        ) {
            return value.toString();
        }

        if (typeof value === 'object') {
            const serialized: any = {};

            for (const key of Object.keys(value)) {
                const nestedValue = value[key];
                if (nestedValue === undefined) {
                    continue;
                }

                serialized[key] = typeof nestedValue === 'bigint' ? nestedValue.toString() : this.serialize(nestedValue);
            }

            return serialized;
        }

        return value;
    }
}