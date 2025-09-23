import { 
    Client, 
    AccountId, 
    PrivateKey, 
    ContractCreateTransaction,
    ContractCreateFlow,
    ContractCallQuery, 
    ContractExecuteTransaction,
    FileCreateTransaction,
    FileAppendTransaction,
    Hbar,
    ContractFunctionParameters
} from '@hashgraph/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/env/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Smart Contract Manager for Notarization Staking
 * Handles deployment, interaction, and management of the staking contract
 */
class StakingContractManager {
    constructor() {
        this.client = null;
        this.contractId = null;
        this.appAccountId = config.staking?.appAccountId || '0.0.6884960';
        this.minimumStake = config.staking?.minimumStake || 50000000; // 0.5 HBAR in tinybars
        this.serviceTimeout = config.staking?.serviceTimeout || 3600; // 1 hour in seconds
        
        this.initializeClient();
        console.log('🏛️ Staking Contract Manager initialized', {
            appAccountId: this.appAccountId,
            minimumStake: `${this.minimumStake / 100000000} HBAR`,
            serviceTimeout: `${this.serviceTimeout}s`
        });
    }

    initializeClient() {
        try {
            if (!config.hedera.accountId || !config.hedera.privateKey) {
                throw new Error('Missing Hedera credentials for contract management');
            }

            this.client = Client.forTestnet();
            this.client.setOperator(
                AccountId.fromString(config.hedera.accountId),
                PrivateKey.fromStringECDSA(config.hedera.privateKey)
            );
            console.log('✅ Hedera client initialized for contract operations');
        } catch (error) {
            console.error('❌ Failed to initialize Hedera client:', error.message);
            throw error;
        }
    }

    /**
     * Deploy the staking smart contract to Hedera
     * @returns {string} Contract ID of the deployed contract
     */
    async deployContract() {
        try {
            console.log('🚀 Starting smart contract deployment...');

            // Read the compiled contract bytecode
            const contractBytecode = this.getContractBytecode();
            
            // DIRECT CONTRACT DEPLOYMENT - NO FILES NEEDED!
            const timestamp = new Date().toISOString().split('T')[0];
            console.log('🚀 Using DIRECT deployment (bypassing file creation entirely)');
            console.log('🏗️  Deploying smart contract to Hedera...');
            console.log(`📋 App Account: ${this.appAccountId}`);
            console.log(`💰 Min Stake: ${this.minimumStake / 100000000} HBAR`);
            console.log(`⏱️  Timeout: ${this.serviceTimeout}s`);
            
            console.log('🎯 Constructor parameters:');
            console.log('   App Account:', this.appAccountId);
            console.log('   Solidity Address:', AccountId.fromString(this.appAccountId).toSolidityAddress());
            console.log('   Min Stake:', this.minimumStake);
            console.log('   Service Timeout:', this.serviceTimeout);
            
            // Minimal staking contract with no constructor parameters
            console.log('🎯 Using MinimalStaking contract (ultra-simple, no constructor parameters)');
            const constructorParams = new ContractFunctionParameters(); // Empty parameters
            console.log('📦 Constructor Parameters Object (empty):', constructorParams);
                
            // Use ContractCreateFlow for direct deployment (no file needed) 
            console.log('🔍 Converting bytecode for direct deployment...');
            const bytecodeHex = '0x' + contractBytecode.toString('hex');
            console.log('✅ Bytecode ready for ContractCreateFlow:', bytecodeHex.length, 'chars');
            
            // ContractCreateFlow has different API - let's use ContractCreateTransaction with direct bytecode
            console.log('🔧 Using ContractCreateTransaction with direct bytecode...');
            
            const contractCreateTx = new ContractCreateTransaction()
                .setBytecode(new Uint8Array(Buffer.from(bytecodeHex.slice(2), 'hex'))) // Convert hex to Uint8Array
                .setGas(3000000) // Hedera recommended gas limit for deployment  
                .setConstructorParameters(constructorParams)
                .setMaxTransactionFee(new Hbar(20)); // Higher fee for direct deployment
                
            console.log('🎯 ContractCreateTransaction configured - executing deployment...');

            const contractCreateSubmit = await contractCreateTx.execute(this.client);
            const contractCreateRx = await contractCreateSubmit.getReceipt(this.client);
            this.contractId = contractCreateRx.contractId;

            console.log('🎉 Smart contract deployed successfully!');
            console.log('📋 Contract ID:', this.contractId.toString());
            
            // Save contract ID to config file for future use
            await this.saveContractId(this.contractId.toString());
            
            return this.contractId.toString();
        } catch (error) {
            console.error('❌ Contract deployment failed:', error.message);
            throw error;
        }
    }

