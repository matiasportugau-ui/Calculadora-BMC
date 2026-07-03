#!/usr/bin/env node
/**
 * panelin-live-env-bootstrap.mjs — sync local .env for Panelin Live E2E (no secrets printed).
 *
 * Pulls OPENAI_API_KEY + API_AUTH_TOKEN from Doppler when available.
 * Optionally sets GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN from env (never logs values).
 *
 * Usage:
 *   node scripts/panelin-live-env-bootstrap.mjs
 *   GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=... node scripts/panelin-live-env-bootstrap.mjs
 *   doppler run -- node scripts/panelin-live-env-bootstrap.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ENV_PATH = resolve(ROOT, ".env");

const KEYS = [
  "OPENAI_API_KEY",
  "API_AUTH_TOKEN",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
];

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

const MIN_LEN = {
  OPENAI_API_KEY: 20,
  API_AUTH_TOKEN: 16,
  GOOGLE_CLIENT_SECRET: 8,
  GOOGLE_REFRESH_TOKEN: 20,
};

function readEnvFile(key) {
  // Read directly (no existsSync-then-read TOCTOU window) — a missing file
  // just means "no existing content yet", same as the prior existsSync guard.
  let text;
  try {
    text = readFileSync(ENV_PATH, "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    return "";
  }
  const line = text.split("\n").find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : "";
}

function isPlausible(key, value) {
  const min = MIN_LEN[key] ?? 1;
  return Boolean(value) && value.length >= min;
}

function resolveValue(key) {
  const fromEnv = (process.env[key] || "").trim();
  const fromFile = readEnvFile(key);
  const fromDoppler =
    key === "OPENAI_API_KEY" || key === "API_AUTH_TOKEN" ? dopplerGet(key) : "";

  const candidates = [fromEnv, fromDoppler, fromFile].filter((v) => isPlausible(key, v));
  if (!candidates.length) return fromEnv || fromDoppler || fromFile;
  return candidates.sort((a, b) => b.length - a.length)[0];
}

function upsertEnv(key, value) {
  if (!value) return false;
  // Read directly (no existsSync-then-read TOCTOU window) — a missing file
  // just means "no existing content yet", same as the prior existsSync guard.
  let text = "";
  try {
    text = readFileSync(ENV_PATH, "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  // key always comes from the hardcoded KEYS list above, never external input —
  // escaped anyway so this matches the same safe pattern used elsewhere.
  const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=.*$`, "m");
  const line = `${key}=${value}`;
  // Replacer function, not a replacement string — `value` may contain `$&`/`$$`/etc.,
  // which String.replace() would otherwise interpret as special replacement patterns.
  if (re.test(text)) {
    text = text.replace(re, () => line);
  } else {
    if (text.length && !text.endsWith("\n")) text += "\n";
    text += `\n# panelin-live-env-bootstrap\n${line}\n`;
  }
  writeFileSync(ENV_PATH, text, "utf8");
  return true;
}

const CANONICAL_CLIENT_ID =
  "642127786762-hbkkonaqp9vvfk2qa9sv5go4bd8u4sj3.apps.googleusercontent.com";
const localClient =
  resolveValue("VITE_GOOGLE_CLIENT_ID")
  || readEnvFile("VITE_GOOGLE_CLIENT_ID")
  || readEnvFile("GOOGLE_OAUTH_CLIENT_ID");

const results = [];
for (const key of KEYS) {
  const value = resolveValue(key);
  const wrote = upsertEnv(key, value);
  results.push({ key, len: value.length, wrote });
}

console.log("\nPanelin Live — env bootstrap\n");
for (const { key, len, wrote } of results) {
  const mark = len > 8 ? "✓" : "✗";
  const action = wrote ? "synced" : len > 8 ? "unchanged" : "missing";
  console.log(`  ${mark}  ${key}: ${len} chars (${action})`);
}

const lenOf = (key) => results.find((r) => r.key === key)?.len ?? 0;
const googleOk = lenOf("GOOGLE_CLIENT_SECRET") > 8 && lenOf("GOOGLE_REFRESH_TOKEN") > 8;
const apiOk = lenOf("API_AUTH_TOKEN") > 8;
const openaiOk = lenOf("OPENAI_API_KEY") > 8;

if (localClient && localClient !== CANONICAL_CLIENT_ID) {
  console.log("\n⚠  VITE_GOOGLE_CLIENT_ID local ≠ prod (hbkkona…sj3).");
  console.log("   mint-tour-session exige el MISMO OAuth client que prod/TOUR_GOOGLE_*.");
  console.log("   Usá el client web de prod o alineá .env con .env.example.");
}

console.log("\nNext:");
if (!googleOk) {
  console.log("  1. Client secret (sin <> en zsh):");
  console.log("     node scripts/set-env-key.mjs GOOGLE_CLIENT_SECRET 'GOCSPX-tu-secreto'");
  console.log("     GCP: https://console.cloud.google.com/apis/credentials?project=chatbot-bmc-live");
  console.log("  2. Redirect URI en ese client: http://127.0.0.1:8765/callback");
  console.log("  3. Refresh token: npm run oauth:tour-refresh");
  console.log("     (alternativa: OAuth Playground — docs/product/README.md)");
}
if (googleOk) console.log("  node scripts/mint-tour-session.mjs");
if (apiOk && openaiOk) console.log("  npm run probe:panelin-live-voice");
console.log("  npm run panelin-live:setup-check");
console.log("");

process.exit(googleOk && apiOk && openaiOk ? 0 : 1);