# 💰 Hedera Content Notarization Platform - Staking System Guide

A comprehensive stake-to-use payment system that ensures users pay for successful notarization services with automatic refunds for failures.

## 🎯 Overview

The staking system adds a payment layer to the notarization platform where:
- **Users stake HBAR** before submitting content for notarization
- **Funds are held** in a smart contract during processing
- **Payment is transferred** to the app account on successful completion
- **Full refund is provided** if service fails or encounters technical issues

## 🏗️ Architecture

### Smart Contract (`NotarizationStaking.sol`)
- **Solidity contract** deployed on Hedera testnet
- **Manages stake lifecycle**: creation, completion, refunding, expiration
- **Security features**: owner-only functions, pause capability, timeout handling
- **App account**: `0.0.6884960` (receives successful payments)

### Backend Integration (`apps/backend/src/server.js`)
- **Staking validation**: Checks for valid stakes before processing
- **Automatic completion**: Transfers stake to app on success
- **Automatic refunds**: Returns stake to user on failure
- **API endpoints**: Full CRUD operations for stake management

### Frontend Integration (`apps/frontend/src/components/`)
- **StakingStep component**: Handles stake creation UI
- **Enhanced NotarizationForm**: Multi-step flow with staking
- **Real-time feedback**: Progress indicators and status updates
- **Wallet integration**: Uses connected HashPack credentials

## 🔧 Configuration

### Environment Variables (`.env`)

```bash
# Enable staking functionality
ENABLE_STAKING=true

# Application account that receives successful stakes
STAKING_APP_ACCOUNT_ID=0.0.6884960

# Stake amount limits (in tinybars)
MINIMUM_STAKE_AMOUNT=50000000      # 0.5 HBAR
MAX_STAKE_AMOUNT=1000000000        # 10 HBAR

# Timing configuration (in seconds)
SERVICE_TIMEOUT=3600               # 1 hour max processing time
AUTO_REFUND_TIMEOUT=86400          # 24 hour auto-refund window
STAKING_GRACE_PERIOD=300           # 5 minute grace period

# Smart contract ID (set after deployment)
STAKING_CONTRACT_ID=0.0.YOUR_CONTRACT_ID
```

### Default Values
- **Minimum Stake**: 0.5 HBAR (adjustable)
- **Maximum Stake**: 10 HBAR (adjustable)
- **Service Timeout**: 1 hour
- **Auto-refund**: 24 hours

## 🚀 Deployment Guide

### 1. Compile Smart Contract

First, compile the Solidity contract using your preferred tool:

#### Using Hardhat:
```bash
# Install dependencies
npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers

# Initialize Hardhat (if not already done)
npx hardhat init

# Add the contract to contracts/NotarizationStaking.sol
# Compile the contract
npx hardhat compile
```

#### Using solc directly:
```bash
# Install Solidity compiler
npm install -g solc

# Compile the contract
solc --bin --abi packages/contracts/NotarizationStaking.sol
```

### 2. Deploy Contract

Run the deployment script:

```bash
# From project root
node scripts/deploy-staking-contract.js
```

The script will:
- ✅ Validate your configuration
- ✅ Deploy the smart contract to Hedera testnet
- ✅ Return the contract ID
- ✅ Provide next steps

### 3. Update Configuration

Add the contract ID to your `.env` file:

```bash
# In apps/backend/config/.env
STAKING_CONTRACT_ID=0.0.YOUR_NEW_CONTRACT_ID
ENABLE_STAKING=true
```

### 4. Restart Services

```bash
# Restart backend to load new configuration
npm run dev:backend

# Or restart both services
npm run dev
```

## 💻 Usage Flow

### For Users (Frontend)

1. **Connect Wallet**: HashPack wallet connection required
2. **Create Stake**: User specifies stake amount (min 0.5 HBAR)
3. **Submit Content**: Upload text/files for notarization
4. **Automatic Payment**: Stake transferred to app on success
5. **Get Receipt**: Verification links and proof of payment

### For Developers (API)

#### 1. Check Staking Status
```bash
GET /api/staking/status
```

#### 2. Create Stake
```bash
POST /api/staking/create
{
  "requestId": "unique_request_id",
  "stakeAmount": 50000000,
  "userAccountId": "0.0.123456",
  "userPrivateKey": "user_private_key"
}
```

#### 3. Submit for Notarization
```bash
POST /api/notarize
FormData:
  - requestId: "unique_request_id"
  - stakeVerified: "true"
  - ... other parameters
```

#### 4. Automatic Processing
- ✅ Success → Stake transferred to app account
- ❌ Failure → Stake refunded to user

## 🔍 API Reference

### Staking Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/staking/config` | Get staking configuration |
| `GET` | `/api/staking/status` | Get system status and contract info |
| `POST` | `/api/staking/create` | Create new stake for request |
| `GET` | `/api/staking/stake/:requestId` | Get stake information |
| `POST` | `/api/staking/complete/:requestId` | Complete stake (admin only) |
| `POST` | `/api/staking/refund/:requestId` | Refund stake (admin only) |
| `POST` | `/api/staking/deploy` | Deploy smart contract (admin only) |

