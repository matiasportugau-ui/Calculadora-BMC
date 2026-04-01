/**
 * Extrae "N° Pedido" y "N° Retiro" desde texto libre (p. ej. columna ESTADO en 2.0 Ventas).
 * Patrones típicos: "N° Pedido 1342836 / N° Retiro 53733", "Nº Pedido ...", variantes de símbolo °/º.
 */

const RE_PEDIDO = /n[°º]?\s*pedido\s*[:\s]*([^\s/]+)/i;
const RE_RETIRO = /n[°º]?\s*retiro\s*[:\s]*([^\s/]+)/i;

export function parsePedidoRetiroFromFreeText(text) {
  const s = String(text || "").trim();
  if (!s) return { orderId: "", pickupId: "" };
  const pedido = RE_PEDIDO.exec(s);
  const retiro = RE_RETIRO.exec(s);
  return {
    orderId: pedido ? String(pedido[1]).trim() : "",
    pickupId: retiro ? String(retiro[1]).trim() : "",
  };
}

function normalizeSegment(seg) {
  let x = String(seg ?? "").trim();
  if (!x) return "";
  x = x.replace(/^n[°º]?\s*(pedido|retiro)?\s*[:\s]*/i, "").trim();
  return x;
}

/**
 * Columna **C** (2.0 Ventas): solo **ID / Nº Pedido**.
 * Si queda texto viejo con `placeholder | pedido`, se toma el **último** tramo tras `|` como pedido.
 * @returns {{ orderId: string, source: 'pipe'|'single'|'empty' }}
 */
export function parsePedidoFromColumnC(text) {
  const s = String(text ?? "").trim();
  if (!s) return { orderId: "", source: "empty" };
  if (s.includes("|")) {
    const parts = s.split("|").map((p) => normalizeSegment(p)).filter(Boolean);
    const orderId = parts.length ? parts[parts.length - 1] : "";
    return { orderId, source: "pipe" };
  }
  return { orderId: normalizeSegment(s), source: "single" };
}

/**
 * Columna **F**: texto donde el **Nº Retiro** va como último campo (p. ej. al final o tras `|`).
 * Toma la **última** coincidencia de `N° Retiro …` en la celda; si no hay, intenta el último segmento `|`.
 * @returns {string}
 */
export function parsePickupIdFromColumnF(text) {
  const s = String(text ?? "").trim();
  if (!s) return "";
  const re = /n[°º]?\s*retiro\s*[:\s]*([^\s/|]+)/gi;
  let last = "";
  let m;
  while ((m = re.exec(s)) !== null) {
    last = String(m[1]).trim();
  }
  if (last) return last;

  const parts = s
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return "";
  const lastSeg = parts[parts.length - 1];
  const mm = RE_RETIRO.exec(lastSeg);
  return mm ? String(mm[1]).trim() : "";
}
