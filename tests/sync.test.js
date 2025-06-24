const fs = require('fs');
const path = require('path');
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
  beforeEach(() => {
    // reset mocks
    avivaClient.getPensionValue.mockReset();
    api.getAccountBalance.mockReset();
    api.addTransactions.mockReset();
    api.getAccounts.mockReset();
    // prepare a mapping file with one account entry
    const mappingPath = path.resolve(
      process.cwd(),
      process.env.MAPPING_FILE || './data/mapping.json'
    );
    fs.mkdirSync(path.dirname(mappingPath), { recursive: true });
    fs.writeFileSync(
      mappingPath,
      JSON.stringify([{ accountId: 'acct-1', lastBalance: 0 }], null, 2)
    );
    // mock Actual Budget accounts list to include our mapping account
    api.getAccounts.mockResolvedValue([{ id: 'acct-1' }]);
  });

  it('adds a transaction when pension value changes', async () => {
    avivaClient.getPensionValue.mockResolvedValue(1000);
    api.getAccountBalance.mockResolvedValue(900);
    api.addTransactions.mockResolvedValue();
    const count = await runSync({ verbose: false });
    expect(count).toBe(1);
    expect(api.addTransactions).toHaveBeenCalled();
  });
});