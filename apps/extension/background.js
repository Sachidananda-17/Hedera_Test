const DEFAULT_API_URL = 'http://localhost:3001';
// Hardcoded fallback Hedera account ID (temporary)
const HARDCODED_ACCOUNT_ID = '0.0.6651850';

function ensureContextMenus() {
  try {
    chrome.contextMenus.removeAll(() => {
      try {
        chrome.contextMenus.create({
          id: 'hedera-notarize-selection',
          title: 'Notarize selection with Hedera Notary',
          contexts: ['selection']
        });
        chrome.contextMenus.create({
          id: 'hedera-analyze-image',
          title: 'Analyze image with Hedera Notary',
          contexts: ['image']
        });
      } catch (e) {
        console.error('Context menu create failed:', e);
      }
    });
  } catch (e) {
    console.error('Context menu setup error:', e);
  }
}

chrome.runtime.onInstalled.addListener(ensureContextMenus);
chrome.runtime.onStartup?.addListener(ensureContextMenus);

function sendToTab(tabId, message) {
  try { chrome.tabs.sendMessage(tabId, message); } catch (_) {}
}

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      apiUrl: DEFAULT_API_URL,
      accountId: '',
      activeAccountId: '',
      activeAccountSource: '',
      detectedAccountId: '',
      wcProjectId: ''
    }, resolve);
  });
}

async function tryGetAccountIdFromTab(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        try {
          const picks = [
            () => window.connectedAccountId,
            () => window.hederaAccountId,
            () => window.wallet && window.wallet.accountId,
            () => window.hashpack && Array.isArray(window.hashpack.accountIds) && window.hashpack.accountIds[0],
            () => window.hashconnect && window.hashconnect.hcData && window.hashconnect.hcData.savedPairings && window.hashconnect.hcData.savedPairings[0] && window.hashconnect.hcData.savedPairings[0].accountIds && window.hashconnect.hcData.savedPairings[0].accountIds[0],
            () => window.hashconnect && window.hashconnect.pairingData && Array.isArray(window.hashconnect.pairingData.accountIds) && window.hashconnect.pairingData.accountIds[0],
            () => window.hashconnect && window.hashconnect.state && window.hashconnect.state.pairingData && Array.isArray(window.hashconnect.state.pairingData.accountIds) && window.hashconnect.state.pairingData.accountIds[0],
          ];
          for (const get of picks) {
            try {
              const v = get && get();
              if (typeof v === 'string' && /\b0\.0\.[0-9]{3,}\b/.test(v)) return v;
            } catch (_) {}
          }
          // Regex fallback: scan page text for a Hedera account ID pattern
          try {
            const m = (document.body && document.body.innerText || '').match(/\b0\.0\.[0-9]{3,}\b/);
            if (m && m[0]) return m[0];
          } catch (_) {}
          return null;
        } catch (_) {
          return null;
        }
      }
    });
    return result || null;
  } catch (_) {
    return null;
  }
}

