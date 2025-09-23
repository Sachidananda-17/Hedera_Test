import {
    Client,
    FileCreateTransaction,
    ContractCreateTransaction,
    FileAppendTransaction,
    Hbar,
    ContractFunctionParameters,
    PrivateKey,
    AccountBalanceQuery,
    AccountId
} from "@hashgraph/sdk";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import solc from 'solc';

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function compileSolidity(sourceCode) {
    console.log('\n📄 Compiling Smart Contract...');
    
    const input = {
        language: 'Solidity',
        sources: {
            'ContentNotarization.sol': {
                content: sourceCode
            }
        },
        settings: {
            outputSelection: {
                '*': {
                    '*': ['*']
                }
            },
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    };

    console.log('Compiling with Solidity compiler...');
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
        console.log('Compilation produced warnings/errors:', output.errors);
        const errors = output.errors.filter(error => error.severity === 'error');
        if (errors.length > 0) {
            throw new Error(`Compilation errors:\n${JSON.stringify(errors, null, 2)}`);
        }
    }

    const contract = output.contracts['ContentNotarization.sol']['ContentNotarization'];
    console.log('✅ Contract compiled successfully');
    
    return contract.evm.bytecode.object;
}

async function deployContract() {
    console.log('\n📝 Starting Deployment Process...');

    // Load environment variables
    const envPath = path.resolve(__dirname, '../../config/.env');
    dotenv.config({ path: envPath });

    // Get credentials
    const operatorId = process.env.HEDERA_OPERATOR_ID;
    const operatorKey = process.env.HEDERA_OPERATOR_PRIVATE_KEY;
    const treasuryId = AccountId.fromString("0.0.6651850"); // Using your account as treasury

    if (!operatorId || !operatorKey) {
        throw new Error(`Environment variables not found. Please check .env file at: ${envPath}`);
    }

    console.log(`\n1️⃣ Account Information:
    - Deployer Account: ${operatorId}
    - Treasury Account: ${treasuryId.toString()}
    - This account will:
        a) Pay for deployment gas fees
        b) Be the owner of the contract
        c) Have admin rights to the contract`);

    // Initialize Hedera Client
    console.log('\n2️⃣ Initializing Hedera Connection...');
    const client = Client.forTestnet();
    const privateKey = PrivateKey.fromString(operatorKey);
    client.setOperator(operatorId, privateKey);

    // Check Account Balance
    console.log('\n3️⃣ Checking Account Balance...');
    try {
        const balance = await new AccountBalanceQuery()
            .setAccountId(operatorId)
            .execute(client);
        console.log(`Balance: ${balance.hbars.toString()} ℏ`);
    } catch (error) {
        console.error('Failed to check balance:', error.message);
        throw error;
    }

    // Read and Compile Smart Contract
    console.log('\n4️⃣ Reading Smart Contract...');
    const contractPath = path.join(__dirname, "../contracts/ContentNotarization.sol");
    if (!fs.existsSync(contractPath)) {
        throw new Error(`Contract file not found at: ${contractPath}`);
    }
    const contractSource = fs.readFileSync(contractPath, "utf8");
    console.log('Contract source loaded successfully');

    // Compile the contract
    const bytecode = compileSolidity(contractSource);
    console.log('Contract bytecode size:', bytecode.length, 'bytes');

    try {
        // Create File on Hedera
        console.log('\n5️⃣ Creating File on Hedera...');
        let fileCreateTx = new FileCreateTransaction()
            .setKeys([privateKey.publicKey])
            .setContents(bytecode)
            .setMaxTransactionFee(new Hbar(10))
            .setTransactionMemo("Altheia Content Notarization Contract Bytecode")
            .freezeWith(client);

        let fileCreateSign = await fileCreateTx.sign(privateKey);
        let fileCreateSubmit = await fileCreateSign.execute(client);
        let fileCreateRx = await fileCreateSubmit.getReceipt(client);
        let bytecodeFileId = fileCreateRx.fileId;
        console.log(`- File created successfully! File ID: ${bytecodeFileId.toString()}`);

        // Deploy Contract
        console.log('\n6️⃣ Deploying Smart Contract...');
        console.log('Setting treasury account:', treasuryId.toString());
        
        // Convert Hedera account ID to EVM address format
        const evmAddress = `0x${treasuryId.toSolidityAddress()}`;
        console.log('Treasury EVM address:', evmAddress);

        const contractCreateTx = new ContractCreateTransaction()
            .setBytecodeFileId(bytecodeFileId)
            .setGas(1000000)
            .setConstructorParameters(
                new ContractFunctionParameters().addAddress(evmAddress)
            )
            .setMaxTransactionFee(new Hbar(30))
            .setTransactionMemo("Altheia Content Notarization Contract Deployment")
            .freezeWith(client);

        console.log('Contract transaction created, signing...');
        const contractCreateSign = await contractCreateTx.sign(privateKey);
        
        console.log('Contract signed, executing...');
        const contractCreateSubmit = await contractCreateSign.execute(client);
        
        console.log('Waiting for contract creation receipt...');
        const contractCreateRx = await contractCreateSubmit.getReceipt(client);
        const contractId = contractCreateRx.contractId;

        console.log(`\n✅ Success! Contract deployed to: ${contractId.toString()}`);

        // Save Contract ID
        const configPath = path.join(__dirname, "../../../frontend/src/config/treasury.ts");
        const configContent = `export const treasuryConfig = {
    accountId: "${treasuryId.toString()}",
    network: "testnet",
    minimumStake: 5,
    name: "Altheia Treasury Testnet",
    contractId: "${contractId.toString()}",
    treasuryAddress: "${evmAddress}"
};`;
        
        fs.writeFileSync(configPath, configContent);
        console.log('\n💾 Contract ID saved to frontend config');

        return {
            contractId: contractId.toString(),
            bytecodeFileId: bytecodeFileId.toString(),
            treasuryId: treasuryId.toString()
        };

    } catch (error) {
        console.error('\n❌ Deployment Error:', error.message);
        if (error.message.includes('INSUFFICIENT_GAS')) {
            console.error('\nTroubleshooting Tips:');
            console.error('1. The contract might be too complex. We simplified it.');
            console.error('2. Try increasing the gas limit further if this fails.');
            console.error('3. Check if the treasury address is correct.');
        }
        throw error;
    }
}

// Run deployment
deployContract()
    .then((result) => {
        console.log('\n📝 Deployment Summary:');
        console.log('- Contract ID:', result.contractId);
        console.log('- Bytecode File ID:', result.bytecodeFileId);
        console.log('- Treasury Account:', result.treasuryId);
        console.log('\n🎉 Contract deployment completed!');
    })
    .catch((error) => {
        console.error('\n❌ Deployment Failed:', error.message);
        process.exit(1);
    });