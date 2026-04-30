/**
 * Search the BMC CRM_Operativo sheet for existing client rows.
 *
 * Used by `buscar_cliente_crm` to prevent duplicate rows when the agent
 * is about to call `guardar_en_crm`. Reads B4:AH500 once and matches the
 * query against cliente (col C), telefono (col D, digit-only), and
 * observaciones (col W).
 *
 * Returns { ok, count, matches[], sheetId } on success, or
 * { ok:false, error } if BMC_SHEET_ID / Google creds aren't configured.
 */
import { google } from "googleapis";
import { config } from "../config.js";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

async function getSheetsClient() {
  const credsPath = config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  if (!credsPath) {
    const auth = new google.auth.GoogleAuth({ scopes: [SCOPE] });
    return google.sheets({ version: "v4", auth: await auth.getClient() });
  }
  const auth = new google.auth.GoogleAuth({ keyFile: credsPath, scopes: [SCOPE] });
  return google.sheets({ version: "v4", auth: await auth.getClient() });
}

function normalizePhone(s) {
  return String(s || "").replace(/\D/g, "");
}

/**
 * @param {object} input
 * @param {string} input.query    Free text — name fragment, phone, or RUT.
 * @param {number} [input.limite] Max matches. Default 10, max 50.
 * @returns {Promise<{ok:true,count:number,matches:Array,sheetId:string}|{ok:false,error:string}>}
 */
export async function searchCrmClients({ query, limite = 10 } = {}) {
  const sheetId = config.bmcSheetId;
  if (!sheetId) {
    return { ok: false, error: "BMC_SHEET_ID no configurado — no se puede buscar en CRM_Operativo" };
  }

  const q = String(query || "").trim();
  if (!q) return { ok: false, error: "query requerido (nombre, teléfono o RUT)" };

  let sheets;
  try {
    sheets = await getSheetsClient();
  } catch (err) {
    return { ok: false, error: `Google auth falló: ${err.message}` };
  }

  try {
    // B = timestamp, C = cliente, D = telefono, E = ubicacion, ..., W = observaciones
    // AH = link presupuesto. Read B:AH so we cover all relevant columns.
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "'CRM_Operativo'!B4:AH500",
    });
    const rows = resp.data.values || [];
    const cap = Math.max(1, Math.min(50, Number(limite || 10)));

    const qLower = q.toLowerCase();
    const qDigits = normalizePhone(q);
    const isPhoneQuery = qDigits.length >= 6;

    const matches = [];
    for (let i = 0; i < rows.length && matches.length < cap; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;
      // Index relative to col B: C is index 1, D is index 2, W is index 21, AH is index 32.
      const cliente = String(r[1] || "").trim();
      if (!cliente) continue;
      const telefono = String(r[2] || "").trim();
      const ubicacion = String(r[3] || "").trim();
      const observaciones = String(r[21] || "").trim();
      const linkPresupuesto = String(r[32] || "").trim();
      const timestamp = String(r[0] || "").trim();

      const clienteHit = cliente.toLowerCase().includes(qLower);
      const obsHit = observaciones.toLowerCase().includes(qLower);
      const phoneHit = isPhoneQuery && normalizePhone(telefono).includes(qDigits);

      if (clienteHit || obsHit || phoneHit) {
        matches.push({
          row: i + 4,
          cliente,
          telefono,
          ubicacion,
          link_presupuesto: linkPresupuesto || null,
          observaciones: observaciones.slice(0, 200) || null,
          timestamp: timestamp || null,
          match_via: phoneHit ? "telefono" : (clienteHit ? "cliente" : "observaciones"),
        });
      }
    }

    return { ok: true, count: matches.length, matches, sheetId };
  } catch (err) {
    return { ok: false, error: err.message || "Error desconocido al leer Sheets" };
  }
}
