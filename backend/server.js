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

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173'
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure AWS SDK v3 for Filebase
const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY_ID,
    secretAccessKey: process.env.FILEBASE_SECRET_ACCESS_KEY
  },
  endpoint: {
    url: 'https://s3.filebase.com'
  },
  region: process.env.FILEBASE_REGION || 'us-east-1',
  forcePathStyle: true,
  // Additional config for better Filebase compatibility
  maxAttempts: 3
});

// Configure Hedera client
let hederaClient;
try {
  if (process.env.HEDERA_ACCOUNT_ID && process.env.HEDERA_PRIVATE_KEY) {
    hederaClient = process.env.HEDERA_NETWORK === 'mainnet' 
      ? Client.forMainnet() 
      : Client.forTestnet();
    
    // Clean the private key - remove 0x prefix if present
    let privateKeyString = process.env.HEDERA_PRIVATE_KEY;
    if (privateKeyString.startsWith('0x')) {
      privateKeyString = privateKeyString.substring(2);
    }
    
    hederaClient.setOperator(
      AccountId.fromString(process.env.HEDERA_ACCOUNT_ID),
      PrivateKey.fromStringECDSA(privateKeyString)
    );
  }
} catch (error) {
  console.error('Failed to initialize Hedera client:', error.message);
}

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Utility function to upload content to IPFS via Filebase or generate CID locally
const uploadToIPFS = async (content, filename, contentType = 'application/octet-stream') => {
  // First, always generate the CID locally as a fallback
  const hash = await sha256.digest(content);
  const cid = CID.create(1, raw.code, hash);
  const localCid = cid.toString();
  
  console.log(`📁 Processing content: ${filename} (${content.length} bytes) - CID: ${localCid}`);
  
  // Check if Filebase is configured
  const filebaseConfigured = process.env.FILEBASE_ACCESS_KEY_ID && 
                             process.env.FILEBASE_SECRET_ACCESS_KEY && 
                             process.env.FILEBASE_BUCKET_NAME;
  
  if (!filebaseConfigured) {
    console.log('⚠️ Filebase not configured, using local CID generation');
    return {
      success: true,
      ipfsCid: localCid,
      ipfsGatewayUrl: `https://ipfs.io/ipfs/${localCid}`,
      ipfsGatewayUrls: [
        `https://ipfs.io/ipfs/${localCid}`,
        `https://gateway.pinata.cloud/ipfs/${localCid}`,
        `https://cloudflare-ipfs.com/ipfs/${localCid}`
      ],
      timestamp: new Date().toISOString(),
      note: 'CID generated locally - configure Filebase for IPFS network upload',
      warning: 'Content not uploaded to IPFS network. Configure Filebase credentials for full functionality.'
    };
  }
  
  // Try Filebase upload
  try {
    console.log(`⬆️ Attempting Filebase upload...`);
    console.log(`🔧 Using bucket: ${process.env.FILEBASE_BUCKET_NAME}`);
    console.log(`🔧 Using region: ${process.env.FILEBASE_REGION || 'us-east-1'}`);
    
    const timestamp = Date.now();
    const uniqueKey = `hedera-notary/${timestamp}-${filename}`;
    
    const uploadParams = {
      Bucket: process.env.FILEBASE_BUCKET_NAME,
      Key: uniqueKey,
      Body: content,
      ContentType: contentType,
      Metadata: {
        'original-filename': filename,
        'upload-timestamp': timestamp.toString(),
        'content-size': content.length.toString(),
        'local-cid': localCid
      }
    };

    console.log(`🔧 Upload params:`, {
      Bucket: uploadParams.Bucket,
      Key: uploadParams.Key,
      ContentType: uploadParams.ContentType,
      ContentLength: content.length
    });

    const uploadCommand = new PutObjectCommand(uploadParams);
    const uploadResult = await s3Client.send(uploadCommand);
    console.log(`✅ Filebase upload successful:`, uploadResult);
    
    // Try to get the actual IPFS CID from Filebase
    let filebaseCid = localCid; // Default to local CID
    
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: uploadParams.Bucket,
        Key: uniqueKey
      });
      const headResult = await s3Client.send(headCommand);
      
      // Filebase might store CID in metadata or ETag
      filebaseCid = headResult.Metadata?.cid || 
                   headResult.Metadata?.['ipfs-hash'] ||
                   headResult.ETag?.replace(/"/g, '') ||
                   localCid;
                   
      console.log(`🎯 Filebase CID: ${filebaseCid}`);
    } catch (metadataError) {
      console.log('ℹ️ Using local CID as Filebase CID not available in metadata');
    }
    
    const gatewayUrls = [
      `https://ipfs.filebase.io/ipfs/${filebaseCid}`,
      `https://ipfs.io/ipfs/${filebaseCid}`,
      `https://gateway.pinata.cloud/ipfs/${filebaseCid}`,
      `https://cloudflare-ipfs.com/ipfs/${filebaseCid}`
    ];
    
    return {
      success: true,
      ipfsCid: filebaseCid,
      ipfsGatewayUrl: gatewayUrls[0],
      ipfsGatewayUrls: gatewayUrls,
      filebaseUrl: `https://s3.filebase.com/${uploadParams.Bucket}/${uniqueKey}`,
      timestamp: new Date().toISOString(),
      note: 'Content successfully uploaded to IPFS via Filebase'
    };
    
  } catch (filebaseError) {
    console.error('❌ Filebase upload failed:', filebaseError.message);
    console.log('🔄 Falling back to local CID generation...');
    
    // Provide more specific error information
    let errorDetails = filebaseError.message;
    if (filebaseError.code === 'NoSuchBucket') {
      errorDetails = `Bucket '${process.env.FILEBASE_BUCKET_NAME}' does not exist. Please create it in your Filebase dashboard.`;
    } else if (filebaseError.code === 'InvalidAccessKeyId') {
      errorDetails = 'Invalid Filebase Access Key ID. Please check your credentials.';
    } else if (filebaseError.code === 'SignatureDoesNotMatch') {
      errorDetails = 'Invalid Filebase Secret Access Key. Please check your credentials.';
    } else if (filebaseError.message.includes('closing tag') || filebaseError.message.includes('Deserialization error')) {
      errorDetails = 'Filebase returned an HTML error page. Check your endpoint configuration and credentials.';
      console.log('🔍 Full error details:', JSON.stringify(filebaseError, null, 2));
      if (filebaseError.$response) {
        console.log('🔍 Response details:', {
          statusCode: filebaseError.$response.statusCode,
          headers: filebaseError.$response.headers,
          body: filebaseError.$response.body?.toString?.() || 'No body'
        });
      }
    } else if (filebaseError.$response && filebaseError.$response.body) {
      console.log('🔍 Raw Filebase response:', filebaseError.$response.body);
      errorDetails = 'Filebase configuration error. Check logs for raw response.';
    }
    
    console.log('🔧 Debug - Environment check:', {
      hasAccessKey: !!process.env.FILEBASE_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.FILEBASE_SECRET_ACCESS_KEY,
      hasBucketName: !!process.env.FILEBASE_BUCKET_NAME,
      accessKeyStart: process.env.FILEBASE_ACCESS_KEY_ID?.substring(0, 4),
      bucketName: process.env.FILEBASE_BUCKET_NAME
    });
    
    return {
      success: true,
      ipfsCid: localCid,
      ipfsGatewayUrl: `https://ipfs.io/ipfs/${localCid}`,
      ipfsGatewayUrls: [
        `https://ipfs.io/ipfs/${localCid}`,
        `https://gateway.pinata.cloud/ipfs/${localCid}`,
        `https://cloudflare-ipfs.com/ipfs/${localCid}`
      ],
      timestamp: new Date().toISOString(),
      note: 'Filebase upload failed - CID generated locally (content may not be available on IPFS network)',
      warning: 'Content upload to IPFS failed. CID is valid but content may not be retrievable.',
      error: errorDetails
    };
  }
};

