const fs = require('fs');
const path = require('path');
const os = require('os');
// Mock budget open/close to avoid external API calls
jest.mock('../src/utils', () => ({
  openBudget: jest.fn().mockResolvedValue(),
  closeBudget: jest.fn().mockResolvedValue(),
}));
const { runSync } = require('../src/sync');
const avivaClient = require('../src/aviva-client');
const api = require('@actual-app/api');

jest.mock('../src/aviva-client');
jest.mock('@actual-app/api');

describe('runSync', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mapping-'));
    process.env.MAPPING_FILE = path.join(tmpDir, 'mapping.json');
    // reset mocks
    avivaClient.getPensionValue.mockReset();
    api.getAccountBalance.mockReset();
    api.addTransactions.mockReset();
    api.getAccounts.mockReset();
    // prepare a mapping file with one account entry
    const mappingPath = path.resolve(process.cwd(), process.env.MAPPING_FILE);
    fs.mkdirSync(path.dirname(mappingPath), { recursive: true });
    fs.writeFileSync(
      mappingPath,
      JSON.stringify([{ accountId: 'acct-1', lastBalance: 0 }], null, 2)
    );
    // mock Actual Budget accounts list to include our mapping account
    api.getAccounts.mockResolvedValue([{ id: 'acct-1' }]);
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('adds a transaction when pension value changes', async () => {
    avivaClient.getPensionValue.mockResolvedValue(1000);
    // api.getAccountBalance returns minor units (pence), so 90000 pence = £900
    api.getAccountBalance.mockResolvedValue(90000);
    api.addTransactions.mockResolvedValue();
    const count = await runSync({ verbose: false });
    expect(count).toBe(1);
    expect(api.addTransactions).toHaveBeenCalled();
    // amount should be converted from pounds to minor units (pence)
    const [acctId, txs] = api.addTransactions.mock.calls[0];
    expect(acctId).toBe('acct-1');
    expect(txs).toHaveLength(1);
    expect(txs[0].amount).toBe(10000);
  });
});
