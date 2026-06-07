// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15
// Unit tests for delta.js — shouldWritePrice is pure (no DB call needed).
// Run: node --test tests/market-intel/delta.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldWritePrice } from '../../server/lib/marketIntel/etl/delta.js';

// shouldWritePrice is pure — does not call the DB
const cId = 'comp-1';
const sId = 'sku-1';

test('shouldWritePrice: null lastPrice → true (first observation)', () => {
  assert.equal(shouldWritePrice(100, null, cId, sId), true);
});

test('shouldWritePrice: price changed up → true', () => {
  assert.equal(shouldWritePrice(110, 100, cId, sId), true);
});

test('shouldWritePrice: price changed down → true', () => {
  assert.equal(shouldWritePrice(90, 100, cId, sId), true);
});

test('shouldWritePrice: price unchanged → false', () => {
  assert.equal(shouldWritePrice(100, 100, cId, sId), false);
});

test('shouldWritePrice: 1-cent change → true', () => {
  assert.equal(shouldWritePrice(100.01, 100.00, cId, sId), true);
});
