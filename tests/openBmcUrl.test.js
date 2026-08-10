/**
 * Run: node tests/openBmcUrl.test.js
 */
import assert from "node:assert/strict";
import { isAllowedOpenBmcUrl, resolveOpenBmcUrl } from "../src/utils/openBmcUrl.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("openBmcUrl");

{
  assert.equal(
    resolveOpenBmcUrl("Sory-IsoRoof-Foil-30"),
    "https://storage.googleapis.com/bmc-cotizaciones/quotes/bmc-json/Sory-IsoRoof-Foil-30.bmc.json",
  );
  assert.equal(
    resolveOpenBmcUrl("quotes/bmc-json/Sory-IsoRoof-Foil-50.bmc.json"),
    "https://storage.googleapis.com/bmc-cotizaciones/quotes/bmc-json/Sory-IsoRoof-Foil-50.bmc.json",
  );
  assert.equal(
    resolveOpenBmcUrl(
      "https://storage.googleapis.com/bmc-cotizaciones/quotes/bmc-json/foo.bmc.json",
    ),
    "https://storage.googleapis.com/bmc-cotizaciones/quotes/bmc-json/foo.bmc.json",
  );
  ok("allows short key, relative path, and full allowlisted URL");
}

{
  // Bug DK: short-key `../` escaped the bucket allowlist after path join.
  assert.equal(resolveOpenBmcUrl("../evil-bucket/x.json"), null);
  assert.equal(resolveOpenBmcUrl("quotes/../../other/x.json"), null);
  assert.equal(resolveOpenBmcUrl("bmc-cotizaciones/../other/x.json"), null);
  assert.equal(resolveOpenBmcUrl("%2e%2e/evil/x.json"), null);
  assert.equal(resolveOpenBmcUrl("quotes%2f..%2f..%2fother/x.json"), null);
  ok("rejects path-traversal short keys (Bug DK)");
}

{
  assert.equal(
    resolveOpenBmcUrl("https://storage.googleapis.com/bmc-cotizaciones/../evil/x.json"),
    null,
  );
  assert.equal(
    resolveOpenBmcUrl("https://evil.example/bmc-cotizaciones/x.json"),
    null,
  );
  assert.equal(
    resolveOpenBmcUrl("https://storage.googleapis.com.evil.com/bmc-cotizaciones/x.json"),
    null,
  );
  assert.equal(
    resolveOpenBmcUrl("http://storage.googleapis.com/bmc-cotizaciones/x.json"),
    null,
  );
  assert.equal(
    resolveOpenBmcUrl("https://storage.googleapis.com/other-bucket/x.json"),
    null,
  );
  assert.equal(resolveOpenBmcUrl(""), null);
  assert.equal(resolveOpenBmcUrl(null), null);
  ok("rejects non-allowlisted hosts/schemes/buckets");
}

{
  const withQuery = resolveOpenBmcUrl(
    "https://storage.googleapis.com/bmc-cotizaciones/quotes/bmc-json/foo.bmc.json?alt=media#frag",
  );
  assert.equal(
    withQuery,
    "https://storage.googleapis.com/bmc-cotizaciones/quotes/bmc-json/foo.bmc.json",
  );
  assert.equal(
    isAllowedOpenBmcUrl("https://storage.googleapis.com/bmc-cotizaciones/quotes/x.bmc.json"),
    true,
  );
  assert.equal(
    isAllowedOpenBmcUrl("https://storage.googleapis.com/bmc-cotizaciones/"),
    false,
  );
  ok("strips query/hash and validates bucket object path");
}

console.log(`openBmcUrl: ${passed} passed`);
