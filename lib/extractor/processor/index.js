const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const sharp = require('sharp');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const logger = require('../utils/logger');
const OCREngineFactory = require('../ocr/factory');
const StorageFactory = require('../storage/factory');
const aiService = require('../utils/ai');
const config = require('../config');

/**
 * Document Processor
 * Main class for processing documents with OCR and storage
 */
class DocumentProcessor {
    constructor(customConfig = null) {
        this.config = customConfig || config;
        this.ocrFactory = new OCREngineFactory(this.config);
        this.storageFactory = new StorageFactory(this.config);
    }

    /**
     * Process a document file
     * @param {string} filePath - Path to the document
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Processing result
     */
    async processFile(filePath, options = {}) {
        const documentId = options.documentId || crypto.randomUUID();
        const startTime = Date.now();
        const filename = options.filename || path.basename(filePath);

        logger.info(`Starting document processing: ${documentId} - ${filename}`);

        try {
            const stats = await fs.stat(filePath);
            const fileSize = stats.size;

            // Update status to processing
            await this.updateDocumentStatus(documentId, 'processing', {
                filename,
                fileSize,
                createdAt: new Date().toISOString()
            });

            // Detect document type
            const fileExtension = path.extname(filename).toLowerCase().slice(1);
            const documentType = this.detectDocumentType(fileExtension);

            // Process based on type
            let ocrResult;
            if (fileExtension === 'pdf') {
                ocrResult = await this.processPDF(filePath);
            } else if (this.isImage(fileExtension)) {
                ocrResult = await this.processImage(filePath, options);
            } else if (this.isOfficeDocument(fileExtension)) {
                ocrResult = await this.processOfficeDocument(filePath, fileExtension);
            } else if (this.isTextFile(fileExtension)) {
                ocrResult = await this.processTextFile(filePath);
            } else {
                throw new Error(`Unsupported file type: ${fileExtension}`);
            }

            // Parse and extract structured data
            const parsedData = await this.parseContent(ocrResult, documentType);

            // Perform AI analysis (Inference and Summarization) if requested
            let aiAnalysis = {
                summary: "AI Analysis skipped by user.",
                insights: [],
                inferredType: documentType || 'Generic Document',
                confidence: 0,
                provider: 'none',
                isOffline: true
            };

            if (options.runAI !== false) {
                aiAnalysis = await aiService.analyzeDocument(ocrResult.text, filename);
            }

            // Calculate total processing time
            const endTime = Date.now();
            const totalDurationSeconds = (endTime - startTime) / 1000;

            // Prepare final document
            const document = {
                documentId,
                filename,
                status: 'completed',
                metadata: {
                    pages: ocrResult.pages?.length || 1,
                    language: ocrResult.metadata?.language || 'unknown',
                    documentType,
                    fileSize: ocrResult.metadata?.fileSize || fileSize || 0,
                    inferredType: aiAnalysis.inferredType,
                    aiConfidence: aiAnalysis.confidence,
                    createdAt: new Date().toISOString(),
                    processingTime: totalDurationSeconds
                },
                content: {
                    fullText: ocrResult.text,
                    summary: aiAnalysis.summary,
                    insights: aiAnalysis.insights,
                    inferredType: aiAnalysis.inferredType, // Add here for frontend convenience
                    confidence: aiAnalysis.confidence, // Add here for frontend convenience
                    provider: aiAnalysis.provider,
                    isOffline: aiAnalysis.isOffline,
                    pages: ocrResult.pages || [],
                    ...parsedData
                }
            };

            // Save to storage
            const storage = await this.storageFactory.getStorage();
            const storageResult = await storage.save(documentId, document);
            document.storageLocation = storageResult.location;

            logger.info(`Document processing completed: ${documentId}`);
            return document;

        } catch (error) {
            logger.error(`Document processing failed: ${documentId}`, error);

            // Update status to failed
            await this.updateDocumentStatus(documentId, 'failed', {
                filename,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Process a document from buffer
     * @param {Buffer} buffer - Document buffer
     * @param {string} filename - Original filename
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Processing result
     */
    async processBuffer(buffer, filename, options = {}) {
        const documentId = options.documentId || crypto.randomUUID();

        logger.info(`Starting buffer processing: ${documentId} - ${filename}`);

        try {
            await this.updateDocumentStatus(documentId, 'processing', {
                filename,
                createdAt: new Date().toISOString()
            });

            const fileExtension = path.extname(filename).toLowerCase().slice(1);
            const documentType = this.detectDocumentType(fileExtension);

            let ocrResult;
            if (fileExtension === 'pdf') {
                ocrResult = await this.processPDFBuffer(buffer);
            } else if (this.isImage(fileExtension)) {
                ocrResult = await this.processImageBuffer(buffer, options);
            } else {
                throw new Error(`Unsupported file type for buffer: ${fileExtension}`);
            }

            const parsedData = await this.parseContent(ocrResult, documentType);

            const document = {
                documentId,
                filename,
                status: 'completed',
                metadata: {
                    pages: ocrResult.pages?.length || 1,
                    language: ocrResult.metadata?.language || 'unknown',
                    documentType,
                    createdAt: new Date().toISOString(),
                    processingTime: ocrResult.metadata?.processingTime || 0
                },
                content: {
                    fullText: ocrResult.text,
                    pages: ocrResult.pages || [],
                    ...parsedData
                }
            };

            const storage = await this.storageFactory.getStorage();
            const storageResult = await storage.save(documentId, document);
            document.storageLocation = storageResult.location;

            logger.info(`Buffer processing completed: ${documentId}`);
            return document;

        } catch (error) {
            logger.error(`Buffer processing failed: ${documentId}`, error);
            await this.updateDocumentStatus(documentId, 'failed', {
                filename,
                error: error.message
            });
            throw error;
        }
    }

    async processPDF(filePath) {
        try {
            logger.info(`Reading PDF file: ${filePath}`);
            const buffer = await fs.readFile(filePath);
            logger.info(`PDF file read successfully, size: ${buffer.length} bytes`);
            return await this.processPDFBuffer(buffer);
        } catch (error) {
            logger.error(`Failed to read PDF file: ${filePath}`, error);
            throw error;
        }
    }

    async processPDFBuffer(buffer) {
        try {
            logger.info(`Starting PDF parsing, buffer size: ${buffer.length} bytes`);
            // Try to extract text from native PDF
            const pdfData = await pdfParse(buffer);
            const extractedText = pdfData.text || '';
            const trimmedText = extractedText.trim();
            const rawLength = extractedText.length;
            const trimmedLength = trimmedText.length;

            logger.info(`PDF parsed: raw length ${rawLength}, trimmed length ${trimmedLength}`);

            if (rawLength > 0 && trimmedLength === 0) {
                const charCodes = Array.from(extractedText.substring(0, 20)).map(c => c.charCodeAt(0)).join(',');
                logger.warn(`PDF has raw text but it's all whitespace. Raw length: ${rawLength}. First 20 char codes: ${charCodes}`);
            }

            // Return extracted text (even if minimal)
            // Note: Tesseract.js cannot directly OCR PDF buffers - they need to be converted to images first
            if (trimmedLength > 0 || rawLength > 100) {
                const finalResult = trimmedLength > 0 ? extractedText : extractedText; // Use raw if trimmed is empty but raw is large
                const isLimitedExtraction = trimmedLength < 50;
                if (isLimitedExtraction) {
                    logger.warn('PDF has very limited extractable text.');
                } else {
                    logger.info('PDF has native text, extraction successful');
                }

                return {
                    text: extractedText,
                    pages: [{
                        pageNumber: 1,
                        text: extractedText,
                        confidence: isLimitedExtraction ? 0.3 : 1.0
                    }],
                    metadata: {
                        engine: 'pdf-parse',
                        language: 'unknown',
                        processingTime: 0,
                        note: isLimitedExtraction ? 'Limited text extracted. This may be a scanned PDF.' : undefined
                    }
                };
            } else {
                // No text at all - likely a fully scanned/image-based PDF
                logger.warn('No text could be extracted from PDF. This is likely a scanned document.');
                return {
                    text: '[No text could be extracted. This PDF appears to be scanned/image-based.]',
                    pages: [{
                        pageNumber: 1,
                        text: '',
                        confidence: 0
                    }],
                    metadata: {
                        engine: 'pdf-parse',
                        language: 'unknown',
                        processingTime: 0,
                        note: 'No text extracted. PDF appears to be scanned/image-based. OCR requires PDF-to-image conversion.'
                    }
                };
            }
        } catch (error) {
            logger.error('PDF processing failed:', error);
            throw error;
        }
    }

    async processImage(filePath, options = {}) {
        const ocr = await this.ocrFactory.getEngine(options.ocrProvider);
        return await ocr.extractText(filePath, options);
    }

    async processImageBuffer(buffer, options = {}) {
        // Optimize image before OCR
        const optimized = await sharp(buffer)
            .resize({ width: 2000, withoutEnlargement: true })
            .grayscale()
            .normalize()
            .toBuffer();

        const ocr = await this.ocrFactory.getEngine(options.ocrProvider);
        return await ocr.extractTextFromBuffer(optimized, options);
    }

    async processOfficeDocument(filePath, extension) {
        try {
            if (extension === 'docx') {
                const result = await mammoth.extractRawText({ path: filePath });
                return {
                    text: result.value,
                    pages: [{ pageNumber: 1, text: result.value, confidence: 1.0 }],
                    metadata: { engine: 'mammoth', language: 'unknown', processingTime: 0 }
                };
            } else if (extension === 'xlsx') {
                const workbook = XLSX.readFile(filePath);
                const text = workbook.SheetNames.map(name => {
                    const sheet = workbook.Sheets[name];
                    return XLSX.utils.sheet_to_txt(sheet);
                }).join('\n\n');

                return {
                    text,
                    pages: [{ pageNumber: 1, text, confidence: 1.0 }],
                    metadata: { engine: 'xlsx', language: 'unknown', processingTime: 0 }
                };
            }
        } catch (error) {
            logger.error('Office document processing failed:', error);
            throw error;
        }
    }

    async processTextFile(filePath) {
        try {
            const text = await fs.readFile(filePath, 'utf8');
            return {
                text,
                pages: [{ pageNumber: 1, text, confidence: 1.0 }],
                metadata: { engine: 'fs-read', language: 'unknown', processingTime: 0 }
            };
        } catch (error) {
            logger.error('Text file processing failed:', error);
            throw error;
        }
    }

    async parseContent(ocrResult, documentType) {
        // Extract entities (dates, emails, phones, amounts)
        const entities = {
            dates: this.extractDates(ocrResult.text),
            emails: this.extractEmails(ocrResult.text),
            phones: this.extractPhones(ocrResult.text),
            amounts: this.extractAmounts(ocrResult.text)
        };

        return {
            tables: [], // TODO: Implement table extraction
            forms: [],  // TODO: Implement form extraction
            entities
        };
    }

    extractDates(text) {
        const dateRegex = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/g;
        return text.match(dateRegex) || [];
    }

    extractEmails(text) {
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        return text.match(emailRegex) || [];
    }

    extractPhones(text) {
        const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b|\b\(\d{3}\)\s*\d{3}[-.]?\d{4}\b/g;
        return text.match(phoneRegex) || [];
    }

    extractAmounts(text) {
        const amountRegex = /\$\s*\d+(?:,\d{3})*(?:\.\d{2})?|\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|EUR|GBP)\b/g;
        return text.match(amountRegex) || [];
    }

    detectDocumentType(extension) {
        const typeMap = {
            pdf: 'document',
            png: 'image',
            jpg: 'image',
            jpeg: 'image',
            tiff: 'image',
            bmp: 'image',
            gif: 'image',
            docx: 'word-document',
            xlsx: 'spreadsheet',
            txt: 'text-file',
            md: 'text-file',
            csv: 'text-file',
            json: 'text-file'
        };
        return typeMap[extension] || 'unknown';
    }

    isPDFNative(filePath) {
        return path.extname(filePath).toLowerCase() === '.pdf';
    }

    isImage(extension) {
        return ['png', 'jpg', 'jpeg', 'tiff', 'bmp', 'gif', 'webp'].includes(extension);
    }

    isTextFile(extension) {
        return ['txt', 'md', 'csv', 'json', 'xml', 'html', 'htm'].includes(extension);
    }

    isOfficeDocument(extension) {
        return ['docx', 'xlsx', 'pptx'].includes(extension);
    }

    async updateDocumentStatus(documentId, status, data = {}) {
        try {
            const storage = await this.storageFactory.getStorage();
            const existing = await storage.get(documentId);

            if (existing) {
                await storage.update(documentId, { status, ...data });
            } else {
                await storage.save(documentId, { documentId, status, ...data });
            }
        } catch (error) {
            logger.warn(`Failed to update document status: ${documentId}`, error);
        }
    }

    async getDocument(documentId) {
        const storage = await this.storageFactory.getStorage();
        return await storage.get(documentId);
    }

    async listDocuments(options = {}) {
        const storage = await this.storageFactory.getStorage();
        return await storage.list(options);
    }

    async deleteDocument(documentId) {
        const storage = await this.storageFactory.getStorage();
        return await storage.delete(documentId);
    }

    async cleanup() {
        await this.ocrFactory.cleanup();
        await this.storageFactory.cleanup();
    }
}

module.exports = DocumentProcessor;
