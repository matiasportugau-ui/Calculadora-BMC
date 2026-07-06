// Module: market-intelligence | Owner: bmc-dev | Created: 2026-07-04
// Run: npm run test:market-intel

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDdgSerpDomains,
  findDomainPosition,
  volumeProxyFromCount,
  difficultyFromSerp,
  formatKeywordRow,
  refreshKeyword,
} from '../../server/lib/marketIntel/keywordMonitor.js';
import { extractDomainsFromUrls, decodeBingRedirectUrl } from '../../server/lib/marketIntel/keywordSerpPlaywright.js';

function buildRefreshCtx(fetchDomains) {
  const domainIndex = new Map([
    ['kingspan.com.uy', 'Kingspan Uruguay'],
    ['example.com', 'Example Competitor'],
  ]);
  return {
    domainIndex,
    competitorDomains: new Set(domainIndex.keys()),
    bmcDomain: 'bmcuruguay.com.uy',
    serpSession: { fetchDomains },
  };
}

async function withAutocompleteCount(count, run) {
  const originalFetch = globalThis.fetch;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => JSON.stringify(['query', Array.from({ length: count }, (_, i) => `suggestion-${i}`)]),
  });
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDatabaseUrl == null) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
}

describe('keywordMonitor helpers', () => {
  it('parseDdgSerpDomains extracts unique hosts', () => {
    const html = `
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.bmcuruguay.com.uy%2Fproducts">
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fkingspan.com.uy%2F">
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.bmcuruguay.com.uy%2Fagain">
    `;
    const domains = parseDdgSerpDomains(html);
    assert.equal(domains.length, 2);
    assert.equal(domains[0], 'bmcuruguay.com.uy');
    assert.equal(domains[1], 'kingspan.com.uy');
  });

  it('findDomainPosition locates BMC', () => {
    const pos = findDomainPosition(['kingspan.com.uy', 'bmcuruguay.com.uy', 'ml.com'], 'bmcuruguay.com.uy');
    assert.equal(pos, 2);
  });

  it('volumeProxyFromCount tiers', () => {
    assert.equal(volumeProxyFromCount(10), 'high');
    assert.equal(volumeProxyFromCount(5), 'medium');
    assert.equal(volumeProxyFromCount(1), 'low');
  });

  it('decodeBingRedirectUrl unwraps ck/a links', () => {
    const url = decodeBingRedirectUrl(
      'https://www.bing.com/ck/a?!&&p=x&u=a1aHR0cHM6Ly93d3cuYm1jdXJ1Z3VheS5jb20udXkv&ntb=1'
    );
    assert.equal(url, 'https://www.bmcuruguay.com.uy/');
  });

  it('extractDomainsFromUrls dedupes and skips google', () => {
    const domains = extractDomainsFromUrls([
      'https://www.bmcuruguay.com.uy/products',
      'https://kingspan.com.uy/',
      'https://example.com/page',
      'https://bmcuruguay.com.uy/again',
    ]);
    assert.deepEqual(domains, ['bmcuruguay.com.uy', 'kingspan.com.uy', 'example.com']);
  });

  it('difficultyFromSerp counts competitor density', () => {
    const comp = new Set(['kingspan.com.uy', 'panelsandwich.uy', 'tdauruguay.com']);
    assert.equal(difficultyFromSerp(['kingspan.com.uy', 'panelsandwich.uy', 'tdauruguay.com', 'blog.com'], comp), 'medium');
    assert.equal(difficultyFromSerp(['blog.com', 'news.com'], comp), 'low');
  });

  it('formatKeywordRow maps flat state to nested serp UI shape', () => {
    const row = formatKeywordRow({
      id: 'kw-001',
      keyword: 'isopanel precio uruguay',
      cluster: 'EPS',
      family: 'panel_pared_eps',
      intent: 'transactional',
      priority: 'P1',
      bmc_serp_position: 2,
      bmc_serp_prev_position: 4,
      serp_domains: ['ml.com', 'bmcuruguay.com.uy'],
      captured_at: '2026-07-04T10:00:00.000Z',
      serp_engine: 'google',
      error: null,
    });
    assert.equal(row.term, 'isopanel precio uruguay');
    assert.equal(row.serp.position, 2);
    assert.equal(row.serp.previous_position, 4);
    assert.equal(row.serp.competitors.length, 2);
    assert.equal(row.serp.stale, false);
  });

  it('formatKeywordRow marks stale SERP without surfacing error', () => {
    const row = formatKeywordRow({
      id: 'kw-002',
      keyword: 'test',
      priority: 'P1',
      bmc_serp_position: 1,
      serp_domains: ['bmcuruguay.com.uy'],
      error: 'serp stale: google captcha',
    });
    assert.equal(row.serp.stale, true);
    assert.equal(row.serp.error, null);
    assert.equal(row.serp.position, 1);
  });

  it('refreshKeyword preserves prior SERP snapshot when Playwright/session refresh fails', async () => {
    const stale = await withAutocompleteCount(6, () =>
      refreshKeyword(
        {
          id: 'kw-stale',
          keyword: 'isopanel precio uruguay',
          active: true,
          autocomplete_count: 2,
          bmc_serp_position: 2,
          bmc_serp_prev_position: 4,
          serp_domains: ['kingspan.com.uy', 'bmcuruguay.com.uy'],
          serp_engine: 'google',
          captured_at: '2026-07-04T10:00:00.000Z',
          error: null,
        },
        buildRefreshCtx(async () => {
          throw new Error('google captcha');
        })
      )
    );

    assert.equal(stale.autocomplete_count, 6);
    assert.equal(stale.error, 'serp stale: google captcha');
    assert.deepEqual(stale.serp_domains, ['kingspan.com.uy', 'bmcuruguay.com.uy']);
    assert.equal(stale.serp_engine, 'google');
    assert.equal(stale.captured_at, '2026-07-04T10:00:00.000Z');
    assert.equal(stale.bmc_serp_position, 2);
    assert.equal(stale.bmc_serp_prev_position, 2);
    assert.equal(stale.position_delta, 0);
    assert.equal(stale.top_competitor_domain, 'kingspan.com.uy');
  });

  it('refreshKeyword records a first-time SERP failure without marking it stale', async () => {
    const failed = await withAutocompleteCount(1, () =>
      refreshKeyword(
        {
          id: 'kw-empty',
          keyword: 'panel sandwich techo uruguay',
          active: true,
          autocomplete_count: null,
          bmc_serp_position: null,
          serp_domains: [],
          captured_at: null,
          error: null,
        },
        buildRefreshCtx(async () => {
          throw new Error('chromium executable missing');
        })
      )
    );

    assert.equal(failed.autocomplete_count, 1);
    assert.equal(failed.error, 'chromium executable missing');
    assert.equal(failed.error.startsWith('serp stale:'), false);
    assert.deepEqual(failed.serp_domains, []);
    assert.equal(failed.bmc_serp_position, null);
    assert.equal(typeof failed.captured_at, 'string');
  });

  it('refreshKeyword updates SERP engine, position, and delta on success', async () => {
    const updated = await withAutocompleteCount(9, () =>
      refreshKeyword(
        {
          id: 'kw-success',
          keyword: 'panel isofrig precio',
          active: true,
          autocomplete_count: 3,
          bmc_serp_position: 5,
          serp_domains: ['old.example.com', 'bmcuruguay.com.uy'],
          serp_engine: 'google',
          captured_at: '2026-07-04T09:00:00.000Z',
          error: 'serp stale: previous outage',
        },
        buildRefreshCtx(async () => ({
          domains: ['kingspan.com.uy', 'example.com', 'bmcuruguay.com.uy'],
          engine: 'bing',
        }))
      )
    );

    assert.equal(updated.autocomplete_count, 9);
    assert.equal(updated.error, null);
    assert.deepEqual(updated.serp_domains, ['kingspan.com.uy', 'example.com', 'bmcuruguay.com.uy']);
    assert.equal(updated.serp_engine, 'bing');
    assert.equal(updated.bmc_serp_position, 3);
    assert.equal(updated.bmc_serp_prev_position, 5);
    assert.equal(updated.position_delta, 2);
    assert.equal(updated.top_competitor_domain, 'kingspan.com.uy');
    assert.notEqual(updated.captured_at, '2026-07-04T09:00:00.000Z');
  });
});