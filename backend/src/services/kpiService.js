const db = require('../config/database');
const redis = require('../config/redis');

class KpiService {
  constructor() {
    this.cachePrefix = 'kpi:';
    this.cacheTTL = 300; // 5 minutes
  }

  /**
   * Helper: Build date filter conditions
   */
  buildDateFilter(filters, dateColumn = 'date', prefix = '') {
    const conditions = [];
    const params = [];

    if (filters.startDate) {
      conditions.push(`${prefix}${dateColumn} >= ?`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`${prefix}${dateColumn} <= ?`);
      params.push(filters.endDate);
    }
    if (filters.channel) {
      conditions.push(`${prefix}sessionDefaultChannelGroup = ?`);
      params.push(filters.channel);
    }
    if (filters.campaign) {
      conditions.push(`${prefix}sessionCampaignName = ?`);
      params.push(filters.campaign);
    }
    if (filters.device) {
      conditions.push(`${prefix}deviceCategory = ?`);
      params.push(filters.device);
    }
    if (filters.city) {
      conditions.push(`${prefix}city = ?`);
      params.push(filters.city);
    }

    return { conditions, params };
  }

  /**
   * Try to get from Redis cache
   */
  async getFromCache(key) {
    try {
      const cached = await redis.get(this.cachePrefix + key);
      if (cached) return JSON.parse(cached);
    } catch (e) { /* ignore cache errors */ }
    return null;
  }

  /**
   * Set Redis cache
   */
  async setCache(key, data) {
    try {
      await redis.setex(this.cachePrefix + key, this.cacheTTL, JSON.stringify(data));
    } catch (e) { /* ignore cache errors */ }
  }

