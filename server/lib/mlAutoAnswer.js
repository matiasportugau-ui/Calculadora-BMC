/**
 * server/lib/mlAutoAnswer.js
 * Full webhook auto-answer pipeline:
 *   1. Generate AI response
 *   2. Save to CRM col AF (respuestaSugerida)
 *   3. Answer question on MercadoLibre
 *   4. Stamp CRM col AJ (enviadoEl)
 *
 * Called by the webhook handler in server/index.js when autoMode.fullAuto is ON.
 */

import { google } from "googleapis";
import { generateAiResponse } from "./suggestResponse.js";

const SHEET_TAB = "CRM_Operativo";

/**
 * @param {{
 *   rows: Array<{ questionId: string, rowNum: number, questionText: string, itemTitle: string, nickname: string }>,
 *   ml:       ReturnType<import('../mercadoLibreClient.js').createMercadoLibreClient>,
 *   sheetId:  string,
 *   credsPath: string,
 *   config:   object,
 *   logger?:  object,
 * }} opts
 * @returns {Promise<{ answered: number }>}
 */
export async function autoAnswerPipeline({ rows, ml, sheetId, credsPath, config, logger = console }) {
  if (!rows || rows.length === 0) return { answered: 0 };

  const auth = new google.auth.GoogleAuth({
    ...(credsPath ? { keyFile: credsPath } : {}),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });

  let answered = 0;

  for (const { questionId, rowNum, questionText, itemTitle, nickname } of rows) {
    try {
      // 1. Generate AI response
      const { text, provider } = await generateAiResponse({
        consulta:  questionText,
        origen:    "ML",
        cliente:   nickname,
        producto:  itemTitle,
        config,
      });

      if (!text) {
        logger.warn?.(`autoAnswer: empty AI response for Q:${questionId}`);
        continue;
      }

      // 2. Save to CRM col AF (respuestaSugerida)
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range:          `'${SHEET_TAB}'!AF${rowNum}`,
        valueInputOption: "USER_ENTERED",
        requestBody:    { values: [[text]] },
      });

      // 3. Answer on MercadoLibre
      await ml.requestWithRetries({
        method: "POST",
        path:   "/answers",
        body:   { question_id: Number(questionId), text },
      });

      // 4. Stamp CRM col AJ (enviadoEl)
      const stamp = new Date().toLocaleString("es-UY", {
        timeZone: "America/Montevideo",
        hour12:   false,
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range:          `'${SHEET_TAB}'!AJ${rowNum}`,
        valueInputOption: "USER_ENTERED",
        requestBody:    { values: [[stamp]] },
      });

      answered++;
      logger.info?.(`autoAnswer: Q:${questionId} answered via ${provider} (row ${rowNum})`);

    } catch (err) {
      logger.error?.({ err }, `autoAnswer: pipeline failed for Q:${questionId}`);
    }
  }

  return { answered };
}
