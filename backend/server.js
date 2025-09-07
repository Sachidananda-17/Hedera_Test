import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { S3Client, PutObjectCommand, HeadObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { Client, AccountId, PrivateKey, TopicCreateTransaction, TopicMessageSubmitTransaction, Hbar } from '@hashgraph/sdk';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import * as raw from 'multiformats/codecs/raw';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Hedera client
let hederaClient = null;
try {
  hederaClient = Client.forTestnet();
  
  // Set operator from environment variables
  if (process.env.HEDERA_ACCOUNT_ID && process.env.HEDERA_PRIVATE_KEY) {
    hederaClient.setOperator(
      AccountId.fromString(process.env.HEDERA_ACCOUNT_ID),
      PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY)
    );
  } else {
    console.warn('⚠️ Hedera credentials not found in environment variables');
    hederaClient = null;
  }
} catch (error) {
  console.error('❌ Error initializing Hedera client:', error.message);
  hederaClient = null;
}

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173'
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Configure AWS S3 client for Filebase
const s3Client = new S3Client({
  endpoint: 'https://s3.filebase.com',
  region: process.env.FILEBASE_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.FILEBASE_SECRET_ACCESS_KEY || '',
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Hedera Notarization Backend running on port ${PORT}`);
  console.log(`🔗 IPFS CID generation: ✅ Ready`);
  console.log(`⚡ Hedera configured: ${!!hederaClient}`);
  console.log(`🌐 CORS origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
});