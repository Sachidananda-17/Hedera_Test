import { HashConnect } from 'hashconnect';

export async function connectHashpack(appMetadata) {
  const hashconnect = new HashConnect(true);
  const appMeta = appMetadata || {
    name: 'Hedera Notary',
    description: 'Premium notarization and AI analysis',
    icon: ''
  };

  const initData = await hashconnect.init(appMeta, 'testnet');
  const state = await hashconnect.connect();

  // Request available local wallets (HashPack)
  await hashconnect.findLocalWallets();

  // Establish pairing (automatically opens HashPack prompt)
  await hashconnect.connectToLocalWallet(state.pairingString);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('HashPack pairing timeout')), 60000);
    hashconnect.pairingEvent.once((pairingData) => {
      clearTimeout(timeout);
      try {
        const accountId = pairingData?.accountIds?.[0] || '';
        resolve({ hashconnect, pairingData, accountId });
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Expose global for IIFE bundle
if (typeof window !== 'undefined') {
  window.HashpackSetup = window.HashpackSetup || {};
  window.HashpackSetup.connectHashpack = connectHashpack;
}


