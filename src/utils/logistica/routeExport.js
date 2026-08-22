/**
 * BMC Envíos — route visualizer projection + export/share helpers (pure).
 * Works with lat/lng when available; falls back to name/address for Maps + WA.
 */

import { isValidLatLng, parseLatLng } from "./geocode.js";
import { billableRoute } from "./quoteWindow.js";

const TYPE_ES = {
  base: "Salida",
  pickup: "Levante",
  delivery: "Entrega",
  depot: "BMC URUGUAY",
};

/**
 * Legs that have finite lat/lng, preserving order.
 * @param {Array<{ geo?: { lat?: number, lng?: number } | null }>} legs
 * @returns {Array<{ index: number, lat: number, lng: number, leg: object }>}
 */
export function legsWithGeo(legs) {
  const list = Array.isArray(legs) ? legs : [];
  const out = [];
  list.forEach((leg, index) => {
    const lat = Number(leg?.geo?.lat);
    const lng = Number(leg?.geo?.lng);
    if (!isValidLatLng(lat, lng)) return;
    out.push({ index, lat, lng, leg });
  });
  return out;
}

/**
 * Clean address free-text for navigation.
 * - Drop placeholders: Falta ubi, Url, link mapa (anywhere, not only suffix)
 * - Expand common UY abbreviations (Maldo → Maldonado)
 * @param {string} text
 * @returns {string}
 */
export function cleanAddressForNav(text) {
  let s = String(text || "").trim();
  if (!s) return "";
  // Remove noise tokens anywhere
  s = s
    .replace(/\bfalta\s*ubi(?:caci[oó]n)?\b/gi, " ")
    .replace(/\bsin\s*ubi(?:caci[oó]n)?\b/gi, " ")
    .replace(/\blink\s*mapa\b/gi, " ")
    .replace(/(?:^|[\s,;|/-])url(?:$|[\s,;|/-])/gi, " ")
    .replace(/\bpendiente\b/gi, " ")
    .replace(/\s*[-–|,]+\s*/g, ", ")
    .replace(/,\s*,+/g, ",")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // Expand locality abbreviations
  s = s.replace(/\bmaldo\.?\b/gi, "Maldonado");
  s = s.replace(/\bmvd\.?\b/gi, "Montevideo");
  return s;
}

/**
 * True when free text can be used as a Google Maps place query.
 * Rejects pure client names and empty placeholders; allows weak-but-local addresses.
 * @param {string} text
 * @returns {boolean}
 */
export function isNavigableAddressText(text) {
  const s = cleanAddressForNav(text);
  if (!s) return false;
  if (s.length < 4) return false;
  if (/^https?:\/\//i.test(s)) return false;
  if (/^(url|link|mapa|n\/a|tbd|s\/d|sd|—|-|\.+)$/i.test(s)) return false;
  if (
    /falta\s*ubi|sin\s*(dir|ubic|geo|direcci|mapa)|no\s*hay\s*(dir|ubic)|ubicaci[oó]n\s*pendiente|placeholder|link\s*mapa|solo\s*nombre/i.test(
      s,
    )
  ) {
    return false;
  }

  const hasDigit = /\d/.test(s);
  const hasStreet =
    /\b(av\.?|avenida|calle|ruta|camino|km|manzana|solar|esq\.?|esquina|barrio|balneario|chacras|apto|apartamento)\b/i.test(
      s,
    );
  const hasLocality =
    /\b(maldonado|montevideo|canelones|punta|piri[aá]polis|colonia|salto|paysand[uú]|uruguay|malv[ií]n)\b/i.test(s);

  // Pure person-like 1–3 alpha words without digit/street/locality → not an address
  if (!hasDigit && !hasStreet && !hasLocality) return false;
  if (!hasDigit && !hasStreet && /^[a-záéíóúñü.\s'-]+$/i.test(s) && s.split(/\s+/).length <= 3) {
    // locality-only place names (Maldonado) OK
    if (hasLocality) return true;
    return false;
  }
  // "4H, Maldonado" / "Garagorry, 4H, Maldonado" — weak but Maps can try with locality
  if (hasDigit && hasLocality) return true;
  if (hasStreet && (hasDigit || hasLocality)) return true;
  if (hasLocality && s.length >= 8) return true;
  return false;
}

/**
 * Query token for Google Maps dir (coords preferred, else cleaned address — never bare client name).
 * @param {object} leg
 * @returns {string}
 */
export function legNavToken(leg) {
  if (!leg) return "";
  const lat = Number(leg?.geo?.lat);
  const lng = Number(leg?.geo?.lng);
  if (isValidLatLng(lat, lng)) return `${lat},${lng}`;
  const fromUrl = parseLatLng(leg.mapUrl || leg.mapLink || "");
  if (fromUrl) return `${fromUrl.lat},${fromUrl.lng}`;

  // Prefer address/direccion only — do NOT prepend client label
  const rawAddr = cleanAddressForNav(leg.addressText || leg.direccion || "");
  if (isNavigableAddressText(rawAddr)) {
    let q = rawAddr;
    if (!/uruguay/i.test(q)) q = `${q}, Uruguay`;
    return q;
  }

  // Delivery: if address had locality fragment after clean, still try locality + Uruguay
  // rather than dropping the stop entirely (e.g. only "Maldonado" left)
  if (leg.type === "delivery") {
    const addr = rawAddr;
    if (/\bmaldonado\b/i.test(addr) || /\bmontevideo\b/i.test(addr)) {
      // keep house/manzana codes if present
      const compact = addr
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
        .join(", ");
      if (compact.length >= 4) {
        let q = compact;
        if (!/uruguay/i.test(q)) q = `${q}, Uruguay`;
        return q;
      }
    }
  }

  // Base / pickup: catalog label may be a known place
  if (leg.type === "base" || leg.type === "pickup") {
    const label = cleanAddressForNav(leg.label || "");
    if (
      isNavigableAddressText(label) ||
      (label.length >= 4 &&
        /\b(maldonado|montevideo|kingspan|bromyros|montfr[ií]o|ecopaneles)\b/i.test(label))
    ) {
      let q = label;
      if (!/uruguay/i.test(q)) q = `${q}, Uruguay`;
      return q;
    }
  }

  return "";
}

/**
 * Google Maps multi-stop driving directions URL.
 * - Prefer api=1 origin/destination/waypoints when ≥2 points have geo.
 * - Else classic /maps/dir/A/B/C with navigable address tokens only (skip bad legs).
 * @param {object[]} legs
 * @param {{ travelmode?: string }} [opts]
 * @returns {string}
 */
export function googleMapsDirectionsUrl(legs, opts = {}) {
  const list = Array.isArray(legs) ? legs : [];
  const mode = String(opts.travelmode || "driving");
  // One token per leg when possible (coords or cleaned address) — keeps all stops in order
  const tokens = list.map(legNavToken).filter(Boolean);
  if (!tokens.length) return "";
  if (tokens.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tokens[0])}`;
  }

  // Pure lat,lng path → api=1 (more reliable for mobile nav)
  const coordRe = /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/;
  if (tokens.every((t) => coordRe.test(t))) {
    const origin = tokens[0];
    const destination = tokens[tokens.length - 1];
    const mid = tokens.slice(1, -1).slice(0, 9);
    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${encodeURIComponent(mode)}`;
    if (mid.length) url += `&waypoints=${encodeURIComponent(mid.join("|"))}`;
    return url;
  }

  // Mixed coords + place names: classic dir path keeps every navigable stop (including weak addresses)
  return `https://www.google.com/maps/dir/${tokens.map((t) => encodeURIComponent(t)).join("/")}`;
}

