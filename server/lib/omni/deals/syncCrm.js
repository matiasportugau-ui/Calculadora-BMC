/**
 * Dual-write omni_deals ↔ CRM_Operativo Sheets (WAVE 4 F3).
 * Sheets remains authoritative when OMNI_DEALS_SHEETS_AUTHORITY=1 (default).
 */
import { google } from "googleapis";
import { config } from "../../../config.js";
import { getGoogleAuthClient } from "../../googleAuthCache.js";
import { stageToCrmEstado } from "./stageMachine.js";

const SCOPE_WRITE = "https://www.googleapis.com/auth/spreadsheets";

function colIndexToLetter(index) {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Push deal fields to CRM row when properties.crm_row_id is set.
 * @param {object} deal — omni_deals row
 * @returns {Promise<{ ok: boolean, skipped?: boolean, error?: string }>}
 */
export async function syncDealToCrm(deal) {
  if (!config.bmcSheetId) {
    return { ok: false, error: "bmc_sheet_id_missing" };
  }
  if (config.wolfbDryRun) {
    return { ok: true, skipped: true, reason: "wolfb_dry_run" };
  }

  const props = deal.properties || {};
  const crmRowId = props.crm_row_id || props.crm_id;
  if (!crmRowId) {
    return { ok: true, skipped: true, reason: "no_crm_row_linked" };
  }

  try {
    const authClient = await getGoogleAuthClient(SCOPE_WRITE);
    const sheets = google.sheets({ version: "v4", auth: authClient });
    const tab = config.wolfbCrmMainTab || "CRM_Operativo";

    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: config.bmcSheetId,
      range: `'${tab}'!A3:ZZ3`,
    });
    const headers = (headerRes.data.values || [[]])[0] || [];

    const idCol = headers.findIndex((h) => h === "ID");
    if (idCol === -1) return { ok: false, error: "crm_id_column_missing" };

    const dataRes = await sheets.spreadsheets.values.get({
      spreadsheetId: config.bmcSheetId,
      range: `'${tab}'!A4:ZZ`,
    });
    const dataRows = dataRes.data.values || [];
    const rowIndex = dataRows.findIndex((r) => String(r[idCol] || "") === String(crmRowId));
    if (rowIndex === -1) return { ok: false, error: "crm_row_not_found", crm_row_id: crmRowId };

    const spreadsheetRowNum = rowIndex + 4;
    const updates = [];

    const estadoCol = headers.findIndex((h) => h === "Estado");
    if (estadoCol !== -1) {
      updates.push({
        range: `'${tab}'!${colIndexToLetter(estadoCol)}${spreadsheetRowNum}`,
        values: [[stageToCrmEstado(deal.stage)]],
      });
    }

    const montoCol = headers.findIndex((h) => h === "Monto estimado USD");
    if (montoCol !== -1 && deal.value_usd != null) {
      updates.push({
        range: `'${tab}'!${colIndexToLetter(montoCol)}${spreadsheetRowNum}`,
        values: [[deal.value_usd]],
      });
    }

    if (updates.length === 0) {
      return { ok: true, skipped: true, reason: "no_fields_to_sync" };
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: config.bmcSheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data: updates },
    });

    return { ok: true, synced_fields: updates.length, crm_row_id: crmRowId };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
