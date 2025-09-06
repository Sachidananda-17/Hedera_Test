import { Client, AccountId, PrivateKey, TopicCreateTransaction, TopicMessageSubmitTransaction } from "@hashgraph/sdk";
import dotenv from 'dotenv';

dotenv.config();

async function testHederaConnection() {
    try {
        // Initialize Hedera client
        const client = Client.forTestnet();
        
        // Set operator from environment variables
        if (process.env.HEDERA_ACCOUNT_ID && process.env.HEDERA_PRIVATE_KEY) {
            client.setOperator(
                AccountId.fromString(process.env.HEDERA_ACCOUNT_ID),
                PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY)
            );
            console.log('✅ Hedera client initialized with operator:', process.env.HEDERA_ACCOUNT_ID);
        } else {
            throw new Error('Hedera credentials not found in environment');
        }

        // Create a new topic
        const txResponse = await new TopicCreateTransaction()
            .setSubmitKey(PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY).publicKey)
            .execute(client);

        const receipt = await txResponse.getReceipt(client);
        const topicId = receipt.topicId;
        console.log('✅ New topic created:', topicId.toString());

        // Submit a test message
        const message = {
            type: "test",
            content: "Hello Hedera!",
            timestamp: new Date().toISOString()
        };

        const submitTx = await new TopicMessageSubmitTransaction()
            .setTopicId(topicId)
            .setMessage(JSON.stringify(message))
            .execute(client);

        const submitReceipt = await submitTx.getReceipt(client);
        console.log('✅ Message submitted to topic, status:', submitReceipt.status.toString());

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run the test
console.log('🚀 Starting Hedera connection test...');
testHederaConnection();
