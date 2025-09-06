# IPFS Configuration Setup

## The Problem That Was Fixed

Your application was experiencing **504 Gateway Timeout** errors when trying to access IPFS content because:

1. **Local CID Generation Only**: The backend was generating valid IPFS CIDs locally but **not uploading content to IPFS**
2. **No Network Providers**: When users tried to access IPFS gateway URLs, there were no providers for those CIDs in the IPFS network
3. **Dead Links**: All IPFS gateway URLs were returning 504 errors because content didn't exist on the network

## What Was Fixed

✅ **Implemented Real IPFS Upload**: Now uploads content to IPFS via Filebase (S3-compatible IPFS pinning service)
✅ **Multiple Gateway Support**: Provides multiple IPFS gateway URLs for redundancy  
✅ **Error Handling**: Graceful fallbacks if upload fails
✅ **Better UI Feedback**: Shows upload status, warnings, and multiple gateway options

## Required Environment Variables

Create a `.env` file in the `backend/` directory with these variables:

```env
# Hedera Configuration
HEDERA_ACCOUNT_ID=0.0.123456
HEDERA_PRIVATE_KEY=your_private_key_here
HEDERA_NETWORK=testnet
HEDERA_TOPIC_ID=0.0.123456

# IPFS Storage via Filebase (S3-compatible IPFS pinning service)
FILEBASE_ACCESS_KEY_ID=your_filebase_access_key
FILEBASE_SECRET_ACCESS_KEY=your_filebase_secret_key
FILEBASE_REGION=us-east-1
FILEBASE_BUCKET_NAME=hedera-notary

# Server Configuration
PORT=3001
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

## Filebase Setup Instructions

1. **Sign up for Filebase**: https://filebase.com/
2. **Create an IPFS bucket** named `hedera-notary`
3. **Generate Access Keys**:
   - Go to Access Keys section
   - Create new access key pair
   - Copy the Access Key ID and Secret Access Key
4. **Update your `.env`** with the Filebase credentials

## How It Now Works

1. **Content Upload**: Files/text are uploaded to Filebase S3 bucket
2. **Auto-Pinning**: Filebase automatically pins content to IPFS network
3. **CID Retrieval**: Extract IPFS CID from Filebase response
4. **Multiple Gateways**: Provides several IPFS gateway URLs for redundancy:
   - `https://ipfs.filebase.io/ipfs/{CID}` (Primary - Filebase gateway)
   - `https://ipfs.io/ipfs/{CID}` (Public IPFS gateway)
   - `https://gateway.pinata.cloud/ipfs/{CID}` (Pinata gateway)
   - `https://cloudflare-ipfs.com/ipfs/{CID}` (Cloudflare gateway)

## Fallback Behavior

If Filebase upload fails, the system will:
1. Generate CID locally (same as before)
2. Show warning that content may not be accessible
3. Still record transaction on Hedera blockchain
4. Display error details to user

## Testing

1. Start your backend: `npm start` in the `backend/` directory
2. Upload some content through the frontend
3. Click on the IPFS gateway URLs to verify content is accessible
4. Try different gateways if one is slow

## Benefits

- ✅ **Reliable IPFS Access**: Content is actually available on IPFS network
- ✅ **Redundant Gateways**: Multiple fallback options if one gateway is slow
- ✅ **Professional Service**: Filebase provides enterprise-grade IPFS pinning
- ✅ **Cost Effective**: Filebase has competitive pricing for IPFS storage
- ✅ **S3 Compatible**: Easy integration with existing AWS SDK code
