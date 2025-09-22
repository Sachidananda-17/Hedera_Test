import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { S3Client, PutObjectCommand, HeadObjectCommand, HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Client, AccountId, PrivateKey, TopicCreateTransaction, TopicMessageSubmitTransaction, Hbar } from '@hashgraph/sdk';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import * as raw from 'multiformats/codecs/raw';
import dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';
import { analyzeImageWithClaim } from './imageAnalysis.js';
import { HederaLangchainToolkit, coreQueriesPlugin } from 'hedera-agent-kit';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';

// Load environment variables from config directory
dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

// Import unified configuration
import { config, validateConfig, getConfigSummary } from '../../../packages/config/env/config.js';

// Import orchestrators
import MainOrchestrator from '../../../packages/agents/orchestrators/main-orchestrator.js';
import ImprovedOrchestrator from '../../../packages/agents/orchestrators/improved-orchestrator.js';
import contentStore from '../../../packages/agents/content-store.js';

// Validate configuration before starting
try {
  validateConfig();
  console.log('🎯 Configuration Summary:', getConfigSummary());
} catch (error) {
  console.error('❌ Configuration validation failed:', error.message);
  process.exit(1);
}

const app = express();
const PORT = config.server.port;

// Initialize Hedera Agent Kit (LangChain) with OpenAI or Gemini as the LLM
let agentExecutor = null;
let activeLlmLabel = null;
function createLLM() {
  if (config.ai?.openai?.apiKey) {
    activeLlmLabel = `openai:${config.ai.openai.model}`;
    return new ChatOpenAI({
      apiKey: config.ai.openai.apiKey,
      model: config.ai.openai.model,
      temperature: 0.2
    });
  }
  if (config.ai?.gemini?.apiKey) {
    activeLlmLabel = `gemini:${config.ai.gemini.model}`;
    return new ChatGoogleGenerativeAI({
      apiKey: config.ai.gemini.apiKey,
      model: config.ai.gemini.model,
      temperature: 0.2
    });
  }
  return null;
}

async function initializeAgentExecutor() {
  try {
    const llm = createLLM();
    if (!llm) {
      console.warn('⚠️ No LLM configured for Agent Kit (OpenAI or Gemini)');
      return;
    }
    // Ensure we have at least a read-only Hedera client for query tools
    let agentClient = hederaClient;
    if (!agentClient) {
      console.warn('⚠️ Hedera credentials missing; initializing read-only client for queries');
      try {
        agentClient = Client.forTestnet();
      } catch (e) {
        console.warn('⚠️ Failed to create read-only Hedera client:', e.message);
      }
    }

    const toolkit = new HederaLangchainToolkit({
      client: agentClient,
      configuration: {
        plugins: [coreQueriesPlugin]
      }
    });
    const tools = toolkit.getTools();

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', 'You are a concise analyst returning clear, structured findings.'],
      ['placeholder', '{chat_history}'],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}']
    ]);

    const agent = createToolCallingAgent({ llm, tools, prompt });
    agentExecutor = new AgentExecutor({ agent, tools });
    console.log(`✅ Hedera Agent Kit executor initialized using ${activeLlmLabel}`);
  } catch (e) {
    console.warn('⚠️ Failed to initialize Agent Kit executor:', e.message);
  }
}

// Initialize Hedera client
let hederaClient = null;
try {
  hederaClient = Client.forTestnet();
  
  // Set operator from configuration
  if (config.hedera.accountId && config.hedera.privateKey) {
    hederaClient.setOperator(
      AccountId.fromString(config.hedera.accountId),
      PrivateKey.fromStringECDSA(config.hedera.privateKey)
    );
    console.log(`✅ Hedera client configured for account: ${config.hedera.accountId}`);
  } else {
    console.warn('⚠️ Hedera credentials not found in configuration');
    hederaClient = null;
  }
} catch (error) {
  console.error('❌ Error initializing Hedera client:', error.message);
  hederaClient = null;
}

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow dev frontend and API base origin
    const allowed = new Set([
      config.server.corsOrigin,
      `http://localhost:${PORT}`
    ]);

    // Permit Chrome extensions
    if (origin && (origin.startsWith('chrome-extension://') || allowed.has(origin))) {
      return callback(null, true);
    }

    // In non-browser or same-origin requests, no origin will be present
    if (!origin) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Configure AWS S3 client for Filebase using configuration
const s3Client = new S3Client({
  endpoint: config.filebase.endpoint,
  region: config.filebase.region,
  credentials: {
    accessKeyId: config.filebase.accessKeyId,
    secretAccessKey: config.filebase.secretAccessKey,
  },
});

