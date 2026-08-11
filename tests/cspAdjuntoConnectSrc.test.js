/**
 * Parity: Vercel CSP connect-src must allow every host the adjunto server allowlist permits
 * for browser-fallback PDF fetch (plus googleusercontent CDN wildcard used by Drive redirects).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ADJUNTO_ALLOWED_HOSTS } from "../server/lib/enviosAdjuntoFetch.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));

const csp = vercel.headers
  .flatMap((h) => h.headers || [])
  .find((h) => h.key === "Content-Security-Policy")?.value;

assert.ok(csp, "vercel.json must define Content-Security-Policy");

const connectMatch = csp.match(/connect-src ([^;]+)/);
assert.ok(connectMatch, "CSP must include connect-src");
const connectSrc = connectMatch[1];

console.log("cspAdjuntoConnectSrc — exact hosts from ADJUNTO_ALLOWED_HOSTS");
for (const host of ADJUNTO_ALLOWED_HOSTS) {
  const token = `https://${host}`;
  assert.ok(
    connectSrc.includes(token),
    `connect-src missing ${token} (keep vercel.json CSP in sync with enviosAdjuntoFetch)`,
  );
}

console.log("cspAdjuntoConnectSrc — Drive redirect CDN wildcard + new content host");
assert.ok(
  connectSrc.includes("https://*.googleusercontent.com"),
  "connect-src must allow https://*.googleusercontent.com for Drive redirects",
);
assert.ok(
  connectSrc.includes("https://drive.usercontent.google.com"),
  "connect-src must allow https://drive.usercontent.google.com (Drive uc download 303, 2026+)",
);

// Review feedback: do not use broader *.dropboxusercontent.com than server allowlist
assert.ok(
  !connectSrc.includes("https://*.dropboxusercontent.com"),
  "prefer exact https://dl.dropboxusercontent.com over *.dropboxusercontent.com",
);

console.log("cspAdjuntoConnectSrc — OK");
