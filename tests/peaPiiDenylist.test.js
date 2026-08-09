/**
 * Offline tests for PEA PII denylist (G-10).
 */
import assert from "node:assert/strict";
import {
  filterEvidencePaths,
  isDeniedEvidencePath,
  sanitizeGapMetadata,
} from "../server/lib/pea/piiDenylist.js";

assert.equal(isDeniedEvidencePath(".env"), true);
assert.equal(isDeniedEvidencePath("server/config.js"), false);
assert.equal(filterEvidencePaths(["src/foo.js", ".env.local"]).length, 1);

const sanitized = sanitizeGapMetadata({
  tool: "calc",
  api_key: "secret",
  evidence_paths: ["tests/a.js", "credentials.json"],
});
assert.equal(sanitized.api_key, "[redacted]");
assert.equal(sanitized.evidence_paths.length, 1);

console.log("peaPiiDenylist.test.js OK");
