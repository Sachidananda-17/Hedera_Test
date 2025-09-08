import { HfInference } from '@huggingface/inference';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Dedicated Claim Parser Sub-Agent
 * Uses HuggingFace MiniLM for advanced claim parsing and structure extraction
 */
class ClaimParserAgent {
    constructor() {
        this.hfClient = new HfInference(process.env.HUGGINGFACE_API_KEY);
        this.name = "ClaimParserAgent";
        this.model = "microsoft/MiniLM-L6-v2";
        this.isInitialized = false;
        
        this.log("🔍 Claim Parser Agent initialized");
    }

    log(message, level = 'INFO', data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${this.name} ${level}: ${message}`);
        if (data) console.log('Data:', data);
    }

    // Initialize the agent (verify HuggingFace connection)
    async initialize() {
        try {
            this.log("🚀 Initializing HuggingFace connection...");
            
            // Test connection with a simple query
            const testEmbedding = await this.hfClient.featureExtraction({
                model: this.model,
                inputs: "test connection"
            });
            
            this.isInitialized = true;
            this.log("✅ HuggingFace connection successful", 'SUCCESS', {
                model: this.model,
                embeddingSize: testEmbedding.length
            });
            
        } catch (error) {
            this.log("⚠️ HuggingFace connection failed, will use fallback methods", 'WARN', {
                error: error.message
            });
            this.isInitialized = false;
        }
    }

    // Main parsing function called by orchestrator
    async parseClaim(claimText, metadata = {}) {
        this.log(`🧠 Starting claim parsing for text: "${claimText.substring(0, 100)}..."`);

        if (!this.isInitialized) {
            await this.initialize();
        }

        const startTime = Date.now();
        
        try {
            // Step 1: Extract basic structure using pattern matching
            const basicStructure = await this.extractBasicStructure(claimText);
            
            // Step 2: Enhance with HuggingFace semantic analysis (if available)
            const enhancedStructure = await this.enhanceWithSemantics(claimText, basicStructure);
            
            // Step 3: Validate and score the extraction
            const validatedStructure = await this.validateAndScore(enhancedStructure, claimText);
            
            const processingTime = Date.now() - startTime;
            
            const result = {
                originalText: claimText,
                structuredClaim: validatedStructure,
                processingMetadata: {
                    agentName: this.name,
                    model: this.model,
                    processingTimeMs: processingTime,
                    hfApiUsed: this.isInitialized,
                    timestamp: new Date().toISOString(),
                    ...metadata
                }
            };

            this.log("✅ Claim parsing completed", 'SUCCESS', {
                processingTime: `${processingTime}ms`,
                confidence: validatedStructure.confidence,
                claimType: validatedStructure.claimType
            });

            return result;

        } catch (error) {
            this.log("❌ Claim parsing failed", 'ERROR', { error: error.message });
            throw error;
        }
    }

    // Extract basic structure using advanced pattern matching
    async extractBasicStructure(text) {
        this.log("🔍 Extracting basic claim structure...");

        const patterns = {
            // Quantified claims (highest confidence)
            quantified: {
                regex: /(.+?)\s+(discovered|announced|showed|found|developed|created|increased|decreased|reduced|improved|reported|demonstrated)\s+(.+?)\s+(?:by|to|of|at)\s+(\d+(?:\.\d+)?(?:%|percent|\s*times?|\s*x))/gi,
                confidence: 0.9,
                type: 'quantified'
            },
            
            // Comparative claims
            comparative: {
                regex: /(.+?)\s+(is|are|was|were)\s+(more|less|better|worse|faster|slower|higher|lower|greater|smaller)\s+(.+?)\s+(?:than|compared to)\s+(.+)/gi,
                confidence: 0.85,
                type: 'comparative'
            },
            
            // Scientific/research claims
            scientific: {
                regex: /(researchers?|scientists?|study|research|clinical trial|experiment)\s+(.+?)\s+(found|discovered|showed|revealed|demonstrated|concluded)\s+(.+)/gi,
                confidence: 0.8,
                type: 'scientific'
            },
            
            // Company/organizational announcements
            organizational: {
                regex: /(company|corporation|organization|team|university|institute)\s+([A-Z][A-Za-z\s&]+?)\s+(announced|launched|developed|created|released)\s+(.+)/gi,
                confidence: 0.75,
                type: 'organizational'
            },
            
            // General subject-verb-object
            general: {
                regex: /(.+?)\s+(is|are|was|were|will be|has|have|had|does|do|did)\s+(.+)/gi,
                confidence: 0.6,
                type: 'general'
            }
        };

        // Try patterns in order of confidence
        for (const [patternName, patternData] of Object.entries(patterns)) {
            const match = patternData.regex.exec(text);
            if (match) {
                let structure = this.buildStructureFromMatch(match, patternData);
                structure.entities = this.extractAdvancedEntities(text);
                structure.extractionMethod = patternName;
                
                this.log(`📊 Pattern matched: ${patternName}`, 'SUCCESS', structure);
                return structure;
            }
        }

        // Fallback: create structure from text analysis
        return this.createFallbackStructure(text);
    }

    // Build structured data from regex match
    buildStructureFromMatch(match, patternData) {
        switch (patternData.type) {
            case 'quantified':
                return {
                    subject: match[1].trim(),
                    predicate: match[2].trim(),
                    object: match[3].trim(),
                    quantifier: match[4].trim(),
                    claimType: 'quantified',
                    confidence: patternData.confidence
                };
            
            case 'comparative':
                return {
                    subject: match[1].trim(),
                    predicate: `${match[2]} ${match[3]}`.trim(),
                    object: match[4].trim(),
                    comparison: match[5].trim(),
                    claimType: 'comparative',
                    confidence: patternData.confidence
                };
            
            case 'scientific':
                return {
                    subject: match[1].trim(),
                    predicate: match[3].trim(),
                    object: match[4].trim(),
                    methodology: match[2].trim(),
                    claimType: 'scientific',
                    confidence: patternData.confidence
                };
            
            case 'organizational':
                return {
                    subject: `${match[1]} ${match[2]}`.trim(),
                    predicate: match[3].trim(),
                    object: match[4].trim(),
                    claimType: 'organizational',
                    confidence: patternData.confidence
                };
            
            default: // general
                return {
                    subject: match[1].trim(),
                    predicate: match[2].trim(),
                    object: match[3].trim(),
                    claimType: 'general',
                    confidence: patternData.confidence
                };
        }
    }

    // Create fallback structure when no patterns match
    createFallbackStructure(text) {
        this.log("🔧 Creating fallback structure...");
        
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const mainSentence = sentences[0] || text;
        const words = mainSentence.trim().split(/\s+/);
        
        if (words.length < 3) {
            return {
                subject: text.trim(),
                predicate: 'mentions',
                object: 'topic',
                claimType: 'fragment',
                confidence: 0.3,
                extractionMethod: 'fallback'
            };
        }

        // Find verb position
        const commonVerbs = ['is', 'are', 'was', 'were', 'has', 'have', 'will', 'can', 'could', 'should', 'would', 'did', 'does', 'do'];
        let verbIndex = words.findIndex(word => commonVerbs.includes(word.toLowerCase()));
        
        if (verbIndex === -1) {
            verbIndex = Math.floor(words.length / 2);
        }

        return {
            subject: words.slice(0, verbIndex).join(' '),
            predicate: words[verbIndex],
            object: words.slice(verbIndex + 1).join(' '),
            claimType: 'parsed',
            confidence: 0.4,
            extractionMethod: 'fallback'
        };
    }

    // Extract advanced entities from text
    extractAdvancedEntities(text) {
        const entities = {
            organizations: [],
            people: [],
            numbers: [],
            percentages: [],
            dates: [],
            locations: [],
            technologies: [],
            medical_terms: [],
            measurements: []
        };

        // Organizations
        const orgPatterns = [
            /\b(company|corp\.?|corporation|inc\.?|ltd\.?)\s+([A-Z][A-Za-z\s&]+)/gi,
            /\b(university|college|institute)\s+of\s+([A-Z][A-Za-z\s]+)/gi,
            /\b([A-Z][A-Za-z\s&]+)\s+(university|college|institute|laboratory|lab|agency|department)/gi
        ];
        
        orgPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                entities.organizations.push(match[0].trim());
            }
        });

        // People (simplified)
        const peoplePattern = /\b(?:Dr\.?|Prof\.?|Mr\.?|Ms\.?|Mrs\.?)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/g;
        let match;
        while ((match = peoplePattern.exec(text)) !== null) {
            entities.people.push(match[0].trim());
        }

        // Numbers and percentages
        const numberPattern = /\b(\d+(?:\.\d+)?)\s*(%|percent|times?|x|fold)\b/gi;
        while ((match = numberPattern.exec(text)) !== null) {
            if (match[2] === '%' || match[2] === 'percent') {
                entities.percentages.push(match[0]);
            } else {
                entities.numbers.push(match[0]);
            }
        }

        // Measurements
        const measurementPattern = /\b(\d+(?:\.\d+)?)\s*(mg|kg|grams?|pounds?|meters?|feet|inches?|degrees?|celsius|fahrenheit)\b/gi;
        while ((match = measurementPattern.exec(text)) !== null) {
            entities.measurements.push(match[0]);
        }

        // Dates
        const datePattern = /\b(\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|January|February|March|April|May|June|July|August|September|October|November|December)\b/gi;
        while ((match = datePattern.exec(text)) !== null) {
            entities.dates.push(match[0]);
        }

        // Technology terms
        const techTerms = /\b(AI|artificial intelligence|machine learning|ML|blockchain|quantum|biotech|nanotech|solar|renewable|algorithm|protocol|software|hardware|app|application|platform|system|technology|innovation|digital|cyber|cloud|IoT|5G|VR|AR)\b/gi;
        while ((match = techTerms.exec(text)) !== null) {
            if (!entities.technologies.includes(match[0])) {
                entities.technologies.push(match[0]);
            }
        }

        // Medical terms
        const medicalTerms = /\b(cancer|tumor|disease|treatment|therapy|drug|medicine|vaccine|clinical|patient|hospital|surgery|diagnosis|symptom|virus|bacteria|infection|antibody|protein|gene|DNA|RNA)\b/gi;
        while ((match = medicalTerms.exec(text)) !== null) {
            if (!entities.medical_terms.includes(match[0])) {
                entities.medical_terms.push(match[0]);
            }
        }

        return entities;
    }

    // Enhance structure with HuggingFace semantic analysis
    async enhanceWithSemantics(text, basicStructure) {
        if (!this.isInitialized) {
            this.log("⚠️ HuggingFace not available, skipping semantic enhancement");
            return basicStructure;
        }

        try {
            this.log("🧠 Enhancing with HuggingFace semantic analysis...");

            // Get embeddings for the full text
            const fullTextEmbedding = await this.hfClient.featureExtraction({
                model: this.model,
                inputs: text
            });

            // Get embeddings for individual components
            const subjectEmbedding = await this.hfClient.featureExtraction({
                model: this.model,
                inputs: basicStructure.subject
            });

            const objectEmbedding = await this.hfClient.featureExtraction({
                model: this.model,
                inputs: basicStructure.object
            });

            // Calculate semantic coherence
            const coherenceScore = this.calculateSemanticCoherence(
                fullTextEmbedding,
                subjectEmbedding,
                objectEmbedding
            );

            const enhancedStructure = {
                ...basicStructure,
                semanticAnalysis: {
                    model: this.model,
                    coherenceScore,
                    fullTextEmbedding: fullTextEmbedding.slice(0, 10), // First 10 dimensions for logging
                    embeddingDimensions: fullTextEmbedding.length,
                    confidenceBoost: coherenceScore > 0.7 ? 0.1 : 0
                }
            };

            // Boost confidence if semantics are coherent
            enhancedStructure.confidence = Math.min(
                enhancedStructure.confidence + enhancedStructure.semanticAnalysis.confidenceBoost,
                0.95
            );

            this.log("✅ Semantic enhancement completed", 'SUCCESS', {
                coherenceScore,
                originalConfidence: basicStructure.confidence,
                enhancedConfidence: enhancedStructure.confidence
            });

            return enhancedStructure;

        } catch (error) {
            this.log("⚠️ Semantic enhancement failed, using basic structure", 'WARN', {
                error: error.message
            });
            return basicStructure;
        }
    }

    // Calculate semantic coherence score
    calculateSemanticCoherence(fullEmbedding, subjectEmbedding, objectEmbedding) {
        // Simple cosine similarity calculation
        const dotProduct = (a, b) => a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magnitude = arr => Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0));
        
        const cosineSimilarity = (a, b) => {
            const dot = dotProduct(a, b);
            const magA = magnitude(a);
            const magB = magnitude(b);
            return dot / (magA * magB);
        };

        // Calculate coherence as average similarity
        const subjectCoherence = cosineSimilarity(fullEmbedding, subjectEmbedding);
        const objectCoherence = cosineSimilarity(fullEmbedding, objectEmbedding);
        
        return (subjectCoherence + objectCoherence) / 2;
    }

    // Validate and score the final structure
    async validateAndScore(structure, originalText) {
        this.log("✅ Validating and scoring claim structure...");

        let validationScore = structure.confidence;
        const validations = [];

        // Check for complete subject-predicate-object
        if (structure.subject && structure.predicate && structure.object) {
            validationScore += 0.1;
            validations.push("Complete S-P-O structure");
        }

        // Bonus for quantified claims
        if (structure.quantifier) {
            validationScore += 0.15;
            validations.push("Quantified claim detected");
        }

        // Bonus for rich entity extraction
        if (structure.entities && Object.values(structure.entities).some(arr => arr.length > 0)) {
            validationScore += 0.05;
            validations.push("Rich entity extraction");
        }

        // Penalty for very short components
        if (structure.subject && structure.subject.length < 3) {
            validationScore -= 0.1;
            validations.push("Short subject penalty");
        }

        if (structure.object && structure.object.length < 3) {
            validationScore -= 0.1;
            validations.push("Short object penalty");
        }

        // Semantic coherence bonus (if available)
        if (structure.semanticAnalysis?.coherenceScore > 0.7) {
            validationScore += 0.1;
            validations.push("High semantic coherence");
        }

        // Final score normalization
        validationScore = Math.max(0.1, Math.min(validationScore, 0.95));

        const validatedStructure = {
            ...structure,
            confidence: validationScore,
            validations,
            qualityMetrics: {
                completeness: this.calculateCompleteness(structure),
                specificity: this.calculateSpecificity(structure),
                reliability: this.calculateReliability(structure, originalText)
            }
        };

        this.log("📊 Validation completed", 'SUCCESS', {
            finalConfidence: validationScore,
            validations: validations.length,
            qualityScore: (validatedStructure.qualityMetrics.completeness + 
                          validatedStructure.qualityMetrics.specificity + 
                          validatedStructure.qualityMetrics.reliability) / 3
        });

        return validatedStructure;
    }

    // Calculate completeness score
    calculateCompleteness(structure) {
        let score = 0;
        if (structure.subject) score += 0.33;
        if (structure.predicate) score += 0.33;
        if (structure.object) score += 0.34;
        return score;
    }

    // Calculate specificity score
    calculateSpecificity(structure) {
        let score = 0.5; // Base score
        
        // Bonus for quantifiers
        if (structure.quantifier) score += 0.2;
        
        // Bonus for entities
        if (structure.entities) {
            const entityCount = Object.values(structure.entities).flat().length;
            score += Math.min(entityCount * 0.05, 0.3);
        }

        // Bonus for specific claim types
        if (['quantified', 'scientific', 'comparative'].includes(structure.claimType)) {
            score += 0.1;
        }

        return Math.min(score, 1.0);
    }

    // Calculate reliability score
    calculateReliability(structure, originalText) {
        let score = 0.5; // Base score

        // Bonus for scientific language
        const scientificTerms = ['study', 'research', 'analysis', 'data', 'evidence', 'results'];
        const hasScientificTerms = scientificTerms.some(term => 
            originalText.toLowerCase().includes(term)
        );
        if (hasScientificTerms) score += 0.2;

        // Bonus for quantified claims
        if (structure.quantifier) score += 0.2;

        // Penalty for vague language
        const vagueTerms = ['maybe', 'possibly', 'might', 'could be', 'seems'];
        const hasVagueTerms = vagueTerms.some(term => 
            originalText.toLowerCase().includes(term)
        );
        if (hasVagueTerms) score -= 0.2;

        return Math.max(0.1, Math.min(score, 1.0));
    }

    // Get agent status
    getStatus() {
        return {
            name: this.name,
            model: this.model,
            initialized: this.isInitialized,
            capabilities: [
                'pattern_matching',
                'entity_extraction',
                'semantic_analysis',
                'structure_validation',
                'quality_scoring'
            ]
        };
    }
}

export default ClaimParserAgent;
