// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15
// Unit tests for scraper.js — no DB, no network.
// Run: node --test tests/market-intel/scraper.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrice } from '../../server/lib/marketIntel/etl/scraper.js';

test('parsePrice: UY format $1.234,56', () => {
  assert.equal(parsePrice('$1.234,56'), 1234.56);
});

test('parsePrice: UY format without $', () => {
  assert.equal(parsePrice('1.234,56'), 1234.56);
});

test('parsePrice: US format $1,234.56', () => {
  assert.equal(parsePrice('$1,234.56'), 1234.56);
});

test('parsePrice: plain integer', () => {
  assert.equal(parsePrice('1500'), 1500);
});

test('parsePrice: strips whitespace and currency symbol', () => {
  assert.equal(parsePrice('  $ 2.500,00  '), 2500.00);
});

test('parsePrice: empty string → null', () => {
  assert.equal(parsePrice(''), null);
});

test('parsePrice: non-numeric text → null', () => {
  assert.equal(parsePrice('Precio no disponible'), null);
});

test('parsePrice: zero → null', () => {
  assert.equal(parsePrice('0'), null);
});

test('parsePrice: negative-like string → null', () => {
  assert.equal(parsePrice('-100'), null);
});
