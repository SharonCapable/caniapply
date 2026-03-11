const fs = require('fs').promises;
const path = require('path');
const BaseStorage = require('./base');
const logger = require('../utils/logger');

// Check if running on Vercel
const isVercel = process.env.VERCEL === '1' || !!process.env.AWS_EXECUTION_ENV;

/**
 * Local Filesystem Storage Backend
 */
class LocalStorage extends BaseStorage {
    constructor(config = {}) {
        super(config);
        this.name = 'local';
        this.storagePath = isVercel ? '/tmp/storage' : (config.local?.path || './storage');
    }

    async initialize() {
        try {
            logger.info(`Initializing local storage at: ${this.storagePath}`);
            // Check if path is just /tmp or already exists to avoid unnecessary mkdir calls
            if (this.storagePath !== '/tmp') {
                await fs.mkdir(this.storagePath, { recursive: true });
            }
            logger.info('Local storage initialized successfully');
        } catch (error) {
            // If error is EROFS (Read-only file system), we log but don't crash if on Vercel
            if (isVercel && error.code === 'EROFS') {
                logger.warn('Read-only filesystem detected on Vercel, continuing with restricted mode');
                return;
            }
            logger.error('Failed to initialize local storage:', error);
            throw error;
        }
    }

    async save(documentId, data) {
        try {
            const filePath = this.getDocumentPath(documentId);
            await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');

            logger.info(`Document saved to local storage: ${documentId}`);

            return {
                location: filePath,
                backend: this.name,
                documentId
            };
        } catch (error) {
            logger.error(`Failed to save document ${documentId}:`, error);
            throw error;
        }
    }

    async get(documentId) {
        try {
            const filePath = this.getDocumentPath(documentId);
            const content = await fs.readFile(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.warn(`Document not found: ${documentId}`);
                return null;
            }
            logger.error(`Failed to get document ${documentId}:`, error);
            throw error;
        }
    }

    async delete(documentId) {
        try {
            const filePath = this.getDocumentPath(documentId);
            await fs.unlink(filePath);
            logger.info(`Document deleted: ${documentId}`);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.warn(`Document not found for deletion: ${documentId}`);
                return false;
            }
            logger.error(`Failed to delete document ${documentId}:`, error);
            throw error;
        }
    }

    async exists(documentId) {
        try {
            const filePath = this.getDocumentPath(documentId);
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async list(options = {}) {
        try {
            const files = await fs.readdir(this.storagePath);
            const jsonFiles = files.filter(f => f.endsWith('.json'));

            const documents = [];
            for (const file of jsonFiles) {
                const documentId = path.basename(file, '.json');
                const data = await this.get(documentId);
                if (data) {
                    documents.push({
                        documentId,
                        filename: data.filename,
                        ...data.metadata
                    });
                }
            }

            // Sort by createdAt descending
            documents.sort((a, b) => {
                const dateA = new Date(a.createdAt || 0);
                const dateB = new Date(b.createdAt || 0);
                return dateB - dateA;
            });

            // Apply pagination
            const { limit = 100, offset = 0 } = options;
            return documents.slice(offset, offset + limit);
        } catch (error) {
            logger.error('Failed to list documents:', error);
            throw error;
        }
    }

    async update(documentId, updates) {
        try {
            const existing = await this.get(documentId);
            if (!existing) {
                throw new Error(`Document not found: ${documentId}`);
            }

            const updated = {
                ...existing,
                ...updates,
                metadata: {
                    ...existing.metadata,
                    ...updates.metadata,
                    updatedAt: new Date().toISOString()
                }
            };

            await this.save(documentId, updated);
            return updated;
        } catch (error) {
            logger.error(`Failed to update document ${documentId}:`, error);
            throw error;
        }
    }

    getDocumentPath(documentId) {
        return path.join(this.storagePath, `${documentId}.json`);
    }

    async cleanup() {
        logger.info('Local storage cleanup complete');
    }
}

module.exports = LocalStorage;
