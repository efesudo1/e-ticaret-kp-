const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../config/database');
const router = express.Router();

/**
 * @swagger
 * /api/filters/options:
 *   get:
 *     summary: Get all available filter options
 *     tags: [Filters]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/options', authenticate, async (req, res) => {
  try {
    // Channels
    const [channels] = await db.query(
      'SELECT DISTINCT sessionDefaultChannelGroup as value FROM ga4_traffic WHERE sessionDefaultChannelGroup IS NOT NULL ORDER BY value'
    );

    // Campaigns
    const [campaigns] = await db.query(
      'SELECT DISTINCT campaign_name as value, platform FROM campaigns ORDER BY campaign_name'
    );

    // Devices
    const [devices] = await db.query(
      'SELECT DISTINCT deviceCategory as value FROM ga4_traffic WHERE deviceCategory IS NOT NULL ORDER BY value'
    );

    // Cities
    const [cities] = await db.query(
      'SELECT DISTINCT city as value FROM orders WHERE city IS NOT NULL ORDER BY value LIMIT 100'
    );

    // Date range
    const [dateRange] = await db.query(`
      SELECT
        MIN(min_date) as minDate,
        MAX(max_date) as maxDate
      FROM (
        SELECT MIN(date) as min_date, MAX(date) as max_date FROM ga4_traffic
        UNION ALL
        SELECT MIN(DATE_FORMAT(order_date, '%Y%m%d')), MAX(DATE_FORMAT(order_date, '%Y%m%d')) FROM orders
      ) dates
    `);

    // Brands
    const [brands] = await db.query(
      'SELECT DISTINCT brand as value FROM products WHERE brand IS NOT NULL ORDER BY value'
    );

    // Categories
    const [categories] = await db.query(
      'SELECT DISTINCT category as value FROM products WHERE category IS NOT NULL ORDER BY value'
    );

    // Order statuses
    const [statuses] = await db.query(
      'SELECT DISTINCT order_status as value FROM orders WHERE order_status IS NOT NULL ORDER BY value'
    );

    res.json({
      channels: channels.map(r => r.value),
      campaigns: campaigns.map(r => ({ name: r.value, platform: r.platform })),
      devices: devices.map(r => r.value),
      cities: cities.map(r => r.value),
      dateRange: dateRange[0],
      brands: brands.map(r => r.value),
      categories: categories.map(r => r.value),
      orderStatuses: statuses.map(r => r.value)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
