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
}

module.exports = KpiService;
