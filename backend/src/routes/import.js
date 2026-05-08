const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');
const ImportService = require('../services/importService');
const db = require('../config/database');
const redis = require('../config/redis');
const router = express.Router();

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.csv', '.xlsx', '.xls', '.json'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowedTypes.join(', ')}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800') }
});

/**
 * @swagger
 * /api/import/upload:
 *   post:
 *     summary: Upload file for import
 *     tags: [Import]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *               targetTable: { type: string }
 */
router.post('/upload', authenticate, authorize('admin', 'marketing'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { targetTable } = req.body;
    const importService = new ImportService();
    
    // Parse the file to get preview
    const preview = await importService.parseFilePreview(req.file.path, req.file.originalname);
    
    // Create import log entry
    const [result] = await db.query(
      `INSERT INTO import_logs (file_name, file_type, target_table, total_rows, status, user_id)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [
        req.file.originalname,
        path.extname(req.file.originalname).replace('.', ''),
        targetTable || 'auto_detect',
        preview.totalRows,
        req.user.id
      ]
    );

    res.json({
      importId: result.insertId,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      totalRows: preview.totalRows,
      columns: preview.columns,
      sampleData: preview.sampleData,
      detectedTable: preview.detectedTable
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/import/preview/{importId}:
 *   get:
 *     summary: Get import preview with column mapping suggestions
 *     tags: [Import]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/preview/:importId', authenticate, async (req, res) => {
  try {
    const [logs] = await db.query('SELECT * FROM import_logs WHERE id = ?', [req.params.importId]);
    if (!logs.length) {
      return res.status(404).json({ error: 'Import not found' });
    }

    const importService = new ImportService();
    const mappingSuggestions = importService.getColumnMappingSuggestions(logs[0].target_table);

    res.json({
      import: logs[0],
      mappingSuggestions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/import/execute:
 *   post:
 *     summary: Execute data import with column mapping
 *     tags: [Import]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               importId: { type: integer }
 *               targetTable: { type: string }
 *               columnMapping: { type: object }
 *               filePath: { type: string }
 */
router.post('/execute', authenticate, authorize('admin', 'marketing'), async (req, res) => {
  try {
    const { importId, targetTable, columnMapping, filePath } = req.body;

    if (!importId || !targetTable || !filePath) {
      return res.status(400).json({ error: 'importId, targetTable, and filePath are required' });
    }

    // Update import log status
    await db.query(
      'UPDATE import_logs SET target_table = ?, status = "processing", started_at = NOW() WHERE id = ?',
      [targetTable, importId]
    );

    const importService = new ImportService();
    const result = await importService.executeImport(filePath, targetTable, columnMapping, importId);

    // Update import log with results
    await db.query(
      `UPDATE import_logs SET
        imported_rows = ?, error_rows = ?, duplicate_rows = ?,
        status = ?, completed_at = NOW(), error_message = ?
       WHERE id = ?`,
      [
        result.importedRows,
        result.errorRows,
        result.duplicateRows,
        result.errorRows > 0 && result.importedRows === 0 ? 'failed' : 'completed',
        result.errors.length ? JSON.stringify(result.errors.slice(0, 100)) : null,
        importId
      ]
    );

    // Clear all KPI cache after successful import
    const patterns = ['kpi:*', 'import:*', 'data:*'];
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }

    // Audit log section omitted because audit_log table doesn't exist

    res.json({
      success: true,
      importId,
      targetTable,
      importedRows: result.importedRows,
      errorRows: result.errorRows,
      duplicateRows: result.duplicateRows,
      errors: result.errors.slice(0, 50)
    });
  } catch (error) {
    console.error('Import execution error:', error);
    
    if (req.body.importId) {
      await db.query(
        'UPDATE import_logs SET status = "failed", error_message = ?, completed_at = NOW() WHERE id = ?',
        [error.message, req.body.importId]
      );
    }
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/import/history:
 *   get:
 *     summary: Get import history
 *     tags: [Import]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const [logs] = await db.query(
      `SELECT il.*, u.full_name as user_name
       FROM import_logs il
       LEFT JOIN users u ON il.user_id = u.id
       ORDER BY il.created_at DESC
       LIMIT 50`
    );
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/import/errors/{importId}:
 *   get:
 *     summary: Get import errors for a specific import
 *     tags: [Import]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/errors/:importId', authenticate, async (req, res) => {
  try {
    const [errors] = await db.query(
      'SELECT * FROM import_errors WHERE import_log_id = ? ORDER BY row_number LIMIT 500',
      [req.params.importId]
    );
    res.json(errors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/import/tables:
 *   get:
 *     summary: Get available target tables for import
 *     tags: [Import]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/tables', authenticate, async (req, res) => {
  const tables = [
    { id: 'ga4_traffic', name: 'GA4 Traffic', description: 'Google Analytics oturum ve trafik verileri' },
    { id: 'ga4_item_interactions', name: 'GA4 Ürün Etkileşim', description: 'GA4 ürün bazlı e-ticaret etkileşimleri' },
    { id: 'meta_ads', name: 'Meta Ads', description: 'Meta (Facebook/Instagram) reklam performansı' },
    { id: 'meta_ads_breakdowns', name: 'Meta Ads Breakdowns', description: 'Meta reklam kırılım verileri' },
    { id: 'google_ads', name: 'Google Ads', description: 'Google Ads kampanya ve reklam performansı' },
    { id: 'orders', name: 'Siparişler', description: 'E-ticaret sipariş başlık verileri' },
    { id: 'order_items', name: 'Sipariş Kalemleri', description: 'E-ticaret sipariş kalem detayları' },
    { id: 'products', name: 'Ürünler', description: 'Ürün master kataloğu' },
    { id: 'customers', name: 'Müşteriler', description: 'Müşteri master verileri (cohort, CLV)' },
    { id: 'campaigns', name: 'Kampanyalar', description: 'Kampanya master tablosu' },
    { id: 'channel_mapping', name: 'Kanal Eşleme', description: 'Source+Medium → Channel Group eşleme' },
  ];
  res.json(tables);
});

/**
 * /api/import/table-status
 * Tüm 11 tablonun anlık durumu: kayıt sayısı, son import, duplicate güvencesi.
 * Frontend bu bilgiyle "boş, doldurulabilir" / "dolu" gösterir.
 */
router.get('/table-status', authenticate, async (req, res) => {
  try {
    const db = require('../config/database');
    const TABLES = [
      { id: 'orders',                 name: 'Siparişler',           icon: '🛒', priority: 1, hasUniqueKey: true,  duplicateNote: 'order_id ile duplicate engellenir' },
      { id: 'order_items',            name: 'Sipariş Kalemleri',    icon: '📋', priority: 2, hasUniqueKey: true,  duplicateNote: 'order_id+line_id ile duplicate engellenir' },
      { id: 'products',               name: 'Ürünler',              icon: '📦', priority: 3, hasUniqueKey: true,  duplicateNote: 'sku ile duplicate engellenir' },
      { id: 'customers',              name: 'Müşteriler',           icon: '👥', priority: 4, hasUniqueKey: true,  duplicateNote: 'customer_id ile duplicate engellenir' },
      { id: 'campaigns',              name: 'Kampanyalar',          icon: '📣', priority: 5, hasUniqueKey: true,  duplicateNote: 'campaign_name ile duplicate engellenir' },
      { id: 'meta_ads',               name: 'Meta Ads',             icon: '📘', priority: 6, hasUniqueKey: false, duplicateNote: 'Aynı dosyayı 2 kez yüklerseniz kayıtlar tekrar girer (event tablosu)' },
      { id: 'google_ads',             name: 'Google Ads',           icon: '🔵', priority: 7, hasUniqueKey: false, duplicateNote: 'Aynı dosyayı 2 kez yüklerseniz kayıtlar tekrar girer (event tablosu)' },
      { id: 'meta_ads_breakdowns',    name: 'Meta Ads Kırılımlar',  icon: '📊', priority: 8, hasUniqueKey: false, duplicateNote: 'Event tablosu — duplicate engelleyici yok' },
      { id: 'ga4_traffic',            name: 'GA4 Trafik',           icon: '📈', priority: 9, hasUniqueKey: false, duplicateNote: 'Event tablosu — duplicate engelleyici yok' },
      { id: 'ga4_item_interactions',  name: 'GA4 Ürün Etkileşim',   icon: '🛍️', priority: 10, hasUniqueKey: false, duplicateNote: 'Event tablosu — duplicate engelleyici yok' },
      { id: 'channel_mapping',        name: 'Kanal Eşleme',         icon: '🔗', priority: 11, hasUniqueKey: true,  duplicateNote: 'source+medium ile duplicate engellenir' },
    ];

    // Her tablo için kayıt sayısı + son import
    const results = [];
    for (const t of TABLES) {
      try {
        const [countRows] = await db.query(`SELECT COUNT(*) AS c FROM \`${t.id}\``);
        const [lastImport] = await db.query(
          `SELECT created_at, imported_rows, duplicate_rows, status
           FROM import_logs WHERE target_table = ? ORDER BY created_at DESC LIMIT 1`,
          [t.id]
        );
        const rowCount = Number(countRows[0]?.c || 0);
        results.push({
          ...t,
          rowCount,
          status: rowCount === 0 ? 'empty' : rowCount < 100 ? 'low' : 'filled',
          lastImport: lastImport[0] || null,
        });
      } catch (err) {
        // Tablo bulunamadıysa skip
        results.push({ ...t, rowCount: 0, status: 'unknown', error: err.message });
      }
    }

    res.json({ tables: results });
  } catch (error) {
    console.error('table-status error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
