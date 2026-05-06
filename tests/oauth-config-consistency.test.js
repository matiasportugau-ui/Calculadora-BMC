// Regression guard for Google OAuth client ID drift.
// Run: node tests/oauth-config-consistency.test.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function parseEnvFile(filePath) {
  const out = {};
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function getCanonicalClientId() {
  const doc = fs.readFileSync(
    path.join(root, "docs/master-plans/user-identity-GOLIVE.md"),
    "utf8",
  );
  const match = doc.match(
    /The production GOOGLE_OAUTH_CLIENT_ID[\s\S]*?#\s+([0-9a-z-]+\.apps\.googleusercontent\.com)/,
  );
  if (!match) {
    throw new Error("Could not find canonical GOOGLE_OAUTH_CLIENT_ID in GOLIVE doc");
  }
  return match[1];
}

const envExample = parseEnvFile(path.join(root, ".env.example"));
const canonicalClientId = getCanonicalClientId();

const failures = [];
for (const key of ["VITE_GOOGLE_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_ID"]) {
  if (envExample[key] !== canonicalClientId) {
    failures.push(`${key}=${envExample[key] || "(missing)"}`);
  }
}

if (failures.length) {
  console.error("Google OAuth Client ID drift detected:");
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(`  canonical=${canonicalClientId}`);
  process.exit(1);
}

console.log("Google OAuth config consistency OK");
