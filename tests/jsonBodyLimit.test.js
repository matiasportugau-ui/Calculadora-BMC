/**
 * Bug AC — POST /api/wa/media needs a JSON body limit above default 1mb
 * so base64 media (~25MB binary allow) is not rejected before the route.
 */
import assert from "node:assert/strict";
import {
  DEFAULT_JSON_BODY_LIMIT,
  WA_MEDIA_UPLOAD_JSON_BODY_LIMIT,
  jsonBodyLimitForPath,
} from "../server/lib/jsonBodyLimit.js";

assert.equal(jsonBodyLimitForPath("POST", "/api/wa/media"), WA_MEDIA_UPLOAD_JSON_BODY_LIMIT);
assert.equal(jsonBodyLimitForPath("post", "/api/wa/media"), WA_MEDIA_UPLOAD_JSON_BODY_LIMIT);
assert.notEqual(WA_MEDIA_UPLOAD_JSON_BODY_LIMIT, DEFAULT_JSON_BODY_LIMIT);

// Sibling media routes stay on the default (small JSON).
assert.equal(jsonBodyLimitForPath("POST", "/api/wa/media/link"), DEFAULT_JSON_BODY_LIMIT);
assert.equal(jsonBodyLimitForPath("POST", "/api/wa/media/clear"), DEFAULT_JSON_BODY_LIMIT);
assert.equal(jsonBodyLimitForPath("GET", "/api/wa/media/msg1"), DEFAULT_JSON_BODY_LIMIT);
assert.equal(jsonBodyLimitForPath("POST", "/api/wa/messages"), DEFAULT_JSON_BODY_LIMIT);
assert.equal(jsonBodyLimitForPath("POST", "/api/cotizaciones"), DEFAULT_JSON_BODY_LIMIT);

// 25MB binary → ~33.4MB base64; limit must be above that floor.
const mb = Number(String(WA_MEDIA_UPLOAD_JSON_BODY_LIMIT).replace(/mb$/i, ""));
assert.ok(Number.isFinite(mb) && mb >= 34, `expected >=34mb, got ${WA_MEDIA_UPLOAD_JSON_BODY_LIMIT}`);

console.log("jsonBodyLimit.test.js: OK");
