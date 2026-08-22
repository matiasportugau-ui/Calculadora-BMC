/**
 * BMC Envíos P2 — Geocode helpers (pure).
 * Client-side maps links + haversine legs; server does Nominatim lookup.
 */

const EARTH_RADIUS_KM = 6371;

/** Uruguay-ish default bias for free-text geocode queries. */
export const GEOCODE_COUNTRY_BIAS = "Uruguay";

/**
 * @param {string} [address]
 * @returns {string}
 */
export function mapsSearchUrl(address) {
  const q = String(address || "").trim();
  if (!q) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {string} [label]
 * @returns {string}
 */
export function mapsCoordsUrl(lat, lng, label = "") {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return "";
  const q = label ? `${label}@${la},${ln}` : `${la},${ln}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/**
 * Parse lat/lng from common Google Maps URL shapes or "lat,lng" paste.
 * @param {string} [input]
 * @returns {{ lat: number, lng: number } | null}
 */
export function parseLatLng(input) {
  const s = String(input || "").trim();
  if (!s) return null;

  // plain "lat,lng" or "lat, lng"
  const plain = s.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (plain) {
    const lat = Number(plain[1]);
    const lng = Number(plain[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // @lat,lng or @lat,lng,zoom
  const at = s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) {
    const lat = Number(at[1]);
    const lng = Number(at[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // !3dLAT!4dLNG
  const bang = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (bang) {
    const lat = Number(bang[1]);
    const lng = Number(bang[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // q=lat,lng
  const qParam = s.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (qParam) {
    const lat = Number(qParam[1]);
    const lng = Number(qParam[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // query=lat%2Clng (decoded or encoded)
  try {
    const u = new URL(s, "https://www.google.com");
    const query = u.searchParams.get("query") || u.searchParams.get("q") || "";
    if (query) {
      const fromQuery = parseLatLng(query);
      if (fromQuery) return fromQuery;
    }
  } catch {
    // not a URL
  }

  return null;
}

/**
 * @param {number} lat
 * @param {number} lng
 */
export function isValidLatLng(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Build Nominatim-friendly query with Uruguay bias when missing.
 * @param {string} address
 * @param {{ countryBias?: string }} [opts]
 */
export function buildGeocodeQuery(address, opts = {}) {
  const raw = String(address || "").trim();
  if (!raw) return "";
  const bias = opts.countryBias ?? GEOCODE_COUNTRY_BIAS;
  if (!bias) return raw;
  const lower = raw.toLowerCase();
  if (lower.includes("uruguay") || lower.includes("uy")) return raw;
  return `${raw}, ${bias}`;
}

/**
 * Great-circle distance km (haversine).
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  if (!isValidLatLng(lat1, lng1) || !isValidLatLng(lat2, lng2)) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Ordered stop legs from geo payloads.
 * @param {Array<{ id?: string, orden?: number, cliente?: string, geo?: { lat?: number, lng?: number } | null }>} stops
 * @returns {{ legs: Array<{ fromId: string|null, toId: string|null, fromLabel: string, toLabel: string, km: number }>, totalKm: number, geocodedCount: number }}
 */
export function tripLegDistances(stops) {
  const list = Array.isArray(stops) ? stops : [];
  const withGeo = list
    .map((s, i) => {
      const lat = Number(s?.geo?.lat);
      const lng = Number(s?.geo?.lng);
      if (!isValidLatLng(lat, lng)) return null;
      return {
        id: s.id ?? null,
        orden: s.orden ?? i + 1,
        label: String(s.cliente || s.direccion || `P${i + 1}`),
        lat,
        lng,
      };
    })
    .filter(Boolean);

  const legs = [];
  let totalKm = 0;
  for (let i = 0; i < withGeo.length - 1; i += 1) {
    const a = withGeo[i];
    const b = withGeo[i + 1];
    const km = haversineKm(a.lat, a.lng, b.lat, b.lng);
    if (km == null) continue;
    totalKm += km;
    legs.push({
      fromId: a.id,
      toId: b.id,
      fromLabel: a.label,
      toLabel: b.label,
      km: Math.round(km * 10) / 10,
    });
  }
  return {
    legs,
    totalKm: Math.round(totalKm * 10) / 10,
    geocodedCount: withGeo.length,
  };
}

/**
 * Normalize a geocode API hit into stop.geo shape.
 * @param {{ lat: number|string, lng: number|string, label?: string, source?: string }} hit
 * @param {{ now?: () => string }} [opts]
 */
export function toStopGeo(hit, opts = {}) {
  const lat = Number(hit?.lat);
  const lng = Number(hit?.lng);
  if (!isValidLatLng(lat, lng)) return null;
  const now = opts.now || (() => new Date().toISOString());
  const geo = {
    lat,
    lng,
    label: String(hit.label || "").trim() || null,
    source: String(hit.source || "nominatim"),
    at: now(),
  };
  if (hit?.isManuallyAdjusted === true || String(hit?.source || "") === "manual") {
    geo.isManuallyAdjusted = true;
    geo.source = geo.source || "manual";
  }
  return geo;
}

/**
 * Apply geocode result onto a stop (immutable).
 * @param {object} stop
 * @param {{ lat: number, lng: number, label?: string, source?: string }} hit
 */
export function applyGeocodeToStop(stop, hit) {
  const geo = toStopGeo(hit);
  if (!geo) return stop;
  const label = geo.label || stop.direccion || "";
  const mapLink = mapsCoordsUrl(geo.lat, geo.lng, label);
  return {
    ...stop,
    geo,
    mapLink,
    checks: {
      ...(stop.checks || {}),
      mapaOk: true,
      datosOk: stop.checks?.datosOk || Boolean(stop.direccion),
    },
  };
}
