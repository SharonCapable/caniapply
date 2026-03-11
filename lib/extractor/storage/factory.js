const LocalStorage = require('./local');
const MongoDBStorage = require('./mongodb');
const PostgreSQLStorage = require('./postgresql');
const logger = require('../utils/logger');

/**
 * Storage Factory
 * Creates and manages storage backend instances
 */
class StorageFactory {
    constructor(config) {
        this.config = config;
        this.storage = null;
    }

    /**
     * Get or create a storage backend instance
     * @param {string} backend - Storage backend name
     * @returns {BaseStorage} Storage instance
     */
    async getStorage(backend = null) {
        const storageType = backend || this.config.storage.backend;

        // Return cached storage if exists and type matches
        if (this.storage && this.storage.name === storageType) {
            return this.storage;
        }

        // Clean up existing storage if switching
        if (this.storage) {
            await this.storage.cleanup();
        }

        // Create new storage backend
        let storage;
        switch (storageType.toLowerCase()) {
            case 'local':
            case 'filesystem':
                storage = new LocalStorage(this.config.storage);
                break;

            case 'mongodb':
            case 'mongo':
                storage = new MongoDBStorage(this.config.storage);
                break;

            case 'postgresql':
            case 'postgres':
            case 'pg':
                storage = new PostgreSQLStorage(this.config.storage);
                break;

            case 's3':
            case 'gcs':
                // TODO: Implement cloud storage backends
                throw new Error(`Cloud storage (${storageType}) not yet implemented. Use local, mongodb, or postgresql.`);

            default:
                logger.error(`Unknown storage backend: ${storageType}`);
                throw new Error(`Unsupported storage backend: ${storageType}`);
        }

        // Initialize storage
        await storage.initialize();

        // Cache storage
        this.storage = storage;

        logger.info(`Created and initialized ${storageType} storage backend`);
        return storage;
    }

    /**
     * Get all available storage backends
     * @returns {Array<string>} List of backend names
     */
    getAvailableBackends() {
        return ['local', 'mongodb', 'postgresql'];
    }

    /**
     * Check if a backend is configured
     * @param {string} backend - Backend name
     * @returns {boolean} Whether backend is configured
     */
    isBackendConfigured(backend) {
        switch (backend.toLowerCase()) {
            case 'local':
            case 'filesystem':
                return true; // Always available

            case 'mongodb':
            case 'mongo':
                return !!(this.config.storage.mongodb?.uri);

            case 'postgresql':
            case 'postgres':
            case 'pg':
                return !!(this.config.storage.postgresql?.host && this.config.storage.postgresql?.database);

            default:
                return false;
        }
    }

    /**
     * Clean up storage backend
     */
    async cleanup() {
        if (this.storage) {
            logger.info('Cleaning up storage backend...');
            await this.storage.cleanup();
            this.storage = null;
        }
    }
}

module.exports = StorageFactory;
