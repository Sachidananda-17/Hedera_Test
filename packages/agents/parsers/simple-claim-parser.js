/**
 * Simple Claim Parser - Alternative to HuggingFace
 * Provides real-time claim analysis without external dependencies
 * Extracts structured data (subject, predicate, object) from text content
 */

class SimpleClaimParser {
    constructor() {
        this.log("🔍 Simple Claim Parser initialized (HuggingFace alternative)");
        
        // Patterns for detecting quantified claims
        this.quantifiedPatterns = [
            /(\d+)%\s*(increase|decrease|improvement|growth|reduction|faster|slower|better|worse)/i,
            /(\d+)x\s*(faster|slower|more|less|better|improved)/i,
            /(increased|decreased|improved|reduced|grew|fell)\s*by\s*(\d+)%/i,
            /(\d+)\s*(times|fold)\s*(faster|slower|more|less|better)/i
        ];
        
        // Patterns for entity detection (expanded for health, geography, general)
        this.entityPatterns = [
            // Companies
            /\b(Apple|Tesla|Microsoft|Google|Amazon|Facebook|Meta|OpenAI|Anthropic|IBM|Intel|NVIDIA|AMD|Samsung|Sony)\b/i,
            /\b([A-Z][a-zA-Z]+\s+(?:Inc|Corp|Ltd|LLC|Company|Technologies|Systems))\b/i,
            // Countries and regions
            /\b(India|China|USA|America|Europe|Asia|Africa|Australia|Canada|Japan|UK|France|Germany|Brazil|Russia)\b/i,
            // Health entities
            /\b(WHO|CDC|FDA|COVID|coronavirus|pandemic|virus|disease|vaccine|health|medical)\b/i,
            // General entities (capitalized proper nouns)
            /\b([A-Z][a-zA-Z]{2,})\b/
        ];
        
        // Patterns for action/predicate detection (expanded for general use)
        this.actionPatterns = [
            // Corporate actions
            /\b(announced|released|launched|developed|created|unveiled|introduced|discovered|invented|built|designed)\b/i,
            /\b(increased|decreased|improved|reduced|enhanced|optimized|upgraded|updated|modified)\b/i,
            /\b(achieved|reached|attained|delivered|provided|offers|features|includes)\b/i,
            // General actions
            /\b(witnessing|experiencing|facing|seeing|observing|encountering|undergoing|suffering)\b/i,
            /\b(showing|displaying|exhibiting|demonstrating|indicating|suggesting|revealing)\b/i,
            /\b(rising|falling|growing|declining|spreading|expanding|contracting)\b/i,
            /\b(happening|occurring|taking place|emerging|developing|evolving)\b/i,
            // Health/social actions
            /\b(infected|affected|impacted|recovered|treated|diagnosed|tested)\b/i,
            /\b(raise|rise|increase|surge|spike|outbreak|spread|transmission)\b/i
        ];
        
        // Technology and context patterns (expanded for health, social, general)
        this.contextPatterns = [
            // Technology
            /\b(AI|artificial intelligence|machine learning|neural network|deep learning|algorithm)\b/i,
            /\b(battery|chip|processor|software|hardware|technology|system|platform|service)\b/i,
            /\b(smartphone|computer|device|application|app|tool|solution)\b/i,
            // Health and medical
            /\b(COVID|coronavirus|pandemic|epidemic|virus|disease|infection|outbreak|vaccine|treatment|symptoms|cases)\b/i,
            /\b(health|medical|hospital|doctor|patient|medicine|cure|therapy|diagnosis|recovery)\b/i,
            // Social and economic
            /\b(economy|market|business|finance|trade|employment|unemployment|growth|recession)\b/i,
            /\b(politics|government|policy|law|regulation|society|community|population)\b/i,
            // Environment and climate
            /\b(climate|environment|weather|temperature|pollution|carbon|energy|sustainability)\b/i
        ];
    }

