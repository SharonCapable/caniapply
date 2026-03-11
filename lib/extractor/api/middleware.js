const logger = require('../utils/logger');
const config = require('../config');

/**
 * Authentication middleware
 */
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header provided' });
    }

    const token = authHeader.replace('Bearer ', '');

    if (token !== config.server.apiKey) {
        logger.warn(`Invalid API key attempt: ${token.substring(0, 10)}...`);
        return res.status(401).json({ error: 'Invalid API key' });
    }

    next();
}

/**
 * Error handling middleware
 */
function errorHandler(err, req, res, next) {
    logger.error('Unhandled error:', err);

    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(config.server.env === 'development' && { stack: err.stack })
    });
}

/**
 * Request logging middleware
 */
function requestLogger(req, res, next) {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
    });

    next();
}

/**
 * CORS middleware (if needed)
 */
function corsHandler(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
}

module.exports = {
    authenticate,
    errorHandler,
    requestLogger,
    corsHandler
};
