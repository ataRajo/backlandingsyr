import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

@Injectable()
export class PrismaService
    extends PrismaClient
    implements OnModuleInit, OnModuleDestroy {

    // 1. نحدد خاصية مستقلة تحمل النسخة الممتدة (المفلترة) من الكلاينت
    public client: any;

    constructor() {
        const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
        super({ adapter, log: ['info', 'warn', 'error'] });

        // 2. نقوم بإنشاء الـ Extension وربطها بالخاصية client
        this.client = this.$extends({
            query: {
                $allModels: {
                    async $allOperations({ model, operation, args, query }) {
                        const result = await query(args);
                        return serialize(result); // تطبيق الفلترة والتنظيف تلقائياً هنا
                    }
                }
            }
        });
    }

    async onModuleInit() {
        try {
            await this.$connect();
            // نستخدم الـ client الممتد للتأكد من عمل الاتصال والاستعلام
            await this.client.$queryRaw`SELECT 1`;
            console.log('✅ Prisma connected to MySQL/MariaDB with Global Serialization');
        } catch (error) {
            console.error('❌ Prisma connection error:', error);
            throw error;
        }
    }

    async onModuleDestroy() {
        await this.$disconnect();
        console.log('🔌 Prisma disconnected from MySQL/MariaDB');
    }
}

// دالتك الذكية والآمنة للتعامل مع الـ BigInt والحقول الحساسة بشكل متداخل
function serialize(obj: any): any {
    if (!obj) return obj;
    if (Array.isArray(obj)) return obj.map(serialize);

    // لتجنب المشاكل مع الكائنات الخاصة مثل التواريخ (Date Objects)
    if (obj instanceof Date) return obj;

    // Prisma Decimal objects do not survive generic object traversal well.
    // Convert them to strings so callers can safely cast them to numbers when needed.
    if (
        typeof obj === 'object' &&
        typeof obj.toNumber === 'function' &&
        typeof obj.toFixed === 'function' &&
        typeof obj.toString === 'function'
    ) {
        return obj.toString();
    }

    if (typeof obj === 'object') {
        const out: any = {};
        for (const k of Object.keys(obj)) {
            const v = obj[k];
            if (k === 'password' || k === 'fcm_token') continue;
            out[k] = typeof v === 'bigint' ? v.toString() : serialize(v);
        }
        return out;
    }
    return obj;
}