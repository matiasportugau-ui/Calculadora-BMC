/**
 * Customer-facing purchase observability — pure projection.
 * Never include driver phone, other stops, internal notes, or tokens.
 */

export const CUSTOMER_STAGES = Object.freeze(["order", "production", "transport", "delivery"]);

export const GPS_MAX_AGE_MS = 30 * 60 * 1000;

const SNAP_KEYS = Object.freeze([
  "quote_ref",
  "customer_display_name",
  "product_summary",
  "order_at",
  "production_date",
  "pickup_label",
  "pickup_scheduled_at",
  "destination_label",
]);

export function sanitizeSnapshot(raw = {}) {
  const out = {};
  for (const k of SNAP_KEYS) {
    const v = raw[k];
    if (v == null || v === "") continue;
    out[k] = String(v).trim().slice(0, 240);
  }
  return out;
}

export function lastFreshGeo(events, { now = Date.now(), maxAgeMs = GPS_MAX_AGE_MS } = {}) {
  const list = Array.isArray(events) ? events : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const e = list[i];
    const lat = Number(e.geo_lat);
    const lng = Number(e.geo_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const atRaw = e.at_server || e.at;
    const at = atRaw ? new Date(atRaw).getTime() : now;
    if (!Number.isFinite(at) || now - at > maxAgeMs) return null;
    return { lat, lng, at: new Date(at).toISOString() };
  }
  return null;
}

function typesOf(events) {
  return new Set((events || []).map((e) => e.event_type));
}

/**
 * True when this customer's stop (or the whole trip if stopId unset) is delivered.
 * Multi-stop trips must not treat sibling stops' delivery_completed as this token's.
 */
export function isDeliveryCompletedForStop(events, stopId) {
  const list = Array.isArray(events) ? events : [];
  const scoped = stopId != null && String(stopId) !== "";
  const want = scoped ? String(stopId) : null;
  return list.some((e) => {
    if (e?.event_type !== "delivery_completed") return false;
    if (!want) return true;
    const sid = e.stop_id != null ? String(e.stop_id) : "";
    return sid === want;
  });
}

/**
 * @param {{
 *   snapshot?: object,
 *   tripStatus?: string | null,
 *   events?: Array<{ event_type: string, at_server?: string, geo_lat?: number, geo_lng?: number, stop_id?: string }>,
 *   now?: number,
 *   stopId?: string | null,
 * }} input
 */
export function deriveCustomerTrack(input = {}) {
  const snapshot = sanitizeSnapshot(input.snapshot);
  const events = input.events || [];
  const types = typesOf(events);
  const tripStatus = String(input.tripStatus || "");
  const now = input.now ?? Date.now();
  const stopId = input.stopId != null && input.stopId !== "" ? String(input.stopId) : null;

  const delivered = isDeliveryCompletedForStop(events, stopId);
  const departed = types.has("factory_departed");
  const transportBooked =
    types.has("trip_assigned") ||
    types.has("trip_confirmed") ||
    tripStatus === "assigned" ||
    tripStatus === "confirmed" ||
    Boolean(snapshot.pickup_scheduled_at);

  const hasOrder = Boolean(snapshot.quote_ref || snapshot.order_at);
  const hasProductionDate = Boolean(snapshot.production_date);

  /** @type {"done"|"current"|"pending"} */
  let productionStatus = "pending";
  if (departed || delivered) productionStatus = "done";
  else if (hasProductionDate) productionStatus = "current";

  /** @type {"done"|"current"|"pending"} */
  let transportStatus = "pending";
  if (departed || delivered) transportStatus = "done";
  else if (transportBooked) transportStatus = "current";

  /** @type {"done"|"current"|"pending"} */
  let deliveryStatus = "pending";
  if (delivered) deliveryStatus = "done";
  else if (departed) deliveryStatus = "current";

  const showTruck = departed && !delivered;
  const truck = showTruck ? lastFreshGeo(events, { now }) : null;

  return {
    order: {
      ref: snapshot.quote_ref || null,
      customer: snapshot.customer_display_name || null,
      product: snapshot.product_summary || null,
      orderAt: snapshot.order_at || null,
    },
    destination: snapshot.destination_label || null,
    stages: [
      {
        id: "order",
        label: "Pedido recibido",
        status: hasOrder ? "done" : "pending",
        at: snapshot.order_at || null,
      },
      {
        id: "production",
        label: "Fecha de producción",
        status: productionStatus,
        date: snapshot.production_date || null,
      },
      {
        id: "transport",
        label: "Transporte programado",
        status: transportStatus,
        scheduledAt: snapshot.pickup_scheduled_at || null,
        pickupLabel: snapshot.pickup_label || null,
      },
      {
        id: "delivery",
        label: delivered ? "Entregado" : "En camino",
        status: deliveryStatus,
      },
    ],
    truck,
    inTransit: showTruck,
  };
}

export function osmEmbedUrl(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  const pad = 0.02;
  const bbox = [ln - pad, la - pad, ln + pad, la + pad].join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${la}%2C${ln}`;
}
