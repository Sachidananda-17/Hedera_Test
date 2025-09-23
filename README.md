# Hedera Content Notarization with Staking

A decentralized content notarization system using Hedera smart contracts with staking mechanism.

## Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- Hedera Testnet Account
- HashPack Wallet with Testnet HBAR

## Quick Start

1. **Clone the repository**
```bash
   git clone <your-repo-url>
cd Hedera_Test
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   
   Create `apps/backend/config/.env` with:
   ```env
   HEDERA_OPERATOR_ID=0.0.XXXXX
   HEDERA_OPERATOR_PRIVATE_KEY=your_private_key
   ```

4. **Deploy Smart Contract**
   ```bash
   npm run deploy:contract
   ```
   This will:
   - Deploy the ContentNotarization contract
   - Save contract details to frontend config
   - Show deployment summary with contract ID

5. **Test Contract**
   ```bash
   npm run test:contract
   ```

6. **Start Development Servers**
   ```bash
   npm run dev
   ```
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3001

## Contract Details

- **Contract ID**: 0.0.6887173 (latest deployment)
- **Network**: Hedera Testnet
- **Minimum Stake**: 5 HBAR

### Key Functions

1. **Mint Content**
   - Requires 5 HBAR stake
   - Stores content hash
   - Transfers stake to treasury

2. **Notarize Content**
   - Marks content as notarized
   - Only for minted content
   - Emits notarization event

## Testing Guide

1. **Prepare Test Account**
   - Get testnet account from [Hedera Portal](https://portal.hedera.com/)
   - Fund with at least 10 HBAR
   - Save account ID and private key

2. **Deploy Contract**
   ```bash
   npm run deploy:contract
   ```
   Check deployment success in console output

3. **Run Test Script**
   ```bash
   npm run test:contract
   ```
   This tests:
   - Content minting
   - HBAR transfer
   - Notarization

4. **Verify on HashScan**
   - Contract: https://hashscan.io/testnet/contract/[CONTRACT_ID]
   - Treasury: https://hashscan.io/testnet/account/[TREASURY_ID]
   - Transactions: Check HashScan links in test output

## Troubleshooting

1. **Network Issues**
   - Ensure no VPN blocking Hedera connections
   - Use direct internet connection
   - Check Hedera testnet status

2. **Transaction Errors**
   - Check HBAR balance
   - Verify contract ID in config
   - Check transaction on HashScan

3. **Common Error Messages**
   - `CONTRACT_REVERT_EXECUTED`: Check HBAR amount
   - `INSUFFICIENT_GAS`: Increase gas limit
   - Network errors: Check connectivity

## Project Structure

```
apps/
├── backend/
│   ├── config/
│   │   └── .env
│   └── src/
│       ├── contracts/
│       │   └── ContentNotarization.sol
│       └── scripts/
│           ├── deployContract.js
│           └── testContract.js
└── frontend/
    └── src/
        ├── config/
        │   └── treasury.ts
        └── components/
            └── NotarizationForm.tsx
```

## Important Notes

1. **Security**
   - Never commit `.env` files
   - Keep private keys secure
   - Use testnet for development

2. **Gas and Fees**
   - Each mint costs 5 HBAR
   - Additional gas fees apply
   - Keep sufficient HBAR balance

3. **Network**
   - Use direct internet connection
   - Avoid VPN if possible
   - Whitelist Hedera domains if needed

## Links

- [Hedera Portal](https://portal.hedera.com/)
- [HashScan Testnet](https://hashscan.io/testnet)
- [HashPack Wallet](https://www.hashpack.app/)
- [Hedera Documentation](https://docs.hedera.com/)

## Support

For issues and questions:
1. Check troubleshooting guide
2. Verify network connectivity
3. Check HashScan for transaction status
4. Review contract deployment logs