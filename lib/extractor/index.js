const DocumentProcessor = require('./processor');
const QueueManager = require('./queue');
const config = require('./config');

/**
 * Main entry point for library usage
 */
class DocumentExtractor {
    constructor(options = {}) {
        this.config = { ...config, ...options };
        this.processor = new DocumentProcessor(this.config);
        this.queueManager = null;
    }

    /**
     * Initialize the extractor (optional for sync usage)
     */
    async initialize() {
        // Initialize queue manager if needed
        if (this.config.useQueue) {
            this.queueManager = new QueueManager();
            await this.queueManager.initialize();
        }
    }

    /**
     * Extract text from a file
     * @param {string} filePath - Path to the file
     * @param {Object} options - Extraction options
     * @returns {Promise<Object>} Extraction result
     */
    async extract(filePath, options = {}) {
        return await this.processor.processFile(filePath, options);
    }

    /**
     * Extract text from a buffer
     * @param {Buffer} buffer - File buffer
     * @param {string} filename - Original filename
     * @param {Object} options - Extraction options
     * @returns {Promise<Object>} Extraction result
     */
    async extractFromBuffer(buffer, filename, options = {}) {
        return await this.processor.processBuffer(buffer, filename, options);
    }

    /**
     * Extract text asynchronously using queue
     * @param {string} filePath - Path to the file
     * @param {Object} options - Extraction options
     * @returns {Promise<Object>} Job information
     */
    async extractAsync(filePath, options = {}) {
        if (!this.queueManager) {
            throw new Error('Queue manager not initialized. Call initialize() first or set useQueue: true');
        }
        return await this.queueManager.addFileJob(filePath, options);
    }

    /**
     * Get document by ID
     * @param {string} documentId - Document ID
     * @returns {Promise<Object>} Document data
     */
    async getDocument(documentId) {
        return await this.processor.getDocument(documentId);
    }

    /**
     * List documents
     * @param {Object} options - Query options
     * @returns {Promise<Array>} List of documents
     */
    async listDocuments(options = {}) {
        return await this.processor.listDocuments(options);
    }

    /**
     * Delete document
     * @param {string} documentId - Document ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteDocument(documentId) {
        return await this.processor.deleteDocument(documentId);
    }

    /**
     * Get job status (for async processing)
     * @param {string} jobId - Job ID
     * @returns {Promise<Object>} Job status
     */
    async getJobStatus(jobId) {
        if (!this.queueManager) {
            throw new Error('Queue manager not initialized');
        }
        return await this.queueManager.getJobStatus(jobId);
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        await this.processor.cleanup();
        if (this.queueManager) {
            await this.queueManager.cleanup();
        }
    }
}

module.exports = {
    DocumentExtractor,
    DocumentProcessor,
    QueueManager,
    config
};
