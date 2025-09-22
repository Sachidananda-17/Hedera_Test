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


// Overlay UI to display analysis results from background
(() => {
  const OVERLAY_ID = 'hedera-notary-overlay';
  const STYLE_ID = 'hedera-notary-overlay-style';
  let lastAction = null;
  let lastImageSrc = null;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes hn-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes hn-pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
      #${OVERLAY_ID} { position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; width: 380px; max-width: calc(100vw - 40px); background: #0b0b0c; color: #f2f2f2; border: 1px solid #2a2a2c; box-shadow: 0 10px 28px rgba(0,0,0,0.5); border-radius: 14px; overflow: hidden; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"; animation: hn-fade-in 180ms ease-out; }
      #${OVERLAY_ID} .hn-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: #111113; border-bottom: 1px solid #2a2a2c; }
      #${OVERLAY_ID} .hn-title { font-weight: 700; font-size: 13px; letter-spacing: 0.3px; color: #ffffff; }
      #${OVERLAY_ID} .hn-actions { display: flex; gap: 6px; }
      #${OVERLAY_ID} .hn-btn { background: #1a1a1c; color: #f7f7f7; border: 1px solid #2d2d2f; padding: 4px 8px; border-radius: 8px; cursor: pointer; font-size: 12px; transition: background 120ms ease, transform 120ms ease; }
      #${OVERLAY_ID} .hn-btn:hover { background: #222224; transform: translateY(-1px); }
      #${OVERLAY_ID} .hn-body { max-height: 54vh; overflow: auto; padding: 12px; }
      #${OVERLAY_ID} .hn-meta { font-size: 12px; color: #bdbdbf; margin-top: 6px; }
      #${OVERLAY_ID} .hn-pill { display: inline-block; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 999px; background: #141416; border: 1px solid #2e2e30; margin-right: 6px; color: #e9e9ea; }
      #${OVERLAY_ID} .hn-url { display: flex; align-items: center; gap: 8px; font-size: 12px; word-break: break-all; background: #0f0f11; padding: 8px 10px; border-radius: 8px; border: 1px solid #262628; margin-top: 6px; }
      #${OVERLAY_ID} .hn-url a { color: #e6e6e8; text-decoration: none; }
      #${OVERLAY_ID} .hn-url a:hover { text-decoration: underline; }
      #${OVERLAY_ID} .hn-linkicon { width: 14px; height: 14px; display: inline-block; color: #cfcfd1; }
      #${OVERLAY_ID} .hn-error { color: #ffb3b3; }
      #${OVERLAY_ID} .hn-muted { color: #b3b3b5; }
      #${OVERLAY_ID} .hn-section { margin-top: 8px; }
      #${OVERLAY_ID} .hn-footer { padding: 8px 12px; border-top: 1px solid #2a2a2c; background: #111113; font-size: 11px; color: #bdbdbf; }
      #${OVERLAY_ID}.hn-loading .hn-body { animation: hn-pulse 1.6s ease-in-out infinite; }
      `;
    document.documentElement.appendChild(style);
  }

  function ensureOverlay() {
    let el = document.getElementById(OVERLAY_ID);
    if (el) return el;
    ensureStyle();
    el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.innerHTML = `
      <div class="hn-header">
        <div class="hn-title">Hedera Notary</div>
        <div class="hn-actions">
          <button class="hn-btn" data-action="min">Min</button>
          <button class="hn-btn" data-action="close">Close</button>
        </div>
      </div>
      <div class="hn-body"><div class="hn-muted">Ready.</div></div>
      <div class="hn-footer">Fact-checking with Hedera + IPFS</div>
    `;
    document.documentElement.appendChild(el);
    el.querySelector('[data-action="close"]').addEventListener('click', () => el.remove());
    el.querySelector('[data-action="min"]').addEventListener('click', () => {
      const body = el.querySelector('.hn-body');
      const footer = el.querySelector('.hn-footer');
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? '' : 'none';
      footer.style.display = isHidden ? '' : 'none';
    });
    return el;
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderLinkIcon() {
    return '<svg class="hn-linkicon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 3h7v7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M10 14L21 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M21 14v7h-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M3 10V3h7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
  }

  function asLink(url) {
    const safe = escapeHtml(url);
    const icon = renderLinkIcon();
    return `<div class="hn-url">${icon}<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a></div>`;
  }

  function pickAiOutput(data) {
    try {
      const ai = data?.internalProcessing?.aiAnalysis?.agentKit;
      if (!ai) return '';
      if (typeof ai === 'string') return ai;
      if (ai.output?.output) return ai.output.output;
      if (ai.output) return ai.output;
      return '';
    } catch (_) { return ''; }
  }

  function formatResultHtml(data) {
    const cid = data?.ipfsCid || '';
    const hederaUrl = data?.hederaExplorerUrl || '';
    const ipfsUrl = data?.ipfsGatewayUrl || '';
    const ipfsAlt = data?.alternativeIPFSUrls || [];
    const verification = data?.internalProcessing?.verificationStatus || {};
    const imageAnalysis = data?.internalProcessing?.imageAnalysis;
    const aiText = pickAiOutput(data);

    let html = '';
    if (aiText) {
      html += `<div>${escapeHtml(aiText)}</div>`;
    } else if (imageAnalysis?.success) {
      const label = imageAnalysis.best_guess_labels?.[0] || 'image';
      html += `<div>Image analysis: ${escapeHtml(label)}</div>`;
    } else {
      html += `<div>Notarization complete.</div>`;
    }
    html += `<div class="hn-section hn-meta"><span class="hn-pill">CID</span> ${escapeHtml(cid || 'n/a')}</div>`;
    if (ipfsUrl) html += asLink(ipfsUrl);
    if (ipfsAlt && ipfsAlt.length) {
      for (const u of ipfsAlt.slice(0, 2)) html += asLink(u);
    }
    if (hederaUrl) html += asLink(hederaUrl);
    if (typeof verification.ipfsAccessible === 'boolean') {
      html += `<div class="hn-meta">IPFS: ${verification.ipfsAccessible ? 'Accessible' : 'Pending'}</div>`;
    }
    return html;
  }

  function showStatus(kind, details) {
    const host = ensureOverlay();
    const body = host.querySelector('.hn-body');
    const action = (kind === 'image') ? 'image' : 'text';
    const label = action === 'image' ? 'Analyzing image…' : 'Analyzing selected text…';
    const extra = details ? `<div class="hn-meta">${escapeHtml(details)}</div>` : '';
    body.innerHTML = `<div>${label}</div>${extra}`;
    host.classList.add('hn-loading');
    lastAction = action;
    lastImageSrc = action === 'image' ? (details || null) : null;
  }

  function showError(msg) {
    const host = ensureOverlay();
    const body = host.querySelector('.hn-body');
    body.innerHTML = `<div class="hn-error">${escapeHtml(msg || 'Unknown error')}</div>`;
    host.classList.remove('hn-loading');
  }

  function showResult(data) {
    const host = ensureOverlay();
    const body = host.querySelector('.hn-body');
    body.innerHTML = formatResultHtml(data);
    host.classList.remove('hn-loading');
  }

  function getMetaContent(selector) {
    const m = document.querySelector(selector);
    return m && m.getAttribute('content') ? m.getAttribute('content').trim() : '';
  }

  function findImageCaption(imgEl) {
    if (!imgEl) return '';
    const fig = imgEl.closest('figure');
    if (fig) {
      const cap = fig.querySelector('figcaption');
      if (cap && cap.textContent) return cap.textContent.trim();
    }
    const candidates = [];
    const parent = imgEl.parentElement;
    if (parent) {
      for (const el of parent.children) {
        const cls = (el.className || '').toString();
        if (/(caption|credit|description)/i.test(cls) && el.textContent) candidates.push(el.textContent.trim());
      }
    }
    return candidates[0] || '';
  }

  function findImageElementBySrc(src) {
    if (!src) return null;
    const imgs = Array.from(document.images || []);
    const match = imgs.find(img => img.currentSrc === src || img.src === src || img.getAttribute('src') === src || img.getAttribute('data-src') === src);
    return match || null;
  }

  function generateSuggestedPrompt() {
    try {
      const title = document.title || '';
      const ogTitle = getMetaContent('meta[property="og:title"]');
      const description = getMetaContent('meta[name="description"]') || getMetaContent('meta[property="og:description"]');
      const selection = (window.getSelection && window.getSelection().toString().trim()) || '';

      if (lastAction === 'text') {
        const topic = selection || ogTitle || title;
        const desc = description || '';
        const pieces = [
          topic ? `Fact-check this claim: "${topic.slice(0, 240)}".` : 'Fact-check the selected text.',
          desc ? `Use page context: ${desc.slice(0, 180)}.` : null,
          'Verify dates, locations, and entities. Cite 3-5 reputable sources.'
        ].filter(Boolean);
        return pieces.join(' ');
      }

      if (lastAction === 'image') {
        const img = findImageElementBySrc(lastImageSrc);
        const alt = img?.getAttribute('alt')?.trim() || img?.getAttribute('aria-label')?.trim() || img?.title || '';
        const cap = findImageCaption(img);
        const about = alt || cap || ogTitle || title;
        const pieces = [
          about ? `Fact-check this image purportedly about "${about.slice(0, 200)}".` : 'Fact-check this image.',
          'Identify the event, date, and location. Detect miscaptioning or reuse from other events.',
          description ? `Use page context: ${description.slice(0, 160)}.` : null,
          'Cite 3-5 reputable sources; prefer primary or official records.'
        ].filter(Boolean);
        return pieces.join(' ');
      }

      return 'Fact-check the content. Verify claims with reputable sources and cite them.';
    } catch (_) {
      return 'Fact-check the content. Verify claims with reputable sources and cite them.';
    }
  }

  try {
    chrome.runtime.onMessage.addListener((msg) => {
      try {
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'SHOW_ANALYSIS_STATUS') {
          showStatus(msg.action, msg.details || '');
        } else if (msg.type === 'SHOW_ANALYSIS_RESULT') {
          showResult(msg.result || {});
        } else if (msg.type === 'SHOW_ANALYSIS_ERROR') {
          showError(msg.error || 'Error');
        } else if (msg.type === 'REQUEST_USER_PROMPT') {
          // Render a small modal to get user prompt
          const host = ensureOverlay();
          const body = host.querySelector('.hn-body');
          const suggested = generateSuggestedPrompt();
          const defaultText = suggested || msg.defaultPrompt || '';
          body.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div>Enter instructions for analysis/fact-check (optional):</div>
              <textarea id="hn-prompt" rows="3" style="width:100%; background:#0f0f11; color:#f2f2f2; border:1px solid #262628; border-radius:8px; padding:8px;">${defaultText.replace(/</g,'&lt;')}</textarea>
              <div style="display:flex; gap:8px; justify-content:flex-end;">
                <button id="hn-cancel" class="hn-btn">Skip</button>
                <button id="hn-ok" class="hn-btn">Use Prompt</button>
              </div>
            </div>
          `;
          const send = (val) => {
            try { chrome.runtime.sendMessage({ type: 'USER_PROMPT_RESPONSE', prompt: val || '' }); } catch (_) {}
          };
          const ok = body.querySelector('#hn-ok');
          const cancel = body.querySelector('#hn-cancel');
          const ta = body.querySelector('#hn-prompt');
          ok?.addEventListener('click', () => send(ta?.value || ''));
          cancel?.addEventListener('click', () => send(''));
        }
      } catch (_) {}
    });
  } catch (_) {}
})();

