import { HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import { AiDataService } from './ai.gateway';
import { getAiConfig } from './ai.config';
import { AiSession, ChatClient, runAgent } from './ai.agent';
import { AiLogService } from './ai.log';

const SESSION_TTL_MS = 60 * 60 * 1000;
const RATE_LIMIT = 20; // messages per minute per session

@Injectable()
export class AiService implements OnModuleDestroy {
    private readonly logger = new Logger(AiService.name);
    private client?: ChatClient;
    // In-memory sessions: fine for one instance. Move to Redis/DB if you run several.
    private sessions = new Map<string, AiSession>();
    private hits = new Map<string, number[]>();
    private sweeper = setInterval(() => this.sweep(), 5 * 60 * 1000);

    constructor(private readonly data: AiDataService, private readonly log: AiLogService) {
        this.sweeper.unref();
    }

    onModuleDestroy() {
        clearInterval(this.sweeper);
    }

    private sweep() {
        const now = Date.now();
        for (const [k, s] of this.sessions) if (now - s.t > SESSION_TTL_MS) this.sessions.delete(k);
        for (const [k, arr] of this.hits) if (!arr.some((t) => now - t < 60000)) this.hits.delete(k);
    }

    private getClient(): ChatClient {
        if (!this.client) {
            if (!process.env.OPENAI_API_KEY) {
                throw new HttpException('AI assistant is not configured', HttpStatus.SERVICE_UNAVAILABLE);
            }
            this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) as unknown as ChatClient;
        }
        return this.client;
    }

    private limited(key: string) {
        const now = Date.now();
        const arr = (this.hits.get(key) || []).filter((t) => now - t < 60000);
        arr.push(now);
        this.hits.set(key, arr);
        return arr.length > RATE_LIMIT;
    }

    async chat(message: string, sessionId?: string) {
        const client = this.getClient();
        const sid = sessionId || randomUUID();
        if (this.limited(sid)) throw new HttpException('slow_down', HttpStatus.TOO_MANY_REQUESTS);

        let session = this.sessions.get(sid);
        if (!session) {
            session = { t: Date.now(), messages: [], ctx: { known: new Map(), shown: [], period: null, lead: {} } };
            this.sessions.set(sid, session);
        }
        session.t = Date.now();

        try {
            const out = await runAgent({
                client,
                cfg: getAiConfig(),
                data: this.data,
                session,
                userMessage: message.trim(),
                today: new Date().toISOString().slice(0, 10),
            });
            if (process.env.AI_DEBUG_TRACE) this.logger.log(JSON.stringify(out.trace));
            // Fire-and-forget: the admin log must never slow down or break the chat.
            void this.log.record(sid, message.trim(), out.reply, session.ctx.lead);
            return { session_id: sid, reply: out.reply, signs: out.signs, period: out.period };
        } catch (e: any) {
            this.logger.error(`chat failed: ${e?.message}`);
            if (process.env.AI_DEBUG_ERRORS) {
                throw new HttpException(
                    { statusCode: 502, message: 'agent_failed', detail: e?.message ?? String(e), status: e?.status ?? e?.response?.status },
                    HttpStatus.BAD_GATEWAY,
                );
            }
            throw new HttpException('agent_failed', HttpStatus.BAD_GATEWAY);
        }
    }
}