  /**
   * Get KPI Summary Cards
   */
  async getKpiSummary(filters = {}) {
    const cacheKey = `summary:${JSON.stringify(filters)}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    const result = {};

    // Traffic KPIs
    try {
      const { conditions: tCond, params: tParams } = this.buildDateFilter(filters);
      const whereClause = tCond.length ? 'WHERE ' + tCond.join(' AND ') : '';

      const [trafficRows] = await db.query(`
        SELECT
          COALESCE(SUM(sessions), 0) as totalSessions,
          COALESCE(SUM(totalUsers), 0) as totalUsers,
          COALESCE(SUM(newUsers), 0) as totalNewUsers,
          COALESCE(AVG(bounceRate), 0) as avgBounceRate,
          COALESCE(AVG(averageSessionDuration), 0) as avgSessionDuration,
          COALESCE(AVG(screenPageViewsPerSession), 0) as avgPagesPerSession,
          COALESCE(AVG(engagementRate), 0) as avgEngagementRate,
          COALESCE(SUM(conversions), 0) as totalConversions,
          COALESCE(SUM(purchaseRevenue), 0) as totalRevenue,
          COALESCE(SUM(transactions), 0) as totalTransactions
        FROM ga4_traffic ${whereClause}
      `, tParams);

      result.traffic = trafficRows[0];
    } catch (e) {
      result.traffic = {};
    }

    // Sales KPIs
    try {
      const salesDateCol = 'DATE_FORMAT(order_date, "%Y%m%d")';
      const salesConditions = [];
      const salesParams = [];
      if (filters.startDate) { salesConditions.push(`${salesDateCol} >= ?`); salesParams.push(filters.startDate); }
      if (filters.endDate) { salesConditions.push(`${salesDateCol} <= ?`); salesParams.push(filters.endDate); }
      if (filters.channel) { salesConditions.push(`channel = ?`); salesParams.push(filters.channel); }
      if (filters.device) { salesConditions.push(`device = ?`); salesParams.push(filters.device); }
      if (filters.city) { salesConditions.push(`city = ?`); salesParams.push(filters.city); }
      const salesWhere = salesConditions.length ? 'WHERE ' + salesConditions.join(' AND ') : '';

      const [salesRows] = await db.query(`
        SELECT
          COUNT(*) as totalOrders,
          COALESCE(SUM(order_revenue), 0) as totalRevenue,
          COALESCE(AVG(order_revenue), 0) as avgOrderValue,
          COALESCE(SUM(net_revenue), 0) as totalNetRevenue,
          COALESCE(SUM(discount_amount), 0) as totalDiscounts,
          COALESCE(SUM(refund_amount), 0) as totalRefunds,
          COALESCE(AVG(product_count), 0) as avgItemsPerOrder
        FROM orders ${salesWhere}
      `, salesParams);

      result.sales = salesRows[0];
    } catch (e) {
      result.sales = {};
    }

    // Ads KPIs - Meta
    try {
      const metaConditions = [];
      const metaParams = [];
      if (filters.startDate) { metaConditions.push(`date_start >= ?`); metaParams.push(this.formatDateForSQL(filters.startDate)); }
      if (filters.endDate) { metaConditions.push(`date_start <= ?`); metaParams.push(this.formatDateForSQL(filters.endDate)); }
      const metaWhere = metaConditions.length ? 'WHERE ' + metaConditions.join(' AND ') : '';

      const [metaRows] = await db.query(`
        SELECT
          COALESCE(SUM(impressions), 0) as impressions,
          COALESCE(SUM(clicks), 0) as clicks,
          COALESCE(SUM(spend), 0) as spend,
          COALESCE(SUM(actions_purchase), 0) as conversions,
          COALESCE(SUM(action_values_purchase), 0) as conversionValue,
          CASE WHEN SUM(spend) > 0 THEN SUM(action_values_purchase) / SUM(spend) ELSE 0 END as roas
        FROM meta_ads ${metaWhere}
      `, metaParams);

      result.metaAds = metaRows[0];
    } catch (e) {
      result.metaAds = {};
    }

    // Ads KPIs - Google
    try {
      const gadsConditions = [];
      const gadsParams = [];
      if (filters.startDate) { gadsConditions.push(`date >= ?`); gadsParams.push(this.formatDateForSQL(filters.startDate)); }
      if (filters.endDate) { gadsConditions.push(`date <= ?`); gadsParams.push(this.formatDateForSQL(filters.endDate)); }
      const gadsWhere = gadsConditions.length ? 'WHERE ' + gadsConditions.join(' AND ') : '';

      const [gadsRows] = await db.query(`
        SELECT
          COALESCE(SUM(impressions), 0) as impressions,
          COALESCE(SUM(clicks), 0) as clicks,
          COALESCE(SUM(cost_micros), 0) / 1000000 as spend,
          COALESCE(SUM(conversions), 0) as conversions,
          COALESCE(SUM(conversions_value), 0) as conversionValue,
          CASE WHEN SUM(cost_micros) > 0 THEN SUM(conversions_value) / (SUM(cost_micros) / 1000000) ELSE 0 END as roas
        FROM google_ads ${gadsWhere}
      `, gadsParams);

      result.googleAds = gadsRows[0];
    } catch (e) {
      result.googleAds = {};
    }

    // Combined Ads
    const metaSpend = Number(result.metaAds?.spend || 0);
    const googleSpend = Number(result.googleAds?.spend || 0);
    const metaConvValue = Number(result.metaAds?.conversionValue || 0);
    const googleConvValue = Number(result.googleAds?.conversionValue || 0);
    
    result.combinedAds = {
      totalSpend: metaSpend + googleSpend,
      totalImpressions: Number(result.metaAds?.impressions || 0) + Number(result.googleAds?.impressions || 0),
      totalClicks: Number(result.metaAds?.clicks || 0) + Number(result.googleAds?.clicks || 0),
      totalConversions: Number(result.metaAds?.conversions || 0) + Number(result.googleAds?.conversions || 0),
      totalConversionValue: metaConvValue + googleConvValue,
      overallRoas: (metaSpend + googleSpend) > 0
        ? (metaConvValue + googleConvValue) / (metaSpend + googleSpend)
        : 0
    };

    await this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Format date from YYYYMMDD to YYYY-MM-DD
   */
  formatDateForSQL(dateStr) {
    if (!dateStr) return null;
    if (dateStr.includes('-')) return dateStr;
    if (dateStr.length === 8) {
      return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }
    return dateStr;
  }

  /**
   * Traffic KPIs - Time Series
   */
  async getTrafficKpis(filters = {}) {
    const { conditions, params } = this.buildDateFilter(filters);
    const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    // Daily trend
    const [dailyTrend] = await db.query(`
      SELECT
        date,
        SUM(sessions) as sessions,
        SUM(totalUsers) as users,
        SUM(newUsers) as newUsers,
        AVG(bounceRate) as bounceRate,
        AVG(averageSessionDuration) as avgDuration,
        AVG(engagementRate) as engagementRate,
        SUM(conversions) as conversions,
        SUM(purchaseRevenue) as revenue,
        SUM(transactions) as transactions
      FROM ga4_traffic ${whereClause}
      GROUP BY date
      ORDER BY date
    `, params);

    // Channel distribution
    const [channelDist] = await db.query(`
      SELECT
        sessionDefaultChannelGroup as channel,
        SUM(sessions) as sessions,
        SUM(totalUsers) as users,
        SUM(conversions) as conversions,
        SUM(purchaseRevenue) as revenue
      FROM ga4_traffic ${whereClause}
      GROUP BY sessionDefaultChannelGroup
      ORDER BY sessions DESC
    `, params);

    // Device distribution
    const [deviceDist] = await db.query(`
      SELECT
        deviceCategory as device,
        SUM(sessions) as sessions,
        SUM(totalUsers) as users,
        SUM(conversions) as conversions,
        SUM(purchaseRevenue) as revenue
      FROM ga4_traffic ${whereClause}
      GROUP BY deviceCategory
      ORDER BY sessions DESC
    `, params);

    // New vs Returning
    const [userType] = await db.query(`
      SELECT
        newVsReturning as userType,
        SUM(sessions) as sessions,
        SUM(totalUsers) as users
      FROM ga4_traffic ${whereClause}
      GROUP BY newVsReturning
    `, params);

    // Top cities
    const [topCities] = await db.query(`
      SELECT
        city,
        SUM(sessions) as sessions,
        SUM(totalUsers) as users,
        SUM(purchaseRevenue) as revenue
      FROM ga4_traffic ${whereClause}
      GROUP BY city
      ORDER BY sessions DESC
      LIMIT 20
    `, params);

    // Source/Medium distribution
    const [sourceMediumDist] = await db.query(`
      SELECT
        CONCAT(sessionSource, ' / ', sessionMedium) as sourceMedium,
        SUM(sessions) as sessions,
        SUM(totalUsers) as users,
        SUM(conversions) as conversions,
        SUM(purchaseRevenue) as revenue,
        AVG(bounceRate) as bounceRate,
        AVG(engagementRate) as engagementRate
      FROM ga4_traffic ${whereClause}
      GROUP BY sessionSource, sessionMedium
      ORDER BY sessions DESC
      LIMIT 30
    `, params);

    return { dailyTrend, channelDist, deviceDist, userType, topCities, sourceMediumDist };
  }

  /**
   * Ads KPIs
   */
  async getAdsKpis(filters = {}) {
    // Meta Ads daily
    const metaConditions = [];
    const metaParams = [];
    if (filters.startDate) { metaConditions.push(`date_start >= ?`); metaParams.push(this.formatDateForSQL(filters.startDate)); }
    if (filters.endDate) { metaConditions.push(`date_start <= ?`); metaParams.push(this.formatDateForSQL(filters.endDate)); }
    if (filters.campaign) { metaConditions.push(`campaign_name = ?`); metaParams.push(filters.campaign); }
    const metaWhere = metaConditions.length ? 'WHERE ' + metaConditions.join(' AND ') : '';

    const [metaDaily] = await db.query(`
      SELECT
        date_start as date,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        SUM(spend) as spend,
        SUM(actions_purchase) as conversions,
        SUM(action_values_purchase) as conversionValue,
        CASE WHEN SUM(spend) > 0 THEN SUM(action_values_purchase)/SUM(spend) ELSE 0 END as roas,
        CASE WHEN SUM(impressions) > 0 THEN SUM(clicks)/SUM(impressions)*100 ELSE 0 END as ctr,
        CASE WHEN SUM(clicks) > 0 THEN SUM(spend)/SUM(clicks) ELSE 0 END as cpc
      FROM meta_ads ${metaWhere}
      GROUP BY date_start ORDER BY date_start
    `, metaParams);

    // Google Ads daily
    const gadsConditions = [];
    const gadsParams = [];
    if (filters.startDate) { gadsConditions.push(`date >= ?`); gadsParams.push(this.formatDateForSQL(filters.startDate)); }
    if (filters.endDate) { gadsConditions.push(`date <= ?`); gadsParams.push(this.formatDateForSQL(filters.endDate)); }
    if (filters.campaign) { gadsConditions.push(`campaign_name = ?`); gadsParams.push(filters.campaign); }
    const gadsWhere = gadsConditions.length ? 'WHERE ' + gadsConditions.join(' AND ') : '';

    const [googleDaily] = await db.query(`
      SELECT
        date,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        SUM(cost_micros)/1000000 as spend,
        SUM(conversions) as conversions,
        SUM(conversions_value) as conversionValue,
        CASE WHEN SUM(cost_micros) > 0 THEN SUM(conversions_value)/(SUM(cost_micros)/1000000) ELSE 0 END as roas,
        CASE WHEN SUM(impressions) > 0 THEN SUM(clicks)/SUM(impressions)*100 ELSE 0 END as ctr,
        CASE WHEN SUM(clicks) > 0 THEN (SUM(cost_micros)/1000000)/SUM(clicks) ELSE 0 END as cpc
      FROM google_ads ${gadsWhere}
      GROUP BY date ORDER BY date
    `, gadsParams);

    // Platform comparison
    const [metaTotal] = await db.query(`
      SELECT 'Meta' as platform,
        SUM(impressions) as impressions, SUM(clicks) as clicks,
        SUM(spend) as spend, SUM(actions_purchase) as conversions,
        SUM(action_values_purchase) as conversionValue
      FROM meta_ads ${metaWhere}
    `, metaParams);

    const [googleTotal] = await db.query(`
      SELECT 'Google' as platform,
        SUM(impressions) as impressions, SUM(clicks) as clicks,
        SUM(cost_micros)/1000000 as spend, SUM(conversions) as conversions,
        SUM(conversions_value) as conversionValue
      FROM google_ads ${gadsWhere}
    `, gadsParams);

    return {
      metaDaily,
      googleDaily,
      platformComparison: [metaTotal[0], googleTotal[0]]
    };
  }

  /**
   * Sales KPIs
   */
  async getSalesKpis(filters = {}) {
    const conditions = [];
    const params = [];
    if (filters.startDate) {
      conditions.push(`DATE_FORMAT(order_date, '%Y%m%d') >= ?`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`DATE_FORMAT(order_date, '%Y%m%d') <= ?`);
      params.push(filters.endDate);
    }
    if (filters.channel) { conditions.push('channel = ?'); params.push(filters.channel); }
    if (filters.device) { conditions.push('device = ?'); params.push(filters.device); }
    if (filters.city) { conditions.push('city = ?'); params.push(filters.city); }
    const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    // Daily revenue trend
    const [dailyRevenue] = await db.query(`
      SELECT
        DATE(order_date) as date,
        COUNT(*) as orders,
        SUM(order_revenue) as revenue,
        SUM(net_revenue) as netRevenue,
        AVG(order_revenue) as avgOrderValue,
        SUM(discount_amount) as discounts,
        SUM(refund_amount) as refunds
      FROM orders ${whereClause}
      GROUP BY DATE(order_date) ORDER BY date
    `, params);

    // Channel revenue
    const [channelRevenue] = await db.query(`
      SELECT
        channel,
        COUNT(*) as orders,
        SUM(order_revenue) as revenue,
        SUM(net_revenue) as netRevenue,
        AVG(order_revenue) as avgOrderValue
      FROM orders ${whereClause}
      GROUP BY channel ORDER BY revenue DESC
    `, params);

    // Payment method distribution
    const [paymentDist] = await db.query(`
      SELECT
        payment_method,
        COUNT(*) as count,
        SUM(order_revenue) as revenue
      FROM orders ${whereClause}
      GROUP BY payment_method ORDER BY count DESC
    `, params);

    // Order status distribution
    const [statusDist] = await db.query(`
      SELECT
        order_status,
        COUNT(*) as count,
        SUM(order_revenue) as revenue
      FROM orders ${whereClause}
      GROUP BY order_status
    `, params);

    // Top products
    const [topProducts] = await db.query(`
      SELECT
        oi.item_id,
        oi.item_name,
        oi.item_brand,
        oi.item_category,
        SUM(oi.quantity) as totalQuantity,
        SUM(oi.line_total) as totalRevenue,
        COUNT(DISTINCT oi.order_id) as orderCount
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.order_id
      ${whereClause.replace(/order_date/g, 'o.order_date')
               .replace(/channel/g, 'o.channel')
               .replace(/device/g, 'o.device')
               .replace(/city/g, 'o.city')}
      GROUP BY oi.item_id, oi.item_name, oi.item_brand, oi.item_category
      ORDER BY totalRevenue DESC
      LIMIT 20
    `, params);

    // Coupon Analysis
    const [couponAnalysis] = await db.query(`
      SELECT
        CASE WHEN coupon_code IS NOT NULL AND coupon_code != '' THEN 'Kuponlu' ELSE 'Kuponsuz' END as hasCoupon,
        COUNT(*) as orders,
        SUM(order_revenue) as revenue,
        SUM(discount_amount) as discount,
        SUM(net_revenue) as netRevenue,
        AVG(order_revenue) as aov
      FROM orders ${whereClause}
      GROUP BY hasCoupon
    `, params);

    // Refund Analysis (Brand level)
    const [refundAnalysis] = await db.query(`
      SELECT
        oi.item_brand as brand,
        SUM(oi.quantity) as soldQuantity,
        SUM(oi.line_total) as totalRevenue,
        SUM(oi.refund_amount) as totalRefunds,
        CASE WHEN SUM(oi.line_total) > 0 THEN SUM(oi.refund_amount) / SUM(oi.line_total) * 100 ELSE 0 END as refundRate
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.order_id
      ${whereClause.replace(/order_date/g, 'o.order_date')
               .replace(/channel/g, 'o.channel')
               .replace(/device/g, 'o.device')
               .replace(/city/g, 'o.city')}
      GROUP BY oi.item_brand
      HAVING totalRefunds > 0
      ORDER BY refundRate DESC
      LIMIT 20
    `, params);

    // Payment by Channel
    const [paymentByChannel] = await db.query(`
      SELECT
        channel,
        payment_method,
        COUNT(*) as count,
        SUM(order_revenue) as revenue
      FROM orders ${whereClause}
      GROUP BY channel, payment_method
      ORDER BY channel
    `, params);

    // Order funnel
    const [orderFunnel] = await db.query(`
      SELECT
        CASE
          WHEN order_status = 'pending' THEN '1. Bekleyen'
          WHEN order_status = 'shipped' THEN '2. Kargoda'
          WHEN order_status = 'completed' THEN '3. Tamamlanan'
          WHEN order_status = 'cancelled' THEN '4. İptal'
          WHEN order_status = 'refunded' THEN '5. İade'
          ELSE 'Diğer'
        END as stage,
        COUNT(*) as count,
        SUM(order_revenue) as revenue
      FROM orders ${whereClause}
      GROUP BY stage
      ORDER BY stage
    `, params);

    return { dailyRevenue, channelRevenue, paymentDist, statusDist, topProducts, couponAnalysis, refundAnalysis, paymentByChannel, orderFunnel };
  }

  /**
   * Marketing Performance KPIs
   */
  async getMarketingKpis(filters = {}) {
    // CAC (Customer Acquisition Cost)
    const [totalSpend] = await db.query(`
      SELECT
        (SELECT COALESCE(SUM(spend), 0) FROM meta_ads) +
        (SELECT COALESCE(SUM(cost_micros), 0) / 1000000 FROM google_ads) as totalAdSpend
    `);

    const [newCustomers] = await db.query(`
      SELECT COUNT(DISTINCT customer_id) as count
      FROM customers WHERE total_orders >= 1
    `);

    const cac = newCustomers[0].count > 0
      ? totalSpend[0].totalAdSpend / newCustomers[0].count
      : 0;

    // CLV (Customer Lifetime Value)
    const [clvData] = await db.query(`
      SELECT
        AVG(total_revenue) as avgCLV,
        AVG(total_orders) as avgOrders,
        COUNT(*) as totalCustomers
      FROM customers WHERE total_orders > 0
    `);

    // Repeat purchase rate
    const [repeatData] = await db.query(`
      SELECT
        COUNT(CASE WHEN total_orders > 1 THEN 1 END) as repeatCustomers,
        COUNT(CASE WHEN total_orders >= 1 THEN 1 END) as totalCustomers
      FROM customers
    `);

    const repeatRate = repeatData[0].totalCustomers > 0
      ? repeatData[0].repeatCustomers / repeatData[0].totalCustomers
      : 0;

    // Channel attribution
    const [channelAttribution] = await db.query(`
      SELECT
        channel,
        COUNT(*) as orders,
        SUM(order_revenue) as revenue,
        COUNT(DISTINCT customer_id) as uniqueCustomers
      FROM orders
      GROUP BY channel
      ORDER BY revenue DESC
    `);

    return {
      cac,
      clv: clvData[0]?.avgCLV || 0,
      clvCacRatio: cac > 0 ? (clvData[0]?.avgCLV || 0) / cac : 0,
      repeatPurchaseRate: repeatRate,
      totalCustomers: clvData[0]?.totalCustomers || 0,
      avgOrdersPerCustomer: clvData[0]?.avgOrders || 0,
      channelAttribution
    };
  }

  /**
   * Product Funnel (GA4 item interactions)
   */
  async getProductFunnel(filters = {}) {
    const conditions = [];
    const params = [];
    if (filters.startDate) { conditions.push('date >= ?'); params.push(filters.startDate); }
    if (filters.endDate) { conditions.push('date <= ?'); params.push(filters.endDate); }
    if (filters.brand) { conditions.push('itemBrand = ?'); params.push(filters.brand); }
    if (filters.category) { conditions.push('itemCategory = ?'); params.push(filters.category); }
    const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [funnel] = await db.query(`
      SELECT
        COALESCE(SUM(itemListViews), 0) as listViews,
        COALESCE(SUM(itemListClicks), 0) as listClicks,
        COALESCE(SUM(itemsViewed), 0) as productViews,
        COALESCE(SUM(itemsAddedToCart), 0) as addToCart,
        COALESCE(SUM(itemsCheckedOut), 0) as checkout,
        COALESCE(SUM(itemsPurchased), 0) as purchased,
        COALESCE(SUM(itemRevenue), 0) as totalRevenue
      FROM ga4_item_interactions ${whereClause}
    `, params);

    return funnel[0];
  }

  /**
   * Cohort Analysis
   */
  async getCohortAnalysis(filters = {}) {
    const [cohorts] = await db.query(`
      SELECT
        SUBSTRING(TRIM(c.first_order_date), 1, 7) as cohort_month,
        COUNT(DISTINCT c.customer_id) as cohort_size,
        AVG(c.total_orders) as avg_orders,
        AVG(c.total_revenue) as avg_revenue,
        COUNT(CASE WHEN c.total_orders > 1 THEN 1 END) as repeat_customers
      FROM customers c
      WHERE c.first_order_date IS NOT NULL AND LENGTH(TRIM(c.first_order_date)) >= 10 AND c.total_orders >= 1
      GROUP BY SUBSTRING(TRIM(c.first_order_date), 1, 7)
      ORDER BY cohort_month
    `);

    return cohorts;
  }

  /**
   * Heatmap Data (Day of week × hour)
   */
  async getHeatmapData(filters = {}) {
    const conditions = [];
    const params = [];
    if (filters.channel) { conditions.push('channel = ?'); params.push(filters.channel); }
    const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [heatmap] = await db.query(`
      SELECT
        DAYOFWEEK(order_date) as dayOfWeek,
        HOUR(order_date) as hour,
        COUNT(*) as orderCount,
        SUM(order_revenue) as revenue
      FROM orders ${whereClause}
      GROUP BY DAYOFWEEK(order_date), HOUR(order_date)
      ORDER BY dayOfWeek, hour
    `, params);

    return heatmap;
  }

  /**
   * Channel Comparison (ROAS, spend, revenue per channel)
   */
  async getChannelComparison(filters = {}) {
    // GA4 channel performance
    const [ga4Channels] = await db.query(`
      SELECT
        sessionDefaultChannelGroup as channel,
        SUM(sessions) as sessions,
        SUM(totalUsers) as users,
        SUM(conversions) as conversions,
        SUM(purchaseRevenue) as revenue
      FROM ga4_traffic
      GROUP BY sessionDefaultChannelGroup
      ORDER BY revenue DESC
    `);

    // Orders by channel
    const [orderChannels] = await db.query(`
      SELECT
        channel,
        COUNT(*) as orders,
        SUM(order_revenue) as revenue,
        SUM(net_revenue) as netRevenue,
        AVG(order_revenue) as avgOrderValue,
        COUNT(DISTINCT customer_id) as uniqueCustomers
      FROM orders
      GROUP BY channel
      ORDER BY revenue DESC
    `);

    return { ga4Channels, orderChannels };
  }

  /**
   * Campaign Performance
   */
  async getCampaignPerformance(filters = {}) {
    // Meta campaigns
    const [metaCampaigns] = await db.query(`
      SELECT
        campaign_name,
        'Meta' as platform,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        SUM(spend) as spend,
        SUM(actions_purchase) as conversions,
        SUM(action_values_purchase) as conversionValue,
        CASE WHEN SUM(spend) > 0 THEN SUM(action_values_purchase)/SUM(spend) ELSE 0 END as roas,
        CASE WHEN SUM(impressions) > 0 THEN SUM(clicks)/SUM(impressions)*100 ELSE 0 END as ctr,
        CASE WHEN SUM(clicks) > 0 THEN SUM(spend)/SUM(clicks) ELSE 0 END as cpc
      FROM meta_ads
      GROUP BY campaign_name
      ORDER BY spend DESC
    `);

    // Google campaigns
    const [googleCampaigns] = await db.query(`
      SELECT
        campaign_name,
        'Google' as platform,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        SUM(cost_micros)/1000000 as spend,
        SUM(conversions) as conversions,
        SUM(conversions_value) as conversionValue,
        CASE WHEN SUM(cost_micros) > 0 THEN SUM(conversions_value)/(SUM(cost_micros)/1000000) ELSE 0 END as roas,
        CASE WHEN SUM(impressions) > 0 THEN SUM(clicks)/SUM(impressions)*100 ELSE 0 END as ctr,
        CASE WHEN SUM(clicks) > 0 THEN (SUM(cost_micros)/1000000)/SUM(clicks) ELSE 0 END as cpc
      FROM google_ads
      GROUP BY campaign_name
      ORDER BY spend DESC
    `);

    return {
      campaigns: [...metaCampaigns, ...googleCampaigns].sort((a, b) => (b.spend || 0) - (a.spend || 0))
    };
  }

  /**
   * Product Performance
   */
  async getProductPerformance(filters = {}) {
    const [products] = await db.query(`
      SELECT
        p.sku,
        p.product_name,
        p.brand,
        p.category,
        p.sub_category,
        p.price,
        p.cost_price,
        p.stock_quantity,
        COALESCE(sales.totalQuantity, 0) as totalSold,
        COALESCE(sales.totalRevenue, 0) as totalRevenue,
        COALESCE(sales.orderCount, 0) as orderCount,
        COALESCE(ga4.totalViews, 0) as totalViews,
        COALESCE(ga4.totalAddToCart, 0) as totalAddToCart,
        COALESCE(ga4.totalPurchased, 0) as totalPurchased,
        CASE WHEN COALESCE(ga4.totalViews, 0) > 0
          THEN COALESCE(ga4.totalPurchased, 0) / COALESCE(ga4.totalViews, 0)
          ELSE 0
        END as conversionRate
      FROM products p
      LEFT JOIN (
        SELECT item_id,
          SUM(quantity) as totalQuantity,
          SUM(line_total) as totalRevenue,
          COUNT(DISTINCT order_id) as orderCount
        FROM order_items GROUP BY item_id
      ) sales ON p.sku = sales.item_id
      LEFT JOIN (
        SELECT itemId,
          SUM(itemsViewed) as totalViews,
          SUM(itemsAddedToCart) as totalAddToCart,
          SUM(itemsPurchased) as totalPurchased
        FROM ga4_item_interactions GROUP BY itemId
      ) ga4 ON p.sku = ga4.itemId
      ORDER BY totalRevenue DESC
      LIMIT 50
    `);

    return products;
  }

  /**
   * Enhanced Summary with Period Comparison
   */
  async getEnhancedSummary(filters = {}) {
    const current = await this.getKpiSummary(filters);

    // Calculate previous period
    let prevFilters = { ...filters };
    if (filters.startDate && filters.endDate) {
      const start = this.parseDate(filters.startDate);
      const end = this.parseDate(filters.endDate);
      if (start && end) {
        const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const prevEnd = new Date(start);
        prevEnd.setDate(prevEnd.getDate() - 1);
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - diffDays);
        prevFilters.startDate = this.dateToString(prevStart);
        prevFilters.endDate = this.dateToString(prevEnd);
      }
    }

    const previous = await this.getKpiSummary(prevFilters);

    // Compute conversion rate
    const currentCVR = current.traffic?.totalSessions > 0
      ? (current.sales?.totalOrders || 0) / current.traffic.totalSessions
      : 0;
    const prevCVR = previous.traffic?.totalSessions > 0
      ? (previous.sales?.totalOrders || 0) / previous.traffic.totalSessions
      : 0;

    // Compute CAC
    const currentCAC = current.sales?.totalOrders > 0
      ? (current.combinedAds?.totalSpend || 0) / current.sales.totalOrders
      : 0;
    const prevCAC = previous.sales?.totalOrders > 0
      ? (previous.combinedAds?.totalSpend || 0) / previous.sales.totalOrders
      : 0;

    // Compute Refund Rate
    const currentRefundRate = current.sales?.totalRevenue > 0
      ? (current.sales?.totalRefunds || 0) / current.sales.totalRevenue
      : 0;
    const prevRefundRate = previous.sales?.totalRevenue > 0
      ? (previous.sales?.totalRefunds || 0) / previous.sales.totalRevenue
      : 0;


    // Compute cart-to-purchase rate from ga4_item_interactions
    let cartRate = 0, prevCartRate = 0;
    try {
      const cond = [];
      const params = [];
      if (filters.startDate) { cond.push('date >= ?'); params.push(filters.startDate); }
      if (filters.endDate) { cond.push('date <= ?'); params.push(filters.endDate); }
      const w = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
      const [cartRows] = await db.query(`
        SELECT COALESCE(SUM(itemsAddedToCart),0) as cart, COALESCE(SUM(itemsPurchased),0) as purchased
        FROM ga4_item_interactions ${w}
      `, params);
      cartRate = cartRows[0].cart > 0 ? cartRows[0].purchased / cartRows[0].cart : 0;

      const pcond = [];
      const pparams = [];
      if (prevFilters.startDate) { pcond.push('date >= ?'); pparams.push(prevFilters.startDate); }
      if (prevFilters.endDate) { pcond.push('date <= ?'); pparams.push(prevFilters.endDate); }
      const pw = pcond.length ? 'WHERE ' + pcond.join(' AND ') : '';
      const [prevCartRows] = await db.query(`
        SELECT COALESCE(SUM(itemsAddedToCart),0) as cart, COALESCE(SUM(itemsPurchased),0) as purchased
        FROM ga4_item_interactions ${pw}
      `, pparams);
      prevCartRate = prevCartRows[0].cart > 0 ? prevCartRows[0].purchased / prevCartRows[0].cart : 0;
    } catch(e) {}

    // Gross profit margin
    let grossMargin = 0, prevGrossMargin = 0;
    try {
      const cond = [];
      const params = [];
      if (filters.startDate) { cond.push("DATE_FORMAT(o.order_date,'%Y%m%d') >= ?"); params.push(filters.startDate); }
      if (filters.endDate) { cond.push("DATE_FORMAT(o.order_date,'%Y%m%d') <= ?"); params.push(filters.endDate); }
      const w = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
      const [marginRows] = await db.query(`
        SELECT COALESCE(SUM(oi.line_total),0) as revenue,
               COALESCE(SUM(oi.quantity * p.cost_price),0) as cost
        FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.order_id
        LEFT JOIN products p ON oi.item_id = p.sku
        ${w}
      `, params);
      grossMargin = marginRows[0].revenue > 0
        ? (marginRows[0].revenue - marginRows[0].cost) / marginRows[0].revenue
        : 0;
    } catch(e) {}

    const calcChange = (curr, prev) => {
      if (!prev || prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / Math.abs(prev)) * 100;
    };

    return {
      current,
      previous,
      changes: {
        sessions: calcChange(current.traffic?.totalSessions, previous.traffic?.totalSessions),
        users: calcChange(current.traffic?.totalUsers, previous.traffic?.totalUsers),
        orders: calcChange(current.sales?.totalOrders, previous.sales?.totalOrders),
        revenue: calcChange(current.sales?.totalRevenue, previous.sales?.totalRevenue),
        adSpend: calcChange(current.combinedAds?.totalSpend, previous.combinedAds?.totalSpend),
        roas: calcChange(current.combinedAds?.overallRoas, previous.combinedAds?.overallRoas),
      },
      derivedKpis: {
        currentCVR, prevCVR,
        cvrChange: calcChange(currentCVR, prevCVR),
        currentAOV: current.sales?.avgOrderValue || 0,
        prevAOV: previous.sales?.avgOrderValue || 0,
        aovChange: calcChange(current.sales?.avgOrderValue, previous.sales?.avgOrderValue),
        currentCAC, prevCAC,
        cacChange: calcChange(currentCAC, prevCAC),
        currentRefundRate, prevRefundRate,
        refundRateChange: calcChange(currentRefundRate, prevRefundRate),
        cartRate, prevCartRate,
        cartRateChange: calcChange(cartRate, prevCartRate),
        grossMargin,
      }
    };
  }

  parseDate(str) {
    if (!str) return null;
    if (str.includes('-')) return new Date(str);
    if (str.length === 8) return new Date(`${str.substring(0,4)}-${str.substring(4,6)}-${str.substring(6,8)}`);
    return new Date(str);
  }

  dateToString(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  /**
   * Profitability Analysis
   */
  async getProfitability(filters = {}) {
    const cond = [];
    const params = [];
    if (filters.startDate) { cond.push("DATE_FORMAT(o.order_date,'%Y%m%d') >= ?"); params.push(filters.startDate); }
    if (filters.endDate) { cond.push("DATE_FORMAT(o.order_date,'%Y%m%d') <= ?"); params.push(filters.endDate); }
    const w = cond.length ? 'WHERE ' + cond.join(' AND ') : '';

    // Product-level profitability
    const [productProfit] = await db.query(`
      SELECT
        p.sku, p.product_name, p.brand, p.category, p.sub_category,
        p.price, p.cost_price, p.stock_quantity,
        COALESCE(SUM(oi.quantity), 0) as totalSold,
        COALESCE(SUM(oi.line_total), 0) as totalRevenue,
        COALESCE(SUM(oi.quantity * p.cost_price), 0) as totalCost,
        COALESCE(SUM(oi.line_total) - SUM(oi.quantity * p.cost_price), 0) as grossProfit,
        CASE WHEN COALESCE(SUM(oi.line_total), 0) > 0
          THEN (SUM(oi.line_total) - SUM(oi.quantity * p.cost_price)) / SUM(oi.line_total) * 100
          ELSE 0 END as marginPercent,
        COUNT(DISTINCT oi.order_id) as orderCount
      FROM products p
      LEFT JOIN order_items oi ON p.sku = oi.item_id
      LEFT JOIN orders o ON oi.order_id = o.order_id ${w ? 'AND ' + cond.join(' AND ') : ''}
      GROUP BY p.sku, p.product_name, p.brand, p.category, p.sub_category, p.price, p.cost_price, p.stock_quantity
      ORDER BY grossProfit DESC
      LIMIT 100
    `, params);

    // Category-level profitability
    const [categoryProfit] = await db.query(`
      SELECT
        p.category,
        COALESCE(SUM(oi.line_total), 0) as revenue,
        COALESCE(SUM(oi.quantity * p.cost_price), 0) as cost,
        COALESCE(SUM(oi.line_total) - SUM(oi.quantity * p.cost_price), 0) as profit,
        CASE WHEN SUM(oi.line_total) > 0
          THEN (SUM(oi.line_total) - SUM(oi.quantity * p.cost_price)) / SUM(oi.line_total) * 100
          ELSE 0 END as marginPercent,
        SUM(oi.quantity) as totalSold
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.order_id
      LEFT JOIN products p ON oi.item_id = p.sku
      ${w}
      GROUP BY p.category
      ORDER BY profit DESC
    `, params);

    // Brand-level profitability
    const [brandProfit] = await db.query(`
      SELECT
        p.brand,
        COALESCE(SUM(oi.line_total), 0) as revenue,
        COALESCE(SUM(oi.quantity * p.cost_price), 0) as cost,
        COALESCE(SUM(oi.line_total) - SUM(oi.quantity * p.cost_price), 0) as profit,
        CASE WHEN SUM(oi.line_total) > 0
          THEN (SUM(oi.line_total) - SUM(oi.quantity * p.cost_price)) / SUM(oi.line_total) * 100
          ELSE 0 END as marginPercent,
        SUM(oi.quantity) as totalSold,
        COUNT(DISTINCT oi.order_id) as orderCount
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.order_id
      LEFT JOIN products p ON oi.item_id = p.sku
      ${w}
      GROUP BY p.brand
      ORDER BY profit DESC
    `, params);

    // Negative margin products
    const [negativeMargin] = await db.query(`
      SELECT
        p.sku, p.product_name, p.brand, p.category,
        p.price, p.cost_price,
        (p.price - p.cost_price) as unitProfit,
        CASE WHEN p.price > 0 THEN (p.price - p.cost_price) / p.price * 100 ELSE 0 END as marginPercent
      FROM products p
      WHERE p.cost_price > p.price AND p.is_active = 1
      ORDER BY (p.cost_price - p.price) DESC
    `);

    // Overall summary
    const totalRevenue = productProfit.reduce((s, p) => s + Number(p.totalRevenue || 0), 0);
    const totalCost = productProfit.reduce((s, p) => s + Number(p.totalCost || 0), 0);
    const totalProfit = totalRevenue - totalCost;
    const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return {
      summary: { totalRevenue, totalCost, totalProfit, overallMargin },
      productProfit,
      categoryProfit,
      brandProfit,
      negativeMargin,
    };
  }

  /**
   * Customer Analysis with RFM Segmentation
   */
  async getCustomerAnalysis(filters = {}) {
    // Demographics
    const [ageGender] = await db.query(`
      SELECT age_group, gender, COUNT(*) as count, SUM(total_revenue) as revenue, AVG(total_orders) as avgOrders
      FROM customers WHERE total_orders >= 1
      GROUP BY age_group, gender
      ORDER BY age_group, gender
    `);

    const [cityDist] = await db.query(`
      SELECT city, COUNT(*) as count, SUM(total_revenue) as revenue, AVG(total_orders) as avgOrders
      FROM customers WHERE total_orders >= 1
      GROUP BY city ORDER BY count DESC LIMIT 20
    `);

    // Newsletter impact
    const [newsletter] = await db.query(`
      SELECT
        is_newsletter_subscriber as subscribed,
        COUNT(*) as count,
        AVG(total_orders) as avgOrders,
        AVG(total_revenue) as avgRevenue,
        SUM(total_revenue) as totalRevenue
      FROM customers WHERE total_orders >= 1
      GROUP BY is_newsletter_subscriber
    `);

    // CLV distribution
    const [clvDist] = await db.query(`
      SELECT
        CASE
          WHEN total_revenue < 500 THEN '0-500'
          WHEN total_revenue < 1000 THEN '500-1K'
          WHEN total_revenue < 2500 THEN '1K-2.5K'
          WHEN total_revenue < 5000 THEN '2.5K-5K'
          WHEN total_revenue < 10000 THEN '5K-10K'
          ELSE '10K+'
        END as clvBucket,
        COUNT(*) as count,
        SUM(total_revenue) as totalRevenue
      FROM customers WHERE total_orders >= 1
      GROUP BY clvBucket
      ORDER BY MIN(total_revenue)
    `);

    // RFM Segmentation
    const [rfmData] = await db.query(`
      SELECT
        customer_id, customer_name, city, gender, age_group,
        total_orders, total_revenue,
        last_order_date, first_order_date,
        DATEDIFF(CURDATE(), last_order_date) as recency_days
      FROM customers
      WHERE total_orders >= 1 AND last_order_date IS NOT NULL
      ORDER BY total_revenue DESC
    `);

    // Calculate RFM scores and segments
    const rfmSegments = this.calculateRFMSegments(rfmData);

    // New vs Returning comparison
    const [newVsReturning] = await db.query(`
      SELECT
        CASE WHEN total_orders = 1 THEN 'Yeni' ELSE 'Geri Dönen' END as type,
        COUNT(*) as count,
        SUM(total_revenue) as revenue,
        AVG(total_revenue) as avgRevenue
      FROM customers WHERE total_orders >= 1
      GROUP BY type
    `);

    // Registration source distribution
    const [regSource] = await db.query(`
      SELECT registration_source, COUNT(*) as count, SUM(total_revenue) as revenue
      FROM customers WHERE total_orders >= 1
      GROUP BY registration_source ORDER BY count DESC
    `);

    return {
      ageGender,
      cityDist,
      newsletter,
      clvDist,
      rfmSegments,
      newVsReturning,
      regSource,
      totalCustomers: rfmData.length,
    };
  }

  calculateRFMSegments(customers) {
    if (!customers.length) return { segments: [], summary: [] };

    // Calculate percentile thresholds
    const recencies = customers.map(c => Number(c.recency_days)).sort((a, b) => a - b);
    const frequencies = customers.map(c => Number(c.total_orders)).sort((a, b) => a - b);
    const monetaries = customers.map(c => Number(c.total_revenue)).sort((a, b) => a - b);

    const getPercentile = (arr, p) => arr[Math.floor(arr.length * p / 100)] || 0;

    const r33 = getPercentile(recencies, 33);
    const r66 = getPercentile(recencies, 66);
    const f33 = getPercentile(frequencies, 33);
    const f66 = getPercentile(frequencies, 66);
    const m33 = getPercentile(monetaries, 33);
    const m66 = getPercentile(monetaries, 66);

    const scored = customers.map(c => {
      const rec = Number(c.recency_days);
      const freq = Number(c.total_orders);
      const mon = Number(c.total_revenue);

      // R score (lower recency = higher score)
      const rScore = rec <= r33 ? 3 : rec <= r66 ? 2 : 1;
      // F score
      const fScore = freq >= f66 ? 3 : freq >= f33 ? 2 : 1;
      // M score
      const mScore = mon >= m66 ? 3 : mon >= m33 ? 2 : 1;

      let segment;
      if (rScore >= 3 && fScore >= 3 && mScore >= 3) segment = 'Şampiyonlar';
      else if (rScore >= 2 && fScore >= 3) segment = 'Sadık Müşteriler';
      else if (rScore >= 3 && fScore >= 1 && mScore >= 2) segment = 'Potansiyel Sadıklar';
      else if (rScore >= 3 && fScore <= 1) segment = 'Yeni Müşteriler';
      else if (rScore >= 2 && fScore >= 2) segment = 'Umut Vaat Edenler';
      else if (rScore <= 2 && fScore >= 3) segment = 'Risk Altında';
      else if (rScore <= 1 && fScore >= 2) segment = 'Kaybedilmek Üzere';
      else if (rScore <= 1 && fScore <= 1) segment = 'Kayıp Müşteriler';
      else segment = 'Uyuyanlar';

      return {
        ...c,
        rScore, fScore, mScore,
        rfmScore: rScore * 100 + fScore * 10 + mScore,
        segment,
      };
    });

    // Segment summary
    const segmentMap = {};
    scored.forEach(c => {
      if (!segmentMap[c.segment]) {
        segmentMap[c.segment] = { segment: c.segment, count: 0, totalRevenue: 0, avgRevenue: 0, avgOrders: 0 };
      }
      segmentMap[c.segment].count++;
      segmentMap[c.segment].totalRevenue += Number(c.total_revenue);
      segmentMap[c.segment].avgOrders += Number(c.total_orders);
    });
    const summary = Object.values(segmentMap).map(s => ({
      ...s,
      avgRevenue: s.count > 0 ? s.totalRevenue / s.count : 0,
      avgOrders: s.count > 0 ? s.avgOrders / s.count : 0,
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);

    return { customers: scored.slice(0, 200), summary };
  }

  /**
   * Executive Summary
   */
  async getExecutiveSummary(filters = {}) {
    const enhanced = await this.getEnhancedSummary(filters);

    // Channel waterfall
    const [channelWaterfall] = await db.query(`
      SELECT channel, SUM(order_revenue) as revenue, SUM(net_revenue) as netRevenue,
             COUNT(*) as orders, COUNT(DISTINCT customer_id) as customers
      FROM orders
      GROUP BY channel ORDER BY revenue DESC
    `);

    // Budget vs Actual
    let budgetVsActual = [];
    try {
      const [metaBudget] = await db.query(`
        SELECT c.campaign_name, c.platform, c.total_budget, c.daily_budget, c.status,
               COALESCE(SUM(m.spend), 0) as actualSpend,
               CASE WHEN c.total_budget > 0 THEN COALESCE(SUM(m.spend), 0) / c.total_budget * 100 ELSE 0 END as utilizationPct
        FROM campaigns c
        LEFT JOIN meta_ads m ON c.campaign_name = m.campaign_name
        WHERE c.platform = 'meta'
        GROUP BY c.campaign_name, c.platform, c.total_budget, c.daily_budget, c.status
      `);
      const [googleBudget] = await db.query(`
        SELECT c.campaign_name, c.platform, c.total_budget, c.daily_budget, c.status,
               COALESCE(SUM(g.cost_micros)/1000000, 0) as actualSpend,
               CASE WHEN c.total_budget > 0 THEN COALESCE(SUM(g.cost_micros)/1000000, 0) / c.total_budget * 100 ELSE 0 END as utilizationPct
        FROM campaigns c
        LEFT JOIN google_ads g ON c.campaign_name = g.campaign_name
        WHERE c.platform = 'google'
        GROUP BY c.campaign_name, c.platform, c.total_budget, c.daily_budget, c.status
      `);
      budgetVsActual = [...metaBudget, ...googleBudget].sort((a, b) => (b.actualSpend || 0) - (a.actualSpend || 0));
    } catch(e) {}

    // Weekly performance trend (last 12 weeks)
    let weeklyTrend = [];
    try {
      const [wt] = await db.query(`
        SELECT
          YEARWEEK(order_date, 1) as week,
          MIN(DATE(order_date)) as weekStart,
          COUNT(*) as orders,
          SUM(order_revenue) as revenue,
          SUM(net_revenue) as netRevenue,
          AVG(order_revenue) as aov,
          COUNT(DISTINCT customer_id) as customers
        FROM orders
        GROUP BY YEARWEEK(order_date, 1)
        ORDER BY week DESC
        LIMIT 12
      `);
      weeklyTrend = wt.reverse();
    } catch(e) {}

    // Health scores
    const trafficScore = this.calcHealthScore({
      bounceRate: enhanced.current.traffic?.avgBounceRate,
      engagementRate: enhanced.current.traffic?.avgEngagementRate,
      sessions: enhanced.current.traffic?.totalSessions,
    }, 'traffic');

    const salesScore = this.calcHealthScore({
      revenue: enhanced.current.sales?.totalRevenue,
      orders: enhanced.current.sales?.totalOrders,
      aov: enhanced.current.sales?.avgOrderValue,
      revenueChange: enhanced.changes?.revenue,
    }, 'sales');

    const marketingScore = this.calcHealthScore({
      roas: enhanced.current.combinedAds?.overallRoas,
      adSpend: enhanced.current.combinedAds?.totalSpend,
    }, 'marketing');

    return {
      ...enhanced,
      channelWaterfall,
      budgetVsActual,
      weeklyTrend,
      healthScores: { trafficScore, salesScore, marketingScore },
    };
  }

  calcHealthScore(metrics, type) {
    let score = 50; // baseline
    if (type === 'traffic') {
      if (metrics.bounceRate < 0.4) score += 15;
      else if (metrics.bounceRate < 0.6) score += 5;
      else score -= 10;
      if (metrics.engagementRate > 0.5) score += 20;
      else if (metrics.engagementRate > 0.3) score += 10;
      if (metrics.sessions > 1000) score += 15;
      else if (metrics.sessions > 100) score += 5;
    } else if (type === 'sales') {
      if (metrics.revenueChange > 10) score += 20;
      else if (metrics.revenueChange > 0) score += 10;
      else if (metrics.revenueChange < -10) score -= 15;
      if (metrics.orders > 100) score += 15;
      else if (metrics.orders > 10) score += 5;
      if (metrics.aov > 200) score += 15;
    } else if (type === 'marketing') {
      if (metrics.roas > 4) score += 30;
      else if (metrics.roas > 2) score += 15;
      else if (metrics.roas > 1) score += 5;
      else if (metrics.roas < 1) score -= 15;
      if (metrics.adSpend > 0) score += 10;
    }
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Meta Ads Breakdowns
   */
  async getMetaBreakdowns(filters = {}) {
    const cond = [];
    const params = [];
    if (filters.startDate) { cond.push('date_start >= ?'); params.push(this.formatDateForSQL(filters.startDate)); }
    if (filters.endDate) { cond.push('date_start <= ?'); params.push(this.formatDateForSQL(filters.endDate)); }
    const w = cond.length ? 'WHERE ' + cond.join(' AND ') : '';

    // Platform distribution
    const [platformDist] = await db.query(`
      SELECT publisher_platform as platform,
        SUM(impressions) as impressions, SUM(clicks) as clicks, SUM(spend) as spend,
        CASE WHEN SUM(impressions)>0 THEN SUM(clicks)/SUM(impressions)*100 ELSE 0 END as ctr
      FROM meta_ads_breakdowns ${w}
      GROUP BY publisher_platform ORDER BY spend DESC
    `, params);

    // Position distribution
    const [positionDist] = await db.query(`
      SELECT platform_position as position,
        SUM(impressions) as impressions, SUM(clicks) as clicks, SUM(spend) as spend,
        CASE WHEN SUM(impressions)>0 THEN SUM(clicks)/SUM(impressions)*100 ELSE 0 END as ctr
      FROM meta_ads_breakdowns ${w}
      GROUP BY platform_position ORDER BY spend DESC
    `, params);

    // Device distribution
    const [deviceDist] = await db.query(`
      SELECT impression_device as device,
        SUM(impressions) as impressions, SUM(clicks) as clicks, SUM(spend) as spend,
        CASE WHEN SUM(impressions)>0 THEN SUM(clicks)/SUM(impressions)*100 ELSE 0 END as ctr
      FROM meta_ads_breakdowns ${w}
      GROUP BY impression_device ORDER BY spend DESC
    `, params);

    // Campaign breakdown
    const [campaignBreakdown] = await db.query(`
      SELECT campaign_name, publisher_platform as platform,
        SUM(impressions) as impressions, SUM(clicks) as clicks, SUM(spend) as spend
      FROM meta_ads_breakdowns ${w}
      GROUP BY campaign_name, publisher_platform ORDER BY spend DESC LIMIT 30
    `, params);

    return { platformDist, positionDist, deviceDist, campaignBreakdown };
  }

  /**
   * Budget Tracking
   */
  async getBudgetTracking(filters = {}) {
    // All campaigns with budget info
    const [campaigns] = await db.query(`
      SELECT c.*,
        COALESCE(meta.spend, 0) + COALESCE(gads.spend, 0) as actualSpend,
        COALESCE(meta.impressions, 0) + COALESCE(gads.impressions, 0) as totalImpressions,
        COALESCE(meta.clicks, 0) + COALESCE(gads.clicks, 0) as totalClicks,
        COALESCE(meta.conversions, 0) + COALESCE(gads.conversions, 0) as totalConversions,
        COALESCE(meta.convValue, 0) + COALESCE(gads.convValue, 0) as totalConvValue
      FROM campaigns c
      LEFT JOIN (
        SELECT campaign_name, SUM(spend) as spend, SUM(impressions) as impressions,
               SUM(clicks) as clicks, SUM(actions_purchase) as conversions,
               SUM(action_values_purchase) as convValue
        FROM meta_ads GROUP BY campaign_name
      ) meta ON c.campaign_name = meta.campaign_name AND c.platform = 'meta'
      LEFT JOIN (
        SELECT campaign_name, SUM(cost_micros)/1000000 as spend, SUM(impressions) as impressions,
               SUM(clicks) as clicks, SUM(conversions) as conversions,
               SUM(conversions_value) as convValue
        FROM google_ads GROUP BY campaign_name
      ) gads ON c.campaign_name = gads.campaign_name AND c.platform = 'google'
      ORDER BY actualSpend DESC
    `);

    // Status summary
    const statusSummary = {};
    campaigns.forEach(c => {
      const st = c.status || 'unknown';
      if (!statusSummary[st]) statusSummary[st] = { status: st, count: 0, budget: 0, spent: 0 };
      statusSummary[st].count++;
      statusSummary[st].budget += Number(c.total_budget || 0);
      statusSummary[st].spent += Number(c.actualSpend || 0);
    });

    // Platform summary
    const platformSummary = {};
    campaigns.forEach(c => {
      const pl = c.platform || 'unknown';
      if (!platformSummary[pl]) platformSummary[pl] = { platform: pl, count: 0, budget: 0, spent: 0, conversions: 0, convValue: 0 };
      platformSummary[pl].count++;
      platformSummary[pl].budget += Number(c.total_budget || 0);
      platformSummary[pl].spent += Number(c.actualSpend || 0);
      platformSummary[pl].conversions += Number(c.totalConversions || 0);
      platformSummary[pl].convValue += Number(c.totalConvValue || 0);
    });

    // Objective summary
    const objectiveSummary = {};
    campaigns.forEach(c => {
      const obj = c.objective || 'unknown';
      if (!objectiveSummary[obj]) objectiveSummary[obj] = { objective: obj, count: 0, budget: 0, spent: 0, convValue: 0 };
      objectiveSummary[obj].count++;
      objectiveSummary[obj].budget += Number(c.total_budget || 0);
      objectiveSummary[obj].spent += Number(c.actualSpend || 0);
      objectiveSummary[obj].convValue += Number(c.totalConvValue || 0);
    });

    return {
      campaigns,
      statusSummary: Object.values(statusSummary),
      platformSummary: Object.values(platformSummary),
      objectiveSummary: Object.values(objectiveSummary),
    };
  }

  /**
   * Stock Analysis
   */
  async getStockAnalysis(filters = {}) {
    // Stock status with sales velocity
    const [stockStatus] = await db.query(`
      SELECT
        p.sku, p.product_name, p.brand, p.category, p.sub_category,
        p.price, p.cost_price, p.stock_quantity, p.is_active,
        COALESCE(s.totalSold, 0) as totalSold,
        COALESCE(s.last30days, 0) as last30daysSold,
        COALESCE(s.last7days, 0) as last7daysSold,
        CASE WHEN COALESCE(s.last30days, 0) > 0
          THEN ROUND(p.stock_quantity / (s.last30days / 30), 0)
          ELSE 999 END as daysOfStock,
        COALESCE(s.totalRevenue, 0) as totalRevenue
      FROM products p
      LEFT JOIN (
        SELECT oi.item_id,
          SUM(oi.quantity) as totalSold,
          SUM(CASE WHEN o.order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN oi.quantity ELSE 0 END) as last30days,
          SUM(CASE WHEN o.order_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN oi.quantity ELSE 0 END) as last7days,
          SUM(oi.line_total) as totalRevenue
        FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.order_id
        GROUP BY oi.item_id
      ) s ON p.sku = s.item_id
      WHERE p.is_active = 1
      ORDER BY daysOfStock ASC
    `);

    // Critical stock (< 15 days remaining)
    const criticalStock = stockStatus.filter(p => Number(p.daysOfStock) < 15 && Number(p.daysOfStock) !== 999);

    // Dead stock (active but no sales in 30 days)
    const deadStock = stockStatus.filter(p => Number(p.last30daysSold) === 0 && Number(p.stock_quantity) > 0);

    // ABC classification
    const totalRev = stockStatus.reduce((s, p) => s + Number(p.totalRevenue || 0), 0);
    let cumRev = 0;
    const abcProducts = stockStatus
      .sort((a, b) => Number(b.totalRevenue) - Number(a.totalRevenue))
      .map(p => {
        cumRev += Number(p.totalRevenue || 0);
        const cumPct = totalRev > 0 ? (cumRev / totalRev) * 100 : 0;
        let abcClass;
        if (cumPct <= 80) abcClass = 'A';
        else if (cumPct <= 95) abcClass = 'B';
        else abcClass = 'C';
        return { ...p, abcClass, revenueShare: totalRev > 0 ? (Number(p.totalRevenue) / totalRev * 100) : 0 };
      });

    // ABC summary
    const abcSummary = { A: { count: 0, revenue: 0 }, B: { count: 0, revenue: 0 }, C: { count: 0, revenue: 0 } };
    abcProducts.forEach(p => {
      abcSummary[p.abcClass].count++;
      abcSummary[p.abcClass].revenue += Number(p.totalRevenue || 0);
    });

    // Category stock overview
    const categoryStock = {};
    stockStatus.forEach(p => {
      const cat = p.category || 'Diğer';
      if (!categoryStock[cat]) categoryStock[cat] = { category: cat, totalStock: 0, totalProducts: 0, totalSold: 0, totalRevenue: 0, criticalCount: 0 };
      categoryStock[cat].totalStock += Number(p.stock_quantity || 0);
      categoryStock[cat].totalProducts++;
      categoryStock[cat].totalSold += Number(p.totalSold || 0);
      categoryStock[cat].totalRevenue += Number(p.totalRevenue || 0);
      if (Number(p.daysOfStock) < 15 && Number(p.daysOfStock) !== 999) categoryStock[cat].criticalCount++;
    });

    return {
      stockStatus: stockStatus.slice(0, 100),
      criticalStock,
      deadStock: deadStock.slice(0, 50),
      abcProducts: abcProducts.slice(0, 100),
      abcSummary,
      categoryStock: Object.values(categoryStock),
    };
  }

  /**
   * Metric Detail — Deep-dive analytics for each KPI card
   * @param {string} metricType - one of: sessions, users, orders, revenue, adspend, roas, conversion, aov
   * @param {object} filters - startDate, endDate, channel, device, city
   */
  async getMetricDetail(metricType, filters = {}) {
    const cacheKey = `metric-detail:${metricType}:${JSON.stringify(filters)}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    let result;
    switch (metricType) {
      case 'sessions':
        result = await this._sessionsDetail(filters);
        break;
      case 'users':
        result = await this._usersDetail(filters);
        break;
      case 'orders':
        result = await this._ordersDetail(filters);
        break;
      case 'revenue':
        result = await this._revenueDetail(filters);
        break;
      case 'adspend':
        result = await this._adspendDetail(filters);
        break;
      case 'roas':
        result = await this._roasDetail(filters);
        break;
      case 'conversion':
        result = await this._conversionDetail(filters);
        break;
      case 'aov':
        result = await this._aovDetail(filters);
        break;
      default:
        throw new Error(`Unknown metric type: ${metricType}`);
    }

    await this.setCache(cacheKey, result);
    return result;
  }

