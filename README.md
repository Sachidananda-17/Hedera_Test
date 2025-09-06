# 🚀 Hedera Content Notarization Platform

A decentralized content notarization system that combines **IPFS storage** via Filebase with **Hedera blockchain** timestamping to create legally-admissible proof of content ownership and existence.

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-18%2B-green.svg)
![React](https://img.shields.io/badge/react-19.1-blue.svg)
![Hedera](https://img.shields.io/badge/hedera-testnet-purple.svg)

## 🌟 Features

### 📱 **Frontend (React + TypeScript)**
- **Modern UI**: Clean, responsive interface built with TailwindCSS
- **HashPack Integration**: Seamless Hedera wallet connection
- **Dual Content Support**: Text and image (JPG/PNG) notarization
- **Real-time Validation**: Smart form validation and error handling
- **Success Tracking**: Visual feedback with clickable verification links

### ⚡ **Backend (Node.js + Express)**
- **IPFS Storage**: Content uploaded to Filebase for permanent decentralized storage
- **Blockchain Recording**: Hedera Consensus Service for immutable timestamping
- **Graceful Degradation**: IPFS works even if Hedera fails
- **Comprehensive Logging**: Detailed operation tracking for debugging
- **Security**: CORS protection and file validation

### 🔐 **Cryptographic Guarantees**
- **Content Integrity**: IPFS CID proves content hasn't been tampered with
- **Timestamp Proof**: Hedera transaction hash provides legal timestamp evidence
- **Global Verification**: Anyone worldwide can verify authenticity
- **Permanent Storage**: Content survives even if original servers go down

## 🏗️ Project Structure

```
Hedera_Test/
├── 📁 frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── NotarizationDialog.tsx    # Main notarization UI component
│   │   ├── App.tsx                       # Main app with wallet integration
│   │   ├── main.tsx                      # React entry point
│   │   └── index.css                     # TailwindCSS styles
│   ├── package.json                      # Frontend dependencies
│   └── vite.config.ts                    # Vite configuration
├── 📁 backend/
│   ├── server.js                         # Express server with all endpoints
│   ├── package.json                      # Backend dependencies
│   ├── .env.example                      # Environment template
│   └── .env                             # Your actual credentials (git-ignored)
├── README.md                             # This file
├── .gitignore                           # Git ignore rules
└── tailwind.config.js                   # TailwindCSS configuration
```

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** - [Download here](https://nodejs.org/)
- **HashPack Wallet** - [Install browser extension](https://hashpack.app/)
- **Filebase Account** - [Sign up](https://console.filebase.com/) for IPFS storage
- **Hedera Testnet Account** - Get test HBAR from [faucet](https://portal.hedera.com/faucet)

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd Hedera_Test
   npm install
   cd backend && npm install
   ```

2. **Configure environment variables:**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your actual credentials
   ```

3. **Start both servers:**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm start
   
   # Terminal 2 - Frontend  
   npm run dev
   ```

4. **Open the application:**
   - Frontend: http://localhost:5173
   - Backend Health: http://localhost:3001/api/health

## ⚙️ Configuration

### Backend Environment Variables

```env
# Filebase Configuration (Required)
FILEBASE_ACCESS_KEY_ID=your_access_key_here
FILEBASE_SECRET_ACCESS_KEY=your_secret_key_here
FILEBASE_BUCKET_NAME=your_bucket_name_here
FILEBASE_REGION=us-east-1

# Hedera Configuration (Required)
HEDERA_ACCOUNT_ID=0.0.your_account_id
HEDERA_PRIVATE_KEY=your_private_key_here
HEDERA_NETWORK=testnet

# Server Configuration
PORT=3001
CORS_ORIGIN=http://localhost:5173
IPFS_GATEWAY_URL=https://ipfs.filebase.io/ipfs/
```

### Getting Your Credentials

#### **Filebase Setup:**
1. Create account at [console.filebase.com](https://console.filebase.com)
2. Create a bucket (choose IPFS network)
3. Generate Access Keys from dashboard
4. Copy Access Key ID and Secret Access Key

#### **Hedera Setup:**
1. Install HashPack browser extension
2. Create/import account and switch to Testnet
3. Get test HBAR from [Hedera faucet](https://portal.hedera.com/faucet)
4. Export private key from HashPack settings

## 🧪 Usage

### **Step 1: Connect Wallet**
- Open http://localhost:5173
- Connect your HashPack wallet (ensure it's on Testnet)
- Verify account ID and HBAR balance appear

### **Step 2: Notarize Content**

**For Text Content:**
1. Enter text in the content area
2. Add optional title and tags
3. Click "📝 Notarize Content"

**For Images:**
1. Upload JPG/PNG file (up to 10MB)
2. Add optional title and tags  
3. Click "📝 Notarize Content"

### **Step 3: Verify Results**
- **IPFS Link**: Click to view your content on IPFS gateway
- **Hedera Link**: Click to view blockchain transaction on HashScan
- **Save both links** as proof of ownership and timestamp!

## 📊 API Endpoints

### **POST /api/notarize**
Notarize content on blockchain and store on IPFS.

**Request (Text):**
```json
{
  "accountId": "0.0.1234567",
  "contentType": "text",
  "text": "Content to notarize",
  "title": "Optional title",
  "tags": "comma,separated,tags"
}
```

**Request (Image):**
- Use `multipart/form-data`
- Include `file` field with image
- Same other fields as text

**Response:**
```json
{
  "success": true,
  "ipfsCid": "QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "timestamp": "2025-01-05T22:43:24.699Z",
  "hederaTransactionHash": "0.0.1234567@1757111002.767860785",
  "ipfsGatewayUrl": "https://ipfs.filebase.io/ipfs/QmXXXXXXXX...",
  "message": "Content successfully notarized!"
}
```

### **GET /api/health**
Check server and service status.

### **GET /api/ipfs/:cid**
Get IPFS gateway URLs for a CID.

## 🛡️ Legal Use Cases

### **📄 Copyright Protection**
- Upload manuscripts, artwork, code
- Get blockchain timestamp proof of creation
- Use in court as evidence of prior ownership

### **⚖️ Patent Prior Art**
- Document inventions with detailed descriptions  
- Establish invention date on blockchain
- Defend against patent trolls

### **📋 Contract Verification**
- Notarize signed agreements and contracts
- Prove terms existed at specific time
- Immutable record of business deals

### **🎓 Academic Integrity**
- Timestamp research data and results
- Prevent accusations of data manipulation
- Establish publication priority

### **🏢 Business Documentation**
- Meeting minutes, strategic plans
- Audit trail for compliance
- Intellectual property protection

## 🎯 How It Works

1. **Content Upload** → Your content goes to IPFS via Filebase
2. **CID Generation** → Unique content identifier created (tamper-proof)
3. **Blockchain Recording** → Transaction recorded on Hedera with timestamp
4. **Proof Generation** → You get both IPFS link and blockchain hash
5. **Global Verification** → Anyone can verify authenticity using the links

## 🔧 Development

### **Available Scripts**

```bash
# Frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Backend  
npm start           # Start production server
npm run dev         # Start with nodemon (auto-reload)

# Combined
npm run dev:all     # Start both frontend and backend
```

### **Tech Stack**

**Frontend:**
- React 19 + TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- Hedera Wallet Connect
- HashPack integration

**Backend:**
- Node.js + Express
- AWS SDK (Filebase S3-compatible)
- Hedera SDK
- Multer (file uploads)

## 🐛 Troubleshooting

### **Common Issues**

**Wallet Connection Fails:**
- Ensure HashPack extension is installed
- Switch HashPack to Testnet mode  
- Check browser console for errors

**Filebase Upload Fails:**
- Verify credentials in `.env`
- Check bucket exists and is IPFS-enabled
- Ensure sufficient Filebase storage

**Hedera Transaction Fails:**
- Verify account has test HBAR tokens
- Check private key format (with or without 0x)
- Ensure account ID is correct

**IPFS Gateway Shows Error:**
- Content may still be processing (wait 1-2 minutes)
- Try alternative gateway: `https://ipfs.io/ipfs/[CID]`
- Verify CID is valid

### **Debug Mode**

Enable detailed logging by checking backend terminal output:
```
📁 Uploading to Filebase: filename (size)
✅ S3 upload successful
🎯 IPFS CID extracted: QmXXXX...
🌐 IPFS Gateway URL: https://...
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Make changes and test thoroughly
4. Commit: `git commit -m 'Add feature'`
5. Push: `git push origin feature-name`  
6. Submit pull request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### **Getting Help**
- Check the troubleshooting section above
- Review browser and server console logs  
- Ensure all prerequisites are properly configured
- Test with simple content first

### **Resources**
- [Hedera Documentation](https://docs.hedera.com/)
- [Filebase Documentation](https://docs.filebase.com/)
- [HashPack Wallet Guide](https://hashpack.app/)
- [IPFS Documentation](https://docs.ipfs.io/)

---

## 🎉 **Create Unbreakable Digital Proof with Blockchain + IPFS!**

**Your content. Your timestamp. Your proof. Forever.** 🛡️

---

*Built with ❤️ for the decentralized future*