/**
 * Multi-key match: Ventas stop ↔ Admin / Master_Cotizaciones quote rows.
 * Keys: orderId (pedido), client name, phone (UY-normalized).
 *
 * Auto-apply only when unique high-confidence (see shouldAutoApplyMatch).
 */

/** Weights (sum can exceed 1; score is min(1, sum of hit weights / maxWeights)) */
export const MATCH_WEIGHTS = Object.freeze({
  orderIdExact: 0.55,
  phoneExact: 0.3,
  nameExact: 0.25,
  nameFuzzy: 0.12,
});

export const AUTO_APPLY_MIN_SCORE = 0.85;
export const AMBIGUOUS_SCORE_GAP = 0.1;

/**
 * Normalize UY phone to digits-only comparable form.
 * Strips spaces, dashes, leading 0, optional country 598.
 * @param {string} raw
 * @returns {string} e.g. "99382033" or ""
 */
export function normalizeUyPhone(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("598")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  // keep last 8–9 digits (mobile/land)
  if (d.length > 9) d = d.slice(-9);
  return d;
}

/**
 * @param {string} s
 */
export function normalizePersonName(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Token Jaccard-ish for names (0–1).
 * @param {string} a
 * @param {string} b
 */
export function nameSimilarity(a, b) {
  const na = normalizePersonName(a);
  const nb = normalizePersonName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const ta = new Set(na.split(" ").filter((t) => t.length > 1));
  const tb = new Set(nb.split(" ").filter((t) => t.length > 1));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union ? inter / union : 0;
}

/**
 * Normalize pedido / quote id for comparison.
 * @param {string} raw
 */
export function normalizeOrderId(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const digits = s.replace(/\D/g, "");
  if (digits.length >= 4) return digits;
  return s.toLowerCase();
}

/**
 * Score one quote candidate against query keys from Ventas.
 * @param {{ orderId?: string, nombre?: string, cliente?: string, telefono?: string, tel?: string }} query
 * @param {{ orderId?: string, pedido?: string, cotizacionId?: string, nombre?: string, cliente?: string, telefono?: string, tel?: string, phone?: string, id?: string }} quote
 * @returns {{ score: number, reasons: string[], hits: object }}
 */
export function scoreQuoteMatch(query, quote) {
  const reasons = [];
  const hits = { orderId: false, phone: false, nameExact: false, nameFuzzy: false };
  let score = 0;

  const qOrder = normalizeOrderId(query.orderId || query.pedido || query.cotizacionId || "");
  const quoteOrder = normalizeOrderId(
    quote.orderId || quote.pedido || quote.cotizacionId || quote.CODIGO || quote.codigo || quote.id || "",
  );
  if (qOrder && quoteOrder && qOrder === quoteOrder) {
    score += MATCH_WEIGHTS.orderIdExact;
    hits.orderId = true;
    reasons.push(`pedido exacto ${qOrder}`);
  }

  const qPhone = normalizeUyPhone(query.telefono || query.tel || query.phone || "");
  const quotePhone = normalizeUyPhone(
    quote.telefono || quote.tel || quote.phone || quote.TELEFONO || quote.CONTACTO || "",
  );
  if (qPhone && quotePhone && qPhone === quotePhone) {
    score += MATCH_WEIGHTS.phoneExact;
    hits.phone = true;
    reasons.push(`tel exacto ${qPhone}`);
  }

  const qName = query.nombre || query.cliente || query.NOMBRE || "";
  const quoteName = quote.nombre || quote.cliente || quote.NOMBRE || quote.CLIENTE || "";
  const sim = nameSimilarity(qName, quoteName);
  if (sim >= 0.99) {
    score += MATCH_WEIGHTS.nameExact;
    hits.nameExact = true;
    reasons.push("nombre exacto");
  } else if (sim >= 0.55) {
    score += MATCH_WEIGHTS.nameFuzzy * sim;
    hits.nameFuzzy = true;
    reasons.push(`nombre ~${(sim * 100).toFixed(0)}%`);
  }

  // Cap at 1
  score = Math.min(1, Math.round(score * 1000) / 1000);

  // Penalize name-only weak with no other hit
  if (hits.nameFuzzy && !hits.orderId && !hits.phone && !hits.nameExact && score < 0.2) {
    score = Math.min(score, 0.15);
  }

  return { score, reasons, hits };
}

/**
 * @param {object} query { orderId, nombre, telefono }
 * @param {object[]} quotes
 * @param {{ minScore?: number }} [opts]
 * @returns {{ matches: Array, best: object|null, ambiguous: boolean, autoApply: boolean }}
 */
export function matchAdminQuotes(query, quotes, opts = {}) {
  const minScore = opts.minScore ?? 0.12;
  const list = Array.isArray(quotes) ? quotes : [];
  const scored = list
    .map((quote, index) => {
      const { score, reasons, hits } = scoreQuoteMatch(query, quote);
      return {
        quote,
        index,
        score,
        reasons,
        hits,
        id: quote.id || quote.orderId || quote.pedido || quote.cotizacionId || `q${index}`,
      };
    })
    .filter((m) => m.score >= minScore)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const best = scored[0] || null;
  const second = scored[1] || null;
  const ambiguous = Boolean(
    best &&
      second &&
      best.score - second.score < AMBIGUOUS_SCORE_GAP &&
      second.score >= minScore,
  );

  const autoApply = shouldAutoApplyMatch(best, { ambiguous, query });

  return {
    matches: scored,
    best,
    ambiguous,
    autoApply,
  };
}

/**
 * @param {object|null} best
 * @param {{ ambiguous?: boolean, query?: object }} ctx
 */
export function shouldAutoApplyMatch(best, ctx = {}) {
  if (!best || ctx.ambiguous) return false;
  // Unique exact pedido always
  if (best.hits?.orderId && best.score >= MATCH_WEIGHTS.orderIdExact) return true;
  // Strong combined score
  if (best.score >= AUTO_APPLY_MIN_SCORE) return true;
  // Pedido + anything
  if (best.hits?.orderId && (best.hits.phone || best.hits.nameExact || best.hits.nameFuzzy)) return true;
  // Name alone never
  if ((best.hits?.nameExact || best.hits?.nameFuzzy) && !best.hits?.orderId && !best.hits?.phone) {
    return false;
  }
  return false;
}

/**
 * Map a generic Admin/quote row into a flat matchable shape.
 * Tolerates Master_Cotizaciones-style keys and CRM keys.
 * @param {object} row
 */
export function normalizeAdminQuoteRow(row) {
  if (!row || typeof row !== "object") return null;
  return {
    id: row.id || row.ID || row.CODIGO || row.codigo || "",
    orderId:
      row.orderId ||
      row.pedido ||
      row.PEDIDO ||
      row.NRO_PEDIDO ||
      row.nroPedido ||
      row.cotizacionId ||
      row.CODIGO ||
      "",
    cotizacionId: row.cotizacionId || row.CODIGO || row.codigo || row.id || "",
    nombre: row.nombre || row.cliente || row.NOMBRE || row.CLIENTE || row.Cliente || "",
    telefono: row.telefono || row.tel || row.TELEFONO || row.CONTACTO || row.phone || "",
    pdfLink: row.pdfLink || row.LINK_COTIZACION || row.linkPdf || row.PDF || row.pdf || "",
    raw: row,
  };
}
