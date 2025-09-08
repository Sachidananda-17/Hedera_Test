import axios from 'axios';
import { Client, AccountId, PrivateKey } from '@hashgraph/sdk';
import { config } from '../../config/env/config.js';
import ClaimParser from '../parsers/claim-parser.js';

/**
 * Main Phase 2 Orchestrator (Production)
 * Real-time processing of claims from Hedera Consensus Service
 * Uses unified configuration system
 */
class MainOrchestrator {
    constructor() {
        this.hederaClient = null;
        this.claimParser = new ClaimParser();
        this.isRunning = false;
        this.processedClaims = new Map();
        this.mirrorNodeUrl = config.hedera.mirrorNodeUrl;
        this.lastProcessedTimestamp = null;
        this.pollInterval = config.agents.pollInterval;
        
        // IPFS gateways from configuration
        this.ipfsGateways = config.ipfs.gateways;

        this.log("🚀 Main Phase 2 Orchestrator initialized", 'INFO', {
            mirrorNodeUrl: this.mirrorNodeUrl,
            pollInterval: this.pollInterval,
            gatewayCount: this.ipfsGateways.length
        });
        this.initializeHedera();
    }

    // Initialize Hedera client
    async initializeHedera() {
        try {
            this.hederaClient = Client.forTestnet();
            
            if (config.hedera.accountId && config.hedera.privateKey) {
                this.hederaClient.setOperator(
                    AccountId.fromString(config.hedera.accountId),
                    PrivateKey.fromStringECDSA(config.hedera.privateKey)
                );
                this.log("✅ Hedera client initialized", 'SUCCESS', {
                    network: config.hedera.network,
                    accountId: config.hedera.accountId
                });
            } else {
                throw new Error('Hedera credentials not found in configuration');
            }
        } catch (error) {
            this.log("❌ Failed to initialize Hedera client", 'ERROR', { error: error.message });
            this.hederaClient = null;
        }
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
        
        console.log(`[${timestamp}] PROD-ORCHESTRATOR ${level}: ${message}`);
        if (data) {
            console.log(`Data:`, data);
        }
        
        return logEntry;
    }

    // Start real-time orchestrator
    async startRealTimeProcessing() {
        if (!this.hederaClient) {
            throw new Error('Hedera client not initialized');
        }

        this.isRunning = true;
        this.log("🎬 Starting real-time claim processing from Hedera network");

        // Initialize claim parser
        await this.claimParser.initialize();

        // Set starting timestamp to now
        this.lastProcessedTimestamp = new Date().toISOString();
        this.log("📅 Starting from timestamp", 'INFO', { 
            startTime: this.lastProcessedTimestamp 
        });

        // Start polling Mirror Node for new transactions
        this.startMirrorNodePolling();

        this.log("✅ Real-time orchestrator is now running", 'SUCCESS');
    }

    // Poll Hedera Mirror Node for new transactions
    startMirrorNodePolling() {
        const pollForNewTransactions = async () => {
            if (!this.isRunning) return;

            try {
                await this.checkForNewTransactions();
            } catch (error) {
                this.log("⚠️ Error during polling", 'WARN', { error: error.message });
            }

            // Schedule next poll
            setTimeout(pollForNewTransactions, this.pollInterval);
        };

        // Start polling
        pollForNewTransactions();
        this.log(`🔄 Started polling Mirror Node every ${this.pollInterval/1000}s`);
    }

    // Check Mirror Node for new transactions
    async checkForNewTransactions() {
        try {
            const accountId = process.env.HEDERA_ACCOUNT_ID;
            
            // Query Mirror Node for recent transactions from our account
            const url = `${this.mirrorNodeUrl}/api/v1/transactions`;
            const params = {
                'account.id': accountId,
                order: 'desc',
                limit: 50,
                timestamp: `gt:${this.convertToMirrorNodeTimestamp(this.lastProcessedTimestamp)}`
            };

            const response = await axios.get(url, { params });
            const transactions = response.data.transactions || [];

            this.log(`🔍 Found ${transactions.length} new transactions`, 'INFO');

            // Process each transaction
            for (const transaction of transactions) {
                await this.processTransaction(transaction);
            }

            // Update last processed timestamp
            if (transactions.length > 0) {
                this.lastProcessedTimestamp = new Date(transactions[0].consensus_timestamp * 1000).toISOString();
                this.log("📅 Updated last processed timestamp", 'INFO', {
                    timestamp: this.lastProcessedTimestamp
                });
            }

        } catch (error) {
            this.log("❌ Failed to check for new transactions", 'ERROR', { 
                error: error.message 
            });
        }
    }

