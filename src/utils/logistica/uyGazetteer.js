/**
 * Offline Uruguay pins for /logistica when Nominatim/API token is unavailable.
 * Precision: street | city | approx. Never pretend a city pin is a street.
 */

function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** @type {{ id: string, keys: string[], label: string, lat: number, lng: number, precision: "street"|"city"|"approx" }[]} */
export const UY_GAZETTEER = Object.freeze([
  {
    id: "juan-paullier-1625",
    keys: ["juan paullier 1625", "juan paullier"],
    label: "Juan Paullier 1625, Montevideo",
    lat: -34.9084,
    lng: -56.1688,
    precision: "street",
  },
  {
    id: "kingspan-san-juan",
    keys: ["camino san juan", "kingspan", "bromyros", "colonia nicolich"],
    label: "Kingspan (Bromyros) · Camino San Juan, Nicolich",
    lat: -34.81516,
    lng: -56.02435,
    precision: "approx",
  },
  {
    id: "ciudad-maldonado",
    keys: ["ciudad de maldonado", "ciudad de madonado"],
    label: "Ciudad de Maldonado (centro)",
    lat: -34.9084,
    lng: -54.9589,
    precision: "city",
  },
  {
    id: "deposito-bmc-maldonado",
    keys: ["deposito bmc", "depósito bmc", "bmc uruguay", "liber seregni", "ernesto paravi", "paravís"],
    label: "BMC URUGUAY",
    lat: -34.9053458,
    lng: -54.928693,
    precision: "street",
  },
  {
    id: "chacras-del-pinar",
    keys: ["chacras del pinar"],
    label: "Chacras del Pinar · Av. Antonio Lussich, Punta Ballena",
    lat: -34.88607,
    lng: -55.03947,
    precision: "approx",
  },
  {
    id: "calle-cuba-maldonado",
    keys: ["calle cuba", "casa delirio"],
    label: "Calle Cuba entre Av España y Honduras (casa Delirio), Maldonado",
    lat: -34.9132,
    lng: -54.9632,
    precision: "approx",
  },
  {
    id: "barrio-4h-maldonado",
    keys: ["4h maldonado", "barrio 4h", "4h, maldonado"],
    label: "Barrio 4H, Maldonado",
    lat: -34.9087,
    lng: -54.9583,
    precision: "city",
  },
]);

/**
 * @param {string} text
 * @returns {{ lat: number, lng: number, source: string, label: string, precision: string, id: string } | null}
 */
export function lookupUyGazetteer(text) {
  const n = normalize(text);
  if (!n) return null;
  const ranked = [...UY_GAZETTEER].sort((a, b) => {
    const la = Math.max(...a.keys.map((k) => k.length));
    const lb = Math.max(...b.keys.map((k) => k.length));
    return lb - la;
  });
  for (const row of ranked) {
    if (row.keys.some((k) => n.includes(k))) {
      return {
        lat: row.lat,
        lng: row.lng,
        source: `gazetteer:${row.precision}`,
        label: row.label,
        precision: row.precision,
        id: row.id,
      };
    }
  }
  return null;
}

/**
 * UY mobile/landline: at least 8 digits (099 148 920 → 9).
 * @param {string} tel
 */
export function isUyPhoneOk(tel) {
  const digits = String(tel || "").replace(/\D/g, "");
  return digits.length >= 8;
}

/**
 * Ops gate: calle + número, or two streets (esquina / entre / “A y B”).
 * Barrio or city alone is not enough.
 * @param {string} direccion
 */
export function isPreciseAddress(direccion) {
  const n = normalize(direccion);
  if (!n) return false;
  if (/falta calle|sin dir|sin direccion|pedir ubi|ubicacion pendiente/.test(n)) return false;
  if (/^(ciudad de )?(maldonado|madonado|montevideo|canelones)$/.test(n)) return false;
  const hasStreetWord = /\b(calle|av\.?|avenida|ruta|camino|pasaje|bulevar|blvd|esq\.?)\b/.test(n);
  if (hasStreetWord && /\d/.test(n)) return true;
  if (/\b(esq\.?|esquina|entre)\b/.test(n) && hasStreetWord) return true;
  if (/\by\b/.test(n)) {
    const parts = n.split(/\by\b/).map((s) => s.trim()).filter((s) => s.length >= 3);
    if (parts.length >= 2) return true;
  }
  // "Juan Paullier 1625" / "Calle 123" — name then house number, not "4h maldonado"
  if (/^(barrio|chacras|ciudad|deposito|deposito bmc)\b/.test(n) && !hasStreetWord) return false;
  if (/^[a-záéíóúñ][a-záéíóúñ\s.'-]{2,}\s+\d{1,5}\b/.test(n) && !/^\d/.test(n)) return true;
  return false;
}

/**
 * Inverse of isPreciseAddress (kept for existing callers).
 * @param {string} direccion
 */
export function isIncompleteStreet(direccion) {
  return !isPreciseAddress(direccion);
}

/** Canonical depo drop: BMC URUGUAY (Google Place pin). */
export const BMC_DEPO_MAP_URL = "https://maps.app.goo.gl/H4JrCnTgmke7ZRReA";

export const BMC_DEPO = Object.freeze({
  id: "deposito-bmc-maldonado",
  catalogId: "base-deposito-bmc",
  label: "BMC URUGUAY",
  addressText: "BMC URUGUAY",
  mapUrl: BMC_DEPO_MAP_URL,
  lat: -34.9053458,
  lng: -54.928693,
  precision: "street",
});

/** How the customer receives this load. Empty / unknown → obra (entrega en destino). */
export const ENTREGA_MODO = Object.freeze({
  OBRA: "obra",
  PLANTA: "planta",
  DEPO: "depo",
});

/**
 * @param {object|string|null|undefined} stopOrValue
 * @returns {"obra"|"planta"|"depo"}
 */
export function normalizeEntregaModo(stopOrValue) {
  const raw =
    stopOrValue && typeof stopOrValue === "object" ? stopOrValue.entregaModo : stopOrValue;
  const v = String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (v === "planta") return ENTREGA_MODO.PLANTA;
  if (v === "depo" || v === "deposito" || v === "depot") return ENTREGA_MODO.DEPO;
  return ENTREGA_MODO.OBRA;
}

/** Customer picks up at the factory (Kingspan / Bromyros) — not on the truck. */
export function isPlantPickupStop(stop) {
  return normalizeEntregaModo(stop) === ENTREGA_MODO.PLANTA;
}

/** Customer comes to BMC warehouse (Depósito BMC) — no obra delivery. */
export function isDepotPickupStop(stop) {
  return normalizeEntregaModo(stop) === ENTREGA_MODO.DEPO;
}

/** Not delivered to the customer address (planta or depo). */
export function isOffTruckDelivery(stop) {
  const m = normalizeEntregaModo(stop);
  return m === ENTREGA_MODO.PLANTA || m === ENTREGA_MODO.DEPO;
}
