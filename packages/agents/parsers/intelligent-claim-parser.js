/**
 * Intelligent Claim Parser - Hybrid AI + Pattern Approach
 * Uses HuggingFace for accuracy with pattern-based fallback for speed
 * Implements caching and parallel processing for optimization
 */

import { HfInference } from '@huggingface/inference';
import { config } from '../../config/env/config.js';

class IntelligentClaimParser {
    constructor() {
        this.log("🧠 Intelligent Claim Parser initialized (HuggingFace + Patterns)");
        
        // Initialize HuggingFace client
        this.hf = config.ai.huggingFaceApiKey ? new HfInference(config.ai.huggingFaceApiKey) : null;
        
        // Cache for repeated claims (speed optimization)
        this.cache = new Map();
        this.cacheSize = 100;
        
        // Pattern-based fallback (from simple parser)
        this.initializePatterns();
        
        // Performance tracking
        this.stats = {
            totalQueries: 0,
            cacheHits: 0,
            hfSuccess: 0,
            patternFallback: 0,
            avgProcessingTime: 0
        };
    }

    initializePatterns() {
        // Same patterns as simple parser for fallback
        this.entityPatterns = [
            /\b(Apple|Tesla|Microsoft|Google|Amazon|Facebook|Meta|OpenAI|NVIDIA|AMD|Samsung|Sony)\b/i,
            /\b(India|China|USA|America|Europe|Asia|Africa|Australia|Canada|Japan|UK|France|Germany|Brazil|Russia)\b/i,
            /\b(WHO|CDC|FDA|COVID|coronavirus|pandemic|virus|disease|vaccine|health|medical)\b/i,
            /\b([A-Z][a-zA-Z]{2,})\b/
        ];
        
        this.actionPatterns = [
            /\b(announced|released|launched|developed|created|unveiled|introduced|discovered)\b/i,
            /\b(increased|decreased|improved|reduced|enhanced|optimized|upgraded|updated)\b/i,
            /\b(witnessing|experiencing|facing|seeing|observing|encountering|undergoing)\b/i,
            /\b(rising|falling|growing|declining|spreading|expanding|contracting)\b/i,
            /\b(raise|rise|increase|surge|spike|outbreak|spread|transmission)\b/i
        ];
        
        this.contextPatterns = [
            /\b(COVID|coronavirus|pandemic|epidemic|virus|disease|infection|outbreak|vaccine|treatment)\b/i,
            /\b(AI|artificial intelligence|machine learning|technology|software|hardware|chip|processor)\b/i,
            /\b(economy|market|business|finance|trade|employment|growth|recession)\b/i,
            /\b(climate|environment|weather|temperature|pollution|carbon|energy)\b/i
        ];
    }

