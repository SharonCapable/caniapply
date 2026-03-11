const Tesseract = require('tesseract.js');
const BaseOCREngine = require('./base');
const logger = require('../utils/logger');

/**
 * Tesseract OCR Engine
 * Free, local OCR using Tesseract.js
 */
class TesseractEngine extends BaseOCREngine {
    constructor(config = {}) {
        super(config);
        this.name = 'tesseract';
        this.worker = null;
    }

    async initialize() {
        try {
            logger.info('Initializing Tesseract OCR engine...');
            this.worker = await Tesseract.createWorker(this.config.language || 'eng', 1, {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        logger.debug(`Tesseract progress: ${Math.round(m.progress * 100)}%`);
                    }
                }
            });
            logger.info('Tesseract OCR engine initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Tesseract:', error);
            throw error;
        }
    }

    async extractText(filePath, options = {}) {
        const startTime = Date.now();

        try {
            if (!this.worker) {
                await this.initialize();
            }

            logger.info(`Starting OCR on file: ${filePath}`);

            const { data } = await this.worker.recognize(filePath, {
                rotateAuto: true,
                ...options
            });

            const processingTime = (Date.now() - startTime) / 1000;

            logger.info(`OCR completed in ${processingTime}s with confidence: ${data.confidence}%`);

            return this.formatResult({
                text: data.text,
                confidence: data.confidence / 100,
                pages: [{
                    pageNumber: 1,
                    text: data.text,
                    confidence: data.confidence / 100,
                    words: data.words.map(w => ({
                        text: w.text,
                        confidence: w.confidence / 100,
                        bbox: w.bbox
                    })),
                    lines: data.lines.map(l => ({
                        text: l.text,
                        confidence: l.confidence / 100,
                        bbox: l.bbox
                    }))
                }],
                language: data.data.language,
                processingTime
            });
        } catch (error) {
            logger.error('Tesseract OCR failed:', error);
            throw error;
        }
    }

    async extractTextFromBuffer(buffer, options = {}) {
        const startTime = Date.now();

        try {
            if (!this.worker) {
                await this.initialize();
            }

            logger.info('Starting OCR on buffer');

            const { data } = await this.worker.recognize(buffer, {
                rotateAuto: true,
                ...options
            });

            const processingTime = (Date.now() - startTime) / 1000;

            logger.info(`OCR completed in ${processingTime}s with confidence: ${data.confidence}%`);

            return this.formatResult({
                text: data.text,
                confidence: data.confidence / 100,
                pages: [{
                    pageNumber: 1,
                    text: data.text,
                    confidence: data.confidence / 100,
                    words: data.words.map(w => ({
                        text: w.text,
                        confidence: w.confidence / 100,
                        bbox: w.bbox
                    })),
                    lines: data.lines.map(l => ({
                        text: l.text,
                        confidence: l.confidence / 100,
                        bbox: l.bbox
                    }))
                }],
                language: data.data.language,
                processingTime
            });
        } catch (error) {
            logger.error('Tesseract OCR failed:', error);
            throw error;
        }
    }

    getSupportedLanguages() {
        return [
            'eng', 'fra', 'deu', 'spa', 'ita', 'por', 'rus', 'chi_sim', 'chi_tra',
            'jpn', 'kor', 'ara', 'hin', 'tha', 'vie'
        ];
    }

    async cleanup() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
            logger.info('Tesseract worker terminated');
        }
    }
}

module.exports = TesseractEngine;