  /* ── Sessions Detail ─────────────────────────────────────── */
  async _sessionsDetail(filters) {
    const { conditions, params } = this.buildDateFilter(filters);
    const w = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [dailyTrend] = await db.query(`
      SELECT date, SUM(sessions) as sessions, AVG(bounceRate) as bounceRate,
             AVG(averageSessionDuration) as avgDuration, AVG(engagementRate) as engagementRate
      FROM ga4_traffic ${w} GROUP BY date ORDER BY date
    `, params);

    const [weeklyTrend] = await db.query(`
      SELECT YEARWEEK(STR_TO_DATE(date, '%Y%m%d'), 1) as week,
             MIN(date) as weekStart, SUM(sessions) as sessions,
             AVG(bounceRate) as bounceRate, AVG(engagementRate) as engagementRate
      FROM ga4_traffic ${w}
      GROUP BY YEARWEEK(STR_TO_DATE(date, '%Y%m%d'), 1) ORDER BY week
    `, params);

    const [channelDist] = await db.query(`
      SELECT sessionDefaultChannelGroup as channel, SUM(sessions) as sessions,
             AVG(bounceRate) as bounceRate, AVG(engagementRate) as engagementRate,
             AVG(averageSessionDuration) as avgDuration
      FROM ga4_traffic ${w} GROUP BY sessionDefaultChannelGroup ORDER BY sessions DESC
    `, params);

    const [deviceDist] = await db.query(`
      SELECT deviceCategory as device, SUM(sessions) as sessions,
             AVG(bounceRate) as bounceRate, AVG(engagementRate) as engagementRate
      FROM ga4_traffic ${w} GROUP BY deviceCategory ORDER BY sessions DESC
    `, params);

    const [sourceMedium] = await db.query(`
      SELECT CONCAT(sessionSource, ' / ', sessionMedium) as sourceMedium,
             SUM(sessions) as sessions, AVG(bounceRate) as bounceRate,
             AVG(engagementRate) as engagementRate, SUM(conversions) as conversions
      FROM ga4_traffic ${w} GROUP BY sessionSource, sessionMedium ORDER BY sessions DESC LIMIT 20
    `, params);

    const [topCities] = await db.query(`
      SELECT city, SUM(sessions) as sessions, SUM(totalUsers) as users
      FROM ga4_traffic ${w} GROUP BY city ORDER BY sessions DESC LIMIT 15
    `, params);

    const totalSessions = dailyTrend.reduce((s, d) => s + Number(d.sessions || 0), 0);
    const avgBounce = dailyTrend.length ? dailyTrend.reduce((s, d) => s + Number(d.bounceRate || 0), 0) / dailyTrend.length : 0;
    const avgEngagement = dailyTrend.length ? dailyTrend.reduce((s, d) => s + Number(d.engagementRate || 0), 0) / dailyTrend.length : 0;
    const avgDuration = dailyTrend.length ? dailyTrend.reduce((s, d) => s + Number(d.avgDuration || 0), 0) / dailyTrend.length : 0;

    return {
      summary: { totalSessions, avgBounce, avgEngagement, avgDuration },
      dailyTrend, weeklyTrend, channelDist, deviceDist, sourceMedium, topCities,
    };
  }

