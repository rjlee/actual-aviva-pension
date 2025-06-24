const puppeteer = require('puppeteer');
const { getPensionValue } = require('../src/aviva-client');

jest.mock('puppeteer');

describe('Aviva Client', () => {
  let browser;
  let page;

  beforeEach(() => {
    page = {
      goto: jest.fn(),
      setCookie: jest.fn(),
      reload: jest.fn(),
      waitForSelector: jest.fn(),
      click: jest.fn(),
      type: jest.fn(),
      $eval: jest.fn(),
      cookies: jest.fn().mockResolvedValue([]),
      close: jest.fn()
    };
    browser = {
      newPage: jest.fn().mockResolvedValue(page),
      close: jest.fn()
    };
    puppeteer.launch = jest.fn().mockResolvedValue(browser);
  });

  it('should scrape pension value and return a number', async () => {
    page.$eval.mockResolvedValue('£1,234.56');
    const value = await getPensionValue({ email: 'x', password: 'y', cookiesPath: '/tmp/foo', timeout: 1 });
    expect(typeof value).toBe('number');
    expect(value).toBeCloseTo(1234.56);
    expect(browser.newPage).toHaveBeenCalled();
    expect(browser.close).toHaveBeenCalled();
  });
});