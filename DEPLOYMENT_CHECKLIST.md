# ✅ Hedera Smart Contract Deployment Checklist

Follow this step-by-step checklist to deploy your NotarizationStaking contract on Hedera network.

## 📋 Pre-Deployment Checklist

### ✅ 1. Environment Setup
```bash
# Install all dependencies
npm install

# Install Hardhat dependencies  
npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers
```

### ✅ 2. Account Verification
```bash
# Check your Hedera setup
npm run hedera:check
```

**Requirements:**
- [ ] Deployer account has 15-20 HBAR minimum
- [ ] App account (0.0.6884960) exists and is accessible  
- [ ] Network connectivity to Hedera testnet confirmed
- [ ] Mirror Node API accessible

### ✅ 3. Contract Preparation
```bash
# Copy contract to Hardhat directory
mkdir -p contracts
cp packages/contracts/NotarizationStaking.sol contracts/

# Compile with Hedera-optimized settings
npx hardhat compile
```

**Verify:**
- [ ] `artifacts/contracts/NotarizationStaking.sol/NotarizationStaking.json` exists
- [ ] No compilation errors
- [ ] Contract size is reasonable (< 24KB for Hedera)

## 🚀 Deployment Process

### Step 1: Pre-deployment Validation
```bash
# Run comprehensive check
npm run hedera:check
```

### Step 2: Deploy Contract
```bash
# Deploy to Hedera testnet
npm run hedera:deploy
```

**Monitor for:**
- [ ] File creation transaction succeeds
- [ ] Contract deployment transaction succeeds  
- [ ] Contract ID is returned (format: 0.0.XXXXXX)
- [ ] Constructor parameters are set correctly

### Step 3: Post-deployment Configuration
```bash
# Add contract ID to environment
echo "STAKING_CONTRACT_ID=0.0.YOUR_CONTRACT_ID" >> apps/backend/config/.env
echo "ENABLE_STAKING=true" >> apps/backend/config/.env

# Restart backend
npm run dev:backend
```

### Step 4: Verification
```bash
# Test contract deployment
curl http://localhost:3001/api/staking/status

# Check contract on HashScan
# Visit: https://hashscan.io/testnet/contract/0.0.YOUR_CONTRACT_ID
```

## 🧪 Testing Checklist

### ✅ Basic Contract Functions

1. **Test Stake Creation**
```bash
curl -X POST http://localhost:3001/api/staking/create \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test_hedera_deploy_001",
    "stakeAmount": 50000000,
    "userAccountId": "0.0.YOUR_ACCOUNT",
    "userPrivateKey": "your_private_key"
  }'
```

2. **Test Contract Status**
```bash
curl http://localhost:3001/api/staking/stake/test_hedera_deploy_001
```

3. **Test End-to-End Notarization**
```bash
curl -X POST http://localhost:3001/api/notarize \
  -F "requestId=test_hedera_deploy_001" \
  -F "stakeVerified=true" \
  -F "accountId=0.0.YOUR_ACCOUNT" \
  -F "contentType=text" \
  -F "text=Test deployment on Hedera"
```

### ✅ Frontend Integration

1. **Access Frontend**
   - [ ] Navigate to http://localhost:5173
   - [ ] Staking step appears first (if enabled)
   - [ ] Can connect HashPack wallet

2. **Complete Staking Flow**
   - [ ] Configure stake amount (0.5-10 HBAR)
   - [ ] Create stake transaction succeeds
   - [ ] Proceed to content submission
   - [ ] Payment completion/refund works correctly

### ✅ HashScan Verification

Visit your contract on HashScan to verify:
- [ ] Contract exists: `https://hashscan.io/testnet/contract/0.0.YOUR_CONTRACT_ID`
- [ ] Constructor parameters are correct
- [ ] App account is set to 0.0.6884960
- [ ] Initial transactions show successful deployment

## 🔍 Troubleshooting Common Issues

### ❌ "INSUFFICIENT_PAYER_BALANCE"
**Solution:** Add more HBAR to deployer account
```bash
# Check balance
curl "https://testnet.mirrornode.hedera.com/api/v1/accounts/0.0.YOUR_ACCOUNT"
```

### ❌ "Contract not compiled"  
**Solution:** Ensure Hardhat compilation succeeded
```bash
npx hardhat compile --force
ls artifacts/contracts/NotarizationStaking.sol/NotarizationStaking.json
```

### ❌ "INVALID_SIGNATURE"
**Solution:** Verify account credentials in .env file
```bash
# Check your .env file
cat apps/backend/config/.env | grep HEDERA
```

### ❌ "Contract deployment failed"
**Solution:** Check gas limits and constructor parameters
- Gas limit: 300,000 (auto-optimized)
- Constructor: appAccount, minimumStake, serviceTimeout
- Verify all accounts exist on network

## 🎯 Success Criteria

Your deployment is successful when:

### ✅ Contract Deployed
- [ ] Contract ID returned (0.0.XXXXXX format)
- [ ] Visible on HashScan
- [ ] Constructor parameters correct
- [ ] No deployment errors

### ✅ Backend Integration  
- [ ] `/api/staking/status` returns contract info
- [ ] Contract ID configured in environment
- [ ] Staking system enabled and ready

### ✅ Frontend Integration
- [ ] Staking step appears for users
- [ ] Can create stakes through UI
- [ ] End-to-end notarization works
- [ ] Payment completion/refund functioning

### ✅ Network Verification
- [ ] HashScan shows contract activity
- [ ] Mirror Node API returns contract data
- [ ] Transactions appear in real-time
- [ ] App account receives successful payments

## 📊 Expected Costs

### Deployment Costs
- **File Creation**: ~2-5 HBAR
- **Contract Creation**: ~5-10 HBAR  
- **Testing**: ~3-5 HBAR
- **Total**: ~15-20 HBAR for complete deployment

### Operational Costs (per transaction)
- **Stake Creation**: ~0.001-0.01 HBAR
- **Completion**: ~0.001-0.01 HBAR
- **Refund**: ~0.001-0.01 HBAR
- **Queries**: ~0.0001 HBAR

## 🚀 Ready for Production

After successful deployment and testing:

1. **Document Contract ID**: Save for production use
2. **Monitor Performance**: Watch HashScan for activity
3. **Scale Gradually**: Start with test transactions
4. **Set Up Monitoring**: Track costs and performance  
5. **Plan Mainnet Migration**: Prepare for production deployment

---

## 🎉 Congratulations!

Your Hedera staking smart contract is now deployed and ready to secure your content notarization platform with blockchain-guaranteed payments! 

🔗 **Next Steps:**
- Share contract ID with team
- Begin user testing  
- Monitor on HashScan
- Plan production scaling
