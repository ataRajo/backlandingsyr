import { AiGateway } from './ai.gateway';
import { AiConfig } from './ai.config';

// Tools the model can call. Everything returned to the model comes from the company's
// real data. The model never touches the database directly.

const MAX_SIGNS_TO_MODEL = 8;
const MAX_PRICED = 6;
const DAY = 86400000;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const shiftDate = (s: string, days: number) => iso(new Date(new Date(s).getTime() + days * DAY));

export type SignStatus = 'free' | 'partial' | 'booked';

// The roadsign API returns only signs available for the requested dates. These
// statuses stay as a safety net for responses that do include booked signs.
export function signStatus(s: any): SignStatus {
    if (!s.is_booked) return 'free';
    return Array.isArray(s.available_date_ranges) && s.available_date_ranges.length ? 'partial' : 'booked';
}

export function compactSign(s: any) {
    return {
        id: s.id,
        code: s.roadsign_code,
        status: signStatus(s),
        free_ranges: s.available_date_ranges?.length ? s.available_date_ranges : undefined,
        place: s.place,
        directions: s.directions,
        region: s.region?.name,
        region_id: s.region_id,
        city: s.city?.name,
        template_id: s.template_id,
        template: s.template
            ? { model: s.template.model, type: s.template.type, display: s.template.display_type, size: s.template.size }
            : undefined,
        // Real data only. null stays absent so the model cannot "fill in" numbers.
        audience_data: s.ai_results || undefined,
    };
}

export function card(s: any) {
    return {
        id: s.id,
        code: s.roadsign_code,
        status: signStatus(s),
        place: s.place,
        directions: s.directions,
        region: s.region?.name,
        city: s.city?.name,
        template: s.template && {
            id: s.template.id, model: s.template.model, type: s.template.type,
            display_type: s.template.display_type, size: s.template.size, image: s.template.image,
        },
        image: s.image,
        lat: s.latitudeX,
        lng: s.longitudeY,
        free_ranges: s.available_date_ranges,
    };
}

export interface AgentContext {
    known: Map<number, any>;
    shown: { id: number; price: number | null }[];
    period: { start_date: string; end_date: string } | null;
}

