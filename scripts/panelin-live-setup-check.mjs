#!/usr/bin/env node
/**
 * panelin-live-setup-check.mjs — prerequisites for /panelin/live E2E + voice probes.
 *
 * Usage: node scripts/panelin-live-setup-check.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

function envFromDotenv(key) {
  if (process.env[key]) return process.env[key];
  const p = resolve(ROOT, ".env");
  // Read directly (no existsSync-then-read TOCTOU window) — a missing file
  // just means "no value found", same as the prior existsSync guard.
  let text;
  try {
    text = readFileSync(p, "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    return "";
  }
  const line = text.split("\n").find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : "";
}

async function probeUrl(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return r.status;
  } catch {
    return 0;
  }
}

const checks = [
  {
    id: "vite",
    label: "Vite dev (:5173)",
    ok: (await probeUrl("http://127.0.0.1:5173/")) === 200,
    fix: "npm run dev  (or npm run dev:full)",
  },
  {
    id: "api",
    label: "Express API (:3001)",
    ok: (await probeUrl("http://127.0.0.1:3001/health")) === 200,
    fix: "npm run start:api  (or npm run dev:full)",
  },
  {
    id: "openai",
    label: "OPENAI_API_KEY (voice Realtime)",
    ok: Boolean(envFromDotenv("OPENAI_API_KEY")),
    fix: "Add OPENAI_API_KEY to .env (or Doppler bmc-backend)",
  },
  {
    id: "api_token",
    label: "API_AUTH_TOKEN (voice probe / service auth)",
    ok: Boolean(envFromDotenv("API_AUTH_TOKEN") || envFromDotenv("API_KEY")),
    fix: "Add API_AUTH_TOKEN=... to .env — same value as prod Cloud Run secret",
  },
  {
    id: "google_refresh",
    label: "GOOGLE_REFRESH_TOKEN + GOOGLE_CLIENT_SECRET (mint-tour-session)",
    ok: Boolean(
      envFromDotenv("GOOGLE_REFRESH_TOKEN")
        && envFromDotenv("GOOGLE_CLIENT_SECRET")
        && (
          envFromDotenv("GOOGLE_CLIENT_ID")
          || envFromDotenv("GOOGLE_OAUTH_CLIENT_ID")
          || envFromDotenv("VITE_GOOGLE_CLIENT_ID")
        ),
    ),
    fix: "docs/product/README.md → OAuth Playground; agregar GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN al .env",
  },
  {
    id: "playwright",
    label: "Playwright Chromium",
    ok: existsSync(resolve(ROOT, "node_modules/playwright")),
    fix: "npm ci  (playwright is a devDependency)",
  },
];

let fail = 0;
console.log("\nPanelin Live — setup check\n");
for (const c of checks) {
  const mark = c.ok ? "✓" : "✗";
  if (!c.ok) fail++;
  console.log(`  ${mark}  ${c.label}`);
  if (!c.ok) console.log(`      → ${c.fix}`);
}

console.log("\nQuick run (after green checks):");
console.log("  npm run probe:panelin-live-voice");
console.log("  TOUR_SESSION_COOKIE=\"$(BMC_API_BASE=http://127.0.0.1:5173 node scripts/mint-tour-session.mjs)\" \\");
console.log("    PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 npm run test:e2e:panelin-live");
console.log("");

process.exit(fail ? 1 : 0);