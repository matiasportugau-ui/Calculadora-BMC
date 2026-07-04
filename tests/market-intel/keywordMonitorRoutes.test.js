// Module: market-intelligence | Owner: bmc-dev | Created: 2026-07-04
// Route coverage for the keyword monitor API surface.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'keyword-monitor-routes-'));
const statePath = join(dir, 'state.json');
const seedsPath = join(dir, 'seeds.json');

process.env.API_AUTH_TOKEN = 'keyword-monitor-route-token';
process.env.KEYWORD_MONITOR_STATE_PATH = statePath;
process.env.KEYWORD_MONITOR_SEEDS_PATH = seedsPath;
delete process.env.DATABASE_URL;

writeFileSync(
  seedsPath,
  JSON.stringify({
    market: 'uy',
    language: 'es',
    bmc_domain: 'bmcuruguay.com.uy',
    keywords: [],
  }),
);

const { default: marketingRouter } = await import('../../server/routes/marketing.js');

let server;
let port;

before(async () => {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/marketing', marketingRouter);
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      port = server.address().port;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  rmSync(dir, { recursive: true, force: true });
});

const url = (path) => `http://127.0.0.1:${port}${path}`;

describe('keyword monitor routes', () => {
  it('POST /api/marketing/keywords accepts the frontend term payload', async () => {
    const res = await fetch(url('/api/marketing/keywords'), {
      method: 'POST',
      headers: {
        Authorization: 'Bearer keyword-monitor-route-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ term: 'panel sandwich agregado', priority: 'P2', intent: 'commercial' }),
    });

    const body = await res.json();
    const savedState = JSON.parse(readFileSync(statePath, 'utf-8'));

    assert.equal(res.status, 201);
    assert.equal(body.keyword, 'panel sandwich agregado');
    assert.ok(savedState.keywords.some((k) => k.keyword === 'panel sandwich agregado'));
  });
});
