/**
 * TraKtiMe — time tracking + invoicing API under /api/traktime/*.
 * Mount: app.use("/api", createTraktimeRouter(config, logger))
 *
 * Auth: requireUser() from server/lib/identityAuth.js. Admin-only routes use
 *   requireUser({ role: "admin" }). The "traktime" module slug is registered in
 *   identityAuth.ALL_MODULES so /auth/me/grants reports availability.
 *
 * Error semantics (per project convention):
 *   400 bad input · 401 no auth · 403 forbidden · 404 not found
 *   409 conflict (timer already running)
 *   503 if DB unavailable · never 500 for transient infra failures
 */
import { Router } from "express";
import { getTraktimePool } from "../lib/traktimeDb.js";
import { requireUser } from "../lib/identityAuth.js";
import { tkAudit } from "../lib/traktimeAudit.js";
import { runTraktimeMirror } from "../lib/traktimeMirrorWorker.js";

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function trimOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function hexColor(v, fallback = "#0071e3") {
  const s = String(v || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : fallback;
}

/**
 * @param {import("../config.js").config} config
 * @param {import("pino").Logger} [logger]
 */
export default function createTraktimeRouter(config, logger) {
  const router = Router();
  const pool = getTraktimePool(config.databaseUrl);
  const log = logger || console;

  function requireDb(_req, res, next) {
    if (!pool) {
      return res.status(503).json({ ok: false, error: "DATABASE_URL not configured" });
    }
    return next();
  }

  // ─── Health (no auth) ─────────────────────────────────────────────────
  router.get(
    "/api/traktime/health",
    asyncHandler(async (_req, res) => {
      if (!pool) return res.status(503).json({ ok: false, error: "no_db" });
      try {
        await pool.query("select 1");
        res.json({ ok: true });
      } catch (e) {
        log.warn?.({ err: e }, "[traktime] health db ping failed");
        res.status(503).json({ ok: false, error: "db_unreachable" });
      }
    }),
  );

  // ─── Me ───────────────────────────────────────────────────────────────
  router.get(
    "/api/traktime/me",
    requireUser(),
    requireDb,
    asyncHandler(async (req, res) => {
      const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";
      // Member project list = projects user is a member of OR (if admin) all.
      const sql = isAdmin
        ? `select p.project_id, p.client_id, p.name, p.color_hex, p.hourly_rate_usd,
                  p.rounding_minutes, p.billable_default, p.archived_at,
                  c.name as client_name
             from tk_projects p join tk_clients c on c.client_id = p.client_id
            where p.archived_at is null and c.archived_at is null
            order by c.name, p.name`
        : `select p.project_id, p.client_id, p.name, p.color_hex, p.hourly_rate_usd,
                  p.rounding_minutes, p.billable_default, p.archived_at,
                  c.name as client_name
             from tk_projects p
             join tk_clients c on c.client_id = p.client_id
             join tk_project_members m on m.project_id = p.project_id and m.user_id = $1
            where p.archived_at is null and c.archived_at is null
            order by c.name, p.name`;
      const { rows } = isAdmin
        ? await pool.query(sql)
        : await pool.query(sql, [req.user.id]);
      res.json({
        ok: true,
        user: { id: req.user.id, email: req.user.email, name: req.user.name },
        role: isAdmin ? "admin" : "member",
        projects: rows,
      });
    }),
  );

  // ─── Clients ──────────────────────────────────────────────────────────
  router.get(
    "/api/traktime/clients",
    requireUser(),
    requireDb,
    asyncHandler(async (req, res) => {
      const includeArchived = req.query.include_archived === "1";
      const sql = includeArchived
        ? `select * from tk_clients order by lower(name)`
        : `select * from tk_clients where archived_at is null order by lower(name)`;
      const { rows } = await pool.query(sql);
      res.json({ ok: true, clients: rows });
    }),
  );

  router.post(
    "/api/traktime/clients",
    requireUser({ role: "admin" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const name = trimOrNull(req.body?.name);
      if (!name) return res.status(400).json({ ok: false, error: "name_required" });
      const rut = trimOrNull(req.body?.rut);
      const email = trimOrNull(req.body?.email);
      const address = trimOrNull(req.body?.address);
      const notes = trimOrNull(req.body?.notes);
      const { rows } = await pool.query(
        `insert into tk_clients (name, rut, email, address, notes)
         values ($1, $2, $3, $4, $5)
         returning *`,
        [name, rut, email, address, notes],
      );
      await tkAudit(pool, {
        action: "client.create",
        row_table: "tk_clients",
        row_id: rows[0].client_id,
        after: rows[0],
        user_email: req.user.email,
      }, log);
      res.status(201).json({ ok: true, client: rows[0] });
    }),
  );

  router.patch(
    "/api/traktime/clients/:id",
    requireUser({ role: "admin" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      const fields = [];
      const params = [];
      let i = 1;
      for (const k of ["name", "rut", "email", "address", "notes"]) {
        if (k in (req.body || {})) {
          fields.push(`${k} = $${i++}`);
          params.push(trimOrNull(req.body[k]));
        }
      }
      if ("archived" in (req.body || {})) {
        fields.push(`archived_at = ${req.body.archived ? "now()" : "null"}`);
      }
      if (!fields.length) return res.status(400).json({ ok: false, error: "no_fields" });
      fields.push("updated_at = now()");
      params.push(id);
      const { rows } = await pool.query(
        `update tk_clients set ${fields.join(", ")} where client_id = $${i} returning *`,
        params,
      );
      if (!rows.length) return res.status(404).json({ ok: false, error: "not_found" });
      await tkAudit(pool, {
        action: "client.update",
        row_table: "tk_clients",
        row_id: rows[0].client_id,
        after: rows[0],
        user_email: req.user.email,
      }, log);
      res.json({ ok: true, client: rows[0] });
    }),
  );

  // ─── Projects ─────────────────────────────────────────────────────────
  router.get(
    "/api/traktime/projects",
    requireUser(),
    requireDb,
    asyncHandler(async (req, res) => {
      const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";
      const sql = isAdmin
        ? `select p.*, c.name as client_name
             from tk_projects p join tk_clients c on c.client_id = p.client_id
            where p.archived_at is null
            order by c.name, p.name`
        : `select p.*, c.name as client_name
             from tk_projects p
             join tk_clients c on c.client_id = p.client_id
             join tk_project_members m on m.project_id = p.project_id and m.user_id = $1
            where p.archived_at is null
            order by c.name, p.name`;
      const { rows } = isAdmin ? await pool.query(sql) : await pool.query(sql, [req.user.id]);
      res.json({ ok: true, projects: rows });
    }),
  );

  router.post(
    "/api/traktime/projects",
    requireUser({ role: "admin" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const client_id = trimOrNull(req.body?.client_id);
      const name = trimOrNull(req.body?.name);
      if (!client_id || !name) {
        return res.status(400).json({ ok: false, error: "client_id_and_name_required" });
      }
      const color_hex = hexColor(req.body?.color_hex);
      const billable_default = req.body?.billable_default !== false;
      const hourly_rate_usd = Number(req.body?.hourly_rate_usd) || 0;
      const rounding_minutes = [1, 5, 15, 30, 60].includes(Number(req.body?.rounding_minutes))
        ? Number(req.body.rounding_minutes)
        : 15;
      try {
        const { rows } = await pool.query(
          `insert into tk_projects
             (client_id, name, color_hex, billable_default, hourly_rate_usd, rounding_minutes)
           values ($1, $2, $3, $4, $5, $6)
           returning *`,
          [client_id, name, color_hex, billable_default, hourly_rate_usd, rounding_minutes],
        );
        await tkAudit(pool, {
          action: "project.create",
          row_table: "tk_projects",
          row_id: rows[0].project_id,
          after: rows[0],
          user_email: req.user.email,
        }, log);
        res.status(201).json({ ok: true, project: rows[0] });
      } catch (e) {
        if (e.code === "23503") {
          return res.status(400).json({ ok: false, error: "client_not_found" });
        }
        throw e;
      }
    }),
  );

  router.patch(
    "/api/traktime/projects/:id",
    requireUser({ role: "admin" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      const fields = [];
      const params = [];
      let i = 1;
      if ("name" in (req.body || {})) {
        fields.push(`name = $${i++}`);
        params.push(trimOrNull(req.body.name));
      }
      if ("color_hex" in (req.body || {})) {
        fields.push(`color_hex = $${i++}`);
        params.push(hexColor(req.body.color_hex));
      }
      if ("billable_default" in (req.body || {})) {
        fields.push(`billable_default = $${i++}`);
        params.push(!!req.body.billable_default);
      }
      if ("hourly_rate_usd" in (req.body || {})) {
        fields.push(`hourly_rate_usd = $${i++}`);
        params.push(Number(req.body.hourly_rate_usd) || 0);
      }
      if ("rounding_minutes" in (req.body || {})) {
        const rm = Number(req.body.rounding_minutes);
        if (![1, 5, 15, 30, 60].includes(rm)) {
          return res.status(400).json({ ok: false, error: "invalid_rounding_minutes" });
        }
        fields.push(`rounding_minutes = $${i++}`);
        params.push(rm);
      }
      if ("archived" in (req.body || {})) {
        fields.push(`archived_at = ${req.body.archived ? "now()" : "null"}`);
      }
      if (!fields.length) return res.status(400).json({ ok: false, error: "no_fields" });
      fields.push("updated_at = now()");
      params.push(id);
      const { rows } = await pool.query(
        `update tk_projects set ${fields.join(", ")} where project_id = $${i} returning *`,
        params,
      );
      if (!rows.length) return res.status(404).json({ ok: false, error: "not_found" });
      await tkAudit(pool, {
        action: "project.update",
        row_table: "tk_projects",
        row_id: rows[0].project_id,
        after: rows[0],
        user_email: req.user.email,
      }, log);
      res.json({ ok: true, project: rows[0] });
    }),
  );

  // ─── Project members (admin) ─────────────────────────────────────────
  router.get(
    "/api/traktime/projects/:id/members",
    requireUser(),
    requireDb,
    asyncHandler(async (req, res) => {
      const { rows } = await pool.query(
        `select project_id, user_id, role, added_at
           from tk_project_members where project_id = $1
          order by added_at`,
        [req.params.id],
      );
      res.json({ ok: true, members: rows });
    }),
  );

  router.post(
    "/api/traktime/projects/:id/members",
    requireUser({ role: "admin" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const user_id = trimOrNull(req.body?.user_id);
      const role = req.body?.role === "admin" ? "admin" : "member";
      if (!user_id) return res.status(400).json({ ok: false, error: "user_id_required" });
      try {
        const { rows } = await pool.query(
          `insert into tk_project_members (project_id, user_id, role)
             values ($1, $2, $3)
           on conflict (project_id, user_id) do update set role = excluded.role
           returning *`,
          [req.params.id, user_id, role],
        );
        await tkAudit(pool, {
          action: "project.member.add",
          row_table: "tk_project_members",
          row_id: rows[0].project_id,
          after: rows[0],
          user_email: req.user.email,
        }, log);
        res.status(201).json({ ok: true, member: rows[0] });
      } catch (e) {
        if (e.code === "23503") {
          return res.status(400).json({ ok: false, error: "project_not_found" });
        }
        throw e;
      }
    }),
  );

  router.delete(
    "/api/traktime/projects/:id/members/:userId",
    requireUser({ role: "admin" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const { rowCount } = await pool.query(
        `delete from tk_project_members where project_id = $1 and user_id = $2`,
        [req.params.id, req.params.userId],
      );
      if (!rowCount) return res.status(404).json({ ok: false, error: "not_found" });
      await tkAudit(pool, {
        action: "project.member.remove",
        row_table: "tk_project_members",
        row_id: req.params.id,
        meta: { user_id: req.params.userId },
        user_email: req.user.email,
      }, log);
      res.json({ ok: true });
    }),
  );

  // ─── Tasks ───────────────────────────────────────────────────────────
  router.get(
    "/api/traktime/tasks",
    requireUser(),
    requireDb,
    asyncHandler(async (req, res) => {
      const project_id = req.query.project_id;
      const params = [];
      let where = "archived_at is null";
      if (project_id) {
        params.push(project_id);
        where += ` and project_id = $${params.length}`;
      }
      const { rows } = await pool.query(
        `select * from tk_tasks where ${where} order by lower(name)`,
        params,
      );
      res.json({ ok: true, tasks: rows });
    }),
  );

  router.post(
    "/api/traktime/tasks",
    requireUser({ role: "admin" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const project_id = trimOrNull(req.body?.project_id);
      const name = trimOrNull(req.body?.name);
      if (!project_id || !name) {
        return res.status(400).json({ ok: false, error: "project_id_and_name_required" });
      }
      try {
        const { rows } = await pool.query(
          `insert into tk_tasks (project_id, name) values ($1, $2) returning *`,
          [project_id, name],
        );
        await tkAudit(pool, {
          action: "task.create",
          row_table: "tk_tasks",
          row_id: rows[0].task_id,
          after: rows[0],
          user_email: req.user.email,
        }, log);
        res.status(201).json({ ok: true, task: rows[0] });
      } catch (e) {
        if (e.code === "23503") {
          return res.status(400).json({ ok: false, error: "project_not_found" });
        }
        throw e;
      }
    }),
  );

  // ─── Tags ────────────────────────────────────────────────────────────
  router.get(
    "/api/traktime/tags",
    requireUser(),
    requireDb,
    asyncHandler(async (_req, res) => {
      const { rows } = await pool.query(`select * from tk_tags order by lower(name)`);
      res.json({ ok: true, tags: rows });
    }),
  );

  router.post(
    "/api/traktime/tags",
    requireUser({ role: "admin" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const name = trimOrNull(req.body?.name);
      if (!name) return res.status(400).json({ ok: false, error: "name_required" });
      const color_hex = hexColor(req.body?.color_hex, "#8e8e93");
      try {
        const { rows } = await pool.query(
          `insert into tk_tags (name, color_hex) values ($1, $2) returning *`,
          [name, color_hex],
        );
        res.status(201).json({ ok: true, tag: rows[0] });
      } catch (e) {
        if (e.code === "23505") return res.status(409).json({ ok: false, error: "tag_exists" });
        throw e;
      }
    }),
  );

  // ─── Reports: unbilled hours (rounding preview) ───────────────────────
  router.get(
    "/api/traktime/reports/billable",
    requireUser({ role: "admin" }),
    requireDb,
    asyncHandler(async (req, res) => {
      const params = [];
      let where = "e.stopped_at is not null and e.billable and e.invoice_line_id is null";
      if (req.query.client_id) {
        params.push(req.query.client_id);
        where += ` and p.client_id = $${params.length}`;
      }
      if (req.query.from) {
        params.push(req.query.from);
        where += ` and e.started_at >= $${params.length}`;
      }
      if (req.query.to) {
        params.push(req.query.to);
        where += ` and e.started_at < $${params.length}`;
      }
      const { rows } = await pool.query(
        `select p.project_id, p.name as project_name, p.color_hex,
                p.rounding_minutes, p.hourly_rate_usd, c.name as client_name,
                coalesce(sum(e.duration_seconds), 0)::bigint as raw_seconds,
                count(*)::int as entry_count
           from tk_entries e
           join tk_projects p on p.project_id = e.project_id
           join tk_clients  c on c.client_id  = p.client_id
          where ${where}
          group by p.project_id, p.name, p.color_hex, p.rounding_minutes,
                   p.hourly_rate_usd, c.name`,
        params,
      );
      // Per-project round-up to nearest rounding_minutes.
      const groups = rows.map((r) => {
        const bucketSec = Math.max(60, Number(r.rounding_minutes || 15) * 60);
        const rounded = Math.ceil(Number(r.raw_seconds || 0) / bucketSec) * bucketSec;
        const hours = rounded / 3600;
        const amount = +(hours * Number(r.hourly_rate_usd || 0)).toFixed(2);
        return {
          project_id: r.project_id,
          project_name: r.project_name,
          client_name: r.client_name,
          color_hex: r.color_hex,
          rounding_minutes: r.rounding_minutes,
          hourly_rate_usd: Number(r.hourly_rate_usd),
          entry_count: r.entry_count,
          raw_seconds: Number(r.raw_seconds),
          rounded_seconds: rounded,
          rounded_hours: hours,
          amount_usd: amount,
        };
      });
      const subtotal = +groups.reduce((s, g) => s + g.amount_usd, 0).toFixed(2);
      res.json({ ok: true, groups, subtotal_usd: subtotal });
    }),
  );

  // ─── Admin: manual mirror trigger ─────────────────────────────────────
  router.post(
    "/api/traktime/admin/mirror-now",
    requireUser({ role: "admin" }),
    requireDb,
    asyncHandler(async (req, res) => {
      try {
        const counts = await runTraktimeMirror({ config, logger: log, pool });
        await tkAudit(pool, {
          action: "mirror.manual",
          meta: counts,
          user_email: req.user.email,
        }, log);
        res.json({ ok: true, counts });
      } catch (e) {
        const status = e.status || 503;
        res.status(status).json({ ok: false, error: e.message || "mirror_failed" });
      }
    }),
  );

  // ─── Timer ────────────────────────────────────────────────────────────
  router.get(
    "/api/traktime/timer/current",
    requireUser(),
    requireDb,
    asyncHandler(async (req, res) => {
      const { rows } = await pool.query(
        `select e.*, p.name as project_name, p.color_hex
           from tk_entries e join tk_projects p on p.project_id = e.project_id
          where e.user_id = $1 and e.stopped_at is null
          limit 1`,
        [req.user.id],
      );
      res.json({ ok: true, running: rows[0] || null });
    }),
  );

  router.post(
    "/api/traktime/timer/start",
    requireUser(),
    requireDb,
    asyncHandler(async (req, res) => {
      const project_id = trimOrNull(req.body?.project_id);
      if (!project_id) return res.status(400).json({ ok: false, error: "project_id_required" });
      const description = trimOrNull(req.body?.description) || "";
      const task_id = trimOrNull(req.body?.task_id);
      const tags = Array.isArray(req.body?.tags) ? req.body.tags.map(String) : [];

      // Admins can start on any project; members only on projects they belong to.
      const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";
      if (!isAdmin) {
        const { rows: m } = await pool.query(
          `select 1 from tk_project_members where project_id = $1 and user_id = $2`,
          [project_id, req.user.id],
        );
        if (!m.length) return res.status(403).json({ ok: false, error: "not_a_member" });
      }
      try {
        const { rows } = await pool.query(
          `insert into tk_entries (user_id, project_id, task_id, description, started_at, tags)
           values ($1, $2, $3, $4, now(), $5)
           returning *`,
          [req.user.id, project_id, task_id, description, tags],
        );
        await tkAudit(pool, {
          action: "timer.start",
          row_table: "tk_entries",
          row_id: rows[0].entry_id,
          after: rows[0],
          user_email: req.user.email,
        }, log);
        res.status(201).json({ ok: true, entry: rows[0] });
      } catch (e) {
        if (e.code === "23505") {
          return res.status(409).json({ ok: false, error: "timer_already_running" });
        }
        if (e.code === "23503") {
          return res.status(400).json({ ok: false, error: "project_or_task_not_found" });
        }
        throw e;
      }
    }),
  );

  router.post(
    "/api/traktime/timer/stop",
    requireUser(),
    requireDb,
    asyncHandler(async (req, res) => {
      const { rows } = await pool.query(
        `update tk_entries set stopped_at = now(), updated_at = now()
          where user_id = $1 and stopped_at is null
          returning *`,
        [req.user.id],
      );
      if (!rows.length) return res.status(404).json({ ok: false, error: "no_running_timer" });
      await tkAudit(pool, {
        action: "timer.stop",
        row_table: "tk_entries",
        row_id: rows[0].entry_id,
        after: rows[0],
        user_email: req.user.email,
      }, log);
      res.json({ ok: true, entry: rows[0] });
    }),
  );

  // ─── Entries ──────────────────────────────────────────────────────────
  router.get(
    "/api/traktime/entries",
    requireUser(),
    requireDb,
    asyncHandler(async (req, res) => {
      const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";
      const limit = Math.min(Number(req.query.limit) || 200, 1000);
      const params = [];
      let where = "1=1";
      if (!isAdmin) {
        params.push(req.user.id);
        where += ` and e.user_id = $${params.length}`;
      } else if (req.query.user_id) {
        params.push(req.query.user_id);
        where += ` and e.user_id = $${params.length}`;
      }
      if (req.query.project_id) {
        params.push(req.query.project_id);
        where += ` and e.project_id = $${params.length}`;
      }
      if (req.query.from) {
        params.push(req.query.from);
        where += ` and e.started_at >= $${params.length}`;
      }
      if (req.query.to) {
        params.push(req.query.to);
        where += ` and e.started_at < $${params.length}`;
      }
      params.push(limit);
      const { rows } = await pool.query(
        `select e.*, p.name as project_name, p.color_hex, c.name as client_name
           from tk_entries e
           join tk_projects p on p.project_id = e.project_id
           join tk_clients  c on c.client_id  = p.client_id
          where ${where}
          order by e.started_at desc
          limit $${params.length}`,
        params,
      );
      res.json({ ok: true, entries: rows });
    }),
  );

  router.post(
    "/api/traktime/entries",
    requireUser(),
    requireDb,
    asyncHandler(async (req, res) => {
      const project_id = trimOrNull(req.body?.project_id);
      const started_at = trimOrNull(req.body?.started_at);
      const stopped_at = trimOrNull(req.body?.stopped_at);
      if (!project_id || !started_at || !stopped_at) {
        return res.status(400).json({
          ok: false,
          error: "project_id_started_at_stopped_at_required",
        });
      }
      const description = trimOrNull(req.body?.description) || "";
      const task_id = trimOrNull(req.body?.task_id);
      const tags = Array.isArray(req.body?.tags) ? req.body.tags.map(String) : [];
      const billable = req.body?.billable !== false;
      try {
        const { rows } = await pool.query(
          `insert into tk_entries
             (user_id, project_id, task_id, description, started_at, stopped_at, billable, tags)
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           returning *`,
          [
            req.user.id,
            project_id,
            task_id,
            description,
            started_at,
            stopped_at,
            billable,
            tags,
          ],
        );
        await tkAudit(pool, {
          action: "entry.create",
          row_table: "tk_entries",
          row_id: rows[0].entry_id,
          after: rows[0],
          user_email: req.user.email,
        }, log);
        res.status(201).json({ ok: true, entry: rows[0] });
      } catch (e) {
        if (e.code === "23503") {
          return res.status(400).json({ ok: false, error: "project_or_task_not_found" });
        }
        throw e;
      }
    }),
  );

  router.patch(
    "/api/traktime/entries/:id",
    requireUser(),
    requireDb,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";

      const { rows: existing } = await pool.query(
        `select user_id, invoice_line_id from tk_entries where entry_id = $1`,
        [id],
      );
      if (!existing.length) return res.status(404).json({ ok: false, error: "not_found" });
      if (!isAdmin && existing[0].user_id !== req.user.id) {
        return res.status(403).json({ ok: false, error: "forbidden" });
      }
      if (existing[0].invoice_line_id) {
        return res.status(409).json({ ok: false, error: "entry_locked_by_invoice" });
      }
      // Disallow re-opening a stopped entry (would race the partial unique index).
      if (req.body && req.body.stopped_at === null) {
        return res.status(409).json({ ok: false, error: "cannot_unset_stopped_at" });
      }

      const fields = [];
      const params = [];
      let i = 1;
      for (const k of ["project_id", "task_id", "description", "started_at", "stopped_at"]) {
        if (k in (req.body || {})) {
          fields.push(`${k} = $${i++}`);
          params.push(trimOrNull(req.body[k]));
        }
      }
      if ("billable" in (req.body || {})) {
        fields.push(`billable = $${i++}`);
        params.push(!!req.body.billable);
      }
      if ("tags" in (req.body || {})) {
        fields.push(`tags = $${i++}`);
        params.push(Array.isArray(req.body.tags) ? req.body.tags.map(String) : []);
      }
      if (!fields.length) return res.status(400).json({ ok: false, error: "no_fields" });
      fields.push("updated_at = now()");
      params.push(id);
      try {
        const { rows } = await pool.query(
          `update tk_entries set ${fields.join(", ")} where entry_id = $${i} returning *`,
          params,
        );
        await tkAudit(pool, {
          action: "entry.update",
          row_table: "tk_entries",
          row_id: id,
          before: existing[0],
          after: rows[0],
          user_email: req.user.email,
        }, log);
        res.json({ ok: true, entry: rows[0] });
      } catch (e) {
        if (e.code === "23503") {
          return res.status(400).json({ ok: false, error: "project_or_task_not_found" });
        }
        throw e;
      }
    }),
  );

  router.delete(
    "/api/traktime/entries/:id",
    requireUser(),
    requireDb,
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";
      const { rows: existing } = await pool.query(
        `select user_id, invoice_line_id from tk_entries where entry_id = $1`,
        [id],
      );
      if (!existing.length) return res.status(404).json({ ok: false, error: "not_found" });
      if (!isAdmin && existing[0].user_id !== req.user.id) {
        return res.status(403).json({ ok: false, error: "forbidden" });
      }
      if (existing[0].invoice_line_id) {
        return res.status(409).json({ ok: false, error: "entry_locked_by_invoice" });
      }
      await pool.query(`delete from tk_entries where entry_id = $1`, [id]);
      await tkAudit(pool, {
        action: "entry.delete",
        row_table: "tk_entries",
        row_id: id,
        before: existing[0],
        user_email: req.user.email,
      }, log);
      res.json({ ok: true });
    }),
  );

  // ─── Reports (basic summary) ──────────────────────────────────────────
  router.get(
    "/api/traktime/reports/summary",
    requireUser(),
    requireDb,
    asyncHandler(async (req, res) => {
      const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";
      const groupBy = ["project", "user", "day"].includes(req.query.group_by)
        ? req.query.group_by
        : "project";
      const params = [];
      let where = "e.stopped_at is not null";
      if (!isAdmin) {
        params.push(req.user.id);
        where += ` and e.user_id = $${params.length}`;
      }
      if (req.query.from) {
        params.push(req.query.from);
        where += ` and e.started_at >= $${params.length}`;
      }
      if (req.query.to) {
        params.push(req.query.to);
        where += ` and e.started_at < $${params.length}`;
      }
      let select;
      if (groupBy === "project") {
        select = `p.project_id as key, p.name as label, p.color_hex,
                  coalesce(sum(e.duration_seconds), 0)::bigint as seconds`;
      } else if (groupBy === "user") {
        select = `e.user_id as key, e.user_id::text as label, '#8e8e93' as color_hex,
                  coalesce(sum(e.duration_seconds), 0)::bigint as seconds`;
      } else {
        select = `date_trunc('day', e.started_at)::date as key,
                  date_trunc('day', e.started_at)::date::text as label,
                  '#8e8e93' as color_hex,
                  coalesce(sum(e.duration_seconds), 0)::bigint as seconds`;
      }
      const { rows } = await pool.query(
        `select ${select}
           from tk_entries e
           join tk_projects p on p.project_id = e.project_id
          where ${where}
          group by 1, 2, 3
          order by seconds desc`,
        params,
      );
      res.json({ ok: true, group_by: groupBy, rows });
    }),
  );

  return router;
}
