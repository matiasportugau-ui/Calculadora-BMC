/**
 * Client allowlist must accept Drive's 2026+ download CDN (#1027).
 * Server host checks already live in enviosAdjuntoFetch.test.js; this pins the
 * shared client helper so browser fallback cannot drift off the server list.
 * Run: node tests/adjuntoDriveUsercontentHost.test.js
 */
import assert from "node:assert/strict";
import { isAdjuntoAllowedHost } from "../src/utils/logistica/adjuntoUrl.js";

assert.equal(isAdjuntoAllowedHost("drive.usercontent.google.com"), true, "Drive uc 303 host");
assert.equal(isAdjuntoAllowedHost("cdn.drive.usercontent.google.com"), true, "Drive usercontent subdomain");
assert.equal(isAdjuntoAllowedHost("drive.google.com"), true, "canonical Drive host still allowed");
assert.equal(isAdjuntoAllowedHost("drive.usercontent.google.com.evil.com"), false, "suffix trap");
assert.equal(isAdjuntoAllowedHost("usercontent.google.com"), false, "bare usercontent.google.com is not Drive CDN");
assert.equal(isAdjuntoAllowedHost("evil.com"), false, "unrelated host");

console.log("adjuntoDriveUsercontentHost — OK");
