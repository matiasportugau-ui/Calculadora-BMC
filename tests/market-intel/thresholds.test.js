// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15
// Unit tests for thresholds.js — pure functions, no DB.
// Run: node --test tests/market-intel/thresholds.test.js

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getThresholds, determineAlertLevel } from '../../server/lib/marketIntel/alerts/thresholds.js';

// Save and restore env vars around each test
let savedEnv;
beforeEach(() => { savedEnv = { ...process.env }; });
afterEach(() => {
  delete process.env.ALERT_WARN_PCT;
  delete process.env.ALERT_CRITICAL_PCT;
  delete process.env.ALERT_CRITICAL_OFFLINE_RUNS;
  Object.assign(process.env, savedEnv);
});

test('getThresholds: returns defaults when env vars unset', () => {
  delete process.env.ALERT_WARN_PCT;
  delete process.env.ALERT_CRITICAL_PCT;
  delete process.env.ALERT_CRITICAL_OFFLINE_RUNS;

  const t = getThresholds();
  assert.equal(t.warnPct, 5);
  assert.equal(t.criticalPct, 15);
  assert.equal(t.criticalOfflineRuns, 2);
});

test('getThresholds: reads custom values from env', () => {
  process.env.ALERT_WARN_PCT = '10';
  process.env.ALERT_CRITICAL_PCT = '25';
  process.env.ALERT_CRITICAL_OFFLINE_RUNS = '3';

  const t = getThresholds();
  assert.equal(t.warnPct, 10);
  assert.equal(t.criticalPct, 25);
  assert.equal(t.criticalOfflineRuns, 3);
});

const defaults = { warnPct: 5, criticalPct: 15 };

test('determineAlertLevel: below warn threshold → info', () => {
  assert.equal(determineAlertLevel(0.5, defaults), 'info');
  assert.equal(determineAlertLevel(4.99, defaults), 'info');
});

test('determineAlertLevel: at warn threshold → warning', () => {
  assert.equal(determineAlertLevel(5, defaults), 'warning');
  assert.equal(determineAlertLevel(14.99, defaults), 'warning');
});

test('determineAlertLevel: at critical threshold → critical', () => {
  assert.equal(determineAlertLevel(15, defaults), 'critical');
  assert.equal(determineAlertLevel(50, defaults), 'critical');
});
