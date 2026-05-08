// AI Asistan — Gemini 2.0 Flash + function calling
// Mevcut KPI endpoint'lerini araç (tool) olarak sunar; Gemini hangisini çağıracağına karar verir.

const { GoogleGenAI, Type } = require('@google/genai');
const KpiService = require('./kpiService');

const SYSTEM_INSTRUCTION = `Sen Sporthink e-ticaret KPI dashboard'unun yardımcı asistanısın.
Türkçe, kısa ve net cevap ver. Kullanıcı yöneticidir; kampanya, ürün, satış sorularını sorar.

KURALLAR:
- Veri gerektiren sorularda MUTLAKA önce uygun fonksiyonu çağır (asla tahmin uydurma).
- Tarih verilmemişse "son 30 gün" varsay (anchor tarihi 2025-03-31, yani 2025-03-01 - 2025-03-31).
- Para birimi ₺ (Türk Lirası), sayıları binlik nokta ile yaz (₺12.345).
- ROAS değerini "x" sonekiyle yaz (örn. 5.2x).
- Kısa, kalın markdown ile vurgu yap, gereksiz uzatma.
- Cevabı 2-3 paragrafa sığdır; uzun listede top 5-10 ile sınırla.
- Eğer sorgu "neden", "nasıl iyileştirilir" gibi yorumsalsa: önce veri çek, sonra somut tavsiye ver.

PLATFORM TANIMLARI:
- Meta = Facebook + Instagram ücretli reklamı
- Google = Google Ads
- Organic = SEO, organik sosyal/video
- Direct = URL/yer iminden direkt giren müşteriler`;

// Tool tanımları — Gemini function calling formatı
const TOOLS = [{
  functionDeclarations: [
    {
      name: 'getTopCampaigns',
      description: 'Belirli bir tarih aralığında en çok ciro yapan kampanyaları listeler. Her birinin spend, ROAS, top satılan ürünü gelir.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          startDate: { type: Type.STRING, description: 'YYYYMMDD formatında. Örn: 20250301. Verilmezse son 30 gün.' },
          endDate:   { type: Type.STRING, description: 'YYYYMMDD formatında.' },
          limit:     { type: Type.INTEGER, description: 'Kaç kampanya. Default 5.' },
          platform:  { type: Type.STRING, description: 'meta veya google. Verilmezse hepsi.' },
        },
      },
    },
    {
      name: 'getTopProducts',
      description: 'En çok satan/kazandıran ürünleri listeler. Filtreleme: marka, kategori, tarih.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          startDate: { type: Type.STRING },
          endDate:   { type: Type.STRING },
          limit:     { type: Type.INTEGER, description: 'Default 10.' },
          brand:     { type: Type.STRING, description: 'Marka adı. Örn: Asics, Nike.' },
          category:  { type: Type.STRING, description: 'Kategori. Örn: Ayakkabı, Giyim.' },
        },
      },
    },
    {
      name: 'searchProducts',
      description: 'İsim, marka veya SKU ile ürün arar. Kullanıcı belirli bir ürün hakkında soru sorduğunda kullan.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: 'Aranacak metin (ürün adı, marka veya SKU içinde geçer).' },
          limit: { type: Type.INTEGER, description: 'Default 10.' },
        },
        required: ['query'],
      },
    },
    {
      name: 'getProductDetail',
      description: 'Tek bir ürünün detaylarını ve hangi kampanyalardan geldiğini döndürür.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          sku:       { type: Type.STRING, description: 'Ürün SKU kodu.' },
          startDate: { type: Type.STRING },
          endDate:   { type: Type.STRING },
        },
        required: ['sku'],
      },
    },
    {
      name: 'getCampaignDetail',
      description: 'Bir kampanyanın metrikleri (spend, revenue, ROAS) ve satılan tüm ürünlerini döndürür.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          campaign:  { type: Type.STRING, description: 'Kampanya adı (tam veya yaklaşık).' },
          startDate: { type: Type.STRING },
          endDate:   { type: Type.STRING },
        },
        required: ['campaign'],
      },
    },
    {
      name: 'getPlatformOverview',
      description: '4 platformun (Meta/Google/Organic/Direct) ciro, sipariş, ROAS karşılaştırmasını döndürür.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          startDate: { type: Type.STRING },
          endDate:   { type: Type.STRING },
        },
      },
    },
    {
      name: 'compareCampaigns',
      description: 'İki kampanyayı yan yana karşılaştırır (ciro, spend, ROAS, sipariş, ürün başına ciro).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          campaignA: { type: Type.STRING, description: 'Birinci kampanya adı.' },
          campaignB: { type: Type.STRING, description: 'İkinci kampanya adı.' },
          startDate: { type: Type.STRING },
          endDate:   { type: Type.STRING },
        },
        required: ['campaignA', 'campaignB'],
      },
    },
    {
      name: 'getProductPlatformBreakdown',
      description: 'Bir ürünün farklı platformlardan (Meta/Google/Organic/Direct) ne kadar satıldığını gösterir.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          sku:       { type: Type.STRING, description: 'Ürün SKU.' },
          startDate: { type: Type.STRING },
          endDate:   { type: Type.STRING },
        },
        required: ['sku'],
      },
    },
  ],
}];

