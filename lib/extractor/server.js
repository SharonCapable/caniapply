const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./utils/logger');
const routes = require('./api/routes');
const { authenticate, errorHandler, requestLogger } = require('./api/middleware');

const app = express();

// Trust proxy for Vercel rate limiting
if (process.env.VERCEL === '1') {
    app.set('trust proxy', 1);
}

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing (Note: Vercel has a 4.5MB limit for serverless functions)
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

// Request logging
app.use(requestLogger);

// Serve static files
app.use(express.static('public'));

// Main Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public/landing.html'));
});

app.get('/app', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public/index.html'));
});

// API routes (with authentication)
app.use('/api', authenticate, routes);

// API info endpoint (root / now serves frontend from public/index.html)
app.get('/api-info', (req, res) => {
    res.json({
        name: 'DOC Intelligence API',
        version: '1.0.0',
        description: 'Secure Document Extraction and Intelligence Service',
        endpoints: {
            health: '/api/health',
            extract: 'POST /api/extract',
            extractBuffer: 'POST /api/extract/buffer',
            getJob: 'GET /api/jobs/:jobId',
            getDocument: 'GET /api/documents/:documentId',
            listDocuments: 'GET /api/documents',
            deleteDocument: 'DELETE /api/documents/:documentId',
            stats: 'GET /api/stats'
        },
        documentation: 'See README.md for full documentation'
    });
});

// Error handling
app.use(errorHandler);

// Start server - Only if not running as a serverless function (Vercel)
if (process.env.VERCEL !== '1' && !process.env.AWS_EXECUTION_ENV) {
    const PORT = config.server.port;
    app.listen(PORT, () => {
        logger.info(`PRD Extractor API server running on port ${PORT}`);
        logger.info(`Environment: ${config.server.env}`);
        logger.info(`OCR Provider: ${config.ocr.provider}`);
        logger.info(`Storage Backend: ${config.storage.backend}`);
    });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully...');
    process.exit(0);
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    console.error('Unhandled Rejection:', reason);
});

module.exports = app;