// Utility function to record on Hedera blockchain
const recordOnHedera = async (ipfsCid, metadata) => {
  if (!hederaClient) {
    throw new Error('Hedera client not initialized. Check your credentials.');
  }

  try {
    // Message structure as per specification
    const notarizationRecord = {
      account: metadata.accountId,
      cid: ipfsCid,
      bounty: "false",
      timestamp: new Date().toISOString()
    };

    const message = JSON.stringify(notarizationRecord);
    
    // Create a new topic for this user or use existing one
    const topicId = process.env.HEDERA_TOPIC_ID || await createNotarizationTopic();
    
    const transaction = new TopicMessageSubmitTransaction({
      topicId: topicId,
      message: message
    }).setTransactionMemo(`${ipfsCid}`);

    const txResponse = await transaction.execute(hederaClient);
    const receipt = await txResponse.getReceipt(hederaClient);
    
    return {
      success: true,
      transactionId: txResponse.transactionId.toString(),
      consensusTimestamp: receipt.consensusTimestamp?.toString(),
      topicId: topicId.toString()
    };
  } catch (error) {
    console.error('Hedera transaction error:', error);
    throw new Error(`Failed to record on Hedera: ${error.message}`);
  }
};

// Create a topic for notarization
const createNotarizationTopic = async () => {
  if (!hederaClient) {
    throw new Error('Hedera client not initialized');
  }

  try {
    let privateKeyString = process.env.HEDERA_PRIVATE_KEY;
    if (privateKeyString.startsWith('0x')) {
      privateKeyString = privateKeyString.substring(2);
    }
    
    const privateKey = PrivateKey.fromStringECDSA(privateKeyString);
    
    const transaction = new TopicCreateTransaction({
      memo: "Hedera Content Notarization Topic",
      adminKey: privateKey.publicKey,
      submitKey: privateKey.publicKey
    });

    const txResponse = await transaction.execute(hederaClient);
    const receipt = await txResponse.getReceipt(hederaClient);
    const topicId = receipt.topicId;
    
    console.log(`✅ Created new topic: ${topicId}`);
    process.env.HEDERA_TOPIC_ID = topicId.toString();
    
    return topicId;
  } catch (error) {
    console.error('Failed to create topic:', error);
    throw error;
  }
};

