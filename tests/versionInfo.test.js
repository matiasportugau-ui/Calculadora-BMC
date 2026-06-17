// ═══════════════════════════════════════════════════════════════════════════
// Unit test for buildVersionInfo() — the payload served at GET /version.
// Run: node tests/versionInfo.test.js
// Offline (no server, no network): exercises the pure builder directly.
// ═══════════════════════════════════════════════════════════════════════════
import { createRequire } from "node:module";
import { buildVersionInfo } from "../server/lib/versionInfo.js";
import { CALCULATOR_DATA_VERSION } from "../src/data/calculatorDataVersion.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

let passed = 0;
let failed = 0;
function assert(name, cond, actual, expected) {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed += 1;
    return;
  }
  console.log(`  ❌ ${name} — got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`);
  failed += 1;
}

console.log("\n═══ versionInfo: GET /version payload ═══");

const v = buildVersionInfo();

assert("ok === true", v.ok === true, v.ok, true);

for (const k of [
  "version",
  "gitSha",
  "calculatorDataVersion",
  "calculatorDataVersionDate",
  "builtAt",
  "deployedAt",
  "node",
  "startedAt",
]) {
  assert(`has key "${k}"`, Object.prototype.hasOwnProperty.call(v, k), Object.keys(v), k);
}

assert("version matches package.json", v.version === pkg.version, v.version, pkg.version);
assert(
  "calculatorDataVersion matches generated constant",
  v.calculatorDataVersion === CALCULATOR_DATA_VERSION,
  v.calculatorDataVersion,
  CALCULATOR_DATA_VERSION,
);
assert("node === process.version", v.node === process.version, v.node, process.version);
assert(
  "gitSha is null or string",
  v.gitSha === null || typeof v.gitSha === "string",
  typeof v.gitSha,
  "null|string",
);
assert(
  "startedAt is an ISO timestamp",
  typeof v.startedAt === "string" && !Number.isNaN(Date.parse(v.startedAt)),
  v.startedAt,
  "ISO-8601",
);

// gitSha reflects the build-injected env var when present.
const prevSha = process.env.GIT_SHA;
process.env.GIT_SHA = "deadbeefcafe1234";
assert(
  "reflects GIT_SHA env",
  buildVersionInfo().gitSha === "deadbeefcafe1234",
  buildVersionInfo().gitSha,
  "deadbeefcafe1234",
);
if (prevSha === undefined) delete process.env.GIT_SHA;
else process.env.GIT_SHA = prevSha;

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
