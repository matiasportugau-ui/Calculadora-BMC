/**
 * Pure helpers for Drive OAuth scope-insufficient detection (team Gmail 403 fix).
 * Does not load GIS / browser google.* — only exports from googleDrive.js that
 * do not touch window at import time beyond the rehydrate IIFE (localStorage).
 */
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modPath = path.join(__dirname, "../src/utils/googleDrive.js");

// Minimal browser shims so the module's rehydrate IIFE does not throw.
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
}
if (typeof globalThis.window === "undefined") {
  globalThis.window = globalThis;
}

const {
  isDriveScopeInsufficient,
  formatDriveApiError,
  isDriveScopeError,
  DRIVE_SCOPE_INSUFFICIENT_MSG,
} = await import(pathToFileURL(modPath).href);

const SAMPLE_403 = JSON.stringify({
  error: {
    code: 403,
    message: "Request had insufficient authentication scopes.",
    errors: [{ message: "Insufficient Permission", domain: "global", reason: "insufficientPermissions" }],
    status: "PERMISSION_DENIED",
    details: [{
      "@type": "type.googleapis.com/google.rpc.ErrorInfo",
      reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
      domain: "googleapis.com",
      metadata: {
        method: "google.apps.drive.v3.DriveFiles.List",
        service: "drive.googleapis.com",
      },
    }],
  },
});

assert.equal(isDriveScopeInsufficient(403, SAMPLE_403), true, "detects ACCESS_TOKEN_SCOPE_INSUFFICIENT body");
assert.equal(isDriveScopeInsufficient(403, "Insufficient Permission"), true);
assert.equal(isDriveScopeInsufficient(401, SAMPLE_403), false, "401 is not scope-insufficient");
assert.equal(isDriveScopeInsufficient(403, '{"error":"other"}'), false);
assert.equal(isDriveScopeInsufficient(403, ""), false);

const err = formatDriveApiError(403, SAMPLE_403);
assert.equal(err.code, "DRIVE_SCOPE_INSUFFICIENT");
assert.equal(err.message, DRIVE_SCOPE_INSUFFICIENT_MSG);
assert.ok(isDriveScopeError(err));
assert.ok(isDriveScopeError(new Error(`Drive API 403: ${SAMPLE_403}`)));
assert.equal(isDriveScopeError(new Error("network fail")), false);

const raw = formatDriveApiError(500, "boom");
assert.match(raw.message, /Drive API 500/);
assert.notEqual(raw.code, "DRIVE_SCOPE_INSUFFICIENT");

console.log("googleDriveScopeError.test.js: OK");