    log(message, level = 'INFO', data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] SimpleClaimParser ${level}: ${message}`);
        if (data) console.log('Details:', data);
    }

    /**
     * Parse claim text and extract structured data
     * @param {string} text - The claim text to parse
     * @returns {Object} Structured claim data
     */
    async parseClaim(text) {
        this.log(`📝 Parsing claim: "${text.substring(0, 100)}..."`);
        
        try {
            // Basic text analysis
            const analysis = {
                originalText: text,
                wordCount: text.split(/\s+/).length,
                characterCount: text.length,
                timestamp: new Date().toISOString()
            };

            // Extract entities (subjects)
            const entities = this.extractEntities(text);
            
            // Extract actions (predicates)  
            const actions = this.extractActions(text);
            
            // Extract quantified claims
            const quantifications = this.extractQuantifications(text);
            
            // Extract context/domain mentions
            const contexts = this.extractContexts(text);
            
            // Determine claim type
            const claimType = this.determineClaimType(text, quantifications, entities, actions);
            
            // Build structured claim
            const structuredClaim = {
                type: claimType,
                confidence: this.calculateConfidence(entities, actions, quantifications),
                
                // Core triple (subject, predicate, object)
                subject: entities.length > 0 ? entities[0] : this.extractMainSubject(text),
                predicate: actions.length > 0 ? actions[0] : this.extractMainAction(text),
                object: contexts.length > 0 ? contexts[0] : this.extractMainObject(text, contexts, entities),
                
                // Additional extracted data
                entities: entities,
                actions: actions,
                quantifications: quantifications,
                contexts: contexts,
                
                // Analysis metadata
                analysis: analysis,
                processingMethod: 'simple-pattern-based',
                aiProvider: 'built-in-parser'
            };

            this.log(`✅ Claim parsed successfully`, 'SUCCESS', {
                type: structuredClaim.type,
                confidence: structuredClaim.confidence,
                subject: structuredClaim.subject,
                predicate: structuredClaim.predicate,
                object: structuredClaim.object
            });

            return structuredClaim;

        } catch (error) {
            this.log(`❌ Claim parsing failed: ${error.message}`, 'ERROR');
            
            // Return basic fallback structure
            return {
                type: 'unknown',
                confidence: 0.1,
                subject: 'unknown',
                predicate: 'unknown',
                object: 'unknown',
                originalText: text,
                error: error.message,
                processingMethod: 'fallback',
                aiProvider: 'built-in-parser'
            };
        }
    }

    extractEntities(text) {
        const entities = [];
        
        for (const pattern of this.entityPatterns) {
            const matches = text.match(pattern);
            if (matches) {
                entities.push(matches[1] || matches[0]);
            }
        }
        
        return [...new Set(entities)]; // Remove duplicates
    }

    extractActions(text) {
        const actions = [];
        
        for (const pattern of this.actionPatterns) {
            const matches = text.match(pattern);
            if (matches) {
                actions.push(matches[1] || matches[0]);
            }
        }
        
        return [...new Set(actions)]; // Remove duplicates
    }

    extractQuantifications(text) {
        const quantifications = [];
        
        for (const pattern of this.quantifiedPatterns) {
            const matches = text.match(pattern);
            if (matches) {
                quantifications.push({
                    full: matches[0],
                    number: matches[1] || matches[2],
                    unit: matches[2] || matches[1],
                    context: matches[0]
                });
            }
        }
        
        return quantifications;
    }

    extractContexts(text) {
        const contexts = [];
        
        for (const pattern of this.contextPatterns) {
            const matches = text.match(pattern);
            if (matches) {
                contexts.push(matches[1] || matches[0]);
            }
        }
        
        return [...new Set(contexts)]; // Remove duplicates
    }

    determineClaimType(text, quantifications, entities, actions) {
        // Quantified claims (have numbers/percentages)
        if (quantifications.length > 0) {
            return 'quantified';
        }
        
        // Health and medical claims
        if (/COVID|coronavirus|pandemic|virus|disease|health|medical|infection|outbreak|vaccine/i.test(text)) {
            return 'health';
        }
        
        // Corporate announcements
        if (entities.length > 0 && actions.some(action => 
            /announced|released|launched|unveiled/.test(action))) {
            return 'announcement';
        }
        
        // Scientific/research claims
        if (/research|study|scientific|discovery|breakthrough/i.test(text)) {
            return 'scientific';
        }
        
        // Technology claims
        if (/AI|technology|software|hardware|chip|processor|algorithm/i.test(text)) {
            return 'technology';
        }
        
        // Social and economic claims
        if (/economy|market|politics|government|society|community|population/i.test(text)) {
            return 'social';
        }
        
        // Environmental claims
        if (/climate|environment|weather|pollution|carbon|energy/i.test(text)) {
            return 'environmental';
        }
        
        // General claims with clear entities and actions
        if (entities.length > 0 && actions.length > 0) {
            return 'general';
        }
        
        return 'unstructured';
    }

    calculateConfidence(entities, actions, quantifications) {
        let confidence = 0.3; // Base confidence
        
        // Add confidence for found entities
        if (entities.length > 0) confidence += 0.2;
        if (entities.length > 1) confidence += 0.1;
        
        // Add confidence for found actions
        if (actions.length > 0) confidence += 0.2;
        if (actions.length > 1) confidence += 0.1;
        
        // Add confidence for quantifications
        if (quantifications.length > 0) confidence += 0.3;
        
        return Math.min(confidence, 1.0); // Cap at 1.0
    }

    extractMainSubject(text) {
        // Simple heuristic: first capitalized word or phrase
        const words = text.split(/\s+/);
        const capitalizedWords = words.filter(word => /^[A-Z]/.test(word));
        return capitalizedWords.length > 0 ? capitalizedWords[0] : 'unknown';
    }

    extractMainAction(text) {
        // Simple heuristic: first verb-like word
        const commonVerbs = ['is', 'are', 'was', 'were', 'has', 'have', 'had', 'will', 'would', 'can', 'could', 'should', 'announced', 'released', 'created'];
        const words = text.toLowerCase().split(/\s+/);
        
        for (const word of words) {
            if (commonVerbs.includes(word)) {
                return word;
            }
        }
        
        return 'relates-to';
    }

    extractMainObject(text, contexts = [], entities = []) {
        // Priority 1: Use context terms (health, tech, etc.)
        if (contexts.length > 0) {
            return contexts[0];
        }
        
        // Priority 2: Look for key health/social terms
        const healthTerms = text.match(/\b(covid|coronavirus|pandemic|virus|disease|cases|outbreak|infection|vaccine|health)\b/i);
        if (healthTerms) {
            return healthTerms[1];
        }
        
        // Priority 3: Look for important nouns (not just last word)
        const importantNouns = text.match(/\b(increase|rise|surge|spike|growth|decline|spread|transmission|raise)\b/i);
        if (importantNouns) {
            return importantNouns[1];
        }
        
        // Priority 4: Filter significant words (better logic)
        const words = text.split(/\s+/);
        const significantWords = words.filter(word => 
            word.length > 3 && 
            !/^(the|and|or|but|in|on|at|to|for|of|with|by|again|\?)$/i.test(word) &&
            !entities.includes(word) // Don't repeat entities as objects
        );
        
        return significantWords.length > 0 ? significantWords[significantWords.length - 1] : 'unknown';
    }

    /**
     * Get parser status and capabilities
     * @returns {Object} Parser status
     */
    getStatus() {
        return {
            name: 'SimpleClaimParser',
            version: '1.0.0',
            capabilities: [
                'entity_extraction',
                'action_detection', 
                'quantification_analysis',
                'context_identification',
                'claim_classification',
                'health_claims',
                'social_claims',
                'technology_claims',
                'environmental_claims'
            ],
            dependencies: 'none',
            ready: true
        };
    }
}

export default SimpleClaimParser;
