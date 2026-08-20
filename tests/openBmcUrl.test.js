/**
 * openBmc GCS allowlist + path-traversal hardening.
 * Run: node tests/openBmcUrl.test.js
 */
import { resolveOpenBmcUrl, OPEN_BMC_GCS_PREFIX } from "../src/utils/openBmcUrl.js";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

const okFull =
  "https://storage.googleapis.com/bmc-cotizaciones/quotes/bmc-json/Sory-IsoRoof-Foil-30.bmc.json";
assert(resolveOpenBmcUrl(okFull) === okFull, "full GCS URL allowed");

assert(
  resolveOpenBmcUrl("Sory-IsoRoof-Foil-30") ===
    `${OPEN_BMC_GCS_PREFIX}quotes/bmc-json/Sory-IsoRoof-Foil-30.bmc.json`,
  "short key expands under quotes/bmc-json",
);

assert(
  resolveOpenBmcUrl("quotes/bmc-json/foo.bmc.json") ===
    `${OPEN_BMC_GCS_PREFIX}quotes/bmc-json/foo.bmc.json`,
  "slash key stays in bucket",
);

assert(resolveOpenBmcUrl("../other-public-bucket/evil.json") === null, "reject ../ escape");
assert(resolveOpenBmcUrl("%2e%2e/other-public-bucket/evil.json") === null, "reject %2e%2e escape");
assert(resolveOpenBmcUrl("quotes/../other/evil.json") === null, "reject mid-path ..");
assert(
  resolveOpenBmcUrl("https://storage.googleapis.com/bmc-cotizaciones/../other/evil.json") === null,
  "reject https traversal out of bucket",
);
assert(
  resolveOpenBmcUrl("https://storage.googleapis.com/other-bucket/evil.json") === null,
  "reject other bucket host path",
);
assert(resolveOpenBmcUrl("https://evil.example/x.json") === null, "reject non-GCS host");
assert(resolveOpenBmcUrl("http://storage.googleapis.com/bmc-cotizaciones/x.json") === null, "reject http");
assert(resolveOpenBmcUrl("") === null, "empty null");
assert(
  resolveOpenBmcUrl("not-a-json-file") ===
    `${OPEN_BMC_GCS_PREFIX}quotes/bmc-json/not-a-json-file.bmc.json`,
  "short key gets .bmc.json suffix",
);
assert(resolveOpenBmcUrl("quotes/bmc-json/../ok.json") === null, "reject any .. segment in short key");

console.log(`\nopenBmcUrl: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