    /**
     * Get contract bytecode from compiled Solidity file
     * Supports multiple compilation outputs (Hardhat, Truffle, solc)
     */
    getContractBytecode() {
        try {
            const contractName = 'NotarizationStaking';
            
            // Try different compilation output locations
            const possiblePaths = [
                // TEST: Minimal staking contract
                path.join(__dirname, '../../artifacts/contracts/MinimalStaking.sol/MinimalStaking.json'),
                // Hardhat compilation output - simplified constructor
                path.join(__dirname, '../../artifacts/contracts/NotarizationStaking.sol/NotarizationStaking.json'),
                // TEST: Try simple contract as fallback
                path.join(__dirname, '../../artifacts/contracts/SimpleTest.sol/SimpleTest.json'),
                // Truffle compilation output  
                path.join(__dirname, '../../build/contracts/NotarizationStaking.json'),
                // Direct solc output
                path.join(__dirname, `${contractName}.bin`),
                // Alternative locations
                path.join(__dirname, 'build', `${contractName}.json`),
                path.join(__dirname, 'compiled', `${contractName}.json`)
            ];

            let bytecode = null;
            let compilationMethod = '';

            // Try each possible compilation output
            for (const filePath of possiblePaths) {
                if (fs.existsSync(filePath)) {
                    console.log(`📄 Found compiled contract at: ${filePath}`);
                    
                    if (filePath.endsWith('.json')) {
                        // JSON compilation output (Hardhat/Truffle)
                        const compiledContract = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                        
                        // Try different JSON structures
                        bytecode = compiledContract.bytecode || 
                                  compiledContract.data?.bytecode?.object || 
                                  compiledContract.deployedBytecode ||
                                  compiledContract.evm?.bytecode?.object;
                                  
                        if (bytecode) {
                            compilationMethod = filePath.includes('artifacts') ? 'Hardhat' : 'Truffle';
                            
                            // Debug compiled contract data
                            console.log('🔍 Compiled Contract Analysis:');
                            console.log('   Compilation Method:', compilationMethod);
                            console.log('   Contract Keys:', Object.keys(compiledContract));
                            
                            // Check ABI
                            if (compiledContract.abi) {
                                console.log('📋 Contract ABI available:', compiledContract.abi.length, 'functions/events');
                                const constructor = compiledContract.abi.find(item => item.type === 'constructor');
                                if (constructor) {
                                    console.log('🏗️  Constructor found in ABI:');
                                    console.log('   Parameters:', constructor.inputs.length);
                                    constructor.inputs.forEach((input, i) => {
                                        console.log(`   ${i + 1}. ${input.name}: ${input.type}`);
                                    });
                                } else {
                                    console.log('⚠️  No constructor found in ABI!');
                                }
                            } else {
                                console.log('⚠️  No ABI data available!');
                            }
                            
                            break;
                        }
                    } else if (filePath.endsWith('.bin')) {
                        // Raw bytecode file (solc)
                        bytecode = fs.readFileSync(filePath, 'utf8').trim();
                        compilationMethod = 'solc';
                        break;
                    }
                }
            }

            if (!bytecode) {
                console.error('❌ No compiled contract found. Please compile the contract first:');
                console.error('');
                console.error('🔧 Compilation Options:');
                console.error('');
                console.error('1️⃣  Using Hardhat:');
                console.error('   npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers');
                console.error('   npx hardhat init');
                console.error('   # Copy NotarizationStaking.sol to contracts/');
                console.error('   npx hardhat compile');
                console.error('');
                console.error('2️⃣  Using solc directly:');
                console.error('   npm install -g solc');
                console.error('   solc --bin --abi packages/contracts/NotarizationStaking.sol -o packages/contracts/build/');
                console.error('');
                console.error('3️⃣  Using Truffle:');
                console.error('   npm install -g truffle');
                console.error('   truffle init');
                console.error('   # Copy contract to contracts/ and configure truffle-config.js');
                console.error('   truffle compile');
                
                throw new Error('Contract not compiled. Please compile the Solidity contract first.');
            }

            // Clean bytecode (remove 0x prefix if present)
            if (bytecode.startsWith('0x')) {
                bytecode = bytecode.slice(2);
            }

            // Validate bytecode
            if (bytecode.length === 0) {
                throw new Error('Empty bytecode - compilation may have failed');
            }

            if (bytecode.length < 100) {
                throw new Error('Bytecode too short - likely not a complete contract');
            }

            console.log(`✅ Contract bytecode loaded successfully (${compilationMethod})`);
            console.log(`📊 Bytecode length: ${bytecode.length} characters`);
            console.log(`🔗 For Hedera deployment on ${config.hedera.network}`);
            
            // Debug bytecode
            console.log('🔍 Bytecode Analysis:');
            console.log('   First 100 chars:', bytecode.substring(0, 100));
            console.log('   Contains 0x prefix:', bytecode.startsWith('0x'));
            console.log('   Is valid hex:', /^(0x)?[0-9a-fA-F]+$/.test(bytecode));
            
            // Ensure bytecode has 0x prefix (required by Hedera)
            const hederaBytecode = bytecode.startsWith('0x') ? bytecode : `0x${bytecode}`;
            
            // Calculate size for validation (without 0x prefix)
            const cleanBytecode = hederaBytecode.slice(2);
            const contractSizeKB = Math.round((cleanBytecode.length / 2 / 1024) * 100) / 100;
            
            console.log('📏 Contract Size Analysis:');
            console.log('   Bytecode with 0x prefix:', hederaBytecode.length, 'characters');
            console.log('   Contract size:', contractSizeKB, 'KB');
            console.log('   Hedera limit: 24 KB for creation');
            console.log('   ✅ Bytecode converted to Buffer for Hedera file creation');
            
            if (contractSizeKB > 24) {
                throw new Error(`Contract too large: ${contractSizeKB}KB (limit: 24KB). Consider optimization.`);
            }

            // For Hedera file creation, we need Buffer from clean hex (no 0x)
            return Buffer.from(cleanBytecode, 'hex');
            
        } catch (error) {
            console.error('❌ Failed to get contract bytecode:', error.message);
            throw error;
        }
    }

