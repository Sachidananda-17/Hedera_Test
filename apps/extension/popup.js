function el(id) { return document.getElementById(id); }
let isConnecting = false;
let sourceLabel = '';
let lastWcUri = '';

function addBubble(kind, contentHtml) {
  const wrap = document.createElement('div');
  wrap.className = `bubble ${kind}`;
  wrap.innerHTML = contentHtml;
  el('messages').appendChild(wrap);
  el('messages').scrollTop = el('messages').scrollHeight;
}

function formatResult(data) {
  const cid = data?.ipfsCid || '';
  const hederaUrl = data?.hederaExplorerUrl || '';
  const ipfsUrl = data?.ipfsGatewayUrl || '';
  const ipfsAlt = data?.alternativeIPFSUrls || [];
  const verification = data?.internalProcessing?.verificationStatus || {};
  const ai = data?.internalProcessing?.aiAnalysis?.agentKit;

  let html = '';
  if (ai) {
    const output = typeof ai === 'string' ? ai : (ai.output?.output || ai.output || '');
    html += `<div>${output ? output.replace(/</g, '&lt;') : 'AI analysis complete.'}</div>`;
  } else {
    html += `<div>Notarized successfully.</div>`;
  }
  html += `<div class="meta">
    <span class="pill">CID</span> ${cid || 'n/a'}
  </div>`;
  if (ipfsUrl) {
    html += `<div class="urls"><div class="url">${ipfsUrl}</div></div>`;
  }
  if (ipfsAlt && ipfsAlt.length) {
    html += `<div class="urls">${ipfsAlt.slice(0,2).map(u=>`<div class="url">${u}</div>`).join('')}</div>`;
  }
  if (hederaUrl) {
    html += `<div class="urls"><div class="url">${hederaUrl}</div></div>`;
  }
  if (typeof verification.ipfsAccessible === 'boolean') {
    html += `<div class="meta">IPFS: ${verification.ipfsAccessible ? 'Accessible' : 'Pending'}</div>`;
  }
  return html;
}

async function refreshStatus() {
  const active = await chrome.runtime.sendMessage({ type: 'GET_ACTIVE_ACCOUNT' });
  const account = active?.ok ? active.accountId : '';
  sourceLabel = active?.ok ? (active.source || '') : '';
  const suffix = sourceLabel ? ` (${sourceLabel})` : '';
  el('status').textContent = account ? `Wallet: ${account}${suffix}` : 'Wallet not detected';
  const btn = el('connect');
  if (btn) btn.style.display = account ? 'none' : 'inline-block';
  const sw = el('switch');
  if (sw) sw.style.display = account ? 'inline-block' : 'none';
}

async function handleSubmit() {
  const text = el('text').value.trim();
  if (!text) return;
  addBubble('user', text.replace(/</g, '&lt;'));
  el('text').value = '';
  const typingId = `typing-${Date.now()}`;
  addBubble('ai', `<span id="${typingId}">Analyzing…</span>`);
  const resp = await chrome.runtime.sendMessage({ type: 'NOTARIZE_TEXT', text });
  const typing = document.getElementById(typingId);
  if (typing) typing.parentElement?.remove();
  if (resp?.ok) {
    addBubble('ai', formatResult(resp.result));
  } else {
    addBubble('ai', `Error: ${resp?.error || 'unknown'}`);
  }
}

async function connectWalletConnect() {
  try {
    const scriptUrl = chrome.runtime.getURL('walletconnect.global.js');
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = scriptUrl;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });

    if (!window.WalletConnectSignClient) throw new Error('WalletConnect SDK not loaded');

    // Require a valid project id from Options
    const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    const projectId = (settings?.ok && settings.settings?.wcProjectId) ? String(settings.settings.wcProjectId).trim() : '';
    const looksValid = /^[a-z0-9]{32,}$/i.test(projectId);
    if (!looksValid) {
      addBubble('ai', 'WalletConnect Project ID missing or invalid. Open Options and set a valid Project ID, then try again.');
      try { chrome.runtime.openOptionsPage(); } catch (_) {}
      return;
    }

    const client = await window.WalletConnectSignClient.init({ projectId, relayUrl: 'wss://relay.walletconnect.com', metadata: {
      name: 'Hedera Notary',
      description: 'Premium notarization',
      url: location.origin,
      icons: [chrome.runtime.getURL('icons/icon48.png')]
    }});

    const { uri, approval } = await client.connect({
      optionalNamespaces: {
        hedera: {
          methods: ['hedera_signTransaction', 'hedera_signMessage'],
          chains: ['hedera:testnet', 'hedera:mainnet'],
          events: ['chainChanged', 'accountsChanged']
        }
      }
    });

    if (uri) {
      lastWcUri = uri;
      const link = `hashpack://wc?uri=${encodeURIComponent(uri)}`;
      try { window.open(link, '_blank'); } catch (_) {}
      addBubble('ai', 'Opening HashPack for WalletConnect pairing…');
      // Also show/copy URI in case deep link is blocked
      const p = document.getElementById('pairing');
      const u = document.getElementById('wcUri');
      if (p && u) { p.style.display = 'block'; u.textContent = uri; }
    }

    const session = await approval();
    const accounts = session.namespaces?.hedera?.accounts || [];
    const accountId = (accounts[0] || '').split(':').pop();
    if (!accountId) throw new Error('No account from session');

    await chrome.runtime.sendMessage({ type: 'SET_SETTINGS', settings: { activeAccountId: accountId, activeAccountSource: 'paired' } });
    el('status').textContent = `Wallet: ${accountId}`;
    addBubble('ai', 'Connected to HashPack via WalletConnect.');
  } catch (e) {
    const msg = e && e.message ? e.message : (typeof e === 'string' ? e : '[unknown error]');
    addBubble('ai', `WalletConnect failed: ${msg}`);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await refreshStatus();
  el('submit').addEventListener('click', handleSubmit);
  el('text').addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit();
  });
  el('connect').addEventListener('click', async () => {
    if (isConnecting) return;
    // If wallet already detected, no need to connect
    const active = await chrome.runtime.sendMessage({ type: 'GET_ACTIVE_ACCOUNT' });
    if (active?.ok && active.accountId) return;
    isConnecting = true;
    const btn = el('connect');
    if (btn) btn.disabled = true;
    addBubble('ai', 'Requesting HashPack connection…');
    try {
      await connectWalletConnect();
    } finally {
      isConnecting = false;
      await refreshStatus();
      const active2 = await chrome.runtime.sendMessage({ type: 'GET_ACTIVE_ACCOUNT' });
      if (btn) btn.disabled = false, btn.style.display = active2?.ok && active2.accountId ? 'none' : 'inline-block';
    }
  });
  el('switch').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'CLEAR_ALL_ACCOUNTS' });
    await refreshStatus();
    addBubble('ai', 'Cleared saved accounts. Click Connect HashPack to pair your wallet.');
  });
  el('copyUri').addEventListener('click', async () => {
    if (!lastWcUri) return;
    try {
      await navigator.clipboard.writeText(lastWcUri);
      addBubble('ai', 'WalletConnect URI copied. Paste in HashPack → Connections.');
    } catch (_) {
      addBubble('ai', 'Copy failed. Manually select and copy the URI shown.');
    }
  });
});


