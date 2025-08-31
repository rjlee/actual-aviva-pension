/** @type {import('jest').Config} */
module.exports = (() => {
  const unitOnly = process.env.UNIT_ONLY === 'true';
  /** @type {import('jest').Config} */
  const cfg = {
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/tests'],
    collectCoverage: !unitOnly,
    coverageDirectory: 'coverage',
    testMatch: ['**/tests/**/*.test.js'],
  };
  if (!unitOnly) {
    cfg.coverageThreshold = {
      global: { branches: 50, functions: 60, lines: 80, statements: 80 },
    };
  }
  if (unitOnly) {
    // Exclude UI integration tests that require binding sockets
    cfg.testPathIgnorePatterns = [
      '/tests/web-ui\\.test\\.js$',
      '/tests/web-ui-session-auth\\.test\\.js$',
    ];
  }
  return cfg;
})();