  /* ── Users Detail ────────────────────────────────────────── */
  async _usersDetail(filters) {
    const { conditions, params } = this.buildDateFilter(filters);
    const w = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [dailyTrend] = await db.query(`
      SELECT date, SUM(totalUsers) as users, SUM(newUsers) as newUsers
      FROM ga4_traffic ${w} GROUP BY date ORDER BY date
    `, params);

    const [newVsReturning] = await db.query(`
      SELECT newVsReturning as userType, SUM(totalUsers) as users, SUM(sessions) as sessions
      FROM ga4_traffic ${w} GROUP BY newVsReturning
    `, params);

    const [channelDist] = await db.query(`
      SELECT sessionDefaultChannelGroup as channel, SUM(totalUsers) as users,
             SUM(newUsers) as newUsers, SUM(sessions) as sessions
      FROM ga4_traffic ${w} GROUP BY sessionDefaultChannelGroup ORDER BY users DESC
    `, params);

    const [deviceDist] = await db.query(`
      SELECT deviceCategory as device, SUM(totalUsers) as users, SUM(newUsers) as newUsers
      FROM ga4_traffic ${w} GROUP BY deviceCategory ORDER BY users DESC
    `, params);

    const [topCities] = await db.query(`
      SELECT city, SUM(totalUsers) as users, SUM(newUsers) as newUsers, SUM(sessions) as sessions
      FROM ga4_traffic ${w} GROUP BY city ORDER BY users DESC LIMIT 15
    `, params);

    const totalUsers = dailyTrend.reduce((s, d) => s + Number(d.users || 0), 0);
    const totalNew = dailyTrend.reduce((s, d) => s + Number(d.newUsers || 0), 0);

    return {
      summary: { totalUsers, totalNew, returningUsers: totalUsers - totalNew, newRatio: totalUsers > 0 ? totalNew / totalUsers : 0 },
      dailyTrend, newVsReturning, channelDist, deviceDist, topCities,
    };
  }