// Tool implementasyonları — KPI service'i sarmalar
class ChatTools {
  constructor() {
    this.kpi = new KpiService();
  }

  async getTopCampaigns({ startDate, endDate, limit = 5, platform }) {
    const data = await this.kpi.getCampaignProductBreakdown({
      startDate, endDate, topCampaigns: limit, limitPerCampaign: 1, platform,
    });
    // LLM'e küçük JSON döndür
    return {
      campaigns: (data.campaigns || []).map(c => ({
        kampanya: c.campaign_name,
        platform: c.platform,
        ciro: Math.round(c.totalRevenue),
        spend: Math.round(c.spend),
        roas: c.roas != null ? Number(c.roas.toFixed(2)) : null,
        siparis: c.orderCount,
        adet: c.totalUnits,
        en_cok_satan_urun: c.topProducts?.[0]?.item_name || null,
      })),
    };
  }

  async getTopProducts({ startDate, endDate, limit = 10, brand, category }) {
    const data = await this.kpi.getAllProducts({ startDate, endDate, brand, category });
    const sorted = (data.products || [])
      .filter(p => p.totalRevenue > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);
    return {
      urunler: sorted.map(p => ({
        sku: p.sku,
        urun: p.item_name,
        marka: p.item_brand,
        kategori: p.item_category,
        adet: p.totalUnits,
        ciro: Math.round(p.totalRevenue),
        marj_yuzde: p.marginPercent,
      })),
    };
  }

  async searchProducts({ query, limit = 10 }) {
    const data = await this.kpi.getAllProducts({});
    const q = query.toLowerCase();
    const matches = (data.products || []).filter(p =>
      p.item_name?.toLowerCase().includes(q) ||
      p.item_brand?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.item_category?.toLowerCase().includes(q)
    ).slice(0, limit);
    return {
      sonuclar: matches.map(p => ({
        sku: p.sku, urun: p.item_name, marka: p.item_brand, kategori: p.item_category,
        fiyat: Math.round(p.price), stok: p.stock_quantity, marj_yuzde: p.marginPercent,
      })),
    };
  }

  async getProductDetail({ sku, startDate, endDate }) {
    const [pc, pp] = await Promise.all([
      this.kpi.getProductCampaignBreakdown({ sku, startDate, endDate, limitCampaignsPerProduct: 20 }),
      this.kpi.getProductPlatformBreakdown({ startDate, endDate, limitProducts: 200 }),
    ]);
    const product = pc.products?.[0];
    if (!product) return { hata: 'Ürün bulunamadı' };
    const platformData = pp.products?.find(x => x.sku === sku);
    return {
      urun: {
        sku: product.sku, isim: product.item_name, marka: product.item_brand,
        kategori: product.item_category,
        toplam_ciro: Math.round(product.totalRevenue), toplam_adet: product.totalUnits,
      },
      kampanyalar: (product.campaigns || []).slice(0, 10).map(c => ({
        kampanya: c.campaign_name, platform: c.platform,
        ciro: Math.round(c.revenue), adet: c.units,
      })),
      platform_dagilimi: platformData?.platforms || {},
    };
  }

  async getCampaignDetail({ campaign, startDate, endDate }) {
    // Önce tam eşleşme dene, yoksa kısmi
    const data = await this.kpi.getCampaignProductBreakdown({
      startDate, endDate, topCampaigns: 200, limitPerCampaign: 1000,
    });
    let c = data.campaigns?.find(x => x.campaign_name === campaign);
    if (!c) c = data.campaigns?.find(x => x.campaign_name.toLowerCase().includes(campaign.toLowerCase()));
    if (!c) return { hata: `'${campaign}' isminde kampanya bulunamadı` };
    return {
      kampanya: c.campaign_name, platform: c.platform, hedef: c.objective,
      spend: Math.round(c.spend), ciro: Math.round(c.totalRevenue),
      net_kar: Math.round(c.totalRevenue - c.spend),
      roas: c.roas != null ? Number(c.roas.toFixed(2)) : null,
      siparis: c.orderCount, adet: c.totalUnits,
      satilan_urunler: (c.topProducts || []).slice(0, 15).map(p => ({
        sku: p.sku, urun: p.item_name, adet: p.units_sold, ciro: Math.round(p.revenue),
      })),
    };
  }

