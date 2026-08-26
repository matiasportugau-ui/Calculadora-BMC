/**
 * Pins per-path Express JSON body limits for Driver Loop evidence + PDF.
 * Run: node tests/jsonBodyLimit.test.js
 */
import assert from "node:assert/strict";
import {
  DEFAULT_JSON_BODY_LIMIT,
  DRIVER_EVIDENCE_UPLOAD_JSON_BODY_LIMIT,
  PDF_GENERATE_JSON_BODY_LIMIT,
  jsonBodyLimitForPath,
} from "../server/lib/jsonBodyLimit.js";

console.log("jsonBodyLimit");

assert.equal(jsonBodyLimitForPath("POST", "/api/driver/evidence/upload-b64"), DRIVER_EVIDENCE_UPLOAD_JSON_BODY_LIMIT);
assert.equal(DRIVER_EVIDENCE_UPLOAD_JSON_BODY_LIMIT, "8mb");
assert.equal(jsonBodyLimitForPath("POST", "/api/pdf/generate"), PDF_GENERATE_JSON_BODY_LIMIT);
assert.equal(jsonBodyLimitForPath("POST", "/api/driver/events"), DEFAULT_JSON_BODY_LIMIT);
assert.equal(jsonBodyLimitForPath("GET", "/api/driver/evidence/upload-b64"), DEFAULT_JSON_BODY_LIMIT);
assert.equal(jsonBodyLimitForPath("POST", "/api/driver/evidence/upload-url"), DEFAULT_JSON_BODY_LIMIT);
assert.equal(jsonBodyLimitForPath("POST", "/api/driver/evidence/commit"), DEFAULT_JSON_BODY_LIMIT);
console.log("  ✓ upload-b64 → 8mb; siblings stay 1mb");

console.log("jsonBodyLimit OK");
