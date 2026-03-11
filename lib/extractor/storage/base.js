/**
 * Base Storage Backend class
 * All storage providers should extend this class
 */
class BaseStorage {
    constructor(config = {}) {
        this.config = config;
        this.name = 'base';
    }

    /**
     * Initialize the storage backend
     */
    async initialize() {
        throw new Error('initialize() must be implemented by subclass');
    }

    /**
     * Save document data
     * @param {string} documentId - Unique document identifier
     * @param {Object} data - Document data to save
     * @returns {Promise<Object>} Storage location info
     */
    async save(documentId, data) {
        throw new Error('save() must be implemented by subclass');
    }

    /**
     * Retrieve document data
     * @param {string} documentId - Document identifier
     * @returns {Promise<Object>} Document data
     */
    async get(documentId) {
        throw new Error('get() must be implemented by subclass');
    }

    /**
     * Delete document data
     * @param {string} documentId - Document identifier
     * @returns {Promise<boolean>} Success status
     */
    async delete(documentId) {
        throw new Error('delete() must be implemented by subclass');
    }

    /**
     * Check if document exists
     * @param {string} documentId - Document identifier
     * @returns {Promise<boolean>} Existence status
     */
    async exists(documentId) {
        throw new Error('exists() must be implemented by subclass');
    }

    /**
     * List all documents
     * @param {Object} options - Query options
     * @returns {Promise<Array>} List of documents
     */
    async list(options = {}) {
        throw new Error('list() must be implemented by subclass');
    }

    /**
     * Update document data
     * @param {string} documentId - Document identifier
     * @param {Object} updates - Data to update
     * @returns {Promise<Object>} Updated document
     */
    async update(documentId, updates) {
        throw new Error('update() must be implemented by subclass');
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        // Override if needed
    }
}

module.exports = BaseStorage;
