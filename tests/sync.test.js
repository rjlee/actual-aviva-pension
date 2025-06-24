const { runSync } = require('../src/sync');
const avivaClient = require('../src/aviva-client');
const api = require('@actual-app/api');

jest.mock('../src/aviva-client');
jest.mock('@actual-app/api');

describe('runSync', () => {
  beforeEach(() => {
    // clear any mapping file or state
    avivaClient.getPensionValue.mockReset();
    api.getAccountBalance.mockReset();
    api.addTransactions.mockReset();
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