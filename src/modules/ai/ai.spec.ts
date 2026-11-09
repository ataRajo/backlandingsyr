import { runAgent } from './ai.agent';
import { AiGateway } from './ai.gateway';
import { AiConfig } from './ai.config';
import { createTools, signStatus } from './ai.tools';

// Fake data source with the same shapes as the real landsyr/tsyrback responses.
const tpl = (id: number, model: string, display: string) => ({ id, model, type: 'عرضي', display_type: display, size: '900X300', image: 'img' + id });
const sign = (id: number, region: number, regionName: string, t: any, over: any = {}) => ({
    id, template_id: t.id, city_id: 12, region_id: region, place: 'مكان ' + id, directions: 'اتجاه ' + id,
    panels_number: 1, faces_number: 1, latitudeX: 33.5, longitudeY: 36.3, is_booked: false, available_date_ranges: [],
    template: t, city: { id: 12, name: 'دمشق' }, region: { id: region, name: regionName },
    image: 's' + id, roadsign_code: 'TRB-' + id, ai_results: null, ...over,
});
const T91 = tpl(91, 'TRB', 'physical');
const T77 = tpl(77, 'LED', 'digital');

const fake = (): AiGateway & { calls: any[] } => {
    const calls: any[] = [];
    return {
        calls,
        cities: async () => [{ id: 11, name: 'حلب' }, { id: 12, name: 'دمشق' }],
        regions: async () => [{ id: 135, name: 'نفق تروبيكانا', city_id: 12 }, { id: 153, name: 'المزة', city_id: 12 }],
        printings: async () => [{ id: 1, type: 'فلكس عاكس', price: 9 }, { id: 2, type: 'فلكس عادي', price: 7 }],
        roadsigns: async (p) => {
            calls.push(p);
            // the real API returns only available signs; a week later one more sign is free
            let rows = [sign(1813, 135, 'نفق تروبيكانا', T91), sign(1785, 153, 'المزة', T91), sign(2001, 135, 'نفق تروبيكانا', T77)];
            if (p.start_date === '2026-11-10') rows.push(sign(1811, 135, 'نفق تروبيكانا', T91));
            if (p.region_id) rows = rows.filter((r) => r.region_id === +p.region_id);
            if (p.template_id) rows = rows.filter((r) => r.template_id === +p.template_id);
            return rows;
        },
        calculate: async (d) => {
            const n = d.roadsigns.length;
            return { amount: { total_price: 900 * n + 189 * n, total_advertising_price: 900 * n, total_printing_price: 189 * n, units: 3 * n,
                details: d.roadsigns.map((r: any) => ({ road_sign_id: r.road_sign_id, face_price: 300 })) } };
        },
    };
};

const cfg: AiConfig = { companyName: 'X', agentName: 'سلمى', currency: 'USD', productType: 1, printingId: 2, model: 'm', notes: '', contacts: { damascus: '1', aleppo: '2' } };
const mkCtx = () => ({ known: new Map<number, any>(), shown: [], period: null });

describe('AI employee tools', () => {
    it('search returns compact signs and never invents audience data', async () => {
        const t = createTools({ cfg, data: fake(), ctx: mkCtx() });
        const r = await t.impl.search_signs({ city_id: 12, start_date: '2026-11-03', end_date: '2026-12-04' });
        expect(r.total).toBe(3);
        expect(r.signs.every((s: any) => s.audience_data === undefined)).toBe(true);
    });

    it('price uses the official calculator with the printing default', async () => {
        const data = fake();
        const spy = jest.spyOn(data, 'calculate');
        const ctx = mkCtx();
        const t = createTools({ cfg, data, ctx });
        await t.impl.search_signs({ city_id: 12, start_date: '2026-11-03', end_date: '2026-12-04' });
        const p = await t.impl.get_price({ sign_ids: [1813, 1785], start_date: '2026-11-03', end_date: '2026-12-04' });
        expect(p.total_price).toBe(2178);
        expect(spy.mock.calls[0][0]).toMatchObject({ printing_id: 2, product_type: 1, is_extend: 0 });
    });

    it('alternatives: other template, other region, shifted dates, budget filter', async () => {
        const t = createTools({ cfg, data: fake(), ctx: mkCtx() });
        const base = { city_id: 12, start_date: '2099-11-03', end_date: '2099-12-04', region_id: 135, template_id: 91 };
        const a = await t.impl.suggest_alternatives(base);
        expect(a.other_template_same_region.examples[0].template.display).toBe('digital');
        expect(a.other_region_same_template.examples[0].region).toBe('المزة');
        expect(a.other_template_same_region.examples[0].price).toBeGreaterThan(0);
        const cheap = await t.impl.suggest_alternatives({ ...base, max_price: 1 });
        expect(cheap.other_template_same_region).toBeUndefined();
    });

    it('status helper', () => {
        expect(signStatus({ is_booked: false })).toBe('free');
        expect(signStatus({ is_booked: true, available_date_ranges: [] })).toBe('booked');
        expect(signStatus({ is_booked: true, available_date_ranges: [1] })).toBe('partial');
    });
});

describe('agent loop', () => {
    it('tools -> present_signs -> reply with priced cards (unknown ids dropped)', async () => {
        const script: any[] = [
            [{ n: 'list_cities', a: {} }],
            [{ n: 'search_signs', a: { city_id: 12, start_date: '2026-11-03', end_date: '2026-12-04' } }],
            [{ n: 'present_signs', a: { sign_ids: [1813, 9999], start_date: '2026-11-03', end_date: '2026-12-04' } }],
            'لقيتلك لوحة ممتازة',
        ];
        let i = 0;
        const client = { chat: { completions: { create: async () => {
            const s = script[i++];
            return { choices: [{ message: typeof s === 'string' ? { role: 'assistant', content: s }
                : { role: 'assistant', content: null, tool_calls: s.map((c: any, k: number) => ({ id: `c${i}${k}`, type: 'function', function: { name: c.n, arguments: JSON.stringify(c.a) } })) } }] };
        } } } };
        const out = await runAgent({ client, cfg, data: fake(), session: { t: 0, messages: [], ctx: mkCtx() }, userMessage: 'بدي لوحة بدمشق', today: '2026-11-04' });
        expect(out.reply).toBe('لقيتلك لوحة ممتازة');
        expect(out.signs.map((s: any) => s.id)).toEqual([1813]);
        expect(out.signs[0].price).toBe(1089);
        expect(out.signs[0].currency).toBe('USD');
        expect(out.period).toEqual({ start_date: '2026-11-03', end_date: '2026-12-04' });
    });

    it('a failing data source becomes a tool error, never fake data', async () => {
        const data = fake();
        data.roadsigns = async () => { throw new Error('boom'); };
        const t = createTools({ cfg, data, ctx: mkCtx() });
        await expect(t.impl.search_signs({ city_id: 12, start_date: 'a', end_date: 'b' })).rejects.toThrow('boom');
    });
});