  /* ── Orders Detail ───────────────────────────────────────── */
  async _ordersDetail(filters) {
    const cond = [];
    const p = [];
    if (filters.startDate) { cond.push(`DATE_FORMAT(order_date, '%Y%m%d') >= ?`); p.push(filters.startDate); }
    if (filters.endDate) { cond.push(`DATE_FORMAT(order_date, '%Y%m%d') <= ?`); p.push(filters.endDate); }
    if (filters.channel) { cond.push('channel = ?'); p.push(filters.channel); }
    if (filters.device) { cond.push('device = ?'); p.push(filters.device); }
    if (filters.city) { cond.push('city = ?'); p.push(filters.city); }
    const w = cond.length ? 'WHERE ' + cond.join(' AND ') : '';

    const [dailyTrend] = await db.query(`
      SELECT DATE(order_date) as date, COUNT(*) as orders, SUM(order_revenue) as revenue,
             AVG(order_revenue) as aov, SUM(product_count) as totalItems
      FROM orders ${w} GROUP BY DATE(order_date) ORDER BY date
    `, p);

    const [statusDist] = await db.query(`
      SELECT order_status as status, COUNT(*) as count, SUM(order_revenue) as revenue
      FROM orders ${w} GROUP BY order_status
    `, p);

    const [paymentDist] = await db.query(`
      SELECT payment_method, COUNT(*) as count, SUM(order_revenue) as revenue, AVG(order_revenue) as aov
      FROM orders ${w} GROUP BY payment_method ORDER BY count DESC
    `, p);

    const [channelDist] = await db.query(`
      SELECT channel, COUNT(*) as orders, SUM(order_revenue) as revenue, AVG(order_revenue) as aov
      FROM orders ${w} GROUP BY channel ORDER BY orders DESC
    `, p);

    const [hourlyDist] = await db.query(`
      SELECT HOUR(order_date) as hour, COUNT(*) as orders, SUM(order_revenue) as revenue
      FROM orders ${w} GROUP BY HOUR(order_date) ORDER BY hour
    `, p);

    const [dayOfWeekDist] = await db.query(`
      SELECT DAYOFWEEK(order_date) as dayOfWeek, COUNT(*) as orders, SUM(order_revenue) as revenue
      FROM orders ${w} GROUP BY DAYOFWEEK(order_date) ORDER BY dayOfWeek
    `, p);

    const [couponAnalysis] = await db.query(`
      SELECT
        CASE WHEN coupon_code IS NOT NULL AND coupon_code != '' THEN 'Kuponlu' ELSE 'Kuponsuz' END as type,
        COUNT(*) as orders, SUM(order_revenue) as revenue, AVG(order_revenue) as aov,
        SUM(discount_amount) as totalDiscount
      FROM orders ${w} GROUP BY type
    `, p);

    const totalOrders = dailyTrend.reduce((s, d) => s + Number(d.orders || 0), 0);
    const totalRevenue = dailyTrend.reduce((s, d) => s + Number(d.revenue || 0), 0);
    const avgItems = dailyTrend.length ? dailyTrend.reduce((s, d) => s + Number(d.totalItems || 0), 0) / totalOrders : 0;

    return {
      summary: { totalOrders, totalRevenue, avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0, avgItemsPerOrder: avgItems },
      dailyTrend, statusDist, paymentDist, channelDist, hourlyDist, dayOfWeekDist, couponAnalysis,
    };
  }

  /* ── Revenue Detail ──────────────────────────────────────── */
  async _revenueDetail(filters) {
    const cond = [];
    const p = [];
    if (filters.startDate) { cond.push(`DATE_FORMAT(order_date, '%Y%m%d') >= ?`); p.push(filters.startDate); }
    if (filters.endDate) { cond.push(`DATE_FORMAT(order_date, '%Y%m%d') <= ?`); p.push(filters.endDate); }
    if (filters.channel) { cond.push('channel = ?'); p.push(filters.channel); }
    if (filters.device) { cond.push('device = ?'); p.push(filters.device); }
    const w = cond.length ? 'WHERE ' + cond.join(' AND ') : '';

    const [dailyRevenue] = await db.query(`
      SELECT DATE(order_date) as date, SUM(order_revenue) as revenue, SUM(net_revenue) as netRevenue,
             SUM(discount_amount) as discounts, SUM(refund_amount) as refunds, COUNT(*) as orders
      FROM orders ${w} GROUP BY DATE(order_date) ORDER BY date
    `, p);

    const [weeklyRevenue] = await db.query(`
      SELECT YEARWEEK(order_date, 1) as week, MIN(DATE(order_date)) as weekStart,
             SUM(order_revenue) as revenue, SUM(net_revenue) as netRevenue, COUNT(*) as orders
      FROM orders ${w} GROUP BY YEARWEEK(order_date, 1) ORDER BY week
    `, p);

    const [channelRevenue] = await db.query(`
      SELECT channel, SUM(order_revenue) as revenue, SUM(net_revenue) as netRevenue,
             SUM(discount_amount) as discounts, COUNT(*) as orders
      FROM orders ${w} GROUP BY channel ORDER BY revenue DESC
    `, p);

    // Category revenue (via order_items + products)
    const wOi = w.replace(/order_date/g, 'o.order_date').replace(/channel/g, 'o.channel').replace(/device/g, 'o.device');
    const [categoryRevenue] = await db.query(`
      SELECT COALESCE(p.category, oi.item_category, 'Diğer') as category,
             SUM(oi.line_total) as revenue, SUM(oi.quantity) as quantity, COUNT(DISTINCT oi.order_id) as orders
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.order_id
      LEFT JOIN products p ON oi.item_id = p.sku
      ${wOi} GROUP BY p.category, oi.item_category ORDER BY revenue DESC LIMIT 15
    `, p);

    const [refundByBrand] = await db.query(`
      SELECT oi.item_brand as brand, SUM(oi.line_total) as revenue, SUM(oi.refund_amount) as refunds,
             CASE WHEN SUM(oi.line_total) > 0 THEN SUM(oi.refund_amount)/SUM(oi.line_total)*100 ELSE 0 END as refundRate
      FROM order_items oi INNER JOIN orders o ON oi.order_id = o.order_id
      ${wOi} GROUP BY oi.item_brand HAVING refunds > 0 ORDER BY refunds DESC LIMIT 15
    `, p);

    const totalRevenue = dailyRevenue.reduce((s, d) => s + Number(d.revenue || 0), 0);
    const totalNet = dailyRevenue.reduce((s, d) => s + Number(d.netRevenue || 0), 0);
    const totalDiscounts = dailyRevenue.reduce((s, d) => s + Number(d.discounts || 0), 0);
    const totalRefunds = dailyRevenue.reduce((s, d) => s + Number(d.refunds || 0), 0);

    return {
      summary: { totalRevenue, totalNet, totalDiscounts, totalRefunds, netMargin: totalRevenue > 0 ? totalNet / totalRevenue : 0 },
      dailyRevenue, weeklyRevenue, channelRevenue, categoryRevenue, refundByBrand,
    };
  }

  /* ── Ad Spend Detail ─────────────────────────────────────── */
  async _adspendDetail(filters) {
    const metaCond = []; const metaP = [];
    if (filters.startDate) { metaCond.push('date_start >= ?'); metaP.push(this.formatDateForSQL(filters.startDate)); }
    if (filters.endDate) { metaCond.push('date_start <= ?'); metaP.push(this.formatDateForSQL(filters.endDate)); }
    const metaW = metaCond.length ? 'WHERE ' + metaCond.join(' AND ') : '';

    const gadsCond = []; const gadsP = [];
    if (filters.startDate) { gadsCond.push('date >= ?'); gadsP.push(this.formatDateForSQL(filters.startDate)); }
    if (filters.endDate) { gadsCond.push('date <= ?'); gadsP.push(this.formatDateForSQL(filters.endDate)); }
    const gadsW = gadsCond.length ? 'WHERE ' + gadsCond.join(' AND ') : '';

    const [metaDaily] = await db.query(`
      SELECT date_start as date, SUM(spend) as spend, SUM(impressions) as impressions,
             SUM(clicks) as clicks, CASE WHEN SUM(clicks)>0 THEN SUM(spend)/SUM(clicks) ELSE 0 END as cpc,
             CASE WHEN SUM(impressions)>0 THEN SUM(clicks)/SUM(impressions)*100 ELSE 0 END as ctr
      FROM meta_ads ${metaW} GROUP BY date_start ORDER BY date_start
    `, metaP);

    const [googleDaily] = await db.query(`
      SELECT date, SUM(cost_micros)/1000000 as spend, SUM(impressions) as impressions,
             SUM(clicks) as clicks,
             CASE WHEN SUM(clicks)>0 THEN (SUM(cost_micros)/1000000)/SUM(clicks) ELSE 0 END as cpc,
             CASE WHEN SUM(impressions)>0 THEN SUM(clicks)/SUM(impressions)*100 ELSE 0 END as ctr
      FROM google_ads ${gadsW} GROUP BY date ORDER BY date
    `, gadsP);

    const [metaCampaigns] = await db.query(`
      SELECT campaign_name, SUM(spend) as spend, SUM(impressions) as impressions, SUM(clicks) as clicks,
             CASE WHEN SUM(clicks)>0 THEN SUM(spend)/SUM(clicks) ELSE 0 END as cpc,
             CASE WHEN SUM(impressions)>0 THEN SUM(clicks)/SUM(impressions)*100 ELSE 0 END as ctr
      FROM meta_ads ${metaW} GROUP BY campaign_name ORDER BY spend DESC
    `, metaP);

    const [googleCampaigns] = await db.query(`
      SELECT campaign_name, SUM(cost_micros)/1000000 as spend, SUM(impressions) as impressions, SUM(clicks) as clicks,
             CASE WHEN SUM(clicks)>0 THEN (SUM(cost_micros)/1000000)/SUM(clicks) ELSE 0 END as cpc,
             CASE WHEN SUM(impressions)>0 THEN SUM(clicks)/SUM(impressions)*100 ELSE 0 END as ctr
      FROM google_ads ${gadsW} GROUP BY campaign_name ORDER BY spend DESC
    `, gadsP);

    // Platform totals
    const metaTotalSpend = metaDaily.reduce((s, d) => s + Number(d.spend || 0), 0);
    const googleTotalSpend = googleDaily.reduce((s, d) => s + Number(d.spend || 0), 0);
    const metaTotalClicks = metaDaily.reduce((s, d) => s + Number(d.clicks || 0), 0);
    const googleTotalClicks = googleDaily.reduce((s, d) => s + Number(d.clicks || 0), 0);
    const metaTotalImpressions = metaDaily.reduce((s, d) => s + Number(d.impressions || 0), 0);
    const googleTotalImpressions = googleDaily.reduce((s, d) => s + Number(d.impressions || 0), 0);

    // Budget utilization
    let budgetUtil = [];
    try {
      const [bu] = await db.query(`
        SELECT c.campaign_name, c.platform, c.total_budget,
               CASE WHEN c.platform = 'meta' THEN COALESCE(m.spend, 0)
                    WHEN c.platform = 'google' THEN COALESCE(g.spend, 0) ELSE 0 END as actualSpend,
               CASE WHEN c.total_budget > 0 THEN
                 CASE WHEN c.platform = 'meta' THEN COALESCE(m.spend, 0) / c.total_budget * 100
                      WHEN c.platform = 'google' THEN COALESCE(g.spend, 0) / c.total_budget * 100 ELSE 0 END
               ELSE 0 END as utilizationPct
        FROM campaigns c
        LEFT JOIN (SELECT campaign_name, SUM(spend) as spend FROM meta_ads ${metaW} GROUP BY campaign_name) m
          ON c.campaign_name = m.campaign_name AND c.platform = 'meta'
        LEFT JOIN (SELECT campaign_name, SUM(cost_micros)/1000000 as spend FROM google_ads ${gadsW} GROUP BY campaign_name) g
          ON c.campaign_name = g.campaign_name AND c.platform = 'google'
        ORDER BY actualSpend DESC LIMIT 20
      `, [...metaP, ...gadsP]);
      budgetUtil = bu;
    } catch (e) {}

    return {
      summary: {
        totalSpend: metaTotalSpend + googleTotalSpend,
        metaSpend: metaTotalSpend, googleSpend: googleTotalSpend,
        totalClicks: metaTotalClicks + googleTotalClicks,
        totalImpressions: metaTotalImpressions + googleTotalImpressions,
        avgCPC: (metaTotalClicks + googleTotalClicks) > 0 ? (metaTotalSpend + googleTotalSpend) / (metaTotalClicks + googleTotalClicks) : 0,
        avgCTR: (metaTotalImpressions + googleTotalImpressions) > 0 ? (metaTotalClicks + googleTotalClicks) / (metaTotalImpressions + googleTotalImpressions) * 100 : 0,
      },
      metaDaily, googleDaily,
      campaigns: [
        ...metaCampaigns.map(c => ({ ...c, platform: 'Meta' })),
        ...googleCampaigns.map(c => ({ ...c, platform: 'Google' })),
      ].sort((a, b) => (b.spend || 0) - (a.spend || 0)),
      budgetUtil,
    };
  }

  /* ── ROAS Detail ─────────────────────────────────────────── */
  async _roasDetail(filters) {
    const metaCond = []; const metaP = [];
    if (filters.startDate) { metaCond.push('date_start >= ?'); metaP.push(this.formatDateForSQL(filters.startDate)); }
    if (filters.endDate) { metaCond.push('date_start <= ?'); metaP.push(this.formatDateForSQL(filters.endDate)); }
    const metaW = metaCond.length ? 'WHERE ' + metaCond.join(' AND ') : '';

    const gadsCond = []; const gadsP = [];
    if (filters.startDate) { gadsCond.push('date >= ?'); gadsP.push(this.formatDateForSQL(filters.startDate)); }
    if (filters.endDate) { gadsCond.push('date <= ?'); gadsP.push(this.formatDateForSQL(filters.endDate)); }
    const gadsW = gadsCond.length ? 'WHERE ' + gadsCond.join(' AND ') : '';

    const [metaDaily] = await db.query(`
      SELECT date_start as date, SUM(spend) as spend, SUM(action_values_purchase) as convValue,
             CASE WHEN SUM(spend)>0 THEN SUM(action_values_purchase)/SUM(spend) ELSE 0 END as roas
      FROM meta_ads ${metaW} GROUP BY date_start ORDER BY date_start
    `, metaP);

    const [googleDaily] = await db.query(`
      SELECT date, SUM(cost_micros)/1000000 as spend, SUM(conversions_value) as convValue,
             CASE WHEN SUM(cost_micros)>0 THEN SUM(conversions_value)/(SUM(cost_micros)/1000000) ELSE 0 END as roas
      FROM google_ads ${gadsW} GROUP BY date ORDER BY date
    `, gadsP);

    const [metaCampaignRoas] = await db.query(`
      SELECT campaign_name, SUM(spend) as spend, SUM(action_values_purchase) as convValue,
             SUM(actions_purchase) as conversions,
             CASE WHEN SUM(spend)>0 THEN SUM(action_values_purchase)/SUM(spend) ELSE 0 END as roas
      FROM meta_ads ${metaW} GROUP BY campaign_name HAVING spend > 0 ORDER BY roas DESC
    `, metaP);

    const [googleCampaignRoas] = await db.query(`
      SELECT campaign_name, SUM(cost_micros)/1000000 as spend, SUM(conversions_value) as convValue,
             SUM(conversions) as conversions,
             CASE WHEN SUM(cost_micros)>0 THEN SUM(conversions_value)/(SUM(cost_micros)/1000000) ELSE 0 END as roas
      FROM google_ads ${gadsW} GROUP BY campaign_name HAVING spend > 0 ORDER BY roas DESC
    `, gadsP);

    // Platform summary
    const metaTotalSpend = metaDaily.reduce((s, d) => s + Number(d.spend || 0), 0);
    const metaTotalConvValue = metaDaily.reduce((s, d) => s + Number(d.convValue || 0), 0);
    const googleTotalSpend = googleDaily.reduce((s, d) => s + Number(d.spend || 0), 0);
    const googleTotalConvValue = googleDaily.reduce((s, d) => s + Number(d.convValue || 0), 0);

    return {
      summary: {
        overallRoas: (metaTotalSpend + googleTotalSpend) > 0 ? (metaTotalConvValue + googleTotalConvValue) / (metaTotalSpend + googleTotalSpend) : 0,
        metaRoas: metaTotalSpend > 0 ? metaTotalConvValue / metaTotalSpend : 0,
        googleRoas: googleTotalSpend > 0 ? googleTotalConvValue / googleTotalSpend : 0,
        totalSpend: metaTotalSpend + googleTotalSpend,
        totalConvValue: metaTotalConvValue + googleTotalConvValue,
      },
      metaDaily, googleDaily,
      campaignRoas: [
        ...metaCampaignRoas.map(c => ({ ...c, platform: 'Meta' })),
        ...googleCampaignRoas.map(c => ({ ...c, platform: 'Google' })),
      ].sort((a, b) => (b.roas || 0) - (a.roas || 0)),
      platformComparison: [
        { platform: 'Meta', spend: metaTotalSpend, convValue: metaTotalConvValue, roas: metaTotalSpend > 0 ? metaTotalConvValue / metaTotalSpend : 0 },
        { platform: 'Google', spend: googleTotalSpend, convValue: googleTotalConvValue, roas: googleTotalSpend > 0 ? googleTotalConvValue / googleTotalSpend : 0 },
      ],
    };
  }

