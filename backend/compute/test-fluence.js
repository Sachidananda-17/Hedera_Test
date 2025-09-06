import { Fluence } from '@fluencelabs/js-client';
import dotenv from 'dotenv';

dotenv.config();

async function testFluenceConnection() {
    try {
        // Initialize Fluence client
        await Fluence.start({
            connectTo: process.env.FLUENCE_NETWORK,
            KeyPair: process.env.FLUENCE_KEYPAIR
        });

        console.log('✅ Successfully connected to Fluence network');
        console.log('Peer ID:', Fluence.getStatus().peerId);
        console.log('Connection Time:', Fluence.getStatus().connectionTime);

    } catch (error) {
        console.error('❌ Failed to connect to Fluence:', error);
    } finally {
        await Fluence.stop();
    }
}

testFluenceConnection();
