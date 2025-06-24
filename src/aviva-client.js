const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');

// In-memory coordination for awaiting 2FA code from UI
let twoFAPending = false;
let twoFAResolver;
const serverState = {
  status: 'idle', // 'idle' | 'awaiting-2fa' | 'logged-in' | 'error'
  error: null,
  value: null,
};

/**
 * Submit SMS 2FA code from UI to resume login.
 * @param {string} code
 */
function submitTwoFACode(code) {
  if (twoFAPending && twoFAResolver) {
    twoFAResolver(code);
  }
}

/**
 * Fetch the pension value from Aviva via headless browser, handling login and 2FA.
 * @param {{email: string, password: string, cookiesPath: string, timeout: number}} opts
 * @returns {Promise<number>} pension value as a float
 */
async function getPensionValue({ email, password, cookiesPath, timeout = 60, debug = false }) {
  serverState.status = 'idle';
  serverState.error = null;
  serverState.value = null;
  let browser;
  try {
    // Launch Chrome: headful if debug, else headless with sandbox disabled
    browser = await puppeteer.launch({
      headless: !debug,
      args: debug
        ? []
        : ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    // Load cookies if available
    try {
      const cookiesJson = await fs.readFile(cookiesPath, 'utf8');
      const cookies = JSON.parse(cookiesJson);
      await page.setCookie(...cookies);
    } catch (_err) {
      /* ignore missing or invalid cookies */
    }
    // Navigate to login
    await page.goto('https://www.direct.aviva.co.uk/MyAccount/login', { waitUntil: 'networkidle2' });
    // Accept cookies banner if present
    try {
      // Puppeteer XPath selector for a button containing the exact banner text
      const [acceptBtn] = await page.$x(
        "//button[contains(normalize-space(.), 'Accept all cookies')]"
      );
      if (acceptBtn) await acceptBtn.click();
    } catch (_err) {
      /* ignore cookie banner errors */
    }
    // Fill credentials
    await page.type('#username', email);
    await page.type('#password', password);
    await page.click('#loginButton');
    // Wait for either 2FA prompt or main page
    try {
      await page.waitForSelector('#factor', { timeout: 5000 });
      // 2FA required
      serverState.status = 'awaiting-2fa';
      twoFAPending = true;
      const code = await new Promise((resolve, reject) => {
        twoFAResolver = resolve;
        setTimeout(() => reject(new Error('2FA timeout')), timeout * 1000);
      });
      twoFAPending = false;
      await page.type('#factor', code);
      await page.click('#VerifyMFA');
    } catch (_err) {
      // no 2FA prompt, proceed
    }
    // Ensure we're logged in by checking for pension details element
    await page.waitForSelector('dl.detailsList', { timeout: 15000 });
    // Extract pension value text
    const text = await page.$eval('dl.detailsList', (el) => el.textContent);
    const match = text.match(/£([\d.,]+)/);
    if (!match) throw new Error('Pension value not found');
    const value = parseFloat(match[1].replace(/,/g, ''));
    // Logout and save cookies
    await page.goto('https://www.direct.aviva.co.uk/MyAccount/Logout/LogMeOut');
    const cookies = (await page.cookies()) || [];
    await fs.mkdir(path.dirname(cookiesPath), { recursive: true });
    await fs.writeFile(cookiesPath, JSON.stringify(cookies, null, 2));
    serverState.status = 'logged-in';
    serverState.value = value;
    return value;
  } catch (err) {
    serverState.status = 'error';
    serverState.error = err.message;
    throw err;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { getPensionValue, submitTwoFACode, serverState };