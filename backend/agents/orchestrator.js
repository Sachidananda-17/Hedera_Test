import { Fetch } from '@fetch-ai/js-sdk';
import { HederaClient } from '@hashgraph/sdk';
import { FluenceClient } from '@fluencelabs/js-client';

class OrchestrationAgent {
    constructor() {
        this.fetchClient = new Fetch({
            name: "HederaVerificationAgent",
            privateKey: process.env.FETCH_PRIVATE_KEY
        });

        this.fluenceClient = new FluenceClient({
            connectTo: process.env.FLUENCE_NETWORK || "testnet"
        });
    }

    // Listen to Hedera Topic for new claims
    async listenToHederaTopic(topicId) {
        // Subscribe to HCS topic
        const subscription = await this.hederaClient.subscribeToTopic(topicId);
        
        subscription.on('message', async (message) => {
            // When new claim is received
            const claim = JSON.parse(message.contents);
            await this.processClaim(claim);
        });
    }

    // Process new claims
    async processClaim(claim) {
        try {
            // 1. Retrieve content from IPFS
            const content = await this.fetchIPFSContent(claim.cid);

            // 2. Delegate to Fluence for AI processing
            const result = await this.processThroughFluence(content);

            // 3. Generate and store verification report
            await this.generateReport(claim, result);

        } catch (error) {
            console.error('Claim processing failed:', error);
        }
    }

    // Delegate AI work to Fluence Network
    async processThroughFluence(content) {
        // Connect to Fluence Network
        await this.fluenceClient.connect();

        // 1. Extract claims using first AI model
        const claims = await this.fluenceClient.runAI('claim-extractor', {
            text: content
        });

        // 2. Gather evidence using second AI model
        const evidence = await this.fluenceClient.runAI('evidence-gatherer', {
            claims: claims
        });

        // 3. Analyze and produce verdict using third AI model
        const verdict = await this.fluenceClient.runAI('verdict-analyzer', {
            claims: claims,
            evidence: evidence
        });

        return {
            claims,
            evidence,
            verdict
        };
    }

    // Generate final verification report
    async generateReport(claim, aiResults) {
        const report = {
            originalClaim: claim,
            extractedClaims: aiResults.claims,
            evidence: aiResults.evidence,
            verdict: aiResults.verdict,
            timestamp: new Date().toISOString()
        };

        // Store report on IPFS
        const reportCID = await this.storeReportOnIPFS(report);

        // Record report CID on Hedera
        await this.recordReportOnHedera(claim.topicId, reportCID);

        return reportCID;
    }
}

export default OrchestrationAgent;
