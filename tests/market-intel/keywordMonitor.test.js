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
  normalizeTrackedKeywordInput,
  mergeKeywordRefreshState,
} from '../../server/lib/marketIntel/keywordMonitor.js';
import { extractDomainsFromUrls, decodeBingRedirectUrl } from '../../server/lib/marketIntel/keywordSerpPlaywright.js';

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

  it('normalizeTrackedKeywordInput accepts the UI term payload and trims it', () => {
    assert.deepEqual(
      normalizeTrackedKeywordInput({ term: '  panel sandwich precio  ', priority: 'P2', intent: 'commercial' }),
      {
        keyword: 'panel sandwich precio',
        cluster: undefined,
        family: undefined,
        intent: 'commercial',
        priority: 'P2',
        on_site_gap: undefined,
      }
    );
    assert.equal(normalizeTrackedKeywordInput({ term: '   ' }), null);
  });

  it('mergeKeywordRefreshState preserves keywords added while refresh was running', () => {
    const latestState = {
      market: 'uy',
      keywords: [
        { id: 'kw-1', keyword: 'isopanel', bmc_serp_position: null },
        { id: 'kw-added', keyword: 'panel nuevo', bmc_serp_position: null },
      ],
    };
    const next = mergeKeywordRefreshState(
      latestState,
      [{ id: 'kw-1', keyword: 'isopanel', bmc_serp_position: 2 }],
      { errors: 0, targetCount: 1, refreshedAt: '2026-07-04T12:00:00.000Z' }
    );
    assert.equal(next.last_refresh_status, 'success');
    assert.equal(next.last_refresh_at, '2026-07-04T12:00:00.000Z');
    assert.equal(next.keywords.length, 2);
    assert.equal(next.keywords.find((k) => k.id === 'kw-1')?.bmc_serp_position, 2);
    assert.equal(next.keywords.find((k) => k.id === 'kw-added')?.keyword, 'panel nuevo');
  });
});
