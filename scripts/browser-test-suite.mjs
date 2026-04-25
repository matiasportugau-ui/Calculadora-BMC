/**
 * BMC Browser Test Suite — full automated browser + API smoke runner.
 *
 * Uso:
 *   node scripts/browser-test-suite.mjs           # prod (default)
 *   node scripts/browser-test-suite.mjs --prod    # explicit prod
 *   node scripts/browser-test-suite.mjs --local   # local (requiere npm run dev:full en :5173/:3001)
 *
 * npm aliases:
 *   npm run test:browser:full         # prod
 *   npm run test:browser:full:local   # local
 *
 * Exit 0 = all ran tests passed. Exit 1 = one or more failed.
 */
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, "..");

const args = process.argv.slice(2);
const LOCAL = args.includes("--local");
const MODE = LOCAL ? "local" : "prod";

const PROD_FRONT = "https://calculadora-bmc.vercel.app";
const PROD_API   = "https://panelin-calc-q74zutv7dq-uc.a.run.app";
const LOCAL_FRONT = "http://127.0.0.1:5173";
const LOCAL_API   = "http://localhost:3001";

const BASE_URL = LOCAL ? LOCAL_FRONT : PROD_FRONT;
const API_URL  = LOCAL ? LOCAL_API  : PROD_API;

// ── test definitions ──────────────────────────────────────────────────────────
// localOnly: skipped when mode=prod; always: always run regardless of mode
const TESTS = [
  {
    name: "Calculator wizard (prod)",
    cmd: "node",
    argv: ["tests/e2e-browser.mjs"],
    env: {},
    always: true,
  },
  {
    name: "ML cockpit AUTOMATISMOS",
    cmd: "node",
    argv: ["scripts/playwright-ml-cockpit-smoke.mjs"],
    env: { PLAYWRIGHT_BASE_URL: BASE_URL },
    always: true,
  },
  {
    name: "ML auto-mode API smoke",
    cmd: "bash",
    argv: ["scripts/test-ml-auto-mode.sh", API_URL],
    env: {},
    always: true,
  },
  {
    name: "Hub canales smoke",
    cmd: "node",
    argv: ["scripts/playwright-hub-canales-smoke.mjs"],
    env: { PLAYWRIGHT_BASE_URL: BASE_URL },
    localOnly: true,
  },
  {
    name: "Wizard happy path (BOM)",
    cmd: "node",
    argv: ["scripts/playwright-wizard-happy-path.mjs"],
    env: { PLAYWRIGHT_BASE_URL: BASE_URL },
    localOnly: true,
  },
];

// ── runner ────────────────────────────────────────────────────────────────────
function runTest(def) {
  return new Promise(resolve => {
    const start = Date.now();
    const proc = spawn(def.cmd, def.argv, {
      cwd: ROOT,
      env: { ...process.env, ...def.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", d => { stdout += d; });
    proc.stderr.on("data", d => { stderr += d; });
    proc.on("close", code => {
      resolve({
        name: def.name,
        code,
        stdout,
        stderr,
        duration: ((Date.now() - start) / 1000).toFixed(1) + "s",
      });
    });
  });
}

function extractSummary(stdout) {
  // RESULTADO: N/M checks passed (e2e-browser, ml-cockpit-smoke)
  const r1 = stdout.match(/RESULTADO:\s*(\d+\/\d+[^\n]*passed[^\n]*)/i);
  if (r1) return r1[1].replace(/ — .*$/, "").trim();
  // RESULTADOS: N passed, M failed (wizard-happy-path)
  const r2 = stdout.match(/RESULTADOS:\s*(\d+ passed[^\n]*)/i);
  if (r2) return r2[1].trim();
  // PASS: N / FAIL: M (test-ml-auto-mode.sh style)
  const r3 = stdout.match(/PASS[:\s]+(\d+).*FAIL[:\s]+(\d+)/i);
  if (r3) return `${r3[1]} pass / ${r3[2]} fail`;
  // OK url (hub-canales)
  if (/^\s*OK\s+http/m.test(stdout)) return "1/1 checks passed";
  return "";
}

// ── header ────────────────────────────────────────────────────────────────────
const LINE = "─".repeat(68);
const ts = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
console.log(`\n${LINE}`);
console.log(` BMC Browser Test Suite · ${ts} · mode: ${MODE}`);
console.log(LINE);

const results = [];

for (const def of TESTS) {
  const skip = def.localOnly && !LOCAL;
  const label = def.name.padEnd(38);
  if (skip) {
    process.stdout.write(`  \x1b[90m⏭   ${label}  skip  (local only)\x1b[0m\n`);
    results.push({ name: def.name, skipped: true });
    continue;
  }
  process.stdout.write(`  \x1b[90m…   ${label}\x1b[0m`);
  const r = await runTest(def);
  const ok = r.code === 0;
  const icon = ok ? "\x1b[32m✅\x1b[0m" : "\x1b[31m❌\x1b[0m";
  const summary = extractSummary(r.stdout + r.stderr);
  // overwrite the "…" line
  process.stdout.write(`\r  ${icon}  ${label}  ${r.duration.padEnd(6)}  ${summary}\n`);
  results.push({ ...r, ok });
}

// ── summary table ─────────────────────────────────────────────────────────────
const ran    = results.filter(r => !r.skipped);
const passed = ran.filter(r => r.ok).length;
const failed = ran.filter(r => !r.ok).length;
const skipped = results.filter(r => r.skipped).length;
const totalMs = ran.reduce((acc, r) => acc + parseFloat(r.duration || 0), 0).toFixed(1);

console.log(LINE);
const resultLine = `  ${failed === 0 ? "\x1b[32m" : "\x1b[31m"}${passed} passed · ${failed} failed · ${skipped} skipped · ${totalMs}s total\x1b[0m`;
console.log(resultLine);
console.log(LINE + "\n");

// ── failed test output ────────────────────────────────────────────────────────
for (const r of ran.filter(r => !r.ok)) {
  console.log(`\x1b[31m── FAILED: ${r.name} ──\x1b[0m`);
  const out = (r.stdout + r.stderr).trim();
  console.log(out.slice(-2000));  // last 2000 chars to avoid flooding
  console.log();
}

process.exit(failed > 0 ? 1 : 0);