    // Process individual Hedera transaction
    async processTransaction(transaction) {
        try {
            // Look for Topic Message Submit transactions with memo containing CID
            if (transaction.name !== 'CONSENSUSSUBMITMESSAGE') {
                return; // Skip non-topic transactions
            }

            // Extract CID from transaction memo
            const memo = transaction.memo_base64 ? 
                Buffer.from(transaction.memo_base64, 'base64').toString('utf8') : '';

            const cidMatch = memo.match(/CID:([A-Za-z0-9]+)/);
            if (!cidMatch) {
                return; // Skip transactions without CID in memo
            }

            const cid = cidMatch[1];
            const transactionId = transaction.transaction_id;
            const timestamp = new Date(transaction.consensus_timestamp * 1000).toISOString();

            this.log(`📥 New claim detected`, 'INFO', {
                cid,
                transactionId,
                timestamp,
                memo: memo.substring(0, 100) + '...'
            });

            // Create claim data object
            const claimData = {
                cid,
                source: 'hedera_testnet',
                topicId: transaction.entity_id,
                transactionId,
                transactionHash: transactionId,
                consensusTimestamp: timestamp,
                memo,
                mirrorNodeData: {
                    charged_tx_fee: transaction.charged_tx_fee,
                    max_fee: transaction.max_fee,
                    result: transaction.result
                }
            };

            // Process the claim
            await this.processClaim(claimData);

        } catch (error) {
            this.log("❌ Error processing transaction", 'ERROR', { 
                transactionId: transaction.transaction_id,
                error: error.message 
            });
        }
    }

    // Convert ISO timestamp to Mirror Node format
    convertToMirrorNodeTimestamp(isoTimestamp) {
        return Math.floor(new Date(isoTimestamp).getTime() / 1000);
    }

    // Main claim processing workflow (updated for production)
    async processClaim(claimData) {
        const startTime = Date.now();
        this.log(`🔄 Processing claim from CID: ${claimData.cid}`);

        // Skip if already processed
        if (this.processedClaims.has(claimData.cid)) {
            this.log(`⏭️ Claim already processed, skipping: ${claimData.cid}`);
            return this.processedClaims.get(claimData.cid);
        }

        try {
            // Step 1: Fetch claim text from IPFS (REAL, no mocking)
            const claimText = await this.fetchIPFSContent(claimData.cid);
            
            if (!claimText) {
                throw new Error(`Failed to fetch content from IPFS for CID: ${claimData.cid}`);
            }

            this.log(`📄 Content fetched from IPFS`, 'SUCCESS', {
                cid: claimData.cid,
                contentLength: claimText.length,
                preview: claimText.substring(0, 100) + '...'
            });

            // Step 2: Parse claim with AI (REAL HuggingFace, no mocking)
            const parsingResult = await this.claimParser.parseClaim(claimText, {
                source: 'production',
                cid: claimData.cid,
                hederaData: claimData
            });

            // Step 3: Prepare final processed claim
            const processedClaim = {
                cid: claimData.cid,
                originalText: claimText,
                structuredData: parsingResult.structuredClaim,
                hederaMetadata: claimData,
                processingMetadata: {
                    processedAt: new Date().toISOString(),
                    processingTimeMs: Date.now() - startTime,
                    orchestratorVersion: 'production-v1.0',
                    source: 'real_hedera_ipfs'
                }
            };

            // Step 4: Prepare evidence retrieval plan
            const evidenceRetrievalPlan = await this.prepareEvidenceRetrieval(processedClaim);
            processedClaim.evidenceRetrievalPlan = evidenceRetrievalPlan;

            // Store processed claim
            this.processedClaims.set(claimData.cid, processedClaim);

            this.log(`✅ Claim processing completed`, 'SUCCESS', {
                cid: claimData.cid,
                processingTime: `${Date.now() - startTime}ms`,
                claimType: processedClaim.structuredData.claimType,
                confidence: `${(processedClaim.structuredData.confidence * 100).toFixed(1)}%`,
                priority: evidenceRetrievalPlan.priorityLevel,
                readyForPhase3: true
            });

            return processedClaim;

        } catch (error) {
            this.log(`❌ Claim processing failed`, 'ERROR', { 
                cid: claimData.cid,
                error: error.message,
                processingTime: `${Date.now() - startTime}ms`
            });
            throw error;
        }
    }

