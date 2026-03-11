const vision = require('@google-cloud/vision');
const BaseOCREngine = require('./base');
const logger = require('../utils/logger');
const fs = require('fs').promises;

/**
 * Google Cloud Vision OCR Engine
 * High-quality cloud-based OCR
 */
class GoogleVisionEngine extends BaseOCREngine {
    constructor(config = {}) {
        super(config);
        this.name = 'google_vision';
        this.client = null;
    }

    async initialize() {
        try {
            logger.info('Initializing Google Cloud Vision OCR engine...');

            const clientConfig = {};
            if (this.config.googleVision?.credentials) {
                clientConfig.keyFilename = this.config.googleVision.credentials;
            }
            if (this.config.googleVision?.projectId) {
                clientConfig.projectId = this.config.googleVision.projectId;
            }

            this.client = new vision.ImageAnnotatorClient(clientConfig);
            logger.info('Google Cloud Vision OCR engine initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Google Cloud Vision:', error);
            throw error;
        }
    }

    async extractText(filePath, options = {}) {
        const startTime = Date.now();

        try {
            if (!this.client) {
                await this.initialize();
            }

            logger.info(`Starting Google Vision OCR on file: ${filePath}`);

            const [result] = await this.client.documentTextDetection(filePath);
            const fullTextAnnotation = result.fullTextAnnotation;

            if (!fullTextAnnotation) {
                throw new Error('No text detected in document');
            }

            const processingTime = (Date.now() - startTime) / 1000;

            const pages = fullTextAnnotation.pages.map((page, index) => ({
                pageNumber: index + 1,
                text: this.extractPageText(page),
                confidence: page.confidence || 0,
                width: page.width,
                height: page.height,
                blocks: page.blocks.map(block => ({
                    text: this.extractBlockText(block),
                    confidence: block.confidence,
                    boundingBox: block.boundingBox
                }))
            }));

            logger.info(`Google Vision OCR completed in ${processingTime}s`);

            return this.formatResult({
                text: fullTextAnnotation.text,
                confidence: this.calculateAverageConfidence(pages),
                pages,
                language: this.detectLanguage(fullTextAnnotation),
                processingTime
            });
        } catch (error) {
            logger.error('Google Vision OCR failed:', error);
            throw error;
        }
    }

    async extractTextFromBuffer(buffer, options = {}) {
        const startTime = Date.now();

        try {
            if (!this.client) {
                await this.initialize();
            }

            logger.info('Starting Google Vision OCR on buffer');

            const [result] = await this.client.documentTextDetection({
                image: { content: buffer }
            });

            const fullTextAnnotation = result.fullTextAnnotation;

            if (!fullTextAnnotation) {
                throw new Error('No text detected in document');
            }

            const processingTime = (Date.now() - startTime) / 1000;

            const pages = fullTextAnnotation.pages.map((page, index) => ({
                pageNumber: index + 1,
                text: this.extractPageText(page),
                confidence: page.confidence || 0,
                width: page.width,
                height: page.height,
                blocks: page.blocks.map(block => ({
                    text: this.extractBlockText(block),
                    confidence: block.confidence,
                    boundingBox: block.boundingBox
                }))
            }));

            logger.info(`Google Vision OCR completed in ${processingTime}s`);

            return this.formatResult({
                text: fullTextAnnotation.text,
                confidence: this.calculateAverageConfidence(pages),
                pages,
                language: this.detectLanguage(fullTextAnnotation),
                processingTime
            });
        } catch (error) {
            logger.error('Google Vision OCR failed:', error);
            throw error;
        }
    }

    extractPageText(page) {
        return page.blocks
            .map(block => this.extractBlockText(block))
            .join('\n');
    }

    extractBlockText(block) {
        return block.paragraphs
            .map(para => para.words
                .map(word => word.symbols
                    .map(symbol => symbol.text)
                    .join('')
                )
                .join(' ')
            )
            .join('\n');
    }

    calculateAverageConfidence(pages) {
        if (pages.length === 0) return 0;
        const sum = pages.reduce((acc, page) => acc + (page.confidence || 0), 0);
        return sum / pages.length;
    }

    detectLanguage(fullTextAnnotation) {
        if (fullTextAnnotation.pages && fullTextAnnotation.pages[0]) {
            const detectedLanguages = fullTextAnnotation.pages[0].property?.detectedLanguages;
            if (detectedLanguages && detectedLanguages.length > 0) {
                return detectedLanguages[0].languageCode;
            }
        }
        return 'unknown';
    }

    getSupportedLanguages() {
        // Google Vision supports 100+ languages
        return ['auto', 'eng', 'fra', 'deu', 'spa', 'ita', 'por', 'rus', 'chi_sim', 'chi_tra', 'jpn', 'kor', 'ara', 'hin'];
    }

    async cleanup() {
        this.client = null;
        logger.info('Google Vision client cleaned up');
    }
}

module.exports = GoogleVisionEngine;