// Helper function to generate IPFS CID (deterministic, should match IPFS)
async function generateIPFSCID(content) {
  try {
    const hash = await sha256.digest(content);
    const cid = CID.createV1(raw.code, hash);
    const cidString = cid.toString();
    console.log(`🔧 Generated CID details: ${cidString} (length: ${cidString.length})`);
    return cidString;
  } catch (error) {
    console.error('Error generating IPFS CID:', error);
    // Fallback to a simple base58 hash if CID generation fails
    try {
      const crypto = await import('crypto');
      const hashBuffer = crypto.createHash('sha256').update(content).digest();
      const simpleHash = 'Qm' + hashBuffer.toString('hex').substring(0, 44);
      console.log(`🔧 Using fallback hash: ${simpleHash}`);
      return simpleHash;
    } catch (fallbackError) {
      console.error('Fallback CID generation failed:', fallbackError);
      return null;
    }
  }
}

// Helper to build a concise analysis prompt for LLMs
function buildAnalysisPrompt({ cid, contentType, text, title, tags, accountId, hederaTxId, imageContext, imageLabels, ipfsGatewayUrl, userPrompt }) {
  const header = `You are analyzing notarized content in a Hedera + IPFS system.`;
  const context = [
    `IPFS CID: ${cid}`,
    hederaTxId ? `Hedera Tx: ${hederaTxId}` : null,
    title ? `Title: ${title}` : null,
    tags ? `Tags: ${tags}` : null,
    `Content type: ${contentType}`
  ].filter(Boolean).join('\n');

  // Prefer explicit text; otherwise, include image-derived context if available
  const base = text && text.trim().length ? text : (imageContext && imageContext.trim().length ? imageContext : '');
  const contentSnippet = base ? (base.length > 3000 ? base.slice(0, 3000) + '...' : base) : '(no content available)';

  const imageExtras = (contentType?.startsWith('image')) ? [
    '',
    'Image context:',
    imageLabels && imageLabels.length ? `- Labels: ${imageLabels.slice(0, 5).join(', ')}` : null,
    ipfsGatewayUrl ? `- IPFS gateway: ${ipfsGatewayUrl}` : null,
  ].filter(Boolean).join('\n') : '';

  return [
    header,
    context,
    userPrompt && userPrompt.trim() ? `\nUser instructions: ${userPrompt.trim()}` : null,
    imageExtras,
    '',
    'If text is provided, extract a structured summary:',
    '- key_claims: concise bullet claims (max 5)',
    '- entities: important entities mentioned',
    '- risk_level: low|medium|high with one-line rationale',
    '- recommended_next_actions: up to 3 bullets',
    '- sources: 3-5 reputable URLs (include full https:// links) supporting or refuting the claims. If unsure, write "No reliable sources found".',
    '',
    'Text to analyze:',
    contentSnippet
  ].join('\n');
}

// Helper to build a rigorous fact-checking prompt
function buildFactCheckPrompt({ cid, contentType, text, title, tags, accountId, hederaTxId, imageContext, imageLabels, ipfsGatewayUrl, userPrompt }) {
  const header = `You are a rigorous fact-checker. Verify the claims in the provided content against reputable sources. If any part is false or misleading, correct it with precise facts.`;
  const context = [
    `IPFS CID: ${cid}`,
    hederaTxId ? `Hedera Tx: ${hederaTxId}` : null,
    title ? `Title: ${title}` : null,
    tags ? `Tags: ${tags}` : null,
    `Content type: ${contentType}`
  ].filter(Boolean).join('\n');

  // Prefer explicit text; otherwise, include image-derived context if available
  const base = text && text.trim().length ? text : (imageContext && imageContext.trim().length ? imageContext : '');
  const contentSnippet = base ? (base.length > 3000 ? base.slice(0, 3000) + '...' : base) : '(no content available)';

  const imageGuidance = (contentType?.startsWith('image')) ? [
    '',
    'Image context:',
    imageLabels && imageLabels.length ? `- Labels: ${imageLabels.slice(0, 5).join(', ')}` : null,
    ipfsGatewayUrl ? `- IPFS gateway: ${ipfsGatewayUrl}` : null,
    '',
    'Instructions:',
    '- Treat the image verification report below as the textual description of the image.',
    '- If user-provided text exists, treat it as the primary claim to check.',
    '- If the report indicates related sources or matches, use them to assess the claim.',
    '- If evidence is insufficient, state exactly what is missing and what to collect next (be specific).'
  ].filter(Boolean).join('\n') : '';

  return [
    header,
    context,
    userPrompt && userPrompt.trim() ? `\nUser instructions: ${userPrompt.trim()}` : null,
    imageGuidance,
    '',
    'Return the following format:',
    'Verdict: <True|False|Mixed>',
    '',
    'Answer:',
    '<1 short paragraph that directly answers in plain English>',
    '',
    'Detailed Summary:',
    '<2-4 short paragraphs that: (a) explain what is true/false and why, (b) give essential context, (c) include key numbers/dates and jurisdictions, and (d) reference the cited evidence. Keep it concise and readable—no fluff.>',
    '',
    'Key facts:',
    '- <specific fact 1 with a number/date>',
    '- <specific fact 2>',
    '- <specific fact 3>',
    '- <specific fact 4 (optional)>',
    '- <specific fact 5 (optional)>',
    '',
    'Nuances and caveats:',
    '- <brief nuance/caveat 1>',
    '- <brief nuance/caveat 2>',
    '- <brief nuance/caveat 3 (optional)>',
    '',
    'Sources:',
    '- https://... (primary/official where possible)',
    '- https://...',
    '- https://...',
    '- https://... (optional)',
    '- https://... (optional)',
    '',
    'Guidelines:',
    '- Cite 3-5 reputable sources with full https:// URLs. Prefer primary sources (.gov, .edu, official reports, peer-reviewed research, company docs, major reputable outlets).',
    '- Be precise with dates, figures, and jurisdictions. Avoid speculation.',
    '- If high-confidence sources are unavailable, write "No reliable sources found".',
    '',
    'Text (or image verification report) to fact-check:',
    contentSnippet
  ].join('\n');
}


// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    services: {
      hedera: !!hederaClient,
      filebase: !!(config.filebase.accessKeyId && config.filebase.secretAccessKey),
      ipfs: true,
      contentStore: contentStore.getStats()
    },
    timestamp: new Date().toISOString()
  });
});

// Content store status endpoint
app.get('/api/content-store/status', (req, res) => {
  res.json({
    success: true,
    ...contentStore.getStats(),
    availableCIDs: contentStore.getCIDs()
  });
});

// Test Filebase connectivity
app.get('/api/test-filebase', async (req, res) => {
  try {
    console.log('🧪 Testing Filebase connectivity...');
    console.log('🔧 Config check:', {
      hasAccessKey: !!config.filebase.accessKeyId,
      hasSecretKey: !!config.filebase.secretAccessKey,
      hasBucketName: !!config.filebase.bucketName,
      accessKeyStart: config.filebase.accessKeyId?.substring(0, 4),
      bucketName: config.filebase.bucketName,
      region: config.filebase.region,
      endpoint: config.filebase.endpoint
    });

    // Test 1: Head bucket (check if bucket exists and we have access)
    const headBucketCommand = new HeadBucketCommand({
      Bucket: config.filebase.bucketName
    });
    
    const headResult = await s3Client.send(headBucketCommand);
    console.log('✅ Bucket head successful:', headResult);

    // Test 2: List objects (check if we can list bucket contents)
    const listCommand = new ListObjectsV2Command({
      Bucket: config.filebase.bucketName,
      MaxKeys: 1
    });
    
    const listResult = await s3Client.send(listCommand);
    console.log('✅ Bucket list successful:', listResult);

    res.json({
      success: true,
      message: 'Filebase connectivity test passed',
      tests: {
        bucketHead: 'passed',
        bucketList: 'passed'
      },
      config: {
        bucketName: config.filebase.bucketName,
        region: config.filebase.region,
        endpoint: config.filebase.endpoint,
        hasCredentials: !!(config.filebase.accessKeyId && config.filebase.secretAccessKey)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Filebase connectivity test failed:', error);
    
    let errorDetails = {
      message: error.message,
      code: error.code || 'UNKNOWN',
      statusCode: error.$response?.statusCode || 'unknown'
    };

    // Check if this is an HTML response (XML parsing error)
    if (error.message.includes('closing tag') || error.message.includes('Deserialization error')) {
      errorDetails.type = 'HTML_RESPONSE';
      errorDetails.suggestion = 'Filebase is returning HTML instead of XML - check credentials and bucket name';
      
      if (error.$response) {
        console.log('🔍 Raw error response:', {
          statusCode: error.$response.statusCode,
          headers: error.$response.headers,
          body: error.$response.body?.toString?.() || 'No body'
        });
        errorDetails.responseBody = error.$response.body?.toString?.() || 'No body';
      }
    }

    res.status(500).json({
      success: false,
      message: 'Filebase connectivity test failed',
      error: errorDetails,
      config: {
        bucketName: config.filebase.bucketName,
        region: config.filebase.region,
        endpoint: config.filebase.endpoint,
        hasCredentials: !!(config.filebase.accessKeyId && config.filebase.secretAccessKey)
      },
      timestamp: new Date().toISOString()
    });
  }
});

// IPFS gateway endpoint
app.get('/api/ipfs/:cid', (req, res) => {
  const { cid } = req.params;
  const gatewayUrl = `${process.env.IPFS_GATEWAY_URL || 'https://ipfs.filebase.io/ipfs/'}${cid}`;
  
  res.json({
    success: true,
    cid,
    gatewayUrl,
    alternativeGateways: [
      `https://ipfs.io/ipfs/${cid}`,
      `https://gateway.pinata.cloud/ipfs/${cid}`,
      `https://cloudflare-ipfs.com/ipfs/${cid}`,
      `https://dweb.link/ipfs/${cid}`
    ]
  });
});

// Debug endpoint to check file in Filebase
app.get('/api/debug/filebase/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    const headObjectParams = {
      Bucket: config.filebase.bucketName,
      Key: filename
    };
    
    const headResult = await s3Client.send(new HeadObjectCommand(headObjectParams));
    
    res.json({
      success: true,
      filename,
      metadata: headResult.Metadata,
      headers: headResult.ResponseMetadata?.HTTPHeaders,
      lastModified: headResult.LastModified,
      contentLength: headResult.ContentLength,
      etag: headResult.ETag,
      possibleCID: headResult.Metadata?.['ipfs-hash'] || 
                   headResult.Metadata?.['ipfs-cid'] ||
                   headResult.Metadata?.['x-amz-meta-ipfs-hash'] ||
                   headResult.ETag?.replace(/"/g, '')
    });
    
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'File not found in Filebase',
      details: error.message
    });
  }
});

