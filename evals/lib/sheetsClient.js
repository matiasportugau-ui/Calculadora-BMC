/**
 * sheetsClient.js — Cliente autenticado a Google Sheets para el harness de evals.
 *
 * Reusa la convención de auth del proyecto:
 *   - GOOGLE_APPLICATION_CREDENTIALS apunta a un service-account.json (default)
 *   - Fallback inline: GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY (variantes
 *     útiles en entornos donde no se puede montar archivo, como Cloud Run /
 *     GitHub Actions / contenedores efímeros de Claude Code on the web).
 *
 * Falla con mensaje claro indicando qué setear. No exporta secrets.
 */

import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

let cachedAuth = null;

function resolveCredentials() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath && fs.existsSync(path.resolve(credPath))) {
    return { mode: "file", credPath: path.resolve(credPath) };
  }
  const inlineEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const inlineKey = process.env.GOOGLE_PRIVATE_KEY;
  if (inlineEmail && inlineKey) {
    return {
      mode: "inline",
      email: inlineEmail,
      key: inlineKey.replace(/\\n/g, "\n"),
    };
  }
  const inlineJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    try {
      const parsed = JSON.parse(inlineJson);
      if (parsed.client_email && parsed.private_key) {
        return {
          mode: "inline-json",
          email: parsed.client_email,
          key: parsed.private_key,
        };
      }
    } catch {
      // fallthrough
    }
  }
  return { mode: "none" };
}

export function getSheetsClient() {
  if (cachedAuth) return cachedAuth;

  const cred = resolveCredentials();
  if (cred.mode === "none") {
    throw new Error(
      "Credenciales de Google no disponibles. Setear UNA de:\n" +
        "  - GOOGLE_APPLICATION_CREDENTIALS=<path/to/service-account.json>\n" +
        "  - GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY (con \\n escapadas)\n" +
        "  - GOOGLE_SERVICE_ACCOUNT_JSON=<JSON inline>\n",
    );
  }

  let auth;
  if (cred.mode === "file") {
    auth = new google.auth.GoogleAuth({
      keyFile: cred.credPath,
      scopes: SCOPES,
    });
  } else {
    auth = new google.auth.JWT({
      email: cred.email,
      key: cred.key,
      scopes: SCOPES,
    });
  }
  const sheets = google.sheets({ version: "v4", auth });
  cachedAuth = { sheets, mode: cred.mode };
  return cachedAuth;
}

export function getSheetId() {
  const id = process.env.WOLFB_ADMIN_SHEET_ID || process.env.BMC_ENVIADOS_SHEET_ID;
  if (!id) {
    throw new Error(
      "Falta WOLFB_ADMIN_SHEET_ID (o BMC_ENVIADOS_SHEET_ID) en .env.",
    );
  }
  return id;
}

export async function readRange(range) {
  const { sheets } = getSheetsClient();
  const spreadsheetId = getSheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  return res.data.values || [];
}