### Enhanced Notarization

The main notarization endpoint now supports staking:

```bash
POST /api/notarize
FormData:
  - requestId: "stake_123456"     # Required if staking enabled
  - stakeVerified: "true"         # Confirms stake exists
  - accountId: "0.0.123456"
  - contentType: "text"
  - text: "Content to notarize"
```

Response includes staking information:
```json
{
  "success": true,
  "ipfsCid": "bafybeig...",
  "hederaTransactionHash": "0.0.123@456.789",
  "staking": {
    "status": "completed",
    "message": "Stake transferred to application account",
    "transactionSuccessful": true
  }
}
```

## 🛡️ Security Features

### Smart Contract Security
- **Owner-only functions**: Only app account can complete/refund stakes
- **Pause functionality**: Emergency stop capability
- **Timeout protection**: Automatic expiration and refund eligibility
- **Amount validation**: Min/max stake limits enforced
- **Status tracking**: Prevents double-spending and replay attacks

### Backend Security
- **Stake validation**: Verified before processing begins
- **Automatic refunds**: Guaranteed on any failure
- **Error handling**: Comprehensive error recovery
- **Logging**: Complete audit trail of all operations
- **Rate limiting**: Prevent abuse (can be added)

### Frontend Security
- **Wallet integration**: Secure credential handling
- **Input validation**: Client-side amount validation
- **Real-time status**: Live updates on stake status
- **Error feedback**: Clear error messages and recovery options

## 🧪 Testing

### Manual Testing

1. **Test Stake Creation**:
```bash
curl -X POST http://localhost:3001/api/staking/create \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test_123",
    "stakeAmount": 50000000,
    "userAccountId": "0.0.YOUR_ACCOUNT",
    "userPrivateKey": "YOUR_PRIVATE_KEY"
  }'
```

2. **Test Notarization with Staking**:
```bash
curl -X POST http://localhost:3001/api/notarize \
  -F "requestId=test_123" \
  -F "stakeVerified=true" \
  -F "accountId=0.0.YOUR_ACCOUNT" \
  -F "contentType=text" \
  -F "text=Test content"
```

3. **Check Stake Status**:
```bash
curl http://localhost:3001/api/staking/stake/test_123
```

### Frontend Testing

1. Access `http://localhost:5173`
2. Connect HashPack wallet
3. Follow the staking flow:
   - Configure stake amount
   - Create stake transaction
   - Submit content for notarization
   - Verify payment completion

## 🚨 Troubleshooting

### Common Issues

**1. "Staking system not enabled"**
- Solution: Set `ENABLE_STAKING=true` in `.env`

**2. "Contract not deployed"**
- Solution: Run deployment script and set `STAKING_CONTRACT_ID`

**3. "Insufficient stake amount"**
- Solution: Increase stake amount above minimum threshold

**4. "Stake validation failed"**
- Solution: Ensure stake was created before notarization

**5. "Failed to create stake"**
- Solution: Check Hedera credentials and account balance

### Debug Mode

Enable comprehensive logging:
```bash
LOG_LEVEL=DEBUG
ENABLE_DETAILED_LOGS=true
```

### Contract Management

Check contract balance and status:
```bash
# Get contract status
curl http://localhost:3001/api/staking/status

# Check specific stake
curl http://localhost:3001/api/staking/stake/YOUR_REQUEST_ID
```

## 📊 Monitoring & Analytics

### Key Metrics to Track
- **Total stakes created**: Number of payment attempts
- **Success rate**: Percentage of completed vs refunded stakes
- **Average stake amount**: User payment patterns  
- **Processing time**: Time from stake to completion/refund
- **Error rates**: Failed transactions and causes

### Logging Points
- Stake creation and validation
- Payment completion/refund events
- Error conditions and recovery
- Contract interactions and gas usage
- User behavior and patterns

## 🔄 Future Enhancements

### Planned Features
- **Dynamic pricing**: Stake amount based on content size/type
- **Bulk operations**: Multiple stake management
- **Analytics dashboard**: Real-time metrics and reporting
- **Mobile app**: Native mobile staking interface
- **Multi-token support**: Other HTS tokens beyond HBAR

### Smart Contract Upgrades
- **Governance features**: Community voting on parameters
- **Staking pools**: Shared stakes for large operations
- **Insurance fund**: Protection against contract failures
- **Cross-chain integration**: Bridge to other networks

---

## 🎉 Conclusion

The staking system transforms the Hedera Content Notarization Platform into a **secure, payment-guaranteed service** where users pay only for successful operations. With automatic refunds, transparent processing, and enterprise-grade security, it provides the foundation for a sustainable, trustworthy notarization platform.

**Ready to secure your content with blockchain-backed guarantees!** 🛡️
