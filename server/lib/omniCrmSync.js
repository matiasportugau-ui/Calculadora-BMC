/**
 * Construye diálogo desde filas DB y escribe Form responses 1 + CRM_Operativo (mismo flujo que WA legacy).
 */
import { defaultTailAHAK, rangeAHAK } from "./crmOperativoLayout.js";

/**
 * @param {Array<{ body_text: string | null, received_at?: string | Date, attachment_text?: string | null }>} rows
 * @param {string} contactLabel
 */
export function buildDialogoFromRows(rows, contactLabel) {
  return rows
    .map((r) => {
      const ra = r.received_at;
      const t =
        ra == null
          ? "--:--"
          : typeof ra === "string"
            ? new Date(ra).toISOString().slice(11, 16)
            : ra instanceof Date
              ? ra.toISOString().slice(11, 16)
              : "--:--";
      const body = r.body_text || "";
      const ex = r.attachment_text || "";
      const extra = ex ? ` [adjunto]: ${ex}` : "";
      return `${t} - ${contactLabel}: ${body}${extra}`;
    })
    .join("\n");
}

/**
 * @param {object} opts
 * @param {object} opts.config
 * @param {object} opts.logger
 * @param {string} opts.dialogo
 * @param {string} opts.externalContactId
 * @param {'WA-Auto'|'FB-Auto'|'IG-Auto'} opts.origen
 * @param {string} [opts.baseUrl] override fetch base
 */
export async function syncDialogoToSheets({ config, logger, dialogo, externalContactId, origen, baseUrl }) {
  const port = config.port;
  const base = (baseUrl || `http://127.0.0.1:${port}`).replace(/\/$/, "");

  try {
    const parseResp = await fetch(`${base}/api/crm/parse-conversation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dialogo }),
    });
    const parsed = await parseResp.json();

    if (!parsed.ok || !parsed.data) {
      logger?.warn?.({ parsed }, "[omni] parse-conversation no ok");
      return { ok: false, error: parsed.error || "parse failed" };
    }

    const d = parsed.data;
    const credsPath = config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
    if (!config.bmcSheetId || !credsPath) {
      logger?.warn?.("[omni] missing BMC_SHEET_ID or GOOGLE_APPLICATION_CREDENTIALS");
      return { ok: false, error: "sheets not configured" };
    }

    const { google } = await import("googleapis");
    const auth = new google.auth.GoogleAuth({
      keyFile: credsPath,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });
    const sheetId = config.bmcSheetId;
    const now = new Date().toISOString();

    const formClientes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "'Form responses 1'!C2:C200",
    });
    const formRows = formClientes.data.values || [];
    let formRow = formRows.length + 2;
    for (let i = 0; i < formRows.length; i++) {
      if (!formRows[i][0] || !formRows[i][0].toString().trim()) {
        formRow = i + 2;
        break;
      }
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'Form responses 1'!A${formRow}:P${formRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            now,
            now,
            d.cliente || "",
            d.telefono || externalContactId,
            d.ubicacion || "",
            origen,
            d.resumen_pedido || "",
            d.categoria || "",
            d.urgencia || "",
            d.cotizacion_formal || "",
            d.tipo_cliente || "",
            d.vendedor || "",
            d.observaciones || "",
            d.validar_stock || "No",
            d.probabilidad_cierre || "",
            dialogo,
          ],
        ],
      },
    });

    const crmClientes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "'CRM_Operativo'!C4:C500",
    });
    const crmVals = crmClientes.data.values || [];
    let crmRow = crmVals.length + 4;
    for (let i = 0; i < crmVals.length; i++) {
      if (!crmVals[i][0] || !crmVals[i][0].toString().trim()) {
        crmRow = i + 4;
        break;
      }
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'CRM_Operativo'!B${crmRow}:K${crmRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            now,
            d.cliente || "",
            d.telefono || externalContactId,
            d.ubicacion || "",
            origen,
            d.resumen_pedido || "",
            d.categoria || "",
            "",
            "Pendiente",
            d.vendedor || "",
          ],
        ],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'CRM_Operativo'!R${crmRow}:T${crmRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[d.probabilidad_cierre || "", d.urgencia || "", d.validar_stock || "No"]],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'CRM_Operativo'!V${crmRow}:W${crmRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[d.tipo_cliente || "", d.observaciones || ""]] },
    });

    const aiResp = await fetch(`${base}/api/crm/suggest-response`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consulta: d.resumen_pedido,
        origen,
        cliente: d.cliente,
        observaciones: d.observaciones,
      }),
    });
    const ai = await aiResp.json();
    if (ai.ok && ai.respuesta) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'CRM_Operativo'!AF${crmRow}:AG${crmRow}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[ai.respuesta, ai.provider || ""]] },
      });
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: rangeAHAK(crmRow),
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [defaultTailAHAK()] },
    });

    logger?.info?.({ crmRow, formRow, origen }, "[omni] CRM sync ok");
    return { ok: true, crmRow, formRow, provider: ai.provider };
  } catch (err) {
    logger?.error?.({ err: err.message }, "[omni] CRM sync failed");
    return { ok: false, error: err.message };
  }
}
