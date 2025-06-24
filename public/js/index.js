document.getElementById('saveBtn').onclick = async () => {
/* eslint-env browser */

// UI elements
const loginBtn = document.getElementById('loginBtn');
const twofaSection = document.getElementById('twofaSection');
const submit2faBtn = document.getElementById('submit2faBtn');
const loginStatus = document.getElementById('loginStatus');
const pensionValueEl = document.getElementById('pensionValue');
const accountSelect = document.getElementById('accountSelect');
const saveBtn = document.getElementById('saveBtn');
const syncBtn = document.getElementById('syncBtn');
const statusEl = document.getElementById('status');

let mapping = [];

/** Poll budget readiness then load data */
async function init() {
  // Download budget then load data
  try {
    const res = await fetch('/api/budget-status');
    const { ready } = await res.json();
    if (!ready) await new Promise(r => setTimeout(r, 1000));
  } catch {}
  // Load mapping and accounts
  await loadData();
}

/** Load mapping and account options, update UI based on Aviva login state */
async function loadData() {
  let res;
  try {
    res = await fetch('/api/data');
  } catch (err) {
    console.error('Failed to fetch /api/data', err);
    return;
  }
  const { mapping: map, accounts, aviva } = await res.json();
  mapping = map;
  // Populate account dropdown
  accountSelect.innerHTML = '<option value="">-- none --</option>' +
    accounts.map(a => `<option value="${a.id}"${mapping[0]?.accountId===a.id?' selected':''}>${a.name}</option>`).join('');
  // Update pension value if available
  if (aviva.status === 'logged-in') {
    pensionValueEl.textContent = aviva.value.toFixed(2);
  }
  // Update login UI
  if (aviva.status === 'awaiting-2fa') {
    twofaSection.style.display = 'block';
    loginStatus.textContent = 'Enter SMS 2FA code';
  } else if (aviva.status === 'logged-in') {
    loginStatus.textContent = 'Logged in';
  } else if (aviva.status === 'error') {
    loginStatus.textContent = 'Error: ' + aviva.error;
  }
}

// Trigger Aviva login flow
loginBtn.onclick = async () => {
  loginStatus.textContent = 'Logging in...';
  twofaSection.style.display = 'none';
  await fetch('/api/aviva/login', { method: 'POST' });
  pollStatus();
};

// Submit 2FA code
submit2faBtn.onclick = async () => {
  const code = document.getElementById('twofaCode').value;
  await fetch('/api/aviva/2fa', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ code }),
  });
  pollStatus();
};

// Poll login status until logged-in or error
async function pollStatus() {
  const { status, error } = await (await fetch('/api/aviva/status')).json();
  if (status === 'awaiting-2fa') {
    twofaSection.style.display = 'block';
    loginStatus.textContent = 'Enter SMS 2FA code';
  } else if (status === 'logged-in') {
    loginStatus.textContent = 'Logged in';
    await loadData();
  } else if (status === 'error') {
    loginStatus.textContent = 'Error: ' + error;
  } else {
    setTimeout(pollStatus, 1000);
  }
}

// Save mapping
saveBtn.onclick = async () => {
  statusEl.textContent = 'Saving mapping...';
  const newMap = [ { accountId: accountSelect.value, lastBalance: mapping[0]?.lastBalance || 0 } ];
  const res = await fetch('/api/mappings', {
    method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(newMap),
  });
  if (res.ok) {
    statusEl.textContent = 'Mapping saved.';
  } else {
    statusEl.textContent = 'Error saving mapping';
  }
};

// Sync now
syncBtn.onclick = async () => {
  syncBtn.disabled = true;
  statusEl.textContent = 'Syncing...';
  try {
    const res = await fetch('/api/sync', { method: 'POST' });
    const { count } = await res.json();
    statusEl.textContent = `Synced ${count} transaction(s)`;
  } catch (err) {
    statusEl.textContent = 'Error syncing: ' + err.message;
  } finally {
    syncBtn.disabled = false;
  }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
loadData(false);
waitForBudgetThenLoad();
