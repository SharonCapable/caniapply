const mongoose = require('mongoose');
const BaseStorage = require('./base');
const logger = require('../utils/logger');

// Document Schema
const documentSchema = new mongoose.Schema({
    documentId: { type: String, required: true, unique: true, index: true },
    filename: { type: String, required: true },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    metadata: {
        pages: Number,
        language: String,
        documentType: String,
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
        processingTime: Number
    },
    content: {
        fullText: String,
        pages: [{
            pageNumber: Number,
            text: String,
            confidence: Number
        }],
        tables: [mongoose.Schema.Types.Mixed],
        forms: [mongoose.Schema.Types.Mixed],
        entities: mongoose.Schema.Types.Mixed
    },
    storageLocation: String,
    error: String
}, {
    timestamps: true
});

/**
 * MongoDB Storage Backend
 */
class MongoDBStorage extends BaseStorage {
    constructor(config = {}) {
        super(config);
        this.name = 'mongodb';
        this.uri = config.mongodb?.uri;
        this.dbName = config.mongodb?.dbName;
        this.connection = null;
        this.Document = null;
    }

    async initialize() {
        try {
            logger.info(`Initializing MongoDB storage: ${this.uri}`);

            this.connection = await mongoose.createConnection(this.uri, {
                dbName: this.dbName,
                useNewUrlParser: true,
                useUnifiedTopology: true
            });

            this.Document = this.connection.model('Document', documentSchema);

            logger.info('MongoDB storage initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize MongoDB storage:', error);
            throw error;
        }
    }

    async save(documentId, data) {
        try {
            const document = await this.Document.findOneAndUpdate(
                { documentId },
                {
                    documentId,
                    ...data,
                    'metadata.updatedAt': new Date()
                },
                { upsert: true, new: true }
            );

            logger.info(`Document saved to MongoDB: ${documentId}`);

            return {
                location: `mongodb://${this.dbName}/documents/${documentId}`,
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
            const document = await this.Document.findOne({ documentId }).lean();
            return document;
        } catch (error) {
            logger.error(`Failed to get document ${documentId}:`, error);
            throw error;
        }
    }

    async delete(documentId) {
        try {
            const result = await this.Document.deleteOne({ documentId });
            logger.info(`Document deleted: ${documentId}`);
            return result.deletedCount > 0;
        } catch (error) {
            logger.error(`Failed to delete document ${documentId}:`, error);
            throw error;
        }
    }

    async exists(documentId) {
        try {
            const count = await this.Document.countDocuments({ documentId });
            return count > 0;
        } catch (error) {
            logger.error(`Failed to check document existence ${documentId}:`, error);
            throw error;
        }
    }

    async list(options = {}) {
        try {
            const { limit = 100, offset = 0, status, documentType } = options;

            const query = {};
            if (status) query.status = status;
            if (documentType) query['metadata.documentType'] = documentType;

            const documents = await this.Document
                .find(query)
                .select('documentId filename status metadata')
                .skip(offset)
                .limit(limit)
                .sort({ 'metadata.createdAt': -1 })
                .lean();

            return documents;
        } catch (error) {
            logger.error('Failed to list documents:', error);
            throw error;
        }
    }

    async update(documentId, updates) {
        try {
            const document = await this.Document.findOneAndUpdate(
                { documentId },
                {
                    ...updates,
                    'metadata.updatedAt': new Date()
                },
                { new: true }
            ).lean();

            if (!document) {
                throw new Error(`Document not found: ${documentId}`);
            }

            return document;
        } catch (error) {
            logger.error(`Failed to update document ${documentId}:`, error);
            throw error;
        }
    }

    async cleanup() {
        if (this.connection) {
            await this.connection.close();
            logger.info('MongoDB connection closed');
        }
    }
}

module.exports = MongoDBStorage;
