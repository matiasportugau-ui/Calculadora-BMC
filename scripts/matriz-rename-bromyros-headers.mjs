#!/usr/bin/env node
/**
 * Renombra encabezados de columnas problemáticas en la pestaña BROMYROS de la MATRIZ
 * (G/J/K/R/S alineados a MATRIZ_TAB_COLUMNS; R = web ex IVA, S = web c/IVA).
 *
 * Requiere: GOOGLE_APPLICATION_CREDENTIALS + permiso **Editor** en el workbook.
 *
 * Uso:
 *   node scripts/matriz-rename-bromyros-headers.mjs --dry-run
 *   node scripts/matriz-rename-bromyros-headers.mjs
 *   node scripts/matriz-rename-bromyros-headers.mjs --row 1 --tab BROMYROS
 *   node scripts/matriz-rename-bromyros-headers.mjs --include-g   # también col G (si hay costo alternativo)
 *
 * Variables: BMC_MATRIZ_SHEET_ID (default = config del repo)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { google } from "googleapis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const DEFAULT_SHEET_ID = "1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo";
const SCOPE_WRITE = "https://www.googleapis.com/auth/spreadsheets";

const HEADERS = {
  G: "Costo m² USD ex IVA",
  J: "Venta local USD ex IVA",
  K: "Ref. consumidor c/IVA",
  R: "Venta web USD ex IVA",
  S: "Venta web USD c/IVA",
  // legacy aliases kept for --include-g etc. if needed
  F: "Costo m² USD ex IVA (legacy F)",
  L: "Venta local USD ex IVA (legacy L)",
  M: "Ref. consumidor c/IVA (legacy M)",
  T: "Venta web USD ex IVA (legacy T)",
  U: "Venta web USD c/IVA (legacy U)",
};

function parseArgs(argv) {
  let dryRun = false;
  let includeG = false;
  let row = 1;
  let tab = "BROMYROS";
  let sheetId = process.env.BMC_MATRIZ_SHEET_ID || DEFAULT_SHEET_ID;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") dryRun = true;
    else if (argv[i] === "--include-g") includeG = true;
    else if (argv[i] === "--row" && argv[i + 1]) row = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (argv[i] === "--tab" && argv[i + 1]) tab = argv[++i];
    else if (argv[i] === "--sheet-id" && argv[i + 1]) sheetId = argv[++i];
  }
  return { dryRun, includeG, row, tab, sheetId };
}

async function main() {
  const { dryRun, includeG, row, tab, sheetId } = parseArgs(process.argv.slice(2));
  const credsRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  const resolved = credsRaw
    ? path.isAbsolute(credsRaw)
      ? credsRaw
      : path.resolve(process.cwd(), credsRaw)
    : "";
  if (!resolved || !fs.existsSync(resolved)) {
    console.error("Falta GOOGLE_APPLICATION_CREDENTIALS apuntando a un JSON válido.");
    process.exit(2);
  }

  const updates = [
    { col: "G", text: HEADERS.G },
    { col: "J", text: HEADERS.J },
    { col: "K", text: HEADERS.K },
    { col: "R", text: HEADERS.R },
    { col: "S", text: HEADERS.S },
  ];
  if (includeG) updates.splice(1, 0, { col: "G", text: HEADERS.G }); // duplicate G ok, last wins or adjust manually

  console.log(`MATRIZ ${sheetId} · pestaña "${tab}" · fila ${row}`);
  if (dryRun) {
    for (const u of updates) {
      console.log(`  [dry-run] ${u.col}${row} ← ${JSON.stringify(u.text)}`);
    }
    console.log("Sin cambios (dry-run). Quitá --dry-run para escribir.");
    return;
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: resolved,
    scopes: [SCOPE_WRITE],
  });
  const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });

  const data = updates.map((u) => ({
    range: `'${tab.replace(/'/g, "''")}'!${u.col}${row}`,
    values: [[u.text]],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });

  console.log("Listo. Celdas actualizadas:");
  for (const u of updates) {
    console.log(`  ${u.col}${row} ← ${u.text}`);
  }
}

main().catch((e) => {
  console.error(e.message || String(e));
  process.exit(1);
});
