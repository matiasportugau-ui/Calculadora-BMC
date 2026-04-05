#!/usr/bin/env node
/**
 * Sincroniza **F/L/T** (cols F, L, T de BROMYROS, ex IVA) de la fila **Silicona 300 ml neutra**
 * (SKU col D **SIL300N** típico) hacia `SELLADORES.silicona_300_neutra` en `src/data/constants.js`.
 *
 * Fila por defecto **168** (MATRIZ 2026-04); override: `MATRIZ_ROW_SILICONA_300_NEUTRA=168`.
 *
 * Requiere: GOOGLE_APPLICATION_CREDENTIALS, BMC_MATRIZ_SHEET_ID (opcional).
 *
 * Uso:
 *   npm run matriz:sync-silicona-300
 *   node scripts/sync-silicona-300-neutra-bromyros.mjs --dry-run
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

const DEFAULT_ROW = 168;
const EXPECT_PATH = "SELLADORES.silicona_300_neutra";

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

function patchSilicona300Line(src, venta, web, costo) {
  const re = new RegExp(
    "^(\\s*silicona_300_neutra:\\s*\\{[^}]*?)(venta:\\s*)[\\d.]+(,\\s*web:\\s*)[\\d.]+(,\\s*costo:\\s*)[\\d.]+",
    "m",
  );
  if (!re.test(src)) {
    throw new Error("No se encontró bloque SELLADORES.silicona_300_neutra para parchear");
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

  const envRow = process.env.MATRIZ_ROW_SILICONA_300_NEUTRA;
  let targetRow = DEFAULT_ROW;
  if (envRow && /^\d+$/.test(envRow)) targetRow = Number(envRow);

  let rowArr = rows[targetRow - 1];
  let usedRow = targetRow;
  let via = "env-or-default";

  if (!rowArr || !parseNum(rowArr[c.costo])) {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const sku = String(r[c.sku] || "").trim();
      if (getPathForMatrizSku(sku) === EXPECT_PATH || normalizeSku(sku) === "SIL300N") {
        rowArr = r;
        usedRow = i + 1;
        via = "scan-sku";
        break;
      }
    }
  }

  if (!rowArr) {
    console.error("No se encontró fila para silicona 300 neutra (SIL300N / SELLADORES.silicona_300_neutra)");
    process.exit(3);
  }

  const skuRaw = String(rowArr[c.sku] || "").trim();
  const pathOk = getPathForMatrizSku(skuRaw) === EXPECT_PATH;
  if (!pathOk && normalizeSku(skuRaw) !== "SIL300N") {
    console.warn(
      `[aviso] Fila ${usedRow}: col D "${skuRaw}" no mapea a ${EXPECT_PATH} — se sincroniza igual (vía ${via}).`,
    );
  }

  const costo = parseNum(rowArr[c.costo]);
  const venta = parseNum(rowArr[c.ventaLocal]);
  const web = parseNum(rowArr[c.web]);
  if (costo == null || venta == null || web == null) {
    console.error(`Fila ${usedRow}: faltan F/L/T`, { costo, venta, web });
    process.exit(4);
  }

  const hit = { row: usedRow, via, desc: rowArr[c.descripcion] || "", sku: skuRaw, costo, venta, web };
  console.log(JSON.stringify({ dryRun: dry, silicona300Neutra: hit }, null, 2));

  const constPath = path.join(repoRoot, "src/data/constants.js");
  let src = fs.readFileSync(constPath, "utf8");
  src = patchSilicona300Line(src, venta, web, costo);

  if (!dry) {
    fs.writeFileSync(constPath, src, "utf8");
    console.log("\nActualizado:", constPath);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
