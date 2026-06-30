/**
 * cockpit-sentinel-restore — snapshot & restore the AH:AK "gate" cells of ONE
 * CRM_Operativo sentinel row, using the same service-account path the server uses
 * (`getCrmSheetsWrite` in server/routes/bmcDashboard.js).
 * ─────────────────────────────────────────────────────────────────────────────
 * Why this exists (and why it can't be done over the cockpit API):
 *   The L1/L2 E2E writes touch AH (quote-link), AI (approval) and AJ (mark-sent).
 *   No cockpit endpoint can *clear* a cell — `mark-sent` defaults AJ to now() and
 *   `quote-link` rejects an empty url. The only faithful teardown is to write the
 *   captured originals straight back via the Sheets API. AH may hold a HYPERLINK
 *   *formula*; `GET /api/crm/cockpit/row/:n` parses that to `null` (see
 *   server/lib/crmRowParse.js:extractPdfUrl), so the snapshot MUST read AH with
 *   `valueRenderOption: "FORMULA"` to recover the exact original.
 *
 * Env:
 *   GOOGLE_APPLICATION_CREDENTIALS  service-account JSON (abs or cwd-relative)
 *   BMC_SHEET_ID                    the CRM spreadsheet id (config.bmcSheetId)
 *
 * Import API (used by scripts/cockpit-e2e.spec.ts):
 *   const sheets = await loadSheets();
 *   const snap   = await captureTail(sheets, row);   // string[4] FORMULA-rendered AH..AK
 *   await restoreTail(sheets, row, snap);             // writes them back (USER_ENTERED)
 *
 * Standalone (emergency restore — capture BEFORE you experiment, restore after):
 *   node scripts/lib/cockpit-sentinel-restore.mjs --row 7 --capture
 *       → prints {"row":7,"tail":["=HYPERLINK(...)","Sí","","No"]} to stdout
 *   node scripts/lib/cockpit-sentinel-restore.mjs --row 7 --restore '["=HYPERLINK(...)","No","","No"]'
 */
import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import { CRM_TAB, Col, rangeAHAK } from "../../server/lib/crmOperativoLayout.js";

const SCOPE_WRITE = "https://www.googleapis.com/auth/spreadsheets";

/** Service-account Sheets v4 client — mirrors getCrmSheetsWrite (bmcDashboard.js). */
export async function loadSheets() {
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  const sheetId = process.env.BMC_SHEET_ID || "";
  if (!sheetId) throw new Error("BMC_SHEET_ID not set");
  if (!credsPath) throw new Error("GOOGLE_APPLICATION_CREDENTIALS not set");
  const resolved = path.isAbsolute(credsPath) ? credsPath : path.resolve(process.cwd(), credsPath);
  if (!fs.existsSync(resolved)) throw new Error(`Credentials file not found: ${resolved}`);
  const auth = new google.auth.GoogleAuth({ keyFile: resolved, scopes: [SCOPE_WRITE] });
  const client = await auth.getClient();
  return { api: google.sheets({ version: "v4", auth: client }), sheetId };
}

/**
 * Capture the gate tail AH..AK for `row`, FORMULA-rendered so a HYPERLINK in AH is
 * preserved verbatim. Returns exactly 4 strings padded for AH, AI, AJ, AK.
 * @param {{api: import("googleapis").sheets_v4.Sheets, sheetId: string}} sheets
 * @param {number} row
 * @returns {Promise<string[]>}
 */
export async function captureTail(sheets, row) {
  const r = await sheets.api.spreadsheets.values.get({
    spreadsheetId: sheets.sheetId,
    range: rangeAHAK(row), // 'CRM_Operativo'!AH{row}:AK{row}
    valueRenderOption: "FORMULA",
  });
  const cells = (r.data.values && r.data.values[0]) || [];
  // Normalize to 4 string cells (Sheets omits trailing empties).
  return [0, 1, 2, 3].map((i) => (cells[i] != null ? String(cells[i]) : ""));
}

/**
 * Write the captured tail back to AH..AK with USER_ENTERED so a FORMULA-rendered
 * "=HYPERLINK(...)" is re-interpreted as the original formula (not literal text).
 * Independent of any browser session — safe to run in teardown after a failed write.
 * @param {{api: import("googleapis").sheets_v4.Sheets, sheetId: string}} sheets
 * @param {number} row
 * @param {string[]} tail  exactly [AH, AI, AJ, AK]
 */
export async function restoreTail(sheets, row, tail) {
  if (!Array.isArray(tail) || tail.length !== 4) {
    throw new Error(`restoreTail expects 4 cells (AH..AK), got ${tail?.length}`);
  }
  await sheets.api.spreadsheets.values.update({
    spreadsheetId: sheets.sheetId,
    range: rangeAHAK(row),
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [tail] },
  });
}

// ── CLI (emergency / manual) ─────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { row: null, capture: false, restore: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--row") out.row = Number(argv[++i]);
    else if (argv[i] === "--capture") out.capture = true;
    else if (argv[i] === "--restore") out.restore = argv[++i];
  }
  return out;
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (invokedDirectly) {
  const { row, capture, restore } = parseArgs(process.argv.slice(2));
  if (!row || row < 4) {
    process.stderr.write(`Usage: --row <n>=4 (--capture | --restore '<json 4-cell array>')\n`);
    process.exit(2);
  }
  const sheets = await loadSheets();
  if (capture) {
    const tail = await captureTail(sheets, row);
    process.stdout.write(JSON.stringify({ row, tab: CRM_TAB, range: `${Col.LINK_PRESUPUESTO}:${Col.BLOQUEAR_AUTO}`, tail }) + "\n");
  } else if (restore) {
    const tail = JSON.parse(restore);
    await restoreTail(sheets, row, tail);
    process.stderr.write(`[cockpit-sentinel-restore] row ${row} AH:AK restored\n`);
  } else {
    process.stderr.write("Nothing to do — pass --capture or --restore\n");
    process.exit(2);
  }
}
