#!/usr/bin/env node

/**
 * Staking Contract Deployment Script
 * 
 * This script helps deploy the NotarizationStaking smart contract to Hedera testnet.
 * 
 * Usage:
 *   node scripts/deploy-staking-contract.js
 * 
 * Requirements:
 *   - Compiled Solidity contract (use hardhat, truffle, or solc)
 *   - Hedera account with sufficient HBAR for deployment
 *   - Proper environment variables set in apps/backend/config/.env
 */

import StakingContractManager from '../packages/contracts/contract-manager.js';
import { config } from '../packages/config/env/config.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log('\n🏛️ HEDERA STAKING CONTRACT DEPLOYMENT');
  console.log('='.repeat(50));
  
  try {
    // Initialize staking manager
    const stakingManager = new StakingContractManager();
    
    // Display current configuration
    console.log('\n📋 Current Configuration:');
    console.log(`   App Account: ${config.staking.appAccountId}`);
    console.log(`   Minimum Stake: ${config.staking.minimumStake / 100000000} HBAR`);
    console.log(`   Service Timeout: ${config.staking.serviceTimeout}s`);
    console.log(`   Deployer Account: ${config.hedera.accountId}`);
    console.log(`   Network: ${config.hedera.network}`);
    
    // Confirm deployment
    const confirm = await askQuestion('\n❓ Do you want to proceed with deployment? (y/N): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('❌ Deployment cancelled');
      process.exit(0);
    }
    
    // Warning about contract compilation for Hedera
    console.log('\n⚠️  IMPORTANT: Make sure you have compiled the Solidity contract for Hedera!');
    console.log('\n🔧 Quick Compilation Steps:');
    console.log('   1. Install Hardhat: npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers');
    console.log('   2. Compile contract: npx hardhat compile');
    console.log('   3. This will create: artifacts/contracts/NotarizationStaking.sol/NotarizationStaking.json');
    console.log('\n📋 Alternative Options:');
    console.log('   - solc: solc --bin --abi packages/contracts/NotarizationStaking.sol -o packages/contracts/build/');
    console.log('   - Or use the provided hardhat.config.js for Hedera-optimized compilation');
    
    const hasCompiled = await askQuestion('\n❓ Have you compiled the contract for Hedera? (y/N): ');
    if (hasCompiled.toLowerCase() !== 'y' && hasCompiled.toLowerCase() !== 'yes') {
      console.log('\n❌ Please compile the contract first. Run:');
      console.log('   npx hardhat compile');
      process.exit(1);
    }
    
    console.log('\n🚀 Starting deployment...');
    
    // Deploy contract
    const contractId = await stakingManager.deployContract();
    
    console.log('\n🎉 DEPLOYMENT SUCCESSFUL!');
    console.log('='.repeat(30));
    console.log(`📋 Contract ID: ${contractId}`);
    console.log(`🔗 App Account: ${config.staking.appAccountId}`);
    console.log(`💰 Min Stake: ${config.staking.minimumStake / 100000000} HBAR`);
    console.log(`⏱️  Timeout: ${config.staking.serviceTimeout}s`);
    
    console.log('\n📝 Next Steps:');
    console.log('1. Add this contract ID to your .env file:');
    console.log(`   STAKING_CONTRACT_ID=${contractId}`);
    console.log('2. Enable staking in your .env file:');
    console.log('   ENABLE_STAKING=true');
    console.log('3. Restart your backend server');
    console.log('4. Test the staking functionality');
    
    // Offer to update .env file
    const updateEnv = await askQuestion('\n❓ Would you like to automatically update the .env file? (y/N): ');
    if (updateEnv.toLowerCase() === 'y' || updateEnv.toLowerCase() === 'yes') {
      // This would require additional file manipulation logic
      console.log('✅ Please manually add STAKING_CONTRACT_ID to your .env file for now');
    }
    
  } catch (error) {
    console.error('\n❌ DEPLOYMENT FAILED:', error.message);
    console.error('\n🔧 Hedera-Specific Troubleshooting:');
    
    // Common Hedera deployment issues
    if (error.message.includes('INSUFFICIENT_PAYER_BALANCE')) {
      console.error('💰 Issue: Insufficient HBAR balance');
      console.error('   Solution: Add more HBAR to your account for deployment fees');
      console.error('   Estimated cost: ~15-20 HBAR for deployment');
    } else if (error.message.includes('INVALID_SIGNATURE')) {
      console.error('🔐 Issue: Invalid account credentials');
      console.error('   Solution: Verify HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY in .env');
    } else if (error.message.includes('Contract not compiled')) {
      console.error('📄 Issue: Contract bytecode not found');
      console.error('   Solution: Run "npx hardhat compile" first');
    } else if (error.message.includes('INVALID_CONTRACT_ID')) {
      console.error('🏗️  Issue: Contract creation failed');
      console.error('   Solution: Check contract constructor parameters');
    } else if (error.message.includes('MAX_GAS_LIMIT_EXCEEDED')) {
      console.error('⛽ Issue: Gas limit too high');
      console.error('   Solution: Contract manager will use optimized gas limits');
    } else {
      console.error('🚨 Generic troubleshooting:');
      console.error('1. Check your Hedera testnet account credentials');
      console.error('2. Ensure sufficient HBAR balance (need ~15-20 HBAR)');
      console.error('3. Verify the smart contract is compiled with Hardhat');
      console.error('4. Check Hedera testnet connectivity');
      console.error('5. Validate app account ID: 0.0.6884960');
    }
    
    console.error('\n📞 Need Help?');
    console.error('- Hedera Discord: https://hedera.com/discord');
    console.error('- Documentation: https://docs.hedera.com/hedera/');
    console.error('- Check your account: https://hashscan.io/testnet/account/' + config.hedera.accountId);
    
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Handle script execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });
}
