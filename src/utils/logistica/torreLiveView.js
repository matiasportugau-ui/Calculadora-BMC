/**
 * Pure projection for BMC Torre de Control (live fleet).
 * No tokens, no other-customer PII, no driver password material.
 */

export const TORRE_ONLINE_MS = 90_000;

export const LIVE_TRIP_STATUSES = Object.freeze(["draft", "assigned", "confirmed"]);

export function isLiveTripStatus(status) {
  return LIVE_TRIP_STATUSES.includes(String(status || ""));
}

export function shouldWatchGps(trip) {
  if (!trip || typeof trip !== "object") return false;
  // Only live open trips — not merely "not closed" (avoids GPS on unknown/empty status).
  return isLiveTripStatus(trip.status);
}

export function lastLocationPing(events, { now = Date.now() } = {}) {
  const list = Array.isArray(events) ? events : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const e = list[i];
    if (String(e?.event_type || "") !== "location_ping") continue;
    const lat = Number(e.geo_lat);
    const lng = Number(e.geo_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const atRaw = e.at_server || e.at;
    const at = atRaw ? new Date(atRaw).getTime() : now;
    return {
      lat,
      lng,
      at: Number.isFinite(at) ? new Date(at).toISOString() : new Date(now).toISOString(),
    };
  }
  return null;
}

export function isOnline(lastPing, { now = Date.now(), windowMs = TORRE_ONLINE_MS } = {}) {
  if (!lastPing?.at) return false;
  const at = new Date(lastPing.at).getTime();
  if (!Number.isFinite(at)) return false;
  return now - at <= windowMs;
}

export function phoneTail(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length < 4) return null;
  return d.slice(-4);
}

export function lastNonPingEvent(events) {
  const list = Array.isArray(events) ? events : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const e = list[i];
    const type = String(e?.event_type || "");
    if (!type || type === "location_ping" || type === "presence") continue;
    return {
      type,
      at: e.at_server || e.at || null,
    };
  }
  return null;
}

export function countEvidence(events) {
  return (Array.isArray(events) ? events : []).filter((e) => e?.event_type === "evidence_committed").length;
}

/**
 * Operator-facing live card. Never includes driver token or full phone.
 */
export function projectLiveTrip({ trip, events, now = Date.now() } = {}) {
  const t = trip && typeof trip === "object" ? trip : {};
  const plan = t.plan_snapshot && typeof t.plan_snapshot === "object" ? t.plan_snapshot : {};
  const info = plan.info && typeof plan.info === "object" ? plan.info : {};
  const ping = lastLocationPing(events, { now });
  const stops = Array.isArray(plan.stops) ? plan.stops : [];
  return {
    trip_id: t.trip_id || null,
    status: t.status || "draft",
    live: isLiveTripStatus(t.status),
    reparto_id: plan.reparto_id || null,
    reparto_no: plan.reparto_no || null,
    transportista: plan.transportista || info.transportista || null,
    patente: plan.patente || info.patente || null,
    phone_tail: phoneTail(t.assigned_phone_e164 || info.chofer_phone),
    geo: ping,
    online: isOnline(ping, { now }),
    last_event: lastNonPingEvent(events),
    evidence_count: countEvidence(events),
    stop_count: stops.length,
    updated_at: t.updated_at || null,
  };
}

export function projectLiveBoard({ trips = [], eventsByTrip = {}, now = Date.now() } = {}) {
  return trips
    .filter((t) => isLiveTripStatus(t?.status))
    .map((t) =>
      projectLiveTrip({
        trip: t,
        events: eventsByTrip[t.trip_id] || [],
        now,
      }),
    );
}
