/**
 * Nombres de cliente deducidos de paradas importadas desde planilla / API (campo cliente + rawSheet CRM).
 */

/**
 * @param {string} s
 */
export function normClienteKey(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

/**
 * @param {any} stop
 * @returns {string[]}
 */
export function collectClienteNamesFromStop(stop) {
  const out = [];
  const add = (x) => {
    const t = String(x ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (t.length >= 1) out.push(t);
  };
  if (!stop) return out;
  add(stop.cliente);
  const raw = stop.rawSheet;
  if (raw && typeof raw === "object") {
    add(raw.CLIENTE_NOMBRE);
    add(raw.Cliente);
    add(raw.CLIENTE);
    add(raw.cliente);
  }
  return [...new Set(out)];
}

/**
 * Lista única ordenada para dropdown (primer texto visto por clave normalizada).
 * @param {any[]} stops
 * @returns {string[]}
 */
export function uniqueClientesFromStops(stops) {
  const seen = new Set();
  const ordered = [];
  for (const s of stops || []) {
    for (const n of collectClienteNamesFromStop(s)) {
      const key = normClienteKey(n);
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(n);
      }
    }
  }
  ordered.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  return ordered;
}

/**
 * @param {any[]} stops
 * @param {string} label
 * @returns {any | undefined}
 */
export function findFirstStopByClienteLabel(stops, label) {
  const want = normClienteKey(label);
  return (stops || []).find((s) => collectClienteNamesFromStop(s).some((n) => normClienteKey(n) === want));
}
