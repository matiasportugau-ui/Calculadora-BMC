// tests/cors-origins-bc.test.js
// Drives the shipped Express CORS gate (isCorsOriginAllowed + default allowlist).
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CORS_ORIGINS } from "../server/config.js";
import { isCorsOriginAllowed } from "../server/lib/corsAllow.js";

const BMC = "https://calculadora-bmc.vercel.app";
const BC = "https://calculadora-bc.vercel.app";
const LAM = "https://calculadora-paneleslam.vercel.app";
const SB = "https://calculadora-smartbuilding.vercel.app";
const FAKE = "https://evil.example";

test("shipped CORS check allows BMC + tenants, denies unknown", () => {
  assert.equal(DEFAULT_CORS_ORIGINS.includes(BMC), true);
  assert.equal(DEFAULT_CORS_ORIGINS.includes(BC), true);
  assert.equal(DEFAULT_CORS_ORIGINS.includes(LAM), true);
  assert.equal(DEFAULT_CORS_ORIGINS.includes(SB), true);
  assert.equal(isCorsOriginAllowed(BC, DEFAULT_CORS_ORIGINS), true);
  assert.equal(isCorsOriginAllowed(BMC, DEFAULT_CORS_ORIGINS), true);
  assert.equal(isCorsOriginAllowed(LAM, DEFAULT_CORS_ORIGINS), true);
  assert.equal(isCorsOriginAllowed(SB, DEFAULT_CORS_ORIGINS), true);
  assert.equal(isCorsOriginAllowed("http://127.0.0.1:5181", DEFAULT_CORS_ORIGINS), true);
  assert.equal(isCorsOriginAllowed("http://127.0.0.1:5182", DEFAULT_CORS_ORIGINS), true);
  assert.equal(isCorsOriginAllowed(FAKE, DEFAULT_CORS_ORIGINS), false);
  assert.equal(isCorsOriginAllowed("", DEFAULT_CORS_ORIGINS), true);
});
