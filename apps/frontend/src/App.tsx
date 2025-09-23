import React, { useEffect, useState } from 'react';
import { HashConnect, HashConnectTypes, MessageTypes } from '@hashgraph/hashconnect';
import {
  AccountId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar
} from "@hashgraph/sdk";
import { NotarizationForm } from './components/NotarizationForm';
import { treasuryConfig } from './config/treasury';

const APP_CONFIG = {
  name: "Altheia Content Notarization",
  description: "Secure content notarization on Hedera",
  icon: "https://www.hashpack.app/img/logo.svg",
  url: window.location.origin
};

function App() {
  const [hashConnect, setHashConnect] = useState<HashConnect | null>(null);
  const [accountId, setAccountId] = useState<string>("");
  const [balance, setBalance] = useState<string>("0");
  const [connected, setConnected] = useState(false);
  const [pairingData, setPairingData] = useState<HashConnectTypes.SavedPairingData | null>(null);

  useEffect(() => {
    initializeHashConnect();
  }, []);

  const initializeHashConnect = async () => {
    try {
      const hashConnect = new HashConnect(false);

      hashConnect.pairingEvent.once((pairingData) => {
        console.log('Pairing event received', pairingData);
        setPairingData(pairingData);
        if (pairingData.accountIds?.length > 0) {
          setAccountId(pairingData.accountIds[0]);
          setConnected(true);
        }
      });

      const initData = await hashConnect.init(APP_CONFIG, "testnet", false);
      const topic = initData.topic;
      console.log('HashConnect initialized with topic:', topic);

      // Find existing connection
      const foundPairings = await hashConnect.findLocalWallets();
      console.log('Found pairings:', foundPairings);
      
      if (foundPairings.length > 0) {
        const accountInfo = foundPairings[0].accountIds[0];
        setAccountId(accountInfo);
        setConnected(true);
        // Get balance
        try {
          const provider = hashConnect.getProvider('testnet', topic, accountInfo);
          const balance = await provider.getAccountBalance(accountInfo);
          setBalance(balance.hbars.toString());
        } catch (err) {
          console.error('Error getting balance:', err);
        }
      }

      setHashConnect(hashConnect);
    } catch (error) {
      console.error('Error initializing HashConnect:', error);
    }
  };

  const connectWallet = async () => {
    if (!hashConnect) {
      console.error('HashConnect not initialized');
      return;
    }

    try {
      console.log('Requesting pairing...');
      await hashConnect.connectToLocalWallet();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      alert('Failed to connect wallet. Please try again.');
    }
  };

  const handleMint = async (contentHash: string): Promise<string> => {
    if (!hashConnect || !connected || !pairingData) {
      throw new Error("Wallet not connected");
    }

    try {
      const provider = hashConnect.getProvider('testnet', pairingData.topic, accountId);
      const signer = hashConnect.getSigner(provider);

      const tx = await new ContractExecuteTransaction()
        .setContractId(treasuryConfig.contractId)
        .setGas(100000)
        .setFunction(
          "mintContent",
          new ContractFunctionParameters().addString(contentHash)
        )
        .setPayableAmount(new Hbar(treasuryConfig.minimumStake))
        .freezeWith(provider);

      const signedTx = await signer.signTransaction(tx);
      const executedTx = await signedTx.execute(provider);
      const receipt = await executedTx.getReceipt(provider);

      // Update balance after minting
      const newBalance = await provider.getAccountBalance(accountId);
      setBalance(newBalance.hbars.toString());

      return executedTx.transactionId.toString();
    } catch (error) {
      console.error('Minting failed:', error);
      throw error;
    }
  };

  const handleNotarize = async (contentHash: string): Promise<string> => {
    if (!hashConnect || !connected || !pairingData) {
      throw new Error("Wallet not connected");
    }

    try {
      const provider = hashConnect.getProvider('testnet', pairingData.topic, accountId);
      const signer = hashConnect.getSigner(provider);

      const tx = await new ContractExecuteTransaction()
        .setContractId(treasuryConfig.contractId)
        .setGas(100000)
        .setFunction(
          "notarizeContent",
          new ContractFunctionParameters().addString(contentHash)
        )
        .freezeWith(provider);

      const signedTx = await signer.signTransaction(tx);
      const executedTx = await signedTx.execute(provider);
      await executedTx.getReceipt(provider);

      return executedTx.transactionId.toString();
    } catch (error) {
      console.error('Notarization failed:', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      {!connected ? (
        <div className="flex items-center justify-center min-h-screen">
          <button
            onClick={connectWallet}
            className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-bold text-lg hover:opacity-90 transition-opacity"
          >
            Connect HashPack Wallet
          </button>
        </div>
      ) : (
        <NotarizationForm
          accountBalance={balance}
          onMint={handleMint}
          onNotarize={handleNotarize}
          connectedAccountId={accountId}
        />
      )}
    </div>
  );
}

export default App;