    /**
     * Create a stake for a notarization request
     * @param {string} requestId - Unique identifier for the request
     * @param {number} stakeAmount - Amount to stake in tinybars
     * @param {string} userAccountId - User's account ID
     * @param {string} userPrivateKey - User's private key
     */
    async createStake(requestId, stakeAmount, userAccountId, userPrivateKey) {
        try {
            if (!this.contractId) {
                throw new Error('Contract not deployed. Deploy contract first.');
            }

            console.log('💰 Creating stake for request:', requestId);

            // Create client with user credentials
            const userClient = Client.forTestnet();
            userClient.setOperator(
                AccountId.fromString(userAccountId),
                PrivateKey.fromStringECDSA(userPrivateKey)
            );

            const contractExecuteTx = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(150000) // Optimized for Hedera staking
                .setFunction('createStake', 
                    new ContractFunctionParameters()
                        .addString(requestId)
                )
                .setPayableAmount(Hbar.fromTinybars(stakeAmount))
                .setTransactionMemo(`Stake-Create-${requestId}-${stakeAmount/100000000}HBAR`)
                .setMaxTransactionFee(new Hbar(5)); // Higher for payable transactions

            const contractExecuteSubmit = await contractExecuteTx.execute(userClient);
            const contractExecuteRx = await contractExecuteSubmit.getReceipt(userClient);

            console.log('✅ Stake created successfully');
            console.log('📋 Transaction ID:', contractExecuteSubmit.transactionId.toString());
            
            return {
                success: true,
                transactionId: contractExecuteSubmit.transactionId.toString(),
                requestId,
                stakeAmount,
                status: 'PENDING'
            };
        } catch (error) {
            console.error('❌ Failed to create stake:', error.message);
            throw error;
        }
    }

    /**
     * Complete a stake after successful service delivery
     * @param {string} requestId - Request ID to complete
     */
    async completeStake(requestId) {
        try {
            if (!this.contractId) {
                throw new Error('Contract not deployed. Deploy contract first.');
            }

            console.log('✅ Completing stake for request:', requestId);

            const contractExecuteTx = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(100000) // Optimized for Hedera
                .setFunction('completeStake',
                    new ContractFunctionParameters()
                        .addString(requestId)
                )
                .setTransactionMemo(`Stake-Complete-${requestId}-ToApp`)
                .setMaxTransactionFee(new Hbar(3)); // Adequate for Hedera

            const contractExecuteSubmit = await contractExecuteTx.execute(this.client);
            const contractExecuteRx = await contractExecuteSubmit.getReceipt(this.client);

            console.log('🎉 Stake completed - funds transferred to app account');
            console.log('📋 Transaction ID:', contractExecuteSubmit.transactionId.toString());

            return {
                success: true,
                transactionId: contractExecuteSubmit.transactionId.toString(),
                requestId,
                status: 'COMPLETED'
            };
        } catch (error) {
            console.error('❌ Failed to complete stake:', error.message);
            throw error;
        }
    }

