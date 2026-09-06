/**
 * Scoped GoogleAuth client cache + failure-reset.
 * Run: node tests/googleAuthCache.test.js
 *
 * Uses a missing keyFile so getClient() rejects without ADC/network.
 * Does not print credential material.
 */
import assert from "node:assert/strict";
import { getGoogleAuthClient, resetGoogleAuthCache } from "../server/lib/googleAuthCache.js";

const SHEETS = "https://www.googleapis.com/auth/spreadsheets";
const DRIVE = "https://www.googleapis.com/auth/drive";
const MISSING = "/tmp/bmc-coverage-missing-sa.json";

function expectReject(promise) {
  return promise.then(
    () => {
      throw new Error("getGoogleAuthClient was expected to reject");
    },
    (err) => err,
  );
}

const prevSheets = process.env.GOOGLE_SHEETS_CREDENTIALS;
const prevAdc = process.env.GOOGLE_APPLICATION_CREDENTIALS;
process.env.GOOGLE_SHEETS_CREDENTIALS = MISSING;
process.env.GOOGLE_APPLICATION_CREDENTIALS = MISSING;
resetGoogleAuthCache();

try {
  const sameA = getGoogleAuthClient(SHEETS);
  const sameASettled = expectReject(sameA);
  const sameB = getGoogleAuthClient(SHEETS);
  assert.equal(sameA, sameB, "same scope reuses the in-flight Promise");
  assert.equal(getGoogleAuthClient(String(SHEETS)), sameA, "String(scope) is the cache key");

  const other = getGoogleAuthClient(DRIVE);
  const otherSettled = expectReject(other);
  assert.notEqual(sameA, other, "different scopes are separate cache keys");

  const firstErr = await sameASettled;
  assert.ok(firstErr, "missing keyFile rejects (no live ADC)");
  const afterFail = getGoogleAuthClient(SHEETS);
  const afterFailSettled = expectReject(afterFail);
  assert.notEqual(afterFail, sameA, "rejected entry is deleted so the next call retries");
  await afterFailSettled;

  await otherSettled;
  resetGoogleAuthCache();
  const afterReset = getGoogleAuthClient(DRIVE);
  const afterResetSettled = expectReject(afterReset);
  assert.notEqual(afterReset, other, "resetGoogleAuthCache clears every scope");
  await afterResetSettled;
  console.log("  ✓ same-scope hit, other-scope miss, reject deletes, reset clears");
} finally {
  resetGoogleAuthCache();
  if (prevSheets === undefined) delete process.env.GOOGLE_SHEETS_CREDENTIALS;
  else process.env.GOOGLE_SHEETS_CREDENTIALS = prevSheets;
  if (prevAdc === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  else process.env.GOOGLE_APPLICATION_CREDENTIALS = prevAdc;
}

console.log("googleAuthCache.test.js: ok");
