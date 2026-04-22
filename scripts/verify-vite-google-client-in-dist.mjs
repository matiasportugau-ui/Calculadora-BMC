#!/usr/bin/env node
/**
 * Tras `vite build`, comprueba que el Client ID esperado aparece en al menos un .js del dist.
 * Detecta regresiones donde el build no incrustó VITE_GOOGLE_CLIENT_ID (p. ej. variable ausente en CI).
 *
 * Origen del ID esperado (mismo criterio que verify-google-drive-oauth-env.mjs):
 *   process.env.VITE_GOOGLE_CLIENT_ID, luego .env.local, luego .env
 *
 * Si no hay ID configurado → omitir (exit 0). Si hay ID y no está en dist → exit 1.
 *
 * Uso:
 *   npm run build && npm run verify:google-drive-dist
 *   VITE_GOOGLE_CLIENT_ID='…' npm run build && npm run verify:google-drive-dist
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");

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

function mask(s) {
  if (s.length <= 24) return `${s.slice(0, 6)}…`;
  return `${s.slice(0, 10)}…${s.slice(-18)}`;
}

function looksLikePlaceholder(raw) {
  const s = (raw || "").toLowerCase();
  return (
    /peg[áa]_?tu|paste[_-]?here|your[_-]?client|example\.com|changeme|replace[_-]?me/i.test(
      raw || ""
    ) || s === "chatbot-bmc-live"
  );
}

function collectJsFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) collectJsFiles(p, acc);
    else if (/\.(js|mjs)$/i.test(ent.name)) acc.push(p);
  }
  return acc;
}

const fromProcess = (process.env.VITE_GOOGLE_CLIENT_ID || "").trim();
const fromEnv = parseEnvFile(path.join(root, ".env"));
const fromLocal = parseEnvFile(path.join(root, ".env.local"));
const merged = { ...fromEnv, ...fromLocal };
const expected = fromProcess || (merged.VITE_GOOGLE_CLIENT_ID || "").trim();

if (!expected) {
  console.log(
    "[verify:google-drive-dist] Omitido: no hay VITE_GOOGLE_CLIENT_ID (process.env ni .env / .env.local)."
  );
  process.exit(0);
}

if (looksLikePlaceholder(expected)) {
  console.error(
    "[verify:google-drive-dist] VITE_GOOGLE_CLIENT_ID parece un placeholder o valor incorrecto."
  );
  process.exit(1);
}

if (!/\.apps\.googleusercontent\.com$/i.test(expected) || expected.length < 30) {
  console.error(
    "[verify:google-drive-dist] El Client ID configurado no tiene formato válido:",
    mask(expected)
  );
  process.exit(1);
}

if (!fs.existsSync(distDir)) {
  console.error(
    "[verify:google-drive-dist] No existe dist/. Ejecutá antes: npm run build"
  );
  process.exit(1);
}

const files = collectJsFiles(distDir);
if (!files.length) {
  console.error("[verify:google-drive-dist] dist/ no contiene archivos .js/.mjs.");
  process.exit(1);
}

const hits = [];
for (const f of files) {
  const body = fs.readFileSync(f, "utf8");
  if (body.includes(expected)) hits.push(path.relative(root, f));
}

if (!hits.length) {
  console.error(
    "[verify:google-drive-dist] El Client ID esperado no aparece en ningún bundle bajo dist/."
  );
  console.error(`  Esperado (enmascarado): ${mask(expected)}`);
  console.error(
    "  ¿El build usó el mismo entorno? Vite incrusta VITE_* solo si estaban definidos al correr vite build."
  );
  process.exit(1);
}

console.log(
  `[verify:google-drive-dist] OK — Client ID incrustado en ${hits.length} archivo(s), p. ej. ${hits[0]}`
);
console.log(`  ID esperado (enmascarado): ${mask(expected)}`);
process.exit(0);
