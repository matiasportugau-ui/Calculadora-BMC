/**
 * Project the logística route feed for BMC Driver screens.
 * Origin/dest/stops/qty/remito come from the assigned trip plan_snapshot.
 * Does not invent cities. Empty trip → empty feed (UI may show labeled demo).
 */
import { SEED_PICKUPS } from "./pickupCatalog.js";

function isPickupStop(stop) {
  const k = `${stop?.kind || ""} ${stop?.tipo || ""} ${stop?.role || ""}`.toLowerCase();
  return /\b(pickup|levante|planta|fabrica|fábrica|deposito|depósito)\b/.test(k);
}

function stopLabel(s) {
  if (!s || typeof s !== "object") return "";
  return String(s.direccion || s.cliente || s.label || s.orderId || "").trim();
}

function pickupPointLabel(id) {
  if (!id) return "";
  const hit = SEED_PICKUPS.find((p) => p.id === id);
  return String(hit?.label || "").trim();
}

function qtyFromStops(stops) {
  return (stops || []).reduce((n, s) => {
    const panels = Array.isArray(s?.paneles) ? s.paneles : [];
    const fromPanels = panels.reduce((m, p) => m + Number(p?.cantidad || p?.qty || 0), 0);
    // Prefer paneles[] when present — avoid double-count if legacy qty mirrors the same panels.
    if (panels.length > 0) return n + fromPanels;
    return n + Number(s?.qty || s?.cantidad || 0);
  }, 0);
}

/**
 * @param {{ trip?: object, plan?: object, stops?: object[] }} [input]
 */
function asObject(raw) {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return p && typeof p === "object" ? p : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? raw : {};
}

export function projectDriverTripFeed(input = {}) {
  const trip = input.trip && typeof input.trip === "object" ? input.trip : {};
  const fromPlan = asObject(input.plan);
  const snapshot =
    (fromPlan && Object.keys(fromPlan).length ? fromPlan : null) ||
    asObject(trip.plan_snapshot);
  const list = Array.isArray(input.stops) && input.stops.length
    ? input.stops
    : Array.isArray(snapshot.stops)
      ? snapshot.stops
      : [];
  const deliveries = list.filter((s) => !isPickupStop(s));
  const pickups = list.filter(isPickupStop);
  const pickupId = list.find((s) => s?.pickupPointId)?.pickupPointId || snapshot.info?.pickupPointId;
  const customPickup =
    String(list[0]?.pickupLabel || list[0]?.pickup_label || snapshot.info?.pickupName || "").trim();
  // Never fall back to delivery stopLabel as origin (steals dest city).
  // Opaque pickupPointId is last resort until confirm stamps pickupLabel.
  const origin =
    String(snapshot.info?.pickup_label || "").trim() ||
    (pickups[0] ? stopLabel(pickups[0]) : "") ||
    pickupPointLabel(pickupId) ||
    customPickup ||
    (pickupId ? String(pickupId) : "");
  const destStop = deliveries[deliveries.length - 1] || list[list.length - 1];
  const dest = destStop ? stopLabel(destStop) : "";
  const remito = String(snapshot.reparto_no || trip.reparto_no || "").trim();
  const hasTrip = Boolean(trip.trip_id || remito || list.length);
  return {
    origin,
    dest,
    stops: list,
    stopCount: list.length,
    qty: qtyFromStops(list),
    remito,
    hasTrip,
    demo: !hasTrip,
  };
}
