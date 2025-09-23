import {
    Client,
    PrivateKey,
    ContractExecuteTransaction,
    ContractCallQuery,
    Hbar,
    ContractFunctionParameters,
    AccountBalanceQuery,
    ContractInfoQuery,
    TransactionId
} from "@hashgraph/sdk";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to retry operations
async function retry(operation, maxAttempts = 3, delay = 2000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (attempt === maxAttempts) throw error;
            console.log(`Attempt ${attempt} failed, retrying in ${delay/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

async function main() {
    console.log("\n🔍 Checking Network Connectivity...");
    try {
        const client = Client.forTestnet();
        await client.ping();
        console.log("✅ Successfully connected to Hedera network");
    } catch (error) {
        console.error("❌ Network connectivity issue detected!");
        console.error("This might be due to VPN restrictions. Please check your network connection.");
        console.error("Suggested solutions:");
        console.error("1. Temporarily disable VPN");
        console.error("2. Request VPN whitelist for Hedera domains");
        console.error("3. Use a non-VPN network");
        throw error;
    }

    // Load environment variables
    dotenv.config({ path: path.resolve(__dirname, '../../config/.env') });
    
    // Contract ID from our deployment - get from treasury.ts
    const configPath = path.join(__dirname, "../../../frontend/src/config/treasury.ts");
    const configContent = readFileSync(configPath, 'utf8');
    const match = configContent.match(/contractId: "([^"]+)"/);
    if (!match) {
        throw new Error("Could not find contractId in treasury.ts");
    }
    const contractId = match[1];
    
    console.log(`Using contract ID: ${contractId}`);
    
    // Initialize Hedera client with longer timeout
    const operatorId = process.env.HEDERA_OPERATOR_ID;
    const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_PRIVATE_KEY);
    
    if (!operatorId || !operatorKey) {
        throw new Error("Environment variables HEDERA_OPERATOR_ID and HEDERA_OPERATOR_PRIVATE_KEY must be present");
    }

    const client = Client.forTestnet();
    client.setOperator(operatorId, operatorKey);
    client.setMaxAttempts(3); // Retry transactions up to 3 times
    client.setRequestTimeout(30000); // 30 second timeout

    // 1. Check initial balances
    console.log("\n1️⃣ Checking Balances:");
    const [treasuryBalance, userBalance] = await retry(async () => {
        const treasury = await new AccountBalanceQuery()
            .setAccountId("0.0.6651850")
            .execute(client);
        const user = await new AccountBalanceQuery()
            .setAccountId(operatorId)
            .execute(client);
        return [treasury, user];
    });
    
    console.log(`Treasury Balance: ${treasuryBalance.hbars.toString()}`);
    console.log(`Your Balance: ${userBalance.hbars.toString()}`);

    // 2. Mint content
    console.log("\n2️⃣ Minting Content:");
    const contentHash = "QmTest" + Date.now();
    console.log(`Content Hash: ${contentHash}`);

    try {
        // Calculate exact HBAR amount
        const mintingFee = new Hbar(5);
        console.log(`Sending exactly ${mintingFee.toString()} (${mintingFee.toTinybars()} tinybars)`);

        // Create and execute transaction with retry
        const mintReceipt = await retry(async () => {
            const mintTx = await new ContractExecuteTransaction()
                .setContractId(contractId)
                .setGas(500000)
                .setFunction(
                    "mintContent",
                    new ContractFunctionParameters().addString(contentHash)
                )
                .setPayableAmount(mintingFee)
                .execute(client);
            
            return await mintTx.getReceipt(client);
        });

        console.log(`✅ Content minted successfully! Status: ${mintReceipt.status}`);
        console.log(`Transaction ID: ${mintReceipt.transactionId.toString()}`);
        console.log(`View on HashScan: https://hashscan.io/testnet/transaction/${mintReceipt.transactionId.toString()}`);

        // Check updated balance
        const newBalance = await retry(async () => {
            return await new AccountBalanceQuery()
                .setAccountId("0.0.6651850")
                .execute(client);
        });
        console.log(`New Treasury Balance: ${newBalance.hbars.toString()}`);

    } catch (error) {
        console.error("❌ Minting failed:", error.message);
        if (error.message.includes('CONTRACT_REVERT_EXECUTED')) {
            console.log("\nPossible reasons for failure:");
            console.log("1. Content hash already exists");
            console.log("2. Network connectivity issues (VPN)");
            console.log("3. Contract state issue");
        }
        return;
    }

    // Rest of the code remains the same...
}

// Run the test with better error handling
main()
    .then(() => console.log("\n✨ Test completed successfully!"))
    .catch((error) => {
        console.error("\n❌ Test failed!");
        if (error.message.includes('UNAVAILABLE')) {
            console.error("Network connectivity issue detected. Please check your VPN settings.");
        } else {
            console.error("Error details:", error.message);
        }
    })
    .finally(() => process.exit());