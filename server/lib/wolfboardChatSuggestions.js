/**
 * Server-injected quick replies after Wolfboard tools succeed in Panelin chat.
 * `send` strings align with userIntentClassifier patterns where writes need approval.
 * See server/lib/userIntentClassifier.js (wolfboard_sync, wolfboard_quote_batch).
 */

import { normalizeSuggestionsPayload } from "./suggestionsNormalize.js";

const WB_TITLE = "Wolfboard — siguientes pasos";

/**
 * @param {string} toolName
 * @param {unknown} parsed — JSON.parse(tool result)
 * @returns {{ groups: { title?: string, items: { label: string, send: string }[] }[] } | null}
 */
export function wolfboardSuggestionsAfterTool(toolName, parsed) {
  if (!parsed || typeof parsed !== "object" || parsed.ok !== true) return null;

  /** @type {{ title?: string, items: { label: string, send: string }[] }[]} */
  const groups = [];

  switch (toolName) {
    case "wolfboard_pendientes":
      groups.push({
        title: WB_TITLE,
        items: [
          { label: "Exportar CSV", send: "Exportá el CSV de pendientes Wolfboard scope consulta." },
          { label: "Sincronizar → CRM", send: "Sincronizá Wolfboard con el CRM." },
          { label: "Respuestas IA (batch)", send: "Generá las respuestas con IA para todas las pendientes Wolfboard." },
          { label: "Actualizar lista", send: "Volvé a mostrar las filas pendientes Wolfboard scope consulta." },
        ],
      });
      break;
    case "wolfboard_export":
      groups.push({
        title: WB_TITLE,
        items: [
          { label: "Ver pendientes", send: "Mostrá las filas pendientes Wolfboard scope consulta." },
          { label: "Sincronizar → CRM", send: "Sincronizá Wolfboard con el CRM." },
          { label: "Respuestas IA (batch)", send: "Generá las respuestas con IA para todas las pendientes Wolfboard." },
        ],
      });
      break;
    case "wolfboard_sync":
      groups.push({
        title: WB_TITLE,
        items: [
          { label: "Ver pendientes", send: "Mostrá las filas pendientes Wolfboard scope consulta." },
          { label: "Exportar CSV", send: "Exportá el CSV de pendientes Wolfboard scope consulta." },
        ],
      });
      break;
    case "wolfboard_quote_batch":
      groups.push({
        title: WB_TITLE,
        items: [
          { label: "Ver pendientes", send: "Mostrá las filas pendientes Wolfboard scope consulta." },
          { label: "Sincronizar → CRM", send: "Sincronizá Wolfboard con el CRM." },
          { label: "Exportar CSV", send: "Exportá el CSV de pendientes Wolfboard scope consulta." },
        ],
      });
      break;
    case "wolfboard_actualizar_fila":
    case "wolfboard_marcar_enviado":
      groups.push({
        title: WB_TITLE,
        items: [
          { label: "Ver pendientes", send: "Mostrá las filas pendientes Wolfboard scope consulta." },
          { label: "Exportar CSV", send: "Exportá el CSV de pendientes Wolfboard scope consulta." },
        ],
      });
      break;
    default:
      return null;
  }

  return normalizeSuggestionsPayload({ groups });
}
