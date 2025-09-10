import axios from 'axios';
import { Client, AccountId, PrivateKey } from '@hashgraph/sdk';
import { config } from '../../config/env/config.js';
import IntelligentClaimParser from '../parsers/intelligent-claim-parser.js';
import contentStore from '../content-store.js';

/**
 * Improved Phase 2 Orchestrator with IPFS Propagation Handling
 * Specifically designed to handle IPFS content propagation delays
 * and provide real-time AI processing with proper retry mechanisms
 */
class ImprovedOrchestrator {
    constructor() {
        this.hederaClient = null;
        this.claimParser = new IntelligentClaimParser();
        this.isRunning = false;
        this.processedClaims = new Map();
        this.mirrorNodeUrl = config.hedera.mirrorNodeUrl;
        this.lastProcessedTimestamp = null;
        this.pollInterval = config.agents.pollInterval;
        
        // Enhanced IPFS gateway configuration
        this.ipfsGateways = [
            'https://ipfs.filebase.io/ipfs/', // Try Filebase first (our upload service)
            'https://ipfs.io/ipfs/',
            'https://gateway.pinata.cloud/ipfs/',
            'https://dweb.link/ipfs/',
            'https://cloudflare-ipfs.com/ipfs/'
        ];

        // Retry configuration for IPFS propagation
        this.retryConfig = {
            maxRetries: 5,
            baseDelay: 5000, // Start with 5 second delay
            maxDelay: 60000, // Max 1 minute delay
            backoffMultiplier: 1.5, // Exponential backoff
            propagationWaitTime: 30000 // Initial wait for IPFS propagation
        };

        this.log("🚀 Improved Phase 2 Orchestrator initialized with IPFS propagation handling", 'INFO', {
            mirrorNodeUrl: this.mirrorNodeUrl,
            pollInterval: this.pollInterval,
            gatewayCount: this.ipfsGateways.length,
            retryConfig: this.retryConfig
        });
        this.initializeHedera();
    }

