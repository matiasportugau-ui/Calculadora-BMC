// Tenant Control Tower analytics — always scoped by payload.tenant.
// Phase 0: derive from existing identity.user_activity_log (no heartbeat yet).

import { displayPerson } from "../../src/utils/tenantInviteView.js";

const ACTOR = `coalesce(nullif(l.payload->>'email', ''), l.actor_user_id::text, l.ip, 'anon')`;

const LIVE_ACTIONS = [
  "tenant.session.start",
  "tenant.session.end",
  "tenant.nav.route",
  "tenant.ui.click",
  "tenant.wizard.step",
  "tenant.quote.autosave",
  "tenant.quote.open",
  "tenant.quote.export.pdf",
  "tenant.quote.export.html",
  "tenant.quote.complete",
];

const SESSION_ACTIONS = ["tenant.session.start", "tenant.session.end"];

export const ONLINE_MS = 5 * 60 * 1000;
export const RECENT_MS = 24 * 60 * 60 * 1000;

export function presenceLight({ paused, lastAt, now = Date.now() } = {}) {
  if (paused) return { light: "paused", label: "pausado" };
  if (!lastAt) return { light: "silent", label: "sin señal" };
  const t = new Date(lastAt).getTime();
  if (!Number.isFinite(t)) return { light: "silent", label: "sin señal" };
  const age = now - t;
  if (age <= ONLINE_MS) return { light: "online", label: "en línea" };
  if (age <= RECENT_MS) return { light: "recent", label: "hoy" };
  return { light: "silent", label: "silencioso" };
}

