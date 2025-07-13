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
  twoFAPending = false;
  twoFAResolver = null;
  serverState.status = 'idle';
  serverState.error = null;
  serverState.value = null;
  let browser;
  let page;
  try {
    // Launch Chrome: headful if debug, else headless
    const launchOptions = { headless: !debug };
    // If running in Docker, disable sandbox (many containers disallow Chrome sandbox)
    if (process.env.CHROME_DISABLE_SANDBOX) {
      launchOptions.args = ['--no-sandbox', '--disable-setuid-sandbox'];
    }
    // Allow overriding Chromium executable (e.g. system Chromium in Docker)
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    browser = await puppeteer.launch(launchOptions);
    page = await browser.newPage();
    // Emulate mobile Safari user-agent for Aviva scraper
    await page.setUserAgent(
      process.env.AVIVA_USER_AGENT ||
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7_2 like Mac OS X) ' +
          'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1'
    );
    await page.setViewport({ width: 375, height: 812 });
    // Load cookies if available
    try {
      const cookiesJson = await fs.readFile(cookiesPath, 'utf8');
      const cookies = JSON.parse(cookiesJson);
      await page.setCookie(...cookies);
    } catch (_err) {
      /* ignore missing or invalid cookies */
    }
    // Navigate to login
    await page.goto('https://www.direct.aviva.co.uk/MyAccount/login', {
      waitUntil: 'networkidle2',
    });
    // Accept the OneTrust cookies banner if present
    try {
      // Wait briefly for the banner button to appear, then click
      await page.waitForSelector('#onetrust-accept-btn-handler', { timeout: 5000 });
      await page.click('#onetrust-accept-btn-handler');
    } catch (_err) {
      /* ignore if banner is not present or click fails */
    }
    // Fill credentials: wait for the login form to load
    await page.waitForSelector('#username', { timeout: 30000 });
    await page.type('#username', email);
    await page.type('#password', password);
    await page.click('#loginButton');
    // Wait for either 2FA prompt or main page
    try {
      await page.waitForSelector('#factor', { timeout: 5000 });
      // 2FA required: click the "Remember this device" checkbox if present
      try {
        await page.click('span.a-checkbox__label');
      } catch {
        /* ignore if checkbox not present */
      }
      serverState.status = 'awaiting-2fa';
      twoFAPending = true;
      let code;
      try {
        code = await new Promise((resolve, reject) => {
          twoFAResolver = resolve;
          setTimeout(() => reject(new Error('2FA timeout')), timeout * 1000);
        });
      } finally {
        twoFAPending = false;
        twoFAResolver = null;
      }
      await page.type('#factor', code);
      await page.click('#VerifyMFA');
    } catch (_err) {
      // no 2FA prompt, proceed
    }
    // Ensure we're logged in by checking for pension details element
    await page.waitForSelector('dl.detailsList', { timeout: 15000 });
    // Extract pension value text
    // Use the explicit data-qa-text attribute for the total account value
    const text = await page.$eval('dd[data-qa-text="total-account-value"]', (el) => el.textContent);
    const match = text.match(/£\s*([\d.,]+)/);
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
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { getPensionValue, submitTwoFACode, serverState };