export function createTools(deps: { cfg: AiConfig; data: AiGateway; ctx: AgentContext }) {
    const { cfg, data, ctx } = deps;
    const remember = (signs: any[]) => signs.forEach((s) => ctx.known.set(Number(s.id), s));

    async function priceOf(signs: any[], start: string, end: string, opts: { product_type?: number; printing_id?: number } = {}) {
        const payload = {
            roadsigns: signs.map((s) => ({
                road_sign_id: s.id,
                booking_faces: s.faces_number || 1,
                start_date: start,
                end_date: end,
                number_of_reserved_panels: s.panels_number || 1,
            })),
            product_type: opts.product_type ?? cfg.productType,
            start_date: start,
            end_date: end,
            is_extend: 0,
            printing_id: opts.printing_id ?? cfg.printingId,
        };
        const r = await data.calculate(payload);
        const a = r?.amount ?? {};
        return {
            total_price: a.total_price as number | undefined,
            advertising_price: a.total_advertising_price,
            printing_price: a.total_printing_price,
            units: a.units,
            per_sign: (a.details || []).map((d: any) => ({ id: d.road_sign_id, face_price: d.face_price })),
            currency: cfg.currency,
        };
    }

    const impl: Record<string, (args: any) => Promise<any>> = {
        async list_cities() {
            return (await data.cities()).map((c: any) => ({ id: c.id, name: c.name }));
        },

        async list_printings() {
            return (await data.printings()).map((r: any) => ({ id: Number(r.id), type: r.type, price_per_space_unit: Number(r.price) }));
        },

        async list_regions({ city_id }) {
            return (await data.regions())
                .filter((r: any) => Number(r.city_id) === Number(city_id))
                .map((r: any) => ({ id: r.id, name: r.name }));
        },

        async search_signs({ city_id, start_date, end_date, region_id, template_id }) {
            const all = await data.roadsigns({ city_id, start_date, end_date, region_id, template_id });
            remember(all);
            const order = { free: 0, partial: 1, booked: 2 };
            const sorted = [...all].sort((a, b) => order[signStatus(a)] - order[signStatus(b)]);
            return {
                total: all.length,
                free: all.filter((s) => signStatus(s) === 'free').length,
                partial: all.filter((s) => signStatus(s) === 'partial').length,
                signs: sorted.slice(0, MAX_SIGNS_TO_MODEL).map(compactSign),
                note: all.length > MAX_SIGNS_TO_MODEL ? `showing ${MAX_SIGNS_TO_MODEL} of ${all.length}; narrow by region/template` : undefined,
            };
        },

        async get_price({ sign_ids, start_date, end_date, product_type, printing_id }) {
            const signs = (sign_ids as number[]).map((id) => ctx.known.get(Number(id)) || { id: Number(id) });
            return priceOf(signs, start_date, end_date, { product_type, printing_id });
        },

        // Deterministic alternatives engine: the model only narrates the result.
        async suggest_alternatives({ city_id, start_date, end_date, region_id, template_id, max_price }) {
            const pool = await data.roadsigns({ city_id, start_date, end_date });
            remember(pool);
            const free = pool.filter((s) => signStatus(s) === 'free');
            const sameRegion = (s: any) => !!region_id && Number(s.region_id) === Number(region_id);
            const sameTemplate = (s: any) => !!template_id && Number(s.template_id) === Number(template_id);

            const groups: Record<string, any[]> = {
                other_template_same_region: free.filter((s) => sameRegion(s) && !sameTemplate(s)),
                other_region_same_template: free.filter((s) => !sameRegion(s) && (!template_id || sameTemplate(s))),
                other_region_other_template: free.filter((s) => !sameRegion(s) && !!template_id && !sameTemplate(s)),
            };

            // Same place, different dates: a week earlier / later.
            const shifted: Record<string, { start_date: string; end_date: string; signs: any[] }> = {};
            for (const days of [-7, 7]) {
                const s2 = shiftDate(start_date, days);
                const e2 = shiftDate(end_date, days);
                if (new Date(s2) < new Date(iso(new Date()))) continue;
                const rows = await data.roadsigns({ city_id, region_id, template_id, start_date: s2, end_date: e2 });
                remember(rows);
                const f = rows.filter((s) => signStatus(s) === 'free');
                if (f.length) shifted[`${days > 0 ? 'plus' : 'minus'}_7_days`] = { start_date: s2, end_date: e2, signs: f };
            }

            const partial = pool.filter((s) => signStatus(s) === 'partial' && (!region_id || sameRegion(s)));

            // Price a few candidates (one calculator call each, in parallel, capped).
            let budget = MAX_PRICED;
            const priceFirst = async (signs: any[], s: string, e: string) => {
                const pick = signs.slice(0, 2).slice(0, Math.max(budget, 0));
                budget -= pick.length;
                return Promise.all(
                    pick.map(async (sg) => {
                        const p = await priceOf([sg], s, e).catch(() => null);
                        return { ...compactSign(sg), price: p?.total_price, currency: cfg.currency };
                    }),
                );
            };

            const out: Record<string, any> = {};
            for (const [k, v] of Object.entries(groups)) {
                if (!v.length) continue;
                let items = await priceFirst(v, start_date, end_date);
                if (max_price) items = items.filter((i) => i.price == null || i.price <= max_price);
                if (items.length) out[k] = { count: v.length, examples: items };
            }
            for (const [k, v] of Object.entries(shifted)) {
                const items = await priceFirst(v.signs, v.start_date, v.end_date);
                out[k] = { start_date: v.start_date, end_date: v.end_date, count: v.signs.length, examples: items };
            }
            if (partial.length) out.partially_free_here = partial.slice(0, 3).map(compactSign);

            return Object.keys(out).length ? out : { none: true, message: 'no alternatives found for these filters' };
        },

        // Cards shown in the UI. Prices come from the official calculator, one call per card.
        async present_signs({ sign_ids, start_date, end_date }) {
            const ids = [...new Set(((sign_ids as any[]) || []).map(Number))].filter((id) => ctx.known.has(id)).slice(0, 4);
            const items = await Promise.all(
                ids.map(async (id) => {
                    const p = await priceOf([ctx.known.get(id)], start_date, end_date).catch(() => null);
                    return { id, price: p?.total_price ?? null };
                }),
            );
            ctx.shown = items;
            ctx.period = { start_date, end_date };
            return { displayed: items.length, prices: items, currency: cfg.currency };
        },
    };

    const fn = (name: string, description: string, properties: Record<string, any>, required: string[] = []) => ({
        type: 'function' as const,
        function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } },
    });
    const int = { type: 'integer' };
    const str = { type: 'string' };

    const schemas = [
        fn('list_cities', 'قائمة المدن مع ids. استدعِها لتحويل اسم المدينة (مثلاً دمشق) إلى city_id.', {}),
        fn('list_printings', 'أنواع الطباعة وأسعارها (فلكس عاكس، فلكس عادي، طباعة خارجية). الافتراضي فلكس عادي؛ اذكري الخيارات فقط إذا سأل الزبون عن الطباعة.', {}),
        fn('list_regions', 'مناطق مدينة معينة مع ids. لتحويل اسم منطقة إلى region_id.', { city_id: int }, ['city_id']),
        fn(
            'search_signs',
            'ابحث عن لوحات متاحة في مدينة ضمن فترة. region_id و template_id اختياريان.',
            { city_id: int, start_date: { ...str, description: 'YYYY-MM-DD' }, end_date: { ...str, description: 'YYYY-MM-DD' }, region_id: int, template_id: int },
            ['city_id', 'start_date', 'end_date'],
        ),
        fn(
            'get_price',
            'السعر الرسمي لحجز لوحة أو أكثر ضمن فترة (من نظام الشركة). لا تحسب السعر بنفسك أبداً.',
            { sign_ids: { type: 'array', items: int }, start_date: str, end_date: str, product_type: int, printing_id: int },
            ['sign_ids', 'start_date', 'end_date'],
        ),
        fn(
            'suggest_alternatives',
            'بدائل حقيقية ومسعّرة عندما لا يناسب الزبون الخيار الحالي (غالي، لم يعجبه، لا نتائج): قالب آخر، منطقة أخرى، أو تواريخ قريبة. استدعِها بدل الاعتذار.',
            { city_id: int, start_date: str, end_date: str, region_id: int, template_id: int, max_price: { type: 'number', description: 'ميزانية الزبون إن ذكرها' } },
            ['city_id', 'start_date', 'end_date'],
        ),
        fn(
            'present_signs',
            'اعرض للزبون كروت اللوحات (صورة وموقع وسعر رسمي) في الواجهة. استدعِها بأفضل 1-3 لوحات توصي بها فقط، بعد البحث، مع فترة الحجز المطلوبة.',
            { sign_ids: { type: 'array', items: int, maxItems: 4 }, start_date: str, end_date: str },
            ['sign_ids', 'start_date', 'end_date'],
        ),
    ];

    return { impl, schemas };
}