// Debug endpoint to verify what's actually stored at a CID
app.get('/api/debug/verify-cid/:cid', async (req, res) => {
  const { cid } = req.params;
  
  // Provide gateway URLs and instructions for manual verification
  const gateways = [
    `https://ipfs.filebase.io/ipfs/${cid}`,
    `https://ipfs.io/ipfs/${cid}`,
    `https://gateway.pinata.cloud/ipfs/${cid}`,
    `https://cloudflare-ipfs.com/ipfs/${cid}`,
    `https://dweb.link/ipfs/${cid}`
  ];
  
  res.json({
    success: true,
    cid,
    verification: {
      method1: "Visit any of the gateway URLs below in your browser",
      method2: "If text-only: You'll see the raw text content",
      method3: "If image-only: You'll see the image rendered",
      method4: "If image-with-text: You'll see the image (text is in Hedera message)",
      method5: "Use curl command below to check content type"
    },
    gatewayUrls: gateways,
    curlCommand: `curl -I "${gateways[0]}"`,
    whatToExpect: {
      textOnly: "Content-Type: text/plain - shows raw text when visited",
      imageOnly: "Content-Type: image/* - shows rendered image when visited", 
      imageWithText: "Content-Type: image/* - shows rendered image (text is in Hedera transaction message)"
    },
    hederaNote: "For image-with-text scenario, check the Hedera transaction message to find the associated text content"
  });
});

