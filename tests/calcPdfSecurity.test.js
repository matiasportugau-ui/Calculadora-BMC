// Static guard for /calc/cotizar/pdf hardening. This endpoint is public by
// design but now launches Chromium and can upload PDF artifacts, so it must
// keep an explicit per-IP limiter at the route registration site.

import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const calcRoute = fs.readFileSync(path.join(REPO_ROOT, "server/routes/calc.js"), "utf8");

let failures = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  OK ${message}`);
    return;
  }
  failures += 1;
  console.error(`  FAIL ${message}`);
}

assert(
  /import\s+rateLimit\s+from\s+["']express-rate-limit["'];/.test(calcRoute),
  "calc route imports express-rate-limit",
);
assert(
  /const\s+cotizarPdfLimiter\s*=\s*rateLimit\(\{[\s\S]*?max:\s*10[\s\S]*?\}\);/.test(calcRoute),
  "cotizarPdfLimiter is defined with a bounded per-minute max",
);
assert(
  /router\.post\(\s*["']\/cotizar\/pdf["']\s*,\s*cotizarPdfLimiter\s*,\s*requireUser\(\{\s*optional:\s*true\s*\}\)/.test(calcRoute),
  "POST /cotizar/pdf mounts the limiter before optional auth and handler",
);

if (failures) process.exit(1);
console.log("calcPdfSecurity.test.js passed");
