import { Client, AccountId, PrivateKey } from '@hashgraph/sdk';
import { config } from '../../config/env/config.js';
import ChatGPTParser from '../parsers/chatgpt-parser.js';
import contentStore from '../content-store.js';

/**
 * ChatGPT-powered Orchestrator
 * Uses GPT-4 for claim parsing and analysis
 */
class ChatGPTOrchestrator {
    constructor() {
        this.hederaClient = null;
        this.claimParser = new ChatGPTParser();
        this.isRunning = false;
        this.processedClaims = new Map();
        this.mirrorNodeUrl = config.hedera.mirrorNodeUrl;
        this.lastProcessedTimestamp = null;
        this.pollInterval = config.agents.pollInterval;
        
        // IPFS gateway configuration
        this.ipfsGateways = [
            'https://ipfs.filebase.io/ipfs/',
            'https://ipfs.io/ipfs/',
            'https://gateway.pinata.cloud/ipfs/',
            'https://dweb.link/ipfs/',
            'https://cloudflare-ipfs.com/ipfs/'
        ];

        this.log("🚀 ChatGPT-powered Orchestrator initialized", 'INFO');
        this.initializeHedera();
    }

    log(message, level = 'INFO', data = null) {
        const timestamp = new Date().toISOString();
        const colors = {
            INFO: '\x1b[36m',    // Cyan
            SUCCESS: '\x1b[32m', // Green  
            WARN: '\x1b[33m',    // Yellow
            ERROR: '\x1b[31m',   // Red
            RESET: '\x1b[0m'     // Reset
        };

        console.log(`[${timestamp}] GPT-ORCHESTRATOR ${colors[level] || ''}${level}${colors.RESET}: ${message}`);
        if (data) console.log('Details:', data);
    }

    async initializeHedera() {
        try {
            this.hederaClient = Client.forTestnet();
            
            if (config.hedera.accountId && config.hedera.privateKey) {
                this.hederaClient.setOperator(
                    AccountId.fromString(config.hedera.accountId),
                    PrivateKey.fromStringECDSA(config.hedera.privateKey)
                );
                this.log("✅ Hedera client initialized", 'SUCCESS');
            } else {
                throw new Error('Hedera credentials not found');
            }
        } catch (error) {
            this.log("❌ Failed to initialize Hedera client", 'ERROR', { error: error.message });
        }
    }

    async processClaim(claimData) {
        const startTime = Date.now();
        this.log(`🔄 Processing claim from CID: ${claimData.cid || claimData}`, 'INFO');

        try {
            const cid = claimData.cid || claimData;
            
            // Store basic claim info
            this.processedClaims.set(cid, {
                cid,
                status: 'processing',
                timestamp: new Date().toISOString()
            });

            // Fetch content from IPFS
            const content = await this.fetchIPFSContent(cid);
            
            // Parse claim using ChatGPT
            const parsedClaim = await this.claimParser.parseClaim(content);
            
            // Store processed claim
            const processedClaim = {
                cid,
                content,
                ...parsedClaim,
                status: 'completed',
                processingTime: `${Date.now() - startTime}ms`,
                timestamp: new Date().toISOString()
            };

            this.processedClaims.set(cid, processedClaim);

            // Log results
            this.log(`✅ Claim processing completed`, 'SUCCESS', {
                cid,
                type: parsedClaim.claimType,
                confidence: parsedClaim.confidence,
                processingTime: processedClaim.processingTime
            });

            return processedClaim;

        } catch (error) {
            const errorInfo = {
                cid: claimData.cid || claimData,
                error: error.message,
                processingTime: `${Date.now() - startTime}ms`
            };

            this.log(`❌ Claim processing failed`, 'ERROR', errorInfo);
            
            this.processedClaims.set(claimData.cid || claimData, {
                cid: claimData.cid || claimData,
                status: 'failed',
                error: error.message,
                timestamp: new Date().toISOString()
            });

            throw error;
        }
    }

    async fetchIPFSContent(cid) {
        // First check local content store
        const storedContent = contentStore.get(cid);
        if (storedContent) {
            return storedContent.content;
        }

        // Try each IPFS gateway
        for (const gateway of this.ipfsGateways) {
            try {
                const response = await fetch(`${gateway}${cid}`);
                if (response.ok) {
                    const content = await response.text();
                    return content;
                }
            } catch (error) {
                continue;
            }
        }

        throw new Error(`Failed to fetch content for CID: ${cid}`);
    }

    async startRealTimeProcessing() {
        if (this.isRunning) {
            this.log("⚠️ Orchestrator is already running", 'WARN');
            return;
        }

        this.isRunning = true;
        this.lastProcessedTimestamp = new Date().toISOString();
        
        this.log("🎬 Starting real-time claim processing", 'INFO');

        const pollInterval = setInterval(async () => {
            if (!this.isRunning) {
                clearInterval(pollInterval);
                return;
            }
            await this.pollForNewTransactions();
        }, this.pollInterval);

        this.log(`🔄 Started polling Mirror Node every ${this.pollInterval/1000}s`, 'INFO');
        return true;
    }

    async pollForNewTransactions() {
        try {
            const timestampSeconds = Math.floor(new Date(this.lastProcessedTimestamp).getTime() / 1000);
            const url = `${this.mirrorNodeUrl}/api/v1/transactions?account.id=${config.hedera.accountId}&timestamp=gte:${timestampSeconds}&order=asc&limit=10`;
            
            const response = await fetch(url);
            const data = await response.json();
            const transactions = data.transactions || [];
            
            this.log(`🔍 Found ${transactions.length} new transactions`);
            
            for (const transaction of transactions) {
                if (transaction.memo_base64) {
                    try {
                        const memoDecoded = Buffer.from(transaction.memo_base64, 'base64').toString('utf-8');
                        const memoData = JSON.parse(memoDecoded);
                        
                        if (memoData.ipfsCid) {
                            this.log(`📝 New claim detected: ${memoData.ipfsCid}`, 'INFO');
                            
                            this.processClaim({
                                cid: memoData.ipfsCid,
                                transactionHash: transaction.transaction_id,
                                timestamp: transaction.consensus_timestamp
                            }).catch(error => {
                                this.log(`⚠️ Claim processing failed: ${error.message}`, 'WARN');
                            });
                        }
                    } catch (error) {
                        continue;
                    }
                }
                
                this.lastProcessedTimestamp = transaction.consensus_timestamp;
            }

        } catch (error) {
            this.log(`⚠️ Error polling for transactions`, 'WARN', { error: error.message });
        }
    }

    stop() {
        this.isRunning = false;
        this.log("🛑 Orchestrator stopped", 'INFO');
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            processedClaimsCount: this.processedClaims.size,
            lastProcessedTimestamp: this.lastProcessedTimestamp,
            parserStatus: this.claimParser.getStatus()
        };
    }

    getProcessedClaims() {
        return Array.from(this.processedClaims.values());
    }
}

export default ChatGPTOrchestrator;

// Start orchestrator if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const orchestrator = new ChatGPTOrchestrator();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down orchestrator gracefully...');
        orchestrator.stop();
        process.exit(0);
    });

    // Start processing
    orchestrator.startRealTimeProcessing().catch(error => {
        console.error('Failed to start orchestrator:', error);
        process.exit(1);
    });
}