  async getPlatformOverview({ startDate, endDate }) {
    const data = await this.kpi.getPlatformOverview({ startDate, endDate });
    return {
      platformlar: (data.platforms || []).map(p => ({
        platform: p.platform,
        ciro: Math.round(p.revenue),
        siparis: p.orders,
        adet: p.units,
        spend: Math.round(p.adSpend),
        roas: p.roas != null ? Number(p.roas.toFixed(2)) : null,
        aov: Math.round(p.aov),
      })),
    };
  }

  async compareCampaigns({ campaignA, campaignB, startDate, endDate }) {
    const data = await this.kpi.getCampaignProductBreakdown({
      startDate, endDate, topCampaigns: 200, limitPerCampaign: 5,
    });
    const find = (name) => data.campaigns?.find(c => c.campaign_name === name)
      || data.campaigns?.find(c => c.campaign_name.toLowerCase().includes(name.toLowerCase()));
    const a = find(campaignA);
    const b = find(campaignB);
    if (!a || !b) return { hata: 'En az bir kampanya bulunamadı' };
    const summary = (c) => ({
      kampanya: c.campaign_name,
      ciro: Math.round(c.totalRevenue), spend: Math.round(c.spend),
      net_kar: Math.round(c.totalRevenue - c.spend),
      roas: c.roas != null ? Number(c.roas.toFixed(2)) : null,
      siparis: c.orderCount, adet: c.totalUnits,
      urun_basina_ciro: c.totalUnits > 0 ? Math.round(c.totalRevenue / c.totalUnits) : 0,
      en_cok_satan: c.topProducts?.[0]?.item_name,
    });
    return { A: summary(a), B: summary(b) };
  }

  async getProductPlatformBreakdown({ sku, startDate, endDate }) {
    const data = await this.kpi.getProductPlatformBreakdown({
      startDate, endDate, limitProducts: 200,
    });
    const p = data.products?.find(x => x.sku === sku);
    if (!p) return { hata: 'Ürün bulunamadı' };
    return {
      urun: { sku: p.sku, isim: p.item_name, toplam_ciro: Math.round(p.totalRevenue) },
      platform_dagilimi: Object.fromEntries(
        Object.entries(p.platforms || {}).map(([k, v]) => [
          k, { ciro: Math.round(v.revenue), adet: v.units, siparis: v.orders },
        ])
      ),
    };
  }
}

class ChatService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY env değişkeni tanımlı değil');
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.tools = new ChatTools();
  }

  async ask(userMessage, history = []) {
    // Gemini'nin beklediği format: history kullanıcı/model dönüşleri
    const contents = [
      ...history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }],
      })),
      { role: 'user', parts: [{ text: userMessage }] },
    ];

    let iteration = 0;
    const maxIterations = 5; // function call zincirleri için

    while (iteration < maxIterations) {
      iteration++;
      const response = await this.ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: TOOLS,
        },
      });

      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      // Function call var mı?
      const functionCalls = parts.filter(p => p.functionCall).map(p => p.functionCall);
      if (functionCalls.length === 0) {
        // Sadece text → final cevap
        const text = parts.map(p => p.text || '').filter(Boolean).join('').trim();
        return { reply: text || 'Yanıt üretilemedi.', iterations: iteration };
      }

      // Function call'ları çalıştır
      const functionResponses = [];
      for (const fc of functionCalls) {
        const toolFn = this.tools[fc.name];
        let result;
        if (typeof toolFn === 'function') {
          try {
            result = await toolFn.call(this.tools, fc.args || {});
          } catch (err) {
            result = { hata: err.message };
          }
        } else {
          result = { hata: `Bilinmeyen fonksiyon: ${fc.name}` };
        }
        functionResponses.push({
          functionResponse: { name: fc.name, response: result },
        });
      }

      // Konuşmaya assistant'ın function call'larını ve tool yanıtlarını ekle
      contents.push({ role: 'model', parts });
      contents.push({ role: 'user', parts: functionResponses });
    }

    return { reply: 'Cevap üretilemedi (max iterasyon aşıldı).', iterations: iteration };
  }
}

module.exports = ChatService;
