#!/usr/bin/env node
/**
 * Descarga el CSV de precios (mismo que GET /api/actualizar-precios-calculadora) y lo guarda en disco.
 *
 * Uso:
 *   npm run matriz:pull-csv
 *   BMC_API_BASE=https://localhost:3001 npm run matriz:pull-csv
 *
 * Salida default: .runtime/matriz-precios-latest.csv (crea .runtime si falta).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const base = (process.env.BMC_API_BASE || "http://localhost:3001").replace(/\/$/, "");
const url = `${base}/api/actualizar-precios-calculadora`;
const outDir = path.join(repoRoot, ".runtime");
const outFile = path.join(outDir, "matriz-precios-latest.csv");

const res = await fetch(url);
if (!res.ok) {
  const txt = await res.text();
  console.error(`HTTP ${res.status} ${url}\n${txt.slice(0, 500)}`);
  process.exit(1);
}
const csv = await res.text();
if (!csv.includes("path,") || !csv.includes("venta_local")) {
  console.error("Respuesta no parece CSV MATRIZ (falta cabecera esperada).");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, csv, "utf8");
const lines = csv.split(/\r?\n/).filter(Boolean).length;
console.log(`OK ${lines} líneas → ${outFile}`);
