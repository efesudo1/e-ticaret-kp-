require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');
const fs = require('fs');

const db = require('./config/database');
const redis = require('./config/redis');
const logger = require('./config/logger');

// Route imports
const authRoutes = require('./routes/auth');
const importRoutes = require('./routes/import');
const kpiRoutes = require('./routes/kpi');
const dataRoutes = require('./routes/data');
const filterRoutes = require('./routes/filters');
const reportRoutes = require('./routes/reports');
const chatRoutes = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Frontend her sayfada birden fazla endpoint çağırır + filtre değişiklikleri
  // 1 yönetici 15dk'da rahatça 1500 istek atabilir
  max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : 2000,
  message: { error: 'Çok fazla istek gönderildi, lütfen biraz bekleyin.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Swagger documentation
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'KPI Dashboard API',
      version: '1.0.0',
      description: 'Marketing & E-Commerce KPI Dashboard REST API',
    },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes
const { authenticate } = require('./middleware/auth');
const { requirePermission, requirePermissionForMutations } = require('./middleware/permissions');

app.use('/api/auth', authRoutes);
// Import flow'a dokunmadan, sadece mount level'da permission middleware ile sar.
// Viewer GET edebilir (sayfayı açabilir) ama POST/PUT/DELETE yapamaz.
app.use('/api/import', authenticate, requirePermissionForMutations('import_data'), importRoutes);
app.use('/api/kpi', kpiRoutes);
// /api/data GET'leri zaten authenticate ister; mutating (DELETE clear) için permission koy
app.use('/api/data', authenticate, requirePermissionForMutations('import_data'), dataRoutes);
app.use('/api/filters', filterRoutes);
// Excel raporu sadece export_excel izni olanlar için
app.use('/api/reports', authenticate, requirePermission('export_excel'), reportRoutes);
// Chatbot
app.use('/api/chat', chatRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const [dbResult] = await db.query('SELECT 1 as ok');
    const redisOk = redis.status === 'ready';
    res.json({
      status: 'ok',
      database: dbResult[0].ok === 1 ? 'connected' : 'error',
      redis: redisOk ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl}`);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 KPI Dashboard API running on port ${PORT}`);
  logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
});

module.exports = app;
