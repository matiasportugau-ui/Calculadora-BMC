// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15
// Unit tests for deduplication.js (normalizeDomain — pure, no DB).
// Run: node --test tests/market-intel/deduplication.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDomain } from '../../server/lib/marketIntel/etl/deduplication.js';

test('normalizeDomain: lowercases', () => {
  assert.equal(normalizeDomain('EXAMPLE.COM'), 'example.com');
});

test('normalizeDomain: strips www.', () => {
  assert.equal(normalizeDomain('www.example.com'), 'example.com');
});

test('normalizeDomain: strips https://', () => {
  assert.equal(normalizeDomain('https://example.com'), 'example.com');
});

test('normalizeDomain: strips http:// and www.', () => {
  assert.equal(normalizeDomain('http://www.example.com'), 'example.com');
});

test('normalizeDomain: strips path component', () => {
  assert.equal(normalizeDomain('example.com/some/path'), 'example.com');
});

test('normalizeDomain: already normalized', () => {
  assert.equal(normalizeDomain('example.com'), 'example.com');
});

test('normalizeDomain: non-www subdomain preserved', () => {
  assert.equal(normalizeDomain('shop.example.com'), 'shop.example.com');
});
