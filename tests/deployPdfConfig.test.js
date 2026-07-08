// Guard the deploy settings needed by the server-side quote PDF renderer.
// The renderer can spend longer than a normal JSON request once a render waits
// behind the Chromium semaphore and then uploads to GCS/Drive.

import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const workflow = fs.readFileSync(
  path.join(REPO_ROOT, ".github/workflows/deploy-calc-api.yml"),
  "utf8",
);
const dockerfile = fs.readFileSync(path.join(REPO_ROOT, "server/Dockerfile"), "utf8");

let failures = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  OK ${message}`);
    return;
  }
  failures += 1;
  console.error(`  FAIL ${message}`);
}

const timeoutMatch = workflow.match(/--timeout=(\d+)/);
const timeoutSeconds = timeoutMatch ? Number(timeoutMatch[1]) : 0;

assert(
  /COTIZAR_PDF_RENDER=\$\{\{\s*vars\.COTIZAR_PDF_RENDER\s*\}\}/.test(workflow),
  "deploy workflow propagates COTIZAR_PDF_RENDER",
);
assert(
  timeoutSeconds >= 300,
  `Cloud Run request timeout supports queued PDF renders (got ${timeoutSeconds}s)`,
);
assert(
  !/COPY\s+public\/bmc-pdf\b/.test(dockerfile),
  "Dockerfile does not COPY the absent public/bmc-pdf asset directory",
);

if (failures) process.exit(1);
console.log("deployPdfConfig.test.js passed");
