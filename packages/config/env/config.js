import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the backend config directory
dotenv.config({ path: path.resolve(__dirname, '../../../apps/backend/config/.env') });

/**
 * Centralized Configuration Management
 * All environment variables and configuration constants in one place
 */
export const config = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3001,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    nodeEnv: process.env.NODE_ENV || 'development'
  },

  // Hedera Configuration
  hedera: {
    accountId: process.env.HEDERA_ACCOUNT_ID,
    privateKey: process.env.HEDERA_PRIVATE_KEY,
    network: process.env.HEDERA_NETWORK || 'testnet',
    mirrorNodeUrl: process.env.HEDERA_MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com'
  },

  // IPFS Configuration
  ipfs: {
    gatewayUrl: process.env.IPFS_GATEWAY_URL || 'https://ipfs.filebase.io/ipfs/',
    gateways: [
      'https://ipfs.filebase.io/ipfs/',
      'https://ipfs.io/ipfs/',
      'https://gateway.pinata.cloud/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
      'https://dweb.link/ipfs/'
    ]
  },

  // Filebase Configuration
  filebase: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY_ID,
    secretAccessKey: process.env.FILEBASE_SECRET_ACCESS_KEY,
    bucketName: process.env.FILEBASE_BUCKET_NAME,
    region: process.env.FILEBASE_REGION || 'us-east-1',
    endpoint: 'https://s3.filebase.com'
  },

  // Phase 2 AI Configuration
  ai: {
    huggingFaceApiKey: process.env.HUGGINGFACE_API_KEY,
    models: {
      claimParser: 'microsoft/MiniLM-L6-v2'
    },
    enableSemanticAnalysis: process.env.ENABLE_SEMANTIC_ANALYSIS === 'true',
    enableAdvancedParsing: process.env.ENABLE_ADVANCED_PARSING === 'true'
  },

  // Agent Configuration
  agents: {
    autoStartPhase2: process.env.AUTO_START_PHASE2 === 'true',
    pollInterval: parseInt(process.env.AGENT_POLL_INTERVAL) || 10000, // 10 seconds
    mockIpfsOnFailure: process.env.MOCK_IPFS_ON_FAILURE === 'true'
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'INFO',
    enableDetailedLogs: process.env.ENABLE_DETAILED_LOGS === 'true',
    enableConsoleOutput: true
  },

  // Testing Configuration
  testing: {
    testMode: process.env.TEST_MODE === 'true',
    mockExternalServices: process.env.MOCK_EXTERNAL_SERVICES === 'true'
  },

  // Feature Flags
  features: {
    phase2Enabled: !!process.env.HUGGINGFACE_API_KEY,
    autoEvidencePreparation: process.env.AUTO_EVIDENCE_PREPARATION !== 'false',
    realTimeProcessing: process.env.REAL_TIME_PROCESSING !== 'false'
  }
};

/**
 * Validate required configuration
 */
export function validateConfig() {
  const required = [];

  // Check Hedera configuration
  if (!config.hedera.accountId) required.push('HEDERA_ACCOUNT_ID');
  if (!config.hedera.privateKey) required.push('HEDERA_PRIVATE_KEY');

  // Check Filebase configuration
  if (!config.filebase.accessKeyId) required.push('FILEBASE_ACCESS_KEY_ID');
  if (!config.filebase.secretAccessKey) required.push('FILEBASE_SECRET_ACCESS_KEY');
  if (!config.filebase.bucketName) required.push('FILEBASE_BUCKET_NAME');

  if (required.length > 0) {
    throw new Error(`Missing required environment variables: ${required.join(', ')}`);
  }

  console.log('✅ Configuration validation passed');
  return true;
}

/**
 * Get configuration summary for logging
 */
export function getConfigSummary() {
  return {
    server: {
      port: config.server.port,
      environment: config.server.nodeEnv
    },
    hedera: {
      network: config.hedera.network,
      accountConfigured: !!config.hedera.accountId
    },
    ipfs: {
      gatewayCount: config.ipfs.gateways.length,
      filebaseConfigured: !!(config.filebase.accessKeyId && config.filebase.secretAccessKey)
    },
    ai: {
      huggingFaceConfigured: !!config.ai.huggingFaceApiKey,
      phase2Enabled: config.features.phase2Enabled
    },
    features: config.features
  };
}

export default config;
