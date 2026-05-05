import assert from "node:assert/strict";
import { redactSensitiveUrl } from "../server/lib/httpLogRedaction.js";

assert.equal(
  redactSensitiveUrl("/api/wa/auth/verify?token=abc123&next=/hub/wa"),
  "/api/wa/auth/verify?token=[REDACTED]&next=/hub/wa",
);

assert.equal(
  redactSensitiveUrl("/api/wa/auth/verify?foo=1&token=abc123&foo=2"),
  "/api/wa/auth/verify?foo=1&token=[REDACTED]&foo=2",
);

assert.equal(
  redactSensitiveUrl("/hub/wa?access_token=jwt&refresh_token=refresh#session"),
  "/hub/wa?access_token=[REDACTED]&refresh_token=[REDACTED]#session",
);

assert.equal(
  redactSensitiveUrl("/health?status=1"),
  "/health?status=1",
);

console.log("http log redaction tests passed");
