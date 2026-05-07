const express = require('express');
const XLSX = require('xlsx');
const { authenticate } = require('../middleware/auth');
const KpiService = require('../services/kpiService');

const router = express.Router();

const fmtNum = (n) => Number(n || 0);
const fmtRound = (n) => Math.round(Number(n || 0));

router.get('/excel', authenticate, async (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      channel: req.query.channel,
      campaign: req.query.campaign,
      device: req.query.device,
      city: req.query.city,
      brand: req.query.brand,
      category: req.query.category,
      platform: req.query.platform,
    };
    // Platform overview için filter'dan platform'u çıkar (4 platformu da görmek için)
    const { platform: _ignore, ...filtersAll } = filters;

    const kpi = new KpiService();

    // Tüm verileri paralel çek
    const [platformOverview, campaignBreakdown, productCampaign, productPlatform] = await Promise.all([
      kpi.getPlatformOverview(filtersAll),
      kpi.getCampaignProductBreakdown({ ...filters, topCampaigns: 100, limitPerCampaign: 5 }),
      kpi.getProductCampaignBreakdown({ ...filters, limitProducts: 100, limitCampaignsPerProduct: 5 }),
      kpi.getProductPlatformBreakdown({ ...filters, limitProducts: 100 }),
    ]);

    const wb = XLSX.utils.book_new();

    // ============================================================
    // SAYFA 1: Genel Özet (Platform KPI'ları)
    // ============================================================
    const ozet = (platformOverview.platforms || []).map(p => ({
      'Platform': p.platform,
      'Reklam Harcama (₺)': fmtRound(p.adSpend),
      'Ciro (₺)': fmtRound(p.revenue),
      'Sipariş Sayısı': fmtNum(p.orders),
      'Satılan Adet': fmtNum(p.units),
      'Ortalama Sipariş Değeri (₺)': fmtRound(p.aov),
      'ROAS': p.roas != null ? Number(p.roas.toFixed(2)) : '',
      'Gösterim': fmtNum(p.impressions || 0),
      'Tıklama': fmtNum(p.clicks || 0),
      'CTR (%)': p.ctr ? Number((p.ctr * 100).toFixed(2)) : 0,
    }));
    const wsOzet = XLSX.utils.json_to_sheet(ozet);
    setColumnWidths(wsOzet, [16, 20, 16, 15, 14, 24, 8, 12, 12, 10]);
    XLSX.utils.book_append_sheet(wb, wsOzet, 'Genel Özet');

    // ============================================================
    // SAYFA 2: Kampanya Performansı
    // ============================================================
    const kampanyalar = (campaignBreakdown.campaigns || []).map(c => ({
      'Kampanya Adı': c.campaign_name,
      'Platform': (c.platform || '').toUpperCase(),
      'Hedef': c.objective || '',
      'Durum': c.status || '',
      'Reklam Harcama (₺)': fmtRound(c.spend),
      'Ciro (₺)': fmtRound(c.totalRevenue),
      'Net Kâr (₺)': fmtRound((c.totalRevenue || 0) - (c.spend || 0)),
      'ROAS': c.roas != null ? Number(c.roas.toFixed(2)) : '',
      'Sipariş Sayısı': fmtNum(c.orderCount),
      'Satılan Adet': fmtNum(c.totalUnits),
      'Ortalama Sipariş Değeri (₺)': c.orderCount > 0 ? Math.round(c.totalRevenue / c.orderCount) : 0,
      'Ürün Başına Ciro (₺)': c.totalUnits > 0 ? Math.round(c.totalRevenue / c.totalUnits) : 0,
      'En Çok Satan Ürün': c.topProducts?.[0]?.item_name || '',
    }));
    const wsKampanya = XLSX.utils.json_to_sheet(kampanyalar);
    setColumnWidths(wsKampanya, [38, 10, 14, 10, 18, 16, 14, 8, 14, 12, 24, 20, 38]);
    XLSX.utils.book_append_sheet(wb, wsKampanya, 'Kampanyalar');

    // ============================================================
    // SAYFA 3: Kampanya × Ürün (Top satanlar)
    // ============================================================
    const kampanyaUrun = [];
    (campaignBreakdown.campaigns || []).forEach(c => {
      (c.topProducts || []).forEach(p => {
        kampanyaUrun.push({
          'Kampanya': c.campaign_name,
          'Platform': (c.platform || '').toUpperCase(),
          'Sıra': p.rank,
          'Ürün SKU': p.sku,
          'Ürün Adı': p.item_name,
          'Marka': p.item_brand,
          'Kategori': p.item_category,
          'Satılan Adet': fmtNum(p.units_sold),
          'Ciro (₺)': fmtRound(p.revenue),
        });
      });
    });
    const wsKU = XLSX.utils.json_to_sheet(kampanyaUrun);
    setColumnWidths(wsKU, [38, 10, 6, 18, 42, 14, 14, 12, 14]);
    XLSX.utils.book_append_sheet(wb, wsKU, 'Kampanya × Ürün');

    // ============================================================
    // SAYFA 4: Ürün Performansı
    // ============================================================
    const urunler = (productCampaign.products || []).map(p => ({
      'Ürün SKU': p.sku,
      'Ürün Adı': p.item_name,
      'Marka': p.item_brand,
      'Kategori': p.item_category,
      'Toplam Ciro (₺)': fmtRound(p.totalRevenue),
      'Satılan Adet': fmtNum(p.totalUnits),
      'Sipariş Sayısı': fmtNum(p.orderCount),
      'Ürün Başına Ciro (₺)': p.totalUnits > 0 ? Math.round(p.totalRevenue / p.totalUnits) : 0,
      'En Kazandıran Kampanya': p.campaigns?.[0]?.campaign_name || '',
      'En Kazandıran Kampanya Cirosu (₺)': fmtRound(p.campaigns?.[0]?.revenue || 0),
    }));
    const wsUrun = XLSX.utils.json_to_sheet(urunler);
    setColumnWidths(wsUrun, [18, 42, 14, 14, 18, 12, 14, 22, 38, 32]);
    XLSX.utils.book_append_sheet(wb, wsUrun, 'Ürünler');

    // ============================================================
    // SAYFA 5: Ürün × Kampanya (kazandıranlar)
    // ============================================================
    const urunKampanya = [];
    (productCampaign.products || []).forEach(p => {
      (p.campaigns || []).forEach(c => {
        urunKampanya.push({
          'Ürün SKU': p.sku,
          'Ürün Adı': p.item_name,
          'Marka': p.item_brand,
          'Sıra': c.rank,
          'Kampanya': c.campaign_name,
          'Platform': (c.platform || '').toUpperCase(),
          'Ciro (₺)': fmtRound(c.revenue),
          'Adet': fmtNum(c.units),
          'Sipariş': fmtNum(c.orders),
        });
      });
    });
    const wsUK = XLSX.utils.json_to_sheet(urunKampanya);
    setColumnWidths(wsUK, [18, 42, 14, 6, 38, 10, 14, 10, 10]);
    XLSX.utils.book_append_sheet(wb, wsUK, 'Ürün × Kampanya');

    // ============================================================
    // SAYFA 6: Ürün × Platform Matrisi
    // ============================================================
    const urunPlatform = (productPlatform.products || []).map(p => ({
      'Ürün SKU': p.sku,
      'Ürün Adı': p.item_name,
      'Toplam Ciro (₺)': fmtRound(p.totalRevenue),
      'Toplam Adet': fmtNum(p.totalUnits),
      'Meta Ciro (₺)': fmtRound(p.platforms?.Meta?.revenue || 0),
      'Meta Adet': fmtNum(p.platforms?.Meta?.units || 0),
      'Google Ciro (₺)': fmtRound(p.platforms?.Google?.revenue || 0),
      'Google Adet': fmtNum(p.platforms?.Google?.units || 0),
      'Organic Ciro (₺)': fmtRound(p.platforms?.Organic?.revenue || 0),
      'Organic Adet': fmtNum(p.platforms?.Organic?.units || 0),
      'Direct Ciro (₺)': fmtRound(p.platforms?.Direct?.revenue || 0),
      'Direct Adet': fmtNum(p.platforms?.Direct?.units || 0),
    }));
    const wsUP = XLSX.utils.json_to_sheet(urunPlatform);
    setColumnWidths(wsUP, [18, 42, 16, 12, 14, 10, 16, 12, 16, 12, 14, 12]);
    XLSX.utils.book_append_sheet(wb, wsUP, 'Ürün × Platform');

    // ============================================================
    // SAYFA 7: Günlük Trend (Platform bazlı ciro)
    // ============================================================
    const dailyTrend = (platformOverview.dailyTrend || []).map(d => ({
      'Tarih': d.day,
      'Meta Ciro (₺)': fmtRound(d.Meta || 0),
      'Google Ciro (₺)': fmtRound(d.Google || 0),
      'Organic Ciro (₺)': fmtRound(d.Organic || 0),
      'Direct Ciro (₺)': fmtRound(d.Direct || 0),
      'Toplam (₺)': fmtRound((d.Meta || 0) + (d.Google || 0) + (d.Organic || 0) + (d.Direct || 0)),
    }));
    const wsTrend = XLSX.utils.json_to_sheet(dailyTrend);
    setColumnWidths(wsTrend, [12, 16, 18, 18, 16, 14]);
    XLSX.utils.book_append_sheet(wb, wsTrend, 'Günlük Trend');

    // ============================================================
    // SAYFA 8: Rapor Bilgisi
    // ============================================================
    const meta = [
      { 'Alan': 'Rapor Tarihi', 'Değer': new Date().toLocaleString('tr-TR') },
      { 'Alan': 'Tarih Aralığı (Başlangıç)', 'Değer': filters.startDate || '(tümü)' },
      { 'Alan': 'Tarih Aralığı (Bitiş)', 'Değer': filters.endDate || '(tümü)' },
      { 'Alan': 'Platform Filtresi', 'Değer': filters.platform === 'all' || !filters.platform ? '(tümü)' : filters.platform.toUpperCase() },
      { 'Alan': 'Kanal Filtresi', 'Değer': filters.channel || '(tümü)' },
      { 'Alan': 'Cihaz Filtresi', 'Değer': filters.device || '(tümü)' },
      { 'Alan': 'Marka Filtresi', 'Değer': filters.brand || '(tümü)' },
      { 'Alan': 'Kategori Filtresi', 'Değer': filters.category || '(tümü)' },
      { 'Alan': 'Toplam Kampanya Sayısı', 'Değer': (campaignBreakdown.campaigns || []).length },
      { 'Alan': 'Toplam Ürün Sayısı', 'Değer': (productCampaign.products || []).length },
    ];
    const wsMeta = XLSX.utils.json_to_sheet(meta);
    setColumnWidths(wsMeta, [30, 36]);
    XLSX.utils.book_append_sheet(wb, wsMeta, 'Rapor Bilgisi');

    // Buffer üret
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const dateSuffix = (filters.startDate || '') + (filters.endDate ? '_' + filters.endDate : '');
    const filename = `kpi_raporu${dateSuffix ? '_' + dateSuffix : ''}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('reports/excel error:', error);
    res.status(500).json({ error: error.message });
  }
});

function setColumnWidths(sheet, widths) {
  sheet['!cols'] = widths.map(w => ({ wch: w }));
}

function sendXlsx(res, wb, filename) {
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

// ============================================================
// /api/reports/excel/campaigns
// Kampanya tablosu + her kampanyanın top 5 ürünü + bottom 5 ürünü (0 hariç)
// ============================================================
router.get('/excel/campaigns', authenticate, async (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate, endDate: req.query.endDate,
      channel: req.query.channel, campaign: req.query.campaign,
      device: req.query.device, city: req.query.city,
      brand: req.query.brand, category: req.query.category,
      platform: req.query.platform,
    };
    const kpi = new KpiService();
    const [topCb, bottomCb] = await Promise.all([
      kpi.getCampaignProductBreakdown({ ...filters, topCampaigns: 100, limitPerCampaign: 5, direction: 'top' }),
      kpi.getCampaignProductBreakdown({ ...filters, topCampaigns: 100, limitPerCampaign: 5, direction: 'bottom' }),
    ]);

    const wb = XLSX.utils.book_new();

    // Sheet 1: Kampanya Performansı (genel tablo)
    const kampanyalar = (topCb.campaigns || []).map(c => ({
      'Kampanya Adı': c.campaign_name,
      'Platform': (c.platform || '').toUpperCase(),
      'Hedef': c.objective || '',
      'Durum': c.status || '',
      'Reklam Harcama (₺)': fmtRound(c.spend),
      'Ciro (₺)': fmtRound(c.totalRevenue),
      'Net Kâr (₺)': fmtRound((c.totalRevenue || 0) - (c.spend || 0)),
      'ROAS': c.roas != null ? Number(c.roas.toFixed(2)) : '',
      'Sipariş Sayısı': fmtNum(c.orderCount),
      'Satılan Adet': fmtNum(c.totalUnits),
      'Ortalama Sipariş Değeri (₺)': c.orderCount > 0 ? Math.round(c.totalRevenue / c.orderCount) : 0,
      'Ürün Başına Ciro (₺)': c.totalUnits > 0 ? Math.round(c.totalRevenue / c.totalUnits) : 0,
      'En Çok Satan Ürün': c.topProducts?.[0]?.item_name || '',
    }));
    const ws1 = XLSX.utils.json_to_sheet(kampanyalar);
    setColumnWidths(ws1, [38, 10, 14, 10, 18, 16, 14, 8, 14, 12, 24, 20, 38]);
    XLSX.utils.book_append_sheet(wb, ws1, 'Kampanya Performansı');

    // Sheet 2: En Çok Satan 5 Ürün (her kampanya için)
    const topRows = [];
    (topCb.campaigns || []).forEach(c => {
      (c.topProducts || []).forEach(p => {
        topRows.push({
          'Kampanya': c.campaign_name,
          'Platform': (c.platform || '').toUpperCase(),
          'Sıra': p.rank,
          'Ürün SKU': p.sku,
          'Ürün Adı': p.item_name,
          'Marka': p.item_brand,
          'Kategori': p.item_category,
          'Satılan Adet': fmtNum(p.units_sold),
          'Ciro (₺)': fmtRound(p.revenue),
        });
      });
    });
    const ws2 = XLSX.utils.json_to_sheet(topRows);
    setColumnWidths(ws2, [38, 10, 6, 18, 42, 14, 14, 12, 14]);
    XLSX.utils.book_append_sheet(wb, ws2, 'En Çok Satan 5 Ürün');

    // Sheet 3: En Az Satan 5 Ürün (0 hariç)
    const bottomRows = [];
    (bottomCb.campaigns || []).forEach(c => {
      (c.topProducts || []).forEach(p => {
        bottomRows.push({
          'Kampanya': c.campaign_name,
          'Platform': (c.platform || '').toUpperCase(),
          'Sıra': p.rank,
          'Ürün SKU': p.sku,
          'Ürün Adı': p.item_name,
          'Marka': p.item_brand,
          'Kategori': p.item_category,
          'Satılan Adet': fmtNum(p.units_sold),
          'Ciro (₺)': fmtRound(p.revenue),
        });
      });
    });
    const ws3 = XLSX.utils.json_to_sheet(bottomRows);
    setColumnWidths(ws3, [38, 10, 6, 18, 42, 14, 14, 12, 14]);
    XLSX.utils.book_append_sheet(wb, ws3, 'En Az Satan 5 Ürün');

    // Sheet 4: Filtre Bilgisi
    const meta = [
      { 'Alan': 'Rapor Tarihi', 'Değer': new Date().toLocaleString('tr-TR') },
      { 'Alan': 'Tarih Aralığı (Başlangıç)', 'Değer': filters.startDate || '(tümü)' },
      { 'Alan': 'Tarih Aralığı (Bitiş)', 'Değer': filters.endDate || '(tümü)' },
      { 'Alan': 'Platform Filtresi', 'Değer': filters.platform === 'all' || !filters.platform ? '(tümü)' : filters.platform.toUpperCase() },
      { 'Alan': 'Toplam Kampanya', 'Değer': (topCb.campaigns || []).length },
    ];
    const ws4 = XLSX.utils.json_to_sheet(meta);
    setColumnWidths(ws4, [30, 36]);
    XLSX.utils.book_append_sheet(wb, ws4, 'Rapor Bilgisi');

    const dateSuffix = (filters.startDate || '') + (filters.endDate ? '_' + filters.endDate : '');
    sendXlsx(res, wb, `kampanya_raporu${dateSuffix ? '_' + dateSuffix : ''}.xlsx`);
  } catch (error) {
    console.error('reports/excel/campaigns error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// /api/reports/excel/campaign-comparison
// Query: campA, campB, metrics (CSV: revenue,spend,roas,orders,units,aov,revenuePerUnit,profit,topProduct)
// ============================================================
router.get('/excel/campaign-comparison', authenticate, async (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate, endDate: req.query.endDate,
      channel: req.query.channel, device: req.query.device,
      city: req.query.city, brand: req.query.brand,
      category: req.query.category, platform: req.query.platform,
    };
    const campA = req.query.campA;
    const campB = req.query.campB;
    if (!campA || !campB) {
      return res.status(400).json({ error: 'campA ve campB query parametreleri zorunlu' });
    }
    const metricsParam = (req.query.metrics || 'revenue,spend,roas,orders,units,aov,revenuePerUnit,profit,topProduct')
      .split(',').map(s => s.trim()).filter(Boolean);

    const kpi = new KpiService();
    const cb = await kpi.getCampaignProductBreakdown({ ...filters, topCampaigns: 100, limitPerCampaign: 5 });
    const a = (cb.campaigns || []).find(c => c.campaign_name === campA);
    const b = (cb.campaigns || []).find(c => c.campaign_name === campB);

    if (!a || !b) {
      return res.status(404).json({ error: 'Belirtilen kampanyalardan biri seçili tarih aralığında bulunamadı' });
    }

    const computeMetrics = (c) => ({
      revenue:        c.totalRevenue || 0,
      spend:          c.spend || 0,
      roas:           c.roas,
      orders:         c.orderCount || 0,
      units:          c.totalUnits || 0,
      aov:            c.orderCount > 0 ? (c.totalRevenue || 0) / c.orderCount : 0,
      revenuePerUnit: c.totalUnits > 0 ? (c.totalRevenue || 0) / c.totalUnits : 0,
      profit:         (c.totalRevenue || 0) - (c.spend || 0),
      topProduct:     c.topProducts?.[0]?.item_name || '',
    });
    const ma = computeMetrics(a);
    const mb = computeMetrics(b);

    const labels = {
      revenue: 'Ciro (₺)', spend: 'Reklam Harcama (₺)', roas: 'ROAS',
      orders: 'Sipariş Sayısı', units: 'Satılan Adet', aov: 'Ortalama Sipariş Değeri (₺)',
      revenuePerUnit: 'Ürün Başına Ciro (₺)', profit: 'Net Kâr (Ciro−Spend) (₺)',
      topProduct: 'En Çok Satan Ürün',
    };

    const fmt = (k, v) => {
      if (v == null || v === '') return '';
      if (k === 'topProduct') return v;
      if (k === 'roas') return Number(v.toFixed(2));
      if (k === 'orders' || k === 'units') return fmtNum(v);
      return fmtRound(v);
    };

    const diff = (k) => {
      if (k === 'topProduct') return '';
      if (ma[k] == null || mb[k] == null) return '';
      if (mb[k] === 0) return ma[k] === 0 ? '0.0%' : '';
      const d = ((ma[k] - mb[k]) / Math.abs(mb[k])) * 100;
      return `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`;
    };

    const wb = XLSX.utils.book_new();

    const compareRows = metricsParam
      .filter(m => labels[m])
      .map(m => ({
        'Metrik': labels[m],
        [campA]: fmt(m, ma[m]),
        [campB]: fmt(m, mb[m]),
        'Fark (A vs B)': diff(m),
      }));
    const wsCompare = XLSX.utils.json_to_sheet(compareRows);
    setColumnWidths(wsCompare, [32, 38, 38, 18]);
    XLSX.utils.book_append_sheet(wb, wsCompare, 'Karşılaştırma');

    // Top 5 ürün — her iki kampanya için
    const productRows = [];
    [a, b].forEach(c => {
      (c.topProducts || []).forEach(p => {
        productRows.push({
          'Kampanya': c.campaign_name,
          'Sıra': p.rank,
          'Ürün SKU': p.sku,
          'Ürün Adı': p.item_name,
          'Marka': p.item_brand,
          'Satılan Adet': fmtNum(p.units_sold),
          'Ciro (₺)': fmtRound(p.revenue),
        });
      });
    });
    const wsProd = XLSX.utils.json_to_sheet(productRows);
    setColumnWidths(wsProd, [38, 6, 18, 42, 14, 12, 14]);
    XLSX.utils.book_append_sheet(wb, wsProd, 'Top 5 Ürün');

    // Bilgi
    const info = [
      { 'Alan': 'Rapor Tarihi', 'Değer': new Date().toLocaleString('tr-TR') },
      { 'Alan': 'Tarih Aralığı (Başlangıç)', 'Değer': filters.startDate || '(tümü)' },
      { 'Alan': 'Tarih Aralığı (Bitiş)', 'Değer': filters.endDate || '(tümü)' },
      { 'Alan': 'Kampanya A', 'Değer': campA },
      { 'Alan': 'Kampanya B', 'Değer': campB },
      { 'Alan': 'Karşılaştırılan Metrikler', 'Değer': metricsParam.map(m => labels[m]).filter(Boolean).join(', ') },
    ];
    const wsInfo = XLSX.utils.json_to_sheet(info);
    setColumnWidths(wsInfo, [30, 60]);
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Rapor Bilgisi');

    const safe = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    sendXlsx(res, wb, `karsilastirma_${safe(campA)}_vs_${safe(campB)}.xlsx`);
  } catch (error) {
    console.error('reports/excel/campaign-comparison error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// /api/reports/excel/platform-detail
// Platform odaklı drill-down: bir platforma ait kampanyalar + her kampanyanın ürünleri
// Query: platform (Meta/Google/Organic/Direct), startDate, endDate, channel, device
// Eğer campaign param verilirse o kampanyanın ürünleri tek sayfada gelir.
// ============================================================
router.get('/excel/platform-detail', authenticate, async (req, res) => {
  try {
    const platform = (req.query.platform || 'all').toLowerCase();
    const filters = {
      startDate: req.query.startDate, endDate: req.query.endDate,
      channel: req.query.channel, campaign: req.query.campaign,
      device: req.query.device, city: req.query.city,
      brand: req.query.brand, category: req.query.category,
      platform: platform === 'all' ? undefined : platform, // backend filter param: meta/google
    };

    const kpi = new KpiService();

    // Eğer kampanya verilmişse: o kampanya için tüm ürünler
    // Aksi halde: platform bazlı kampanyalar + her birinin top 10 ürünü
    const cb = await kpi.getCampaignProductBreakdown({
      ...filters,
      topCampaigns: 200,
      limitPerCampaign: req.query.campaign ? 1000 : 10,
    });

    const wb = XLSX.utils.book_new();

    // Sheet 1: Kampanya Listesi
    const kampanyalar = (cb.campaigns || []).map(c => ({
      'Kampanya Adı': c.campaign_name,
      'Platform': (c.platform || '').toUpperCase(),
      'Hedef': c.objective || '',
      'Reklam Harcama (₺)': fmtRound(c.spend),
      'Ciro (₺)': fmtRound(c.totalRevenue),
      'Net Kâr (₺)': fmtRound((c.totalRevenue || 0) - (c.spend || 0)),
      'ROAS': c.roas != null ? Number(c.roas.toFixed(2)) : '',
      'Sipariş': fmtNum(c.orderCount),
      'Adet': fmtNum(c.totalUnits),
      'Ürün Başına Ciro (₺)': c.totalUnits > 0 ? Math.round(c.totalRevenue / c.totalUnits) : 0,
    }));
    const ws1 = XLSX.utils.json_to_sheet(kampanyalar);
    setColumnWidths(ws1, [38, 10, 14, 18, 16, 14, 8, 12, 12, 22]);
    const platformLabel = platform === 'all' ? 'Tüm Platformlar' :
                          platform === 'meta' ? 'Meta' :
                          platform === 'google' ? 'Google' : platform;
    XLSX.utils.book_append_sheet(wb, ws1, `${platformLabel} Kampanyalar`);

    // Sheet 2: Kampanya × Ürün
    const urunler = [];
    (cb.campaigns || []).forEach(c => {
      (c.topProducts || []).forEach(p => {
        urunler.push({
          'Kampanya': c.campaign_name,
          'Sıra': p.rank,
          'Ürün SKU': p.sku,
          'Ürün Adı': p.item_name,
          'Marka': p.item_brand,
          'Kategori': p.item_category,
          'Adet': fmtNum(p.units_sold),
          'Ciro (₺)': fmtRound(p.revenue),
        });
      });
    });
    const ws2 = XLSX.utils.json_to_sheet(urunler);
    setColumnWidths(ws2, [38, 6, 18, 42, 14, 14, 10, 14]);
    XLSX.utils.book_append_sheet(wb, ws2, 'Ürünler');

    // Sheet 3: Filtre Bilgisi
    const meta = [
      { 'Alan': 'Rapor Tarihi', 'Değer': new Date().toLocaleString('tr-TR') },
      { 'Alan': 'Platform', 'Değer': platformLabel },
      { 'Alan': 'Tarih Aralığı', 'Değer': `${filters.startDate || '(tümü)'} - ${filters.endDate || '(tümü)'}` },
      { 'Alan': 'Kanal', 'Değer': filters.channel || '(tümü)' },
      { 'Alan': 'Cihaz', 'Değer': filters.device || '(tümü)' },
      { 'Alan': 'Kampanya filtresi', 'Değer': filters.campaign || '(tümü)' },
      { 'Alan': 'Toplam Kampanya', 'Değer': (cb.campaigns || []).length },
      { 'Alan': 'Toplam Ürün Satırı', 'Değer': urunler.length },
    ];
    const ws3 = XLSX.utils.json_to_sheet(meta);
    setColumnWidths(ws3, [30, 50]);
    XLSX.utils.book_append_sheet(wb, ws3, 'Rapor Bilgisi');

    const dateSuffix = (filters.startDate || '') + (filters.endDate ? '_' + filters.endDate : '');
    const safe = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const filename = `${safe(platformLabel)}_detay${dateSuffix ? '_' + dateSuffix : ''}.xlsx`;
    sendXlsx(res, wb, filename);
  } catch (error) {
    console.error('reports/excel/platform-detail error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// /api/reports/excel/products  — DB'deki TÜM ürünler + satış özeti
// ============================================================
router.get('/excel/products', authenticate, async (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate, endDate: req.query.endDate,
      channel: req.query.channel, device: req.query.device,
      brand: req.query.brand, category: req.query.category,
      platform: req.query.platform === 'all' ? undefined : req.query.platform,
    };
    const kpi = new KpiService();
    const data = await kpi.getAllProducts(filters);

    const wb = XLSX.utils.book_new();
    const rows = (data.products || []).map(p => ({
      'SKU': p.sku,
      'Ürün Adı': p.item_name,
      'Marka': p.item_brand,
      'Kategori': p.item_category,
      'Alt Kategori': p.sub_category || '',
      'Cinsiyet': p.gender || '',
      'Fiyat (₺)': fmtRound(p.price),
      'Maliyet (₺)': fmtRound(p.cost_price),
      'Marj (%)': p.marginPercent,
      'Stok Adedi': fmtNum(p.stock_quantity),
      'Toplam Satış Adedi': fmtNum(p.totalUnits),
      'Toplam Ciro (₺)': fmtRound(p.totalRevenue),
      'Sipariş Sayısı': fmtNum(p.orderCount),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    setColumnWidths(ws, [18, 42, 14, 14, 16, 10, 12, 12, 8, 10, 16, 16, 12]);
    XLSX.utils.book_append_sheet(wb, ws, 'Ürünler');

    const dateSuffix = (filters.startDate || '') + (filters.endDate ? '_' + filters.endDate : '');
    sendXlsx(res, wb, `tum_urunler${dateSuffix ? '_' + dateSuffix : ''}.xlsx`);
  } catch (error) {
    console.error('reports/excel/products error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
