import 'dotenv/config';
import * as readline from 'node:readline/promises';
import OpenAI from 'openai';
import { runAgent } from '../src/modules/ai/ai.agent';
import { getAiConfig } from '../src/modules/ai/ai.config';

// Talk to Salma from the terminal. Uses OpenAI for real, but fake sign data (no DB needed).
const tpl = (id: number, model: string, display: string, size: string) => ({ id, model, type: 'عرضي', display_type: display, size, image: 'img' + id });
const T91 = tpl(91, 'TRB', 'physical', '6X3');
const T77 = tpl(77, 'LED', 'digital', '4X2');
const sign = (id: number, region: number, rn: string, t: any, place: string, dir: string) => ({
    id, template_id: t.id, city_id: 12, region_id: region, place, directions: dir, panels_number: 1, faces_number: 1,
    latitudeX: 33.5, longitudeY: 36.3, is_booked: false, available_date_ranges: [], template: t,
    city: { id: 12, name: 'دمشق' }, region: { id: region, name: rn }, image: 's' + id, roadsign_code: 'S-' + id, ai_results: null,
});
const prices: Record<number, number> = { 1785: 850, 1790: 620, 2001: 1400 };
const data: any = {
    cities: async () => [{ id: 11, name: 'حلب' }, { id: 12, name: 'دمشق' }],
    regions: async () => [{ id: 153, name: 'المزة', city_id: 12 }, { id: 154, name: 'أبو رمانة', city_id: 12 }],
    printings: async () => [{ id: 1, type: 'فلكس عاكس', price: 9 }, { id: 2, type: 'فلكس عادي', price: 7 }],
    roadsigns: async (p: any) => {
        let rows = [
            sign(1785, 153, 'المزة', T91, 'أوتوستراد المزة', 'باتجاه الساحة'),
            sign(1790, 153, 'المزة', T91, 'المزة الجديدة', 'باتجاه الجامعة'),
            sign(2001, 154, 'أبو رمانة', T77, 'الشارع الرئيسي', 'باتجاه المحافظة'),
        ];
        if (p.region_id) rows = rows.filter((r) => r.region_id === +p.region_id);
        if (p.template_id) rows = rows.filter((r) => r.template_id === +p.template_id);
        return rows;
    },
    calculate: async (d: any) => {
        const t = d.roadsigns.reduce((a: number, r: any) => a + (prices[r.road_sign_id] ?? 700), 0);
        return { amount: { total_price: t, total_advertising_price: t, total_printing_price: 0, units: 2,
            details: d.roadsigns.map((r: any) => ({ road_sign_id: r.road_sign_id, face_price: prices[r.road_sign_id] ?? 700 })) } };
    },
};

(async () => {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing in .env');
    const client: any = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const cfg = getAiConfig();
    const session = { t: 0, messages: [] as any[], ctx: { known: new Map(), shown: [] as any[], period: null as any } };
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log(`حكي مع ${cfg.agentName} (اكتب exit للخروج)\n`);
    while (true) {
        const m = (await rl.question('أنت: ')).trim();
        if (!m) continue;
        if (m === 'exit') break;
        const out = await runAgent({ client, cfg, data, session, userMessage: m, today: new Date().toISOString().slice(0, 10) });
        console.log(`\n${cfg.agentName}: ${out.reply}`);
        if (out.signs.length) console.log('  [كروت] ' + out.signs.map((s: any) => `${s.place} - ${s.price}${s.currency}`).join(' | '));
        console.log();
    }
    rl.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
