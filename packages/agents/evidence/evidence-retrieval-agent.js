/**
 * Phase 3: Evidence Retrieval Agent
 * Receives structured claims from Phase 2 and retrieves supporting evidence
 */

import { HfInference } from '@huggingface/inference';
import axios from 'axios';

class EvidenceRetrievalAgent {
    constructor() {
        this.hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
        this.perplexityApiKey = process.env.PERPLEXITY_API_KEY;
        this.log("🔍 Evidence Retrieval Agent initialized");
    }

    log(message, level = 'INFO', data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] EVIDENCE-AGENT ${level}: ${message}`);
        if (data) console.log('Details:', data);
    }

    /**
     * MAIN ENTRY POINT: Process claim from Phase 2 orchestrator
     * @param {Object} parsedClaim - Structured claim from Phase 2
     * @returns {Object} Evidence package for Phase 4
     */
    async retrieveEvidence(parsedClaim) {
        this.log(`🔍 Starting evidence retrieval for claim: "${parsedClaim.originalText}"`);

        try {
            // Step 1: Prepare search queries from structured claim
            const searchQueries = this.buildSearchQueries(parsedClaim);
            
            // Step 2: Try RAG model first (facebook/rag-token-nq)
            let evidence = await this.retrieveWithRAG(searchQueries);
            
            // Step 3: If RAG fails, fallback to Perplexity API
            if (!evidence || evidence.length === 0) {
                this.log("⚠️ RAG model failed, falling back to Perplexity API");
                evidence = await this.retrieveWithPerplexity(searchQueries);
            }

            // Step 4: Package evidence for Phase 4
            const evidencePackage = {
                claimCid: parsedClaim.cid,
                originalClaim: parsedClaim.originalText,
                claimType: parsedClaim.type,
                searchQueries: searchQueries,
                evidence: evidence,
                retrievalMethod: evidence.method || 'unknown',
                confidence: this.calculateEvidenceConfidence(evidence),
                timestamp: new Date().toISOString(),
                nextPhase: 'veracity_prediction'
            };

            this.log(`✅ Evidence retrieval completed`, 'SUCCESS', {
                evidenceCount: evidence.length,
                method: evidencePackage.retrievalMethod,
                confidence: evidencePackage.confidence
            });

            return evidencePackage;

        } catch (error) {
            this.log(`❌ Evidence retrieval failed: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    /**
     * Build targeted search queries from Phase 2 structured data
     * Uses the parsed subject, predicate, object for precise searches
     */
    buildSearchQueries(parsedClaim) {
        const queries = [];
        
        // Base query from original text
        queries.push(parsedClaim.originalText);

        // Subject-focused queries
        if (parsedClaim.subject && parsedClaim.subject !== 'unknown') {
            queries.push(`facts about ${parsedClaim.subject}`);
            queries.push(`${parsedClaim.subject} scientific information`);
        }

        // Question-specific queries (leveraging your new question detection!)
        if (parsedClaim.type === 'question') {
            // Convert question to statement for evidence search
            if (parsedClaim.predicate === 'is-questioned-to-be' || parsedClaim.predicate === 'is-questioned-about') {
                queries.push(`${parsedClaim.subject} ${parsedClaim.object}`);
                queries.push(`${parsedClaim.subject} research studies`);
                queries.push(`${parsedClaim.subject} scientific consensus`);
            }
        }

        // Entity-based queries from HuggingFace NER
        if (parsedClaim.entities && parsedClaim.entities.length > 0) {
            parsedClaim.entities.forEach(entity => {
                if (entity.confidence > 0.8) {
                    queries.push(`${entity.text} facts verification`);
                }
            });
        }

        this.log(`📝 Generated ${queries.length} search queries`, 'INFO', { queries });
        return queries;
    }