// Main notarization endpoint
app.post('/api/notarize', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  console.log(`🚀 Notarization request started at ${new Date().toISOString()}`);
  
  try {
    const { accountId, contentType, text, title, tags } = req.body;
    
    // Enhanced validation with detailed error messages
    if (!accountId || typeof accountId !== 'string' || accountId.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Account ID is required', 
        details: 'Please provide a valid Hedera account ID (e.g., 0.0.123456)' 
      });
    }

    if (contentType !== 'text' && contentType !== 'image') {
      return res.status(400).json({ 
        error: 'Content type must be "text" or "image"',
        details: `Received contentType: "${contentType}". Only "text" and "image" are supported.`
      });
    }

    if (contentType === 'text') {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ 
          error: 'Text content is required when contentType is "text"',
          details: 'Please provide non-empty text content to notarize.'
        });
      }
      if (text.length > 50000) { // 50KB text limit
        return res.status(400).json({ 
          error: 'Text content too large',
          details: 'Text content must be less than 50,000 characters.'
        });
      }
    }

    if (contentType === 'image') {
      if (!req.file) {
        return res.status(400).json({ 
          error: 'Image file is required when contentType is "image"',
          details: 'Please upload a valid image file (JPG, JPEG, or PNG).'
        });
      }
      if (req.file.size > 10 * 1024 * 1024) { // 10MB limit
        return res.status(400).json({ 
          error: 'Image file too large',
          details: 'Image file must be less than 10MB.'
        });
      }
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(req.file.mimetype)) {
        return res.status(400).json({ 
          error: 'Unsupported image format',
          details: `Received: ${req.file.mimetype}. Only JPEG and PNG images are supported.`
        });
      }
    }

    // Validate account ID format
    if (!accountId.match(/^\d+\.\d+\.\d+$/)) {
      return res.status(400).json({ 
        error: 'Invalid account ID format',
        details: 'Account ID must be in format "0.0.123456"'
      });
    }

    // Log request details
    console.log(`📋 Processing request:`, {
      accountId,
      contentType,
      textLength: contentType === 'text' ? text?.length : 0,
      fileSize: contentType === 'image' ? req.file?.size : 0,
      fileName: req.file?.originalname,
      title: title || 'No title',
      tags: tags || 'No tags'
    });

    let content, filename, mimeType;

    if (contentType === 'text') {
      content = Buffer.from(text, 'utf8');
      filename = `text-${Date.now()}.txt`;
      mimeType = 'text/plain';
    } else {
      content = req.file.buffer;
      filename = req.file.originalname || `image-${Date.now()}.${req.file.mimetype.split('/')[1]}`;
      mimeType = req.file.mimetype;
    }

    // Generate IPFS CID 
    console.log('Generating IPFS CID...');
    const uploadResult = await uploadToIPFS(content, filename, mimeType);
    
    if (!uploadResult.success) {
      return res.status(500).json({ error: 'Failed to upload content to IPFS' });
    }

    // Try to record on Hedera blockchain
    let hederaResult = null;
    let hederaError = null;
    
    try {
      console.log('Recording on Hedera...');
      hederaResult = await recordOnHedera(uploadResult.ipfsCid, {
        accountId,
        contentType,
        title: title || '',
        tags: tags ? tags.split(',').map(tag => tag.trim()) : []
      });
      console.log('✅ Hedera recording successful!');
    } catch (error) {
      console.log('⚠️ Hedera recording failed, but IPFS upload succeeded:', error.message);
      hederaError = error.message;
    }

    // Return success response
    const response = {
      success: true,
      ipfsCid: uploadResult.ipfsCid,
      timestamp: new Date().toISOString(),
      ipfsGatewayUrl: uploadResult.ipfsGatewayUrl,
      ipfsGatewayUrls: uploadResult.ipfsGatewayUrls, // All available gateways
      filebaseUrl: uploadResult.filebaseUrl, // Filebase storage URL
      message: hederaResult 
        ? 'Content successfully notarized on Hedera blockchain and uploaded to IPFS'
        : 'Content successfully uploaded to IPFS (Hedera recording failed)'
    };

    // Include upload status and any warnings
    if (uploadResult.note) {
      response.ipfsNote = uploadResult.note;
    }
    if (uploadResult.warning) {
      response.ipfsWarning = uploadResult.warning;
    }
    if (uploadResult.error) {
      response.ipfsError = uploadResult.error;
    }

    if (hederaResult) {
      response.hederaTransactionHash = hederaResult.transactionId;
      response.hederaTopicId = hederaResult.topicId;
    } else {
      response.hederaError = hederaError;
    }

    // Log successful completion
    const processingTime = Date.now() - startTime;
    console.log(`✅ Notarization completed successfully in ${processingTime}ms`);
    console.log(`📊 Response summary: IPFS CID: ${response.ipfsCid}, Hedera: ${!!hederaResult}`);
    
    res.json(response);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ Notarization failed after ${processingTime}ms:`, {
      error: error.message,
      stack: error.stack,
      accountId: req.body?.accountId,
      contentType: req.body?.contentType
    });
    
    // Provide specific error responses based on error type
    if (error.message.includes('IPFS')) {
      res.status(503).json({ 
        error: 'IPFS processing failed', 
        message: 'Failed to generate IPFS CID. Please try again in a moment.',
        details: error.message
      });
    } else if (error.message.includes('Hedera')) {
      res.status(503).json({ 
        error: 'Blockchain service unavailable', 
        message: 'Failed to record on blockchain. Content may still be stored on IPFS.',
        details: error.message
      });
    } else if (error.message.includes('validation') || error.message.includes('required')) {
      res.status(400).json({ 
        error: 'Validation error', 
        message: error.message,
        details: 'Please check your input data and try again.'
      });
    } else {
      res.status(500).json({ 
        error: 'Internal server error', 
        message: 'An unexpected error occurred during notarization.',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later.'
      });
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      ipfs: true, // IPFS CID generation is always available
      hedera: !!hederaClient,
      server: true
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Hedera Notarization Backend running on port ${PORT}`);
  console.log(`🔗 IPFS CID generation: ✅ Ready`);
  console.log(`⚡ Hedera configured: ${!!hederaClient}`);
  console.log(`🌐 CORS origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
});
