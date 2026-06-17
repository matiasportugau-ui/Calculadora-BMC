/**
 * Clockify → Postgres read-only sync (Fase 1).
 *
 * Periodically pulls the Clockify workspace (users, projects, time entries via
 * the Detailed Report) and upserts them into the clockify_* mirror tables. The
 * mirror is the source of truth for BMC reporting; Clockify is the source of
 * truth for capture.
 *
 * Strategy:
 *   - Reconciliation by poll every config.clockifySyncIntervalMin minutes.
 *   - Entries window = [cursor - overlapHours, now] (overlap catches late
 *     edits); first run looks back INITIAL_LOOKBACK_DAYS.
 *   - Idempotent: every row upserts ON CONFLICT (clockify_*_id).
 *   - Watermark + health stored in clockify_sync_state.
 *
 * Webhooks (realtime) are Fase 2; this poll is the robust baseline.
 */
import { createClockifyClient } from "./clockifyClient.js";

const INITIAL_LOOKBACK_DAYS = 60;

function durationSeconds(start, end) {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.round(ms / 1000));
}

async function upsertUsers(pool, users) {
  for (const u of users) {
    await pool.query(
      `insert into clockify_users (clockify_user_id, email, name, status, updated_at)
       values ($1, $2, $3, $4, now())
       on conflict (clockify_user_id) do update set
         email = excluded.email,
         name = excluded.name,
         status = excluded.status,
         updated_at = now()`,
      [u.id, u.email || null, u.name || null, u.status || null],
    );
  }
  // Best-effort: link operators to their BMC identity by email. Tolerant of an
  // absent identity schema (e.g. a calc-only DB) — never fail the sync on this.
  try {
    await pool.query(
      `update clockify_users cu
          set bmc_user_id = iu.user_id, updated_at = now()
         from identity.users iu
        where cu.bmc_user_id is null
          and cu.email is not null
          and lower(cu.email) = lower(iu.email)`,
    );
  } catch (e) {
    if (e?.code !== "42P01") throw e; // 42P01 = identity.users absent
  }
  return users.length;
}

async function upsertProjects(pool, projects) {
  for (const p of projects) {
    await pool.query(
      `insert into clockify_projects
         (clockify_project_id, name, client_name, color_hex, archived, updated_at)
       values ($1, $2, $3, $4, $5, now())
       on conflict (clockify_project_id) do update set
         name = excluded.name,
         client_name = excluded.client_name,
         color_hex = excluded.color_hex,
         archived = excluded.archived,
         updated_at = now()`,
      [p.id, p.name || null, p.clientName || null, p.color || null, Boolean(p.archived)],
    );
  }
  return projects.length;
}

async function upsertEntries(pool, entries) {
  for (const e of entries) {
    const interval = e.timeInterval || {};
    const tags = Array.isArray(e.tags)
      ? e.tags.map((t) => (typeof t === "string" ? t : t?.name)).filter(Boolean)
      : [];
    await pool.query(
      `insert into clockify_entries
         (clockify_entry_id, clockify_user_id, clockify_project_id, description,
          started_at, stopped_at, duration_seconds, billable, tags, raw, synced_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, now())
       on conflict (clockify_entry_id) do update set
         clockify_user_id = excluded.clockify_user_id,
         clockify_project_id = excluded.clockify_project_id,
         description = excluded.description,
         started_at = excluded.started_at,
         stopped_at = excluded.stopped_at,
         duration_seconds = excluded.duration_seconds,
         billable = excluded.billable,
         tags = excluded.tags,
         raw = excluded.raw,
         synced_at = now()`,
      [
        e._id || e.id,
        e.userId || null,
        e.projectId || null,
        e.description || "",
        interval.start || null,
        interval.end || null,
        durationSeconds(interval.start, interval.end),
        e.billable !== false,
        tags,
        JSON.stringify(e),
      ],
    );
  }
  return entries.length;
}

async function readCursor(pool, resource) {
  const { rows } = await pool.query(
    `select cursor_ts from clockify_sync_state where resource = $1`,
    [resource],
  );
  return rows[0]?.cursor_ts ? new Date(rows[0].cursor_ts) : null;
}

async function writeState(pool, resource, { cursorTs, status, error }) {
  await pool.query(
    `insert into clockify_sync_state (resource, cursor_ts, last_run_at, last_status, last_error)
     values ($1, $2, now(), $3, $4)
     on conflict (resource) do update set
       cursor_ts = coalesce(excluded.cursor_ts, clockify_sync_state.cursor_ts),
       last_run_at = now(),
       last_status = excluded.last_status,
       last_error = excluded.last_error`,
    [resource, cursorTs || null, status, error || null],
  );
}

/** Manual / on-demand run. Returns per-resource counts. */
export async function runClockifySync({ config, logger, pool }) {
  const log = logger || console;
  if (!pool) throw Object.assign(new Error("no_pool"), { status: 503 });

  const client = createClockifyClient({ config, logger: log });
  client.assertConfig(); // throws 500 if key/workspace missing

  const t0 = Date.now();
  const now = new Date();
  const cursor = await readCursor(pool, "entries");
  const overlapMs = (config.clockifySyncOverlapHours || 48) * 3600 * 1000;
  const start = cursor
    ? new Date(cursor.getTime() - overlapMs)
    : new Date(now.getTime() - INITIAL_LOOKBACK_DAYS * 24 * 3600 * 1000);

  const counts = { users: 0, projects: 0, entries: 0 };
  try {
    counts.users = await upsertUsers(pool, await client.getUsers());
    await writeState(pool, "users", { status: "ok" });

    counts.projects = await upsertProjects(pool, await client.getProjects());
    await writeState(pool, "projects", { status: "ok" });

    const entries = await client.getDetailedEntries({
      startISO: start.toISOString(),
      endISO: now.toISOString(),
    });
    counts.entries = await upsertEntries(pool, entries);
    await writeState(pool, "entries", { cursorTs: now, status: "ok" });
  } catch (e) {
    await writeState(pool, "entries", { status: "error", error: e?.message || "sync_failed" }).catch(
      () => {},
    );
    throw e;
  }

  log.info?.({ counts, ms: Date.now() - t0 }, "[clockify sync] done");
  return counts;
}

/**
 * Schedule a recurring sync every config.clockifySyncIntervalMin minutes.
 * Returns a shutdown function.
 */
export function startClockifySyncWorker({ config, logger, pool }) {
  const log = logger || console;
  if (!pool) {
    log.warn?.("[clockify sync] no pool — worker not started");
    return () => {};
  }
  if (!config.clockifySyncEnabled) {
    log.info?.("[clockify sync] disabled via env (CLOCKIFY_SYNC_ENABLED)");
    return () => {};
  }
  if (!config.clockifyApiKey || !config.clockifyWorkspaceId) {
    log.warn?.("[clockify sync] CLOCKIFY_API_KEY/WORKSPACE_ID unset — worker not started");
    return () => {};
  }

  const ac = new AbortController();
  let timer = null;
  const intervalMs = Math.max(1, config.clockifySyncIntervalMin || 5) * 60 * 1000;

  function scheduleNext(ms) {
    if (ac.signal.aborted) return;
    timer = setTimeout(async () => {
      try {
        await runClockifySync({ config, logger: log, pool });
      } catch (e) {
        log.error?.({ err: e?.message }, "[clockify sync] run failed");
      }
      scheduleNext(intervalMs);
    }, ms);
  }

  log.info?.({ intervalMs }, "[clockify sync] scheduled");
  scheduleNext(5000); // first run shortly after boot
  return () => {
    ac.abort();
    if (timer) clearTimeout(timer);
  };
}
