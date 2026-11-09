/** Company/persona settings. Override any of them from .env without touching code. */
export interface AiConfig {
    companyName: string;
    agentName: string;
    currency: string;
    productType: number;
    printingId: number;
    model: string;
    notes: string;
    contacts: { damascus: string; aleppo: string };
}

export const getAiConfig = (): AiConfig => ({
    companyName: process.env.AI_COMPANY_NAME || 'الشركة السورية للإعلان الطرقي',
    agentName: process.env.AI_AGENT_NAME || 'سلمى',
    // TODO confirm with the company: the prices returned by get-calculate-Amount are in this currency.
    currency: process.env.AI_CURRENCY || 'USD',
    productType: Number(process.env.AI_PRODUCT_TYPE || 1),
    printingId: Number(process.env.AI_PRINTING_ID || 2), // 2 = فلكس عادي
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    contacts: {
        damascus: process.env.AI_CONTACT_DAMASCUS || '+963 977 888 981',
        aleppo: process.env.AI_CONTACT_ALEPPO || '+963 992 400 040',
    },
    notes: 'نحن شركة إعلانات طرقية في سوريا. اللوحات إما physical (مطبوعة) أو digital (شاشات). الحجز بوحدات من ~14 يوم.',
});