  /* ── Conversion Detail ───────────────────────────────────── */
  async _conversionDetail(filters) {
    const { conditions, params } = this.buildDateFilter(filters);
    const w = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    // Daily CVR trend from ga4_traffic
    const [dailyCVR] = await db.query(`
      SELECT date, SUM(sessions) as sessions, SUM(conversions) as conversions, SUM(transactions) as transactions,
             CASE WHEN SUM(sessions)>0 THEN SUM(conversions)/SUM(sessions) ELSE 0 END as cvr
      FROM ga4_traffic ${w} GROUP BY date ORDER BY date
    `, params);

    // Channel CVR
    const [channelCVR] = await db.query(`
      SELECT sessionDefaultChannelGroup as channel, SUM(sessions) as sessions,
             SUM(conversions) as conversions,
             CASE WHEN SUM(sessions)>0 THEN SUM(conversions)/SUM(sessions) ELSE 0 END as cvr
      FROM ga4_traffic ${w} GROUP BY sessionDefaultChannelGroup ORDER BY cvr DESC
    `, params);

    // Device CVR
    const [deviceCVR] = await db.query(`
      SELECT deviceCategory as device, SUM(sessions) as sessions, SUM(conversions) as conversions,
             CASE WHEN SUM(sessions)>0 THEN SUM(conversions)/SUM(sessions) ELSE 0 END as cvr
      FROM ga4_traffic ${w} GROUP BY deviceCategory ORDER BY cvr DESC
    `, params);

    // Product funnel from ga4_item_interactions
    let funnel = { listViews: 0, listClicks: 0, productViews: 0, addToCart: 0, checkout: 0, purchased: 0 };
    try {
      const fCond = [];
      const fP = [];
      if (filters.startDate) { fCond.push('date >= ?'); fP.push(filters.startDate); }
      if (filters.endDate) { fCond.push('date <= ?'); fP.push(filters.endDate); }
      const fW = fCond.length ? 'WHERE ' + fCond.join(' AND ') : '';
      const [funnelRows] = await db.query(`
        SELECT COALESCE(SUM(itemListViews),0) as listViews, COALESCE(SUM(itemListClicks),0) as listClicks,
               COALESCE(SUM(itemsViewed),0) as productViews, COALESCE(SUM(itemsAddedToCart),0) as addToCart,
               COALESCE(SUM(itemsCheckedOut),0) as checkout, COALESCE(SUM(itemsPurchased),0) as purchased
        FROM ga4_item_interactions ${fW}
      `, fP);
      funnel = funnelRows[0] || funnel;
    } catch (e) {}

    const totalSessions = dailyCVR.reduce((s, d) => s + Number(d.sessions || 0), 0);
    const totalConversions = dailyCVR.reduce((s, d) => s + Number(d.conversions || 0), 0);

    return {
      summary: {
        totalSessions, totalConversions,
        overallCVR: totalSessions > 0 ? totalConversions / totalSessions : 0,
        cartToCheckout: funnel.addToCart > 0 ? funnel.checkout / funnel.addToCart : 0,
        checkoutToPurchase: funnel.checkout > 0 ? funnel.purchased / funnel.checkout : 0,
      },
      dailyCVR, channelCVR, deviceCVR, funnel,
    };
  }

  /* ── AOV (Average Order Value) Detail ────────────────────── */
  async _aovDetail(filters) {
    const cond = [];
    const p = [];
    if (filters.startDate) { cond.push(`DATE_FORMAT(order_date, '%Y%m%d') >= ?`); p.push(filters.startDate); }
    if (filters.endDate) { cond.push(`DATE_FORMAT(order_date, '%Y%m%d') <= ?`); p.push(filters.endDate); }
    if (filters.channel) { cond.push('channel = ?'); p.push(filters.channel); }
    if (filters.device) { cond.push('device = ?'); p.push(filters.device); }
    const w = cond.length ? 'WHERE ' + cond.join(' AND ') : '';

    const [dailyAOV] = await db.query(`
      SELECT DATE(order_date) as date, AVG(order_revenue) as aov, COUNT(*) as orders,
             AVG(product_count) as avgItems
      FROM orders ${w} GROUP BY DATE(order_date) ORDER BY date
    `, p);

    const [channelAOV] = await db.query(`
      SELECT channel, AVG(order_revenue) as aov, COUNT(*) as orders, AVG(product_count) as avgItems
      FROM orders ${w} GROUP BY channel ORDER BY aov DESC
    `, p);

    const [paymentAOV] = await db.query(`
      SELECT payment_method, AVG(order_revenue) as aov, COUNT(*) as orders
      FROM orders ${w} GROUP BY payment_method ORDER BY aov DESC
    `, p);

    const [itemCountDist] = await db.query(`
      SELECT product_count as itemCount, COUNT(*) as orders, AVG(order_revenue) as aov,
             SUM(order_revenue) as totalRevenue
      FROM orders ${w} GROUP BY product_count ORDER BY product_count
    `, p);

    const [couponAOV] = await db.query(`
      SELECT
        CASE WHEN coupon_code IS NOT NULL AND coupon_code != '' THEN 'Kuponlu' ELSE 'Kuponsuz' END as type,
        AVG(order_revenue) as aov, COUNT(*) as orders, SUM(discount_amount) as totalDiscount
      FROM orders ${w} GROUP BY type
    `, p);

    const [deviceAOV] = await db.query(`
      SELECT device, AVG(order_revenue) as aov, COUNT(*) as orders
      FROM orders ${w} GROUP BY device ORDER BY aov DESC
    `, p);

    const totalOrders = dailyAOV.reduce((s, d) => s + Number(d.orders || 0), 0);
    const totalRevenue = dailyAOV.reduce((s, d) => s + Number(d.orders || 0) * Number(d.aov || 0), 0);

    return {
      summary: {
        overallAOV: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        totalOrders,
        avgItemsPerOrder: dailyAOV.length ? dailyAOV.reduce((s, d) => s + Number(d.avgItems || 0), 0) / dailyAOV.length : 0,
      },
      dailyAOV, channelAOV, paymentAOV, itemCountDist, couponAOV, deviceAOV,
    };
  }

  // ============================================================
  // YÖNETİCİ ODAKLI ENDPOINT'LER (yeni — eski metodlara dokunulmadı)
  // ============================================================

  buildOrderDateFilter(filters = {}) {
    const conditions = [];
    const params = [];
    if (filters.startDate) {
      conditions.push("DATE_FORMAT(o.order_date, '%Y%m%d') >= ?");
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push("DATE_FORMAT(o.order_date, '%Y%m%d') <= ?");
      params.push(filters.endDate);
    }
    if (filters.channel)  { conditions.push('o.channel = ?');        params.push(filters.channel); }
    if (filters.campaign) { conditions.push('o.campaign_name = ?');  params.push(filters.campaign); }
    if (filters.device)   { conditions.push('o.device = ?');         params.push(filters.device); }
    if (filters.city)     { conditions.push('o.city = ?');           params.push(filters.city); }
    // platform filter: orders'a ait kampanyanın c.platform değeri 'meta' / 'google'.
    // 'all' | undefined → filtre yok. NOT: bu koşul SQL'de `campaigns c` JOIN gerektirir.
    if (filters.platform && filters.platform !== 'all') {
      conditions.push('c.platform = ?');
      params.push(filters.platform);
    }
    return { conditions, params };
  }

  _orderPlatformExpr() {
    return `CASE
      WHEN c.platform = 'meta'   THEN 'Meta'
      WHEN c.platform = 'google' THEN 'Google'
      WHEN o.channel LIKE 'Organic%' THEN 'Organic'
      WHEN o.channel = 'Direct' OR o.campaign_name IS NULL OR o.campaign_name = '' THEN 'Direct'
      ELSE COALESCE(o.channel, 'Other')
    END`;
  }

  // A) Kampanya × Ürün — her kampanyanın top-N satılan ürünü
  async getCampaignProductBreakdown(filters = {}) {
    const cacheKey = `cpb:${JSON.stringify(filters)}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    const topCampaigns = Math.min(parseInt(filters.topCampaigns) || 10, 200);
    const limitPerCampaign = Math.min(parseInt(filters.limitPerCampaign) || 5, 1000);
    const direction = filters.direction === 'bottom' ? 'ASC' : 'DESC';

    const { conditions, params } = this.buildOrderDateFilter(filters);
    const baseWhere = ["o.campaign_name IS NOT NULL", "o.campaign_name <> ''", ...conditions].join(' AND ');

    // Top kampanyalar — ürün sıralaması değişse de kampanya listesi her zaman ciro DESC
    const [topRows] = await db.query(
      `SELECT o.campaign_name, SUM(oi.line_total) AS totalRevenue,
              SUM(oi.quantity) AS totalUnits, COUNT(DISTINCT o.order_id) AS orderCount
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.order_id
       LEFT JOIN campaigns c ON c.campaign_name = o.campaign_name
       WHERE ${baseWhere}
       GROUP BY o.campaign_name
       ORDER BY totalRevenue DESC
       LIMIT ?`,
      [...params, topCampaigns]
    );

    if (topRows.length === 0) {
      const empty = { campaigns: [] };
      await this.setCache(cacheKey, empty);
      return empty;
    }

    const campaignNames = topRows.map(r => r.campaign_name);

    // Her kampanya için top-N ürün (window function)
    const placeholders = campaignNames.map(() => '?').join(',');
    const productWhere = [`o.campaign_name IN (${placeholders})`, ...conditions].join(' AND ');
    const [productRows] = await db.query(
      `SELECT campaign_name, sku, item_name, item_brand, item_category, units_sold, revenue, rn
       FROM (
         SELECT o.campaign_name,
                oi.item_id AS sku, oi.item_name, oi.item_brand, oi.item_category,
                SUM(oi.quantity) AS units_sold,
                SUM(oi.line_total) AS revenue,
                ROW_NUMBER() OVER (PARTITION BY o.campaign_name ORDER BY SUM(oi.line_total) ${direction}) AS rn
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.order_id
         LEFT JOIN campaigns c ON c.campaign_name = o.campaign_name
         WHERE ${productWhere}
         GROUP BY o.campaign_name, oi.item_id, oi.item_name, oi.item_brand, oi.item_category
         HAVING revenue > 0
       ) ranked
       WHERE rn <= ?
       ORDER BY campaign_name, rn`,
      [...campaignNames, ...params, limitPerCampaign]
    );

    // Spend (Meta + Google), date filter ads tablolarına ayrı uygulanmalı
    const adsParams = [];
    let adsDateClause = '';
    if (filters.startDate) {
      adsDateClause += " AND DATE_FORMAT(date_start, '%Y%m%d') >= ? ";
      adsParams.push(filters.startDate);
    }
    if (filters.endDate) {
      adsDateClause += " AND DATE_FORMAT(date_start, '%Y%m%d') <= ? ";
      adsParams.push(filters.endDate);
    }
    let googleDateClause = '';
    const gParams = [];
    if (filters.startDate) {
      googleDateClause += " AND DATE_FORMAT(date, '%Y%m%d') >= ? ";
      gParams.push(filters.startDate);
    }
    if (filters.endDate) {
      googleDateClause += " AND DATE_FORMAT(date, '%Y%m%d') <= ? ";
      gParams.push(filters.endDate);
    }

    // Platform filter'a göre spend tablolarını seç
    const platformFilter = filters.platform && filters.platform !== 'all' ? filters.platform : 'all';
    let spendQuery = '';
    let spendParams = [];
    if (platformFilter === 'meta') {
      spendQuery = `SELECT campaign_name, SUM(spend) AS spend FROM meta_ads
                     WHERE campaign_name IN (${placeholders}) ${adsDateClause}
                     GROUP BY campaign_name`;
      spendParams = [...campaignNames, ...adsParams];
    } else if (platformFilter === 'google') {
      spendQuery = `SELECT campaign_name, SUM(cost_micros)/1000000 AS spend FROM google_ads
                     WHERE campaign_name IN (${placeholders}) ${googleDateClause}
                     GROUP BY campaign_name`;
      spendParams = [...campaignNames, ...gParams];
    } else {
      spendQuery = `SELECT campaign_name, SUM(spend) AS spend FROM meta_ads
                     WHERE campaign_name IN (${placeholders}) ${adsDateClause}
                     GROUP BY campaign_name
                    UNION ALL
                    SELECT campaign_name, SUM(cost_micros)/1000000 AS spend FROM google_ads
                     WHERE campaign_name IN (${placeholders}) ${googleDateClause}
                     GROUP BY campaign_name`;
      spendParams = [...campaignNames, ...adsParams, ...campaignNames, ...gParams];
    }
    const [spendRows] = await db.query(spendQuery, spendParams);

    const spendByCampaign = {};
    for (const row of spendRows) {
      spendByCampaign[row.campaign_name] = (spendByCampaign[row.campaign_name] || 0) + Number(row.spend || 0);
    }

    // campaigns master
    const [campMeta] = await db.query(
      `SELECT campaign_name, platform, objective, daily_budget, status FROM campaigns
        WHERE campaign_name IN (${placeholders})`,
      campaignNames
    );
    const metaByCampaign = {};
    for (const c of campMeta) metaByCampaign[c.campaign_name] = c;

    const productsByCampaign = {};
    for (const p of productRows) {
      if (!productsByCampaign[p.campaign_name]) productsByCampaign[p.campaign_name] = [];
      productsByCampaign[p.campaign_name].push({
        sku: p.sku, item_name: p.item_name, item_brand: p.item_brand, item_category: p.item_category,
        units_sold: Number(p.units_sold), revenue: Number(p.revenue), rank: Number(p.rn),
      });
    }

    const campaigns = topRows.map(r => {
      const spend = Number(spendByCampaign[r.campaign_name] || 0);
      const totalRevenue = Number(r.totalRevenue);
      const meta = metaByCampaign[r.campaign_name] || {};
      return {
        campaign_name: r.campaign_name,
        platform: meta.platform || null,
        objective: meta.objective || null,
        status: meta.status || null,
        spend,
        totalRevenue,
        totalUnits: Number(r.totalUnits),
        orderCount: Number(r.orderCount),
        roas: spend > 0 ? totalRevenue / spend : null,
        topProducts: productsByCampaign[r.campaign_name] || [],
      };
    });

    const result = { campaigns };
    await this.setCache(cacheKey, result);
    return result;
  }

  // B) Ürün × Kampanya — her ürünün en kazandıran kampanyaları
  async getProductCampaignBreakdown(filters = {}) {
    const cacheKey = `pcb:${JSON.stringify(filters)}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    const limitProducts = Math.min(parseInt(filters.limitProducts) || 50, 1000);
    const limitCampaignsPerProduct = Math.min(parseInt(filters.limitCampaignsPerProduct) || 5, 100);
    const sku = filters.sku || null;

    const { conditions, params } = this.buildOrderDateFilter(filters);
    const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    let productList;
    if (sku) {
      productList = [{ sku }];
      const [skuMeta] = await db.query(
        `SELECT oi.item_id AS sku, MAX(oi.item_name) AS item_name,
                MAX(oi.item_brand) AS item_brand, MAX(oi.item_category) AS item_category,
                SUM(oi.quantity) AS totalUnits, SUM(oi.line_total) AS totalRevenue,
                COUNT(DISTINCT oi.order_id) AS orderCount
         FROM order_items oi
         JOIN orders o ON o.order_id = oi.order_id
         LEFT JOIN campaigns c ON c.campaign_name = o.campaign_name
         ${whereClause ? whereClause + ' AND' : 'WHERE'} oi.item_id = ?
         GROUP BY oi.item_id`,
        [...params, sku]
      );
      if (skuMeta.length === 0) {
        const empty = { products: [] };
        await this.setCache(cacheKey, empty);
        return empty;
      }
      productList = skuMeta;
    } else {
      const [topProducts] = await db.query(
        `SELECT oi.item_id AS sku, MAX(oi.item_name) AS item_name,
                MAX(oi.item_brand) AS item_brand, MAX(oi.item_category) AS item_category,
                SUM(oi.quantity) AS totalUnits, SUM(oi.line_total) AS totalRevenue,
                COUNT(DISTINCT oi.order_id) AS orderCount
         FROM order_items oi
         JOIN orders o ON o.order_id = oi.order_id
         LEFT JOIN campaigns c ON c.campaign_name = o.campaign_name
         ${whereClause}
         GROUP BY oi.item_id
         ORDER BY totalRevenue DESC
         LIMIT ?`,
        [...params, limitProducts]
      );
      productList = topProducts;
    }

    if (productList.length === 0) {
      const empty = { products: [] };
      await this.setCache(cacheKey, empty);
      return empty;
    }

    const skus = productList.map(p => p.sku);
    const skuPlaceholders = skus.map(() => '?').join(',');
    const campaignWhere = [`oi.item_id IN (${skuPlaceholders})`, ...conditions].join(' AND ');

    const limitClause = sku ? '' : 'WHERE rn <= ?';
    const queryParams = [...skus, ...params];
    if (!sku) queryParams.push(limitCampaignsPerProduct);

    const [campRows] = await db.query(
      `SELECT sku, campaign_name, platform, revenue, units, orders, rn
       FROM (
         SELECT oi.item_id AS sku,
                COALESCE(NULLIF(o.campaign_name, ''), '(direct/organic)') AS campaign_name,
                c.platform,
                SUM(oi.line_total) AS revenue,
                SUM(oi.quantity) AS units,
                COUNT(DISTINCT o.order_id) AS orders,
                ROW_NUMBER() OVER (
                  PARTITION BY oi.item_id
                  ORDER BY SUM(oi.line_total) DESC
                ) AS rn
         FROM order_items oi
         JOIN orders o ON o.order_id = oi.order_id
         LEFT JOIN campaigns c ON c.campaign_name = o.campaign_name
         WHERE ${campaignWhere}
         GROUP BY oi.item_id, COALESCE(NULLIF(o.campaign_name, ''), '(direct/organic)'), c.platform
       ) ranked
       ${limitClause}
       ORDER BY sku, rn`,
      queryParams
    );

    const campsBySku = {};
    for (const row of campRows) {
      if (!campsBySku[row.sku]) campsBySku[row.sku] = [];
      campsBySku[row.sku].push({
        campaign_name: row.campaign_name,
        platform: row.platform,
        revenue: Number(row.revenue),
        units: Number(row.units),
        orders: Number(row.orders),
        rank: Number(row.rn),
      });
    }

    const products = productList.map(p => ({
      sku: p.sku,
      item_name: p.item_name,
      item_brand: p.item_brand,
      item_category: p.item_category,
      totalRevenue: Number(p.totalRevenue),
      totalUnits: Number(p.totalUnits),
      orderCount: Number(p.orderCount),
      campaigns: campsBySku[p.sku] || [],
    }));

    const result = { products };
    await this.setCache(cacheKey, result);
    return result;
  }