/**
 * Human-readable itinerary for WhatsApp / clipboard (complete for transportista).
 * @param {{ orderedLegs?: object[], totalKm?: number|null, suggestionSource?: string, updatedAt?: string }} route
 * @param {{ title?: string, info?: { numero?: string, fecha?: string, transportista?: string, patente?: string } }} [opts]
 * @returns {string}
 */
export function routeToShareText(route, opts = {}) {
  const info = opts.info || {};
  const billed = billableRoute(route, { info });
  const legs = billed.orderedLegs || [];
  const title = opts.title || "🚚 Ruta BMC Envíos";
  const lines = [title];
  if (info.numero || info.fecha || info.transportista) {
    const meta = [
      info.numero ? `Envío ${info.numero}` : null,
      info.fecha || null,
      info.transportista ? `Transportista: ${info.transportista}` : null,
      info.patente ? `Patente: ${info.patente}` : null,
    ].filter(Boolean);
    if (meta.length) lines.push(meta.join(" · "));
  }
  if (billed.quoteStart === "factory") {
    lines.push("Cotización tercerizado: desde llegada a fábrica. No se cobra depósito → planta.");
  }
  lines.push("");
  lines.push("Itinerario:");
  legs.forEach((leg, i) => {
    const kind = TYPE_ES[leg?.type] || leg?.type || "Parada";
    const label = String(leg?.label || leg?.refId || `P${i + 1}`).trim();
    lines.push(`${i + 1}. ${kind}: ${label}`);
    if (leg?.quoteAnchor) lines.push("   ⏱ Inicio de cotización (llegada a fábrica)");
    if (leg?.addressText) lines.push(`   📍 ${leg.addressText}`);
    if (leg?.telefono) lines.push(`   📞 ${leg.telefono}`);
    if (leg?.legKmFromPrev != null && Number.isFinite(leg.legKmFromPrev) && Number(leg.legKmFromPrev) > 0) {
      lines.push(`   ↳ +${Number(leg.legKmFromPrev).toFixed(1)} km desde anterior`);
    }
    if (leg?.geo && isValidLatLng(Number(leg.geo.lat), Number(leg.geo.lng))) {
      lines.push(`   🧭 ${Number(leg.geo.lat).toFixed(5)}, ${Number(leg.geo.lng).toFixed(5)}`);
    }
    if (leg?.mapUrl) lines.push(`   🗺️ ${leg.mapUrl}`);
  });
  if (billed.totalKm != null && Number.isFinite(billed.totalKm)) {
    lines.push("");
    lines.push(
      `Total cotizable ~${Number(billed.totalKm).toFixed(0)} km (${route?.suggestionSource === "haversine" ? "aire" : route?.suggestionSource || "estimado"})`,
    );
  }
  const maps = googleMapsDirectionsUrl(legs);
  if (maps) {
    lines.push("");
    lines.push("Abrir ruta completa en Google Maps:");
    lines.push(maps);
  }
  lines.push("");
  lines.push("— BMC Uruguay / Logística");
  return lines.join("\n").trim();
}

