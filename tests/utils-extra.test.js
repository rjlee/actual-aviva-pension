const { __resetBudgetDownloadFlag } = require('../src/utils');

describe('__resetBudgetDownloadFlag', () => {
  it('is callable without throwing', () => {
    expect(() => __resetBudgetDownloadFlag()).not.toThrow();
  });
});
