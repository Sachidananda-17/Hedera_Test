const apiUrlEl = document.getElementById('apiUrl');
const accountIdEl = document.getElementById('accountId');
const saveBtn = document.getElementById('save');
const wcProjectIdEl = document.getElementById('wcProjectId');

function load() {
  chrome.storage.sync.get({ apiUrl: 'http://localhost:3001', accountId: '', wcProjectId: '' }, (data) => {
    apiUrlEl.value = data.apiUrl;
    accountIdEl.value = data.accountId;
    wcProjectIdEl.value = data.wcProjectId;
  });
}

function save() {
  chrome.storage.sync.set({
    apiUrl: (apiUrlEl.value || '').trim() || 'http://localhost:3001',
    accountId: (accountIdEl.value || '').trim(),
    wcProjectId: (wcProjectIdEl.value || '').trim()
  }, () => {
    saveBtn.textContent = 'Saved!';
    setTimeout(() => (saveBtn.textContent = 'Save'), 1000);
  });
}

document.addEventListener('DOMContentLoaded', load);
saveBtn.addEventListener('click', save);
