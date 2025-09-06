import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Client, AccountId, PrivateKey, TopicCreateTransaction, TopicMessageSubmitTransaction } from '@hashgraph/sdk';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import * as raw from 'multiformats/codecs/raw';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Configure middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173'
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Configure S3 client for Filebase
const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY_ID,
    secretAccessKey: process.env.FILEBASE_SECRET_ACCESS_KEY
  },
  endpoint: 'https://s3.filebase.com',
  region: process.env.FILEBASE_REGION || 'us-east-1',
  forcePathStyle: true
});

// Configure Hedera client
let hederaClient;
try {
  if (process.env.HEDERA_ACCOUNT_ID && process.env.HEDERA_PRIVATE_KEY) {
    hederaClient = process.env.HEDERA_NETWORK === 'mainnet' 
      ? Client.forMainnet() 
      : Client.forTestnet();
    
    hederaClient.setOperator(
      AccountId.fromString(process.env.HEDERA_ACCOUNT_ID),
      PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY)
    );
  }
} catch (error) {
  console.error('Failed to initialize Hedera client:', error.message);
}

// Utility function to upload content to IPFS via Filebase or generate CID locally
const uploadToIPFS = async (content, filename, contentType = 'application/octet-stream') => {
  // First, always generate the CID locally as a fallback
  const hash = await sha256.digest(content);
  const cid = CID.create(1, raw.code, hash);
  const localCid = cid.toString();
  
  console.log(`📁 Processing content: ${filename} (${content.length} bytes) - CID: ${localCid}`);
  
  // Try Filebase upload
  try {
    console.log(`⬆️ Attempting Filebase upload...`);
    
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

    const uploadCommand = new PutObjectCommand(uploadParams);
    await s3Client.send(uploadCommand);
    
    return {
      success: true,
      ipfsCid: localCid,
      ipfsGatewayUrl: `https://ipfs.filebase.io/ipfs/${localCid}`,
      ipfsGatewayUrls: [
        `https://ipfs.filebase.io/ipfs/${localCid}`,
        `https://ipfs.io/ipfs/${localCid}`,
        `https://cloudflare-ipfs.com/ipfs/${localCid}`
      ],
      filebaseUrl: `https://s3.filebase.com/${uploadParams.Bucket}/${uniqueKey}`,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Filebase upload failed:', error.message);
    console.log('🔄 Falling back to local CID generation...');
    
    return {
      success: true,
      ipfsCid: localCid,
      ipfsGatewayUrl: `https://ipfs.io/ipfs/${localCid}`,
      ipfsGatewayUrls: [
        `https://ipfs.io/ipfs/${localCid}`,
        `https://cloudflare-ipfs.com/ipfs/${localCid}`
      ],
      timestamp: new Date().toISOString(),
      note: 'Filebase upload failed - CID generated locally',
      warning: 'Content may not be immediately available on IPFS network'
    };
  }
};

// Utility function to record on Hedera blockchain
const recordOnHedera = async (ipfsCid, metadata) => {
  if (!hederaClient) {
    throw new Error('Hedera client not initialized');
  }

  try {
    const message = JSON.stringify({
      cid: ipfsCid,
      metadata,
      timestamp: new Date().toISOString()
    });
    
    // Create a new topic or use existing one
    const topicId = process.env.HEDERA_TOPIC_ID || await createNotarizationTopic();
    
    const transaction = new TopicMessageSubmitTransaction({
      topicId: topicId,
      message: message
    }).setTransactionMemo(ipfsCid);

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
    throw error;
  }
};

// Create a topic for notarization
const createNotarizationTopic = async () => {
  if (!hederaClient) {
    throw new Error('Hedera client not initialized');
  }

  try {
    const transaction = new TopicCreateTransaction()
      .setSubmitKey(PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY).publicKey)
      .setMemo('Hedera Content Notarization Topic');

    const txResponse = await transaction.execute(hederaClient);
    const receipt = await txResponse.getReceipt(hederaClient);
    const topicId = receipt.topicId;
    
    console.log(`✅ Created new topic: ${topicId}`);
    return topicId;
  } catch (error) {
    console.error('Failed to create topic:', error);
    throw error;
  }
};

// Main notarization endpoint
app.post('/api/notarize', upload.single('file'), async (req, res) => {
  try {
    const { accountId, contentType, text } = req.body;
    
    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    let content, filename, mimeType;

    if (contentType === 'text') {
      if (!text) {
        return res.status(400).json({ error: 'Text content is required' });
      }
      content = Buffer.from(text, 'utf8');
      filename = `text-${Date.now()}.txt`;
      mimeType = 'text/plain';
    } else {
      if (!req.file) {
        return res.status(400).json({ error: 'File is required' });
      }
      content = req.file.buffer;
      filename = req.file.originalname;
      mimeType = req.file.mimetype;
    }

    // Upload to IPFS/Generate CID
    const uploadResult = await uploadToIPFS(content, filename, mimeType);
    
    // Record on Hedera
    const hederaResult = await recordOnHedera(uploadResult.ipfsCid, {
      accountId,
      contentType,
      filename
    });

    res.json({
      success: true,
      ...uploadResult,
      hederaTransactionId: hederaResult.transactionId,
      hederaTopicId: hederaResult.topicId
    });

  } catch (error) {
    console.error('Notarization error:', error);
    res.status(500).json({ 
      error: 'Notarization failed',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      ipfs: true,
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