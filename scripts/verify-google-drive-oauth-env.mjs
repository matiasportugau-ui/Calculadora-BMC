#!/usr/bin/env node
/**
 * Verifica que exista VITE_GOOGLE_CLIENT_ID con formato razonable para GIS (Drive).
 * No llama a Google: un 401 invalid_client solo se resuelve creando/actualizando el cliente en GCP.
 *
 * Uso: node scripts/verify-google-drive-oauth-env.mjs
 *      npm run verify:google-drive-oauth
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const out = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v.replace(/\r$/, "");
  }
  return out;
}

// Misma prioridad efectiva que Vite: .env.local sobrescribe .env
const fromEnv = parseEnvFile(path.join(root, ".env"));
const fromLocal = parseEnvFile(path.join(root, ".env.local"));
const merged = { ...fromEnv, ...fromLocal };
const id = (merged.VITE_GOOGLE_CLIENT_ID || "").trim();

function mask(s) {
  if (s.length <= 24) return `${s.slice(0, 6)}…`;
  return `${s.slice(0, 10)}…${s.slice(-18)}`;
}

if (!id) {
  console.error(
    "[verify:google-drive-oauth] Falta VITE_GOOGLE_CLIENT_ID en .env o .env.local."
  );
  console.error(
    "  Creá un cliente OAuth tipo «Web application» en Google Cloud y copiá el Client ID."
  );
  console.error(
    "  Guía: docs/GOOGLE_DRIVE_SETUP_PROMPT.md — o: ./run_drive_setup.sh '<tu-client-id>'"
  );
  process.exit(1);
}

// Client IDs de Google suelen terminar en .apps.googleusercontent.com
const looksGoogle = /\.apps\.googleusercontent\.com$/i.test(id);
const noSpaces = !/\s/.test(id);
if (!looksGoogle || !noSpaces || id.length < 30) {
  console.error(
    "[verify:google-drive-oauth] VITE_GOOGLE_CLIENT_ID no parece un Client ID de Google."
  );
  console.error(`  Valor (enmascarado): ${mask(id)}`);
  process.exit(1);
}

console.log(
  `[verify:google-drive-oauth] OK — Client ID cargado: ${mask(id)} (origen: ${
    fromLocal.VITE_GOOGLE_CLIENT_ID ? ".env.local" : ".env"
  })`
);
console.log(
  "  Si Google muestra 401 invalid_client / «OAuth client was not found», el ID no existe en GCP o es de otro proyecto: creá o corregé el cliente y actualizá la variable + reiniciá Vite."
);
process.exit(0);
