#!/usr/bin/env node
/**
 * Sincroniza precios F/L/T (cols F, L, T de BROMYROS, **sin IVA**) desde la MATRIZ hacia
 * `src/data/constants.js` para el kit Isodec varilla/tuerca en filas fijas del libro.
 *
 * Contexto: esas filas suelen tener **col D vacía**, por eso no entran al CSV de
 * `/api/actualizar-precios-calculadora` hasta que se complete el SKU.
 *
 * Filas 1-based (revisión 2026-04-05):
 *   161 Varilla, 162 Tuerca, 163 Carrocero, 164 Tortuga blanca, 165 Tortuga gris, 166 Taco
 *
 * **Arandela plana:** `MATRIZ_ROW_ARANDELA_PLANA` → fila explícita; si no, búsqueda por descripción + col D **ARPLA38**;
 * si aún no hay match, se intenta fila **167** (alta típica en BROMYROS) con F/L/T válidos y (**ARPLA38** en D o descripción que case).
 *
 * Requiere: GOOGLE_APPLICATION_CREDENTIALS, BMC_MATRIZ_SHEET_ID (opcional).
 *
 * Uso:
 *   npm run matriz:sync-fijaciones-isodec
 *   node scripts/sync-fijaciones-isodec-bromyros.mjs --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { google } from "googleapis";
import { getPathForMatrizSku, normalizeSku } from "../src/data/matrizPreciosMapping.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const MATRIZ_ID =
  process.env.BMC_MATRIZ_SHEET_ID || "1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo";
const CREDS = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";

const COL = (letter) => {
  let n = 0;
  for (let i = 0; i < letter.length; i++) {
    n = n * 26 + (letter.charCodeAt(i) - 64);
  }
  return n - 1;
};
const c = {
  sku: COL("D"),
  descripcion: COL("E"),
  costo: COL("F"),
  ventaLocal: COL("L"),
  web: COL("T"),
};

/** 1-based fila hoja → clave FIJACIONES en constants.js */
const ISO_DEC_ROWS = [
  { row: 161, key: "varilla_38" },
  { row: 162, key: "tuerca_38" },
  { row: 163, key: "arandela_carrocero" },
  { row: 164, key: "arandela_pp" },
  { row: 165, key: "arandela_pp_gris" },
  { row: 166, key: "taco_expansivo" },
];

const ARANDELA_PLANA_DESC_RE =
  /arandela\s+plana|plana\s+3\s*\/\s*8|arand\.\s*plana|rondana\s+plana|washer\s+plana/i;

/** Fila 1-based por defecto si no hay env ni búsqueda por descripción (MATRIZ 2026-04). */
const DEFAULT_ROW_ARANDELA_PLANA = 167;

function parseNum(v) {
  if (v == null || v === "") return null;
  let s = String(v).trim().replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : +n.toFixed(4);
}

function fmtPrice(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return String(x);
  const s = n.toFixed(4).replace(/\.?0+$/, "");
  return s.includes(".") ? s : `${s}.0`;
}

