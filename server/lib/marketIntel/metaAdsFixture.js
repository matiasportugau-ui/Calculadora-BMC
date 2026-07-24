// Loads demo MetaAdsReport fixture for UI / source=demo.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashReport } from './metaAdsSnapshotMapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, 'data', 'metaAdsFixture.json');

let _cache = null;

export function loadMetaAdsFixture() {
  if (_cache) return cloneAndRefresh(_cache);
  const raw = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8'));
  _cache = raw;
  return cloneAndRefresh(raw);
}

function cloneAndRefresh(raw) {
  const report = JSON.parse(JSON.stringify(raw));
  report.meta = report.meta || {};
  report.meta.freshness = 'demo';
  report.meta.source = 'fixture';
  report.meta.fetched_at = new Date().toISOString();
  report.meta.provider = 'meta';
  report.meta.currency = report.meta.currency || 'USD';
  report.meta.report_hash = hashReport(report);
  return report;
}

/** Test helper: clear process cache */
export function clearMetaAdsFixtureCache() {
  _cache = null;
}