export function parseRange(query = {}) {
  const to = query.to ? new Date(String(query.to)) : new Date();
  const from = query.from
    ? new Date(String(query.from))
    : new Date(to.getTime() - 7 * 86_400_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export async function getTenantAnalytics(pool, { slug, from, to }) {
  const range = [slug, from, to];
  const [active, timeline, actions, errors, time] = await Promise.all([
    pool.query(
      `select
         count(*)::int as events,
         count(distinct ${ACTOR})::int as users
         from identity.user_activity_log l
        where coalesce(l.payload->>'tenant', '') = $1
          and l.at >= $2::timestamptz and l.at <= $3::timestamptz`,
      range,
    ),
    pool.query(
      `select date_trunc('day', l.at) as bucket,
              count(*)::int as event_count,
              count(distinct ${ACTOR})::int as distinct_users
         from identity.user_activity_log l
        where coalesce(l.payload->>'tenant', '') = $1
          and l.at >= $2::timestamptz and l.at <= $3::timestamptz
        group by bucket
        order by bucket asc`,
      range,
    ),
    pool.query(
      `select l.action, count(*)::int as event_count,
              count(distinct ${ACTOR})::int as distinct_users,
              count(*) filter (where l.outcome = 'failure')::int as failures
         from identity.user_activity_log l
        where coalesce(l.payload->>'tenant', '') = $1
          and l.at >= $2::timestamptz and l.at <= $3::timestamptz
        group by l.action
        order by event_count desc
        limit 20`,
      range,
    ),
    pool.query(
      `select
         count(*) filter (where l.outcome = 'failure')::int as failures,
         count(*) filter (where l.outcome = 'success')::int as successes,
         count(*)::int as total
         from identity.user_activity_log l
        where coalesce(l.payload->>'tenant', '') = $1
          and l.at >= $2::timestamptz and l.at <= $3::timestamptz`,
      range,
    ),
    pool.query(
      `select
         percentile_cont(0.5) within group (order by span_ms) as median_ms,
         avg(span_ms) as avg_ms,
         count(*)::int as sessions
         from (
           select ${ACTOR} as who,
                  extract(epoch from (max(l.at) - min(l.at))) * 1000 as span_ms
             from identity.user_activity_log l
            where coalesce(l.payload->>'tenant', '') = $1
              and l.at >= $2::timestamptz and l.at <= $3::timestamptz
            group by 1
            having count(*) > 1
         ) s`,
      range,
    ),
  ]);
  const er = errors.rows[0] || {};
  const tm = time.rows[0] || {};
  const total = Number(er.total || 0);
  return {
    from,
    to,
    events: Number(active.rows[0]?.events || 0),
    users: Number(active.rows[0]?.users || 0),
    timeline: timeline.rows,
    top_actions: actions.rows,
    errors: {
      failures: Number(er.failures || 0),
      successes: Number(er.successes || 0),
      total,
      rate: total > 0 ? Number(er.failures || 0) / total : 0,
    },
    time_in_app: {
      sessions: Number(tm.sessions || 0),
      median_ms: tm.median_ms != null ? Number(tm.median_ms) : null,
      avg_ms: tm.avg_ms != null ? Number(tm.avg_ms) : null,
      estimated: true,
    },
  };
}

export async function getTenantFunnel(pool, { slug, from, to }) {
  const { rows } = await pool.query(
    `select
       coalesce(l.payload->>'index', l.payload->>'step_id', '?') as step,
       max(l.payload->>'step_label') as label,
       count(*)::int as events,
       count(distinct ${ACTOR})::int as users
       from identity.user_activity_log l
      where coalesce(l.payload->>'tenant', '') = $1
        and l.action = 'tenant.wizard.step'
        and l.at >= $2::timestamptz and l.at <= $3::timestamptz
      group by 1`,
    [slug, from, to],
  );
  rows.sort((a, b) => {
    const na = Number(a.step);
    const nb = Number(b.step);
    const aNum = Number.isFinite(na);
    const bNum = Number.isFinite(nb);
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return String(a.step).localeCompare(String(b.step));
  });
  const pdf = await pool.query(
    `select count(*)::int as events,
            count(distinct ${ACTOR})::int as users
       from identity.user_activity_log l
      where coalesce(l.payload->>'tenant', '') = $1
        and l.action = 'tenant.quote.export.pdf'
        and l.at >= $2::timestamptz and l.at <= $3::timestamptz`,
    [slug, from, to],
  );
  const sessions = await pool.query(
    `select count(distinct ${ACTOR})::int as users
       from identity.user_activity_log l
      where coalesce(l.payload->>'tenant', '') = $1
        and l.action = 'tenant.session.start'
        and l.at >= $2::timestamptz and l.at <= $3::timestamptz`,
    [slug, from, to],
  );
  return {
    from,
    to,
    sessions: Number(sessions.rows[0]?.users || 0),
    steps: rows,
    pdf: pdf.rows[0] || { events: 0, users: 0 },
  };
}

export function pairSessions(events) {
  const byWho = new Map();
  for (const e of events || []) {
    const who = e.who || "anon";
    if (!byWho.has(who)) byWho.set(who, []);
    byWho.get(who).push(e);
  }
  const out = [];
  for (const [who, list] of byWho) {
    const open = [];
    for (const e of list) {
      if (e.action === "tenant.session.start") {
        open.push(e);
      } else if (e.action === "tenant.session.end") {
        const start = open.shift();
        const ingreso = start?.at || null;
        const egreso = e.at;
        const duration_ms = ingreso
          ? new Date(egreso).getTime() - new Date(ingreso).getTime()
          : null;
        out.push({
          who,
          email: e.email || start?.email || null,
          ip: e.ip || start?.ip || null,
          ingreso,
          egreso,
          duration_ms: Number.isFinite(duration_ms) && duration_ms >= 0 ? duration_ms : null,
          open: false,
        });
      }
    }
    for (const start of open) {
      out.push({
        who,
        email: start.email || null,
        ip: start.ip || null,
        ingreso: start.at,
        egreso: null,
        duration_ms: null,
        open: true,
      });
    }
  }
  out.sort((a, b) => {
    const ta = new Date(a.ingreso || a.egreso || 0).getTime();
    const tb = new Date(b.ingreso || b.egreso || 0).getTime();
    return tb - ta;
  });
  return out;
}

async function directoryByEmail(pool, slug) {
  const { rows } = await pool.query(
    `select lower(m.invited_email::text) as email, u.name, m.role, m.claimed_at
       from identity.tenant_members m
       join identity.tenants t on t.tenant_id = m.tenant_id
       left join identity.users u on u.user_id = m.user_id
      where t.slug = $1`,
    [slug],
  );
  return Object.fromEntries(rows.map((r) => [r.email, r]));
}

function decoratePerson(row, dir) {
  const email = (row.email || (String(row.who || "").includes("@") ? row.who : null) || "")
    .toLowerCase() || null;
  const hit = email ? dir[email] : null;
  const person = displayPerson({
    who: row.who,
    name: hit?.name || row.name || null,
    email,
    ip: row.ip || null,
  });
  return { ...row, email, name: hit?.name || row.name || null, ...person };
}

export async function getTenantLive(pool, { slug, now = new Date() } = {}) {
  const { rows } = await pool.query(
    `select ${ACTOR} as who,
            max(nullif(l.payload->>'email', '')) as email,
            max(l.ip) as ip,
            max(l.at) as last_at,
            (array_agg(l.action order by l.at desc))[1] as last_action,
            (array_agg(l.payload->>'path' order by l.at desc))[1] as path,
            (array_agg(coalesce(l.payload->>'step_label', l.payload->>'step_id') order by l.at desc))[1] as step,
            (array_agg(l.payload->>'label' order by l.at desc))[1] as last_click,
            (array_agg(l.payload->>'bc_code' order by l.at desc))[1] as quote_code
       from identity.user_activity_log l
      where coalesce(l.payload->>'tenant', '') = $1
        and l.action = any($2::text[])
        and l.at > now() - interval '24 hours'
      group by 1
      order by last_at desc
      limit 40`,
    [slug, LIVE_ACTIONS],
  );
  const dir = await directoryByEmail(pool, slug);
  const t = now.getTime();
  const items = rows.map((r) => {
    const light = presenceLight({ lastAt: r.last_at, now: t });
    const person = decoratePerson(r, dir);
    return {
      who: r.who,
      title: person.title,
      subtitle: person.subtitle,
      visitor: person.visitor,
      name: person.name,
      email: person.email,
      last_at: r.last_at,
      last_action: r.last_action,
      path: r.path || null,
      step: r.step || null,
      last_click: r.last_click || null,
      quote_code: r.quote_code || null,
      ...light,
    };
  });
  return {
    online: items.filter((i) => i.light === "online").length,
    items,
  };
}

export async function getTenantSessions(pool, { slug, from, to }) {
  const { rows } = await pool.query(
    `select ${ACTOR} as who,
            nullif(l.payload->>'email', '') as email,
            l.ip,
            l.action,
            l.at
       from identity.user_activity_log l
      where coalesce(l.payload->>'tenant', '') = $1
        and l.action = any($2::text[])
        and l.at >= $3::timestamptz and l.at <= $4::timestamptz
      order by l.at asc
      limit 500`,
    [slug, SESSION_ACTIONS, from, to],
  );
  const dir = await directoryByEmail(pool, slug);
  const sessions = pairSessions(rows).slice(0, 200).map((s) => {
    const person = decoratePerson(s, dir);
    const when = s.ingreso || s.egreso;
    return {
      ...s,
      title: person.title,
      subtitle: person.subtitle,
      visitor: person.visitor,
      name: person.name,
      email: person.email,
      day: when
        ? new Date(when).toLocaleDateString("es-UY", {
          weekday: "short", day: "numeric", month: "short", timeZone: "America/Montevideo",
        })
        : null,
    };
  });
  return { from, to, sessions };
}
