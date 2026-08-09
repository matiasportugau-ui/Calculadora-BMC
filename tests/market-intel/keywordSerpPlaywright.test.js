// Module: market-intelligence | Owner: bmc-dev | Created: 2026-07-06
// Run: npm run test:market-intel

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSystemChromiumPath,
  resolveChromiumLaunchOptions,
  SYSTEM_CHROMIUM_ARGS,
} from '../../server/lib/marketIntel/keywordSerpPlaywright.js';

describe('keywordSerpPlaywright chromium resolution', () => {
  it('resolveSystemChromiumPath prefers env when it exists', () => {
    const exists = (p) => p === '/custom/chromium';
    assert.equal(resolveSystemChromiumPath('/custom/chromium', exists), '/custom/chromium');
  });

  it('resolveSystemChromiumPath falls back to alpine paths when env missing', () => {
    const exists = (p) => p === '/usr/bin/chromium';
    assert.equal(resolveSystemChromiumPath('/missing/chromium', exists), '/usr/bin/chromium');
  });

  it('resolveSystemChromiumPath returns null when nothing exists', () => {
    assert.equal(resolveSystemChromiumPath('/nope', () => false), null);
  });

  it('resolveChromiumLaunchOptions uses system binary + sandbox args in prod', () => {
    const opts = resolveChromiumLaunchOptions({
      env: { CHROMIUM_EXECUTABLE_PATH: '/usr/bin/chromium-browser' },
      exists: (p) => p === '/usr/bin/chromium-browser',
    });
    assert.equal(opts.source, 'system');
    assert.equal(opts.executablePath, '/usr/bin/chromium-browser');
    assert.deepEqual(opts.args, SYSTEM_CHROMIUM_ARGS);
    assert.equal(opts.headless, true);
  });

  it('resolveChromiumLaunchOptions falls back to playwright bundled in dev', () => {
    const opts = resolveChromiumLaunchOptions({
      env: {},
      exists: () => false,
    });
    assert.equal(opts.source, 'playwright-bundled');
    assert.equal(opts.executablePath, undefined);
    assert.ok(opts.args.includes('--disable-blink-features=AutomationControlled'));
  });
});