// quoteMetadata.js — pure whitelist for quote_embeddings.metadata.
//
// RAG retrieval injects historical-quote metadata into LLM prompts (kbBridge /
// rag formatters). Past quotes carry customer PII (name, phone, email, address,
// salesperson) which must NOT be sent to external LLM providers. This whitelist
// keeps only non-PII quote facts and is applied both at STORAGE time
// (scripts/training/embedQuotes.js) and at INJECTION time (defense-in-depth).
export const QUOTE_METADATA_WHITELIST = [
  "fecha",
  "panel_familia",
  "panel_espesor",
  "scenario",
  "area_m2",
  "largo_m",
  "ancho_m",
  "total_sin_iva_usd",
  "total_con_iva_usd",
  "lista_precios",
];

/**
 * Return a copy of `meta` containing only the non-PII quote facts in the
 * whitelist (drops cliente_nombre, telefono, email, ubicacion, vendedor, and
 * any free-text fields like resumen_pedido/observaciones).
 * @param {object} meta
 * @returns {object}
 */
export function sanitizeQuoteMetadata(meta) {
  const out = {};
  if (!meta || typeof meta !== "object") return out;
  for (const k of QUOTE_METADATA_WHITELIST) {
    if (meta[k] != null) out[k] = meta[k];
  }
  return out;
}
