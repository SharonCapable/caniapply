const Bull = require('bull');
const logger = require('../utils/logger');
const config = require('../config');
const DocumentProcessor = require('../processor');

/**
 * Queue Manager for async document processing
 */
class QueueManager {
    constructor() {
        this.queue = null;
        this.processor = new DocumentProcessor();
    }

    async initialize() {
        try {
            logger.info('Initializing queue manager...');

            this.queue = new Bull('document-processing', {
                redis: {
                    host: config.redis.host,
                    port: config.redis.port,
                    password: config.redis.password
                },
                settings: {
                    maxStalledCount: 3,
                    stalledInterval: 30000
                }
            });

            // Set up job processor
            this.queue.process(config.processing.maxConcurrentJobs, async (job) => {
                return await this.processJob(job);
            });

            // Set up event listeners
            this.setupEventListeners();

            logger.info('Queue manager initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize queue manager:', error);
            throw error;
        }
    }

    setupEventListeners() {
        this.queue.on('completed', (job, result) => {
            logger.info(`Job ${job.id} completed successfully`);
        });

        this.queue.on('failed', (job, error) => {
            logger.error(`Job ${job.id} failed:`, error);
        });

        this.queue.on('stalled', (job) => {
            logger.warn(`Job ${job.id} stalled`);
        });

        this.queue.on('progress', (job, progress) => {
            logger.debug(`Job ${job.id} progress: ${progress}%`);
        });
    }

    async processJob(job) {
        const { type, data } = job.data;

        logger.info(`Processing job ${job.id} of type: ${type}`);

        try {
            let result;

            switch (type) {
                case 'file':
                    result = await this.processor.processFile(data.filePath, data.options);
                    break;

                case 'buffer':
                    result = await this.processor.processBuffer(
                        Buffer.from(data.buffer),
                        data.filename,
                        data.options
                    );
                    break;

                default:
                    throw new Error(`Unknown job type: ${type}`);
            }

            return result;
        } catch (error) {
            logger.error(`Job ${job.id} processing failed:`, error);
            throw error;
        }
    }

    async addFileJob(filePath, options = {}) {
        const job = await this.queue.add(
            {
                type: 'file',
                data: { filePath, options }
            },
            {
                timeout: config.processing.jobTimeoutMs,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                }
            }
        );

        logger.info(`Added file job: ${job.id} for ${filePath}`);
        return job;
    }

    async addBufferJob(buffer, filename, options = {}) {
        const job = await this.queue.add(
            {
                type: 'buffer',
                data: {
                    buffer: buffer.toString('base64'),
                    filename,
                    options
                }
            },
            {
                timeout: config.processing.jobTimeoutMs,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                }
            }
        );

        logger.info(`Added buffer job: ${job.id} for ${filename}`);
        return job;
    }

    async getJob(jobId) {
        return await this.queue.getJob(jobId);
    }

    async getJobStatus(jobId) {
        const job = await this.getJob(jobId);

        if (!job) {
            return { status: 'not_found' };
        }

        const state = await job.getState();
        const progress = job.progress();

        return {
            id: job.id,
            status: state,
            progress,
            data: job.data,
            result: job.returnvalue,
            failedReason: job.failedReason,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn
        };
    }

    async getQueueStats() {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            this.queue.getWaitingCount(),
            this.queue.getActiveCount(),
            this.queue.getCompletedCount(),
            this.queue.getFailedCount(),
            this.queue.getDelayedCount()
        ]);

        return {
            waiting,
            active,
            completed,
            failed,
            delayed,
            total: waiting + active + completed + failed + delayed
        };
    }

    async cleanup() {
        if (this.queue) {
            await this.queue.close();
            logger.info('Queue manager closed');
        }
        await this.processor.cleanup();
    }
}

module.exports = QueueManager;
