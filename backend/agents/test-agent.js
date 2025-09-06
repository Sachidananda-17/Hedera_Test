import { Fetch } from '@fetch-ai/js-sdk';
import dotenv from 'dotenv';

dotenv.config();

async function testFetchAgent() {
    try {
        // Initialize Fetch.ai agent
        const agent = new Fetch({
            name: process.env.FETCH_AGENT_NAME,
            privateKey: process.env.FETCH_PRIVATE_KEY
        });

        // Test connection
        await agent.connect();
        console.log('✅ Successfully connected to Fetch.ai network');
        
        // Get agent info
        const info = await agent.getInfo();
        console.log('Agent Info:', info);

    } catch (error) {
        console.error('❌ Failed to connect to Fetch.ai:', error);
    }
}

testFetchAgent();
