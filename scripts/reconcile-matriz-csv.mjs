#!/usr/bin/env node
/**
 * Reconciliación CSV MATRIZ / planilla precios: paths duplicados (misma clave → última fila gana al import).
 *
 * Uso:
 *   node scripts/reconcile-matriz-csv.mjs ruta/al/archivo.csv
 *   curl -s "$API/api/actualizar-precios-calculadora" | node scripts/reconcile-matriz-csv.mjs
 *   npm run matriz:reconcile -- /path/to/bmc-precios-matriz.csv
 *
 * Flags:
 *   --json          Salida JSON
 *   --fail-on-dup   Exit 1 si hay duplicados (CI)
 */

import fs from "node:fs";
import path from "node:path";
import { getDuplicatePathReport, splitCsvCells } from "../src/utils/csvPricingImport.js";

function readInput(argv) {
  const args = argv.filter((a) => !a.startsWith("--"));
  const file = args[0];
  if (!file || file === "-") {
    return fs.readFileSync(0, "utf8");
  }
  const resolved = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  return fs.readFileSync(resolved, "utf8");
}

function main() {
  const json = process.argv.includes("--json");
  const failOnDup = process.argv.includes("--fail-on-dup");

  let text;
  try {
    text = readInput(process.argv.slice(2));
  } catch (e) {
    console.error(e.message || String(e));
    process.exit(2);
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    console.error("CSV vacío o sin datos.");
    process.exit(2);
  }

  const headers = splitCsvCells(lines[0]);
  const pathIdx = headers.findIndex((c) => String(c).trim().toLowerCase() === "path");
  if (pathIdx < 0) {
    console.error("No hay columna 'path' en la cabecera.");
    process.exit(2);
  }

  const duplicates = getDuplicatePathReport(lines, pathIdx);
  const dataRows = lines.length - 1;
  const uniquePaths = new Set();
  for (let i = 1; i < lines.length; i++) {
    const p = splitCsvCells(lines[i])[pathIdx]?.trim();
    if (p) uniquePaths.add(p);
  }

  const summary = {
    ok: duplicates.length === 0,
    dataRows,
    uniquePathCount: uniquePaths.size,
    duplicatePathCount: duplicates.length,
    duplicates,
  };

  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`Filas de datos: ${dataRows} · Paths únicos: ${uniquePaths.size}`);
    if (duplicates.length === 0) {
      console.log("Sin paths duplicados.");
    } else {
      console.log(`\n${duplicates.length} path(s) con más de una fila (al importar gana la última):\n`);
      for (const d of duplicates) {
        console.log(`  ${d.path}`);
        console.log(`    filas: ${d.lineNumbers.join(", ")} (${d.count} veces)`);
      }
    }
  }

  if (failOnDup && duplicates.length > 0) {
    process.exit(1);
  }
}

main();
