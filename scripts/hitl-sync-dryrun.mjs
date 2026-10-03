#!/usr/bin/env node
/**
 * hitl-sync-dryrun.mjs — exercise the Admin. ⇄ HITL cola projection
 * **without** touching the live sheet.
 *
 * Modes:
 *   --csv <path>   Load an admin-live-*.csv dump (produced by the ops export)
 *                  and print the HITL snapshot the dashboard would see.
 *   --sheet        Call the live Google Sheets API (needs
 *                  GOOGLE_APPLICATION_CREDENTIALS + WOLFB_ADMIN_SHEET_ID in env).
 *                  Read-only; prints the same snapshot shape as the HTTP route.
 *
 * Flags:
 *   --compat       Also print the board.json-compat flat shape.
 *   --limit <n>    Only print the first N actionable items.
 *   --quiet        Suppress item details; keep counts.
 *
 * Example:
 *   node scripts/hitl-sync-dryrun.mjs \
 *     --csv uploads/admin-live-2026-10-02.csv --compat --limit 5
 *
 *   WOLFB_ADMIN_SHEET_ID=1Ie0K... \
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   node scripts/hitl-sync-dryrun.mjs --sheet
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  buildHitlBoardSnapshot,
  projectBoardJsonCompat,
} from "../server/lib/hitlAdminBoard.js";

function parseArgs(argv) {
  const out = { csv: "", sheet: false, compat: false, limit: 0, quiet: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--csv") out.csv = argv[++i] || "";
    else if (a === "--sheet") out.sheet = true;
    else if (a === "--compat") out.compat = true;
    else if (a === "--limit") out.limit = Number(argv[++i] || 0);
    else if (a === "--quiet") out.quiet = true;
    else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
  }
  return out;
}

function printHelp() {
  process.stdout.write(
    "Usage: node scripts/hitl-sync-dryrun.mjs (--csv <path> | --sheet) [--compat] [--limit N] [--quiet]\n",
  );
}

/**
 * Minimal CSV parser (RFC 4180 subset) — handles quoted fields, embedded
 * newlines, and double-quote escapes. The admin-live-*.csv dump has newlines
 * inside the "Consulta" column, so splitting by \n is NOT safe.
 */
function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch === "\r") { /* skip */ }
      else { field += ch; }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * The admin-live-*.csv dump column layout mirrors the live Admin. sheet
 * header, with A=Edit URL in col 0. Our Admin. A:M layout is:
 *   A(0)=ID  B(1)=Asig.  C(2)=Estado  D(3)=Fecha  E(4)=Cliente  F(5)=Origen
 * BUT the live export uses: Edit, Asig, Estado, Fecha, Cliente, Origen,
 *   Telefono-Contacto, Direccion, Consulta, Interpretacion AI, Respuesta AI,
 *   Datos Faltantes, PRESUPUESTO, Enviado, ...
 * We project it into the A:M order the live Admin. sheet uses on-row:
 *   A=ID, B=Fecha, D=Telefono, E=Cliente, F=Origen, H=Zona, I=Consulta,
 *   J=RespuestaAI, K=LinkPresupuesto, L=Estado, M=''.
 * Column index map in the CSV:
 *   0 edit, 1 asig, 2 estado, 3 fecha, 4 cliente, 5 origen,
 *   6 telefono, 7 zona, 8 consulta, 9 interpretAI, 10 respuestaAI,
 *   11 datosFaltantes, 12 presupuesto(link), 13 enviado, ...
 * The actual on-sheet A:M is a different projection; the CSV also carries
 * extra ops-only columns beyond M. We assemble the 13-column A:M row the
 * Admin. sheet live-exposes.
 */
function projectCsvRowToAdminRange(csvRow) {
  const asig = csvRow[1] || "";
  const estado = csvRow[2] || "";
  const fecha = csvRow[3] || "";
  const cliente = csvRow[4] || "";
  const origen = csvRow[5] || "";
  const telefono = csvRow[6] || "";
  const zona = csvRow[7] || "";
  const consulta = csvRow[8] || "";
  const respuestaAi = csvRow[10] || "";
  const link = csvRow[12] || "";
  // Column A in the Admin. sheet carries an ID; the export doesn't surface it
  // as a dedicated column, but cliente usually doubles as the correlation
  // identifier for ML rows (e.g. "AB20251017135215"). Mirror that convention.
  return [
    cliente,     // A id
    fecha,       // B fecha
    asig,        // C (Asig)
    telefono,    // D telefono
    cliente,     // E cliente
    origen,      // F origen
    "",          // G
    zona,        // H zona
    consulta,    // I consulta
    respuestaAi, // J respuesta IA
    link,        // K link
    estado,      // L estado
    "",          // M replay
  ];
}

async function loadFromCsv(csvPath) {
  const abs = path.isAbsolute(csvPath) ? csvPath : path.resolve(process.cwd(), csvPath);
  if (!fs.existsSync(abs)) {
    process.stderr.write(`CSV not found: ${abs}\n`);
    process.exit(2);
  }
  const text = fs.readFileSync(abs, "utf8");
  const rows = parseCsv(text);
  // Drop the header row.
  const data = rows.slice(1).filter((r) => r.length > 1);
  return data.map(projectCsvRowToAdminRange);
}

async function loadFromSheet() {
  const sheetId = process.env.WOLFB_ADMIN_SHEET_ID;
  const tab = process.env.WOLFB_ADMIN_TAB || "Admin.";
  if (!sheetId) {
    process.stderr.write("WOLFB_ADMIN_SHEET_ID is required for --sheet mode\n");
    process.exit(2);
  }
  const { getSheetsClient } = await import("../server/lib/googleSheetsAuth.js");
  const sheets = await getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tab}'!A2:M`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return { rows: resp.data.values || [], sheetId, tab };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.csv && !args.sheet) { printHelp(); process.exit(1); }

  let rows = [];
  let sheetId = "";
  let tab = "Admin.";
  if (args.csv) {
    rows = await loadFromCsv(args.csv);
    sheetId = process.env.WOLFB_ADMIN_SHEET_ID || "1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0";
    tab = process.env.WOLFB_ADMIN_TAB || "Admin.";
  } else {
    const s = await loadFromSheet();
    rows = s.rows;
    sheetId = s.sheetId;
    tab = s.tab;
  }

  const snapshot = buildHitlBoardSnapshot(rows, { sheetId, tab });
  const summary = {
    source: args.csv ? "csv" : "sheet",
    sheet_id: snapshot.sheet_id,
    tab: snapshot.tab,
    generated_at: snapshot.generated_at,
    etag: snapshot.etag,
    counts: snapshot.counts,
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");

  if (!args.quiet) {
    const items = args.limit > 0 ? snapshot.items.slice(0, args.limit) : snapshot.items;
    process.stdout.write("--- Actionable items ---\n");
    for (const it of items) {
      process.stdout.write(
        `[row ${it.admin_row}] ${it.estado.padEnd(12)} | ${it.canal.padEnd(4)} | ${(it.cliente || "").slice(0, 32).padEnd(32)} | ${it.title.slice(0, 80)}\n`,
      );
    }
    process.stdout.write(`(${items.length} / ${snapshot.counts.actionable} shown)\n`);
  }

  if (args.compat) {
    const flat = projectBoardJsonCompat(snapshot);
    process.stdout.write("--- board.json compat (first 5) ---\n");
    process.stdout.write(JSON.stringify(flat.slice(0, 5), null, 2) + "\n");
  }
}

main().catch((e) => {
  process.stderr.write(`hitl-sync-dryrun failed: ${e?.stack || e}\n`);
  process.exit(1);
});
