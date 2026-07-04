import { google } from "googleapis";
import { sanitizeCellValue } from "./sheetsCsvGuard.js";

const CHAT_TAB = "_BMC_ChatState";
const COL_I = 9;
const COL_M = 13;

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

function adminSheetId(config) {
  return config.wolfbAdminSheetId;
}

function adminTab(config) {
  return config.wolfbAdminTab || "Admin.";
}

function propKey(rowIndex) {
  return `BMC_CHAT_${rowIndex}`;
}

async function ensureChatTab(config, sheets) {
  const sheetId = adminSheetId(config);
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${CHAT_TAB}!A1:B1`,
    });
    if (res.data.values?.length) return;
  } catch {
    // tab missing — create below
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: CHAT_TAB } } }] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${CHAT_TAB}!A1:B1`,
    valueInputOption: "RAW",
    requestBody: { values: [["key", "value"]] },
  });
}

async function chatTabNumericId(config, sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: adminSheetId(config) });
  const tab = meta.data.sheets?.find((s) => s.properties?.title === CHAT_TAB);
  return tab?.properties?.sheetId;
}

async function chatTabFindRow(config, sheets, key) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: adminSheetId(config),
    range: `${CHAT_TAB}!A:A`,
  });
  const rows = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === key) return i + 1;
  }
  return -1;
}

export async function getBmcChatInquiries(config, logger) {
  const sheetId = adminSheetId(config);
  if (!sheetId) {
    logger?.warn("[bmcChat] WOLFB_ADMIN_SHEET_ID not configured");
    return [];
  }

  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${adminTab(config)}'!A:M`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const rows = res.data.values || [];
    if (rows.length < 2) return [];

    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const consulta = String(r[COL_I - 1] ?? "").trim();
      const linkM = String(r[COL_M - 1] ?? "").trim();
      if (consulta && !linkM) result.push({ row: i + 1, consulta });
    }
    return result;
  } catch (err) {
    logger?.error({ err: err.message }, "[bmcChat] getInquiries failed");
    throw err;
  }
}

export async function getBmcChatConversation(config, rowIndex, logger) {
  const sheetId = adminSheetId(config);
  if (!sheetId) return null;

  try {
    const sheets = await getSheetsClient();
    await ensureChatTab(config, sheets);
    const key = propKey(rowIndex);
    const row = await chatTabFindRow(config, sheets, key);
    if (row === -1) return null;
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${CHAT_TAB}!B${row}`,
    });
    const raw = res.data.values?.[0]?.[0];
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger?.error({ err: err.message, rowIndex }, "[bmcChat] getConversation failed");
    return null;
  }
}

export async function saveBmcChatConversation(config, rowIndex, data, logger) {
  const sheetId = adminSheetId(config);
  if (!sheetId) throw new Error("WOLFB_ADMIN_SHEET_ID not configured");

  const sheets = await getSheetsClient();
  await ensureChatTab(config, sheets);
  const key = propKey(rowIndex);
  const row = await chatTabFindRow(config, sheets, key);
  const json = JSON.stringify(data);

  if (row === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${CHAT_TAB}!A:B`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[key, json]] },
    });
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${CHAT_TAB}!B${row}`,
      valueInputOption: "RAW",
      requestBody: { values: [[json]] },
    });
  }
  logger?.info({ rowIndex }, "[bmcChat] saved conversation");
  return true;
}

export async function clearBmcChatConversation(config, rowIndex, logger) {
  const sheetId = adminSheetId(config);
  if (!sheetId) return false;

  try {
    const sheets = await getSheetsClient();
    await ensureChatTab(config, sheets);
    const key = propKey(rowIndex);
    const row = await chatTabFindRow(config, sheets, key);
    if (row === -1) return true;

    const numericSheetId = await chatTabNumericId(config, sheets);
    if (numericSheetId == null) return false;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId: numericSheetId, dimension: "ROWS", startIndex: row - 1, endIndex: row },
          },
        }],
      },
    });
    logger?.info({ rowIndex }, "[bmcChat] cleared conversation");
    return true;
  } catch (err) {
    logger?.error({ err: err.message, rowIndex }, "[bmcChat] clearConversation failed");
    return false;
  }
}

export async function writeBmcChatInterpretation(config, rowIndex, interpretation, logger) {
  const sheetId = adminSheetId(config);
  if (!sheetId) throw new Error("WOLFB_ADMIN_SHEET_ID not configured");

  const j = sanitizeCellValue(interpretation.interpretation_J || "");
  const k = sanitizeCellValue(interpretation.question_K || "");
  const missingRaw = interpretation.missing_L;
  const l = sanitizeCellValue(
    Array.isArray(missingRaw) ? missingRaw.filter(Boolean).join(", ") : (missingRaw || ""),
  );

  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `'${adminTab(config)}'!J${rowIndex}:L${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[j, k, l]] },
  });
  logger?.info({ rowIndex }, "[bmcChat] wrote interpretation to Admin sheet");
  return { success: true };
}
