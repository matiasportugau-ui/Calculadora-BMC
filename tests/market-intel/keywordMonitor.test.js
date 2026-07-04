// Module: market-intelligence | Owner: bmc-dev | Created: 2026-07-04
// Run: npm run test:market-intel

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseDdgSerpDomains,
  findDomainPosition,
  volumeProxyFromCount,
  difficultyFromSerp,
  formatKeywordRow,
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

  it('serializes refreshes and preserves keywords added during a running refresh', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'keyword-monitor-'));
    const statePath = join(dir, 'state.json');
    const seedsPath = join(dir, 'seeds.json');
    const originalEnv = {
      state: process.env.KEYWORD_MONITOR_STATE_PATH,
      seeds: process.env.KEYWORD_MONITOR_SEEDS_PATH,
      engine: process.env.KEYWORD_MONITOR_SERP_ENGINE,
      delay: process.env.KEYWORD_MONITOR_DELAY_MS,
      batchDelay: process.env.KEYWORD_MONITOR_SERP_DELAY_MS,
      databaseUrl: process.env.DATABASE_URL,
    };
    const originalFetch = globalThis.fetch;
    let releaseAutocomplete;
    let autocompleteStartedResolve;
    const autocompleteStarted = new Promise((resolve) => {
      autocompleteStartedResolve = resolve;
    });
    const autocompleteRelease = new Promise((resolve) => {
      releaseAutocomplete = resolve;
    });

    writeFileSync(
      seedsPath,
      JSON.stringify({
        market: 'uy',
        language: 'es',
        bmc_domain: 'bmcuruguay.com.uy',
        keywords: [
          {
            id: 'kw-001',
            keyword: 'isopanel precio uruguay',
            cluster: 'EPS pared',
            family: 'panel_pared_eps',
            intent: 'transactional',
            priority: 'P1',
            on_site_gap: false,
          },
        ],
      }),
    );

    process.env.KEYWORD_MONITOR_STATE_PATH = statePath;
    process.env.KEYWORD_MONITOR_SEEDS_PATH = seedsPath;
    process.env.KEYWORD_MONITOR_SERP_ENGINE = 'ddg';
    process.env.KEYWORD_MONITOR_DELAY_MS = '0';
    process.env.KEYWORD_MONITOR_SERP_DELAY_MS = '0';
    delete process.env.DATABASE_URL;

    globalThis.fetch = async (url) => {
      const href = String(url);
      if (href.includes('suggestqueries.google.com')) {
        autocompleteStartedResolve();
        await autocompleteRelease;
        return new Response(JSON.stringify(['isopanel precio uruguay', ['isopanel precio uruguay']]), {
          status: 200,
        });
      }
      return new Response(
        '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.bmcuruguay.com.uy%2Fproductos"></a>',
        { status: 200 },
      );
    };

    try {
      const mod = await import(`../../server/lib/marketIntel/keywordMonitor.js?state-merge=${Date.now()}`);
      const firstRefresh = mod.startKeywordRefresh({ priority: 'P1' });
      assert.equal(firstRefresh.started, true);
      assert.equal(mod.isKeywordRefreshRunning(), true);

      await autocompleteStarted;
      const secondRefresh = mod.startKeywordRefresh({ priority: 'P1' });
      assert.equal(secondRefresh.started, false);
      assert.equal(secondRefresh.promise, firstRefresh.promise);

      await mod.addTrackedKeyword({ keyword: 'panel sandwich agregado', priority: 'P2' });
      releaseAutocomplete();
      const finalState = await firstRefresh.promise;
      const savedState = JSON.parse(readFileSync(statePath, 'utf-8'));

      assert.equal(finalState.last_refresh_status, 'success');
      assert.equal(mod.isKeywordRefreshRunning(), false);
      assert.equal(savedState.keywords.length, 2);
      assert.ok(savedState.keywords.some((k) => k.keyword === 'panel sandwich agregado'));
      assert.ok(savedState.keywords.some((k) => k.id === 'kw-001' && k.bmc_serp_position === 1));
    } finally {
      globalThis.fetch = originalFetch;
      if (originalEnv.state == null) delete process.env.KEYWORD_MONITOR_STATE_PATH;
      else process.env.KEYWORD_MONITOR_STATE_PATH = originalEnv.state;
      if (originalEnv.seeds == null) delete process.env.KEYWORD_MONITOR_SEEDS_PATH;
      else process.env.KEYWORD_MONITOR_SEEDS_PATH = originalEnv.seeds;
      if (originalEnv.engine == null) delete process.env.KEYWORD_MONITOR_SERP_ENGINE;
      else process.env.KEYWORD_MONITOR_SERP_ENGINE = originalEnv.engine;
      if (originalEnv.delay == null) delete process.env.KEYWORD_MONITOR_DELAY_MS;
      else process.env.KEYWORD_MONITOR_DELAY_MS = originalEnv.delay;
      if (originalEnv.batchDelay == null) delete process.env.KEYWORD_MONITOR_SERP_DELAY_MS;
      else process.env.KEYWORD_MONITOR_SERP_DELAY_MS = originalEnv.batchDelay;
      if (originalEnv.databaseUrl == null) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalEnv.databaseUrl;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});