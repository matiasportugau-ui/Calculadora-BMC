#!/usr/bin/env node
/**
 * Reconcile Productos Maestro: MATRIZ CSV + Stock E-Commerce + gaps.
 *
 * Uso:
 *   npm run productos-maestro:reconcile
 *   BMC_API_BASE=http://localhost:3001 npm run productos-maestro:reconcile -- --json
 *
 * Flags:
 *   --json       Solo stdout JSON (no escribe .runtime)
 *   --no-write   No escribir archivos (implícito con --json)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  mergeProductosMaestro,
  parseMatrizCsvToRows,
  formatReconcileMarkdown,
  loadProductLinks,
} from "../server/lib/productosMaestro.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const base = (process.env.BMC_API_BASE || "http://localhost:3001").replace(/\/$/, "");
const jsonOnly = process.argv.includes("--json");
const priceTolerance = parseFloat(process.env.PRODUCTOS_MAESTRO_PRICE_TOLERANCE_PCT || "5") || 5;

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} ${url}\n${txt.slice(0, 400)}`);
  }
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} ${url}\n${txt.slice(0, 400)}`);
  }
  return res.json();
}

async function main() {
  let csv;
  let stockRows = [];

  try {
    csv = await fetchText(`${base}/api/actualizar-precios-calculadora`);
  } catch (e) {
    const localCsv = path.join(repoRoot, ".runtime", "matriz-precios-latest.csv");
    if (fs.existsSync(localCsv)) {
      console.error(`API MATRIZ no disponible (${e.message}); usando ${localCsv}`);
      csv = fs.readFileSync(localCsv, "utf8");
    } else {
      throw e;
    }
  }

  try {
    const stockRes = await fetchJson(`${base}/api/stock-ecommerce`);
    stockRows = stockRes.data || [];
  } catch (e) {
    console.error(`Stock API no disponible: ${e.message} — reconcile solo MATRIZ`);
  }

  const matrizRows = parseMatrizCsvToRows(csv);
  const productLinks = loadProductLinks();
  const generatedAt = new Date().toISOString();
  const merged = mergeProductosMaestro({
    matrizRows,
    stockRows,
    productLinks,
    priceTolerancePct: priceTolerance,
  });

  const payload = {
    ok: true,
    generatedAt,
    source: { matrizRows: matrizRows.length, stockRows: stockRows.length, apiBase: base },
    ...merged,
  };

  if (jsonOnly) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const runtimeDir = path.join(repoRoot, ".runtime");
  fs.mkdirSync(runtimeDir, { recursive: true });
  const date = generatedAt.slice(0, 10);
  const jsonPath = path.join(runtimeDir, `productos-maestro-reconcile-${date}.json`);
  const mdPath = path.join(runtimeDir, `productos-maestro-reconcile-${date}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  fs.writeFileSync(mdPath, formatReconcileMarkdown(merged, generatedAt), "utf8");

  console.log(`OK reconcile → ${jsonPath}`);
  console.log(`OK markdown → ${mdPath}`);
  console.log(
    `Resumen: ${merged.summary.total} ítems · OK ${merged.summary.ok} · sin stock ${merged.summary.gaps.sin_stock_link} · desalineados ${merged.summary.gaps.precio_desalineado}`,
  );
}

main().catch((e) => {
  console.error(e.message || String(e));
  process.exit(1);
});
