const { uiPageHtml } = require('../src/web-ui');

describe('uiPageHtml', () => {
  test('renders basic HTML with expected title and elements', () => {
    const html = uiPageHtml(false, null, true, false);
    expect(typeof html).toBe('string');
    expect(html).toMatch(/<title>actual-aviva-pension<\/title>/);
    expect(html).toMatch(/Authenticate Aviva|Reauthenticate Aviva/);
  });
});
