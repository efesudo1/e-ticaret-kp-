const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../config/database');
const router = express.Router();

/**
 * @swagger
 * /api/data/{table}:
 *   get:
 *     summary: Get data from a table with pagination
 *     tags: [Data]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:table', authenticate, async (req, res) => {
  try {
    const allowedTables = [
      'ga4_traffic', 'ga4_item_interactions', 'meta_ads', 'meta_ads_breakdowns',
      'google_ads', 'orders', 'order_items', 'products', 'customers',
      'campaigns', 'channel_mapping'
    ];

    const { table } = req.params;
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const offset = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Count total
    const [countResult] = await db.query(`SELECT COUNT(*) as total FROM \`${table}\``);
    const total = countResult[0].total;

    // Get data
    const [rows] = await db.query(
      `SELECT * FROM \`${table}\` ORDER BY \`${sortBy}\` ${sortOrder} LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/data/{table}/count:
 *   get:
 *     summary: Get row count for a table
 *     tags: [Data]
 */
router.get('/:table/count', authenticate, async (req, res) => {
  try {
    const allowedTables = [
      'ga4_traffic', 'ga4_item_interactions', 'meta_ads', 'meta_ads_breakdowns',
      'google_ads', 'orders', 'order_items', 'products', 'customers',
      'campaigns', 'channel_mapping'
    ];

    const { table } = req.params;
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    const [result] = await db.query(`SELECT COUNT(*) as count FROM \`${table}\``);
    res.json({ table, count: result[0].count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/data/overview/tables:
 *   get:
 *     summary: Get overview of all data tables with row counts
 *     tags: [Data]
 */
router.get('/overview/tables', authenticate, async (req, res) => {
  try {
    const tables = [
      'ga4_traffic', 'ga4_item_interactions', 'meta_ads', 'meta_ads_breakdowns',
      'google_ads', 'orders', 'order_items', 'products', 'customers',
      'campaigns', 'channel_mapping'
    ];

    const overview = [];
    for (const table of tables) {
      const [result] = await db.query(`SELECT COUNT(*) as count FROM \`${table}\``);
      overview.push({ table, count: result[0].count });
    }

    res.json(overview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/data/{table}/clear:
 *   delete:
 *     summary: Clear all data from a table (admin only)
 *     tags: [Data]
 *     security: [{ bearerAuth: [] }]
 */
router.delete('/:table/clear', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can clear table data' });
    }

    const allowedTables = [
      'ga4_traffic', 'ga4_item_interactions', 'meta_ads', 'meta_ads_breakdowns',
      'google_ads', 'orders', 'order_items', 'products', 'customers',
      'campaigns', 'channel_mapping'
    ];

    const { table } = req.params;
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    // Disable foreign key checks temporarily to allow truncating tables with relationships
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    await db.query(`TRUNCATE TABLE \`${table}\``);
    await db.query('SET FOREIGN_KEY_CHECKS = 1');

    res.json({ message: `${table} tablosu başarıyla temizlendi.` });
  } catch (error) {
    // Make sure we re-enable foreign keys if an error occurs
    await db.query('SET FOREIGN_KEY_CHECKS = 1').catch(e => console.error(e));
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
