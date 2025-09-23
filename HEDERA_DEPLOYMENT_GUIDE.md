# 🏛️ Hedera Network Deployment Guide

This guide explains how to deploy your staking smart contract specifically on **Hedera testnet** using Hedera Smart Contract Service (HSCS).

## 🌐 Hedera Network Overview

**Hedera** is a public distributed ledger that uses **hashgraph consensus** instead of traditional blockchain. Key differences:

- ⚡ **Ultra-fast**: 10,000+ TPS with 3-5 second finality
- 💰 **Low cost**: Predictable, low fees (fractions of cents)
- 🌱 **Sustainable**: Carbon-negative network
- 🛡️ **Enterprise-grade**: Bank-level security and governance

## 🔧 Hedera-Specific Setup

### 1. Account Requirements

You need **TWO Hedera accounts**:

1. **Deployer Account** (`HEDERA_ACCOUNT_ID`) - Deploys and manages the contract
2. **App Account** (`0.0.6884960`) - Receives successful stake payments

**Get Hedera Testnet Accounts:**
- **HashPack Wallet**: [hashpack.app](https://hashpack.app) → Create account
- **Hedera Portal**: [portal.hedera.com](https://portal.hedera.com) → Get testnet HBAR
- **Faucet**: Free testnet HBAR for development

### 2. Required HBAR Balance

**Deployer Account needs ~15-20 HBAR** for:
- Contract file creation: ~2-5 HBAR
- Contract deployment: ~5-10 HBAR  
- Initial testing: ~5 HBAR buffer

### 3. Hedera Environment Variables

```bash
# In apps/backend/config/.env

# Deployer Account (needs HBAR for deployment)
HEDERA_ACCOUNT_ID=0.0.YOUR_DEPLOYER_ACCOUNT
HEDERA_PRIVATE_KEY=your_deployer_private_key_here
HEDERA_NETWORK=testnet

# App Account (receives successful payments)
STAKING_APP_ACCOUNT_ID=0.0.6884960

# Network settings
HEDERA_MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com

# After deployment
STAKING_CONTRACT_ID=0.0.CONTRACT_ID_AFTER_DEPLOYMENT
ENABLE_STAKING=true
```

## 📋 Step-by-Step Deployment

### Step 1: Install Hardhat for Hedera

```bash
# Install Hardhat and dependencies
npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers

# Initialize Hardhat (if not already done)
npx hardhat init
# Select: "Create an empty hardhat.config.js"
```

### Step 2: Set Up Contract Structure

```bash
# Copy contract to Hardhat contracts directory
mkdir -p contracts
cp packages/contracts/NotarizationStaking.sol contracts/

# Use the provided Hedera-optimized hardhat.config.js
# (Already configured for Hedera's EVM version and gas limits)
```

### Step 3: Compile for Hedera

```bash
# Compile with Hedera-optimized settings
npx hardhat compile

# This creates:
# artifacts/contracts/NotarizationStaking.sol/NotarizationStaking.json
```

**Expected Output:**
```
Compiling 1 file with 0.8.19
Solidity compilation finished successfully
✅ Hedera environment variables configured
```

### Step 4: Verify Pre-Deployment

```bash
# Check your Hedera account balance
curl "https://testnet.mirrornode.hedera.com/api/v1/accounts/0.0.YOUR_ACCOUNT"

# Verify configuration
npm run health
```

### Step 5: Deploy to Hedera

```bash
# Run the Hedera deployment script
node scripts/deploy-staking-contract.js
```

**Deployment Process:**
1. ✅ Validates Hedera configuration
2. 🔍 Checks for compiled bytecode
3. 📄 Creates file on Hedera for bytecode storage
4. 🏗️ Deploys smart contract with constructor parameters
5. 💾 Saves contract ID for future use

**Expected Success Output:**
```
🎉 DEPLOYMENT SUCCESSFUL!
==============================
📋 Contract ID: 0.0.123456
🔗 App Account: 0.0.6884960
💰 Min Stake: 0.5 HBAR
⏱️  Timeout: 3600s
```

### Step 6: Update Configuration

```bash
# Add contract ID to your .env file
echo "STAKING_CONTRACT_ID=0.0.YOUR_NEW_CONTRACT_ID" >> apps/backend/config/.env
echo "ENABLE_STAKING=true" >> apps/backend/config/.env
```

### Step 7: Restart and Test

```bash
# Restart backend to load new configuration
npm run dev:backend

# Test staking system
curl http://localhost:3001/api/staking/status
```

## 🧪 Testing on Hedera Testnet

### Quick API Test

```bash
# Test stake creation
curl -X POST http://localhost:3001/api/staking/create \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test_hedera_123",
    "stakeAmount": 50000000,
    "userAccountId": "0.0.YOUR_TEST_ACCOUNT",
    "userPrivateKey": "your_test_private_key"
  }'

# Test notarization with staking
curl -X POST http://localhost:3001/api/notarize \
  -F "requestId=test_hedera_123" \
  -F "stakeVerified=true" \
  -F "accountId=0.0.YOUR_TEST_ACCOUNT" \
  -F "contentType=text" \
  -F "text=Testing Hedera staking system"
```

### Frontend Testing

1. Open `http://localhost:5173`
2. Connect HashPack wallet (testnet mode)
3. Go through staking flow:
   - Configure stake amount
   - Create stake on Hedera
   - Submit content for notarization
   - Verify payment completion

## 🔍 Hedera Network Verification

### Check Deployment on HashScan

- **Contract**: `https://hashscan.io/testnet/contract/0.0.YOUR_CONTRACT_ID`
- **App Account**: `https://hashscan.io/testnet/account/0.0.6884960`
- **Deployer Account**: `https://hashscan.io/testnet/account/0.0.YOUR_DEPLOYER`
- **Transactions**: View all contract interactions in real-time

### Mirror Node Queries

```bash
# Get contract info
curl "https://testnet.mirrornode.hedera.com/api/v1/contracts/0.0.YOUR_CONTRACT_ID"

# Check contract transactions
curl "https://testnet.mirrornode.hedera.com/api/v1/contracts/0.0.YOUR_CONTRACT_ID/results"

# Monitor app account balance
curl "https://testnet.mirrornode.hedera.com/api/v1/accounts/0.0.6884960"
```

## 🚨 Common Hedera Issues & Solutions

### ❌ "INSUFFICIENT_PAYER_BALANCE"
**Issue**: Not enough HBAR for deployment
**Solution**: Add 15-20 HBAR to deployer account

### ❌ "INVALID_SIGNATURE" 
**Issue**: Wrong account credentials
**Solution**: Verify `HEDERA_ACCOUNT_ID` and `HEDERA_PRIVATE_KEY`

### ❌ "CONTRACT_BYTECODE_EMPTY"
**Issue**: Contract not compiled
**Solution**: Run `npx hardhat compile`

### ❌ "MAX_GAS_LIMIT_EXCEEDED"
**Issue**: Gas limit too high for Hedera
**Solution**: Contract manager uses optimized limits (auto-fixed)

### ❌ "INVALID_CONTRACT_ID"
**Issue**: Contract deployment failed
**Solution**: Check constructor parameters and account balance

## 💡 Hedera Best Practices

### Gas Optimization
- ✅ Use provided optimized gas limits
- ✅ Batch operations when possible
- ✅ Monitor actual gas usage on HashScan

### Transaction Management  
- ✅ Set reasonable transaction fees
- ✅ Use proper receipt validation
- ✅ Implement retry logic for network issues

### Account Security
- ✅ Keep private keys secure
- ✅ Use separate accounts for deployment vs operations
- ✅ Monitor account balances and transactions

### Cost Management
- 💰 **Deployment**: ~10-15 HBAR one-time
- 💰 **Stake creation**: ~0.001-0.01 HBAR per stake
- 💰 **Completion/Refund**: ~0.001-0.01 HBAR per operation
- 💰 **Contract queries**: ~0.0001 HBAR per query

## 🎯 Production Migration

### From Testnet to Mainnet

1. **Update Network Configuration**:
```bash
HEDERA_NETWORK=mainnet
HEDERA_MIRROR_NODE_URL=https://mainnet.mirrornode.hedera.com
```

2. **Use Mainnet Accounts**:
- Get mainnet HBAR from exchanges
- Use real HashPack mainnet accounts
- Update app account ID for mainnet

3. **Adjust Gas & Fees**:
- Mainnet fees are similar to testnet
- Monitor actual costs in production
- Set up automated monitoring

4. **Deploy & Test**:
- Deploy contract on mainnet
- Start with small test transactions
- Gradually scale up operations

## 📊 Monitoring & Analytics

### HashScan Dashboard
Track your contract's performance:
- Transaction volume and success rates
- Gas usage patterns  
- Account balances and transfers
- Error rates and types

### Mirror Node APIs
Programmatic monitoring:
- Real-time transaction feeds
- Account balance notifications
- Contract state changes
- Network metrics

---

## 🎉 Ready for Hedera!

Your staking system is now **optimized for Hedera network** with:
- ⚡ **Ultra-fast finality** (3-5 seconds)
- 💰 **Predictable low costs** (fractions of pennies) 
- 🔍 **Real-time transparency** via HashScan
- 🛡️ **Enterprise security** with hashgraph consensus

**Start deploying your decentralized staking system on Hedera today!** 🚀
