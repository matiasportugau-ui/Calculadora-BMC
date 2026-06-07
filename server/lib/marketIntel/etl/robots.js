// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15

import robotsParser from 'robots-parser';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const BOT_USER_AGENT = 'BMC-PriceBot/1.0 (+https://bmc.uy/bot)';

/**
 * Check whether scraping a given path on a domain is allowed by robots.txt.
 * Conservatively returns false on network error (do not scrape).
 * @param {string} domain - normalized domain (e.g. "example.com")
 * @param {string} targetPath - URL path to check (e.g. "/products/panel")
 * @returns {Promise<boolean>}
 */
export async function isScrapingAllowed(domain, targetPath) {
  const robotsUrl = `https://${domain}/robots.txt`;

  try {
    const res = await fetch(robotsUrl, {
      headers: { 'User-Agent': BOT_USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 404) {
      log.debug({ domain }, 'no robots.txt — scraping allowed');
      return true;
    }

    if (!res.ok) {
      log.warn({ domain, status: res.status }, 'robots.txt fetch non-OK — conservatively disallowing');
      return false;
    }

    const text = await res.text();
    const robots = robotsParser(robotsUrl, text);
    const allowed = robots.isAllowed(`https://${domain}${targetPath}`, BOT_USER_AGENT);

    if (!allowed) {
      log.warn({ domain, targetPath }, 'robots.txt disallows scraping — will flag for mystery shopping');
    }

    return allowed ?? true;
  } catch (err) {
    log.error({ err, domain }, 'robots.txt fetch error — conservatively disallowing');
    return false;
  }
}
