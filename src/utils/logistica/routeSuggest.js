/**
 * BMC Envíos Setup Wizard — pure route suggestion (base → pickups → deliveries).
 * Haversine when geo present; resolves coords from mapUrl / address when possible.
 * OSRM hook later (SDD-GEO-MAPS).
 */

import { isValidLatLng, parseLatLng } from "./geocode.js";

const EARTH_RADIUS_KM = 6371;

/**
 * @param {{ lat: number, lng: number }} a
 * @param {{ lat: number, lng: number }} b
 */
export function haversineKm(a, b) {
  if (!a || !b) return null;
  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Best-effort geo from explicit geo, map URL, or free-text (lat,lng paste).
 * @param {{
 *   geo?: { lat?: number, lng?: number } | null,
 *   mapUrl?: string,
 *   mapLink?: string,
 *   addressText?: string,
 *   direccion?: string,
 *   label?: string,
 * }} source
 * @returns {{ lat: number, lng: number, source: string } | null}
 */
export function resolvePointGeo(source = {}) {
  const g = source?.geo;
  if (g && isValidLatLng(Number(g.lat), Number(g.lng))) {
    return { lat: Number(g.lat), lng: Number(g.lng), source: String(g.source || "geo") };
  }
  for (const field of [source.mapUrl, source.mapLink, source.addressText, source.direccion, source.label]) {
    const parsed = parseLatLng(field);
    if (parsed) return { lat: parsed.lat, lng: parsed.lng, source: "parsed" };
  }
  return null;
}

/**
 * Unique pickup point ids in first-seen stop order.
 * @param {object[]} stops
 * @param {string} [defaultPickupPointId]
 */
export function orderedUniquePickupIds(stops, defaultPickupPointId = "") {
  const def = String(defaultPickupPointId || "").trim();
  const seen = new Set();
  const out = [];
  for (const s of stops || []) {
    const id = String(s?.pickupPointId || def || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Delivery order: by stop.orden ascending (unload later can reverse in UI).
 * @param {object[]} stops
 */
export function deliveryOrderStops(stops) {
  return [...(stops || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
}

/**
 * Build ordered legs.
 * @param {{
 *   basePoint?: object|null,
 *   basePointId?: string,
 *   stops?: object[],
 *   places?: object[],
 *   defaultPickupPointId?: string,
 *   deliveryOrder?: "orden"|"reverse",
 * }} input
 */
export function suggestRoute(input = {}) {
  const places = input.places || [];
  const byId = new Map(places.filter((p) => p?.id).map((p) => [p.id, p]));
  const stops = input.stops || [];
  const defPickup = input.defaultPickupPointId || "";
  const legs = [];
  let missingGeo = 0;

  const base = input.basePoint || (input.basePointId ? byId.get(input.basePointId) : null);
  if (base || input.basePointId) {
    const place = base || byId.get(input.basePointId);
    const leg = placeToLeg("base", place, input.basePointId || place?.id);
    if (!leg.geo) missingGeo += 1;
    legs.push(leg);
  }

  for (const pid of orderedUniquePickupIds(stops, defPickup)) {
    const place = byId.get(pid);
    const leg = placeToLeg("pickup", place, pid);
    if (!leg.geo) missingGeo += 1;
    legs.push(leg);
  }

  let deliveries = deliveryOrderStops(stops);
  if (input.deliveryOrder === "reverse") deliveries = deliveries.reverse();
  for (const s of deliveries) {
    const geo = resolvePointGeo({
      geo: s.geo,
      mapLink: s.mapLink,
      mapUrl: s.mapLink,
      direccion: s.direccion,
      addressText: s.direccion,
      label: s.cliente,
    });
    if (!geo) missingGeo += 1;
    legs.push({
      type: "delivery",
      refId: s.id || s.orderId || "",
      label: s.cliente || s.orderId || "Entrega",
      addressText: String(s.direccion || "").trim(),
      mapUrl: s.mapLink || "",
      geo,
      stopId: s.id,
      telefono: s.telefono || "",
    });
  }

  let totalKm = 0;
  let kmSegments = 0;
  for (let i = 1; i < legs.length; i += 1) {
    const d = haversineKm(legs[i - 1].geo, legs[i].geo);
    legs[i].legKmFromPrev = d;
    if (d != null) {
      totalKm += d;
      kmSegments += 1;
    }
  }

  return {
    orderedLegs: legs,
    suggestionSource: "haversine",
    updatedAt: new Date().toISOString(),
    totalKm: kmSegments > 0 ? totalKm : null,
    missingGeoCount: missingGeo,
    warnings: [
      legs.length < 2 ? "Ruta incompleta (faltan tramos)." : null,
      missingGeo > 0
        ? `${missingGeo} punto(s) sin lat/lng — se exporta por nombre/dirección; km solo donde hay geo.`
        : null,
    ].filter(Boolean),
  };
}

function placeToLeg(type, place, fallbackId) {
  const geo = resolvePointGeo(place || {});
  return {
    type,
    refId: place?.id || fallbackId || "",
    label: place?.label || fallbackId || type,
    addressText: String(place?.addressText || "").trim(),
    mapUrl: place?.mapUrl || "",
    geo,
  };
}

/**
 * Reorder legs by moving active index to over index.
 * @param {object[]} legs
 * @param {number} from
 * @param {number} to
 */
export function reorderRouteLegs(legs, from, to) {
  const list = Array.isArray(legs) ? [...legs] : [];
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  return list;
}
