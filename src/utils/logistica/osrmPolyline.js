/**
 * OSRM polyline (precision 5) decode + attach road geometry to a suggestRoute result.
 * Pure — no fetch. Server proxy lives in server/routes/envios.js.
 */

/**
 * Decode an encoded Google/OSRM polyline into [lat, lng] pairs.
 * @param {string} encoded
 * @param {number} [precision=5]
 * @returns {Array<[number, number]>}
 */
export function decodePolyline(encoded, precision = 5) {
  const str = String(encoded || "");
  if (!str) return [];
  const factor = 10 ** (Number(precision) || 5);
  const coords = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < str.length) {
    let result = 0;
    let shift = 0;
    let b;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < str.length);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    result = 0;
    shift = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < str.length);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coords.push([lat / factor, lng / factor]);
  }
  return coords;
}

/**
 * Ordered [lng, lat] pairs for OSRM, skipping legs without valid geo.
 * @param {Array<{ geo?: { lat?: number, lng?: number } | null }>} legs
 * @returns {Array<[number, number]>}
 */
export function osrmCoordinatesFromLegs(legs) {
  const out = [];
  for (const leg of Array.isArray(legs) ? legs : []) {
    const lat = Number(leg?.geo?.lat);
    const lng = Number(leg?.geo?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    out.push([lng, lat]);
  }
  return out;
}

/**
 * @param {object} route  suggestRoute() result
 * @param {{ provider?: string, geometry?: string, totalKm?: number, totalDurationS?: number } | null} osrm
 */
export function attachOsrmToRoute(route, osrm) {
  const base = route && typeof route === "object" ? { ...route } : { orderedLegs: [] };
  if (osrm?.provider === "osrm" && osrm.geometry) {
    const km = Number(osrm.totalKm);
    return {
      ...base,
      geometry: String(osrm.geometry),
      suggestionSource: "osrm",
      totalKm: Number.isFinite(km) ? km : base.totalKm,
      durationS: Number.isFinite(Number(osrm.totalDurationS)) ? Number(osrm.totalDurationS) : null,
    };
  }
  return {
    ...base,
    geometry: null,
    suggestionSource: base.suggestionSource || "haversine",
  };
}
