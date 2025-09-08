import dotenv from 'dotenv';
import axios from 'axios';
import { HfInference } from '@huggingface/inference';

dotenv.config();

/**
 * Phase 2: Fetch.ai Orchestrator Agent Workflow
 * 
 * This orchestrator implements:
 * 1. Listening for new CIDs from Hedera (mocked input)
 * 2. Fetching claim text from IPFS
 * 3. Parsing claims using HuggingFace MiniLM
 * 4. Returning structured claim data (subject, predicate, object)
 * 5. Comprehensive logging and evidence preparation
 */
class Phase2Orchestrator {
    constructor() {
        this.hfClient = new HfInference(process.env.HUGGINGFACE_API_KEY);
        this.isRunning = false;
        this.processedClaims = new Map();
        
        // IPFS gateways for content fetching
        this.ipfsGateways = [
            'https://ipfs.filebase.io/ipfs/',
            'https://ipfs.io/ipfs/',
            'https://gateway.pinata.cloud/ipfs/',
            'https://cloudflare-ipfs.com/ipfs/',
            'https://dweb.link/ipfs/'
        ];

        this.log("🤖 Phase 2 Orchestrator initialized");
    }

    // Comprehensive logging system
    log(message, level = 'INFO', data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data: data ? JSON.stringify(data, null, 2) : null
        };
        
        console.log(`[${timestamp}] ${level}: ${message}`);
        if (data) {
            console.log(`Data:`, data);
        }
        