  // C) Ürün × Platform matrisi
  async getProductPlatformBreakdown(filters = {}) {
    const cacheKey = `ppb:${JSON.stringify(filters)}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    const limitProducts = Math.min(parseInt(filters.limitProducts) || 50, 200);

    const { conditions, params } = this.buildOrderDateFilter(filters);
    const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    // Top ürünler
    const [topProducts] = await db.query(
      `SELECT oi.item_id AS sku, MAX(oi.item_name) AS item_name,
              SUM(oi.line_total) AS totalRevenue, SUM(oi.quantity) AS totalUnits
       FROM order_items oi
       JOIN orders o ON o.order_id = oi.order_id
       LEFT JOIN campaigns c ON c.campaign_name = o.campaign_name
       ${whereClause}
       GROUP BY oi.item_id
       ORDER BY totalRevenue DESC
       LIMIT ?`,
      [...params, limitProducts]
    );

    if (topProducts.length === 0) {
      const empty = { products: [] };
      await this.setCache(cacheKey, empty);
      return empty;
    }

    const skus = topProducts.map(p => p.sku);
    const skuPlaceholders = skus.map(() => '?').join(',');
    const platformExpr = this._orderPlatformExpr();
    const platformWhere = [`oi.item_id IN (${skuPlaceholders})`, ...conditions].join(' AND ');

    const [platformRows] = await db.query(
      `SELECT sku, platform,
              SUM(line_total) AS revenue, SUM(quantity) AS units,
              COUNT(DISTINCT order_id) AS orders
       FROM (
         SELECT oi.item_id AS sku, ${platformExpr} AS platform,
                oi.line_total, oi.quantity, oi.order_id
         FROM order_items oi
         JOIN orders o ON o.order_id = oi.order_id
         LEFT JOIN campaigns c ON c.campaign_name = o.campaign_name
         WHERE ${platformWhere}
       ) sub
       GROUP BY sku, platform`,
      [...skus, ...params]
    );

    const matrixBySku = {};
    for (const row of platformRows) {
      if (!matrixBySku[row.sku]) matrixBySku[row.sku] = {};
      matrixBySku[row.sku][row.platform] = {
        revenue: Number(row.revenue),
        units: Number(row.units),
        orders: Number(row.orders),
      };
    }

    const allPlatforms = ['Meta', 'Google', 'Organic', 'Direct'];
    const products = topProducts.map(p => {
      const platforms = {};
      const matrix = matrixBySku[p.sku] || {};
      for (const pl of allPlatforms) {
        platforms[pl] = matrix[pl] || { revenue: 0, units: 0, orders: 0 };
      }
      // Diğer ek platformlar (Email, Referral, Other vb.)
      for (const key of Object.keys(matrix)) {
        if (!allPlatforms.includes(key)) platforms[key] = matrix[key];
      }
      return {
        sku: p.sku,
        item_name: p.item_name,
        totalRevenue: Number(p.totalRevenue),
        totalUnits: Number(p.totalUnits),
        platforms,
      };
    });

    const result = { products };
    await this.setCache(cacheKey, result);
    return result;
  }

  // D) Platform Genel Bakış — Meta/Google/Organic/Direct karşılaştırma + günlük trend
  async getPlatformOverview(filters = {}) {
    const cacheKey = `po:${JSON.stringify(filters)}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    const { conditions, params } = this.buildOrderDateFilter(filters);
    const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const platformExpr = this._orderPlatformExpr();

    // Revenue & orders by platform (orders bazlı) — sql_mode=only_full_group_by için derived table
    const [salesRows] = await db.query(
      `SELECT platform,
              SUM(order_revenue) AS revenue,
              COUNT(*) AS orders,
              SUM(product_count) AS units,
              AVG(order_revenue) AS aov
       FROM (
         SELECT ${platformExpr} AS platform,
                o.order_revenue, o.product_count
         FROM orders o
         LEFT JOIN campaigns c ON c.campaign_name = o.campaign_name
         ${whereClause}
       ) sub
       GROUP BY platform`,
      params
    );

    // Spend, impressions, clicks (paid platformlar için)
    const adsParams = [];
    let adsDateClause = '';
    if (filters.startDate) {
      adsDateClause += " AND DATE_FORMAT(date_start, '%Y%m%d') >= ? ";
      adsParams.push(filters.startDate);
    }
    if (filters.endDate) {
      adsDateClause += " AND DATE_FORMAT(date_start, '%Y%m%d') <= ? ";
      adsParams.push(filters.endDate);
    }
    let googleDateClause = '';
    const gParams = [];
    if (filters.startDate) {
      googleDateClause += " AND DATE_FORMAT(date, '%Y%m%d') >= ? ";
      gParams.push(filters.startDate);
    }
    if (filters.endDate) {
      googleDateClause += " AND DATE_FORMAT(date, '%Y%m%d') <= ? ";
      gParams.push(filters.endDate);
    }

    const [metaAds] = await db.query(
      `SELECT SUM(spend) AS spend, SUM(impressions) AS impressions, SUM(clicks) AS clicks,
              SUM(actions_purchase) AS adClaimedPurchases,
              SUM(action_values_purchase) AS adClaimedRevenue
       FROM meta_ads WHERE 1=1 ${adsDateClause}`,
      adsParams
    );
    const [googleAds] = await db.query(
      `SELECT SUM(cost_micros)/1000000 AS spend, SUM(impressions) AS impressions, SUM(clicks) AS clicks,
              SUM(conversions) AS adClaimedPurchases,
              SUM(conversions_value) AS adClaimedRevenue
       FROM google_ads WHERE 1=1 ${googleDateClause}`,
      gParams
    );

    const adSpendByPlatform = {
      Meta:    Number(metaAds[0].spend || 0),
      Google:  Number(googleAds[0].spend || 0),
      Organic: 0,
      Direct:  0,
    };
    const adImpressionsByPlatform = {
      Meta:    Number(metaAds[0].impressions || 0),
      Google:  Number(googleAds[0].impressions || 0),
    };
    const adClicksByPlatform = {
      Meta:    Number(metaAds[0].clicks || 0),
      Google:  Number(googleAds[0].clicks || 0),
    };

    const platformsMap = {};
    for (const row of salesRows) {
      platformsMap[row.platform] = {
        platform: row.platform,
        revenue: Number(row.revenue || 0),
        orders: Number(row.orders || 0),
        units: Number(row.units || 0),
        aov: Number(row.aov || 0),
      };
    }

    // 4 ana platform garantili dönsün (boşsa da)
    const corePlatforms = ['Meta', 'Google', 'Organic', 'Direct'];
    const platforms = corePlatforms.map(name => {
      const sales = platformsMap[name] || { platform: name, revenue: 0, orders: 0, units: 0, aov: 0 };
      const adSpend = adSpendByPlatform[name] || 0;
      return {
        ...sales,
        adSpend,
        impressions: adImpressionsByPlatform[name] || 0,
        clicks: adClicksByPlatform[name] || 0,
        ctr: (adImpressionsByPlatform[name] || 0) > 0
          ? (adClicksByPlatform[name] || 0) / adImpressionsByPlatform[name] : 0,
        roas: adSpend > 0 ? sales.revenue / adSpend : null,
      };
    });
    // 4 ana dışında çıkan platformlar (Email, Referral, Other vb.) ek olarak
    for (const name of Object.keys(platformsMap)) {
      if (!corePlatforms.includes(name)) {
        platforms.push({
          ...platformsMap[name],
          adSpend: 0, impressions: 0, clicks: 0, ctr: 0, roas: null,
        });
      }
    }

    // Günlük trend (per platform, daily revenue) — sql_mode=only_full_group_by için derived table
    const [trendRows] = await db.query(
      `SELECT day, platform, SUM(revenue) AS revenue
       FROM (
         SELECT DATE(o.order_date) AS day,
                ${platformExpr} AS platform,
                o.order_revenue AS revenue
         FROM orders o
         LEFT JOIN campaigns c ON c.campaign_name = o.campaign_name
         ${whereClause}
       ) sub
       GROUP BY day, platform
       ORDER BY day`,
      params
    );

    const trendMap = {};
    for (const row of trendRows) {
      const dayStr = row.day instanceof Date
        ? row.day.toISOString().slice(0, 10)
        : String(row.day).slice(0, 10);
      if (!trendMap[dayStr]) trendMap[dayStr] = { day: dayStr, Meta: 0, Google: 0, Organic: 0, Direct: 0 };
      trendMap[dayStr][row.platform] = Number(row.revenue || 0);
    }
    const dailyTrend = Object.values(trendMap).sort((a, b) => a.day.localeCompare(b.day));

    const result = { platforms, dailyTrend };
    await this.setCache(cacheKey, result);
    return result;
  }

  // E) Veritabanındaki TÜM ürünler (satışı olmasa bile) — products + sale aggregation
  async getAllProducts(filters = {}) {
    const cacheKey = `ap:${JSON.stringify(filters)}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    // products tablosundan tüm aktif ürünler + LEFT JOIN ile satış metrikleri
    const conditions = [];
    const params = [];

    // Tarih + diğer filtrelere göre satış sorgu için kullanılacak (orders'a uygulanır)
    let salesDateClause = '';
    const salesParams = [];
    if (filters.startDate) {
      salesDateClause += " AND DATE_FORMAT(o.order_date, '%Y%m%d') >= ?";
      salesParams.push(filters.startDate);
    }
    if (filters.endDate) {
      salesDateClause += " AND DATE_FORMAT(o.order_date, '%Y%m%d') <= ?";
      salesParams.push(filters.endDate);
    }
    if (filters.platform && filters.platform !== 'all') {
      salesDateClause += " AND c.platform = ?";
      salesParams.push(filters.platform);
    }
    if (filters.channel) {
      salesDateClause += " AND o.channel = ?";
      salesParams.push(filters.channel);
    }
    if (filters.device) {
      salesDateClause += " AND o.device = ?";
      salesParams.push(filters.device);
    }

    // Ürün filtreleri (products tablosuna)
    const productConds = ['p.is_active = 1'];
    if (filters.brand) {
      productConds.push('p.brand = ?');
      params.push(filters.brand);
    }
    if (filters.category) {
      productConds.push('p.category = ?');
      params.push(filters.category);
    }
    const productWhere = 'WHERE ' + productConds.join(' AND ');

    const sql = `
      SELECT
        p.sku,
        p.product_name AS item_name,
        p.brand AS item_brand,
        p.category AS item_category,
        p.sub_category,
        p.gender,
        p.price,
        p.cost_price,
        p.stock_quantity,
        COALESCE(s.totalRevenue, 0) AS totalRevenue,
        COALESCE(s.totalUnits, 0) AS totalUnits,
        COALESCE(s.orderCount, 0) AS orderCount
      FROM products p
      LEFT JOIN (
        SELECT
          oi.item_id AS sku,
          SUM(oi.line_total) AS totalRevenue,
          SUM(oi.quantity) AS totalUnits,
          COUNT(DISTINCT oi.order_id) AS orderCount
        FROM order_items oi
        JOIN orders o ON o.order_id = oi.order_id
        LEFT JOIN campaigns c ON c.campaign_name = o.campaign_name
        WHERE 1=1 ${salesDateClause}
        GROUP BY oi.item_id
      ) s ON s.sku = p.sku
      ${productWhere}
      ORDER BY totalRevenue DESC, p.sku ASC
    `;
    // Param order: salesParams (subquery) önce, sonra outer productConds params
    const allParams = [...salesParams, ...params];
    const [rows] = await db.query(sql, allParams);

    const products = rows.map(r => ({
      sku: r.sku,
      item_name: r.item_name,
      item_brand: r.item_brand,
      item_category: r.item_category,
      sub_category: r.sub_category,
      gender: r.gender,
      price: Number(r.price || 0),
      cost_price: Number(r.cost_price || 0),
      stock_quantity: Number(r.stock_quantity || 0),
      totalRevenue: Number(r.totalRevenue || 0),
      totalUnits: Number(r.totalUnits || 0),
      orderCount: Number(r.orderCount || 0),
      // Margin (kar marjı yüzdesi) — fiyat > 0 ise
      marginPercent: r.price > 0
        ? Math.round(((Number(r.price) - Number(r.cost_price || 0)) / Number(r.price)) * 100)
        : 0,
    }));

    const result = { products, total: products.length };
    await this.setCache(cacheKey, result);
    return result;
  }

  // F) Karar Merkezi — yönetici için aksiyon odaklı 6 bölüm
  async getDecisionCenter(filters = {}) {
    const cacheKey = `dc:${JSON.stringify(filters)}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    // Tarih varsayılanı: son 30 gün (anchor data maxDate'i kullanılmadığı için backend tarafında tüm veri)
    // Filter geliyorsa onu kullan, yoksa veri içindeki son 30 gün
    let { startDate, endDate } = filters;
    if (!startDate || !endDate) {
      const [maxRow] = await db.query("SELECT MAX(DATE_FORMAT(order_date, '%Y%m%d')) AS m FROM orders");
      const maxStr = maxRow[0]?.m || '20250331';
      const max = new Date(`${maxStr.slice(0, 4)}-${maxStr.slice(4, 6)}-${maxStr.slice(6, 8)}`);
      const min = new Date(max);
      min.setDate(min.getDate() - 30);
      const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
      startDate = fmt(min);
      endDate = fmt(max);
    }

    // ============ 1) Bu Ayki Durum (Goal + Forecast) ============
    // Mevcut periyot ciro
    const [currRow] = await db.query(
      `SELECT COALESCE(SUM(order_revenue), 0) AS revenue, COUNT(*) AS orders
       FROM orders WHERE DATE_FORMAT(order_date, '%Y%m%d') BETWEEN ? AND ?`,
      [startDate, endDate]
    );
    const currentRevenue = Number(currRow[0].revenue);
    const currentOrders = Number(currRow[0].orders);

    // Önceki 30 gün (karşılaştırma için)
    const sd = new Date(`${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}`);
    const prevEnd = new Date(sd); prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - 30);
    const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
    const [prevRow] = await db.query(
      `SELECT COALESCE(SUM(order_revenue), 0) AS revenue
       FROM orders WHERE DATE_FORMAT(order_date, '%Y%m%d') BETWEEN ? AND ?`,
      [fmt(prevStart), fmt(prevEnd)]
    );
    const previousRevenue = Number(prevRow[0].revenue);

