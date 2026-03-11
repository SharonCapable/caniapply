const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const config = require('../config');
const logger = require('./logger');

/**
 * AI Service for document intelligence
 * Handles summarization, classification, and structured extraction
 * Supports Gemini (Cloud) and Ollama (Local/Offline)
 */
class AIService {
    constructor() {
        this.provider = config.ai.provider;
        this.enabled = config.ai.enabled;

        if (this.enabled) {
            if (this.provider === 'gemini' && config.ai.gemini.apiKey) {
                this.genAI = new GoogleGenerativeAI(config.ai.gemini.apiKey);
                this.model = this.genAI.getGenerativeModel({ model: config.ai.gemini.model });
            } else if (this.provider === 'ollama') {
                logger.info(`AI Service configured for Ollama (${config.ai.ollama.baseUrl})`);
            }
        }
    }

    /**
     * Analyze document content to infer type, summarize, and extract structured info
     * @param {string} text - Extracted document text
     * @param {string} filename - Original filename
     * @returns {Promise<Object>} AI analysis results
     */
    async analyzeDocument(text, filename) {
        if (!this.enabled || !text || text.trim().length === 0) {
            return {
                inferredType: 'Unknown',
                summary: 'AI analysis not available.',
                insights: [],
                confidence: 0,
                provider: 'none'
            };
        }

        try {
            if (this.provider === 'ollama') {
                return await this.analyzeOllama(text, filename);
            } else if (this.provider === 'gemini') {
                return await this.analyzeGemini(text, filename);
            } else {
                throw new Error(`Unsupported AI provider: ${this.provider}`);
            }
        } catch (error) {
            let errorMessage = error.message;
            if (error.response && error.response.status === 404) {
                errorMessage = `Model "${config.ai.ollama.model}" not found in Ollama. Run 'ollama pull ${config.ai.ollama.model}' or check 'ollama list'.`;
            }

            logger.error(`AI Analysis failed (${this.provider}):`, errorMessage);
            return {
                inferredType: 'Inference Failed',
                summary: `AI Analysis unavailable: ${errorMessage}`,
                insights: [],
                confidence: 0,
                provider: this.provider,
                isOffline: this.provider === 'ollama',
                error: true
            };
        }
    }

    async analyzeGemini(text, filename) {
        if (!config.ai.gemini.apiKey) {
            throw new Error('Gemini API Key missing');
        }

        logger.info(`Analyzing with Gemini: ${filename}`);
        const prompt = this.getPrompt(text, filename);

        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        let responseText = response.text();

        return this.parseAIResponse(responseText, 'gemini');
    }

    async analyzeOllama(text, filename) {
        logger.info(`Analyzing with Ollama: ${filename} using model ${config.ai.ollama.model}`);
        const prompt = this.getPrompt(text, filename);

        try {
            const response = await axios.post(`${config.ai.ollama.baseUrl}/api/generate`, {
                model: config.ai.ollama.model,
                prompt: prompt,
                stream: false,
                format: 'json'
            }, {
                timeout: 300000 // 5 minutes for local models
            });

            if (response.data && response.data.response) {
                return this.parseAIResponse(response.data.response, 'ollama');
            } else {
                throw new Error('Invalid response from Ollama');
            }
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                throw new Error(`AI generation timed out after 5 minutes. Try using a smaller model like 'llama3.2:1b' or 'phi3:mini'.`);
            }
            throw error;
        }
    }

    getPrompt(text, filename) {
        return `
        You are a Document Intelligence Assistant. Analyze the following extracted text from a file named "${filename}".
        
        1. Infer the EXACT type of document (e.g., "Invoice", "Academic Transcript", "Meeting Minutes", "Syllabus", "Timetable", "Legal Contract", "Technical Manual").
        2. Provide a concise 2-3 sentence summary of the content.
        3. Extract 3 key insights or main topics as bullet points.
        4. If the text looks like it was originally a table, try to mention that in the description.
        
        CRITICAL: Return ONLY a raw JSON strictly matching this structure:
        {
            "inferredType": "string",
            "summary": "string",
            "insights": ["insight1", "insight2", "insight3"],
            "confidence": 0.95
        }
        
        EXTRACTED TEXT:
        ${text.substring(0, 4000)}
        `;
    }

    parseAIResponse(responseText, provider) {
        try {
            // Clean up Markdown if AI added it
            const jsonPart = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const analysis = JSON.parse(jsonPart);

            return {
                ...analysis,
                provider: provider,
                isOffline: provider === 'ollama'
            };
        } catch (e) {
            logger.warn(`Failed to parse ${provider} JSON:`, e.message);
            return {
                inferredType: 'Analysis Error',
                summary: responseText.substring(0, 200) + '...',
                insights: ['Could not parse structured insights'],
                confidence: 0,
                provider: provider,
                isOffline: provider === 'ollama'
            };
        }
    }
}

module.exports = new AIService();
