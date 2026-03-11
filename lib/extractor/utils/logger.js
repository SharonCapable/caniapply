const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Check if running on Vercel
const isVercel = process.env.VERCEL === '1' || !!process.env.AWS_EXECUTION_ENV;

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

const transports = [
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    })
];

// Only use file logging if NOT on Vercel
if (!isVercel) {
    try {
        const logsDir = path.dirname(config.logging.file);
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        transports.push(
            new winston.transports.File({
                filename: config.logging.file,
                maxsize: 5242880, // 5MB
                maxFiles: 5
            })
        );

        transports.push(
            new winston.transports.File({
                filename: path.join(logsDir, 'error.log'),
                level: 'error',
                maxsize: 5242880,
                maxFiles: 5
            })
        );
    } catch (err) {
        console.error('Failed to initialize file logging, falling back to console:', err.message);
    }
}

// Create logger instance
const logger = winston.createLogger({
    level: config.logging.level,
    format: logFormat,
    defaultMeta: { service: 'prd-extractor' },
    transports: transports
});

module.exports = logger;
