// Module: market-intelligence | Owner: bmc-dev | Created: 2026-07-04
// Playwright-backed SERP extraction (Google → Bing fallback) for keyword monitor.

import pino from 'pino';

/** Lazy-load playwright so Cloud Run boots without Chromium installed. */
async function getChromium() {
  const { chromium } = await import('playwright');
  return chromium;
}

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const SKIP_HOST_RE = /(^|\.)google\.|gstatic\.|googleusercontent\.|youtube\.com$|webcache\.|accounts\.google|(^|\.)bing\.com$|(^|\.)microsoft\.com$|(^|\.)duckduckgo\.com$/;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export function buildChromiumLaunchOptions(timeout = 20_000) {
  const opts = {
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
    timeout,
  };
  if (process.env.CHROMIUM_EXECUTABLE_PATH) {
    opts.executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  }
  return opts;
}

export function normalizeDomain(host) {
  return String(host || '').toLowerCase().replace(/^www\./, '');
}

/** Decode Bing /ck/a redirect wrappers (u=a1<base64>). */
export function decodeBingRedirectUrl(href) {
  if (!href || typeof href !== 'string') return null;
  const m = href.match(/[?&]u=a1([^&]+)/);
  if (!m) return href.startsWith('http') ? href : null;
  try {
    return Buffer.from(m[1], 'base64').toString('utf8');
  } catch {
    return null;
  }
}

export function extractDomainsFromUrls(urls, limit = 10) {
  const domains = [];
  const seen = new Set();
  for (const raw of urls) {
    if (domains.length >= limit) break;
    try {
      const host = normalizeDomain(new URL(raw).hostname);
      if (!host || SKIP_HOST_RE.test(host) || seen.has(host)) continue;
      seen.add(host);
      domains.push(host);
    } catch {
      /* skip */
    }
  }
  return domains;
}

async function dismissConsent(page) {
  const selectors = [
    'button:has-text("Aceptar todo")',
    'button:has-text("Accept all")',
    'button:has-text("Rechazar todo")',
    'button:has-text("Reject all")',
    '#L2AGLb',
    'form[action*="consent"] button',
  ];
  for (const sel of selectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 800 })) {
        await btn.click({ timeout: 2000 });
        await page.waitForTimeout(600);
        return;
      }
    } catch {
      /* try next */
    }
  }
}

async function collectGoogleHrefs(page) {
  return page.evaluate(() => {
    const out = [];
    const root = document.querySelector('#rso') || document.querySelector('#search');
    if (!root) return out;
    root.querySelectorAll('a[href]').forEach((a) => {
      const href = a.href;
      if (href && href.startsWith('http')) out.push(href);
    });
    return out;
  });
}

async function collectBingHrefs(page) {
  const raw = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#b_results li.b_algo h2 a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (href) out.push(href);
    });
    return out;
  });
  return raw
    .map((href) => decodeBingRedirectUrl(href.startsWith('http') ? href : `https://www.bing.com${href}`))
    .filter(Boolean);
}

export class KeywordSerpSession {
  constructor() {
    this.browser = null;
    this.page = null;
    this.engine = null;
  }

  async init() {
    if (this.page) return this;
    const chromium = await getChromium();
    const launchOpts = buildChromiumLaunchOptions(20_000);
    try {
      this.browser = await chromium.launch(launchOpts);
    } catch {
      this.browser = await chromium.launch({ channel: 'chrome', headless: true, timeout: 15_000 });
    }
    this.page = await this.browser.newPage({
      userAgent: USER_AGENT,
      locale: 'es-UY',
      viewport: { width: 1366, height: 900 },
    });
    return this;
  }

  async _fetchGoogle(query, { hl, gl }) {
    const page = this.page;
    const gUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&num=15&pws=0`;
    await page.goto(gUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await dismissConsent(page);
    await page.waitForSelector('#rso, #search', { timeout: 12000 }).catch(() => null);
    await page.waitForTimeout(1500);
    const currentUrl = page.url();
    if (currentUrl.includes('/sorry') || currentUrl.includes('captcha')) {
      throw new Error('google captcha');
    }
    const hrefs = await collectGoogleHrefs(page);
    const domains = extractDomainsFromUrls(hrefs);
    if (!domains.length) throw new Error('google empty');
    return { domains, engine: 'google' };
  }

  async _fetchBing(query, { hl, gl }) {
    const page = this.page;
    const bUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&cc=${gl}&setlang=${hl}&count=15`;
    await page.goto(bUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#b_results, ol#b_results', { timeout: 12000 }).catch(() => null);
    await page.waitForTimeout(1200);
    const hrefs = await collectBingHrefs(page);
    const domains = extractDomainsFromUrls(hrefs);
    if (!domains.length) throw new Error('bing empty');
    return { domains, engine: 'bing' };
  }

  async fetchDomains(query, { hl = 'es', gl = 'uy' } = {}) {
    await this.init();
    const maxAttempts = Number(process.env.KEYWORD_MONITOR_SERP_RETRIES ?? 3);
    let lastErr = 'serp empty';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this._fetchGoogle(query, { hl, gl });
        this.engine = result.engine;
        return result;
      } catch (gErr) {
        lastErr = gErr.message;
        log.debug({ err: gErr.message, query, attempt }, 'google SERP failed — trying Bing');
        try {
          const result = await this._fetchBing(query, { hl, gl });
          this.engine = result.engine;
          return result;
        } catch (bErr) {
          lastErr = bErr.message;
          log.debug({ err: bErr.message, query, attempt }, 'bing SERP failed');
        }
      }
      if (attempt < maxAttempts) {
        await this.page.waitForTimeout(2500 * attempt);
      }
    }

    throw new Error(`serp empty: ${lastErr}`);
  }

  async close() {
    try {
      await this.page?.close();
    } catch {
      /* ignore */
    }
    try {
      await this.browser?.close();
    } catch {
      /* ignore */
    }
    this.page = null;
    this.browser = null;
    this.engine = null;
  }
}

let _sharedSession = null;

export async function getSharedSerpSession() {
  if (!_sharedSession) _sharedSession = new KeywordSerpSession();
  await _sharedSession.init();
  return _sharedSession;
}

export async function closeSharedSerpSession() {
  if (_sharedSession) {
    await _sharedSession.close();
    _sharedSession = null;
  }
}

export async function fetchSerpDomainsPlaywright(query, opts = {}) {
  const session = opts.session || (await getSharedSerpSession());
  const { domains, engine } = await session.fetchDomains(query, opts);
  return { domains, engine };
}