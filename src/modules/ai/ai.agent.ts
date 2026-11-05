import { AiGateway } from './ai.gateway';
import { AiConfig } from './ai.config';
import { AgentContext, card, createTools } from './ai.tools';

const MAX_STEPS = 8;
const MAX_HISTORY = 30;

/** Minimal OpenAI surface we use (lets tests inject a fake). */
export interface ChatClient {
    chat: { completions: { create(args: any): Promise<any> } };
}

export interface AiSession {
    t: number;
    messages: any[];
    ctx: AgentContext;
}

export function buildSystemPrompt(cfg: AiConfig, today: string): string {
    return `أنتِ ${cfg.agentName}، موظفة مبيعات في ${cfg.companyName}. مهمتك مساعدة الزبون ليحجز أنسب لوحة إعلانية، بأسلوب ودود ومحترف وبدون إطالة.
${cfg.notes}

تاريخ اليوم: ${today}. افهمي التواريخ العربية (كانون، شباط، تشرين...) و"الشهر القادم" و"بعد أسبوعين" بناءً عليه، واستخدمي صيغة YYYY-MM-DD في الأدوات.
العملة: ${cfg.currency}.

## الأسلوب
- ردّي بلغة الزبون (عربي بلهجة بيضاء مفهومة، أو إنكليزي، أو تركي).
- اسألي فقط عما ينقصك: المدينة والتواريخ إلزاميان. المنطقة والقالب اختياريان، واسألي عن هدف الحملة أو الميزانية بسؤال واحد طبيعي، لا استجواب.
- أفضل 1-3 لوحات فقط، لا قوائم طويلة. بعد البحث استدعي present_signs بالأفضل.

## الإقناع (بالحقائق فقط)
- اربطي كل توصية بما هو موجود فعلاً: الموقع والاتجاه (place/directions)، نوع اللوحة (physical/digital) وحجمها، السعر. إن وُجدت audience_data فاستخدمي أرقامها كما هي.
- ممنوع اختراع أي رقم: مشاهدات، جمهور، أسعار، تواريخ، توفر. كل رقم يجب أن يأتي من نتيجة أداة. لا أرقام مشاهدات إن لم تكن في audience_data.
- الأسعار من get_price فقط. لا تحسبي بنفسك.

## البدائل
- إذا قال الزبون غالي، أو لا تعجبني، أو لم تجدي نتائج: استدعي suggest_alternatives وقدّمي البديل كعرض أفضل أو أوفر وليس كاعتذار. وضّحي الفرق بالسعر والموقع بصدق.
- لا تضغطي على الزبون ولا تبالغي. إن كان البديل أضعف في شيء فاذكريه.

## الطباعة
- الطباعة الافتراضية "فلكس عادي". لا تفتحي الموضوع إلا إذا سأل الزبون أو كانت الميزانية ضيقة. استخدمي list_printings ثم مرري printing_id إلى get_price.

## الأخطاء والحجز
- إذا فشلت أداة، قولي بوضوح إن هناك مشكلة تقنية مؤقتة واقترحي المحاولة بعد قليل، ولا تعرضي أي بيانات غير مؤكدة.
- لا تنشئي حجزاً. عندما يقرر الزبون، لخّصي (اللوحات، الفترة، السعر الإجمالي) واطلبي منه اختيار اللوحة من الكرت وإدخال اسمه ورقمه وإرسال الطلب من الزر الأخضر.
- لا تتكلمي عن أمور خارج الإعلانات الطرقية وحجوزات الشركة.`;
}

export async function runAgent(args: {
    client: ChatClient;
    cfg: AiConfig;
    data: AiGateway;
    session: AiSession;
    userMessage: string;
    today: string;
}) {
    const { client, cfg, data, session, userMessage, today } = args;
    const ctx = session.ctx;
    ctx.shown = [];
    ctx.period = null;
    const { impl, schemas } = createTools({ cfg, data, ctx });

    session.messages.push({ role: 'user', content: userMessage });
    const system = { role: 'system', content: buildSystemPrompt(cfg, today) };
    const trace: any[] = [];

    for (let step = 0; step < MAX_STEPS; step++) {
        const history = session.messages.slice(-MAX_HISTORY);
        // never start the history with an orphan tool message
        while (history.length && history[0].role === 'tool') history.shift();

        const res = await client.chat.completions.create({
            model: cfg.model,
            temperature: 0.4,
            messages: [system, ...history],
            tools: schemas,
        });
        const msg = res.choices[0].message;
        session.messages.push(msg);

        if (!msg.tool_calls?.length) {
            return {
                reply: (msg.content ?? '') as string,
                signs: ctx.shown.map(({ id, price }) => ({ ...card(ctx.known.get(id)), price, currency: cfg.currency })),
                period: ctx.period,
                trace,
            };
        }

        for (const call of msg.tool_calls) {
            let result: any;
            const name = call.function.name;
            try {
                const parsed = JSON.parse(call.function.arguments || '{}');
                if (!impl[name]) throw new Error(`unknown tool ${name}`);
                result = await impl[name](parsed);
                trace.push({ tool: name, args: parsed });
            } catch (e: any) {
                trace.push({ tool: name, error: e.message });
                result = { error: 'tool_failed', detail: String(e.message).slice(0, 200) };
            }
            session.messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
        }
    }

    return {
        reply: 'عذراً، تعذّر إكمال الطلب الآن. ممكن تعيد المحاولة بعد قليل؟',
        signs: [] as any[],
        period: null as AgentContext['period'],
        trace,
    };
}
