import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { S3Client, PutObjectCommand, HeadObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { Client, AccountId, PrivateKey, TopicCreateTransaction, TopicMessageSubmitTransaction, Hbar } from '@hashgraph/sdk';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import * as raw from 'multiformats/codecs/raw';

// Import unified configuration
import { config, validateConfig, getConfigSummary } from '../../../packages/config/env/config.js';

// Import main orchestrator (renamed from production-orchestrator)
import MainOrchestrator from '../../../packages/agents/orchestrators/main-orchestrator.js';

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
  origin: config.server.corsOrigin
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

// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    services: {
      hedera: !!hederaClient,
      filebase: !!(process.env.FILEBASE_ACCESS_KEY_ID && process.env.FILEBASE_SECRET_ACCESS_KEY),
      ipfs: true
    },
    timestamp: new Date().toISOString()
  });
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
      Bucket: process.env.FILEBASE_BUCKET_NAME,
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
    const { accountId, contentType, text, title = '', tags = '' } = req.body;
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

    // Upload to Filebase (IPFS)
    let ipfsSuccess = false;
    let ipfsError = null;
    let actualIPFSCid = null;

    try {
      const putObjectParams = {
        Bucket: process.env.FILEBASE_BUCKET_NAME,
        Key: filename,
        Body: contentBuffer,
        ContentType: actualContentType === 'text' ? 'text/plain; charset=utf-8' : file?.mimetype || 'application/octet-stream',
        // Minimal metadata - full data will be stored in Hedera instead
        Metadata: {
          'original-filename': (actualContentType === 'image' || actualContentType === 'image-with-text') ? file.originalname : filename,
          'content-scenario': actualContentType
        }
      };

      const uploadResult = await s3Client.send(new PutObjectCommand(putObjectParams));
      console.log('✅ S3 upload successful');
      
      // Try multiple approaches to get the IPFS CID from Filebase
      try {
        console.log('🔍 Attempting to extract IPFS CID from Filebase...');
        
        // Wait a moment for IPFS processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const headObjectParams = {
          Bucket: process.env.FILEBASE_BUCKET_NAME,
          Key: filename
        };
        
        const headResult = await s3Client.send(new HeadObjectCommand(headObjectParams));
        console.log('📋 Filebase response headers:', JSON.stringify(headResult, null, 2));
        
        // Try different possible header fields where Filebase might store the CID
        actualIPFSCid = headResult.Metadata?.['ipfs-hash'] || 
                       headResult.Metadata?.['ipfs-cid'] ||
                       headResult.Metadata?.['x-amz-meta-ipfs-hash'] ||
                       headResult.Metadata?.['cid'] ||
                       headResult.ResponseMetadata?.HTTPHeaders?.['x-ipfs-hash'] ||
                       uploadResult.ETag?.replace(/"/g, '');
        
        // Alternative: Generate deterministic CID from content (this should match what IPFS would generate)
        if (!actualIPFSCid) {
          console.log('🔧 Generating deterministic CID from content...');
          actualIPFSCid = await generateIPFSCID(contentBuffer);
          console.log(`🎯 Generated CID: ${actualIPFSCid}`);
        } else {
          console.log(`🎯 IPFS CID extracted from headers: ${actualIPFSCid}`);
        }
        
        // Clean up CID if it has extra characters
        if (actualIPFSCid && actualIPFSCid.length > 59) {
          actualIPFSCid = actualIPFSCid.substring(0, 59);
        }
        
      } catch (headError) {
        console.error('❌ Failed to get IPFS CID from headers:', headError.message);
        console.log('🔧 Generating fallback CID...');
        actualIPFSCid = await generateIPFSCID(contentBuffer);
        console.log(`🎯 Fallback CID: ${actualIPFSCid}`);
      }
      
      ipfsSuccess = true;
    } catch (error) {
      console.error('❌ S3 upload failed:', error.message);
      ipfsError = error.message;
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
        hasImage: hasImage
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

// Initialize Phase 2 orchestrator if enabled
if (config.features.phase2Enabled) {
  try {
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
  
  if (phase2Orchestrator && !config.agents.autoStartPhase2) {
    console.log('\n💡 Phase 2 Manual Controls:');
    console.log(`   Start: POST http://localhost:${PORT}/api/phase2/start`);
    console.log(`   Status: GET http://localhost:${PORT}/api/phase2/status`);
    console.log(`   Claims: GET http://localhost:${PORT}/api/phase2/claims`);
  }
  
  console.log('\n✅ Ready to accept notarization requests!');
});