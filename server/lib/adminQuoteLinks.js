/**
 * Admin 2.0 rich-link cells (col M = PDF 🧾, col AO = edit 🧮).
 * Spec: bmc-sheet-quote-pipeline/docs/ADMIN-QUOTE-LINKS.md
 */
import { config } from "../config.js";
import { getSheetsClient } from "./googleSheetsAuth.js";

const LINK_STYLE = {
  foregroundColorStyle: { rgbColor: { red: 0.1, green: 0.35, blue: 0.85 } },
  underline: true,
  bold: true,
  fontSize: 18,
};

/** M = 12 (0-based). AO = 40. L = 11. */
export const ADMIN_COL = Object.freeze({ L: 11, M: 12, AO: 40 });

export function multiLinkCell(segments, sep = "  ") {
  let text = "";
  const runs = [];
  for (let i = 0; i < segments.length; i++) {
    if (i > 0) text += sep;
    const start = text.length;
    text += segments[i].label;
    runs.push({
      startIndex: start,
      format: { link: { uri: segments[i].url }, ...LINK_STYLE },
    });
  }
  return { text, runs };
}

export function buildPdfLinkCell(variants) {
  const segs = (variants || [])
    .map((v) => ({ label: v.label, url: String(v.pdfUrl || v.url || "").trim() }))
    .filter((v) => /^https:\/\//i.test(v.url));
  if (!segs.length) return null;
  if (segs.length === 1) return multiLinkCell([{ label: "🧾", url: segs[0].url }]);
  return multiLinkCell(segs.map((s, i) => ({ label: `🧾${i + 1}`, url: s.url })));
}

export function normalizePdfVariants(pdfs) {
  const list = Array.isArray(pdfs) ? pdfs : pdfs ? [pdfs] : [];
  return list
    .map((item) => {
      if (typeof item === "string") return { pdfUrl: item.trim() };
      if (item && typeof item === "object") {
        return { pdfUrl: String(item.pdfUrl || item.url || "").trim(), label: item.label };
      }
      return null;
    })
    .filter((v) => v?.pdfUrl);
}

export async function writeRichLinkCells(cells, { sheetId, tab } = {}) {
  if (!cells?.length) return { written: 0 };
  const sid = sheetId || config.wolfbAdminSheetId;
  const tabName = tab || config.wolfbAdminTab || "Admin.";
  if (!sid) {
    const err = new Error("WOLFB_ADMIN_SHEET_ID no configurado");
    err.code = "admin_sheet_unconfigured";
    throw err;
  }
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sid,
    fields: "sheets.properties(sheetId,title)",
  });
  const sheet = (meta.data.sheets || []).find(
    (s) => s.properties.title === tabName || s.properties.title === String(tabName).replace(/\.$/, ""),
  );
  if (!sheet) throw new Error(`Admin tab not found: ${tabName}`);
  const gridId = sheet.properties.sheetId;

  const requests = cells.map((c) => ({
    updateCells: {
      range: {
        sheetId: gridId,
        startRowIndex: c.row - 1,
        endRowIndex: c.row,
        startColumnIndex: c.col,
        endColumnIndex: c.col + 1,
      },
      rows: [
        {
          values: [
            {
              userEnteredValue: { stringValue: c.text },
              textFormatRuns: c.runs,
            },
          ],
        },
      ],
      fields: "userEnteredValue,textFormatRuns",
    },
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sid,
    requestBody: { requests },
  });
  return { ok: true, written: cells.length, sheetId: sid, tab: tabName };
}

/**
 * Write 🧾 PDF links on Admin row col M. Optional estado → col L as plain text.
 */
export async function writeAdminPdfLinks({ row, pdfs, estado } = {}) {
  const rowNum = Number(row);
  if (!Number.isFinite(rowNum) || rowNum < 2) {
    return { ok: false, error: "row (>=2) requerido" };
  }
  const variants = normalizePdfVariants(pdfs);
  const pdfCell = buildPdfLinkCell(variants);
  if (!pdfCell) return { ok: false, error: "pdfs: pasá al menos una URL https" };

  const cells = [{ row: rowNum, col: ADMIN_COL.M, ...pdfCell }];
  const written = await writeRichLinkCells(cells);

  let estadoWritten = false;
  const estadoTxt = String(estado || "").trim();
  if (estadoTxt) {
    const sheets = await getSheetsClient();
    const tab = config.wolfbAdminTab || "Admin.";
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.wolfbAdminSheetId,
      range: `'${tab}'!L${rowNum}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[estadoTxt.slice(0, 80)]] },
    });
    estadoWritten = true;
  }

  return {
    ok: true,
    row: rowNum,
    col: "M",
    icons: pdfCell.text,
    pdf_count: variants.length,
    estado_written: estadoWritten,
    ...written,
  };
}
