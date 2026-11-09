import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface TranscriptEntry {
    role: 'user' | 'assistant';
    content: string;
    t: string;
}

const MAX_ENTRIES = 400;

/**
 * Keeps every conversation with Salma so admins / superadmins can read it.
 * Uses its own table (created on startup if missing) and raw SQL, so it needs no
 * Prisma migration or client regeneration.
 */
@Injectable()
export class AiLogService implements OnModuleInit {
    private readonly logger = new Logger(AiLogService.name);
    private ready = false;

    constructor(private readonly prisma: PrismaService) { }

    async onModuleInit() {
        try {
            await this.prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS ai_conversations (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    session_id VARCHAR(100) NOT NULL,
                    lead LONGTEXT NULL,
                    transcript LONGTEXT NULL,
                    message_count INT NOT NULL DEFAULT 0,
                    last_message VARCHAR(500) NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY ai_conversations_session_id_unique (session_id),
                    KEY ai_conversations_updated_at_index (updated_at)
                ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            this.ready = true;
        } catch (e: any) {
            this.logger.error(`could not prepare ai_conversations: ${e?.message}`);
        }
    }

    /** Append one exchange (customer message + Salma's reply) and refresh the lead. Never throws. */
    async record(sessionId: string, userMessage: string, reply: string, lead?: Record<string, string>) {
        if (!this.ready) return;
        try {
            const rows: any[] = await this.prisma.$queryRawUnsafe(
                'SELECT transcript FROM ai_conversations WHERE session_id = ? LIMIT 1',
                sessionId,
            );
            let transcript: TranscriptEntry[] = [];
            if (rows[0]?.transcript) {
                try { transcript = JSON.parse(rows[0].transcript); } catch { transcript = []; }
            }
            const now = new Date().toISOString();
            transcript.push({ role: 'user', content: userMessage, t: now });
            transcript.push({ role: 'assistant', content: reply, t: now });
            if (transcript.length > MAX_ENTRIES) transcript = transcript.slice(-MAX_ENTRIES);

            await this.prisma.$executeRawUnsafe(
                `INSERT INTO ai_conversations (session_id, lead, transcript, message_count, last_message)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    lead = COALESCE(VALUES(lead), lead),
                    transcript = VALUES(transcript),
                    message_count = VALUES(message_count),
                    last_message = VALUES(last_message)`,
                sessionId,
                lead && Object.keys(lead).length ? JSON.stringify(lead) : null,
                JSON.stringify(transcript),
                transcript.filter((m) => m.role === 'user').length,
                userMessage.slice(0, 500),
            );
        } catch (e: any) {
            this.logger.error(`record failed: ${e?.message}`);
        }
    }

    private shape(r: any, withTranscript: boolean) {
        let lead: any = null;
        try { lead = r.lead ? JSON.parse(r.lead) : null; } catch { lead = null; }
        let transcript: any[] | undefined;
        if (withTranscript) {
            try { transcript = r.transcript ? JSON.parse(r.transcript) : []; } catch { transcript = []; }
        }
        return {
            id: Number(r.id),
            session_id: r.session_id,
            lead,
            message_count: Number(r.message_count),
            last_message: r.last_message,
            created_at: r.created_at,
            updated_at: r.updated_at,
            ...(withTranscript ? { transcript } : {}),
        };
    }

    async list(page = 1, limit = 20, q?: string) {
        if (!this.ready) return { data: [], total: 0, page, limit };
        const take = Math.min(Math.max(limit, 1), 100);
        const skip = (Math.max(page, 1) - 1) * take;
        const like = q ? `%${q.replace(/[%_]/g, '')}%` : null;
        const where = like ? 'WHERE lead LIKE ? OR transcript LIKE ?' : '';
        const params = like ? [like, like] : [];
        const rows: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT id, session_id, lead, message_count, last_message, created_at, updated_at
             FROM ai_conversations ${where} ORDER BY updated_at DESC LIMIT ${take} OFFSET ${skip}`,
            ...params,
        );
        const cnt: any[] = await this.prisma.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM ai_conversations ${where}`, ...params);
        return { data: rows.map((r) => this.shape(r, false)), total: Number(cnt[0]?.c ?? 0), page, limit: take };
    }

    async get(id: number) {
        if (!this.ready) return null;
        const rows: any[] = await this.prisma.$queryRawUnsafe('SELECT * FROM ai_conversations WHERE id = ? LIMIT 1', id);
        return rows[0] ? this.shape(rows[0], true) : null;
    }
}
