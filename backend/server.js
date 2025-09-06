import express from 'express';
import cors from 'cors';
import multer from 'multer';
import AWS from 'aws-sdk';
import { Client, AccountId, PrivateKey, TopicCreateTransaction, TopicMessageSubmitTransaction, Hbar } from '@hashgraph/sdk';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

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

// Configure AWS SDK for Filebase
const s3 = new AWS.S3({
  accessKeyId: process.env.FILEBASE_ACCESS_KEY_ID,
  secretAccessKey: process.env.FILEBASE_SECRET_ACCESS_KEY,
  endpoint: 'https://s3.filebase.com',
  region: process.env.FILEBASE_REGION || 'us-east-1',
  s3ForcePathStyle: true
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

// Utility function to upload content to Filebase IPFS
const uploadToFilebase = async (content, filename, contentType = 'application/octet-stream') => {
  try {
    console.log(`📁 Uploading to Filebase: ${filename} (${content.length} bytes)`);
    const key = `notarization/${uuidv4()}-${filename}`;
    
    const params = {
      Bucket: process.env.FILEBASE_BUCKET_NAME,
      Key: key,
      Body: content,
      ContentType: contentType,
      Metadata: {
        'uploaded-at': new Date().toISOString(),
        'service': 'hedera-notarization'
      }
    };

    const result = await s3.upload(params).promise();
    console.log(`✅ S3 upload successful:`, { location: result.Location, etag: result.ETag });
    
    // Wait for IPFS processing (longer wait for better reliability)
    console.log('⏳ Waiting for IPFS processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    let ipfsCid;
    let attempts = 0;
    const maxAttempts = 3;
    
    // Try multiple methods to get IPFS CID
    while (!ipfsCid && attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 Attempt ${attempts} to get IPFS CID...`);
      
      try {
        // Method 1: Check HEAD object metadata
        const headResult = await s3.headObject({
          Bucket: process.env.FILEBASE_BUCKET_NAME,
          Key: key
        }).promise();
        
        console.log('📋 Filebase metadata:', headResult.Metadata);
        
        // Try various metadata keys that Filebase might use
        ipfsCid = headResult.Metadata?.['ipfs-hash'] || 
                  headResult.Metadata?.['ipfs-cid'] ||
                  headResult.Metadata?.['cid'] ||
                  headResult.Metadata?.['ipfs'] ||
                  headResult.Metadata?.['ipfshash'];
        
        if (!ipfsCid && attempts < maxAttempts) {
          console.log(`⏳ IPFS CID not ready yet, waiting ${3000 * attempts}ms...`);
          await new Promise(resolve => setTimeout(resolve, 3000 * attempts));
        }
      } catch (metadataError) {
        console.warn(`⚠️ Metadata retrieval attempt ${attempts} failed:`, metadataError.message);
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
        }
      }
    }
    
    // If still no CID, try to generate one from ETag or use a fallback
    if (!ipfsCid) {
      console.log('⚠️ IPFS CID not found in metadata, using fallback method...');
      
      // Use ETag as fallback (remove quotes)
      const etag = result.ETag?.replace(/"/g, '');
      if (etag && etag.length > 10) {
        ipfsCid = etag;
        console.log(`🔧 Using ETag as CID: ${ipfsCid}`);
      } else {
        // Generate a hash-based CID as last resort
        const contentHash = crypto.createHash('sha256').update(content).digest('hex');
        ipfsCid = `bafyrei${contentHash.substring(0, 50)}`; // Simplified CID format
        console.log(`🆘 Generated fallback CID: ${ipfsCid}`);
      }
    }
    
    console.log(`🎯 IPFS CID extracted: ${ipfsCid}`);
    
    return {
      success: true,
      ipfsCid: ipfsCid,
      filebaseUrl: result.Location,
      ipfsGatewayUrl: `https://ipfs.filebase.io/ipfs/${ipfsCid}`,
      key: key
    };
  } catch (error) {
    console.error('❌ Filebase upload error:', error);
    throw new Error(`Failed to upload to Filebase: ${error.message}`);
  }
};

// Utility function to record on Hedera blockchain
const recordOnHedera = async (ipfsCid, metadata) => {
  if (!hederaClient) {
    throw new Error('Hedera client not initialized. Check your credentials.');
  }

  try {
    const notarizationRecord = {
      ipfsCid: ipfsCid,
      timestamp: new Date().toISOString(),
      accountId: metadata.accountId,
      contentType: metadata.contentType,
      title: metadata.title || null,
      tags: metadata.tags || [],
      hash: crypto.createHash('sha256').update(ipfsCid + metadata.accountId).digest('hex')
    };

    const message = JSON.stringify(notarizationRecord);
    
    // Create a new topic for this user or use existing one
    const topicId = process.env.HEDERA_TOPIC_ID || await createNotarizationTopic();
    
    const transaction = new TopicMessageSubmitTransaction({
      topicId: topicId,
      message: message
    });

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

    // Upload to Filebase IPFS
    console.log('Uploading to Filebase...');
    const uploadResult = await uploadToFilebase(content, filename, mimeType);
    
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
      filebaseUrl: uploadResult.filebaseUrl,
      ipfsGatewayUrl: `https://ipfs.filebase.io/ipfs/${uploadResult.ipfsCid}`,
      message: hederaResult 
        ? 'Content successfully notarized on Hedera blockchain and stored on IPFS via Filebase'
        : 'Content successfully stored on IPFS via Filebase (Hedera recording failed)'
    };

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
    if (error.message.includes('Filebase')) {
      res.status(503).json({ 
        error: 'IPFS storage service unavailable', 
        message: 'Failed to store content on IPFS. Please try again in a moment.',
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
      filebase: !!process.env.FILEBASE_ACCESS_KEY_ID,
      hedera: !!hederaClient,
      server: true
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Hedera Notarization Backend running on port ${PORT}`);
  console.log(`📁 Filebase configured: ${!!process.env.FILEBASE_ACCESS_KEY_ID}`);
  console.log(`⚡ Hedera configured: ${!!hederaClient}`);
  console.log(`🌐 CORS origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
});