        return logEntry;
    }

    // Step 1: Listen for new CIDs from Hedera (mocked input initially)
    async startOrchestrator() {
        this.isRunning = true;
        this.log("🚀 Starting Phase 2 Orchestrator with mocked CID input");

        // Mock CID inputs for testing
        const mockCIDs = [
            {
                cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG", // Real example CID
                source: "hedera_testnet",
                topicId: "0.0.123456",
                transactionHash: "0.0.123456@1757111002.767860785",
                timestamp: new Date().toISOString()
            },
            {
                cid: "QmRjQtQ6HdqhddTJCiXnvStgzQ4oGtQfyA9PJsG4b1Uj5N", // Another example
                source: "hedera_testnet", 
                topicId: "0.0.123456",
                transactionHash: "0.0.123456@1757111002.767860786",
                timestamp: new Date().toISOString()
            }
        ];

        // Process mock CIDs every 30 seconds for testing
        let cidIndex = 0;
        const processInterval = setInterval(async () => {
            if (!this.isRunning || cidIndex >= mockCIDs.length) {
                clearInterval(processInterval);
                this.log("🛑 Orchestrator stopped - no more mock CIDs to process");
                return;
            }

            const cidData = mockCIDs[cidIndex];
            this.log(`📥 New CID received from Hedera`, 'INFO', cidData);
            
            try {
                await this.processClaim(cidData);
            } catch (error) {
                this.log(`❌ Error processing CID ${cidData.cid}`, 'ERROR', { error: error.message });
            }
            
            cidIndex++;
        }, 30000); // Process every 30 seconds

        this.log("⏰ Orchestrator running - will process mock CIDs every 30 seconds");
        
        // Process first CID immediately for demo
        if (mockCIDs.length > 0) {
            this.log("🎬 Processing first CID immediately for demo");
            await this.processClaim(mockCIDs[0]);
        }
    }

    // Main workflow processor
    async processClaim(cidData) {
        const startTime = Date.now();
        this.log(`🔄 Starting claim processing for CID: ${cidData.cid}`);

        try {
            // Step 2: Fetch claim text from IPFS
            const claimText = await this.fetchIPFSContent(cidData.cid);
            
            if (!claimText) {
                throw new Error('Failed to fetch content from IPFS');
            }

            // Step 3: Parse claim using HuggingFace MiniLM
            const structuredClaim = await this.parseClaimWithAI(claimText);

            // Step 4: Prepare final result
            const processedClaim = {
                cid: cidData.cid,
                originalText: claimText,
                structuredData: structuredClaim,
                metadata: {
                    source: cidData.source,
                    topicId: cidData.topicId,
                    transactionHash: cidData.transactionHash,
                    processedAt: new Date().toISOString(),
                    processingTimeMs: Date.now() - startTime
                }
            };

            // Step 5: Store and log the result
            this.processedClaims.set(cidData.cid, processedClaim);
            this.log(`✅ Claim processing completed for CID: ${cidData.cid}`, 'SUCCESS', {
                processingTime: `${Date.now() - startTime}ms`,
                structuredClaim: processedClaim.structuredData
            });

            // Prepare for evidence retrieval (Phase 3 preparation)
            await this.prepareForEvidenceRetrieval(processedClaim);

            return processedClaim;

        } catch (error) {
            this.log(`❌ Claim processing failed for CID: ${cidData.cid}`, 'ERROR', { 
                error: error.message,
                processingTime: `${Date.now() - startTime}ms`
            });
            throw error;
        }
    }

    // Step 2: Fetch claim text from IPFS using CID
    async fetchIPFSContent(cid) {
        this.log(`📡 Fetching content from IPFS for CID: ${cid}`);

        // Try multiple IPFS gateways for reliability
        for (const gateway of this.ipfsGateways) {
            try {
                const url = `${gateway}${cid}`;
                this.log(`🔍 Trying gateway: ${gateway}`);

                const response = await axios.get(url, {
                    timeout: 10000, // 10 second timeout
                    headers: {
                        'Accept': 'text/plain, application/json, */*'
                    }
                });

                if (response.status === 200 && response.data) {
                    let content = response.data;
                    
                    // Handle different content types
                    if (typeof content === 'object') {
                        content = JSON.stringify(content, null, 2);
                    }

                    this.log(`✅ Successfully fetched content from ${gateway}`, 'SUCCESS', {
                        contentLength: content.length,
                        contentType: response.headers['content-type'],
                        preview: content.substring(0, 100) + (content.length > 100 ? '...' : '')
                    });

                    return content;
                }
            } catch (error) {
                this.log(`⚠️ Gateway ${gateway} failed`, 'WARN', { error: error.message });
                continue;
            }
        }

        // If all gateways fail, return mock data for demo
        this.log(`🎭 All IPFS gateways failed, using mock claim data for demo`, 'WARN');
        return this.getMockClaimData(cid);
    }

    // Mock claim data for testing when IPFS fails
    getMockClaimData(cid) {
        const mockClaims = {
            "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG": "The company XYZ announced a new AI product that increases productivity by 50% compared to traditional methods.",
            "QmRjQtQ6HdqhddTJCiXnvStgzQ4oGtQfyA9PJsG4b1Uj5N": "Scientists at University ABC discovered a new treatment that reduces cancer cell growth by 75% in laboratory tests.",
            "default": "The research team published findings showing that renewable energy adoption increased by 30% in developing countries during 2024."
        };

        return mockClaims[cid] || mockClaims.default;
    }

    // Step 3: Parse claim using HuggingFace MiniLM (microsoft/MiniLM-L6-v2)
    async parseClaimWithAI(claimText) {
        this.log(`🧠 Parsing claim with HuggingFace MiniLM`, 'INFO', { textLength: claimText.length });

        try {
            // For Phase 2, we'll use a combination of approaches:
            // 1. Extract key entities and relationships
            // 2. Structure into subject-predicate-object format
            // 3. Use HuggingFace for semantic analysis

            // Basic entity extraction using simple patterns (will be enhanced with actual AI)
            const structuredClaim = await this.extractClaimStructure(claimText);

            // Use HuggingFace for semantic embeddings and similarity
            try {
                const embeddings = await this.hfClient.featureExtraction({
                    model: 'microsoft/MiniLM-L6-v2',
                    inputs: claimText
                });

                structuredClaim.semanticEmbedding = {
                    model: 'microsoft/MiniLM-L6-v2',
                    embeddingSize: embeddings.length,
                    confidence: 0.85 // Mock confidence for now
                };

                this.log(`✅ HuggingFace embedding generated`, 'SUCCESS', {
                    embeddingSize: embeddings.length,
                    model: 'microsoft/MiniLM-L6-v2'
                });

            } catch (hfError) {
                this.log(`⚠️ HuggingFace API call failed, using local parsing`, 'WARN', { error: hfError.message });
                structuredClaim.semanticEmbedding = {
                    model: 'local_fallback',
                    note: 'HuggingFace API unavailable, using pattern-based parsing',
                    confidence: 0.65
                };
            }

            return structuredClaim;

        } catch (error) {
            this.log(`❌ Claim parsing failed`, 'ERROR', { error: error.message });
            throw error;
        }
    }

    // Step 4: Extract structured claim data (subject, predicate, object)
    async extractClaimStructure(text) {
        this.log(`🔍 Extracting claim structure from text`);

        // Advanced pattern matching for subject-predicate-object extraction
        const patterns = {
            // Pattern: Subject + Verb + Object + Quantifier
            quantified: /(.+?)\s+(discovered|announced|showed|found|developed|created|increased|decreased|reduced|improved)\s+(.+?)\s+(?:by|to|of)\s+(\d+%|\d+\s*times|\d+x)/gi,
            
            // Pattern: Organization/Person + Action + Result
            organizational: /(company|university|team|scientists?|researchers?)\s+([A-Z][A-Za-z\s]+?)\s+(discovered|announced|developed|found|created|published)\s+(.+)/gi,
            
            // Pattern: General subject-verb-object
            general: /(.+?)\s+(is|are|was|were|will be|has|have|had)\s+(.+)/gi
        };

        let structuredData = {
            subject: null,
            predicate: null,
            object: null,
            quantifier: null,
            entities: [],
            claimType: 'general',
            confidence: 0.0
        };

        // Try quantified pattern first (highest confidence)
        let match = patterns.quantified.exec(text);
        if (match) {
            structuredData = {
                subject: match[1].trim(),
                predicate: match[2].trim(),
                object: match[3].trim(),
                quantifier: match[4].trim(),
                entities: this.extractEntities(match[1] + ' ' + match[3]),
                claimType: 'quantified',
                confidence: 0.9
            };
            this.log(`📊 Quantified claim structure extracted`, 'SUCCESS', structuredData);
            return structuredData;
        }

        // Try organizational pattern
        patterns.organizational.lastIndex = 0;
        match = patterns.organizational.exec(text);
        if (match) {
            structuredData = {
                subject: `${match[1]} ${match[2]}`.trim(),
                predicate: match[3].trim(),
                object: match[4].trim(),
                quantifier: null,
                entities: this.extractEntities(text),
                claimType: 'organizational',
                confidence: 0.8
            };
            this.log(`🏢 Organizational claim structure extracted`, 'SUCCESS', structuredData);
            return structuredData;
        }

        // Fall back to general pattern
        patterns.general.lastIndex = 0;
        match = patterns.general.exec(text);
        if (match) {
            structuredData = {
                subject: match[1].trim(),
                predicate: match[2].trim(),
                object: match[3].trim(),
                quantifier: null,
                entities: this.extractEntities(text),
                claimType: 'general',
                confidence: 0.6
            };
            this.log(`📝 General claim structure extracted`, 'SUCCESS', structuredData);
            return structuredData;
        }

        // If no patterns match, create a basic structure
        const words = text.split(' ');
        if (words.length >= 3) {
            structuredData = {
                subject: words.slice(0, Math.ceil(words.length / 3)).join(' '),
                predicate: words[Math.ceil(words.length / 2)],
                object: words.slice(Math.ceil(words.length * 2 / 3)).join(' '),
                quantifier: null,
                entities: this.extractEntities(text),
                claimType: 'fallback',
                confidence: 0.4
            };
        }

        this.log(`🔧 Fallback claim structure created`, 'INFO', structuredData);
        return structuredData;
    }

    // Enhanced entity extraction
    extractEntities(text) {
        const entities = {
            organizations: [],
            numbers: [],
            percentages: [],
            locations: [],
            technologies: []
        };

        // Extract organizations
        const orgPatterns = /\b(company|corporation|university|institute|team|laboratory|lab|agency|department|group)\s+([A-Z][A-Za-z\s]+)/gi;
        let match;
        while ((match = orgPatterns.exec(text)) !== null) {
            entities.organizations.push(match[0].trim());
        }

        // Extract numbers and percentages
        const numberPatterns = /\b(\d+(?:\.\d+)?)\s*(%|percent|times?|x)\b/gi;
        while ((match = numberPatterns.exec(text)) !== null) {
            if (match[2] === '%' || match[2] === 'percent') {
                entities.percentages.push(match[0].trim());
            } else {
                entities.numbers.push(match[0].trim());
            }
        }

        // Extract technology/science terms
        const techPatterns = /\b(AI|artificial intelligence|machine learning|blockchain|quantum|biotech|nanotech|renewable energy|solar|cancer|treatment|drug|vaccine|algorithm|protocol|system|technology|innovation)\b/gi;
        while ((match = techPatterns.exec(text)) !== null) {
            if (!entities.technologies.includes(match[0])) {
                entities.technologies.push(match[0]);
            }
        }

        return entities;
    }

    // Step 5: Prepare for evidence retrieval (Phase 3 preparation)
    async prepareForEvidenceRetrieval(processedClaim) {
        this.log(`🔎 Preparing claim for evidence retrieval phase`, 'INFO', {
            cid: processedClaim.cid,
            claimType: processedClaim.structuredData.claimType
        });

        // Generate search queries based on structured data
        const searchQueries = this.generateSearchQueries(processedClaim.structuredData);

        // Create evidence retrieval plan
        const evidenceRetrievalPlan = {
            cid: processedClaim.cid,
            searchQueries,
            priorityLevel: this.calculatePriorityLevel(processedClaim.structuredData),
            evidenceTypes: this.identifyRequiredEvidence(processedClaim.structuredData),
            readyForPhase3: true,
            preparedAt: new Date().toISOString()
        };

        // Store the plan for Phase 3
        this.processedClaims.get(processedClaim.cid).evidenceRetrievalPlan = evidenceRetrievalPlan;

        this.log(`✅ Evidence retrieval plan prepared`, 'SUCCESS', evidenceRetrievalPlan);
        return evidenceRetrievalPlan;
    }

    // Generate search queries for evidence gathering
    generateSearchQueries(structuredClaim) {
        const queries = [];

        // Primary query: exact subject + object
        if (structuredClaim.subject && structuredClaim.object) {
            queries.push(`"${structuredClaim.subject}" ${structuredClaim.predicate} "${structuredClaim.object}"`);
        }

        // Secondary queries: entity-based
        if (structuredClaim.entities.organizations.length > 0) {
            queries.push(`"${structuredClaim.entities.organizations[0]}" research findings`);
        }

        // Quantified claims get special treatment
        if (structuredClaim.quantifier) {
            queries.push(`${structuredClaim.subject} ${structuredClaim.quantifier} study verification`);
        }

        // Technology-specific queries
        structuredClaim.entities.technologies.forEach(tech => {
            queries.push(`${tech} recent research 2024`);
        });

        return queries.slice(0, 5); // Limit to 5 queries for efficiency
    }

    // Calculate priority level for evidence retrieval
    calculatePriorityLevel(structuredClaim) {
        let priority = 1; // Default priority

        // Higher priority for quantified claims
        if (structuredClaim.quantifier) priority += 2;
        
        // Higher priority for organizational claims
        if (structuredClaim.claimType === 'organizational') priority += 1;
        
        // Higher priority for medical/scientific claims
        const medicalTerms = ['cancer', 'treatment', 'drug', 'vaccine', 'medical', 'clinical'];
        if (medicalTerms.some(term => 
            structuredClaim.object.toLowerCase().includes(term) ||
            structuredClaim.subject.toLowerCase().includes(term)
        )) {
            priority += 3;
        }

        return Math.min(priority, 5); // Max priority of 5
    }

    // Identify required evidence types
    identifyRequiredEvidence(structuredClaim) {
        const evidenceTypes = ['web_search'];

        // Quantified claims need statistical verification
        if (structuredClaim.quantifier) {
            evidenceTypes.push('statistical_data', 'peer_reviewed_papers');
        }

        // Organizational claims need source verification
        if (structuredClaim.entities.organizations.length > 0) {
            evidenceTypes.push('official_announcements', 'press_releases');
        }

        // Medical/scientific claims need academic verification
        const scientificTerms = ['study', 'research', 'clinical', 'laboratory', 'experiment'];
        if (scientificTerms.some(term => structuredClaim.object.toLowerCase().includes(term))) {
            evidenceTypes.push('academic_papers', 'research_databases');
        }

        return evidenceTypes;
    }

    // Utility: Get processing statistics
    getProcessingStats() {
        const stats = {
            totalProcessed: this.processedClaims.size,
            claimTypes: {},
            averageConfidence: 0,
            readyForEvidence: 0
        };

        let totalConfidence = 0;

        for (const [cid, claim] of this.processedClaims) {
            const claimType = claim.structuredData.claimType;
            stats.claimTypes[claimType] = (stats.claimTypes[claimType] || 0) + 1;
            
            totalConfidence += claim.structuredData.confidence;
            
            if (claim.evidenceRetrievalPlan?.readyForPhase3) {
                stats.readyForEvidence++;
            }
        }

        if (this.processedClaims.size > 0) {
            stats.averageConfidence = (totalConfidence / this.processedClaims.size).toFixed(2);
        }

        return stats;
    }

    // Stop the orchestrator
    stop() {
        this.isRunning = false;
        this.log("🛑 Phase 2 Orchestrator stopped");
    }

    // Get all processed claims
    getAllProcessedClaims() {
        return Array.from(this.processedClaims.values());
    }
}

// Export for use in other modules
export default Phase2Orchestrator;

// Main execution if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const orchestrator = new Phase2Orchestrator();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down orchestrator...');
        orchestrator.stop();
        
        const stats = orchestrator.getProcessingStats();
        console.log('\n📊 Final Processing Statistics:');
        console.log(JSON.stringify(stats, null, 2));
        
        process.exit(0);
    });

    // Start the orchestrator
    orchestrator.startOrchestrator().catch(error => {
        console.error('❌ Failed to start orchestrator:', error);
        process.exit(1);
    });
}