    // Forecast: son 7 günlük günlük ortalama × 30
    const [last7] = await db.query(
      `SELECT DATE_FORMAT(order_date, '%Y%m%d') AS d, COALESCE(SUM(order_revenue), 0) AS r
       FROM orders WHERE DATE_FORMAT(order_date, '%Y%m%d') BETWEEN ? AND ?
       GROUP BY d ORDER BY d DESC LIMIT 7`,
      [startDate, endDate]
    );
    const last7Avg = last7.length > 0
      ? last7.reduce((s, r) => s + Number(r.r), 0) / last7.length
      : 0;
    const forecast30Days = Math.round(last7Avg * 30);

    // Goal: önceki periyodun %110'u (basit hedef)
    const goal = Math.round(previousRevenue * 1.1);
    const goalProgress = goal > 0 ? Math.round((currentRevenue / goal) * 100) : 0;

    const status = {
      currentRevenue: Math.round(currentRevenue),
      currentOrders,
      previousRevenue: Math.round(previousRevenue),
      revenueChange: previousRevenue > 0
        ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100)
        : 0,
      goal,
      goalProgress,
      forecast30Days,
      dailyAverage: Math.round(last7Avg),
    };

    // ============ 2) Para Kazandıran vs Para Yutan Ürünler ============
    // Ürün × Spend (kampanya bağlantılı): orders.campaign_name → meta_ads.action_values_purchase yerine
    // ürün-bazlı spend için: bir kampanyanın spend'ini o kampanyada satılan ürünlere oranlı dağıt
    // (oransal attribution - ürünün kampanya cirosu / kampanyanın toplam cirosu × kampanya spend'i)

    const [productRevenue] = await db.query(
      `SELECT
         oi.item_id AS sku,
         MAX(oi.item_name) AS item_name,
         MAX(oi.item_brand) AS item_brand,
         o.campaign_name,
         SUM(oi.line_total) AS productCampRevenue
       FROM order_items oi
       JOIN orders o ON o.order_id = oi.order_id
       WHERE DATE_FORMAT(o.order_date, '%Y%m%d') BETWEEN ? AND ?
         AND o.campaign_name IS NOT NULL AND o.campaign_name <> ''
       GROUP BY oi.item_id, o.campaign_name`,
      [startDate, endDate]
    );

    // Kampanyaların toplam cirosu (orantı için)
    const campTotal = {};
    productRevenue.forEach(r => {
      campTotal[r.campaign_name] = (campTotal[r.campaign_name] || 0) + Number(r.productCampRevenue);
    });

    // Kampanyaların spend'i (Meta + Google)
    const campNames = Object.keys(campTotal);
    const campSpend = {};
    if (campNames.length > 0) {
      const ph = campNames.map(() => '?').join(',');
      const [metaSpend] = await db.query(
        `SELECT campaign_name, SUM(spend) AS s FROM meta_ads
         WHERE campaign_name IN (${ph}) AND DATE_FORMAT(date_start, '%Y%m%d') BETWEEN ? AND ?
         GROUP BY campaign_name`,
        [...campNames, startDate, endDate]
      );
      const [gSpend] = await db.query(
        `SELECT campaign_name, SUM(cost_micros)/1000000 AS s FROM google_ads
         WHERE campaign_name IN (${ph}) AND DATE_FORMAT(date, '%Y%m%d') BETWEEN ? AND ?
         GROUP BY campaign_name`,
        [...campNames, startDate, endDate]
      );
      [...metaSpend, ...gSpend].forEach(r => {
        campSpend[r.campaign_name] = (campSpend[r.campaign_name] || 0) + Number(r.s || 0);
      });
    }

    // Ürün başına spend (orantısal): ∑(productCampRev / campTotal × campSpend)
    const productAgg = {};
    productRevenue.forEach(r => {
      const ct = campTotal[r.campaign_name] || 0;
      const cs = campSpend[r.campaign_name] || 0;
      const allocSpend = ct > 0 ? (Number(r.productCampRevenue) / ct) * cs : 0;
      if (!productAgg[r.sku]) {
        productAgg[r.sku] = {
          sku: r.sku, item_name: r.item_name, item_brand: r.item_brand,
          revenue: 0, spend: 0,
        };
      }
      productAgg[r.sku].revenue += Number(r.productCampRevenue);
      productAgg[r.sku].spend += allocSpend;
    });

    // Tüm ürün cirosu (kampanyalı + organik) — total_revenue için
    const [allProdRev] = await db.query(
      `SELECT oi.item_id AS sku, SUM(oi.line_total) AS total
       FROM order_items oi
       JOIN orders o ON o.order_id = oi.order_id
       WHERE DATE_FORMAT(o.order_date, '%Y%m%d') BETWEEN ? AND ?
       GROUP BY oi.item_id`,
      [startDate, endDate]
    );
    const totalProdRev = {};
    allProdRev.forEach(r => { totalProdRev[r.sku] = Number(r.total); });

    const productPL = Object.values(productAgg)
      .map(p => ({
        ...p,
        revenue: Math.round(p.revenue),
        spend: Math.round(p.spend),
        totalRevenue: Math.round(totalProdRev[p.sku] || 0),
        roas: p.spend > 0 ? p.revenue / p.spend : null,
        netProfit: Math.round((totalProdRev[p.sku] || 0) - p.spend),
      }))
      .filter(p => p.spend > 50); // gürültüyü temizle

    const profitable = [...productPL]
      .filter(p => p.roas != null && p.roas >= 3)
      .sort((a, b) => b.netProfit - a.netProfit)
      .slice(0, 5);

    const losing = [...productPL]
      .filter(p => p.roas != null && p.roas < 2)
      .sort((a, b) => a.roas - b.roas)
      .slice(0, 5);

    // Reklamsız satan yıldızlar: spend ~ 0 ama yüksek satış
    const [noAdStars] = await db.query(
      `SELECT oi.item_id AS sku, MAX(oi.item_name) AS item_name,
              MAX(oi.item_brand) AS item_brand,
              SUM(CASE WHEN o.campaign_name IS NULL OR o.campaign_name = '' THEN oi.line_total ELSE 0 END) AS organicRev,
              SUM(CASE WHEN o.campaign_name IS NOT NULL AND o.campaign_name <> '' THEN oi.line_total ELSE 0 END) AS paidRev,
              SUM(oi.line_total) AS totalRev
       FROM order_items oi JOIN orders o ON o.order_id = oi.order_id
       WHERE DATE_FORMAT(o.order_date, '%Y%m%d') BETWEEN ? AND ?
       GROUP BY oi.item_id
       HAVING totalRev > 5000 AND organicRev / totalRev > 0.7
       ORDER BY organicRev DESC LIMIT 5`,
      [startDate, endDate]
    );

    // ============ 3) Pareto 80/20 — Bütçeyi nereye yoğunlaştır ============
    const [campRevenue] = await db.query(
      `SELECT o.campaign_name, SUM(oi.line_total) AS revenue, COUNT(DISTINCT o.order_id) AS orders
       FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
       WHERE DATE_FORMAT(o.order_date, '%Y%m%d') BETWEEN ? AND ?
         AND o.campaign_name IS NOT NULL AND o.campaign_name <> ''
       GROUP BY o.campaign_name
       ORDER BY revenue DESC`,
      [startDate, endDate]
    );
    const totalCampRev = campRevenue.reduce((s, c) => s + Number(c.revenue), 0);
    let cumRev = 0;
    let paretoCount = 0;
    const paretoCamps = [];
    for (const c of campRevenue) {
      cumRev += Number(c.revenue);
      paretoCamps.push({
        campaign_name: c.campaign_name,
        revenue: Math.round(Number(c.revenue)),
        share: totalCampRev > 0 ? Math.round((Number(c.revenue) / totalCampRev) * 100) : 0,
        orders: Number(c.orders),
        spend: Math.round(campSpend[c.campaign_name] || 0),
      });
      paretoCount++;
      if (cumRev >= totalCampRev * 0.8) break;
    }
    const totalCamps = campRevenue.length;
    const pareto = {
      top: paretoCamps,
      ratio: totalCamps > 0 ? Math.round((paretoCount / totalCamps) * 100) : 0,
      totalCampaigns: totalCamps,
    };

    // ============ 4) Cart Abandonment — Kaybedilen Satışlar ============
    const [cartAbandon] = await db.query(
      `SELECT itemId AS sku, MAX(itemName) AS item_name, MAX(itemBrand) AS item_brand,
              SUM(itemsViewed) AS viewed,
              SUM(itemsAddedToCart) AS added,
              SUM(itemsCheckedOut) AS checkedOut,
              SUM(itemsPurchased) AS purchased
       FROM ga4_item_interactions
       WHERE date BETWEEN ? AND ?
       GROUP BY itemId
       HAVING added >= 10 AND added > purchased * 1.5
       ORDER BY (added - purchased) DESC LIMIT 5`,
      [startDate, endDate]
    );
    const abandonedProducts = cartAbandon.map(p => ({
      sku: p.sku, item_name: p.item_name, item_brand: p.item_brand,
      viewed: Number(p.viewed), added: Number(p.added),
      purchased: Number(p.purchased),
      lost: Number(p.added) - Number(p.purchased),
      conversionRate: p.added > 0 ? Math.round((Number(p.purchased) / Number(p.added)) * 100) : 0,
    }));

    // ============ 5) Velocity Trend — Yükselen / Sönen Ürünler ============
    // Son 7 gün vs önceki 7 gün karşılaştırması
    const last7Start = new Date(`${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6, 8)}`);
    last7Start.setDate(last7Start.getDate() - 6);
    const prev7End = new Date(last7Start); prev7End.setDate(prev7End.getDate() - 1);
    const prev7Start = new Date(prev7End); prev7Start.setDate(prev7Start.getDate() - 6);

    const [trendRows] = await db.query(
      `SELECT
         oi.item_id AS sku,
         MAX(oi.item_name) AS item_name,
         MAX(oi.item_brand) AS item_brand,
         SUM(CASE WHEN DATE_FORMAT(o.order_date,'%Y%m%d') BETWEEN ? AND ? THEN oi.quantity ELSE 0 END) AS recent7,
         SUM(CASE WHEN DATE_FORMAT(o.order_date,'%Y%m%d') BETWEEN ? AND ? THEN oi.quantity ELSE 0 END) AS prev7
       FROM order_items oi JOIN orders o ON o.order_id = oi.order_id
       WHERE DATE_FORMAT(o.order_date,'%Y%m%d') BETWEEN ? AND ?
       GROUP BY oi.item_id
       HAVING recent7 + prev7 >= 5`,
      [
        fmt(last7Start), endDate,
        fmt(prev7Start), fmt(prev7End),
        fmt(prev7Start), endDate,
      ]
    );
    const withTrend = trendRows.map(r => {
      const recent = Number(r.recent7);
      const prev = Number(r.prev7);
      const change = prev > 0 ? ((recent - prev) / prev) * 100 : (recent > 0 ? 100 : 0);
      return {
        sku: r.sku, item_name: r.item_name, item_brand: r.item_brand,
        recent7: recent, prev7: prev,
        changePercent: Math.round(change),
      };
    });
    const rising = [...withTrend]
      .filter(p => p.changePercent > 30 && p.recent7 >= 3)
      .sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
    const falling = [...withTrend]
      .filter(p => p.changePercent < -30 && p.prev7 >= 3)
      .sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);

    // ============ 6) Stock Alarms ============
    // Tükeniyor: stock_quantity < (günlük satış × 14)
    // Yığılan: stock_quantity > (günlük satış × 90)
    const periodDays = Math.max(1, Math.round((new Date(`${endDate.slice(0,4)}-${endDate.slice(4,6)}-${endDate.slice(6,8)}`) - new Date(`${startDate.slice(0,4)}-${startDate.slice(4,6)}-${startDate.slice(6,8)}`)) / 86400000));
    const [stockRows] = await db.query(
      `SELECT
         p.sku, p.product_name AS item_name, p.brand AS item_brand,
         p.stock_quantity,
         COALESCE(s.units, 0) AS unitsSold
       FROM products p
       LEFT JOIN (
         SELECT oi.item_id, SUM(oi.quantity) AS units
         FROM order_items oi JOIN orders o ON o.order_id = oi.order_id
         WHERE DATE_FORMAT(o.order_date,'%Y%m%d') BETWEEN ? AND ?
         GROUP BY oi.item_id
       ) s ON s.item_id = p.sku
       WHERE p.is_active = 1`,
      [startDate, endDate]
    );
    const withStock = stockRows.map(r => {
      const dailyVel = Number(r.unitsSold) / periodDays;
      const daysLeft = dailyVel > 0 ? Math.round(Number(r.stock_quantity) / dailyVel) : null;
      return {
        sku: r.sku, item_name: r.item_name, item_brand: r.item_brand,
        stock: Number(r.stock_quantity),
        unitsSold: Number(r.unitsSold),
        dailyVelocity: Number(dailyVel.toFixed(2)),
        daysLeft,
      };
    });
    const runningOut = withStock
      .filter(p => p.daysLeft != null && p.daysLeft <= 14 && p.unitsSold >= 3)
      .sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 5);
    const overstocked = withStock
      .filter(p => p.dailyVelocity >= 0.1 && p.daysLeft != null && p.daysLeft >= 90)
      .sort((a, b) => b.daysLeft - a.daysLeft).slice(0, 5);

    const result = {
      period: { startDate, endDate, days: periodDays },
      status,
      profitable,
      losing,
      noAdStars: noAdStars.map(s => ({
        sku: s.sku, item_name: s.item_name, item_brand: s.item_brand,
        organicRev: Math.round(Number(s.organicRev)),
        totalRev: Math.round(Number(s.totalRev)),
        organicShare: Math.round((Number(s.organicRev) / Number(s.totalRev)) * 100),
      })),
      pareto,
      abandonedProducts,
      rising,
      falling,
      runningOut,
      overstocked,
    };
    await this.setCache(cacheKey, result);
    return result;
  }
}

module.exports = KpiService;
