import OpenAI from 'openai';
import { config } from '../../config/env/config.js';

/**
 * ChatGPT-based Claim Parser
 * Replaces multiple HuggingFace models with a single GPT model for better accuracy
 */
class ChatGPTParser {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || config.ai.openaiApiKey
        });
        
        // Cache for repeated claims
        this.cache = new Map();
        this.cacheSize = 100;
        
        this.log("🤖 ChatGPT Parser initialized");
    }

    log(message, level = 'INFO', data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ChatGPTParser ${level}: ${message}`);
        if (data) console.log('Details:', data);
    }

    /**
     * Main parsing function using ChatGPT
     */
    async parseClaim(text) {
        const startTime = Date.now();
        
        try {
            // Check cache first
            const cacheKey = this.getCacheKey(text);
            if (this.cache.has(cacheKey)) {
                const cachedResult = this.cache.get(cacheKey);
                this.log(`⚡ Cache hit for: "${text.substring(0, 50)}..."`);
                return cachedResult;
            }

            // Prepare the system message with clear instructions
            const systemMessage = {
                role: "system",
                content: `You are an expert claim analyzer. Analyze the given text and extract:
                    1. Claim Type: Identify if it's a question, statement, fact, opinion, or hypothesis
                    2. Main Subject: The primary entity or concept being discussed
                    3. Predicate: The action, relationship, or state being described
                    4. Object: What the subject is acting on or related to
                    5. Named Entities: Important entities mentioned (people, organizations, locations, etc.)
                    6. Temporal Context: Any time-related information
                    7. Sentiment: The emotional tone or bias
                    8. Confidence: How confident are you in this analysis (0-1)
                    9. Key Evidence Required: What type of evidence would be needed to verify this claim
                    
                    Format the response as a JSON object with these fields.
                    Be precise and thorough in your analysis.`
            };

            // Make the API call
            const response = await this.openai.chat.completions.create({
                model: "gpt-4-0125-preview", // Using latest GPT-4 for best results
                messages: [
                    systemMessage,
                    {
                        role: "user",
                        content: text
                    }
                ],
                temperature: 0.1, // Low temperature for consistent results
                response_format: { type: "json_object" }
            });

            // Parse the response
            const result = JSON.parse(response.choices[0].message.content);

            // Add metadata
            const finalResult = {
                ...result,
                originalText: text,
                processingTime: `${Date.now() - startTime}ms`,
                method: 'chatgpt',
                modelVersion: 'gpt-4-0125-preview',
                timestamp: new Date().toISOString()
            };

            // Cache the result
            this.addToCache(cacheKey, finalResult);

            this.log(`✅ Successfully parsed claim in ${Date.now() - startTime}ms`, 'SUCCESS', {
                type: finalResult.claimType,
                confidence: finalResult.confidence
            });

            return finalResult;

        } catch (error) {
            this.log(`❌ Parsing failed: ${error.message}`, 'ERROR');
            return this.createFallbackResult(text, error);
        }
    }

    /**
     * Cache management
     */
    getCacheKey(text) {
        return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').substring(0, 100);
    }

    addToCache(key, result) {
        if (this.cache.size >= this.cacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, { ...result, cached: true });
    }

    clearCache() {
        this.cache.clear();
        this.log('🗑️ Cache cleared');
    }

    /**
     * Fallback result if parsing fails
     */
    createFallbackResult(text, error) {
        return {
            claimType: 'unknown',
            subject: 'unknown',
            predicate: 'unknown',
            object: 'unknown',
            confidence: 0,
            originalText: text,
            error: error.message,
            method: 'fallback',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get parser status
     */
    getStatus() {
        return {
            name: 'ChatGPTParser',
            version: '1.0.0',
            model: 'gpt-4-0125-preview',
            cacheSize: this.cache.size,
            ready: !!this.openai,
            capabilities: [
                'claim_type_detection',
                'entity_extraction',
                'sentiment_analysis',
                'temporal_analysis',
                'evidence_requirements',
                'confidence_scoring'
            ]
        };
    }
}

export default ChatGPTParser;

// Example usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const parser = new ChatGPTParser();
    
    // Test cases
    const testClaims = [
        "Is the Earth flat?",
        "Apple announced its new AI model yesterday.",
        "COVID-19 vaccines are effective at preventing severe illness.",
        "The global temperature has risen by 1.1°C since pre-industrial times."
    ];

    console.log('🧪 Running test cases...\n');

    Promise.all(testClaims.map(claim => 
        parser.parseClaim(claim)
            .then(result => {
                console.log(`\nInput: "${claim}"`);
                console.log('Analysis:', JSON.stringify(result, null, 2));
                console.log('-'.repeat(80));
            })
    )).catch(console.error);
}

