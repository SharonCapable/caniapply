const TesseractEngine = require('./tesseract');
const GoogleVisionEngine = require('./google-vision');
const AzureCVEngine = require('./azure-cv');
const logger = require('../utils/logger');

/**
 * OCR Engine Factory
 * Creates and manages OCR engine instances
 */
class OCREngineFactory {
    constructor(config) {
        this.config = config;
        this.engines = new Map();
    }

    /**
     * Get or create an OCR engine instance
     * @param {string} provider - OCR provider name
     * @returns {BaseOCREngine} OCR engine instance
     */
    async getEngine(provider = null) {
        const engineType = provider || this.config.ocr.provider;

        // Return cached engine if exists
        if (this.engines.has(engineType)) {
            return this.engines.get(engineType);
        }

        // Create new engine
        let engine;
        switch (engineType.toLowerCase()) {
            case 'tesseract':
                engine = new TesseractEngine(this.config.ocr);
                break;

            case 'google_vision':
            case 'google-vision':
                engine = new GoogleVisionEngine(this.config.ocr);
                break;

            case 'azure_cv':
            case 'azure-cv':
            case 'azure':
                engine = new AzureCVEngine(this.config.ocr);
                break;

            default:
                logger.error(`Unknown OCR provider: ${engineType}`);
                throw new Error(`Unsupported OCR provider: ${engineType}`);
        }

        // Initialize engine
        await engine.initialize();

        // Cache engine
        this.engines.set(engineType, engine);

        logger.info(`Created and cached ${engineType} OCR engine`);
        return engine;
    }

    /**
     * Get all available OCR providers
     * @returns {Array<string>} List of provider names
     */
    getAvailableProviders() {
        return ['tesseract', 'google_vision', 'azure_cv'];
    }

    /**
     * Check if a provider is configured
     * @param {string} provider - Provider name
     * @returns {boolean} Whether provider is configured
     */
    isProviderConfigured(provider) {
        switch (provider.toLowerCase()) {
            case 'tesseract':
                return true; // Always available

            case 'google_vision':
            case 'google-vision':
                return !!(this.config.ocr.googleVision?.credentials);

            case 'azure_cv':
            case 'azure-cv':
            case 'azure':
                return !!(this.config.ocr.azureCV?.endpoint && this.config.ocr.azureCV?.key);

            default:
                return false;
        }
    }

    /**
     * Clean up all engines
     */
    async cleanup() {
        logger.info('Cleaning up all OCR engines...');
        for (const [name, engine] of this.engines.entries()) {
            try {
                await engine.cleanup();
                logger.info(`Cleaned up ${name} engine`);
            } catch (error) {
                logger.error(`Error cleaning up ${name} engine:`, error);
            }
        }
        this.engines.clear();
    }
}

module.exports = OCREngineFactory;
