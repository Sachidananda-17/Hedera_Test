import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import dotenv from "dotenv";

dotenv.config({ path: "./apps/backend/config/.env" });

/**
 * Hardhat Configuration for Hedera Smart Contract Development
 * 
 * This configuration is optimized for compiling and deploying smart contracts
 * to the Hedera network using Hedera Smart Contract Service (HSCS).
 * 
 * Usage:
 *   1. Install dependencies: npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers
 *   2. Copy NotarizationStaking.sol to contracts/
 *   3. Compile: npx hardhat compile
 *   4. Deploy: node scripts/deploy-staking-contract.js
 */

export default {
  // Solidity compiler configuration optimized for Hedera
  solidity: {
    version: "0.8.9", // Known stable version for Hedera
    settings: {
      optimizer: {
        enabled: false // Disable optimizer for Hedera compatibility
      },
      // EVM version compatible with Hedera (older version for compatibility)
      evmVersion: "istanbul"
    }
  },

  // Networks configuration  
  networks: {
    // Local development (for compilation testing)
    hardhat: {
      chainId: 1337
    }
    // Note: Hedera deployment uses SDK directly, not network config
  },

  // Path configuration
  paths: {
    sources: "./contracts", // Contract source directory (copied from packages/contracts)
    artifacts: "./artifacts",        // Compilation output
    cache: "./cache",                // Cache directory
    tests: "./test"                  // Test directory
  },

  // Mocha test configuration
  mocha: {
    timeout: 40000
  },

  // Contract size limits (Hedera specific)
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
    // Hedera contract size limits
    only: [':NotarizationStaking$']
  }
};

// Helper function to validate Hedera configuration
function validateHederaSetup() {
  const requiredEnvVars = [
    'HEDERA_ACCOUNT_ID',
    'HEDERA_PRIVATE_KEY',
    'STAKING_APP_ACCOUNT_ID'
  ];

  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.warn('\n⚠️  Missing Hedera environment variables:');
    missing.forEach(envVar => console.warn(`   - ${envVar}`));
    console.warn('\n📝 Add these to apps/backend/config/.env before deployment\n');
  } else {
    console.log('✅ Hedera environment variables configured');
  }
}

// Run validation when config is loaded
validateHederaSetup();
