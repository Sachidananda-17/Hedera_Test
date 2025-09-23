# Hedera Content Notarization - Staking Implementation

## Overview
This document explains the staking mechanism implemented for content notarization using Hedera smart contracts.

## Contract Details
- **Contract ID**: 0.0.6887173
- **Network**: Hedera Testnet
- **Stake Amount**: 5 HBAR per content
- **Treasury Account**: 0.0.6651850

## How It Works

1. **Staking Process**
   ```
   User (with HBAR) -> Smart Contract -> Treasury
        |                    |              |
    Sends 5 HBAR     Stores Content     Receives Stake
   ```

2. **Smart Contract Functions**
   - `mintContent(string contentHash)`: Stakes 5 HBAR and stores content
   - `notarizeContent(string contentHash)`: Notarizes minted content
   - `isContentNotarized(string contentHash)`: Checks notarization status

## Testing the Contract

1. **Deploy Contract**
   ```bash
   cd apps/backend
   # Add your Hedera credentials to config/.env
   HEDERA_OPERATOR_ID=0.0.XXXXX
   HEDERA_OPERATOR_PRIVATE_KEY=your_private_key

   # Deploy contract
   npm run deploy:contract
   ```

2. **Test Functionality**
   ```bash
   # Run test script
   npm run test:contract
   ```

3. **Verify on HashScan**
   - Contract: https://hashscan.io/testnet/contract/0.0.6887173
   - Check transaction status and events

## Important Notes

1. **Network Requirements**
   - Direct internet connection recommended
   - If using VPN, ensure these domains are accessible:
     - testnet.hedera.com
     - testnet.mirrornode.hedera.com
     - hashscan.io

2. **Balance Requirements**
   - Minimum 5 HBAR for staking
   - Additional HBAR for gas fees
   - Keep sufficient balance for multiple transactions

3. **Transaction Flow**
   ```mermaid
   sequenceDiagram
       User->>Contract: Mint Content (5 HBAR)
       Contract->>Treasury: Transfer Stake
       Contract->>User: Content Minted Event
       User->>Contract: Notarize Content
       Contract->>Hedera: Record Notarization
   ```

## Troubleshooting

1. **CONTRACT_REVERT_EXECUTED Error**
   - Check HBAR balance (need 5 HBAR + gas)
   - Verify content hash is unique
   - Ensure treasury address is correct

2. **Network Issues**
   - Check internet connectivity
   - Disable VPN or get required domains whitelisted
   - Verify Hedera testnet status

3. **Transaction Verification**
   - Use HashScan to track transactions
   - Check treasury account for received stakes
   - Monitor contract events

## Contract Code Example
```solidity
function mintContent(string memory contentHash) public payable {
    require(msg.value >= MINTING_FEE, "Must pay at least 5 HBAR");
    require(bytes(contentHash).length > 0, "Content hash cannot be empty");
    // ... rest of the implementation
}
```

## Testing Commands Quick Reference

```bash
# Deploy new contract
npm run deploy:contract

# Test existing contract
npm run test:contract

# Start development servers
npm run dev
```

## Verification Links

1. **Contract Verification**
   ```
   https://hashscan.io/testnet/contract/[CONTRACT_ID]
   ```

2. **Transaction Status**
   ```
   https://hashscan.io/testnet/transaction/[TRANSACTION_ID]
   ```

3. **Treasury Account**
   ```
   https://hashscan.io/testnet/account/[TREASURY_ID]
   ```

## Next Steps

1. **Frontend Integration**
   - Connect HashPack wallet
   - Show stake amount
   - Display transaction status
   - Add balance checks

2. **Additional Features**
   - Stake refund mechanism
   - Multiple stake tiers
   - Stake withdrawal timelock

3. **Testing Scenarios**
   - Multiple content minting
   - Failed transaction handling
   - Network issue recovery
