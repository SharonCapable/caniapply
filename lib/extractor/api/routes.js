const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const DocumentProcessor = require('../processor');
const QueueManager = require('../queue');
const config = require('../config');

const router = express.Router();

// Check if running on Vercel
const isVercel = process.env.VERCEL === '1' || !!process.env.AWS_EXECUTION_ENV;

// Configure multer for file uploads
const upload = multer({
    dest: isVercel ? '/tmp/' : 'uploads/',
    limits: {
        fileSize: config.processing.maxFileSizeMB * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase().slice(1);
        let supported = config.processing.supportedFormats.map(s => s.trim().toLowerCase());

        // Ensure common text formats are always supported
        const coreFormats = ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx', 'txt', 'md', 'csv'];
        coreFormats.forEach(f => {
            if (!supported.includes(f)) supported.push(f);
        });

        logger.debug(`Checking file: ${file.originalname}, extension: ${ext}, supported: ${supported.join(',')}`);

        if (supported.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file format: ${ext}. Supported: ${supported.join(', ')}`));
        }
    }
});

// Initialize processor and queue
const processor = new DocumentProcessor();
let queueManager = null;

// Initialize queue manager (optional, for async processing)
if (!isVercel) {
    (async () => {
        try {
            queueManager = new QueueManager();
            await queueManager.initialize();
            logger.info('Queue manager initialized for API');
        } catch (error) {
            logger.warn('Queue manager not available, using sync processing only:', error.message);
        }
    })();
} else {
    logger.info('Queue manager disabled (Vercel environment)');
}

/**
 * POST /api/extract
 * Upload and extract document (sync or async)
 */
router.post('/extract', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { async = false, ocrProvider, runAI = true } = req.body;
        const options = {
            ocrProvider,
            runAI: runAI === 'true' || runAI === true,
            filename: req.file.originalname
        };

        logger.info(`Processing upload: ${req.file.originalname} (async: ${async})`);

        if (async === 'true' && queueManager) {
            // Async processing with queue
            const job = await queueManager.addFileJob(req.file.path, options);

            res.json({
                jobId: job.id,
                status: 'queued',
                message: 'Document queued for processing',
                statusUrl: `/api/jobs/${job.id}`
            });
        } else {
            // Sync processing
            const result = await processor.processFile(req.file.path, options);

            // Clean up uploaded file
            await fs.unlink(req.file.path).catch(() => { });

            res.json(result);
        }
    } catch (error) {
        logger.error('Extract endpoint error:', error);

        // Clean up uploaded file on error
        if (req.file) {
            await fs.unlink(req.file.path).catch(() => { });
        }

        res.status(500).json({
            error: 'Document extraction failed',
            message: error.message
        });
    }
});

/**
 * POST /api/extract/buffer
 * Extract document from base64 buffer
 */
router.post('/extract/buffer', express.json({ limit: '50mb' }), async (req, res) => {
    try {
        const { buffer, filename, async = false, ocrProvider } = req.body;

        if (!buffer || !filename) {
            return res.status(400).json({ error: 'Buffer and filename are required' });
        }

        const fileBuffer = Buffer.from(buffer, 'base64');
        const options = { ocrProvider };

        if (async && queueManager) {
            const job = await queueManager.addBufferJob(fileBuffer, filename, options);

            res.json({
                jobId: job.id,
                status: 'queued',
                message: 'Document queued for processing',
                statusUrl: `/api/jobs/${job.id}`
            });
        } else {
            const result = await processor.processBuffer(fileBuffer, filename, options);
            res.json(result);
        }
    } catch (error) {
        logger.error('Extract buffer endpoint error:', error);
        res.status(500).json({
            error: 'Document extraction failed',
            message: error.message
        });
    }
});

/**
 * GET /api/jobs/:jobId
 * Get job status and result
 */
router.get('/jobs/:jobId', async (req, res) => {
    try {
        if (!queueManager) {
            return res.status(503).json({ error: 'Queue manager not available' });
        }

        const { jobId } = req.params;
        const status = await queueManager.getJobStatus(jobId);

        if (status.status === 'not_found') {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json(status);
    } catch (error) {
        logger.error('Job status endpoint error:', error);
        res.status(500).json({
            error: 'Failed to get job status',
            message: error.message
        });
    }
});

/**
 * GET /api/documents/:documentId
 * Get document by ID
 */
router.get('/documents/:documentId', async (req, res) => {
    try {
        const { documentId } = req.params;
        const document = await processor.getDocument(documentId);

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json(document);
    } catch (error) {
        logger.error('Get document endpoint error:', error);
        res.status(500).json({
            error: 'Failed to get document',
            message: error.message
        });
    }
});

/**
 * GET /api/documents
 * List documents with pagination
 */
router.get('/documents', async (req, res) => {
    try {
        const { limit = 100, offset = 0, status, documentType } = req.query;

        const documents = await processor.listDocuments({
            limit: parseInt(limit),
            offset: parseInt(offset),
            status,
            documentType
        });

        res.json({
            documents,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                count: documents.length
            }
        });
    } catch (error) {
        logger.error('List documents endpoint error:', error);
        res.status(500).json({
            error: 'Failed to list documents',
            message: error.message
        });
    }
});

/**
 * DELETE /api/documents
 * Clear all history (Delete all documents)
 */
router.delete('/documents', async (req, res) => {
    try {
        const documents = await processor.listDocuments({ limit: 1000 });
        for (const doc of documents) {
            await processor.deleteDocument(doc.documentId);
        }
        res.json({ message: 'History cleared successfully', count: documents.length });
    } catch (error) {
        logger.error('Clear history error:', error);
        res.status(500).json({
            error: 'Failed to clear history',
            message: error.message
        });
    }
});

/**
 * DELETE /api/documents/:documentId
 * Delete document
 */
router.delete('/documents/:documentId', async (req, res) => {
    try {
        const { documentId } = req.params;
        const deleted = await processor.deleteDocument(documentId);

        if (!deleted) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        logger.error('Delete document endpoint error:', error);
        res.status(500).json({
            error: 'Failed to delete document',
            message: error.message
        });
    }
});

/**
 * GET /api/stats
 * Get system statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = {
            version: '1.0.0',
            ocrProvider: config.ocr.provider,
            storageBackend: config.storage.backend
        };

        if (queueManager) {
            stats.queue = await queueManager.getQueueStats();
        }

        res.json(stats);
    } catch (error) {
        logger.error('Stats endpoint error:', error);
        res.status(500).json({
            error: 'Failed to get stats',
            message: error.message
        });
    }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
