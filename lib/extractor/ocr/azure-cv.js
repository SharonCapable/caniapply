const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
const { ApiKeyCredentials } = require('@azure/ms-rest-azure-js');
const BaseOCREngine = require('./base');
const logger = require('../utils/logger');
const fs = require('fs').promises;

/**
 * Azure Computer Vision OCR Engine
 * Microsoft's cloud-based OCR service
 */
class AzureCVEngine extends BaseOCREngine {
    constructor(config = {}) {
        super(config);
        this.name = 'azure_cv';
        this.client = null;
    }

    async initialize() {
        try {
            logger.info('Initializing Azure Computer Vision OCR engine...');

            if (!this.config.azureCV?.endpoint || !this.config.azureCV?.key) {
                throw new Error('Azure Computer Vision endpoint and key are required');
            }

            const credentials = new ApiKeyCredentials({
                inHeader: { 'Ocp-Apim-Subscription-Key': this.config.azureCV.key }
            });

            this.client = new ComputerVisionClient(credentials, this.config.azureCV.endpoint);
            logger.info('Azure Computer Vision OCR engine initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Azure Computer Vision:', error);
            throw error;
        }
    }

    async extractText(filePath, options = {}) {
        const startTime = Date.now();

        try {
            if (!this.client) {
                await this.initialize();
            }

            logger.info(`Starting Azure CV OCR on file: ${filePath}`);

            const fileBuffer = await fs.readFile(filePath);
            return await this.extractTextFromBuffer(fileBuffer, options);
        } catch (error) {
            logger.error('Azure CV OCR failed:', error);
            throw error;
        }
    }

    async extractTextFromBuffer(buffer, options = {}) {
        const startTime = Date.now();

        try {
            if (!this.client) {
                await this.initialize();
            }

            logger.info('Starting Azure CV OCR on buffer');

            // Start the read operation
            const readResult = await this.client.readInStream(buffer);
            const operationLocation = readResult.operationLocation;
            const operationId = operationLocation.split('/').slice(-1)[0];

            // Wait for the operation to complete
            let result;
            let status;
            do {
                await this.sleep(1000);
                result = await this.client.getReadResult(operationId);
                status = result.status;
            } while (status === 'running' || status === 'notStarted');

            if (status !== 'succeeded') {
                throw new Error(`Azure CV operation failed with status: ${status}`);
            }

            const processingTime = (Date.now() - startTime) / 1000;

            const pages = result.analyzeResult.readResults.map((page, index) => ({
                pageNumber: index + 1,
                text: page.lines.map(line => line.text).join('\n'),
                confidence: this.calculatePageConfidence(page),
                width: page.width,
                height: page.height,
                angle: page.angle,
                lines: page.lines.map(line => ({
                    text: line.text,
                    boundingBox: line.boundingBox,
                    words: line.words.map(word => ({
                        text: word.text,
                        confidence: word.confidence,
                        boundingBox: word.boundingBox
                    }))
                }))
            }));

            const fullText = pages.map(p => p.text).join('\n\n');
            const avgConfidence = this.calculateAverageConfidence(pages);

            logger.info(`Azure CV OCR completed in ${processingTime}s with confidence: ${avgConfidence}`);

            return this.formatResult({
                text: fullText,
                confidence: avgConfidence,
                pages,
                language: result.analyzeResult.readResults[0]?.language || 'unknown',
                processingTime
            });
        } catch (error) {
            logger.error('Azure CV OCR failed:', error);
            throw error;
        }
    }

    calculatePageConfidence(page) {
        if (!page.lines || page.lines.length === 0) return 0;

        let totalConfidence = 0;
        let wordCount = 0;

        page.lines.forEach(line => {
            if (line.words) {
                line.words.forEach(word => {
                    if (word.confidence !== undefined) {
                        totalConfidence += word.confidence;
                        wordCount++;
                    }
                });
            }
        });

        return wordCount > 0 ? totalConfidence / wordCount : 0;
    }

    calculateAverageConfidence(pages) {
        if (pages.length === 0) return 0;
        const sum = pages.reduce((acc, page) => acc + (page.confidence || 0), 0);
        return sum / pages.length;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getSupportedLanguages() {
        // Azure supports 100+ languages
        return ['auto', 'en', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'ar', 'hi'];
    }

    async cleanup() {
        this.client = null;
        logger.info('Azure CV client cleaned up');
    }
}

module.exports = AzureCVEngine;