async function notarizeText(text, overrideAccountId) {
  const { apiUrl, accountId, activeAccountId, detectedAccountId } = await getSettings();
  const finalAccountId = overrideAccountId || activeAccountId || detectedAccountId || accountId || HARDCODED_ACCOUNT_ID;

  const payload = {
    accountId: finalAccountId,
    contentType: 'text',
    text,
    title: 'Web selection',
    tags: 'extension,selection,fact-check',
    mode: 'fact_check'
  };

  const res = await fetch(`${apiUrl}/api/notarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function notarizeImage(srcUrl, selectionText, overrideAccountId) {
  const { apiUrl, accountId, activeAccountId, detectedAccountId } = await getSettings();
  const finalAccountId = overrideAccountId || activeAccountId || detectedAccountId || accountId || HARDCODED_ACCOUNT_ID;

  // Fetch the image as a blob
  const resp = await fetch(srcUrl, { mode: 'cors' }).catch(() => null);
  if (!resp || !resp.ok) throw new Error('Unable to fetch image data');
  const blob = await resp.blob();

  if (blob.size > 10 * 1024 * 1024) {
    throw new Error('Image too large (>10MB) for analysis');
  }

  // Derive a filename from URL or fallback
  let filename = 'image';
  try {
    const u = new URL(srcUrl);
    const last = u.pathname.split('/').filter(Boolean).pop();
    if (last) filename = last;
  } catch (_) {}
  if (!/\.[a-z0-9]{2,5}$/i.test(filename)) {
    // add extension hint from MIME
    const ext = (blob.type && blob.type.split('/')[1]) ? blob.type.split('/')[1] : 'jpg';
    filename = `${filename}.${ext}`;
  }

  const form = new FormData();
  form.append('accountId', finalAccountId);
  form.append('contentType', 'image');
  form.append('file', blob, filename);
  if (selectionText && selectionText.trim()) {
    form.append('text', selectionText.trim());
  }
  form.append('title', 'Web image fact-check');
  form.append('tags', 'extension,image,fact-check');
  form.append('mode', 'fact_check');

  const res = await fetch(`${apiUrl}/api/notarize`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

function notify(title, message) {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title,
      message
    });
  } catch (_) {
    // notifications permission may be optional; ignore
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === 'hedera-notarize-selection') {
      if (!info.selectionText || !info.selectionText.trim()) {
        notify('Hedera Notary', 'No text selected. Highlight text and try again.');
        return;
      }
      notify('Hedera Notary', 'Analyzing selected text…');
      if (tab?.id) sendToTab(tab.id, { type: 'SHOW_ANALYSIS_STATUS', action: 'text' });
      // Ask for user prompt (optional)
      let userPrompt = '';
      if (tab?.id) {
        sendToTab(tab.id, { type: 'REQUEST_USER_PROMPT', defaultPrompt: 'Fact-check the selected text. Focus on claims, cite reputable sources.' });
        userPrompt = await new Promise((resolve) => {
          const handler = (msg) => {
            if (msg && msg.type === 'USER_PROMPT_RESPONSE') {
              try { chrome.runtime.onMessage.removeListener(handler); } catch (_) {}
              resolve(msg.prompt || '');
            }
          };
          chrome.runtime.onMessage.addListener(handler);
          setTimeout(() => {
            try { chrome.runtime.onMessage.removeListener(handler); } catch (_) {}
            resolve('');
          }, 15000);
        });
      }
      const pageAccountId = tab?.id ? await tryGetAccountIdFromTab(tab.id) : null;
      let result;
      try {
        const { apiUrl } = await getSettings();
        const finalAccountId = pageAccountId || HARDCODED_ACCOUNT_ID;
        const payload = {
          accountId: finalAccountId,
          contentType: 'text',
          text: info.selectionText.trim(),
          title: 'Web selection',
          tags: 'extension,selection,fact-check',
          mode: 'fact_check',
          prompt: userPrompt || ''
        };
        const res = await fetch(`${apiUrl}/api/notarize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `HTTP ${res.status}`);
        }
        result = await res.json();
      } catch (e) {
        if (tab?.id) sendToTab(tab.id, { type: 'SHOW_ANALYSIS_ERROR', error: e && e.message ? e.message : 'Unknown error' });
        throw e;
      }
      if (tab?.id) sendToTab(tab.id, { type: 'SHOW_ANALYSIS_RESULT', result });
      notify('Hedera Notary', `Text analyzed. CID: ${result.ipfsCid || 'n/a'}`);
      return;
    }
    if (info.menuItemId === 'hedera-analyze-image' && (info.srcUrl || info.srcUrl?.length)) {
      notify('Hedera Notary', 'Analyzing image…');
      if (tab?.id) sendToTab(tab.id, { type: 'SHOW_ANALYSIS_STATUS', action: 'image', details: (info.srcUrl || '') });
      // Ask for user prompt (optional)
      let userPrompt = '';
      if (tab?.id) {
        sendToTab(tab.id, { type: 'REQUEST_USER_PROMPT', defaultPrompt: 'Fact-check the image and any associated caption. Verify event, location, and date.' });
        userPrompt = await new Promise((resolve) => {
          const handler = (msg) => {
            if (msg && msg.type === 'USER_PROMPT_RESPONSE') {
              try { chrome.runtime.onMessage.removeListener(handler); } catch (_) {}
              resolve(msg.prompt || '');
            }
          };
          chrome.runtime.onMessage.addListener(handler);
          setTimeout(() => {
            try { chrome.runtime.onMessage.removeListener(handler); } catch (_) {}
            resolve('');
          }, 15000);
        });
      }
      const pageAccountId = tab?.id ? await tryGetAccountIdFromTab(tab.id) : null;
      let result;
      try {
        const { apiUrl } = await getSettings();
        const finalAccountId = pageAccountId || HARDCODED_ACCOUNT_ID;
        // Fetch image and submit as multipart with prompt
        const resp = await fetch(info.srcUrl, { mode: 'cors' }).catch(() => null);
        if (!resp || !resp.ok) throw new Error('Unable to fetch image data');
        const blob = await resp.blob();
        if (blob.size > 10 * 1024 * 1024) throw new Error('Image too large (>10MB) for analysis');
        let filename = 'image';
        try { const u = new URL(info.srcUrl); const last = u.pathname.split('/').filter(Boolean).pop(); if (last) filename = last; } catch (_) {}
        if (!/\.[a-z0-9]{2,5}$/i.test(filename)) {
          const ext = (blob.type && blob.type.split('/')[1]) ? blob.type.split('/')[1] : 'jpg';
          filename = `${filename}.${ext}`;
        }
        const form = new FormData();
        form.append('accountId', finalAccountId);
        form.append('contentType', 'image');
        form.append('file', blob, filename);
        if (info.selectionText && info.selectionText.trim()) form.append('text', info.selectionText.trim());
        form.append('title', 'Web image fact-check');
        form.append('tags', 'extension,image,fact-check');
        form.append('mode', 'fact_check');
        if (userPrompt) form.append('prompt', userPrompt);
        const res = await fetch(`${apiUrl}/api/notarize`, { method: 'POST', body: form });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `HTTP ${res.status}`);
        }
        result = await res.json();
      } catch (e) {
        if (tab?.id) sendToTab(tab.id, { type: 'SHOW_ANALYSIS_ERROR', error: e && e.message ? e.message : 'Unknown error' });
        throw e;
      }
      if (tab?.id) sendToTab(tab.id, { type: 'SHOW_ANALYSIS_RESULT', result });
      const hasImg = result?.internalProcessing?.imageAnalysis?.success;
      const label = hasImg ? (result.internalProcessing.imageAnalysis.best_guess_labels?.[0] || 'image') : 'image';
      notify('Hedera Notary', `Image analyzed (${label}). CID: ${result.ipfsCid || 'n/a'}`);
      return;
    }
  } catch (e) {
    notify('Hedera Notary failed', e && e.message ? e.message : 'Unknown error');
  }
});

