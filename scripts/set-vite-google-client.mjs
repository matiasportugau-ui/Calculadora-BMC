#!/usr/bin/env node
/**
 * Escribe o actualiza VITE_GOOGLE_CLIENT_ID en .env.local (no toca .env).
 *
 * Uso:
 *   node scripts/set-vite-google-client.mjs --set 'xxx.apps.googleusercontent.com'
 *   node scripts/set-vite-google-client.mjs 'xxx.apps.googleusercontent.com'
 *   npm run drive:configure
 *   echo "$ID" | node scripts/set-vite-google-client.mjs
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envLocal = path.join(root, ".env.local");
const MARKER = "# Google Drive (GIS) — set-vite-google-client.mjs";

function parseArgId(argv) {
  const setIdx = argv.indexOf("--set");
  if (setIdx !== -1 && argv[setIdx + 1]) return argv[setIdx + 1];
  const first = argv[0];
  if (first && !first.startsWith("-")) return first;
  return null;
}

function looksLikePlaceholder(raw) {
  const s = (raw || "").toLowerCase();
  return (
    /peg[áa]_?tu|paste[_-]?here|your[_-]?client|example\.com|changeme|replace[_-]?me/i.test(
      raw || ""
    ) || s === "chatbot-bmc-live"
  );
}

function validateId(raw) {
  const id = (raw || "").trim().replace(/\r$/, "");
  if (!id) return { ok: false, err: "vacío", id: "" };
  if (looksLikePlaceholder(id))
    return { ok: false, err: "parece placeholder o ID de proyecto GCP, no un Client ID OAuth", id };
  if (/\s/.test(id)) return { ok: false, err: "no debe contener espacios", id };
  if (!/\.apps\.googleusercontent\.com$/i.test(id)) {
    return {
      ok: false,
      err: "debe terminar en .apps.googleusercontent.com",
      id,
    };
  }
  if (id.length < 30) return { ok: false, err: "demasiado corto", id };
  return { ok: true, id };
}

function upsertEnvLocal(clientId) {
  let lines = [];
  if (fs.existsSync(envLocal)) {
    lines = fs.readFileSync(envLocal, "utf8").split(/\r?\n/);
  }
  const key = "VITE_GOOGLE_CLIENT_ID";
  const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (idx >= 0) {
    lines[idx] = `${key}=${clientId}`;
  } else {
    if (lines.length && lines[lines.length - 1] !== "") lines.push("");
    if (!lines.some((l) => l.includes(MARKER))) lines.push(MARKER);
    lines.push(`${key}=${clientId}`);
  }
  fs.writeFileSync(envLocal, lines.join("\n").replace(/\n+$/, "\n"), "utf8");
}

async function readClientId(argv) {
  const fromCli = parseArgId(argv);
  if (fromCli) return fromCli;
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    const line = Buffer.concat(chunks).toString("utf8").trim();
    if (line) return line;
  }
  const rl = readline.createInterface({ input, output });
  try {
    return (
      await rl.question("Pegá el Client ID (.apps.googleusercontent.com): ")
    ).trim();
  } finally {
    rl.close();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(`Uso:
  npm run drive:configure
  node scripts/set-vite-google-client.mjs --set '<client-id>'
  echo '<client-id>' | node scripts/set-vite-google-client.mjs`);
    process.exit(0);
  }

  const raw = await readClientId(argv);
  const v = validateId(raw);
  if (!v.ok) {
    console.error(`[drive:configure] Client ID inválido (${v.err}).`);
    process.exit(1);
  }
  upsertEnvLocal(v.id);
  console.log(`[drive:configure] Guardado en .env.local`);

  const verifyPath = path.join(root, "scripts/verify-google-drive-oauth-env.mjs");
  if (!fs.existsSync(verifyPath)) {
    console.warn("[drive:configure] Falta verify-google-drive-oauth-env.mjs");
    process.exit(0);
  }
  const r = spawnSync(process.execPath, [verifyPath], {
    cwd: root,
    stdio: "inherit",
  });
  process.exit(r.status ?? 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
