#!/usr/bin/env node

/**
 * Hedera Deployment Cost Estimator
 * 
 * Estimates the HBAR costs for deploying and operating the staking contract
 * on Hedera network based on current fee schedule.
 * 
 * Usage:
 *   node scripts/estimate-deployment-costs.js
 */

import { config } from '../packages/config/env/config.js';

function estimateHederaCosts() {
  console.log('\n💰 HEDERA DEPLOYMENT COST ESTIMATION');
  console.log('='.repeat(50));
  
  // Current Hedera fee structure (approximate)
  const fees = {
    // File operations (for bytecode storage)
    fileCreate: 0.05,     // HBAR per file creation
    fileAppend: 0.001,    // HBAR per KB appended
    
    // Contract operations  
    contractCreate: 0.20,  // HBAR base cost for contract creation
    contractGas: 0.000001, // HBAR per gas unit (very low on Hedera)
    
    // Transaction operations
    contractCall: 0.001,   // HBAR per contract function call
    query: 0.0001,         // HBAR per contract query
    
    // Hedera-specific
    hbarTransfer: 0.0001,  // HBAR per transfer operation
    accountQuery: 0.0001   // HBAR per account balance query
  };
  
  // Estimated contract sizes and gas usage
  const estimates = {
    // Contract deployment
    bytecodeSize: 15,      // KB (estimated compiled size)
    deploymentGas: 300000, // Gas units for deployment
    
    // Operational gas usage  
    stakeCreationGas: 150000,    // Gas for createStake()
    stakeCompletionGas: 100000,  // Gas for completeStake()
    stakeRefundGas: 100000,      // Gas for refundStake()
    stakeQueryGas: 50000,        // Gas for getStake()
  };
  
  console.log('\n📊 DEPLOYMENT COST BREAKDOWN');
  console.log('-'.repeat(40));
  
  // File creation costs
  const fileCreateCost = fees.fileCreate;
  const fileAppendCost = fees.fileAppend * estimates.bytecodeSize;
  const totalFileCost = fileCreateCost + fileAppendCost;
  
  console.log(`📄 File Creation: ${fileCreateCost.toFixed(4)} HBAR`);
  console.log(`📝 File Storage (${estimates.bytecodeSize}KB): ${fileAppendCost.toFixed(4)} HBAR`);
  console.log(`   Subtotal Files: ${totalFileCost.toFixed(4)} HBAR`);
  
  // Contract creation costs
  const contractCreateCost = fees.contractCreate;
  const contractGasCost = fees.contractGas * estimates.deploymentGas;
  const totalContractCost = contractCreateCost + contractGasCost;
  
  console.log(`\n🏗️  Contract Creation: ${contractCreateCost.toFixed(4)} HBAR`);
  console.log(`⛽ Deployment Gas (${estimates.deploymentGas}): ${contractGasCost.toFixed(4)} HBAR`);
  console.log(`   Subtotal Contract: ${totalContractCost.toFixed(4)} HBAR`);
  
  // Total deployment cost
  const totalDeploymentCost = totalFileCost + totalContractCost;
  console.log(`\n🚀 TOTAL DEPLOYMENT COST: ${totalDeploymentCost.toFixed(4)} HBAR`);
  console.log(`💡 Recommended Balance: ${(totalDeploymentCost * 2).toFixed(2)} HBAR (2x buffer)`);
  
  console.log('\n📊 OPERATIONAL COST ESTIMATES');
  console.log('-'.repeat(40));
  
  // Operational costs per transaction
  const operations = [
    {
      name: 'Stake Creation',
      baseCost: fees.contractCall,
      gasCost: fees.contractGas * estimates.stakeCreationGas,
      includes: 'User stakes HBAR + contract state update'
    },
    {
      name: 'Stake Completion', 
      baseCost: fees.contractCall + fees.hbarTransfer,
      gasCost: fees.contractGas * estimates.stakeCompletionGas,
      includes: 'Transfer stake to app account'
    },
    {
      name: 'Stake Refund',
      baseCost: fees.contractCall + fees.hbarTransfer, 
      gasCost: fees.contractGas * estimates.stakeRefundGas,
      includes: 'Refund stake to user'
    },
    {
      name: 'Stake Query',
      baseCost: fees.query,
      gasCost: fees.contractGas * estimates.stakeQueryGas,
      includes: 'Read stake information (read-only)'
    }
  ];
  
  operations.forEach(op => {
    const totalCost = op.baseCost + op.gasCost;
    console.log(`\n${op.name}:`);
    console.log(`   Base Cost: ${op.baseCost.toFixed(6)} HBAR`);
    console.log(`   Gas Cost: ${op.gasCost.toFixed(6)} HBAR`); 
    console.log(`   Total: ${totalCost.toFixed(6)} HBAR`);
    console.log(`   (${op.includes})`);
  });
  
  console.log('\n💡 COST OPTIMIZATION TIPS');
  console.log('-'.repeat(40));
  console.log('✅ Batch operations when possible');
  console.log('✅ Use queries instead of transactions for reads');
  console.log('✅ Optimize contract logic to reduce gas usage');
  console.log('✅ Monitor actual costs and adjust estimates');
  console.log('✅ Consider caching frequently accessed data');
  
  console.log('\n📈 VOLUME PROJECTIONS');
  console.log('-'.repeat(30));
  
  const volumes = [10, 100, 1000, 10000];
  const avgOperationCost = 0.001; // Average cost per stake operation
  
  console.log('Monthly Transaction Volume → Monthly Cost:');
  volumes.forEach(volume => {
    const monthlyCost = volume * avgOperationCost;
    console.log(`   ${volume.toLocaleString()} transactions → ${monthlyCost.toFixed(2)} HBAR`);
  });
  
  console.log('\n🌐 NETWORK COMPARISON');
  console.log('-'.repeat(30));
  console.log('Hedera vs Other Networks (approximate):');
  console.log('   Hedera: $0.0001 per transaction');
  console.log('   Ethereum: $5-50 per transaction');  
  console.log('   Polygon: $0.01-0.1 per transaction');
  console.log('   → Hedera is 50,000x cheaper than Ethereum!');
  
  console.log('\n🎯 BUDGET RECOMMENDATIONS');
  console.log('-'.repeat(35));
  console.log(`💰 Development/Testing: 50-100 HBAR`);
  console.log(`🚀 Production Launch: 200-500 HBAR`);
  console.log(`📈 Monthly Operations: 50-200 HBAR`);
  console.log(`🛡️  Emergency Reserve: 100-300 HBAR`);
  
  // Configuration-specific estimates
  if (config.staking) {
    console.log('\n⚙️  YOUR CONFIGURATION ESTIMATES');
    console.log('-'.repeat(40));
    console.log(`App Account: ${config.staking.appAccountId}`);
    console.log(`Min Stake: ${config.staking.minimumStake / 100000000} HBAR`);
    console.log(`Max Stake: ${config.staking.maxStakeAmount / 100000000} HBAR`);
    console.log(`Service Timeout: ${config.staking.serviceTimeout}s`);
    
    // Revenue projections based on stake amounts
    const avgStake = (config.staking.minimumStake + config.staking.maxStakeAmount) / 2 / 100000000;
    console.log(`\n📊 REVENUE PROJECTIONS (Average ${avgStake} HBAR stake):`);
    volumes.forEach(volume => {
      const monthlyRevenue = volume * avgStake;
      console.log(`   ${volume} successful stakes → ${monthlyRevenue.toFixed(2)} HBAR revenue`);
    });
  }
  
  console.log('\n🔗 HELPFUL LINKS');
  console.log('-'.repeat(20));
  console.log('📊 Hedera Fee Calculator: https://hedera.com/fees');
  console.log('🏦 Buy HBAR: https://hedera.com/buying-guide');
  console.log('👛 HashPack Wallet: https://hashpack.app');
  console.log('🔍 HashScan Explorer: https://hashscan.io');
  
  console.log('\n✨ Ready to deploy cost-effectively on Hedera!');
}

// Run cost estimation
if (import.meta.url === `file://${process.argv[1]}`) {
  estimateHederaCosts();
}
