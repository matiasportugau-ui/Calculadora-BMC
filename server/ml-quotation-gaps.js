/**
 * server/ml-quotation-gaps.js
 * Heurísticas para marcar qué falta antes de cotizar en ML (sin inventar datos).
 * Usado por ml-crm-sync (generateResponse) y scripts/ml-pending-workup.mjs.
 */

const CLOSE = "Saludos BMC URUGUAY!";

/**
 * @param {{ text?: string }} q
 * @param {{ title?: string, price?: number }} item
 * @returns {{ missingPoints: string[], warnings: string[], readyToQuote: boolean }}
 */
export function analyzeQuotationGaps(q, item) {
  const text = (q.text || "").trim();
  const lower = text.toLowerCase();
  const title = (item?.title || "").toLowerCase();
  const missing = [];
  const warnings = [];

  // Cantidad ambigua: "necesito 1" y luego "4" / "necesitaría 4"
  if (
    /\bnecesito\s+1\b/i.test(text) &&
    (/\bnecesitar[ií]a\s*4\b/i.test(text) || /\b4\s+con\s+env/i.test(lower))
  ) {
    missing.push(
      "confirmar cantidad exacta de placas (el mensaje menciona 1 unidad y también 4)"
    );
  }

  // Espesor en pregunta vs título de publicación
  const mm = lower.match(/(\d+)\s*mm\b/);
  if (mm) {
    const e = mm[1];
    if (title && !title.includes(`${e}mm`) && !title.includes(`${e} mm`)) {
      warnings.push(
        `verificar que la publicación sea ${e} mm (título actual no repite ese espesor)`
      );
    }
  }

  // Envío sin ciudad/zona
  if (/\benv[ií]o\b|\bflete\b|\bentrega\b/.test(lower)) {
    const hasPlace =
      /(piri[aá]polis|piripolis|montevideo|maldonado|colonia|salto|punta del este|tacuaremb[oó]|canelones|rivera|durazno|florida|rocha|treinta y tres|lavalleja|soriano|artigas|paysand[uú]|r[ií]o negro|san jos[eé])/i.test(
        text
      );
    if (!hasPlace) {
      missing.push("ciudad o zona de entrega para cotizar el traslado");
    }
  }

  // Medidas mínimas: largo/ancho sueltos sin aclarar uso (techo vs pared)
  const hasRoughDims =
    /\d+\s*(m|metros?)\b/.test(lower) &&
    (lower.includes("largo") || lower.includes("ancho") || lower.includes("de ancho"));
  if (hasRoughDims && !lower.includes("techo") && !lower.includes("fachada") && !lower.includes("pared") && !lower.includes("cubierta")) {
    warnings.push(
      "si aplica, confirmar si es para techo o fachada/pared para orientar el presupuesto"
    );
  }

  // Botón comprar / cierre de compra en ML
  if (/\bcomprar\b|\ble doy\b/i.test(text)) {
    warnings.push(
      "responder en el mismo canal ML; no pedir teléfono/email si la política del sitio lo restringe"
    );
  }

  return {
    missingPoints: missing,
    warnings,
    readyToQuote: missing.length === 0,
  };
}

/**
 * Texto corto para CRM o borrador cuando hay bloqueos.
 * @param {string} nickname
 * @param {{ missingPoints: string[], warnings: string[] }} gaps
 */
export function formatGapsForOperator(nickname, gaps) {
  const first =
    nickname.replace(/[_\d]/g, " ").trim().split(" ")[0] || nickname;
  const parts = [];
  if (gaps.missingPoints.length) {
    parts.push(`Para cotizar bien: ${gaps.missingPoints.join("; ")}.`);
  }
  if (gaps.warnings.length) {
    parts.push(`Notas: ${gaps.warnings.join("; ")}.`);
  }
  if (parts.length === 0) return "";
  return `Hola ${first}! Gracias por tu consulta. ${parts.join(" ")} ${CLOSE}`;
}
