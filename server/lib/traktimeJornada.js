/**
 * TraKtiMe — jornada / coordinación derivation (read-time, no schema change).
 *
 * Ramiro's report semantics (Observación 02, items 14–16):
 *   - Per UY-local day → ordered entries with start/end.
 *   - Micro-gaps between consecutive entries (stopped_at[i] → started_at[i+1])
 *     are auto-computed as "coordinación"; gaps over a threshold become "pausa".
 *   - Jornada = span from the first task start to the last task end.
 *   - effective = Σ duration_seconds; idle = jornada − effective.
 *
 * Everything here is PURE: it operates on plain entry objects and never touches
 * the DB. The route layer fetches `tk_entries` rows and feeds them in. Gaps are
 * NEVER persisted — they are derived on every read.
 *
 * Timezone: days are bucketed by the America/Montevideo wall-clock date of
 * `started_at` (a UTC instant in Postgres `timestamptz`). Grouping by UTC would
 * split a UY workday at the wrong boundary.
 */

export const DEFAULT_TZ = "America/Montevideo";
export const DEFAULT_PAUSA_THRESHOLD_SECONDS = 30 * 60; // 30 min

function toMs(value) {
  if (value == null) return NaN;
  if (value instanceof Date) return value.getTime();
  return new Date(value).getTime();
}

/** YYYY-MM-DD in the given IANA timezone (en-CA yields ISO date order). */
export function localDateStr(value, tz = DEFAULT_TZ) {
  const ms = toMs(value);
  if (Number.isNaN(ms)) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/** HH:MM (24h) in the given IANA timezone. */
export function localTimeStr(value, tz = DEFAULT_TZ) {
  const ms = toMs(value);
  if (Number.isNaN(ms)) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

/** Effective seconds for one entry: prefer stored duration_seconds, else derive. */
function effectiveSeconds(entry) {
  if (entry.duration_seconds != null && entry.duration_seconds !== "") {
    return Math.max(0, Number(entry.duration_seconds) || 0);
  }
  const a = toMs(entry.started_at);
  const b = toMs(entry.stopped_at);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 1000));
}

/**
 * Compute the report for a single day's worth of entries (all already known to
 * share the same UY-local date). Entries with no stopped_at are ignored.
 *
 * @param {Array} dayEntries
 * @param {{ date:string, tz?:string, pausaThresholdSeconds?:number }} opts
 */
export function computeDay(dayEntries, opts) {
  const tz = opts.tz || DEFAULT_TZ;
  const threshold = Number.isFinite(opts.pausaThresholdSeconds)
    ? opts.pausaThresholdSeconds
    : DEFAULT_PAUSA_THRESHOLD_SECONDS;

  // Only closed entries participate (open timers have no end).
  const closed = dayEntries
    .filter((e) => e.stopped_at != null && !Number.isNaN(toMs(e.started_at)))
    .slice()
    .sort((a, b) => {
      const d = toMs(a.started_at) - toMs(b.started_at);
      return d !== 0 ? d : toMs(a.stopped_at) - toMs(b.stopped_at);
    });

  const entries = closed.map((e) => ({
    entry_id: e.entry_id,
    project_id: e.project_id,
    project_name: e.project_name || null,
    client_name: e.client_name || null,
    color_hex: e.color_hex || null,
    description: e.description || "",
    started_at: e.started_at,
    stopped_at: e.stopped_at,
    start_local: localTimeStr(e.started_at, tz),
    end_local: localTimeStr(e.stopped_at, tz),
    seconds: effectiveSeconds(e),
  }));

  const effective_seconds = entries.reduce((s, e) => s + e.seconds, 0);

  const gaps = [];
  let coordinacion_seconds = 0;
  let pausa_seconds = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const gapSec = Math.round((toMs(closed[i + 1].started_at) - toMs(closed[i].stopped_at)) / 1000);
    // Overlapping or back-to-back-with-overlap entries produce no gap.
    if (gapSec <= 0) continue;
    const kind = gapSec > threshold ? "pausa" : "coordinacion";
    gaps.push({
      kind,
      seconds: gapSec,
      from: closed[i].stopped_at,
      to: closed[i + 1].started_at,
      from_local: localTimeStr(closed[i].stopped_at, tz),
      to_local: localTimeStr(closed[i + 1].started_at, tz),
    });
    if (kind === "pausa") pausa_seconds += gapSec;
    else coordinacion_seconds += gapSec;
  }

  let first_in = null;
  let last_out = null;
  let jornada_seconds = 0;
  if (closed.length) {
    first_in = closed[0].started_at;
    // last_out is the max stopped_at (an earlier-starting entry may end later).
    last_out = closed.reduce(
      (max, e) => (toMs(e.stopped_at) > toMs(max) ? e.stopped_at : max),
      closed[0].stopped_at,
    );
    jornada_seconds = Math.max(0, Math.round((toMs(last_out) - toMs(first_in)) / 1000));
  }
  const idle_seconds = Math.max(0, jornada_seconds - effective_seconds);

  return {
    date: opts.date,
    entries,
    gaps,
    entry_count: entries.length,
    first_in,
    last_out,
    first_in_local: first_in ? localTimeStr(first_in, tz) : null,
    last_out_local: last_out ? localTimeStr(last_out, tz) : null,
    effective_seconds,
    coordinacion_seconds,
    pausa_seconds,
    jornada_seconds,
    idle_seconds,
  };
}

