const express = require('express');
const { authenticate } = require('../middleware/auth');
const cacheMiddleware = require('../middleware/caching');
const KpiService = require('../services/kpiService');
const router = express.Router();

// Apply caching to all KPI GET endpoints
router.use(authenticate, cacheMiddleware('kpi'));

/**
 * @swagger
 * /api/kpi/summary:
 *   get:
 *     summary: Get KPI summary cards
 *     tags: [KPI]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string }
 *       - in: query
 *         name: endDate
 *         schema: { type: string }
 *       - in: query
 *         name: channel
 *         schema: { type: string }
 */
router.get('/summary', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      channel: req.query.channel,
      campaign: req.query.campaign,
      device: req.query.device,
      city: req.query.city
    };

    const summary = await kpiService.getKpiSummary(filters);
    res.json(summary);
  } catch (error) {
    console.error('KPI summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/kpi/traffic:
 *   get:
 *     summary: Get traffic KPIs
 *     tags: [KPI]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/traffic', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getTrafficKpis(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/kpi/ads:
 *   get:
 *     summary: Get advertising KPIs (Meta + Google combined)
 *     tags: [KPI]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/ads', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getAdsKpis(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/kpi/sales:
 *   get:
 *     summary: Get sales KPIs
 *     tags: [KPI]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/sales', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getSalesKpis(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/kpi/marketing:
 *   get:
 *     summary: Get marketing performance KPIs
 *     tags: [KPI]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/marketing', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getMarketingKpis(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/kpi/funnel:
 *   get:
 *     summary: Get product funnel data (view → cart → checkout → purchase)
 *     tags: [KPI]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/funnel', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getProductFunnel(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/kpi/cohort:
 *   get:
 *     summary: Get customer cohort analysis
 *     tags: [KPI]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/cohort', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getCohortAnalysis(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/kpi/heatmap:
 *   get:
 *     summary: Get heatmap data (day × hour activity)
 *     tags: [KPI]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/heatmap', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getHeatmapData(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/kpi/channel-comparison:
 *   get:
 *     summary: Get channel performance comparison
 *     tags: [KPI]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/channel-comparison', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getChannelComparison(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/kpi/campaign-performance:
 *   get:
 *     summary: Get campaign performance details
 *     tags: [KPI]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/campaign-performance', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getCampaignPerformance(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/kpi/product-performance:
 *   get:
 *     summary: Get product performance analysis
 *     tags: [KPI]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/product-performance', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getProductPerformance(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/enhanced-summary', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getEnhancedSummary(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/profitability', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getProfitability(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/customers', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getCustomerAnalysis(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/executive-summary', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getExecutiveSummary(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/meta-breakdowns', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getMetaBreakdowns(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/budget-tracking', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getBudgetTracking(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stock-analysis', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getStockAnalysis(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/kpi/metric-detail/{type}:
 *   get:
 *     summary: Get deep-dive analytics for a specific KPI metric
 *     tags: [KPI]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema: { type: string, enum: [sessions, users, orders, revenue, adspend, roas, conversion, aov] }
 */
router.get('/metric-detail/:type', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getMetricDetail(req.params.type, req.query);
    res.json(data);
  } catch (error) {
    console.error(`Metric detail error (${req.params.type}):`, error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// YÖNETİCİ ODAKLI ENDPOINT'LER
// ============================================================

router.get('/campaign-product-breakdown', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getCampaignProductBreakdown(req.query);
    res.json(data);
  } catch (error) {
    console.error('campaign-product-breakdown error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/product-campaign-breakdown', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getProductCampaignBreakdown(req.query);
    res.json(data);
  } catch (error) {
    console.error('product-campaign-breakdown error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/product-platform-breakdown', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getProductPlatformBreakdown(req.query);
    res.json(data);
  } catch (error) {
    console.error('product-platform-breakdown error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/platform-overview', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getPlatformOverview(req.query);
    res.json(data);
  } catch (error) {
    console.error('platform-overview error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/all-products', authenticate, async (req, res) => {
  try {
    const kpiService = new KpiService();
    const data = await kpiService.getAllProducts(req.query);
    res.json(data);
  } catch (error) {
    console.error('all-products error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


