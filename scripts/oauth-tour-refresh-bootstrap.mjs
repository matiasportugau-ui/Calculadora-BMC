#!/usr/bin/env node
/**
 * oauth-tour-refresh-bootstrap.mjs — one-time Google refresh token for mint-tour-session.
 *
 * Opens browser OAuth (openid email profile), captures code on localhost, writes
 * GOOGLE_REFRESH_TOKEN to .env. Requires GOOGLE_CLIENT_SECRET in .env or env.
 *
 * Prereq: add http://127.0.0.1:8765/callback to Authorized redirect URIs
 *         on the same OAuth Web client as VITE_GOOGLE_CLIENT_ID.
 *
 * Usage: node scripts/oauth-tour-refresh-bootstrap.mjs
 */
import dotenv from "dotenv";
import http from "node:http";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

dotenv.config();

const ROOT = resolve(import.meta.dirname, "..");
const ENV_PATH = resolve(ROOT, ".env");
const PORT = Number(process.env.OAUTH_TOUR_PORT || 8765);
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = ["openid", "email", "profile"].join(" ");

const CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID
  || process.env.GOOGLE_OAUTH_CLIENT_ID
  || process.env.VITE_GOOGLE_CLIENT_ID
  || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

function die(msg) {
  process.stderr.write(`[oauth-tour] ${msg}\n`);
  process.exit(1);
}

if (!CLIENT_ID) die("falta VITE_GOOGLE_CLIENT_ID (o GOOGLE_OAUTH_CLIENT_ID) en .env");
if (!CLIENT_SECRET || CLIENT_SECRET.length < 8) {
  die(
    "falta GOOGLE_CLIENT_SECRET en .env — GCP Console → Credenciales → OAuth Web client → Client secret",
  );
}

function upsertRefreshToken(token) {
  // Read directly (no existsSync-then-read TOCTOU window) — a missing file just
  // means "no existing content yet", same as the prior existsSync guard.
  let text = "";
  try {
    text = readFileSync(ENV_PATH, "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const re = /^GOOGLE_REFRESH_TOKEN=.*$/m;
  const line = `GOOGLE_REFRESH_TOKEN=${token}`;
  if (re.test(text)) text = text.replace(re, line);
  else {
    if (text.length && !text.endsWith("\n")) text += "\n";
    text += `\n# oauth-tour-refresh-bootstrap\n${line}\n`;
  }
  writeFileSync(ENV_PATH, text, "utf8");
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

process.stderr.write(`[oauth-tour] Redirect URI: ${REDIRECT_URI}\n`);
process.stderr.write("[oauth-tour] Abrí el navegador y logueate con la cuenta de prueba BMC (sin MFA).\n");

try {
  execSync(`open "${authUrl.toString()}"`, { stdio: "ignore" });
} catch {
  process.stderr.write(`[oauth-tour] Abrí manualmente:\n${authUrl.toString()}\n`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  if (url.pathname !== "/callback") {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  if (err || !code) {
    res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    res.end(`OAuth error: ${err || "missing code"}`);
    server.close();
    die(err || "missing authorization code");
    return;
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.refresh_token) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    const detail = [tokenJson.error, tokenJson.error_description].filter(Boolean).join(" — ");
    res.end(`Token exchange failed: ${detail || tokenRes.status}`);
    server.close();
    die(detail || `HTTP ${tokenRes.status}`);
    return;
  }

  upsertRefreshToken(tokenJson.refresh_token);
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end("<h1>OK</h1><p>GOOGLE_REFRESH_TOKEN guardado en .env. Podés cerrar esta pestaña.</p>");
  server.close();
  process.stderr.write("[oauth-tour] GOOGLE_REFRESH_TOKEN guardado en .env\n");
  process.stderr.write("[oauth-tour] Verificá: BMC_API_BASE=http://127.0.0.1:5173 node scripts/mint-tour-session.mjs\n");
  process.exit(0);
});

server.listen(PORT, "127.0.0.1", () => {
  process.stderr.write(`[oauth-tour] Escuchando en ${REDIRECT_URI}\n`);
});

setTimeout(() => {
  server.close();
  die("timeout 5 min — reintentá");
}, 5 * 60 * 1000);