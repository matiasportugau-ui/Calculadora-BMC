#!/usr/bin/env node
/**
 * Reconciliación: export de la calculadora (Listado de precios) vs export de la MATRIZ
 * (`GET /api/actualizar-precios-calculadora`). Une por `path` y reporta:
 *   - paths presentes solo en un lado (gaps de mapeo SKU→path o filas faltantes),
 *   - diferencias campo a campo (costo / venta_local / venta_local_iva_inc / venta_web / venta_web_iva_inc),
 *   - anomalías de la MATRIZ (celdas vacías, valores negativos, c/IVA < ex IVA).
 *
 * Genera además un documento "import-ready" en el formato canónico de la MATRIZ
 * (sku,path,descripcion,categoria,costo,venta_local,venta_local_iva_inc,venta_web,venta_web_iva_inc,unidad,tab)
 * usando la calculadora como fuente de verdad y rellenando las celdas que la MATRIZ tiene vacías/erróneas.
 *
 * Uso:
 *   node scripts/reconcile-calc-vs-matriz.mjs <calc-export.csv> <matriz-export.csv> [--out-dir DIR]
 *
 * Mapeo de columnas (ver docs/google-sheets-module/MATRIZ-PRECIOS-CALCULADORA.md):
 *   calc.venta_bmc_local  ≙ matriz.venta_local        (col L, ex IVA)
 *   calc.costo            ≙ matriz.costo              (col F, ex IVA)
 *   calc.venta_local_iva_inc ≙ matriz.venta_local_iva_inc (col M, c/IVA)
 *   calc.venta_web        ≙ matriz.venta_web          (col T, ex IVA)
 *   calc.venta_web_iva_inc≙ matriz.venta_web_iva_inc  (col U, c/IVA)
 */

import fs from "node:fs";
import path from "node:path";
import { parseCsvRows } from "../src/utils/csvPricingImport.js";
import { MATRIZ_SKU_TO_PATH, getPathForMatrizSku } from "../src/data/matrizPreciosMapping.js";

const IVA = 1.22;

function arg(flag, dflt) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

const calcPath = process.argv[2];
const matrizPath = process.argv[3];
const outDir = arg("--out-dir", ".runtime");
if (!calcPath || !matrizPath || calcPath.startsWith("--")) {
  console.error("Uso: node scripts/reconcile-calc-vs-matriz.mjs <calc-export.csv> <matriz-export.csv> [--out-dir DIR]");
  process.exit(2);
}

