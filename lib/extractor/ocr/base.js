/**
 * Base OCR Engine class
 * All OCR providers should extend this class
 */
class BaseOCREngine {
    constructor(config = {}) {
        this.config = config;
        this.name = 'base';
    }

    /**
     * Initialize the OCR engine
     * Override this method to perform any setup
     */
    async initialize() {
        throw new Error('initialize() must be implemented by subclass');
    }

    /**
     * Perform OCR on a file
     * @param {string} filePath - Path to the file
     * @param {Object} options - OCR options
     * @returns {Promise<Object>} OCR result
     */
    async extractText(filePath, options = {}) {
        throw new Error('extractText() must be implemented by subclass');
    }

    /**
     * Perform OCR on a buffer
     * @param {Buffer} buffer - File buffer
     * @param {Object} options - OCR options
     * @returns {Promise<Object>} OCR result
     */
    async extractTextFromBuffer(buffer, options = {}) {
        throw new Error('extractTextFromBuffer() must be implemented by subclass');
    }

    /**
     * Get supported languages
     * @returns {Array<string>} List of supported language codes
     */
    getSupportedLanguages() {
        return ['eng'];
    }

    /**
     * Validate OCR result
     * @param {Object} result - OCR result
     * @returns {boolean} Whether result is valid
     */
    validateResult(result) {
        return result && result.text && result.confidence >= this.config.confidenceThreshold;
    }

    /**
     * Format OCR result to standard format
     * @param {Object} rawResult - Raw OCR result
     * @returns {Object} Formatted result
     */
    formatResult(rawResult) {
        return {
            text: rawResult.text || '',
            confidence: rawResult.confidence || 0,
            pages: rawResult.pages || [],
            metadata: {
                engine: this.name,
                language: rawResult.language || 'unknown',
                processingTime: rawResult.processingTime || 0
            }
        };
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        // Override if needed
    }
}

module.exports = BaseOCREngine;
