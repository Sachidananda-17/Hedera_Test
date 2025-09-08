import { Fluence } from '@fluencelabs/js-client';

// AI Model Configurations
const AI_MODELS = {
    // Model 1: Claim Extractor
    claimExtractor: {
        name: "claim-extractor",
        description: "Extracts verifiable claims from text content",
        input: "text",
        output: "claims[]"
    },

    // Model 2: Evidence Gatherer
    evidenceGatherer: {
        name: "evidence-gatherer",
        description: "Gathers evidence from web sources using Perplexity AI",
        input: "claims[]",
        output: "evidence[]"
    },

    // Model 3: Verdict Analyzer
    verdictAnalyzer: {
        name: "verdict-analyzer",
        description: "Analyzes claims and evidence to produce final verdict",
        input: "claims[], evidence[]",
        output: "verdict"
    }
};

// Fluence Network Configuration
const FLUENCE_CONFIG = {
    // Network endpoints
    testnet: {
        multiaddr: "/dns4/testnet.fluence.dev/tcp/19990/ws",
        defaultTtl: 60000
    },

    // Compute requirements
    compute: {
        minCPU: 2,
        minRAM: 4096,
        minStorage: 10240
    },

    // Model deployment settings
    deployment: {
        replicas: 3,
        timeout: 300000
    }
};

export { AI_MODELS, FLUENCE_CONFIG };
