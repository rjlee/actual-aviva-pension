const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Stub out external modules
jest.mock('@actual-app/api');
jest.mock('../src/utils');
jest.mock('../src/sync');
jest.mock('../src/aviva-client', () => ({
  getPensionValue: jest.fn().mockResolvedValue(),
  submitTwoFACode: jest.fn(),
  serverState: { status: 'idle', error: null, value: null },
}));

const api = require('@actual-app/api');
const utils = require('../src/utils');
const sync = require('../src/sync');
const avivaClient = require('../src/aviva-client');
const { createApp } = require('../src/web-ui');

describe('Web UI server', () => {
  let app;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mapping-'));
  const mappingFile = path.join(tmpDir, 'mapping.json');

  beforeAll(async () => {
    // Prepare mapping file env
    process.env.DATA_DIR = tmpDir;
    // Ensure utils.openBudget resolves and sets budgetReady
    utils.openBudget.mockResolvedValue();
    utils.closeBudget.mockResolvedValue();
    // Stub Actual API accounts
    api.getAccounts.mockResolvedValue([{ id: 'acct-123', name: 'Test Account' }]);
    // Start server without auth
    process.env.UI_AUTH_ENABLED = 'false';
    app = createApp(false, false);
  });

  afterAll(() => {
    // no server to close when testing app directly
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_err) {
      /* ignore cleanup errors */
    }
  });

  test('GET /api/budget-status returns readiness', async () => {
    // wait for openBudget to settle
    await new Promise((r) => setTimeout(r, 0));
    const res = await request(app).get('/api/budget-status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ready', true);
  });

  test('GET /api/data returns mapping, accounts, aviva state', async () => {
    // Create initial mapping file
    fs.writeFileSync(mappingFile, JSON.stringify([{ accountId: 'acct-123', lastBalance: 0 }]));
    const res = await request(app).get('/api/data');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      mapping: [{ accountId: 'acct-123', lastBalance: 0 }],
      accounts: [{ id: 'acct-123', name: 'Test Account' }],
      aviva: { status: avivaClient.serverState.status },
    });
  });

  test('POST /api/mappings writes mapping file', async () => {
    const newMap = [{ accountId: 'acct-123', lastBalance: 100 }];
    const res = await request(app)
      .post('/api/mappings')
      .send(newMap)
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    const saved = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
    expect(saved).toEqual(newMap);
  });

  test('POST /api/sync triggers sync and returns count', async () => {
    sync.runSync.mockResolvedValue(5);
    const res = await request(app).post('/api/sync');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 5 });
  });

  test('GET / serves HTML', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/actual-aviva-pension/);
    expect(res.text).toMatch(/<script src="\/js\/index.js"><\/script>/);
  });

  test('GET / shows Authenticate/Reauthenticate Aviva button in primary style', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    // Button should use primary (blue) style and correct text
    expect(res.text).toMatch(/Authenticate Aviva|Reauthenticate Aviva/);
    expect(res.text).toMatch(/btn btn-primary/);
  });

  test('GET /api/data skips accounts when budget not loaded', async () => {
    // Simulate API throwing 'No budget file is open'
    api.getAccounts.mockRejectedValue(new Error('No budget file is open'));
    fs.writeFileSync(mappingFile, JSON.stringify([]));
    const res = await request(app).get('/api/data');
    expect(res.status).toBe(200);
    expect(res.body.accounts).toEqual([]);
  });

  test('POST /api/aviva/login returns current aviva status', async () => {
    // Simulate pending 2FA status
    avivaClient.serverState.status = 'awaiting-2fa';
    const res = await request(app).post('/api/aviva/login');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'awaiting-2fa' });
  });

  test('POST /api/aviva/2fa submits code and returns status', async () => {
    avivaClient.serverState.status = 'logged-in';
    const res = await request(app).post('/api/aviva/2fa').send({ code: '123456' });
    expect(avivaClient.submitTwoFACode).toHaveBeenCalledWith('123456');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'logged-in' });
  });

  test('GET /api/aviva/status returns aviva client state', async () => {
    // Mutate existing serverState so web-ui closure sees the change
    Object.assign(avivaClient.serverState, { status: 'idle', error: null, value: null });
    const res = await request(app).get('/api/aviva/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'idle', error: null, value: null });
  });
});
