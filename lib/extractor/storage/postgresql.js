const { Pool } = require('pg');
const BaseStorage = require('./base');
const logger = require('../utils/logger');

/**
 * PostgreSQL Storage Backend
 */
class PostgreSQLStorage extends BaseStorage {
    constructor(config = {}) {
        super(config);
        this.name = 'postgresql';
        this.pool = null;
        this.config = config.postgresql;
    }

    async initialize() {
        try {
            logger.info('Initializing PostgreSQL storage...');

            this.pool = new Pool({
                host: this.config.host,
                port: this.config.port,
                database: this.config.database,
                user: this.config.user,
                password: this.config.password
            });

            // Create tables if they don't exist
            await this.createTables();

            logger.info('PostgreSQL storage initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize PostgreSQL storage:', error);
            throw error;
        }
    }

    async createTables() {
        const createTableQuery = `
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        document_id VARCHAR(255) UNIQUE NOT NULL,
        filename VARCHAR(500) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        metadata JSONB,
        content JSONB,
        storage_location TEXT,
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_document_id ON documents(document_id);
      CREATE INDEX IF NOT EXISTS idx_status ON documents(status);
      CREATE INDEX IF NOT EXISTS idx_created_at ON documents(created_at);
    `;

        await this.pool.query(createTableQuery);
        logger.info('PostgreSQL tables created/verified');
    }

    async save(documentId, data) {
        try {
            const query = `
        INSERT INTO documents (document_id, filename, status, metadata, content, storage_location, error)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (document_id) 
        DO UPDATE SET 
          filename = $2,
          status = $3,
          metadata = $4,
          content = $5,
          storage_location = $6,
          error = $7,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;

            const values = [
                documentId,
                data.filename,
                data.status,
                JSON.stringify(data.metadata),
                JSON.stringify(data.content),
                data.storageLocation,
                data.error
            ];

            await this.pool.query(query, values);

            logger.info(`Document saved to PostgreSQL: ${documentId}`);

            return {
                location: `postgresql://${this.config.database}/documents/${documentId}`,
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
            const query = 'SELECT * FROM documents WHERE document_id = $1';
            const result = await this.pool.query(query, [documentId]);

            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            return {
                documentId: row.document_id,
                filename: row.filename,
                status: row.status,
                metadata: row.metadata,
                content: row.content,
                storageLocation: row.storage_location,
                error: row.error,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        } catch (error) {
            logger.error(`Failed to get document ${documentId}:`, error);
            throw error;
        }
    }

    async delete(documentId) {
        try {
            const query = 'DELETE FROM documents WHERE document_id = $1';
            const result = await this.pool.query(query, [documentId]);
            logger.info(`Document deleted: ${documentId}`);
            return result.rowCount > 0;
        } catch (error) {
            logger.error(`Failed to delete document ${documentId}:`, error);
            throw error;
        }
    }

    async exists(documentId) {
        try {
            const query = 'SELECT COUNT(*) FROM documents WHERE document_id = $1';
            const result = await this.pool.query(query, [documentId]);
            return parseInt(result.rows[0].count) > 0;
        } catch (error) {
            logger.error(`Failed to check document existence ${documentId}:`, error);
            throw error;
        }
    }

    async list(options = {}) {
        try {
            const { limit = 100, offset = 0, status, documentType } = options;

            let query = 'SELECT document_id, filename, status, metadata, created_at FROM documents WHERE 1=1';
            const params = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND status = $${paramIndex}`;
                params.push(status);
                paramIndex++;
            }

            if (documentType) {
                query += ` AND metadata->>'documentType' = $${paramIndex}`;
                params.push(documentType);
                paramIndex++;
            }

            query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(limit, offset);

            const result = await this.pool.query(query, params);

            return result.rows.map(row => ({
                documentId: row.document_id,
                filename: row.filename,
                status: row.status,
                metadata: row.metadata,
                createdAt: row.created_at
            }));
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

            const merged = {
                ...existing,
                ...updates,
                metadata: {
                    ...existing.metadata,
                    ...updates.metadata
                }
            };

            await this.save(documentId, merged);
            return merged;
        } catch (error) {
            logger.error(`Failed to update document ${documentId}:`, error);
            throw error;
        }
    }

    async cleanup() {
        if (this.pool) {
            await this.pool.end();
            logger.info('PostgreSQL connection pool closed');
        }
    }
}

module.exports = PostgreSQLStorage;
