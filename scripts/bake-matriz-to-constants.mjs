#!/usr/bin/env node
/**
 * Camino A — "bake & deploy": escribe los precios de un CSV (formato MATRIZ o export de la
 * calculadora) dentro de `src/data/constants.js`, en las hojas de precio
 * `{ venta, web, costo, … }`. Toca **solo** los valores numéricos de `venta` (col L),
 * `web` (col T) y `costo` (col F); preserva `ap`, `sku`, `largo`, `label`, comentarios y formato.
 *
 * Recorre constants.js con un scanner que mantiene el *key-path* completo vía pila de llaves,
 * así funciona con hojas en una línea (`100: { venta: … }`), anidadas (`ISODEC: { _all: { … } }`)
 * y multilínea (`perfil_k2: { _all: { … , label: … } }`). Solo modifica exports de precios.
 *
 * Flujo recomendado:
 *   1) Limpiar la MATRIZ (usar matriz-import-ready.csv como referencia).
 *   2) npm run matriz:pull-csv
 *   3) node scripts/bake-matriz-to-constants.mjs .runtime/matriz-precios-latest.csv --dry-run
 *   4) node scripts/bake-matriz-to-constants.mjs .runtime/matriz-precios-latest.csv
 *   5) git add src/data/constants.js && commit && deploy
 *
 * Uso: node scripts/bake-matriz-to-constants.mjs <precios.csv> [--dry-run]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsvRows } from "../src/utils/csvPricingImport.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const CONSTANTS = path.join(repoRoot, "src/data/constants.js");

const csvArg = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (!csvArg || csvArg.startsWith("--")) {
  console.error("Uso: node scripts/bake-matriz-to-constants.mjs <precios.csv> [--dry-run]");
  process.exit(2);
}

const PRICE_ROOTS = new Set([
  "PANELS_TECHO", "PANELS_PARED", "FIJACIONES", "HERRAMIENTAS",
  "SELLADORES", "PERFIL_TECHO", "PERFIL_PARED", "SERVICIOS",
]);
const PRICE_FIELDS = new Set(["venta", "web", "costo"]);

const num = (v) => {
  if (v == null) return null;
  let s = String(v).replace(/["\s]/g, "").trim();
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
};

// ── 1. CSV → mapa path → { venta, web, costo } ──────────────────────────────
const rows = parseCsvRows(fs.readFileSync(path.resolve(csvArg), "utf8"));
const headers = rows[0].map((h) => String(h || "").trim().toLowerCase().replace(/^﻿/, ""));
const colIdx = (...names) => { for (const x of names) { const i = headers.indexOf(x); if (i >= 0) return i; } return -1; };
const iPath = colIdx("path");
const iVenta = colIdx("venta_local", "venta_bmc_local", "venta_bmc", "venta");
const iWeb = colIdx("venta_web");
const iCosto = colIdx("costo");
if (iPath < 0) { console.error("CSV sin columna 'path'."); process.exit(2); }

const wanted = new Map();
for (let r = 1; r < rows.length; r++) {
  const p = (rows[r][iPath] || "").trim();
  if (!p) continue;
  wanted.set(p, {
    venta: iVenta >= 0 ? num(rows[r][iVenta]) : null,
    web: iWeb >= 0 ? num(rows[r][iWeb]) : null,
    costo: iCosto >= 0 ? num(rows[r][iCosto]) : null,
  });
}

// ── 2. Scanner de constants.js con pila de claves ───────────────────────────
const src = fs.readFileSync(CONSTANTS, "utf8");
const N = src.length;
const stack = [];          // key-path actual
let lastToken = null;      // último identificador/clave leído
let currentKey = null;     // clave tras ':' o '=' (candidata a abrir objeto o asignar valor)
const edits = [];          // { start, end, text, path, field, from, to }
const touched = new Set();
const seenPaths = new Set(); // paths con hoja de precio presente en constants.js

const isIdent = (c) => /[A-Za-z0-9_$.]/.test(c);
let i = 0;
while (i < N) {
  const c = src[i];

  // comentarios
  if (c === "/" && src[i + 1] === "/") { while (i < N && src[i] !== "\n") i++; continue; }
  if (c === "/" && src[i + 1] === "*") { i += 2; while (i < N && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }
  // strings
  if (c === '"' || c === "'" || c === "`") {
    const q = c; i++;
    while (i < N && src[i] !== q) { if (src[i] === "\\") i++; i++; }
    i++; lastToken = "<str>"; continue;
  }
  // estructura
  if (c === "{") { stack.push(currentKey); currentKey = null; lastToken = null; i++; continue; }
  if (c === "}") { stack.pop(); currentKey = null; lastToken = null; i++; continue; }
  if (c === ":" || c === "=") { if (lastToken && lastToken !== "<str>") currentKey = lastToken; lastToken = null; i++; continue; }
  if (c === "," ) { currentKey = null; lastToken = null; i++; continue; }

  // token identificador / número
  if (isIdent(c)) {
    let j = i; while (j < N && isIdent(src[j])) j++;
    const tok = src.slice(i, j);

    // ¿valor numérico de venta/web/costo dentro de un export de precios?
    if (currentKey && PRICE_FIELDS.has(currentKey) && PRICE_ROOTS.has(stack[0]) && /^-?\d*\.?\d+$/.test(tok)) {
      const p = stack.filter((s) => s != null).join(".");
      seenPaths.add(p);
      const target = wanted.get(p);
      if (target && target[currentKey] != null) {
        const from = parseFloat(tok);
        const to = target[currentKey];
        if (Number.isFinite(to) && Math.abs(from - to) > 1e-9) {
          edits.push({ start: i, end: j, text: String(to), path: p, field: currentKey, from, to });
          touched.add(p);
        }
      }
      currentKey = null;          // valor consumido
    }
    lastToken = tok;
    i = j; continue;
  }

  i++; // cualquier otro caracter
}

// ── 3. Aplicar / reportar ────────────────────────────────────────────────────
const notFound = [...wanted.keys()].filter((p) => !seenPaths.has(p));

console.log(`CSV: ${csvArg} · paths con precio: ${wanted.size}`);
console.log(`Hojas con cambios de valor: ${touched.size} · ediciones numéricas: ${edits.length}`);
if (notFound.length) console.log(`Paths del CSV sin hoja en constants.js: ${notFound.length}\n  ${notFound.slice(0, 20).join(", ")}${notFound.length > 20 ? " …" : ""}`);
const byPath = new Map();
for (const e of edits) { if (!byPath.has(e.path)) byPath.set(e.path, []); byPath.get(e.path).push(e); }
let shown = 0;
for (const [p, es] of byPath) {
  if (shown++ >= 30) { console.log(`  … (${byPath.size - 30} paths más)`); break; }
  console.log(`  ~ ${p}: ${es.map((e) => `${e.field} ${e.from}→${e.to}`).join(", ")}`);
}

if (dryRun) {
  console.log("\n(dry-run) constants.js NO modificado.");
} else if (edits.length === 0) {
  console.log("\nSin cambios de valor — constants.js ya coincide con el CSV.");
} else {
  let out = src;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  fs.writeFileSync(CONSTANTS, out, "utf8");
  console.log(`\n✓ ${CONSTANTS} actualizado (${edits.length} valores en ${touched.size} hojas). Revisá el diff, commiteá y deployá.`);
}
