// Contract tests for server/lib/emailIngestAuth.js
// Run: node tests/emailIngestAuth.test.js

import { resolveEmailIngestAuth } from "../server/lib/emailIngestAuth.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  fn();
}

group("no secrets configured → 503", () => {
  const r = resolveEmailIngestAuth("any", { apiAuthToken: "", emailIngestToken: "" });
  assert(r.ok === false && r.status === 503, "503");
});

group("missing token → 401", () => {
  const r = resolveEmailIngestAuth("", { apiAuthToken: "secret" });
  assert(r.ok === false && r.status === 401, "401 empty");
  const r2 = resolveEmailIngestAuth("   ", { apiAuthToken: "secret" });
  assert(r2.ok === false && r2.status === 401, "401 whitespace");
});

group("API_AUTH_TOKEN only", () => {
  const r = resolveEmailIngestAuth("good", { apiAuthToken: "good" });
  assert(r.ok === true, "match");
  const r2 = resolveEmailIngestAuth("bad", { apiAuthToken: "good" });
  assert(r2.ok === false && r2.status === 401, "reject wrong");
});

group("EMAIL_INGEST_TOKEN only", () => {
  const r = resolveEmailIngestAuth("ing", { apiAuthToken: "", emailIngestToken: "ing" });
  assert(r.ok === true, "match ingest");
  const r2 = resolveEmailIngestAuth("other", { apiAuthToken: "", emailIngestToken: "ing" });
  assert(r2.ok === false, "reject wrong");
});

group("both tokens — accept either (migration)", () => {
  const cfg = { apiAuthToken: "api", emailIngestToken: "ing" };
  assert(resolveEmailIngestAuth("api", cfg).ok === true, "api works");
  assert(resolveEmailIngestAuth("ing", cfg).ok === true, "ingest works");
  assert(resolveEmailIngestAuth("no", cfg).ok === false, "reject");
});

console.log(`\nemailIngestAuth: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
