#!/usr/bin/env node

/**
 * Hedera Setup Checker
 * 
 * This script validates your Hedera configuration and account setup
 * before attempting to deploy the staking smart contract.
 * 
 * Usage:
 *   node scripts/check-hedera-setup.js
 */

import { Client, AccountBalanceQuery, AccountId, PrivateKey } from '@hashgraph/sdk';
import { config, validateConfig } from '../packages/config/env/config.js';
import fetch from 'node-fetch';

async function checkHederaSetup() {
  console.log('\n🔍 HEDERA SETUP VALIDATION');
  console.log('='.repeat(50));
  
  let allChecksPass = true;
  
  try {
    // 1. Validate configuration
    console.log('\n1️⃣  Checking Configuration...');
    try {
      validateConfig();
      console.log('   ✅ Basic configuration valid');
    } catch (error) {
      console.log('   ❌ Configuration error:', error.message);
      allChecksPass = false;
    }

    // 2. Check required environment variables
    console.log('\n2️⃣  Checking Environment Variables...');
    const requiredVars = [
      'HEDERA_ACCOUNT_ID',
      'HEDERA_PRIVATE_KEY', 
      'HEDERA_NETWORK',
      'STAKING_APP_ACCOUNT_ID'
    ];

    requiredVars.forEach(envVar => {
      if (process.env[envVar] || config.hedera[envVar.toLowerCase().replace('hedera_', '')]) {
        console.log(`   ✅ ${envVar}: Set`);
      } else {
        console.log(`   ❌ ${envVar}: Missing`);
        allChecksPass = false;
      }
    });

    // 3. Validate account ID format
    console.log('\n3️⃣  Validating Account IDs...');
    try {
      const deployerAccount = AccountId.fromString(config.hedera.accountId);
      console.log(`   ✅ Deployer Account: ${deployerAccount.toString()}`);
    } catch (error) {
      console.log('   ❌ Invalid deployer account ID format');
      allChecksPass = false;
    }

    try {
      const appAccount = AccountId.fromString(config.staking.appAccountId);
      console.log(`   ✅ App Account: ${appAccount.toString()}`);
    } catch (error) {
      console.log('   ❌ Invalid app account ID format');
      allChecksPass = false;
    }

    // 4. Test Hedera client connection
    console.log('\n4️⃣  Testing Hedera Connection...');
    let client;
    try {
      client = config.hedera.network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
      client.setOperator(
        AccountId.fromString(config.hedera.accountId),
        PrivateKey.fromString(config.hedera.privateKey)
      );
      console.log(`   ✅ Connected to Hedera ${config.hedera.network}`);
    } catch (error) {
      console.log('   ❌ Failed to connect to Hedera:', error.message);
      allChecksPass = false;
      return;
    }

    // 5. Check account balance
    console.log('\n5️⃣  Checking Account Balance...');
    try {
      const accountBalance = await new AccountBalanceQuery()
        .setAccountId(config.hedera.accountId)
        .execute(client);
      
      const hbarBalance = accountBalance.hbars.toTinybars() / 100000000;
      console.log(`   💰 HBAR Balance: ${hbarBalance.toFixed(2)} HBAR`);
      
      if (hbarBalance >= 15) {
        console.log('   ✅ Sufficient balance for deployment');
      } else if (hbarBalance >= 5) {
        console.log('   ⚠️  Low balance - may need more HBAR for deployment');
        console.log('   💡 Recommended: 15-20 HBAR for safe deployment');
      } else {
        console.log('   ❌ Insufficient balance for deployment');
        console.log('   💡 Need at least 15-20 HBAR for contract deployment');
        allChecksPass = false;
      }
    } catch (error) {
      console.log('   ❌ Failed to check balance:', error.message);
      allChecksPass = false;
    }

    // 6. Check Mirror Node connectivity
    console.log('\n6️⃣  Testing Mirror Node Access...');
    try {
      const mirrorUrl = `${config.hedera.mirrorNodeUrl}/api/v1/accounts/${config.hedera.accountId}`;
      const response = await fetch(mirrorUrl);
      
      if (response.ok) {
        const accountData = await response.json();
        console.log('   ✅ Mirror Node accessible');
        console.log(`   📊 Account created: ${new Date(accountData.created_timestamp * 1000).toLocaleDateString()}`);
      } else {
        console.log('   ❌ Mirror Node request failed:', response.status);
        allChecksPass = false;
      }
    } catch (error) {
      console.log('   ❌ Mirror Node connectivity issue:', error.message);
      allChecksPass = false;
    }

    // 7. Check app account existence
    console.log('\n7️⃣  Verifying App Account...');
    try {
      const appMirrorUrl = `${config.hedera.mirrorNodeUrl}/api/v1/accounts/${config.staking.appAccountId}`;
      const appResponse = await fetch(appMirrorUrl);
      
      if (appResponse.ok) {
        console.log(`   ✅ App account exists: ${config.staking.appAccountId}`);
      } else {
        console.log(`   ❌ App account not found: ${config.staking.appAccountId}`);
        allChecksPass = false;
      }
    } catch (error) {
      console.log('   ⚠️  Could not verify app account:', error.message);
    }

    // 8. Check for compiled contract
    console.log('\n8️⃣  Checking Contract Compilation...');
    const fs = await import('fs');
    const path = await import('path');
    
    const possiblePaths = [
      './artifacts/contracts/NotarizationStaking.sol/NotarizationStaking.json',
      './packages/contracts/build/NotarizationStaking.json',
      './packages/contracts/NotarizationStaking.bin'
    ];

    let contractFound = false;
    for (const contractPath of possiblePaths) {
      if (fs.existsSync(contractPath)) {
        console.log(`   ✅ Contract found: ${contractPath}`);
        contractFound = true;
        break;
      }
    }

    if (!contractFound) {
      console.log('   ❌ No compiled contract found');
      console.log('   💡 Run: npx hardhat compile');
      allChecksPass = false;
    }

    // Summary
    console.log('\n📋 VALIDATION SUMMARY');
    console.log('='.repeat(30));
    
    if (allChecksPass) {
      console.log('🎉 ALL CHECKS PASSED!');
      console.log('✅ Your Hedera setup is ready for contract deployment');
      console.log('\n🚀 Next steps:');
      console.log('   1. Run: node scripts/deploy-staking-contract.js');
      console.log('   2. Add contract ID to .env file');
      console.log('   3. Enable staking: ENABLE_STAKING=true');
      console.log('   4. Restart backend: npm run dev');
    } else {
      console.log('❌ SOME CHECKS FAILED');
      console.log('🔧 Please fix the issues above before deployment');
      console.log('\n📚 Helpful resources:');
      console.log('   - Hedera Portal: https://portal.hedera.com');
      console.log('   - HashPack Wallet: https://hashpack.app');
      console.log('   - Testnet Faucet: https://portal.hedera.com/faucet');
      console.log('   - Documentation: HEDERA_DEPLOYMENT_GUIDE.md');
    }

    // Network-specific links
    const network = config.hedera.network;
    console.log('\n🔗 Useful Links:');
    console.log(`   - HashScan: https://hashscan.io/${network}/account/${config.hedera.accountId}`);
    console.log(`   - Mirror Node: ${config.hedera.mirrorNodeUrl}/api/v1/accounts/${config.hedera.accountId}`);
    console.log(`   - App Account: https://hashscan.io/${network}/account/${config.staking.appAccountId}`);

    client?.close();

  } catch (error) {
    console.error('\n💥 Unexpected error during validation:', error.message);
    console.error('\n🔧 Try running the health check: npm run health');
  }
}

// Run the setup check
if (import.meta.url === `file://${process.argv[1]}`) {
  checkHederaSetup().catch(console.error);
}