    /**
     * Refund a stake due to service failure
     * @param {string} requestId - Request ID to refund
     */
    async refundStake(requestId) {
        try {
            if (!this.contractId) {
                throw new Error('Contract not deployed. Deploy contract first.');
            }

            console.log('💸 Refunding stake for request:', requestId);

            const contractExecuteTx = new ContractExecuteTransaction()
                .setContractId(this.contractId)
                .setGas(100000) // Optimized for Hedera
                .setFunction('refundStake',
                    new ContractFunctionParameters()
                        .addString(requestId)
                )
                .setTransactionMemo(`Stake-Refund-${requestId}-ToUser`)
                .setMaxTransactionFee(new Hbar(3)); // Adequate for Hedera

            const contractExecuteSubmit = await contractExecuteTx.execute(this.client);
            const contractExecuteRx = await contractExecuteSubmit.getReceipt(this.client);

            console.log('💰 Stake refunded to user');
            console.log('📋 Transaction ID:', contractExecuteSubmit.transactionId.toString());

            return {
                success: true,
                transactionId: contractExecuteSubmit.transactionId.toString(),
                requestId,
                status: 'REFUNDED'
            };
        } catch (error) {
            console.error('❌ Failed to refund stake:', error.message);
            throw error;
        }
    }

    /**
     * Get stake information for a request
     * @param {string} requestId - Request ID to query
     */
    async getStake(requestId) {
        try {
            if (!this.contractId) {
                throw new Error('Contract not deployed. Deploy contract first.');
            }

            const contractQuery = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100000)
                .setFunction('getStake',
                    new ContractFunctionParameters()
                        .addString(requestId)
                )
                .setMaxQueryPayment(new Hbar(1));

            const contractCallResult = await contractQuery.execute(this.client);
            
            // Parse the result (this depends on the exact return format)
            const user = contractCallResult.getAddress(0);
            const amount = contractCallResult.getUint256(1);
            const timestamp = contractCallResult.getUint256(2);
            const status = contractCallResult.getUint8(3);

            const statusMap = ['PENDING', 'COMPLETED', 'REFUNDED', 'EXPIRED'];

            return {
                user: AccountId.fromSolidityAddress(user).toString(),
                amount: amount.toString(),
                timestamp: timestamp.toString(),
                status: statusMap[status] || 'UNKNOWN'
            };
        } catch (error) {
            console.error('❌ Failed to get stake info:', error.message);
            throw error;
        }
    }

    /**
     * Save contract ID to configuration file
     */
    async saveContractId(contractId) {
        try {
            const configPath = path.join(__dirname, '../config/contract-config.json');
            const contractConfig = {
                stakingContractId: contractId,
                deployedAt: new Date().toISOString(),
                appAccountId: this.appAccountId,
                minimumStake: this.minimumStake,
                serviceTimeout: this.serviceTimeout
            };
            
            fs.writeFileSync(configPath, JSON.stringify(contractConfig, null, 2));
            console.log('💾 Contract configuration saved to:', configPath);
        } catch (error) {
            console.error('❌ Failed to save contract configuration:', error.message);
        }
    }

    /**
     * Load contract ID from configuration file
     */
    loadContractId() {
        try {
            const configPath = path.join(__dirname, '../config/contract-config.json');
            if (fs.existsSync(configPath)) {
                const contractConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                this.contractId = contractConfig.stakingContractId;
                console.log('📋 Loaded contract ID:', this.contractId);
                return this.contractId;
            }
        } catch (error) {
            console.error('❌ Failed to load contract configuration:', error.message);
        }
        return null;
    }

    /**
     * Check contract balance
     */
    async getContractBalance() {
        try {
            if (!this.contractId) {
                throw new Error('Contract not deployed. Deploy contract first.');
            }

            const contractQuery = new ContractCallQuery()
                .setContractId(this.contractId)
                .setGas(100000)
                .setFunction('getContractBalance')
                .setMaxQueryPayment(new Hbar(1));

            const contractCallResult = await contractQuery.execute(this.client);
            const balance = contractCallResult.getUint256(0);

            return {
                balanceInTinybars: balance.toString(),
                balanceInHbar: (balance / 100000000).toString()
            };
        } catch (error) {
            console.error('❌ Failed to get contract balance:', error.message);
            throw error;
        }
    }
}

export default StakingContractManager;