/**
 * GeoJSON FeatureCollection (LineString + Point features).
 * @param {{ orderedLegs?: object[], totalKm?: number|null }} route
 * @returns {object}
 */
export function routeToGeoJson(route) {
  const legs = route?.orderedLegs || [];
  const pts = legsWithGeo(legs);
  const features = [];

  if (pts.length >= 2) {
    features.push({
      type: "Feature",
      properties: {
        kind: "route",
        totalKm: route?.totalKm ?? null,
        suggestionSource: route?.suggestionSource || null,
      },
      geometry: {
        type: "LineString",
        coordinates: pts.map((p) => [p.lng, p.lat]),
      },
    });
  }

  legs.forEach((leg, i) => {
    const lat = Number(leg?.geo?.lat);
    const lng = Number(leg?.geo?.lng);
    if (!isValidLatLng(lat, lng)) return;
    features.push({
      type: "Feature",
      properties: {
        order: i + 1,
        type: leg.type || null,
        label: leg.label || null,
        refId: leg.refId || null,
        addressText: leg.addressText || null,
        legKmFromPrev: leg.legKmFromPrev ?? null,
      },
      geometry: {
        type: "Point",
        coordinates: [lng, lat],
      },
    });
  });

  return {
    type: "FeatureCollection",
    features,
  };
}

/**
 * Minimal GPX 1.1 track for import into nav apps.
 * @param {{ orderedLegs?: object[], totalKm?: number|null }} route
 * @param {{ name?: string }} [opts]
 * @returns {string}
 */
export function routeToGpx(route, opts = {}) {
  const legs = route?.orderedLegs || [];
  const pts = legsWithGeo(legs);
  const name = escapeXml(opts.name || "Ruta BMC Envíos");
  const wpts = pts
    .map((p) => {
      const label = escapeXml(String(p.leg?.label || `P${p.index + 1}`));
      const type = escapeXml(TYPE_ES[p.leg?.type] || p.leg?.type || "parada");
      return `  <wpt lat="${p.lat}" lon="${p.lng}">\n    <name>${p.index + 1}. ${type}: ${label}</name>\n  </wpt>`;
    })
    .join("\n");
  const trkpts = pts
    .map((p) => `      <trkpt lat="${p.lat}" lon="${p.lng}"></trkpt>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BMC Envíos" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${name}</name></metadata>
${wpts}
  <trk>
    <name>${name}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

/**
 * Project geo legs into SVG viewBox coordinates (equirectangular, padded).
 * @param {object[]} legs
 * @param {{ width?: number, height?: number, pad?: number }} [opts]
 */
export function projectRouteToSvg(legs, opts = {}) {
  const width = Number(opts.width) > 0 ? Number(opts.width) : 320;
  const height = Number(opts.height) > 0 ? Number(opts.height) : 200;
  const pad = Number.isFinite(opts.pad) ? Number(opts.pad) : 28;
  const pts = legsWithGeo(legs);
  if (!pts.length) {
    return { points: [], pathD: "", width, height, hasGeo: false };
  }

  let minLat = pts[0].lat;
  let maxLat = pts[0].lat;
  let minLng = pts[0].lng;
  let maxLng = pts[0].lng;
  for (const p of pts) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  const latSpan = Math.max(maxLat - minLat, 0.002);
  const lngSpan = Math.max(maxLng - minLng, 0.002);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const scale = Math.min(innerW / lngSpan, innerH / latSpan);
  const usedW = lngSpan * scale;
  const usedH = latSpan * scale;
  const ox = pad + (innerW - usedW) / 2;
  const oy = pad + (innerH - usedH) / 2;

  const points = pts.map((p) => ({
    x: ox + (p.lng - minLng) * scale,
    y: oy + (maxLat - p.lat) * scale,
    index: p.index,
    lat: p.lat,
    lng: p.lng,
    leg: p.leg,
  }));

  const pathD =
    points.length >= 2
      ? points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
      : "";

  return { points, pathD, width, height, hasGeo: true };
}

/**
 * @param {string} filename
 * @param {string} content
 * @param {string} [mime]
 */
export function downloadTextFile(filename, content, mime = "text/plain;charset=utf-8") {
  if (typeof document === "undefined" || typeof URL === "undefined") return false;
  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "route.txt";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {{ updatedAt?: string }} [route]
 * @param {string} [ext]
 */
export function routeExportBasename(route, ext = "json") {
  const d = (route?.updatedAt || new Date().toISOString()).slice(0, 10).replace(/-/g, "");
  return `bmc-ruta-${d}.${ext}`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
