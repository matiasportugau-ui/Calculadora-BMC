/**
 * ActivityWatch (passive OS observation) — thin REST client.
 *
 * STRICTLY OPT-IN. ActivityWatch is a local desktop daemon (`aw-server`,
 * default :5600) running on the *operator's own machine*. This client only
 * makes sense where the API process is co-located with that daemon (local dev
 * or a self-host on the operator's box). In Cloud Run it stays disabled
 * (`config.traktimeAwEnabled === false`) and these functions are never called.
 *
 * No data is collected by default; nothing is installed by us. The operator
 * chooses to run ActivityWatch and flip `TRAKTIME_AW_ENABLED=1`.
 *
 * AW REST API used:
 *   GET /api/0/buckets/                      → { "<bucketId>": {...}, ... }
 *   GET /api/0/buckets/<id>/events?start&end → [{ timestamp, duration, data }]
 * Window-watcher events carry data.{app,title}; AFK events data.{status}.
 */
import { config } from "../config.js";

function base() {
  return String(config.traktimeAwBaseUrl || "http://localhost:5600").replace(/\/+$/, "");
}

export function awEnabled() {
  return !!config.traktimeAwEnabled;
}

async function awGet(path, { signal } = {}) {
  const res = await fetch(`${base()}${path}`, { signal });
  if (!res.ok) {
    const err = new Error(`aw_http_${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** Map of all buckets keyed by id. */
export async function getBuckets(opts = {}) {
  return awGet("/api/0/buckets/", opts);
}

/** Events for a bucket within [start, end] (ISO strings). */
export async function getEvents(bucketId, { start, end, limit = 1000, signal } = {}) {
  const qp = new URLSearchParams();
  if (start) qp.set("start", start);
  if (end) qp.set("end", end);
  if (limit) qp.set("limit", String(limit));
  const qs = qp.toString();
  return awGet(`/api/0/buckets/${encodeURIComponent(bucketId)}/events${qs ? `?${qs}` : ""}`, { signal });
}

/** How far `tz`'s wall-clock is ahead of UTC at the given instant (ms). */
function tzOffsetMs(instant, tz) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant).reduce((a, x) => ((a[x.type] = x.value), a), {});
  const hour = p.hour === "24" ? 0 : +p.hour; // some engines emit "24" at midnight
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, hour, +p.minute, +p.second);
  return asUTC - instant.getTime();
}

/** UTC instant (ISO) of local-midnight-today in the given IANA timezone. */
export function startOfLocalDayIso(tz, now = new Date()) {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const [y, m, d] = ymd.split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d, 0, 0, 0);
  // Evaluate the offset AT local midnight (not at `now`): on a DST-transition
  // day the offset can differ between midnight and now, which otherwise shifts
  // the day boundary by ±1h. One re-check lands on the correct side.
  const off = tzOffsetMs(new Date(utcMidnight), tz);
  let startMs = utcMidnight - off;
  const off2 = tzOffsetMs(new Date(startMs), tz);
  if (off2 !== off) startMs = utcMidnight - off2;
  return new Date(startMs).toISOString();
}

/** Pick the window-watcher bucket id (e.g. aw-watcher-window_HOST). */
export function pickWindowBucket(buckets) {
  const ids = Object.keys(buckets || {});
  return (
    ids.find((id) => id.startsWith("aw-watcher-window")) ||
    ids.find((id) => /window/i.test(buckets[id]?.type || "")) ||
    null
  );
}

/**
 * Aggregate today's window-watcher activity into per-app durations — the raw
 * material for an AI-proposed timesheet entry ("¿en qué trabajé hoy?").
 *
 * @param {{ tz?:string, now?:Date }} [opts]
 * @returns {Promise<{date:string, tz:string, total_active_seconds:number,
 *   by_app:Array<{app:string, seconds:number, sample_titles:string[]}>}>}
 */
export async function getTodaySummary({ tz = config.traktimeMirrorTz || "America/Montevideo", now = new Date(), signal } = {}) {
  const start = startOfLocalDayIso(tz, now);
  const end = now.toISOString();
  const buckets = await getBuckets({ signal });
  const bucketId = pickWindowBucket(buckets);
  if (!bucketId) {
    return { date: start.slice(0, 10), tz, total_active_seconds: 0, by_app: [], note: "no_window_watcher_bucket" };
  }
  const events = await getEvents(bucketId, { start, end, limit: 5000, signal });
  const byApp = new Map();
  let total = 0;
  for (const ev of events || []) {
    const app = String(ev?.data?.app || "desconocido");
    const secs = Math.max(0, Math.round(Number(ev?.duration) || 0));
    if (!secs) continue;
    total += secs;
    let g = byApp.get(app);
    if (!g) {
      g = { app, seconds: 0, _titles: new Set() };
      byApp.set(app, g);
    }
    g.seconds += secs;
    if (ev?.data?.title && g._titles.size < 5) g._titles.add(String(ev.data.title));
  }
  const by_app = [...byApp.values()]
    .map((g) => ({ app: g.app, seconds: g.seconds, sample_titles: [...g._titles] }))
    .sort((a, b) => b.seconds - a.seconds);
  return {
    date: new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now),
    tz,
    total_active_seconds: total,
    by_app,
  };
}
