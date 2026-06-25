/**
 * Search the BMC CRM_Operativo sheet for existing client rows.
 *
 * Used by `buscar_cliente_crm` to prevent duplicate rows when the agent
 * is about to call `guardar_en_crm`. Reads B4:AN (all data rows) once and matches the
 * query against cliente (col C), telefono (col D, digit-only), and
 * observaciones (col W), tipo/tags taxonomía (cols AL–AM relativas al rango).
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
    // B = timestamp, C = cliente, D = telefono, … W = observaciones, AH = link;
    // AL–AM = taxonomía (índices 36–37 desde col B).
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "'CRM_Operativo'!B4:AN",
    });
    const rows = resp.data.values || [];
    const cap = Math.max(1, Math.min(50, Number(limite || 10)));

    const qLower = q.toLowerCase();
    const qDigits = normalizePhone(q);
    const isPhoneQuery = qDigits.length >= 6 && qDigits.length <= 11;
    // Uruguay RUT: 12 digits (e.g. 217123620016). Treat 12+ digit queries
    // as RUT lookups against cliente + observaciones (RUT is sometimes
    // embedded in the client name like "ACME SRL — RUT 21712362016" or in
    // the observations field). Copilot finding: prior code advertised RUT
    // search but never actually checked it.
    const isRutQuery = qDigits.length >= 12;

    const matches = [];
    for (let i = 0; i < rows.length && matches.length < cap; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;
      // Index relative to col B: C is index 1, D is index 2, W is index 21, AH is index 32, AL is index 36, AM is index 37.
      const cliente = String(r[1] || "").trim();
      if (!cliente) continue;
      const telefono = String(r[2] || "").trim();
      const ubicacion = String(r[3] || "").trim();
      const observaciones = String(r[21] || "").trim();
      const linkPresupuesto = String(r[32] || "").trim();
      const tipoContacto = String(r[36] || "").trim();
      const tagsTaxonomia = String(r[37] || "").trim();
      const timestamp = String(r[0] || "").trim();

      const clienteHit = cliente.toLowerCase().includes(qLower);
      const obsHit = observaciones.toLowerCase().includes(qLower);
      const phoneHit = isPhoneQuery && normalizePhone(telefono).includes(qDigits);
      // RUT match: digits-only across cliente + observaciones (so embedded
      // RUTs match regardless of formatting like dots/dashes).
      const rutHit = isRutQuery && (
        normalizePhone(cliente).includes(qDigits) ||
        normalizePhone(observaciones).includes(qDigits)
      );

      if (clienteHit || obsHit || phoneHit || rutHit) {
        matches.push({
          row: i + 4,
          cliente,
          telefono,
          ubicacion,
          link_presupuesto: linkPresupuesto || null,
          observaciones: observaciones.slice(0, 200) || null,
          tipo_contacto: tipoContacto || null,
          tags_taxonomia: tagsTaxonomia || null,
          timestamp: timestamp || null,
          match_via: rutHit ? "rut" : phoneHit ? "telefono" : (clienteHit ? "cliente" : "observaciones"),
        });
      }
    }

    return { ok: true, count: matches.length, matches, sheetId };
  } catch (err) {
    return { ok: false, error: err.message || "Error desconocido al leer Sheets" };
  }
}
