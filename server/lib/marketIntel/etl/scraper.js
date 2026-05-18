// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15

import * as cheerio from 'cheerio';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const BOT_USER_AGENT = 'BMC-PriceBot/1.0 (+https://bmc.uy/bot)';
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Scrape a single SKU page and return a typed outcome.
 * Never throws — always returns a discriminated union.
 *
 * @param {{ id: string, url: string, price_selector: string }} sku
 * @returns {Promise<
 *   { kind: 'success', price: number, currency: string } |
 *   { kind: 'blocked', httpStatus: number } |
 *   { kind: 'parse_error', message: string } |
 *   { kind: 'network_error', message: string }
 * >}
 */
export async function scrapeSku(sku) {
  let res;

  try {
    res = await fetch(sku.url, {
      headers: {
        'User-Agent': BOT_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-UY,es;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err, skuUrl: sku.url }, 'network error fetching SKU page');
    return { kind: 'network_error', message };
  }

  const status = res.status;

  // Blocking responses — do NOT retry automatically
  if (status === 403 || status === 429 || status >= 500) {
    log.warn({ skuUrl: sku.url, httpStatus: status }, 'blocking HTTP status — not retrying');
    return { kind: 'blocked', httpStatus: status };
  }

  // CAPTCHA / login wall detection via final URL
  const finalUrl = res.url;
  if (
    finalUrl.includes('/captcha') ||
    finalUrl.includes('/login') ||
    finalUrl.includes('/challenge')
  ) {
    log.warn({ finalUrl, skuUrl: sku.url }, 'redirect to login/captcha wall detected');
    return { kind: 'blocked', httpStatus: 302 };
  }

  let html;
  try {
    html = await res.text();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { kind: 'network_error', message };
  }

  const $ = cheerio.load(html);
  const el = $(sku.price_selector).first();

  if (!el.length) {
    const message = `Selector "${sku.price_selector}" not found on ${sku.url}`;
    log.error({ skuId: sku.id, selector: sku.price_selector }, message);
    return { kind: 'parse_error', message };
  }

  const rawText = el.text().trim();
  const price = parsePrice(rawText);

  if (price === null) {
    const message = `Could not parse price from "${rawText}" (selector: ${sku.price_selector})`;
    log.error({ skuId: sku.id, rawText }, message);
    return { kind: 'parse_error', message };
  }

  log.info({ skuId: sku.id, price, url: sku.url }, 'price scraped');
  return { kind: 'success', price, currency: 'UYU' };
}

/**
 * Parse a price string into a number.
 * Handles UY format ($1.234,56), US format ($1,234.56), plain integers.
 *
 * @param {string} raw
 * @returns {number|null}
 */
export function parsePrice(raw) {
  // Reject negative-like strings before stripping symbols
  if (/^-/.test(raw.trim())) return null;

  const cleaned = raw.replace(/[^\d.,]/g, '').trim();
  if (!cleaned) return null;

  // UY format: last separator is comma followed by 1-2 digits
  const isUyFormat = /^[\d.]+,\d{1,2}$/.test(cleaned);
  const normalized = isUyFormat
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/,/g, '');

  const value = parseFloat(normalized);
  return isNaN(value) || value <= 0 ? null : value;
}

/**
 * Polite delay between requests (default 2 seconds per scraping rules).
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function delay(ms = 2_000) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
