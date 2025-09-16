(() => {
  // Periodically probe for HashPack-style globals
  const SOURCES = [
    () => window.connectedAccountId,
    () => window.hederaAccountId,
    () => window.hashpack?.accountIds?.[0],
    () => window.wallet?.accountId,
  ];

  let last = null;

  function readAccount() {
    for (const get of SOURCES) {
      try {
        const v = get && get();
        if (typeof v === 'string' && v.includes('.')) return v;
      } catch (_) {}
    }
    return null;
  }

  function broadcast(accountId) {
    try {
      const msg = { source: 'hedera-notary', type: 'ACCOUNT_DETECTED', accountId };
      window.postMessage(msg, '*');
      try { chrome.runtime.sendMessage(msg); } catch (_) {}
    } catch (_) {}
  }

  function tick() {
    const curr = readAccount();
    if (curr && curr !== last) {
      last = curr;
      broadcast(curr);
    }
  }

  // Initial and periodic checks
  tick();
  const interval = setInterval(tick, 1500);

  // Cleanup on unload
  window.addEventListener('beforeunload', () => clearInterval(interval));

  // Relay page messages (if any) to background
  window.addEventListener('message', (event) => {
    try {
      const data = event.data || {};
      if (data && data.source === 'hedera-notary' && data.type === 'ACCOUNT_DETECTED' && data.accountId) {
        try { chrome.runtime.sendMessage(data); } catch (_) {}
      }
    } catch (_) {}
  });
})();


