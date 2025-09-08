/**
 * Shared Types for Hedera Content Notarization Platform
 * Used across frontend, backend, and agent systems
 */

// ============================================================================
// Core Notarization Types
// ============================================================================

export interface NotarizationRequest {
  accountId: string;
  contentType: 'text' | 'image' | 'image-with-text';
  text?: string;
  file?: File | Buffer;
  title?: string;
  tags?: string;
}

export interface NotarizationResponse {
  success: boolean;
  ipfsCid: string | null;
  timestamp: string;
  hederaTransactionHash: string | null;
  ipfsGatewayUrl: string | null;
  alternativeIPFSUrls: string[] | null;
  hederaExplorerUrl: string | null;
  message: string;
  errors?: {
    ipfs?: string;
    hedera?: string;
  };
  debug?: {
    filename: string;
    contentSize: number;
    actualCID: string;
    processingTime: number;
  };
}

// ============================================================================
// Phase 2 AI Processing Types
// ============================================================================

export interface ClaimData {
  cid: string;
  source: string;
  topicId: string;
  transactionId: string;
  transactionHash: string;
  consensusTimestamp: string;
  memo: string;
  mirrorNodeData?: {
    charged_tx_fee: number;
    max_fee: number;
    result: string;
  };
}

export interface StructuredClaim {
  subject: string;
  predicate: string;
  object: string;
  quantifier?: string;
  comparison?: string;
  methodology?: string;
  claimType: 'quantified' | 'comparative' | 'scientific' | 'organizational' | 'general' | 'parsed' | 'fragment';
  confidence: number;
  entities: EntityExtraction;
  extractionMethod?: string;
  validations: string[];
  qualityMetrics: QualityMetrics;
  semanticAnalysis?: SemanticAnalysis;
}

export interface EntityExtraction {
  organizations: string[];
  people: string[];
  numbers: string[];
  percentages: string[];
  dates: string[];
  locations: string[];
  technologies: string[];
  medical_terms: string[];
  measurements: string[];
}

export interface QualityMetrics {
  completeness: number;
  specificity: number;
  reliability: number;
}

export interface SemanticAnalysis {
  model: string;
  coherenceScore: number;
  embeddingDimensions: number;
  confidenceBoost: number;
}

export interface ProcessedClaim {
  cid: string;
  originalText: string;
  structuredData: StructuredClaim;
  hederaMetadata: ClaimData;
  processingMetadata: {
    processedAt: string;
    processingTimeMs: number;
    orchestratorVersion: string;
    source: string;
  };
  evidenceRetrievalPlan?: EvidenceRetrievalPlan;
}

export interface EvidenceRetrievalPlan {
  cid: string;
  searchQueries: string[];
  priorityLevel: number;
  evidenceTypes: string[];
  hederaProof: {
    transactionId: string;
    consensusTimestamp: string;
    topicId: string;
    mirrorNodeUrl: string;
  };
  ipfsProof: {
    cid: string;
    gatewayUrls: string[];
  };
  readyForPhase3: boolean;
  preparedAt: string;
}

// ============================================================================
// Agent System Types
// ============================================================================

export interface AgentStatus {
  name: string;
  initialized: boolean;
  running: boolean;
  lastActivity: string;
  capabilities: string[];
  errors: string[];
}

export interface OrchestratorStats {
  totalProcessed: number;
  isRunning: boolean;
  lastProcessedTimestamp: string | null;
  uptime: number;
  claimTypes: Record<string, number>;
  averageConfidence: number;
  readyForEvidence: number;
  priorityDistribution: Record<number, number>;
}

export interface ParsingResult {
  originalText: string;
  structuredClaim: StructuredClaim;
  processingMetadata: {
    agentName: string;
    model: string;
    processingTimeMs: number;
    hfApiUsed: boolean;
    timestamp: string;
    [key: string]: any;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp?: string;
}

export interface HealthCheckResponse {
  success: boolean;
  services: {
    hedera: boolean;
    filebase: boolean;
    ipfs: boolean;
    phase2?: boolean;
  };
  timestamp: string;
  version?: string;
}

export interface Phase2StatusResponse {
  success: boolean;
  phase2: {
    status: 'running' | 'stopped' | 'not_available';
    hederaConnected: boolean;
    claimParserReady: boolean;
    mirrorNodeUrl: string;
    processedClaims: number;
    lastCheck: string | null;
    stats: OrchestratorStats;
  };
}

// ============================================================================
// Frontend Specific Types
// ============================================================================

export interface WalletConnection {
  connected: boolean;
  accountId: string;
  balance: string;
  network: 'mainnet' | 'testnet';
}

export interface NotarizationFormState {
  text: string;
  file: File | null;
  title: string;
  tags: string;
  isSubmitting: boolean;
  progress: number;
  result: NotarizationResult | null;
  error: string | null;
}

export interface NotarizationResult {
  cid: string;
  hash: string;
  ipfsUrl: string;
  ipfsUrls: string[];
  filebaseUrl?: string;
  topicId?: string;
  success: boolean;
  ipfsNote?: string;
  ipfsWarning?: string;
  ipfsError?: string;
  hederaError?: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AppConfig {
  server: {
    port: number;
    corsOrigin: string;
    nodeEnv: string;
  };
  hedera: {
    accountId: string;
    privateKey: string;
    network: string;
    mirrorNodeUrl: string;
  };
  ipfs: {
    gatewayUrl: string;
    gateways: string[];
  };
  filebase: {
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    region: string;
    endpoint: string;
  };
  ai: {
    huggingFaceApiKey: string;
    models: {
      claimParser: string;
    };
    enableSemanticAnalysis: boolean;
    enableAdvancedParsing: boolean;
  };
  features: {
    phase2Enabled: boolean;
    autoEvidencePreparation: boolean;
    realTimeProcessing: boolean;
  };
}

// ============================================================================
// Utility Types
// ============================================================================

export type ClaimType = StructuredClaim['claimType'];
export type ContentType = NotarizationRequest['contentType'];
export type AgentCapability = string;
export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

// ============================================================================
// Constants
// ============================================================================

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg'] as const;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const DEFAULT_POLL_INTERVAL = 10000; // 10 seconds

export const CLAIM_TYPES = [
  'quantified',
  'comparative', 
  'scientific',
  'organizational',
  'general',
  'parsed',
  'fragment'
] as const;

export const EVIDENCE_TYPES = [
  'web_search',
  'news_verification',
  'statistical_verification',
  'data_validation',
  'official_sources',
  'corporate_announcements',
  'medical_journals',
  'clinical_trials',
  'fda_database',
  'technical_documentation',
  'patents',
  'research_papers'
] as const;
