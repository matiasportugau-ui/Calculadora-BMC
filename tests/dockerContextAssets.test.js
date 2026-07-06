/**
 * Guard the Cloud Run API Docker build context.
 *
 * server/Dockerfile copies selected frontend/static assets from the repo root.
 * If .dockerignore excludes the parent directory itself, nested exceptions such
 * as !public/bmc-pdf/** are not reliable and deploy builds can fail at COPY.
 *
 * Run: node tests/dockerContextAssets.test.js
 */
import { existsSync, readFileSync } from "node:fs";

let passed = 0;
let failed = 0;

function assert(name, cond, actual = null, expected = true) {
  if (cond) {
    console.log(`  ok - ${name}`);
    passed += 1;
    return;
  }
  console.error(`  not ok - ${name}`);
  if (actual !== null) {
    console.error(`    got: ${JSON.stringify(actual)}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
  }
  failed += 1;
}

function dockerignoreLines() {
  return readFileSync(".dockerignore", "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

console.log("\n--- docker context assets ---");

const lines = dockerignoreLines();
const dockerfile = readFileSync("server/Dockerfile", "utf8");

assert(
  "Dockerfile copies PDF branding assets",
  dockerfile.includes("COPY public/bmc-pdf ./public/bmc-pdf"),
  dockerfile,
  "COPY public/bmc-pdf ./public/bmc-pdf",
);

assert(
  "tracked BMC PDF logo exists",
  existsSync("public/bmc-pdf/assets/bmc-logo.png"),
  "missing public/bmc-pdf/assets/bmc-logo.png",
  "file exists",
);

assert(
  ".dockerignore does not exclude public parent directory",
  !lines.some((line) => line === "public" || line === "public/" || line === "/public" || line === "/public/"),
  lines,
  "no bare public exclusion",
);

assert(
  ".dockerignore excludes public children by default",
  lines.includes("public/*") || lines.includes("/public/*"),
  lines,
  "public/*",
);

assert(
  ".dockerignore re-includes bmc-pdf directory before nested files",
  lines.includes("!public/bmc-pdf/") || lines.includes("!/public/bmc-pdf/"),
  lines,
  "!public/bmc-pdf/",
);

assert(
  ".dockerignore re-includes bmc-pdf contents",
  lines.includes("!public/bmc-pdf/**") || lines.includes("!/public/bmc-pdf/**"),
  lines,
  "!public/bmc-pdf/**",
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
