/**
 * Panelin Workspace API — additive BMC-as-platform surface (ADR-008).
 * Mount: app.use(createWorkspaceRouter(config, logger))
 *
 * Does NOT modify calc/agent/hub routes. Schema: panelin_workspace.
 *
 * Error semantics: 400/401/403/404 · 503 if DB unavailable · never 500 for infra.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { requireUser } from "../lib/identityAuth.js";
import { addTrainingEntry } from "../lib/trainingKB.js";
import { getWorkspacePool, isDbConnectionError } from "../lib/workspaceDb.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_SQL_PATH = path.join(
  __dirname,
  "../../workspace-package/migrations/001_seed.sql",
);

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function trimOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/**
 * @param {import("../config.js").config} config
 * @param {import("pino").Logger} [logger]
 * @param {{ pool?: import("pg").Pool }} [deps]
 */
export default function createWorkspaceRouter(config, logger, deps = {}) {
  const router = Router();
  const pool = deps.pool ?? getWorkspacePool(config.databaseUrl);
  const log = logger || console;

  function requireDb(_req, res, next) {
    if (!pool) {
      return res.status(503).json({ ok: false, error: "DATABASE_URL not configured" });
    }
    return next();
  }

  function handleDbError(res, err, label) {
    if (isDbConnectionError(err)) {
      log.warn?.({ err }, `[workspace] ${label} db connection`);
      return res.status(503).json({ ok: false, error: "db_unreachable" });
    }
    // Missing schema/table → treat as not migrated
    if (err?.code === "42P01" || err?.code === "3F000") {
      return res.status(503).json({
        ok: false,
        error: "workspace_schema_missing",
        hint: "Run: npm run workspace:migrate",
      });
    }
    log.error?.({ err }, `[workspace] ${label}`);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }

  async function ensureSeeded() {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM panelin_workspace.workspaces`,
    );
    if (rows[0]?.n > 0) return false;
    if (!fs.existsSync(SEED_SQL_PATH)) {
      throw new Error("seed_sql_missing");
    }
    const sql = fs.readFileSync(SEED_SQL_PATH, "utf8");
    await pool.query(sql);
    return true;
  }

  async function loadState() {
    const [
      users,
      workspaces,
      projects,
      sessions,
      files,
      knowledge,
      skills,
      workflows,
      configs,
      crs,
      telemetry,
    ] = await Promise.all([
      pool.query(`SELECT id, email, display_name, role FROM panelin_workspace.ws_users ORDER BY id`),
      pool.query(`SELECT * FROM panelin_workspace.workspaces ORDER BY id`),
      pool.query(`SELECT * FROM panelin_workspace.projects ORDER BY name`),
      pool.query(`SELECT * FROM panelin_workspace.sessions ORDER BY created_at`),
      pool.query(`SELECT * FROM panelin_workspace.files ORDER BY created_at DESC`),
      pool.query(`SELECT * FROM panelin_workspace.knowledge_docs ORDER BY id`),
      pool.query(`SELECT * FROM panelin_workspace.skills ORDER BY id`),
      pool.query(`SELECT * FROM panelin_workspace.workflows ORDER BY id`),
      pool.query(`SELECT * FROM panelin_workspace.agent_configs ORDER BY id`),
      pool.query(`SELECT * FROM panelin_workspace.change_requests ORDER BY created_at DESC`),
      pool.query(`SELECT * FROM panelin_workspace.telemetry_events ORDER BY created_at DESC`),
    ]);

    const workspace = workspaces.rows[0]
      ? {
          id: workspaces.rows[0].id,
          ownerUserId: workspaces.rows[0].owner_user_id,
          name: workspaces.rows[0].name,
          agentConfigId: workspaces.rows[0].agent_config_id,
        }
      : null;

    const agentConfigRow = configs.rows[0];
    const agentConfig = agentConfigRow
      ? {
          id: agentConfigRow.id,
          systemPrompt: agentConfigRow.system_prompt,
          models: agentConfigRow.models,
          activeModel: agentConfigRow.active_model,
          apiKeysMasked: agentConfigRow.api_keys_masked,
        }
      : null;

    return {
      workspace,
      users: users.rows.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        role: u.role,
      })),
      currentUserId: users.rows.find((u) => u.role === "superadmin")?.id || users.rows[0]?.id || null,
      projects: projects.rows.map((p) => ({
        id: p.id,
        workspaceId: p.workspace_id,
        name: p.name,
        parentId: p.parent_id || undefined,
      })),
      sessions: sessions.rows.map((s) => ({
        id: s.id,
        projectId: s.project_id,
        title: s.title,
        messages: s.messages || [],
        fileIds: s.file_ids || [],
      })),
      files: files.rows.map((f) => ({
        id: f.id,
        workspaceId: f.workspace_id,
        projectId: f.project_id || undefined,
        sessionId: f.session_id || undefined,
        name: f.name,
        path: f.path,
        mime: f.mime,
        size: Number(f.size) || 0,
        createdAt: f.created_at?.toISOString?.() || f.created_at,
        status: f.status || undefined,
      })),
      knowledgeDocs: knowledge.rows.map((k) => ({
        id: k.id,
        title: k.title,
        sourceType: k.source_type,
        status: k.status,
        bmcKbId: k.bmc_kb_id || undefined,
        proposedBy: k.proposed_by || undefined,
        approvedBy: k.approved_by || undefined,
        indexedAt: k.indexed_at || undefined,
        size: k.size || undefined,
      })),
      skills: skills.rows.map((sk) => ({
        id: sk.id,
        name: sk.name,
        description: sk.description,
        enabled: sk.enabled,
        kind: sk.kind,
        status: sk.status,
        bmcToolNames: sk.bmc_tool_names || [],
        proposedBy: sk.proposed_by || undefined,
        updatedAt: sk.updated_at?.toISOString?.()?.slice(0, 10) || String(sk.updated_at).slice(0, 10),
      })),
      workflows: workflows.rows.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        steps: w.steps || [],
        version: w.version,
        status: w.status,
        lastEdited: w.last_edited,
      })),
      agentConfig,
      changeRequests: crs.rows.map((c) => ({
        id: c.id,
        type: c.type,
        title: c.title,
        description: c.description,
        status: c.status,
        diffText: c.diff_text,
        diffJson: c.diff_json,
        authorId: c.author_id,
        authorName: c.author_name,
        reviewerId: c.reviewer_id || undefined,
        createdAt: c.created_at?.toISOString?.() || c.created_at,
        reviewedAt: c.reviewed_at?.toISOString?.() || c.reviewed_at || undefined,
      })),
      telemetryEvents: telemetry.rows.map((t) => ({
        id: t.id,
        source: t.source,
        kind: t.kind,
        label: t.label,
        value: Number.isNaN(Number(t.value)) ? t.value : Number(t.value),
        status: t.status,
        sessionId: t.session_id || undefined,
        createdAt: t.created_at?.toISOString?.() || t.created_at,
      })),
    };
  }

  // ─── Health (no auth) ───────────────────────────────────────────────
  router.get(
    "/api/workspace/health",
    asyncHandler(async (_req, res) => {
      if (!pool) return res.status(503).json({ ok: false, error: "no_db" });
      try {
        await pool.query("SELECT 1 FROM panelin_workspace.workspaces LIMIT 1");
        res.json({ ok: true, schema: "panelin_workspace" });
      } catch (e) {
        if (e?.code === "42P01" || e?.code === "3F000") {
          return res.status(503).json({
            ok: false,
            error: "workspace_schema_missing",
            hint: "Run: npm run workspace:migrate",
          });
        }
        if (isDbConnectionError(e)) {
          return res.status(503).json({ ok: false, error: "db_unreachable" });
        }
        // empty table still means schema ok
        try {
          await pool.query("SELECT 1");
          return res.json({ ok: true, schema: "panelin_workspace", empty: true });
        } catch (e2) {
          return handleDbError(res, e2, "health");
        }
      }
    }),
  );

  // ─── Full state hydrate (Bearer required — Fase 2 step 5/6) ─────────
  router.get(
    "/api/workspace/state",
    requireDb,
    requireUser(),
    asyncHandler(async (req, res) => {
      try {
        const seeded = await ensureSeeded();
        const state = await loadState();
        // Prefer BMC identity subject when present
        if (req.user?.id) {
          const match = state.users.find(
            (u) =>
              u.email &&
              req.user.email &&
              String(u.email).toLowerCase() === String(req.user.email).toLowerCase(),
          );
          state.currentUserId = match?.id || state.currentUserId;
        }
        res.json({ ok: true, seeded, state });
      } catch (err) {
        return handleDbError(res, err, "state");
      }
    }),
  );

  // ─── Projects ───────────────────────────────────────────────────────
  router.get(
    "/api/workspace/projects",
    requireDb,
    requireUser(),
    asyncHandler(async (_req, res) => {
      try {
        await ensureSeeded();
        const { rows } = await pool.query(
          `SELECT id, workspace_id, name, parent_id FROM panelin_workspace.projects ORDER BY name`,
        );
        res.json({
          ok: true,
          projects: rows.map((p) => ({
            id: p.id,
            workspaceId: p.workspace_id,
            name: p.name,
            parentId: p.parent_id || undefined,
          })),
        });
      } catch (err) {
        return handleDbError(res, err, "list_projects");
      }
    }),
  );

  router.post(
    "/api/workspace/projects",
    requireDb,
    requireUser(),
    asyncHandler(async (req, res) => {
      const name = trimOrNull(req.body?.name);
      const workspaceId = trimOrNull(req.body?.workspaceId) || "ws-1";
      const parentId = trimOrNull(req.body?.parentId);
      if (!name) return res.status(400).json({ ok: false, error: "name_required" });
      const id = trimOrNull(req.body?.id) || `proj-${Date.now()}`;
      try {
        await pool.query(
          `INSERT INTO panelin_workspace.projects (id, workspace_id, name, parent_id)
           VALUES ($1, $2, $3, $4)`,
          [id, workspaceId, name, parentId],
        );
        res.status(201).json({
          ok: true,
          project: { id, workspaceId, name, parentId: parentId || undefined },
        });
      } catch (err) {
        if (err?.code === "23505") {
          return res.status(409).json({ ok: false, error: "duplicate_id" });
        }
        return handleDbError(res, err, "create_project");
      }
    }),
  );

  // ─── Sessions ───────────────────────────────────────────────────────
  router.get(
    "/api/workspace/sessions",
    requireDb,
    requireUser(),
    asyncHandler(async (req, res) => {
      try {
        await ensureSeeded();
        const projectId = trimOrNull(req.query.projectId);
        const q = projectId
          ? [
              `SELECT * FROM panelin_workspace.sessions WHERE project_id = $1 ORDER BY created_at`,
              [projectId],
            ]
          : [`SELECT * FROM panelin_workspace.sessions ORDER BY created_at`, []];
        const { rows } = await pool.query(q[0], q[1]);
        res.json({
          ok: true,
          sessions: rows.map((s) => ({
            id: s.id,
            projectId: s.project_id,
            title: s.title,
            messages: s.messages || [],
            fileIds: s.file_ids || [],
          })),
        });
      } catch (err) {
        return handleDbError(res, err, "list_sessions");
      }
    }),
  );

  router.post(
    "/api/workspace/sessions",
    requireDb,
    requireUser(),
    asyncHandler(async (req, res) => {
      const projectId = trimOrNull(req.body?.projectId);
      const title = trimOrNull(req.body?.title);
      if (!projectId || !title) {
        return res.status(400).json({ ok: false, error: "projectId_and_title_required" });
      }
      const id = trimOrNull(req.body?.id) || `sess-${Date.now()}`;
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const fileIds = Array.isArray(req.body?.fileIds) ? req.body.fileIds : [];
      try {
        await pool.query(
          `INSERT INTO panelin_workspace.sessions (id, project_id, title, messages, file_ids)
           VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
          [id, projectId, title, JSON.stringify(messages), JSON.stringify(fileIds)],
        );
        res.status(201).json({
          ok: true,
          session: { id, projectId, title, messages, fileIds },
        });
      } catch (err) {
        if (err?.code === "23503") {
          return res.status(400).json({ ok: false, error: "invalid_project" });
        }
        return handleDbError(res, err, "create_session");
      }
    }),
  );

  router.patch(
    "/api/workspace/sessions/:id",
    requireDb,
    requireUser(),
    asyncHandler(async (req, res) => {
      const id = req.params.id;
      const sets = [];
      const vals = [];
      let i = 1;
      if (req.body?.title !== undefined) {
        sets.push(`title = $${i++}`);
        vals.push(String(req.body.title));
      }
      if (req.body?.projectId !== undefined) {
        sets.push(`project_id = $${i++}`);
        vals.push(String(req.body.projectId));
      }
      if (req.body?.messages !== undefined) {
        sets.push(`messages = $${i++}::jsonb`);
        vals.push(JSON.stringify(req.body.messages));
      }
      if (req.body?.fileIds !== undefined) {
        sets.push(`file_ids = $${i++}::jsonb`);
        vals.push(JSON.stringify(req.body.fileIds));
      }
      if (!sets.length) return res.status(400).json({ ok: false, error: "no_fields" });
      vals.push(id);
      try {
        const { rowCount } = await pool.query(
          `UPDATE panelin_workspace.sessions SET ${sets.join(", ")} WHERE id = $${i}`,
          vals,
        );
        if (!rowCount) return res.status(404).json({ ok: false, error: "not_found" });
        res.json({ ok: true, id });
      } catch (err) {
        return handleDbError(res, err, "patch_session");
      }
    }),
  );

  // ─── Files ──────────────────────────────────────────────────────────
  router.get(
    "/api/workspace/files",
    requireDb,
    requireUser(),
    asyncHandler(async (req, res) => {
      try {
        await ensureSeeded();
        const workspaceId = trimOrNull(req.query.workspaceId) || "ws-1";
        const { rows } = await pool.query(
          `SELECT * FROM panelin_workspace.files WHERE workspace_id = $1 ORDER BY created_at DESC`,
          [workspaceId],
        );
        res.json({
          ok: true,
          files: rows.map((f) => ({
            id: f.id,
            workspaceId: f.workspace_id,
            projectId: f.project_id || undefined,
            sessionId: f.session_id || undefined,
            name: f.name,
            path: f.path,
            mime: f.mime,
            size: Number(f.size) || 0,
            createdAt: f.created_at?.toISOString?.() || f.created_at,
            status: f.status || undefined,
          })),
        });
      } catch (err) {
        return handleDbError(res, err, "list_files");
      }
    }),
  );

  router.post(
    "/api/workspace/files",
    requireDb,
    requireUser(),
    asyncHandler(async (req, res) => {
      const workspaceId = trimOrNull(req.body?.workspaceId) || "ws-1";
      const name = trimOrNull(req.body?.name);
      const filePath = trimOrNull(req.body?.path);
      const mime = trimOrNull(req.body?.mime) || "application/octet-stream";
      if (!name || !filePath) {
        return res.status(400).json({ ok: false, error: "name_and_path_required" });
      }
      const id = trimOrNull(req.body?.id) || `file-${Date.now()}`;
      const size = Number(req.body?.size) || 0;
      const projectId = trimOrNull(req.body?.projectId);
      const sessionId = trimOrNull(req.body?.sessionId);
      const status = trimOrNull(req.body?.status);
      try {
        await pool.query(
          `INSERT INTO panelin_workspace.files
             (id, workspace_id, project_id, session_id, name, path, mime, size, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [id, workspaceId, projectId, sessionId, name, filePath, mime, size, status],
        );
        res.status(201).json({
          ok: true,
          file: {
            id,
            workspaceId,
            projectId: projectId || undefined,
            sessionId: sessionId || undefined,
            name,
            path: filePath,
            mime,
            size,
            status: status || undefined,
            createdAt: new Date().toISOString(),
          },
        });
      } catch (err) {
        return handleDbError(res, err, "create_file");
      }
    }),
  );

  // ─── Change requests → training KB (in-process; step 10) ─────────────
  router.post(
    "/api/workspace/change-requests/:id/approve",
    requireDb,
    requireUser({ role: "superadmin" }),
    asyncHandler(async (req, res) => {
      const id = String(req.params.id || "").trim();
      if (!id) return res.status(400).json({ ok: false, error: "id_required" });
      try {
        const { rows } = await pool.query(
          `SELECT * FROM panelin_workspace.change_requests WHERE id = $1`,
          [id],
        );
        const cr = rows[0];
        if (!cr) return res.status(404).json({ ok: false, error: "not_found" });
        if (cr.status === "approved") {
          return res.json({ ok: true, id, status: "approved", already: true });
        }
        if (cr.status === "rejected") {
          return res.status(409).json({ ok: false, error: "already_rejected" });
        }

        let bmcKbId = null;
        if (cr.type === "knowledge") {
          let question = String(cr.title || "").trim();
          let goodAnswer = String(cr.description || cr.diff_text || "").trim();
          try {
            const parsed = JSON.parse(cr.diff_json || "{}");
            if (parsed?.add?.title) question = String(parsed.add.title);
            if (parsed?.question) question = String(parsed.question);
            if (parsed?.goodAnswer || parsed?.answer) {
              goodAnswer = String(parsed.goodAnswer || parsed.answer);
            }
          } catch {
            /* keep title/description */
          }
          if (!goodAnswer) goodAnswer = String(cr.diff_text || cr.title).trim();
          const entry = addTrainingEntry({
            category: "general",
            question,
            goodAnswer,
            context: `workspace_cr:${id}`,
            source: "panelin_workspace",
            permanent: true,
            status: "active",
          });
          bmcKbId = entry.id;
          await pool.query(
            `INSERT INTO panelin_workspace.knowledge_docs
               (id, workspace_id, title, source_type, status, bmc_kb_id, indexed_at, size, proposed_by, approved_by)
             VALUES ($1, $2, $3, 'PDF', 'indexed', $4, $5, '—', $6, $7)
             ON CONFLICT (id) DO UPDATE SET
               status = 'indexed',
               bmc_kb_id = EXCLUDED.bmc_kb_id,
               indexed_at = EXCLUDED.indexed_at,
               approved_by = EXCLUDED.approved_by`,
            [
              `kb-cr-${id}`,
              cr.workspace_id,
              question,
              bmcKbId,
              new Date().toISOString().slice(0, 10),
              cr.author_name,
              req.user?.email || req.user?.name || "superadmin",
            ],
          );
        }

        const reviewerId = req.user?.id || "bmc-superadmin";
        await pool.query(
          `UPDATE panelin_workspace.change_requests
             SET status = 'approved', reviewer_id = $2, reviewed_at = now()
           WHERE id = $1`,
          [id, reviewerId],
        );

        await pool.query(
          `INSERT INTO panelin_workspace.telemetry_events
             (id, workspace_id, source, kind, label, value, status, session_id)
           VALUES ($1, $2, 'workspace', 'fix', $3, '1', 'completed', NULL)
           ON CONFLICT (id) DO NOTHING`,
          [
            `tel-cr-approve-${id}-${Date.now()}`,
            cr.workspace_id,
            `CR approved: ${cr.title}`.slice(0, 200),
          ],
        );

        res.json({ ok: true, id, status: "approved", bmcKbId });
      } catch (err) {
        if (err?.message?.includes("question and goodAnswer")) {
          return res.status(400).json({ ok: false, error: "kb_payload_invalid", detail: err.message });
        }
        return handleDbError(res, err, "approve_cr");
      }
    }),
  );

  router.post(
    "/api/workspace/change-requests/:id/reject",
    requireDb,
    requireUser({ role: "superadmin" }),
    asyncHandler(async (req, res) => {
      const id = String(req.params.id || "").trim();
      if (!id) return res.status(400).json({ ok: false, error: "id_required" });
      try {
        const { rows } = await pool.query(
          `SELECT id, status, workspace_id, title FROM panelin_workspace.change_requests WHERE id = $1`,
          [id],
        );
        const cr = rows[0];
        if (!cr) return res.status(404).json({ ok: false, error: "not_found" });
        if (cr.status === "rejected") {
          return res.json({ ok: true, id, status: "rejected", already: true });
        }
        if (cr.status === "approved") {
          return res.status(409).json({ ok: false, error: "already_approved" });
        }
        const reviewerId = req.user?.id || "bmc-superadmin";
        await pool.query(
          `UPDATE panelin_workspace.change_requests
             SET status = 'rejected', reviewer_id = $2, reviewed_at = now()
           WHERE id = $1`,
          [id, reviewerId],
        );
        res.json({ ok: true, id, status: "rejected" });
      } catch (err) {
        return handleDbError(res, err, "reject_cr");
      }
    }),
  );

  // ─── Telemetry ingest (minimal merge — step 11) ─────────────────────
  router.post(
    "/api/workspace/telemetry",
    requireDb,
    requireUser(),
    asyncHandler(async (req, res) => {
      const workspaceId = trimOrNull(req.body?.workspaceId) || "ws-1";
      const source = trimOrNull(req.body?.source) || "workspace";
      const kind = trimOrNull(req.body?.kind) || "improvement";
      const label = trimOrNull(req.body?.label);
      const value = req.body?.value != null ? String(req.body.value) : "1";
      const status = trimOrNull(req.body?.status) || "completed";
      const sessionId = trimOrNull(req.body?.sessionId);
      if (!label) return res.status(400).json({ ok: false, error: "label_required" });
      if (!["calc", "agent", "workspace"].includes(source)) {
        return res.status(400).json({ ok: false, error: "invalid_source" });
      }
      if (!["error", "fix", "improvement", "patch"].includes(kind)) {
        return res.status(400).json({ ok: false, error: "invalid_kind" });
      }
      const id = trimOrNull(req.body?.id) || `tel-${Date.now()}`;
      try {
        await pool.query(
          `INSERT INTO panelin_workspace.telemetry_events
             (id, workspace_id, source, kind, label, value, status, session_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (id) DO UPDATE SET
             label = EXCLUDED.label,
             value = EXCLUDED.value,
             status = EXCLUDED.status`,
          [id, workspaceId, source, kind, label, value, status, sessionId],
        );
        res.status(201).json({ ok: true, id });
      } catch (err) {
        return handleDbError(res, err, "telemetry_ingest");
      }
    }),
  );

  return router;
}
