const DEFAULT_API_URL = 'http://localhost:3001';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'hedera-notarize-selection',
    title: 'Notarize selection with Hedera Notary',
    contexts: ['selection']
  });
});

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
          return (
            (window && (window.hederaAccountId || window.connectedAccountId)) ||
            (window && window.wallet && window.wallet.accountId) ||
            null
          );
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
  const finalAccountId = overrideAccountId || activeAccountId || detectedAccountId || accountId;
  if (!finalAccountId) {
    throw new Error('No Hedera account. Connect on page or set in options.');
  }

  const payload = {
    accountId: finalAccountId,
    contentType: 'text',
    text,
    title: 'Web selection',
    tags: 'extension,selection'
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
  if (info.menuItemId === 'hedera-notarize-selection' && info.selectionText) {
    try {
      const pageAccountId = tab?.id ? await tryGetAccountIdFromTab(tab.id) : null;
      const result = await notarizeText(info.selectionText.trim(), pageAccountId || undefined);
      notify('Hedera Notary', `CID: ${result.ipfsCid || 'n/a'}`);
    } catch (e) {
      notify('Hedera Notary failed', e.message || 'Unknown error');
    }
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