/**
 * Build a multi-day report from a flat list of `tk_entries` rows. Buckets by
 * UY-local date, computes per-day jornada/gaps, and rolls up monthly totals and
 * a per-client/project breakdown.
 *
 * @param {Array} entries
 * @param {{ tz?:string, pausaThresholdSeconds?:number }} [opts]
 */
export function buildJornadaReport(entries, opts = {}) {
  const tz = opts.tz || DEFAULT_TZ;
  const pausaThresholdSeconds = Number.isFinite(opts.pausaThresholdSeconds)
    ? opts.pausaThresholdSeconds
    : DEFAULT_PAUSA_THRESHOLD_SECONDS;

  const byDay = new Map();
  for (const e of entries || []) {
    if (e.stopped_at == null) continue;
    const day = localDateStr(e.started_at, tz);
    if (!day) continue;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(e);
  }

  const days = [...byDay.keys()]
    .sort()
    .map((date) => computeDay(byDay.get(date), { date, tz, pausaThresholdSeconds }));

  const totals = days.reduce(
    (t, d) => {
      t.effective_seconds += d.effective_seconds;
      t.coordinacion_seconds += d.coordinacion_seconds;
      t.pausa_seconds += d.pausa_seconds;
      t.jornada_seconds += d.jornada_seconds;
      t.idle_seconds += d.idle_seconds;
      t.entry_count += d.entry_count;
      return t;
    },
    {
      effective_seconds: 0,
      coordinacion_seconds: 0,
      pausa_seconds: 0,
      jornada_seconds: 0,
      idle_seconds: 0,
      entry_count: 0,
      day_count: days.length,
    },
  );

  // Per-client/project rollup of effective time.
  const rollup = new Map();
  for (const d of days) {
    for (const e of d.entries) {
      const key = e.project_id || e.project_name || "—";
      let g = rollup.get(key);
      if (!g) {
        g = {
          project_id: e.project_id || null,
          project_name: e.project_name || "—",
          client_name: e.client_name || null,
          color_hex: e.color_hex || null,
          effective_seconds: 0,
          entry_count: 0,
        };
        rollup.set(key, g);
      }
      g.effective_seconds += e.seconds;
      g.entry_count += 1;
    }
  }
  const projects = [...rollup.values()].sort((a, b) => b.effective_seconds - a.effective_seconds);

  return { tz, pausa_threshold_seconds: pausaThresholdSeconds, days, totals, projects };
}