    // Fetch content from IPFS (PRODUCTION - no mocking)
    async fetchIPFSContent(cid) {
        this.log(`📡 Fetching real content from IPFS for CID: ${cid}`);

        const errors = [];

        // Try multiple IPFS gateways
        for (const [index, gateway] of this.ipfsGateways.entries()) {
            try {
                const url = `${gateway}${cid}`;
                this.log(`🔍 Trying gateway ${index + 1}/${this.ipfsGateways.length}: ${gateway}`);

                const response = await axios.get(url, {
                    timeout: 15000, // 15 second timeout for production
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

                    this.log(`✅ Content successfully retrieved`, 'SUCCESS', {
                        gateway,
                        contentLength: content.length,
                        contentType: response.headers['content-type'],
                        cid
                    });

                    return content.toString();
                }
            } catch (error) {
                const errorMsg = `Gateway ${gateway} failed: ${error.message}`;
                errors.push(errorMsg);
                this.log(`⚠️ Gateway attempt failed`, 'WARN', { 
                    gateway, 
                    error: error.message 
                });
                continue;
            }
        }

        // If all gateways fail, throw error (NO MOCKING in production)
        throw new Error(`All IPFS gateways failed for CID ${cid}. Errors: ${errors.join('; ')}`);
    }

    // Prepare evidence retrieval (enhanced for production)
    async prepareEvidenceRetrieval(processedClaim) {
        this.log(`🔎 Preparing evidence retrieval plan`, 'INFO', {
            cid: processedClaim.cid,
            claimType: processedClaim.structuredData.claimType
        });

        const structuredData = processedClaim.structuredData;
        
        // Generate comprehensive search queries
        const searchQueries = this.generateProductionSearchQueries(structuredData);
        
        // Calculate priority with Hedera metadata
        const priorityLevel = this.calculateProductionPriority(structuredData, processedClaim.hederaMetadata);
        
        // Identify required evidence types
        const evidenceTypes = this.identifyProductionEvidenceTypes(structuredData);

        const evidenceRetrievalPlan = {
            cid: processedClaim.cid,
            searchQueries,
            priorityLevel,
            evidenceTypes,
            hederaProof: {
                transactionId: processedClaim.hederaMetadata.transactionId,
                consensusTimestamp: processedClaim.hederaMetadata.consensusTimestamp,
                topicId: processedClaim.hederaMetadata.topicId,
                mirrorNodeUrl: `${this.mirrorNodeUrl}/api/v1/transactions/${processedClaim.hederaMetadata.transactionId}`
            },
            ipfsProof: {
                cid: processedClaim.cid,
                gatewayUrls: this.ipfsGateways.map(gateway => `${gateway}${processedClaim.cid}`)
            },
            readyForPhase3: true,
            preparedAt: new Date().toISOString()
        };

        this.log(`✅ Evidence retrieval plan prepared`, 'SUCCESS', {
            searchQueries: searchQueries.length,
            priority: priorityLevel,
            evidenceTypes: evidenceTypes.length
        });

        return evidenceRetrievalPlan;
    }

    // Generate production-grade search queries
    generateProductionSearchQueries(structuredClaim) {
        const queries = [];
        const { subject, predicate, object, quantifier, entities } = structuredClaim;

        // Primary query with exact components
        if (subject && object) {
            queries.push(`"${subject}" "${predicate}" "${object}"`);
        }

        // Quantified search if available
        if (quantifier) {
            queries.push(`"${subject}" ${quantifier} ${predicate} verification`);
            queries.push(`${subject} ${quantifier} study research`);
        }

        // Organization-specific queries
        if (entities.organizations.length > 0) {
            entities.organizations.forEach(org => {
                queries.push(`"${org}" official announcement "${object}"`);
                queries.push(`${org} press release ${predicate}`);
            });
        }

        // Technology/domain-specific queries
        entities.technologies.forEach(tech => {
            queries.push(`${tech} "${subject}" research study`);
            queries.push(`${tech} ${quantifier} performance improvement`);
        });

        // Medical/scientific specific queries
        entities.medical_terms.forEach(term => {
            queries.push(`${term} clinical trial results`);
            queries.push(`${term} medical study ${quantifier}`);
        });

        return queries.slice(0, 8); // Limit to 8 high-quality queries
    }

    // Calculate production priority (enhanced)
    calculateProductionPriority(structuredClaim, hederaMetadata) {
        let priority = 1;

        // Base priority adjustments
        if (structuredClaim.quantifier) priority += 2;
        if (structuredClaim.claimType === 'scientific') priority += 2;
        if (structuredClaim.claimType === 'organizational') priority += 1;

        // Medical claims get highest priority
        if (structuredClaim.entities.medical_terms.length > 0) priority += 3;

        // High transaction fees might indicate important claims
        if (hederaMetadata.mirrorNodeData?.charged_tx_fee > 1000000) priority += 1; // > 0.01 HBAR

        // Confidence boost
        if (structuredClaim.confidence > 0.8) priority += 1;

        return Math.min(priority, 5); // Max priority of 5
    }

    // Identify production evidence types
    identifyProductionEvidenceTypes(structuredClaim) {
        const evidenceTypes = ['web_search', 'news_verification'];

        if (structuredClaim.quantifier) {
            evidenceTypes.push('statistical_verification', 'data_validation');
        }

        if (structuredClaim.entities.organizations.length > 0) {
            evidenceTypes.push('official_sources', 'corporate_announcements');
        }

        if (structuredClaim.entities.medical_terms.length > 0) {
            evidenceTypes.push('medical_journals', 'clinical_trials', 'fda_database');
        }

        if (structuredClaim.entities.technologies.length > 0) {
            evidenceTypes.push('technical_documentation', 'patents', 'research_papers');
        }

        return [...new Set(evidenceTypes)]; // Remove duplicates
    }

    // Get production statistics
    getProductionStats() {
        const stats = {
            totalProcessed: this.processedClaims.size,
            isRunning: this.isRunning,
            lastProcessedTimestamp: this.lastProcessedTimestamp,
            uptime: this.isRunning ? Date.now() - this.startTime : 0,
            claimTypes: {},
            averageConfidence: 0,
            readyForEvidence: 0,
            priorityDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        };

        let totalConfidence = 0;

        for (const [cid, claim] of this.processedClaims) {
            const claimType = claim.structuredData.claimType;
            stats.claimTypes[claimType] = (stats.claimTypes[claimType] || 0) + 1;
            
            totalConfidence += claim.structuredData.confidence;
            
            if (claim.evidenceRetrievalPlan?.readyForPhase3) {
                stats.readyForEvidence++;
                const priority = claim.evidenceRetrievalPlan.priorityLevel;
                stats.priorityDistribution[priority]++;
            }
        }

        if (this.processedClaims.size > 0) {
            stats.averageConfidence = parseFloat((totalConfidence / this.processedClaims.size).toFixed(3));
        }

        return stats;
    }

    // Stop the orchestrator
    stop() {
        this.isRunning = false;
        this.log("🛑 Production orchestrator stopped");
    }

    // Get all processed claims
    getAllProcessedClaims() {
        return Array.from(this.processedClaims.values());
    }

    // Get specific claim by CID
    getClaim(cid) {
        return this.processedClaims.get(cid);
    }

    // API endpoint data for integration
    getApiStatus() {
        return {
            status: this.isRunning ? 'running' : 'stopped',
            hederaConnected: !!this.hederaClient,
            claimParserReady: this.claimParser.isInitialized,
            mirrorNodeUrl: this.mirrorNodeUrl,
            processedClaims: this.processedClaims.size,
            lastCheck: this.lastProcessedTimestamp
        };
    }
}

export default MainOrchestrator;

// Main execution if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const orchestrator = new MainOrchestrator();
    
    // Store start time
    orchestrator.startTime = Date.now();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down production orchestrator...');
        orchestrator.stop();
        
        const stats = orchestrator.getProductionStats();
        console.log('\n📊 Final Production Statistics:');
        console.log(JSON.stringify(stats, null, 2));
        
        process.exit(0);
    });

    // Start the production orchestrator
    orchestrator.startRealTimeProcessing()
        .then(() => {
            console.log('\n🎉 Production orchestrator is now live!');
            console.log('Monitoring Hedera testnet for new claims...');
        })
        .catch(error => {
            console.error('❌ Failed to start production orchestrator:', error);
            process.exit(1);
        });
}