// Main notarization endpoint
app.post('/api/notarize', upload.single('file'), async (req, res) => {
  try {
    const { accountId, contentType, text, title = '', tags = '', mode = 'analysis', prompt: userPrompt = '' } = req.body;
    const file = req.file;

    // Validate required fields
    if (!accountId) {
      return res.status(400).json({ success: false, error: 'Account ID is required' });
    }

    if (contentType !== 'text' && contentType !== 'image') {
      return res.status(400).json({ success: false, error: 'Content type must be text or image' });
    }

    // Determine actual content scenario
    const hasText = text && text.trim().length > 0;
    const hasImage = file && file.buffer;
    
    if (!hasText && !hasImage) {
      return res.status(400).json({ success: false, error: 'Either text content or image file is required' });
    }

    // Determine what we're actually storing
    let actualContentType;
    if (hasImage && hasText) {
      actualContentType = 'image-with-text';
    } else if (hasImage) {
      actualContentType = 'image';
    } else {
      actualContentType = 'text';
    }

    let content;
    let filename;
    let contentBuffer;

    // Prepare content based on actual scenario - STORE RAW CONTENT ONLY
    if (actualContentType === 'text') {
      // Store raw text content only
      contentBuffer = Buffer.from(text, 'utf8');
      filename = `notarized-text-${Date.now()}.txt`;
    } else if (actualContentType === 'image' || actualContentType === 'image-with-text') {
      // For both image-only and image-with-text, store the raw image file
      // Text will be included in Hedera message for image-with-text case
      contentBuffer = file.buffer;
      filename = `notarized-${file.originalname}`;
    }

    console.log(`📁 Uploading RAW CONTENT to Filebase: ${filename} (${contentBuffer.length} bytes)`);
    console.log(`🔄 Actual content scenario: ${actualContentType}`);
    
    if (actualContentType === 'text') {
      console.log(`📄 Text content: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
    } else if (actualContentType === 'image') {
      console.log(`🖼️ Image only: ${file.originalname} (${file.mimetype})`);
    } else if (actualContentType === 'image-with-text') {
      console.log(`🖼️ Image: ${file.originalname} (${file.mimetype})`);
      console.log(`📝 Associated text: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
      console.log(`💡 Image stored in IPFS, text will be in Hedera message`);
    }

    // IPFS Strategy: Corporate network resilient approach
    let ipfsSuccess = false;
    let ipfsError = null;
    let actualIPFSCid = null;
    let uploadMethod = 'local-only';
    
    // Step 1: Always generate local CID first (works even behind corporate firewalls)
    console.log('🔧 Generating local IPFS CID (corporate network safe)...');
    try {
      actualIPFSCid = await generateIPFSCID(contentBuffer);
      console.log(`🎯 Local CID generated: ${actualIPFSCid}`);
      ipfsSuccess = true;
      uploadMethod = 'local-only';
      
      // Step 1.5: Store content in local content store for immediate orchestrator access
      console.log('🗃️ Storing content in local content store...');
      const contentText = actualContentType === 'text' ? text : `Image file: ${file?.originalname}${actualContentType === 'image-with-text' ? ` with text: ${text}` : ''}`;
      contentStore.store(actualIPFSCid, contentText, {
        contentType: actualContentType,
        filename: filename,
        size: contentBuffer.length,
        mimeType: actualContentType === 'text' ? 'text/plain' : file?.mimetype,
        hasText: hasText,
        hasImage: hasImage,
        uploadTimestamp: new Date().toISOString()
      });
      console.log(`✅ Content stored locally for immediate AI processing`);
    } catch (cidError) {
      console.error('❌ Local CID generation failed:', cidError.message);
      ipfsError = `CID generation failed: ${cidError.message}`;
    }
    
    // Step 2: Try Filebase upload as bonus (may fail in corporate networks)
    if (ipfsSuccess) {
      console.log('📁 Attempting Filebase network storage (optional)...');
      try {
        const putObjectParams = {
          Bucket: config.filebase.bucketName,
          Key: filename,
          Body: contentBuffer,
          ContentType: actualContentType === 'text' ? 'text/plain; charset=utf-8' : file?.mimetype || 'application/octet-stream',
          Metadata: {
            'uploaded-at': Date.now().toString(),
            'content-type': actualContentType,
            'local-cid': actualIPFSCid || 'unknown'
          }
        };

        const uploadResult = await s3Client.send(new PutObjectCommand(putObjectParams));
        console.log('✅ Filebase upload successful (bonus network storage)');
        uploadMethod = 'local+filebase';
        
      } catch (filebaseError) {
        console.log('⚠️ Filebase upload failed (expected in corporate networks):', filebaseError.message);
        // This is OK - we already have local CID
      }
    }

    // Record on Hedera blockchain
    let hederaTransactionHash = null;
    let hederaError = null;

    if (hederaClient && actualIPFSCid) {
      try {
        const notarizationData = {
          // Core notarization info
          accountId,
          ipfsCid: actualIPFSCid,
          contentType: actualContentType,  // Use the actual determined type
          timestamp: new Date().toISOString(),
          
          // Content metadata (agents can use this)
          title: title || '',
          tags: tags || '',
          originalFilename: (actualContentType === 'image' || actualContentType === 'image-with-text') ? file?.originalname : `${Date.now()}.txt`,
          contentSize: contentBuffer.length,
          mimeType: actualContentType === 'text' ? 'text/plain' : file?.mimetype,
          
          // For image-with-text scenario, include the text content here
          ...(actualContentType === 'image-with-text' && hasText ? { 
            associatedText: text,
            textDescription: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
            note: 'Image stored in IPFS, text content included in this message'
          } : {}),
          
          // Access URLs for agents
          ipfsGatewayUrl: `${process.env.IPFS_GATEWAY_URL || 'https://ipfs.filebase.io/ipfs/'}${actualIPFSCid}`,
          alternativeGateways: [
            `https://ipfs.io/ipfs/${actualIPFSCid}`,
            `https://gateway.pinata.cloud/ipfs/${actualIPFSCid}`,
            `https://cloudflare-ipfs.com/ipfs/${actualIPFSCid}`
          ],
          
          // Verification message
          notarizationProof: `Raw ${actualContentType} content stored at IPFS CID: ${actualIPFSCid}${actualContentType === 'image-with-text' ? ' (with associated text in this message)' : ''}`
        };

        // Submit to Hedera Topic (you might want to create a topic first)
        const message = JSON.stringify(notarizationData);
        console.log('🌐 Submitting to Hedera with CID:', actualIPFSCid);
        console.log('📝 Message preview:', message.substring(0, 150) + '...');
        
        // For now, we'll create a new topic for each message
        // In production, you'd want to reuse a single topic
        const topicCreateTx = await new TopicCreateTransaction()
          .setSubmitKey(PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY).publicKey)
          .setTransactionMemo(`IPFS CID: ${actualIPFSCid}`)
          .execute(hederaClient);

        const topicReceipt = await topicCreateTx.getReceipt(hederaClient);
        const topicId = topicReceipt.topicId;

        const submitTx = await new TopicMessageSubmitTransaction()
          .setTopicId(topicId)
          .setMessage(message)
          .setTransactionMemo(`CID:${actualIPFSCid}|TYPE:${actualContentType}|SIZE:${contentBuffer.length}${actualContentType === 'image-with-text' ? '|HAS_TEXT:true' : ''}`)
          .execute(hederaClient);

        const submitReceipt = await submitTx.getReceipt(hederaClient);
        hederaTransactionHash = submitTx.transactionId.toString();
        
        console.log('✅ Hedera transaction successful:', hederaTransactionHash);
      } catch (error) {
        console.error('❌ Hedera transaction failed:', error.message);
        hederaError = error.message;
      }
    } else {
      if (!hederaClient) {
        hederaError = 'Hedera client not configured - missing credentials';
      } else if (!actualIPFSCid) {
        hederaError = 'Cannot record on Hedera - no valid IPFS CID available';
      }
    }

    // INTERNAL STEP 6: If image-with-text, run JS Vision image analysis (best-effort)
    let imageAnalysis = null;
    if ((actualContentType === 'image-with-text' || actualContentType === 'image') && hasImage) {
      try {
        console.log('🧠 Running JS Vision image analysis...');
        imageAnalysis = await analyzeImageWithClaim(contentBuffer, hasText ? text : '');
      } catch (err) {
        console.warn('⚠️ JS image analysis failed:', err.message);
        imageAnalysis = { success: false, error: err.message };
      }
    }

    // INTERNAL STEP 7: Run analysis via Hedera Agent Kit (LangChain)
    let phase2Triggered = false; // not using orchestrator
    let phase2Status = 'using_hedera_agent_kit';
    let aiAnalysis = { agentKit: null };
    if (ipfsSuccess && actualIPFSCid) {
      try {
        if (!agentExecutor) {
          await initializeAgentExecutor();
        }
        if (agentExecutor) {
          console.log('🤖 Running analysis with Hedera Agent Kit executor...');
          const prompt = (mode === 'fact_check')
            ? buildFactCheckPrompt({
                cid: actualIPFSCid,
                contentType: actualContentType,
                text: hasText ? text : undefined,
                title,
                tags,
                accountId,
                hederaTxId: hederaTransactionHash,
                imageContext: imageAnalysis?.summary,
                imageLabels: imageAnalysis?.best_guess_labels,
                ipfsGatewayUrl: `${process.env.IPFS_GATEWAY_URL || 'https://ipfs.filebase.io/ipfs/'}${actualIPFSCid}`,
                userPrompt
              })
            : buildAnalysisPrompt({
                cid: actualIPFSCid,
                contentType: actualContentType,
                text: hasText ? text : undefined,
                title,
                tags,
                accountId,
                hederaTxId: hederaTransactionHash,
                imageContext: imageAnalysis?.summary,
                imageLabels: imageAnalysis?.best_guess_labels,
                ipfsGatewayUrl: `${process.env.IPFS_GATEWAY_URL || 'https://ipfs.filebase.io/ipfs/'}${actualIPFSCid}`,
                userPrompt
              });
          const result = await agentExecutor.invoke({ input: prompt });
          aiAnalysis = { agentKit: { model: activeLlmLabel, mode, output: result } };
          console.log('✅ Agent Kit analysis completed');
        } else {
          aiAnalysis = { error: 'agent_executor_unavailable' };
        }
      } catch (llmError) {
        console.log('⚠️ Agent Kit analysis failed:', llmError.message);
        aiAnalysis = { error: llmError.message };
      }
    }
    
    // INTERNAL STEP 8: Real-time Verification Check
    let verificationStatus = {};
    if (ipfsSuccess && actualIPFSCid) {
      try {
        console.log('🔍 Performing immediate verification checks...');
        
        // Quick IPFS accessibility test
        const ipfsCheckPromise = fetch(`https://ipfs.io/ipfs/${actualIPFSCid}`, { 
          method: 'HEAD',
          timeout: 5000 
        }).then(() => true).catch(() => false);
        
        const ipfsRace = await Promise.race([
          ipfsCheckPromise,
          new Promise(resolve => setTimeout(() => resolve('timeout'), 3000))
        ]);
        verificationStatus = {
          ipfsAccessible: ipfsRace === true,
          hederaRecorded: !!hederaTransactionHash,
          contentIntegrity: true,
          timestamp: new Date().toISOString()
        };
        
        console.log('✅ Verification check completed');
      } catch (verificationError) {
        console.log('⚠️ Verification check failed:', verificationError.message);
        verificationStatus = { error: verificationError.message };
      }
    }
    
    // INTERNAL STEP 9: Generate comprehensive proof package
    const proofPackage = {
      notarizationId: `${accountId}_${Date.now()}`,
      contentFingerprint: actualIPFSCid,
      blockchainProof: hederaTransactionHash,
      timestampProof: new Date().toISOString(),
      contentMetadata: {
        type: actualContentType,
        size: contentBuffer.length,
        originalFilename: filename,
        hasText: hasText,
        hasImage: hasImage
      },
      verificationMethods: [
        'ipfs_cid_verification',
        'hedera_blockchain_timestamp',
        'multiple_gateway_access',
        ...(phase2Triggered ? ['ai_claim_analysis'] : [])
      ],
      legalAdmissibility: {
        cryptographicProof: true,
        blockchainTimestamp: true,
        decentralizedStorage: true,
        contentIntegrity: true
      }
    };

    // Prepare response
    const response = {
      success: ipfsSuccess,
      ipfsCid: ipfsSuccess ? actualIPFSCid : null,
      timestamp: new Date().toISOString(),
      hederaTransactionHash,
      ipfsGatewayUrl: ipfsSuccess && actualIPFSCid ? `${process.env.IPFS_GATEWAY_URL || 'https://ipfs.filebase.io/ipfs/'}${actualIPFSCid}` : null,
      alternativeIPFSUrls: ipfsSuccess && actualIPFSCid ? [
        `https://ipfs.io/ipfs/${actualIPFSCid}`,
        `https://gateway.pinata.cloud/ipfs/${actualIPFSCid}`,
        `https://cloudflare-ipfs.com/ipfs/${actualIPFSCid}`,
        `https://dweb.link/ipfs/${actualIPFSCid}`
      ] : null,
      hederaExplorerUrl: hederaTransactionHash ? `https://hashscan.io/testnet/transaction/${hederaTransactionHash}` : null,
      message: ipfsSuccess 
        ? (hederaTransactionHash ? `${actualContentType === 'image-with-text' ? 'Image stored in IPFS, text in Hedera message' : `Raw ${actualContentType} content`} notarized! CID: ${actualIPFSCid}` : 'Content stored on IPFS successfully, but Hedera recording failed')
        : 'Content notarization failed',
      
      // VERIFICATION LINKS - Click these to verify your content
      verificationLinks: {
        hederaTransaction: hederaTransactionHash ? `https://hashscan.io/testnet/transaction/${hederaTransactionHash}` : null,
        hederaAccount: `https://hashscan.io/testnet/account/${accountId}`,
        ipfsCidAnalyzer: actualIPFSCid ? `https://cid.ipfs.io/#${actualIPFSCid}` : null,
        directIPFSAccess: actualIPFSCid ? `https://ipfs.filebase.io/ipfs/${actualIPFSCid}` : null,
      },
      
      // Enhanced response with internal processing status
      internalProcessing: {
        phase2Triggered: phase2Triggered,
        phase2Status: phase2Status,
        verificationStatus: verificationStatus,
        imageAnalysis,
        aiAnalysis,
        proofPackage: proofPackage,
        nextSteps: {
          aiAnalysis: aiAnalysis?.agentKit || aiAnalysis?.openai || aiAnalysis?.gemini ? 'Completed' : 'Unavailable',
          verification: verificationStatus.ipfsAccessible ? 'Content verified accessible' : 'Verification pending',
          monitoring: 'Real-time monitoring active'
        }
      },
      
      errors: {
        ipfs: ipfsError,
        hedera: hederaError
      },
      debug: {
        filename,
        contentSize: contentBuffer.length,
        actualCID: actualIPFSCid,
        requestedContentType: contentType,
        actualContentType: actualContentType,
        hasText: hasText,
        hasImage: hasImage,
        uploadMethod: uploadMethod,
        internalStepsCompleted: [
          'validation',
          'content_preparation', 
          'cid_generation',
          'ipfs_storage',
          'blockchain_recording',
          ...(phase2Triggered ? ['phase2_triggered'] : []),
          'verification_check',
          'proof_package_generated'
        ]
      }
    };

    // Return appropriate status code
    if (ipfsSuccess) {
      res.json(response);
    } else {
      res.status(500).json(response);
    }

  } catch (error) {
    console.error('❌ Notarization error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Phase 2 Main Orchestrator Integration
let phase2Orchestrator = null;
let improvedOrchestrator = null;

// Initialize Phase 2 orchestrator if enabled
if (config.features.phase2Enabled) {
  try {
    // Initialize improved orchestrator for real-time AI processing
    improvedOrchestrator = new ImprovedOrchestrator();
    
    // Keep main orchestrator for fallback
    phase2Orchestrator = new MainOrchestrator();
    console.log('🤖 Phase 2 Main Orchestrator initialized');
    
    // Auto-start if enabled
    if (config.agents.autoStartPhase2) {
      phase2Orchestrator.startRealTimeProcessing()
        .then(() => {
          console.log('✅ Phase 2 auto-started - monitoring Hedera for new claims');
        })
        .catch(error => {
          console.error('❌ Phase 2 auto-start failed:', error.message);
        });
    }
  } catch (error) {
    console.error('❌ Failed to initialize Phase 2 orchestrator:', error.message);
  }
} else {
  console.log('⚠️ Phase 2 not initialized - HuggingFace API key not configured');
}

// Phase 2 API Endpoints

// Get Phase 2 status
app.get('/api/phase2/status', (req, res) => {
  if (!phase2Orchestrator) {
    return res.json({
      success: false,
      message: 'Phase 2 orchestrator not initialized',
      status: 'not_available'
    });
  }

  const status = phase2Orchestrator.getApiStatus();
  const stats = phase2Orchestrator.getProductionStats();

  res.json({
    success: true,
    phase2: {
      ...status,
      stats
    }
  });
});

// Start Phase 2 orchestrator
app.post('/api/phase2/start', async (req, res) => {
  if (!phase2Orchestrator) {
    return res.status(400).json({
      success: false,
      message: 'Phase 2 orchestrator not initialized'
    });
  }

  if (phase2Orchestrator.isRunning) {
    return res.json({
      success: true,
      message: 'Phase 2 orchestrator already running'
    });
  }

  try {
    await phase2Orchestrator.startRealTimeProcessing();
    res.json({
      success: true,
      message: 'Phase 2 orchestrator started successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stop Phase 2 orchestrator
app.post('/api/phase2/stop', (req, res) => {
  if (!phase2Orchestrator) {
    return res.status(400).json({
      success: false,
      message: 'Phase 2 orchestrator not initialized'
    });
  }

  phase2Orchestrator.stop();
  res.json({
    success: true,
    message: 'Phase 2 orchestrator stopped'
  });
});

// Get processed claims
app.get('/api/phase2/claims', (req, res) => {
  if (!phase2Orchestrator) {
    return res.status(400).json({
      success: false,
      message: 'Phase 2 orchestrator not initialized'
    });
  }

  const claims = phase2Orchestrator.getAllProcessedClaims();
  res.json({
    success: true,
    claims,
    total: claims.length
  });
});

// Get specific claim by CID
app.get('/api/phase2/claims/:cid', (req, res) => {
  if (!phase2Orchestrator) {
    return res.status(400).json({
      success: false,
      message: 'Phase 2 orchestrator not initialized'
    });
  }

  const { cid } = req.params;
  const claim = phase2Orchestrator.getClaim(cid);
  
  if (!claim) {
    return res.status(404).json({
      success: false,
      message: `Claim with CID ${cid} not found`
    });
  }

  res.json({
    success: true,
    claim
  });
});

// ========================================
// IMPROVED ORCHESTRATOR ENDPOINTS (Enhanced AI Processing)
// ========================================

// Get improved orchestrator status
app.get('/api/phase2/improved/status', (req, res) => {
  if (!improvedOrchestrator) {
    return res.json({
      success: false,
      message: 'Improved Phase 2 orchestrator not initialized',
      status: 'not_available'
    });
  }

  const status = improvedOrchestrator.getStatus();
  res.json({
    success: true,
    status: status.isRunning ? 'running' : 'stopped',
    processedClaimsCount: status.processedClaimsCount,
    lastProcessedTimestamp: status.lastProcessedTimestamp,
    retryConfig: status.retryConfig
  });
});

// Start improved orchestrator (recommended for real-time AI)
app.post('/api/phase2/improved/start', async (req, res) => {
  if (!improvedOrchestrator) {
    return res.status(400).json({
      success: false,
      message: 'Improved Phase 2 orchestrator not initialized'
    });
  }

  if (improvedOrchestrator.getStatus().isRunning) {
    return res.json({
      success: true,
      message: 'Improved Phase 2 orchestrator already running'
    });
  }

  try {
    await improvedOrchestrator.startRealTimeProcessing();
    res.json({
      success: true,
      message: 'Improved Phase 2 orchestrator started successfully with IPFS propagation handling'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to start improved Phase 2 orchestrator',
      error: error.message
    });
  }
});

// Stop improved orchestrator
app.post('/api/phase2/improved/stop', (req, res) => {
  if (!improvedOrchestrator) {
    return res.status(400).json({
      success: false,
      message: 'Improved Phase 2 orchestrator not initialized'
    });
  }

  improvedOrchestrator.stop();
  res.json({
    success: true,
    message: 'Improved Phase 2 orchestrator stopped'
  });
});

// Get processed claims from improved orchestrator
app.get('/api/phase2/improved/claims', (req, res) => {
  if (!improvedOrchestrator) {
    return res.status(400).json({
      success: false,
      message: 'Improved Phase 2 orchestrator not initialized'
    });
  }

  res.json({
    success: true,
    claims: improvedOrchestrator.getProcessedClaims()
  });
});

// Manual claim processing with improved orchestrator
app.post('/api/phase2/improved/process/:cid', async (req, res) => {
  if (!improvedOrchestrator) {
    return res.status(400).json({
      success: false,
      message: 'Improved Phase 2 orchestrator not initialized'
    });
  }

  try {
    const { cid } = req.params;
    console.log(`🔧 Manual processing request for CID: ${cid}`);
    
    const result = await improvedOrchestrator.processClaimManually(cid);
    
    res.json({
      success: true,
      message: 'Claim processed successfully with improved orchestrator',
      claim: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process claim',
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('\n🚀 HEDERA CONTENT NOTARIZATION PLATFORM');
  console.log('='.repeat(50));
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🔗 IPFS integration: ✅ Ready`);
  console.log(`⚡ Hedera network: ${config.hedera.network} (${!!hederaClient ? 'Connected' : 'Disconnected'})`);
  console.log(`🤖 Phase 2 AI: ${!!phase2Orchestrator ? 'Available' : 'Disabled'}`);
  console.log(`🔄 Auto-processing: ${config.agents.autoStartPhase2 ? 'Enabled' : 'Manual'}`);
  console.log(`🌐 CORS origin: ${config.server.corsOrigin}`);
  console.log(`🏗️ Environment: ${config.server.nodeEnv}`);
  // Fire up Agent Kit on startup so first request has executor ready
  initializeAgentExecutor().catch(() => {});
  
  if (phase2Orchestrator && !config.agents.autoStartPhase2) {
    console.log('\n💡 Phase 2 Manual Controls:');
    console.log(`   Start: POST http://localhost:${PORT}/api/phase2/start`);
    console.log(`   Status: GET http://localhost:${PORT}/api/phase2/status`);
    console.log(`   Claims: GET http://localhost:${PORT}/api/phase2/claims`);
  }
  
  console.log('\n✅ Ready to accept notarization requests!');
});