const num = (v) => {
  if (v == null) return null;
  let s = String(v).replace(/["\s]/g, "").trim();
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
};

function readTable(file) {
  const rows = parseCsvRows(fs.readFileSync(path.resolve(file), "utf8"));
  const headers = rows[0].map((h) => String(h || "").trim().toLowerCase().replace(/^﻿/, ""));
  const idx = (name) => headers.indexOf(name);
  return { rows: rows.slice(1), idx, headers };
}

// ── Calculadora (fuente de verdad) ─────────────────────────────────────────
const calc = readTable(calcPath);
const cPath = calc.idx("path");
const cLabel = calc.idx("label") >= 0 ? calc.idx("label") : calc.idx("descripcion");
const cCat = calc.idx("categoria");
const cUnidad = calc.idx("unidad");
const cCosto = calc.idx("costo");
const cVenta = calc.idx("venta_bmc_local") >= 0 ? calc.idx("venta_bmc_local") : calc.idx("venta_local");
const cVentaInc = calc.idx("venta_local_iva_inc");
const cWeb = calc.idx("venta_web");
const cWebInc = calc.idx("venta_web_iva_inc");

const calcByPath = new Map();
for (const r of calc.rows) {
  const p = (r[cPath] || "").trim();
  if (!p) continue;
  calcByPath.set(p, {
    path: p,
    label: r[cLabel] || "",
    categoria: r[cCat] || "",
    unidad: r[cUnidad] || "",
    costo: num(r[cCosto]),
    venta_local: num(r[cVenta]),
    venta_local_iva_inc: num(r[cVentaInc]),
    venta_web: num(r[cWeb]),
    venta_web_iva_inc: num(r[cWebInc]),
  });
}

// ── MATRIZ (estado actual del sheet) ───────────────────────────────────────
const mat = readTable(matrizPath);
const mSku = mat.idx("sku");
const mPath = mat.idx("path");
const mCosto = mat.idx("costo");
const mVenta = mat.idx("venta_local");
const mVentaInc = mat.idx("venta_local_iva_inc");
const mWeb = mat.idx("venta_web");
const mWebInc = mat.idx("venta_web_iva_inc");

const matByPath = new Map();
const matrizDupPaths = [];
for (const r of mat.rows) {
  const p = (r[mPath] || "").trim();
  if (!p) continue;
  const entry = {
    sku: (r[mSku] || "").trim(),
    path: p,
    costo: num(r[mCosto]),
    venta_local: num(r[mVenta]),
    venta_local_iva_inc: num(r[mVentaInc]),
    venta_web: num(r[mWeb]),
    venta_web_iva_inc: num(r[mWebInc]),
  };
  if (matByPath.has(p)) matrizDupPaths.push(p);
  matByPath.set(p, entry); // last wins (mismo criterio que el import)
}

// ── Diff ────────────────────────────────────────────────────────────────────
const FIELDS = ["costo", "venta_local", "venta_local_iva_inc", "venta_web", "venta_web_iva_inc"];
const onlyInCalc = [];
const onlyInMatriz = [];
const diffs = [];
const matrizAnomalies = [];

for (const [p, c] of calcByPath) {
  const m = matByPath.get(p);
  if (!m) { onlyInCalc.push(p); continue; }
  const fieldDiffs = [];
  for (const f of FIELDS) {
    const cv = c[f], mv = m[f];
    if (cv == null && mv == null) continue;
    if (cv == null || mv == null || Math.abs(cv - mv) > 0.01) {
      fieldDiffs.push({ field: f, calc: cv, matriz: mv });
    }
  }
  if (fieldDiffs.length) diffs.push({ path: p, label: c.label, fields: fieldDiffs });
}
for (const p of matByPath.keys()) if (!calcByPath.has(p)) onlyInMatriz.push(p);

// Anomalías MATRIZ: vacíos donde calc tiene precio, negativos, c/IVA < ex IVA.
for (const [p, m] of matByPath) {
  const c = calcByPath.get(p);
  const issues = [];
  if (m.venta_local == null && c?.venta_local != null) issues.push("venta_local vacío (calc tiene valor)");
  if (m.venta_web == null && c?.venta_web != null) issues.push("venta_web vacío (calc tiene valor)");
  for (const f of FIELDS) if (m[f] != null && m[f] < 0) issues.push(`${f} negativo (${m[f]})`);
  if (m.venta_local != null && m.venta_local_iva_inc != null && m.venta_local_iva_inc < m.venta_local)
    issues.push(`c/IVA (${m.venta_local_iva_inc}) < ex IVA (${m.venta_local})`);
  if (issues.length) matrizAnomalies.push({ path: p, sku: m.sku, issues });
}

// SKUs en mapping sin fila en la MATRIZ (cobertura del sheet)
const mappedPaths = new Set(Object.values(MATRIZ_SKU_TO_PATH));
const calcPathsNotMapped = [...calcByPath.keys()].filter((p) => !mappedPaths.has(p));

// ── Documento import-ready (calculadora = verdad; formato MATRIZ) ───────────
// Para cada path, reconstruye sku desde el mapping (primer SKU que apunta a ese path),
// completa todas las celdas (rellena las que la MATRIZ tiene vacías) y normaliza c/IVA.
const skuForPath = new Map();
for (const [sku, p] of Object.entries(MATRIZ_SKU_TO_PATH)) {
  if (!skuForPath.has(p)) skuForPath.set(p, sku); // primer SKU canónico
  if (matByPath.get(p)?.sku) skuForPath.set(p, matByPath.get(p).sku); // preferí el SKU real del sheet
}
const esc = (s) => {
  const str = String(s ?? "");
  return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
};
const r2 = (n) => (n == null ? "" : +Number(n).toFixed(2));
const importHeader = ["sku","path","descripcion","categoria","costo","venta_local","venta_local_iva_inc","venta_web","venta_web_iva_inc","unidad","tab"];
const importRows = [importHeader.join(",")];
let filledCells = 0;
for (const [p, c] of calcByPath) {
  const m = matByPath.get(p);
  const sku = skuForPath.get(p) || "";
  // valores: calc manda; si falta c/IVA, derivá desde ex IVA × 1.22 (regla de motor de precios).
  const venta = c.venta_local;
  const ventaInc = c.venta_local_iva_inc ?? (venta != null ? venta * IVA : null);
  const web = c.venta_web;
  const webInc = c.venta_web_iva_inc ?? (web != null ? web * IVA : null);
  if (m) for (const f of FIELDS) if (m[f] == null && c[f] != null) filledCells++;
  importRows.push([
    esc(sku), p, esc(c.label), esc(c.categoria),
    r2(c.costo), r2(venta), r2(ventaInc), r2(web), r2(webInc),
    esc(c.unidad), "BROMYROS",
  ].join(","));
}

// ── Salida ───────────────────────────────────────────────────────────────────
fs.mkdirSync(outDir, { recursive: true });
const importFile = path.join(outDir, "matriz-import-ready.csv");
fs.writeFileSync(importFile, "﻿" + importRows.join("\n") + "\n", "utf8");

const report = {
  generadoEl: new Date().toISOString(),
  calc: { archivo: calcPath, filas: calcByPath.size },
  matriz: { archivo: matrizPath, filas: matByPath.size, pathsDuplicados: matrizDupPaths },
  resumen: {
    soloEnCalc: onlyInCalc.length,
    soloEnMatriz: onlyInMatriz.length,
    pathsConDiferencias: diffs.length,
    anomaliasMatriz: matrizAnomalies.length,
    calcPathsSinMapeoSKU: calcPathsNotMapped.length,
    celdasRellenadasEnImport: filledCells,
  },
  soloEnCalc: onlyInCalc,
  soloEnMatriz: onlyInMatriz,
  calcPathsSinMapeoSKU: calcPathsNotMapped,
  anomaliasMatriz: matrizAnomalies,
  diferencias: diffs,
};
const reportFile = path.join(outDir, "reconcile-report.json");
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), "utf8");

// Consola
console.log("═══ Reconciliación calculadora ↔ MATRIZ ═══");
console.log(`Calc: ${calcByPath.size} paths · MATRIZ: ${matByPath.size} paths`);
console.log(`Solo en calc (faltan en MATRIZ): ${onlyInCalc.length}`);
console.log(`Solo en MATRIZ (no en calc):     ${onlyInMatriz.length}`);
console.log(`Paths con diferencias de precio: ${diffs.length}`);
console.log(`Anomalías MATRIZ (vacíos/neg/c<ex): ${matrizAnomalies.length}`);
console.log(`Celdas rellenadas en doc import: ${filledCells}`);
console.log(`\n→ ${importFile}`);
console.log(`→ ${reportFile}`);
if (onlyInCalc.length) console.log(`\nFaltan en MATRIZ (primeros 15):\n  ${onlyInCalc.slice(0,15).join("\n  ")}`);
if (matrizAnomalies.length) {
  console.log(`\nAnomalías MATRIZ (primeras 15):`);
  for (const a of matrizAnomalies.slice(0,15)) console.log(`  ${a.path} [${a.sku}] → ${a.issues.join("; ")}`);
}