/** Reemplaza `venta: …, web: …, costo: …` en la línea de un sku FIJACIONES. */
function patchFijacionLine(src, key, venta, web, costo) {
  const re = new RegExp(
    `^(\\s*${key}:\\s*\\{[^}]*?)(venta:\\s*)[\\d.]+(,\\s*web:\\s*)[\\d.]+(,\\s*costo:\\s*)[\\d.]+`,
    "m",
  );
  if (!re.test(src)) {
    throw new Error(`No se encontró bloque FIJACIONES.${key} para parchear`);
  }
  return src.replace(re, `$1$2${fmtPrice(venta)}$3${fmtPrice(web)}$4${fmtPrice(costo)}`);
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  if (!CREDS) {
    console.error("Falta GOOGLE_APPLICATION_CREDENTIALS");
    process.exit(2);
  }
  const resolved = path.isAbsolute(CREDS) ? CREDS : path.resolve(repoRoot, CREDS);
  if (!fs.existsSync(resolved)) {
    console.error("Credenciales no encontradas:", resolved);
    process.exit(2);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: resolved,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: MATRIZ_ID,
    range: "'BROMYROS'!A1:Z2500",
  });
  const rows = res.data.values || [];

  const updates = [];
  for (const { row, key } of ISO_DEC_ROWS) {
    const idx = row - 1;
    const rowArr = rows[idx];
    if (!rowArr) {
      console.error(`Fila ${row} fuera de rango`);
      process.exit(3);
    }
    const costo = parseNum(rowArr[c.costo]);
    const venta = parseNum(rowArr[c.ventaLocal]);
    const web = parseNum(rowArr[c.web]);
    if (costo == null || venta == null || web == null) {
      console.error(`Fila ${row} (${key}): faltan F/L/T`, { costo, venta, web });
      process.exit(4);
    }
    updates.push({ key, row, costo, venta, web, desc: rowArr[c.descripcion] || "" });
  }

  /** Arandela plana: fila explícita env o búsqueda por descripción + SKU mapeado */
  const envRowPlana = process.env.MATRIZ_ROW_ARANDELA_PLANA;
  let planaHit = null;
  if (envRowPlana && /^\d+$/.test(envRowPlana)) {
    const r = Number(envRowPlana);
    const rowArr = rows[r - 1];
    if (rowArr) {
      const costo = parseNum(rowArr[c.costo]);
      const venta = parseNum(rowArr[c.ventaLocal]);
      const web = parseNum(rowArr[c.web]);
      if (costo != null && venta != null && web != null) {
        planaHit = { row: r, costo, venta, web, desc: rowArr[c.descripcion] || "", via: "env" };
      }
    }
  }
  if (!planaHit) {
    for (let i = 0; i < rows.length; i++) {
      const rowArr = rows[i];
      const desc = String(rowArr[c.descripcion] || "");
      if (!ARANDELA_PLANA_DESC_RE.test(desc)) continue;
      const skuRaw = String(rowArr[c.sku] || "").trim();
      if (getPathForMatrizSku(skuRaw) !== "FIJACIONES.arandela_plana") continue;
      const costo = parseNum(rowArr[c.costo]);
      const venta = parseNum(rowArr[c.ventaLocal]);
      const web = parseNum(rowArr[c.web]);
      if (costo == null || venta == null || web == null) continue;
      planaHit = { row: i + 1, costo, venta, web, desc, via: "sheet" };
      break;
    }
  }

  if (!planaHit) {
    const r = DEFAULT_ROW_ARANDELA_PLANA;
    const rowArr = rows[r - 1];
    if (rowArr) {
      const desc = String(rowArr[c.descripcion] || "");
      const skuRaw = String(rowArr[c.sku] || "").trim();
      const skuOk =
        normalizeSku(skuRaw) === "ARPLA38" || getPathForMatrizSku(skuRaw) === "FIJACIONES.arandela_plana";
      const descOk = ARANDELA_PLANA_DESC_RE.test(desc);
      if (skuOk || descOk) {
        const costo = parseNum(rowArr[c.costo]);
        const venta = parseNum(rowArr[c.ventaLocal]);
        const web = parseNum(rowArr[c.web]);
        if (costo != null && venta != null && web != null) {
          planaHit = { row: r, costo, venta, web, desc, via: `default-row-${r}` };
        }
      }
    }
  }

  const report = { dryRun: dry, isodecRows: updates, arandelaPlana: planaHit };
  console.log(JSON.stringify(report, null, 2));

  if (!planaHit) {
    console.warn(
      "\n[aviso] No hay fila en BROMYROS para arandela plana (descripción + SKU ARPLA38 en col D). " +
        "Agregá la fila en la MATRIZ o definí MATRIZ_ROW_ARANDELA_PLANA=… y re-ejecutá.",
    );
  }

  const constPath = path.join(repoRoot, "src/data/constants.js");
  let src = fs.readFileSync(constPath, "utf8");
  for (const u of updates) {
    src = patchFijacionLine(src, u.key, u.venta, u.web, u.costo);
  }
  if (planaHit) {
    src = patchFijacionLine(src, "arandela_plana", planaHit.venta, planaHit.web, planaHit.costo);
  }

  if (!dry) {
    fs.writeFileSync(constPath, src, "utf8");
    console.log("\nActualizado:", constPath);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
