import { 
    Client, 
    AccountId, 
    PrivateKey, 
    ContractExecuteTransaction,
    ContractFunctionParameters,
    Hbar
} from '@hashgraph/sdk';
import { config } from '../packages/config/env/config.js';

async function initializeContract() {
    try {
        console.log('🔧 Initializing MinimalStaking contract: 0.0.6888717');
        
        // Initialize Hedera client
        const client = Client.forTestnet();
        client.setOperator(
            AccountId.fromString(config.hedera.accountId),
            PrivateKey.fromStringECDSA(config.hedera.privateKey)
        );
        
        console.log('📞 Calling setAppAccount(0.0.6884960)...');
        
        // Convert app account to Solidity address
        const appAccountSolidityAddress = AccountId.fromString('0.0.6884960').toSolidityAddress();
        
        // Call setAppAccount function
        const contractExecTx = new ContractExecuteTransaction()
            .setContractId('0.0.6888717')
            .setGas(100000)
            .setFunction('setAppAccount', new ContractFunctionParameters().addAddress(appAccountSolidityAddress))
            .setMaxTransactionFee(new Hbar(2));
        
        const contractExecSubmit = await contractExecTx.execute(client);
        const contractExecRx = await contractExecSubmit.getReceipt(client);
        
        console.log('✅ Contract initialized successfully!');
        console.log('🎯 App account set to: 0.0.6884960');
        console.log('💰 Successful stakes will now transfer to your app account');
        console.log('🏁 Your staking system is ready to use!');
        
    } catch (error) {
        console.error('❌ Initialization failed:', error.message);
        throw error;
    }
}

initializeContract();