// Message API from popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === 'NOTARIZE_TEXT') {
        const result = await notarizeText(msg.text || '');
        sendResponse({ ok: true, result });
        return;
      }
      if (msg?.type === 'GET_ACTIVE_ACCOUNT') {
        const { activeAccountId, detectedAccountId, accountId, activeAccountSource } = await getSettings();
        const finalId = activeAccountId || detectedAccountId || accountId || '';
        sendResponse({ ok: true, accountId: finalId, source: activeAccountId ? (activeAccountSource || 'paired') : (detectedAccountId ? 'detected' : 'stored') });
        return;
      }
      if (msg?.type === 'GET_SETTINGS') {
        const settings = await getSettings();
        sendResponse({ ok: true, settings });
        return;
      }
      if (msg?.type === 'SET_SETTINGS') {
        await chrome.storage.sync.set(msg.settings || {});
        sendResponse({ ok: true });
        return;
      }
      if (msg?.type === 'CLEAR_ACTIVE_ACCOUNT') {
        await chrome.storage.sync.set({ activeAccountId: '', activeAccountSource: '' });
        sendResponse({ ok: true });
        return;
      }
      if (msg?.type === 'CLEAR_ALL_ACCOUNTS') {
        await chrome.storage.sync.set({
          activeAccountId: '',
          activeAccountSource: '',
          detectedAccountId: '',
          accountId: ''
        });
        sendResponse({ ok: true });
        return;
      }
      sendResponse({ ok: false, error: 'unknown_message' });
    } catch (e) {
      sendResponse({ ok: false, error: e.message || 'error' });
    }
  })();
  return true; // async
});

// Listen to content script postMessages via chrome.runtime.onMessageExternal is not available here,
// use chrome.runtime.onMessage with content script forwarding via chrome.tabs.sendMessage if needed.
// Instead, capture page window messages by injecting a small bridge when context menu used.

// Global window message bridge: capture window messages from content script
chrome.runtime.onConnect.addListener(() => {});

// Fallback: capture detected accountId relayed via content script using chrome.runtime.onMessage
chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg && msg.type === 'ACCOUNT_DETECTED' && msg.accountId) {
    // Only set as detected if user hasn't explicitly paired
    const { activeAccountId } = await getSettings();
    if (!activeAccountId) {
      chrome.storage.sync.set({ detectedAccountId: msg.accountId });
    }
  }
});