    // Enhanced logging with better formatting
    log(message, level = 'INFO', data = null) {
        const timestamp = new Date().toISOString();
        const colors = {
            INFO: '\x1b[36m',    // Cyan
            SUCCESS: '\x1b[32m', // Green  
            WARN: '\x1b[33m',    // Yellow
            ERROR: '\x1b[31m',   // Red
            RESET: '\x1b[0m'     // Reset
        };

        console.log(`[${timestamp}] IMPROVED-ORCHESTRATOR ${colors[level] || ''}${level}${colors.RESET}: ${message}`);
        if (data) console.log('Details:', data);
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
        }
    }

    // Enhanced IPFS content fetching with content store and propagation delay handling
    async fetchIPFSContentWithRetry(cid, immediateRetry = false) {
        this.log(`📡 Fetching content for CID: ${cid}`);
        
        // FIRST: Check local content store (immediate access)
        this.log(`🗃️ Checking local content store first...`);
        const storedContent = contentStore.get(cid);
        if (storedContent) {
            this.log(`✅ Content found in local store - immediate access!`, 'SUCCESS', {
                size: storedContent.content.length,
                storedAt: storedContent.metadata.storedAt,
                source: 'content-store'
            });
            return storedContent.content;
        }
        
        this.log(`🔍 Content not in local store, trying IPFS gateways...`);
        
        // If not immediate retry, wait for initial propagation
        if (!immediateRetry) {
            this.log(`⏳ Waiting ${this.retryConfig.propagationWaitTime}ms for IPFS propagation...`);
            await this.sleep(this.retryConfig.propagationWaitTime);
        }

        let lastError = null;
        let delay = this.retryConfig.baseDelay;

        for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
            this.log(`🔄 Attempt ${attempt}/${this.retryConfig.maxRetries} to fetch content`);

            // Try each gateway on each attempt
            for (const [gatewayIndex, gateway] of this.ipfsGateways.entries()) {
                try {
                    const url = `${gateway}${cid}`;
                    this.log(`🔍 Trying gateway ${gatewayIndex + 1}/${this.ipfsGateways.length}: ${gateway}`);

                    const response = await axios.get(url, {
                        timeout: 20000, // Longer timeout for better reliability
                        headers: {
                            'Accept': 'text/plain, application/json, */*',
                            'User-Agent': 'Hedera-Notarization-Bot/2.0'
                        }
                    });

                    if (response.status === 200 && response.data) {
                        let content = response.data;
                        
                        // Handle different content types
                        if (typeof content === 'object') {
                            content = JSON.stringify(content, null, 2);
                        }

                        this.log(`✅ Content successfully retrieved on attempt ${attempt}`, 'SUCCESS', {
                            gateway,
                            contentLength: content.length,
                            contentType: response.headers['content-type'],
                            totalTime: `${attempt * delay}ms`,
                            cid
                        });

                        return content.toString();
                    }
                } catch (error) {
                    this.log(`⚠️ Gateway ${gateway} failed on attempt ${attempt}`, 'WARN', { 
                        gateway, 
                        error: error.message,
                        timeout: error.code === 'ECONNABORTED' ? 'yes' : 'no'
                    });
                    lastError = error;
                    continue;
                }
            }

            // If not the last attempt, wait with exponential backoff
            if (attempt < this.retryConfig.maxRetries) {
                this.log(`⏳ All gateways failed on attempt ${attempt}. Waiting ${delay}ms before retry...`);
                await this.sleep(delay);
                delay = Math.min(delay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelay);
            }
        }

        // All attempts failed
        throw new Error(`All IPFS gateways failed after ${this.retryConfig.maxRetries} attempts for CID ${cid}. Last error: ${lastError?.message}`);
    }

    // Sleep utility
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Process claim with enhanced error handling
    async processClaim(claimData) {
        const startTime = Date.now();
        this.log(`🔄 Processing claim from CID: ${claimData.cid || claimData}`, 'INFO');

        try {
            const cid = claimData.cid || claimData;
            
            // Store basic claim info
            this.processedClaims.set(cid, {
                cid,
                status: 'processing',
                timestamp: new Date().toISOString(),
                source: claimData.source || 'hedera_testnet'
            });

            // Fetch content with enhanced retry mechanism
            const content = await this.fetchIPFSContentWithRetry(cid);
            
            // Parse content using AI
            const parsedClaim = await this.claimParser.parseClaim(content);
            
            // Update stored claim with processed data
            const processedClaim = {
                cid,
                content,
                claimType: parsedClaim.type || 'unknown',
                subject: parsedClaim.subject || 'N/A',
                predicate: parsedClaim.predicate || 'N/A', 
                object: parsedClaim.object || 'N/A',
                confidence: parsedClaim.confidence || 0,
                parsedClaim: parsedClaim, // Full parsed claim for reference
                status: 'completed',
                timestamp: new Date().toISOString(),
                processingTime: `${Date.now() - startTime}ms`,
                source: claimData.source || 'hedera_testnet',
                metadata: {
                    method: parsedClaim.method || 'unknown',
                    processingTime: `${Date.now() - startTime}ms`,
                    aiEngine: parsedClaim.method === 'huggingface' ? 'HuggingFace AI' : 'Pattern-based'
                }
            };

            this.processedClaims.set(cid, processedClaim);

            // Log detailed parsing results
            this.log(`✅ Claim processing completed successfully`, 'SUCCESS', {
                cid,
                processingTime: processedClaim.processingTime,
                claimType: parsedClaim.type || 'unknown',
                contentLength: content.length
            });

            // Log detailed AI parsing results for immediate visibility
            this.log(`🎯 AI PARSING RESULTS:`, 'SUCCESS', {
                input: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
                aiEngine: parsedClaim.method === 'huggingface' ? 'HuggingFace AI' : 'Pattern-based',
                type: parsedClaim.type || 'N/A',
                subject: parsedClaim.subject || 'N/A',
                predicate: parsedClaim.predicate || 'N/A',
                object: parsedClaim.object || 'N/A',
                confidence: `${Math.round((parsedClaim.confidence || 0) * 100)}%`,
                method: parsedClaim.method || 'unknown'
            });

            return processedClaim;

        } catch (error) {
            const errorInfo = {
                cid: claimData.cid || claimData,
                error: error.message,
                processingTime: `${Date.now() - startTime}ms`
            };

            this.log(`❌ Claim processing failed`, 'ERROR', errorInfo);
            
            // Store failed claim info
            this.processedClaims.set(claimData.cid || claimData, {
                cid: claimData.cid || claimData,
                status: 'failed',
                error: error.message,
                timestamp: new Date().toISOString(),
                processingTime: errorInfo.processingTime
            });

            throw error;
        }
    }

    // Start real-time monitoring
    async startRealTimeProcessing() {
        if (this.isRunning) {
            this.log("⚠️ Orchestrator is already running", 'WARN');
            return;
        }

        this.isRunning = true;
        // Start from NOW to only process NEW transactions going forward
        this.lastProcessedTimestamp = new Date().toISOString();
        
        this.log("🎬 Starting real-time claim processing with improved IPFS handling", 'INFO');
        this.log("📅 Starting from timestamp", 'INFO', { startTime: this.lastProcessedTimestamp });

        // Start polling for new transactions
        const pollInterval = setInterval(async () => {
            if (!this.isRunning) {
                clearInterval(pollInterval);
                return;
            }
            await this.pollForNewTransactions();
        }, this.pollInterval);

        this.log(`🔄 Started polling Mirror Node every ${this.pollInterval/1000}s with enhanced retry logic`, 'INFO');
        this.log("✅ Real-time orchestrator is now running with IPFS propagation handling", 'SUCCESS');
        
        return true;
    }

    // Poll for new transactions
    async pollForNewTransactions() {
        try {
            // Convert timestamp to Hedera Mirror Node format (seconds.nanoseconds)
            const timestampSeconds = this.lastProcessedTimestamp 
                ? Math.floor(new Date(this.lastProcessedTimestamp).getTime() / 1000)
                : Math.floor(Date.now() / 1000); // Current time if no timestamp
                
            const url = `${this.mirrorNodeUrl}/api/v1/transactions?account.id=${config.hedera.accountId}&timestamp=gte:${timestampSeconds}&order=asc&limit=10`;
            
            this.log(`🔍 Polling Mirror Node: ${url.replace(config.hedera.accountId, 'xxx')}`);
            
            const response = await axios.get(url, { 
                timeout: 10000,
                headers: {
                    'Accept': 'application/json'
                }
            });
            const transactions = response.data.transactions || [];
            
            this.log(`🔍 Found ${transactions.length} new transactions`);
            
            for (const transaction of transactions) {
                if (transaction.memo_base64) {
                    try {
                        const memoDecoded = Buffer.from(transaction.memo_base64, 'base64').toString('utf-8');
                        const memoData = JSON.parse(memoDecoded);
                        
                        if (memoData.ipfsCid) {
                            this.log(`📝 New claim detected: ${memoData.ipfsCid}`, 'INFO');
                            
                            // Process claim asynchronously to avoid blocking
                            this.processClaim({
                                cid: memoData.ipfsCid,
                                transactionHash: transaction.transaction_id,
                                timestamp: transaction.consensus_timestamp,
                                source: 'hedera_realtime'
                            }).catch(error => {
                                this.log(`⚠️ Async claim processing failed for ${memoData.ipfsCid}`, 'WARN', { error: error.message });
                            });
                        }
                    } catch (error) {
                        // Skip transactions that don't contain valid memo data
                        continue;
                    }
                }
                
                // Update last processed timestamp
                this.lastProcessedTimestamp = transaction.consensus_timestamp;
            }

        } catch (error) {
            this.log(`⚠️ Error polling for transactions`, 'WARN', { error: error.message });
        }
    }

    // Stop processing
    stop() {
        this.isRunning = false;
        this.log("🛑 Orchestrator stopped", 'INFO');
    }

    // Get status
    getStatus() {
        return {
            isRunning: this.isRunning,
            processedClaimsCount: this.processedClaims.size,
            lastProcessedTimestamp: this.lastProcessedTimestamp,
            retryConfig: this.retryConfig
        };
    }

    // Get processed claims
    getProcessedClaims() {
        return Array.from(this.processedClaims.values());
    }

    // Manual claim processing (for testing)
    async processClaimManually(cid) {
        this.log(`🔧 Manual processing of CID: ${cid}`, 'INFO');
        return await this.processClaim(cid);
    }
}

// Export for use as a module
export default ImprovedOrchestrator;

// If run directly, start the orchestrator
if (import.meta.url === `file://${process.argv[1]}`) {
    const orchestrator = new ImprovedOrchestrator();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down orchestrator gracefully...');
        orchestrator.stop();
        process.exit(0);
    });

    // Start real-time processing
    orchestrator.startRealTimeProcessing().catch(error => {
        console.error('Failed to start orchestrator:', error);
        process.exit(1);
    });
}