    /**
     * Retrieve evidence using HuggingFace RAG model
     */
    async retrieveWithRAG(queries) {
        this.log("🤖 Attempting evidence retrieval with facebook/rag-token-nq");
        
        try {
            const evidence = [];
            
            for (const query of queries.slice(0, 3)) { // Limit to top 3 queries
                const response = await this.hf.questionAnswering({
                    model: 'facebook/rag-token-nq',
                    inputs: {
                        question: query,
                        context: "Find factual information and sources"
                    }
                });

                if (response.answer && response.score > 0.3) {
                    evidence.push({
                        query: query,
                        answer: response.answer,
                        confidence: response.score,
                        source: 'rag-model',
                        type: 'ai_generated'
                    });
                }
            }

            if (evidence.length > 0) {
                evidence.method = 'rag';
                this.log(`✅ RAG model found ${evidence.length} evidence items`);
            }

            return evidence;

        } catch (error) {
            this.log(`⚠️ RAG model failed: ${error.message}`, 'WARN');
            return [];
        }
    }

    /**
     * Fallback evidence retrieval using Perplexity API
     */
    async retrieveWithPerplexity(queries) {
        this.log("🌐 Attempting evidence retrieval with Perplexity API");
        
        if (!this.perplexityApiKey) {
            this.log("❌ Perplexity API key not configured", 'ERROR');
            return [];
        }

        try {
            const evidence = [];
            
            for (const query of queries.slice(0, 2)) { // Limit API calls
                const response = await axios.post('https://api.perplexity.ai/chat/completions', {
                    model: 'llama-3.1-sonar-small-128k-online',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a fact-checking assistant. Provide accurate, verifiable information with sources.'
                        },
                        {
                            role: 'user',
                            content: `Find factual evidence about: ${query}`
                        }
                    ],
                    max_tokens: 500,
                    temperature: 0.1
                }, {
                    headers: {
                        'Authorization': `Bearer ${this.perplexityApiKey}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.data.choices && response.data.choices[0]) {
                    evidence.push({
                        query: query,
                        answer: response.data.choices[0].message.content,
                        confidence: 0.8, // High confidence for API sources
                        source: 'perplexity_api',
                        type: 'web_search',
                        usage: response.data.usage
                    });
                }
            }

            if (evidence.length > 0) {
                evidence.method = 'perplexity';
                this.log(`✅ Perplexity API found ${evidence.length} evidence items`);
            }

            return evidence;

        } catch (error) {
            this.log(`❌ Perplexity API failed: ${error.message}`, 'ERROR');
            return [];
        }
    }

    /**
     * Calculate overall evidence confidence
     */
    calculateEvidenceConfidence(evidence) {
        if (!evidence || evidence.length === 0) return 0;
        
        const avgConfidence = evidence.reduce((sum, item) => sum + item.confidence, 0) / evidence.length;
        return Math.round(avgConfidence * 100) / 100;
    }

    /**
     * Get agent status and statistics
     */
    getStatus() {
        return {
            agentType: 'evidence_retrieval',
            capabilities: ['rag_model', 'perplexity_api', 'query_generation'],
            models: ['facebook/rag-token-nq'],
            apis: ['perplexity'],
            configured: {
                huggingface: !!process.env.HUGGINGFACE_API_KEY,
                perplexity: !!this.perplexityApiKey
            }
        };
    }
}

export default EvidenceRetrievalAgent;

// Example usage with Phase 2 output:
if (import.meta.url === `file://${process.argv[1]}`) {
    const agent = new EvidenceRetrievalAgent();
    
    // Example Phase 2 output
    const testClaim = {
        cid: "bafkreiaz6bhvlqb6py5zqq3rntu7dsujmln7mmzyyzc5o4un3fupwu6r2y",
        type: "question",
        subject: "Earth",
        predicate: "is-questioned-about",
        object: "true", 
        confidence: 0.85,
        originalText: "In Earth there is no humans is this true",
        entities: [{"text": "Earth", "label": "LOC", "confidence": 0.99}]
    };
    
    agent.retrieveEvidence(testClaim).then(evidence => {
        console.log('\n🎯 PHASE 3 OUTPUT FOR PHASE 4:');
        console.log(JSON.stringify(evidence, null, 2));
    }).catch(console.error);
}