    log(message, level = 'INFO', data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] IntelligentParser ${level}: ${message}`);
        if (data) console.log('Details:', data);
    }

    /**
     * Main parsing function - tries HuggingFace first, falls back to patterns
     */
    async parseClaim(text) {
        const startTime = Date.now();
        this.stats.totalQueries++;
        
        this.log(`🧠 Parsing claim: "${text.substring(0, 100)}..."`);
        
        try {
            // Check cache first (instant response)
            const cacheKey = this.getCacheKey(text);
            if (this.cache.has(cacheKey)) {
                this.stats.cacheHits++;
                const result = this.cache.get(cacheKey);
                this.log(`⚡ Cache hit! Processing time: ${Date.now() - startTime}ms`, 'SUCCESS');
                return result;
            }

            let result;
            
            // Try HuggingFace if API key available
            if (this.hf) {
                try {
                    result = await this.parseWithHuggingFace(text);
                    this.stats.hfSuccess++;
                    this.log(`🤖 HuggingFace parsing successful`, 'SUCCESS');
                } catch (hfError) {
                    this.log(`⚠️ HuggingFace failed: ${hfError.message}`, 'WARN');
                    result = await this.parseWithPatterns(text);
                    this.stats.patternFallback++;
                }
            } else {
                // No API key, use patterns
                result = await this.parseWithPatterns(text);
                this.stats.patternFallback++;
            }

            // Add performance metadata
            const processingTime = Date.now() - startTime;
            result.processingTime = `${processingTime}ms`;
            result.method = this.hf && this.stats.hfSuccess > this.stats.patternFallback ? 'huggingface' : 'patterns';
            
            // Cache the result
            this.addToCache(cacheKey, result);
            
            // Update stats
            this.stats.avgProcessingTime = ((this.stats.avgProcessingTime * (this.stats.totalQueries - 1)) + processingTime) / this.stats.totalQueries;
            
            this.log(`✅ Parsing completed in ${processingTime}ms`, 'SUCCESS', {
                type: result.type,
                confidence: result.confidence,
                method: result.method
            });

            return result;

        } catch (error) {
            this.log(`❌ Parsing failed: ${error.message}`, 'ERROR');
            return this.createFallbackResult(text, error);
        }
    }

    /**
     * HuggingFace-powered intelligent parsing
     */
    async parseWithHuggingFace(text) {
        // Run multiple models in parallel for speed
        const [entities, classification, sentiment] = await Promise.allSettled([
            this.extractEntitiesHF(text),
            this.classifyClaimHF(text),
            this.analyzeSentimentHF(text)
        ]);

        // Process results
        const extractedEntities = entities.status === 'fulfilled' ? entities.value : [];
        const claimType = classification.status === 'fulfilled' ? classification.value : 'general';
        const sentimentScore = sentiment.status === 'fulfilled' ? sentiment.value : 0.5;

        // Build structured result
        return {
            type: claimType,
            confidence: this.calculateHFConfidence(extractedEntities, claimType, sentimentScore),
            
            // Extract subject, predicate, object from entities and text
            subject: this.extractSubjectHF(text, extractedEntities),
            predicate: this.extractPredicateHF(text),
            object: this.extractObjectHF(text, extractedEntities, claimType),
            
            // Rich metadata
            entities: extractedEntities,
            sentiment: sentimentScore,
            originalText: text,
            wordCount: text.split(/\s+/).length,
            
            // AI metadata
            processingMethod: 'huggingface-hybrid',
            aiProvider: 'huggingface-inference',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Extract named entities using HuggingFace NER
     */
    async extractEntitiesHF(text) {
        try {
            const response = await this.hf.tokenClassification({
                model: 'dbmdz/bert-large-cased-finetuned-conll03-english',
                inputs: text
            });
            
            // Process and deduplicate entities
            const entities = response
                .filter(item => item.score > 0.5)
                .map(item => ({
                    text: item.word.replace('##', ''),
                    label: item.entity_group || item.entity,
                    confidence: item.score
                }));
                
            return this.deduplicateEntities(entities);
        } catch (error) {
            this.log(`NER extraction failed: ${error.message}`, 'WARN');
            return [];
        }
    }

    /**
     * Classify claim type using zero-shot classification
     */
    async classifyClaimHF(text) {
        try {
            const response = await this.hf.zeroShotClassification({
                model: 'facebook/bart-large-mnli',
                inputs: text,
                parameters: {
                    candidate_labels: [
                        'health', 'medical', 'pandemic',
                        'technology', 'artificial intelligence', 'software',
                        'business', 'corporate announcement', 'financial',
                        'social', 'political', 'economic',
                        'environmental', 'climate', 'energy',
                        'quantified', 'statistical', 'research',
                        'general', 'news', 'statement'
                    ]
                }
            });
            
            const topLabel = response.labels[0];
            const confidence = response.scores[0];
            
            // Map to our claim types
            if (topLabel.includes('health') || topLabel.includes('medical') || topLabel.includes('pandemic')) return 'health';
            if (topLabel.includes('technology') || topLabel.includes('artificial') || topLabel.includes('software')) return 'technology';
            if (topLabel.includes('business') || topLabel.includes('corporate') || topLabel.includes('financial')) return 'business';
            if (topLabel.includes('social') || topLabel.includes('political') || topLabel.includes('economic')) return 'social';
            if (topLabel.includes('environmental') || topLabel.includes('climate') || topLabel.includes('energy')) return 'environmental';
            if (topLabel.includes('quantified') || topLabel.includes('statistical') || topLabel.includes('research')) return 'quantified';
            
            return confidence > 0.7 ? 'general' : 'unstructured';
        } catch (error) {
            this.log(`Classification failed: ${error.message}`, 'WARN');
            return 'general';
        }
    }

    /**
     * Analyze sentiment for confidence calculation
     */
    async analyzeSentimentHF(text) {
        try {
            const response = await this.hf.textClassification({
                model: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
                inputs: text
            });
            
            return response[0].score || 0.5;
        } catch (error) {
            return 0.5; // Neutral fallback
        }
    }

    /**
     * Pattern-based fallback (fast local processing)
     */
    async parseWithPatterns(text) {
        // Use the same logic as simple parser but mark as fallback
        const entities = this.extractEntities(text);
        const actions = this.extractActions(text);
        const contexts = this.extractContexts(text);
        
        return {
            type: this.determineClaimType(text, [], entities, actions),
            confidence: this.calculatePatternConfidence(entities, actions),
            
            subject: entities.length > 0 ? entities[0] : this.extractMainSubject(text),
            predicate: actions.length > 0 ? actions[0] : this.extractMainAction(text),
            object: contexts.length > 0 ? contexts[0] : this.extractMainObject(text),
            
            entities: entities,
            actions: actions,
            contexts: contexts,
            
            originalText: text,
            wordCount: text.split(/\s+/).length,
            processingMethod: 'pattern-based-fallback',
            aiProvider: 'built-in-patterns',
            timestamp: new Date().toISOString()
        };
    }

    // Helper methods for HuggingFace processing
    extractSubjectHF(text, entities) {
        // Priority: Person > Organization > Location > First entity > Pattern fallback
        const personEntity = entities.find(e => e.label === 'PER' || e.label === 'PERSON');
        if (personEntity) return personEntity.text;
        
        const orgEntity = entities.find(e => e.label === 'ORG' || e.label === 'ORGANIZATION');
        if (orgEntity) return orgEntity.text;
        
        const locEntity = entities.find(e => e.label === 'LOC' || e.label === 'LOCATION');
        if (locEntity) return locEntity.text;
        
        return entities.length > 0 ? entities[0].text : this.extractMainSubject(text);
    }

    extractPredicateHF(text) {
        // Use pattern matching for predicates (still reliable)
        for (const pattern of this.actionPatterns) {
            const match = text.match(pattern);
            if (match) return match[1] || match[0];
        }
        return this.extractMainAction(text);
    }

    extractObjectHF(text, entities, claimType) {
        // Context-aware object extraction based on claim type
        if (claimType === 'health') {
            const healthMatch = text.match(/\b(covid|coronavirus|pandemic|virus|disease|vaccine|treatment|infection)\b/i);
            if (healthMatch) return healthMatch[1];
        }
        
        if (claimType === 'technology') {
            const techMatch = text.match(/\b(AI|software|hardware|chip|processor|algorithm|system)\b/i);
            if (techMatch) return techMatch[1];
        }
        
        // Find non-subject entities as objects
        const nonSubjectEntities = entities.slice(1);
        if (nonSubjectEntities.length > 0) return nonSubjectEntities[0].text;
        
        return this.extractMainObject(text);
    }

    calculateHFConfidence(entities, claimType, sentimentScore) {
        let confidence = 0.5; // Base confidence
        
        if (entities.length > 0) confidence += 0.2;
        if (entities.length > 2) confidence += 0.1;
        if (claimType !== 'unstructured') confidence += 0.15;
        if (sentimentScore > 0.7 || sentimentScore < 0.3) confidence += 0.05; // Strong sentiment
        
        return Math.min(confidence, 0.95); // Cap at 95%
    }

    // Cache management
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

    // Pattern-based helper methods (copied from simple parser)
    extractEntities(text) {
        const entities = [];
        for (const pattern of this.entityPatterns) {
            const matches = text.match(pattern);
            if (matches) entities.push(matches[1] || matches[0]);
        }
        return [...new Set(entities)];
    }

    extractActions(text) {
        const actions = [];
        for (const pattern of this.actionPatterns) {
            const matches = text.match(pattern);
            if (matches) actions.push(matches[1] || matches[0]);
        }
        return [...new Set(actions)];
    }

    extractContexts(text) {
        const contexts = [];
        for (const pattern of this.contextPatterns) {
            const matches = text.match(pattern);
            if (matches) contexts.push(matches[1] || matches[0]);
        }
        return [...new Set(contexts)];
    }

    determineClaimType(text, quantifications, entities, actions) {
        if (/COVID|coronavirus|pandemic|virus|disease|health|medical/i.test(text)) return 'health';
        if (/AI|technology|software|hardware|chip|processor/i.test(text)) return 'technology';
        if (/economy|market|politics|government|society/i.test(text)) return 'social';
        if (/climate|environment|weather|pollution|carbon/i.test(text)) return 'environmental';
        if (entities.length > 0 && actions.length > 0) return 'general';
        return 'unstructured';
    }

    calculatePatternConfidence(entities, actions) {
        let confidence = 0.3;
        if (entities.length > 0) confidence += 0.2;
        if (actions.length > 0) confidence += 0.2;
        return Math.min(confidence, 0.8);
    }

    extractMainSubject(text) {
        const words = text.split(/\s+/);
        const capitalizedWords = words.filter(word => /^[A-Z]/.test(word));
        return capitalizedWords.length > 0 ? capitalizedWords[0] : 'unknown';
    }

    extractMainAction(text) {
        const commonVerbs = ['witnessing', 'experiencing', 'announced', 'released', 'is', 'are', 'has', 'have'];
        const words = text.toLowerCase().split(/\s+/);
        for (const word of words) {
            if (commonVerbs.includes(word)) return word;
        }
        return 'relates-to';
    }

    extractMainObject(text) {
        const words = text.split(/\s+/);
        const significantWords = words.filter(word => 
            word.length > 3 && 
            !/^(the|and|or|but|in|on|at|to|for|of|with|by|again|\?)$/i.test(word)
        );
        return significantWords.length > 0 ? significantWords[significantWords.length - 1] : 'unknown';
    }

    deduplicateEntities(entities) {
        const seen = new Set();
        return entities.filter(entity => {
            const key = entity.text.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    createFallbackResult(text, error) {
        return {
            type: 'error',
            confidence: 0.1,
            subject: 'unknown',
            predicate: 'unknown',
            object: 'unknown',
            originalText: text,
            error: error.message,
            processingMethod: 'error-fallback',
            aiProvider: 'none',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get parser statistics
     */
    getStats() {
        return {
            ...this.stats,
            cacheHitRate: this.stats.totalQueries > 0 ? (this.stats.cacheHits / this.stats.totalQueries * 100).toFixed(1) + '%' : '0%',
            hfSuccessRate: this.stats.totalQueries > 0 ? (this.stats.hfSuccess / this.stats.totalQueries * 100).toFixed(1) + '%' : '0%',
            cacheSize: this.cache.size
        };
    }

    /**
     * Get parser status and capabilities
     */
    getStatus() {
        return {
            name: 'IntelligentClaimParser',
            version: '2.0.0',
            capabilities: [
                'huggingface_ner',
                'zero_shot_classification',
                'sentiment_analysis',
                'pattern_fallback',
                'intelligent_caching',
                'parallel_processing',
                'real_time_optimization'
            ],
            dependencies: this.hf ? 'huggingface-inference' : 'patterns-only',
            ready: true,
            stats: this.getStats()
        };
    }
}

export default IntelligentClaimParser;
