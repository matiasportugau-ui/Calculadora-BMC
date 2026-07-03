#!/usr/bin/env node
/**
 * panelin-live-google-setup.mjs — guided Google OAuth for mint-tour-session.
 *
 * Opens GCP + OAuth Playground, validates .env, runs mint + full-local when ready.
 *
 * Usage:
 *   node scripts/panelin-live-google-setup.mjs
 *   node scripts/panelin-live-google-setup.mjs --mint-only
 */
import { execSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const ROOT = resolve(import.meta.dirname, "..");
const ENV_PATH = resolve(ROOT, ".env");
const mintOnly = process.argv.includes("--mint-only");

// Read directly (no existsSync-then-read TOCTOU window) — a missing file just
// means "no existing content yet", same as the prior existsSync guard.
function readEnvText() {
  try {
    return readFileSync(ENV_PATH, "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    return "";
  }
}

function envLen(key) {
  const line = readEnvText().split("\n").find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim().length : 0;
}

function dopplerGet(key) {
  try {
    return execSync(`doppler secrets get ${key} --plain`, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL || dopplerGet("DATABASE_URL"));
}

function extractSessionCookie(raw) {
  const hex = raw.match(/[a-f0-9]{96}/i);
  return hex ? hex[0] : "";
}

function isValidSessionCookie(value) {
  return /^[a-f0-9]{96}$/i.test(value || "");
}

async function probeUrl(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return r.status;
  } catch {
    return 0;
  }
}

/** Avoid flaky E2E when Vite/API are still booting (common in parallel agent runs). */
async function waitForDevStack(viteBase, apiBase, { attempts = 20, delayMs = 1500 } = {}) {
  const viteUrl = `${viteBase.replace(/\/+$/, "")}/`;
  const apiUrl = `${apiBase.replace(/\/+$/, "")}/health`;
  for (let i = 1; i <= attempts; i++) {
    const vite = await probeUrl(viteUrl);
    const api = await probeUrl(apiUrl);
    if (vite === 200 && api === 200) return true;
    process.stderr.write(`[setup] esperando Vite/API (${i}/${attempts}) vite=${vite || "down"} api=${api || "down"}\n`);
    if (i < attempts) await new Promise((r) => setTimeout(r, delayMs));
  }
  process.stderr.write(`[setup] Vite o API no respondieron — corré: npm run dev:full\n`);
  return false;
}

function clientId() {
  const text = readEnvText();
  for (const key of ["VITE_GOOGLE_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_CLIENT_ID"]) {
    const line = text.split("\n").find((l) => l.startsWith(`${key}=`));
    if (line) return line.slice(key.length + 1).trim();
  }
  return "";
}

const CANONICAL = "642127786762-hbkkonaqp9vvfk2qa9sv5go4bd8u4sj3.apps.googleusercontent.com";
const id = clientId();

console.log("\nPanelin Live — Google OAuth setup\n");
if (id && id !== CANONICAL) {
  console.log("⚠  Client ID local ≠ prod. Usá el secret del client hbkkona…sj3 (prod/CI).\n");
}
console.log(`Client ID en .env: ${id ? id.slice(0, 20) + "…" : "(vacío)"}`);
console.log(`GOOGLE_CLIENT_SECRET: ${envLen("GOOGLE_CLIENT_SECRET")} chars`);
console.log(`GOOGLE_REFRESH_TOKEN: ${envLen("GOOGLE_REFRESH_TOKEN")} chars\n`);

const canLocalMint = hasDatabaseUrl();

if (envLen("GOOGLE_CLIENT_SECRET") < 8 || envLen("GOOGLE_REFRESH_TOKEN") < 20) {
  if (!mintOnly && !canLocalMint) {
    console.log("Abrí GCP Credentials y OAuth Playground…");
    try {
      execSync('open "https://console.cloud.google.com/apis/credentials?project=chatbot-bmc-live"', { stdio: "ignore" });
      execSync('open "https://developers.google.com/oauthplayground"', { stdio: "ignore" });
    } catch { /* headless */ }

    console.log("\n1. GCP → OAuth Web client (hbkkona…sj3) → copiá Client secret");
    console.log("   node scripts/set-env-key.mjs GOOGLE_CLIENT_SECRET 'GOCSPX-…'");
    console.log("\n2. Opción A — local (recomendado): agregá redirect http://127.0.0.1:8765/callback");
    console.log("   npm run oauth:tour-refresh");
    console.log("\n   Opción B — Playground: ⚙️ own credentials, scopes openid email profile");
    console.log("   node scripts/set-env-key.mjs GOOGLE_REFRESH_TOKEN '1//…'");
    console.log("");
  }

  if (!canLocalMint) {
    if (envLen("GOOGLE_CLIENT_SECRET") < 8) process.exit(1);
    if (envLen("GOOGLE_REFRESH_TOKEN") < 20) {
      console.log("Falta GOOGLE_REFRESH_TOKEN — corré: npm run oauth:tour-refresh\n");
      process.exit(1);
    }
  } else if (!mintOnly) {
    console.log("Sin Google OAuth → fallback local: mint-local-e2e-session (DATABASE_URL vía Doppler)\n");
  }
}

const googleOk =
  envLen("GOOGLE_CLIENT_SECRET") >= 8 && envLen("GOOGLE_REFRESH_TOKEN") >= 20;

let cookie = "";
if (googleOk) {
  console.log("Probando mint-tour-session (Google OAuth)…\n");
  const mint = spawnSync("node", ["scripts/mint-tour-session.mjs"], {
    cwd: ROOT,
    env: { ...process.env, BMC_API_BASE: process.env.BMC_API_BASE || "http://127.0.0.1:5173" },
    encoding: "utf8",
  });
  if (mint.status !== 0) {
    process.stderr.write(mint.stderr || mint.stdout || "mint failed\n");
    process.exit(mint.status || 1);
  }
  cookie = extractSessionCookie(mint.stdout || "");
} else {
  console.log("Google OAuth ausente → mint-local-e2e-session (DATABASE_URL)…\n");
  const localEnv = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || dopplerGet("DATABASE_URL"),
  };
  const mint = spawnSync("node", ["scripts/mint-local-e2e-session.mjs"], {
    cwd: ROOT,
    env: localEnv,
    encoding: "utf8",
    shell: false,
  });
  if (mint.status !== 0) {
    process.stderr.write(mint.stderr || mint.stdout || "local mint failed\n");
    process.exit(mint.status || 1);
  }
  cookie = extractSessionCookie(mint.stdout || "");
}

if (!isValidSessionCookie(cookie)) {
  console.error("mint no devolvió cookie válida (96 hex) — revisá DATABASE_URL / Google OAuth");
  process.exit(1);
}
console.log("[OK] bmc_sess minteado\n");

if (mintOnly) {
  console.log(`export TOUR_SESSION_COOKIE='${cookie}'`);
  process.exit(0);
}

const viteBase = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";
const apiBase = process.env.BMC_API_BASE || "http://127.0.0.1:3001";
if (!(await waitForDevStack(viteBase, apiBase))) process.exit(1);

console.log("Corriendo probe + E2E…\n");
// Do not pass TOUR_SESSION_COOKIE to the probe: /auth/refresh rotates bmc_sess and
// would invalidate the cookie Playwright needs moments later.
const probe = spawnSync("npm", ["run", "probe:panelin-live-voice"], {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    TOUR_SESSION_COOKIE: "",
    // E2E L2 mints a user session — skip probe POST to avoid 3/min rate-limit collisions.
    PROBE_SKIP_SESSION_MINT: "1",
  },
});
if (probe.status !== 0) process.exit(probe.status || 1);

const e2e = spawnSync(
  "npx",
  ["playwright", "test", "-c", "playwright.panelin-live.config.ts", "scripts/panelin-live-e2e.spec.ts"],
  {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173",
      TOUR_SESSION_COOKIE: cookie,
    },
  },
);
process.exit(e2e.status || 0);