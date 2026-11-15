// Fuzzy matching of Arabic place names (typos, spelling variants, dialect: جميلية / جمايلية / جمالية).

const STOP = /^(حي|منطقه|منطقة|شارع|ساحه|ساحة|منطقت|بحي|بمنطقه|بمنطقة)\s+/;

export function normalizeAr(input: string): string {
    let s = String(input ?? '')
        .toLowerCase()
        .replace(/[ً-ٰٟـ]/g, '') // diacritics, tatweel
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    s = s.replace(STOP, '');
    // drop the definite article and the "ب" (in) prefix on each word
    s = s
        .split(' ')
        .map((w) => w.replace(/^ال/, '').replace(/^(بال|وال)/, ''))
        .join(' ');
    return s.replace(/(.)\1+/g, '$1'); // collapse repeated letters
}

// Treat the long vowels as the same sound so جمايلية ~ جميلية ~ جمالية.
const skeleton = (s: string) => s.replace(/[اويه]/g, '');

export function levenshtein(a: string, b: string): number {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++)
        for (let j = 1; j <= b.length; j++)
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[a.length][b.length];
}

export function similarity(query: string, candidate: string): number {
    const q = normalizeAr(query);
    const c = normalizeAr(candidate);
    if (!q || !c) return 0;
    if (q === c) return 1;
    if (c.includes(q) || q.includes(c)) return Math.min(q.length, c.length) / Math.max(q.length, c.length) < 0.5 ? 0.6 : 0.9;
    const plain = 1 - levenshtein(q, c) / Math.max(q.length, c.length);
    const qs = skeleton(q);
    const cs = skeleton(c);
    const sk = qs && cs ? 1 - levenshtein(qs, cs) / Math.max(qs.length, cs.length) : 0;
    return Math.max(plain, sk * 0.95);
}

export interface RegionMatch {
    id: number;
    name: string;
    city_id: number;
    score: number;
}

/** Best region candidates for a free-text name. `confident` only when one is clearly the right one. */
export function matchRegions(query: string, regions: any[], cityId?: number) {
    const pool = regions.filter((r) => !cityId || Number(r.city_id) === Number(cityId));
    const ranked: RegionMatch[] = pool
        .map((r) => ({ id: Number(r.id), name: String(r.name), city_id: Number(r.city_id), score: Math.round(similarity(query, r.name) * 100) / 100 }))
        .filter((m) => m.score >= 0.6)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
    const [first, second] = ranked;
    const confident = !!first && first.score >= 0.8 && (!second || first.score - second.score >= 0.1);
    return { confident, matches: ranked };
}
