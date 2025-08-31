const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');

jest.mock('@actual-app/api');
jest.mock('../src/utils');
jest.mock('../src/sync');

const api = require('@actual-app/api');
const utils = require('../src/utils');
const sync = require('../src/sync');
const { createApp } = require('../src/web-ui');

describe('Web UI session-based authentication', () => {
  let app;
  const OLD_ENV = { ...process.env };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mapping-'));
  beforeAll(async () => {
    utils.openBudget.mockResolvedValue();
    utils.closeBudget.mockResolvedValue();
    api.getAccounts.mockResolvedValue([]);
    sync.runSync.mockResolvedValue(0);
    process.env.DATA_DIR = tmpDir;
    process.env.ACTUAL_PASSWORD = 'secret';
    delete process.env.UI_AUTH_ENABLED; // default to session auth on
    app = createApp(false, false);
  });

  afterAll(() => {
    // no server to close when testing app directly
    process.env = { ...OLD_ENV };
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('shows login form for unauthenticated users', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/<h2[^>]*>Login<\/h2>/);
  });

  it('rejects invalid login attempts', async () => {
    const res = await request(app)
      .post('/login')
      .send('password=wrong')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(401);
    expect(res.text).toMatch(/Invalid password/);
  });

  it('authenticates valid password and allows access', async () => {
    const login = await request(app)
      .post('/login?next=/')
      .send('password=secret')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(login.status).toBe(302);
    const cookies = login.headers['set-cookie'];
    const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');
    const res2 = await request(app).get('/').set('Cookie', cookieHeader);
    expect(res2.status).toBe(200);
    expect(res2.text).toMatch(/actual-aviva-pension/);
  });

  it('logs out and redirects to login', async () => {
    const login = await request(app)
      .post('/login?next=/')
      .send('password=secret')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    const cookies = login.headers['set-cookie'];
    const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');
    const res = await request(app).post('/logout').set('Cookie', cookieHeader);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
    const res3 = await request(app).get('/login');
    expect(res3.status).toBe(200);
    expect(res3.text).toMatch(/<h2[^>]*>Login<\/h2>/);
  });
});
