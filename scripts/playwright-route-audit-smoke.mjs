/**
 * Route audit smoke — visits critical UI routes and asserts no unexpected
 * console errors or 4xx/5xx network failures. Modeled after the manual
 * browser-agent audit done via Chrome DevTools MCP.
 *
 * Usage:
 *   node scripts/playwright-route-audit-smoke.mjs                    # local (default)
 *   node scripts/playwright-route-audit-smoke.mjs --base=https://... # remote
 *
 * Requires (when --local): API on :3001 and Vite on :5173 already running.
 *
 * Exit 0 = all routes clean. Exit 1 = unexpected console error or failed request.
 */
import { chromium } from "playwright";

const args = process.argv.slice(2);
const baseArg = args.find((a) => a.startsWith("--base="));
const BASE = baseArg ? baseArg.slice(7).replace(/\/$/, "") : "http://localhost:5173";

const ROUTES = [
  { path: "/", label: "Calculadora (anonymous)" },
  { path: "/hub", label: "Wolfboard Hub" },
  { path: "/hub/wa", label: "WA Cockpit (auth-gated)" },
  { path: "/logistica", label: "Logística" },
];

// Known-acceptable failures: anonymous user → /api/auth/* returns 401, that's by design.
const ALLOWED_4XX = [
  { method: "GET",  url: /\/api\/auth\/me$/,      status: 401 },
  { method: "POST", url: /\/api\/auth\/refresh$/, status: 401 },
];

const ALLOWED_CONSOLE_PATTERNS = [
  /Failed to load resource: the server responded with a status of 401/,
];

function isAllowedNetwork(req, res) {
  return ALLOWED_4XX.some((a) => a.method === req.method() && a.url.test(req.url()) && a.status === res.status());
}

function isAllowedConsole(text) {
  return ALLOWED_CONSOLE_PATTERNS.some((re) => re.test(text));
}

const PASS = "\x1b[32m✓\x1b[0m";
const FAIL = "\x1b[31m✗\x1b[0m";
const WARN = "\x1b[33m!\x1b[0m";

let totalFails = 0;

console.log(`\nRoute audit smoke — base: ${BASE}\n`);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

for (const route of ROUTES) {
  const url = `${BASE}${route.path}`;
  const consoleErrors = [];
  const pageErrors = [];
  const badResponses = [];

  const onConsole = (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (isAllowedConsole(text)) return;
    consoleErrors.push(text);
  };
  const onPageError = (err) => pageErrors.push(err.message || String(err));
  const onResponse = (res) => {
    const req = res.request();
    const status = res.status();
    if (status < 400) return;
    if (isAllowedNetwork(req, res)) return;
    badResponses.push(`${req.method()} ${req.url()} → ${status}`);
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  let loadOk = true;
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    if (!res || res.status() >= 400) {
      loadOk = false;
      console.log(`  ${FAIL}  ${route.label}  →  HTTP ${res?.status() ?? "no-response"}`);
      totalFails += 1;
    }
  } catch (e) {
    loadOk = false;
    console.log(`  ${FAIL}  ${route.label}  →  navigation error: ${e.message}`);
    totalFails += 1;
  }

  // Settle: give async fetches in-flight a chance to complete before we cleanup.
  await page.waitForTimeout(1500);

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("response", onResponse);

  if (loadOk) {
    const issues = consoleErrors.length + pageErrors.length + badResponses.length;
    if (issues === 0) {
      console.log(`  ${PASS}  ${route.label}`);
    } else {
      totalFails += 1;
      console.log(`  ${FAIL}  ${route.label}  →  ${issues} issue(s)`);
      for (const e of consoleErrors)  console.log(`       ${WARN} console: ${e}`);
      for (const e of pageErrors)     console.log(`       ${WARN} pageerror: ${e}`);
      for (const e of badResponses)   console.log(`       ${WARN} network: ${e}`);
    }
  }
}

await ctx.close();
await browser.close();

console.log(
  `\n${totalFails === 0 ? PASS : FAIL}  ${ROUTES.length - totalFails}/${ROUTES.length} routes clean\n`,
);
process.exit(totalFails === 0 ? 0 : 1);
