// Guards dependencies required by server/Dockerfile's production install.
// Run: node tests/serverRuntimeDeps.test.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`  OK ${label}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${label}`);
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8"));
}

console.log("\n=== server runtime dependencies ===");

const pkg = readJson("package.json");
const lock = readJson("package-lock.json");
const dockerfile = fs.readFileSync(path.join(REPO_ROOT, "server/Dockerfile"), "utf8");
const keywordSerp = fs.readFileSync(
  path.join(REPO_ROOT, "server/lib/marketIntel/keywordSerpPlaywright.js"),
  "utf8",
);

assert(
  dockerfile.includes("npm ci --omit=dev") || dockerfile.includes("npm install --omit=dev"),
  "Cloud Run Dockerfile omits devDependencies",
);
assert(keywordSerp.includes("import('playwright')"), "keyword SERP imports playwright at runtime");
assert(!!pkg.dependencies?.playwright, "playwright is a production dependency");
assert(!pkg.devDependencies?.playwright, "playwright is not only a devDependency");
assert(
  !!lock.packages?.[""]?.dependencies?.playwright,
  "package-lock root lists playwright under dependencies",
);
assert(
  !lock.packages?.["node_modules/playwright"]?.dev,
  "package-lock runtime playwright package is not marked dev-only",
);
assert(
  !lock.packages?.["node_modules/playwright-core"]?.dev,
  "package-lock runtime playwright-core package is not marked dev-only",
);

console.log(`\n${failed === 0 ? "OK" : "FAIL"} serverRuntimeDeps: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
