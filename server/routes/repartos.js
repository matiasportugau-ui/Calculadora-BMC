/**
 * BMC Coordinación de Reparto — /api/repartos/*
 * SDD: docs/sdd/bmc-envios/SDD-REPARTO-COORDINACION.md
 */
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { getEnviosPool, ensureEnviosSchema } from "../lib/enviosDb.js";
import {
  allocateRepartoNo,
  calendarDateKeyFromDb,
  repartoDateKey,
} from "../../src/utils/logistica/repartoNumber.js";
import {
  canConfirmReparto,
  normalizeRepartoStatus,
  buildRepartoPayload,
  stopSummariesForReparto,
  repartoStatusLabel,
} from "../../src/utils/logistica/repartoStatus.js";

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function requireCrmAuth(config) {
  return (req, res, next) => {
    const token = config.apiAuthToken;
    if (!token) {
      return res.status(503).json({ ok: false, error: "API_AUTH_TOKEN not configured" });
    }
    const auth = String(req.headers.authorization || "");
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const xKey = String(req.headers["x-api-key"] || req.query?.key || "");
    if (bearer === token || xKey === token) return next();
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  };
}

/**
 * @param {import("../config.js").config} config
 * @param {import("pino").Logger} [logger]
 * @param {{ pool?: import("pg").Pool | null }} [deps] optional pool override (tests)
 */
export default function createRepartosRouter(config, logger, deps = {}) {
  const router = Router();
  const pool = deps.pool !== undefined ? deps.pool : getEnviosPool(config.databaseUrl);
  const log = logger || console;
  const auth = requireCrmAuth(config);
  let schemaReady = false;

  function requireDb(_req, res, next) {
    if (!pool) {
      return res.status(503).json({ ok: false, error: "DATABASE_URL not configured" });
    }
    return next();
  }

  async function ensureSchema() {
    if (schemaReady || !pool) return;
    await ensureEnviosSchema(pool);
    schemaReady = true;
  }

  async function listRepartoNosForDay(ymd) {
    const { rows } = await pool.query(
      `select reparto_no from repartos where reparto_no like $1`,
      [`REP-${ymd}-%`],
    );
    return rows.map((r) => r.reparto_no);
  }

  async function insertEvent(repartoId, type, message, actor, meta = {}) {
    await pool.query(
      `insert into reparto_events (reparto_id, type, message, actor, meta)
       values ($1, $2, $3, $4, $5::jsonb)`,
      [repartoId, type, message || "", actor || "", JSON.stringify(meta || {})],
    );
  }

  /** GET /api/repartos/health */
  router.get(
    "/repartos/health",
    asyncHandler(async (_req, res) => {
      const out = { ok: true, module: "repartos", db: Boolean(pool) };
      if (pool) {
        try {
          await ensureSchema();
          await pool.query("select 1");
          out.db = "ok";
        } catch (err) {
          out.ok = false;
          out.db = "unreachable";
          out.error = err instanceof Error ? err.message : String(err);
          return res.status(503).json(out);
        }
      }
      res.json(out);
    }),
  );

  /** GET /api/repartos — recent list */
  router.get(
    "/repartos",
    requireDb,
    auth,
    asyncHandler(async (req, res) => {
      await ensureSchema();
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
      const status = req.query.status ? normalizeRepartoStatus(String(req.query.status)) : null;
      let q = `select id, reparto_no, status, delivery_date, truck_l, transportista, patente,
                      drive_folder_url, confirmed_at, created_at, updated_at, revision,
                      jsonb_array_length(coalesce(payload->'stops', '[]'::jsonb)) as stop_count
               from repartos`;
      const params = [];
      if (status) {
        params.push(status);
        q += ` where status = $1`;
      }
      q += ` order by updated_at desc limit $${params.length + 1}`;
      params.push(limit);
      const { rows } = await pool.query(q, params);
      res.json({
        ok: true,
        repartos: rows.map((r) => ({
          ...r,
          statusLabel: repartoStatusLabel(r.status),
        })),
      });
    }),
  );

  /** POST /api/repartos — create en_coordinacion */
  router.post(
    "/repartos",
    requireDb,
    auth,
    asyncHandler(async (req, res) => {
      await ensureSchema();
      const body = req.body || {};
      const ymd = repartoDateKey(body.deliveryDate || body.delivery_date || undefined);
      const existing = await listRepartoNosForDay(ymd);
      const repartoNo = allocateRepartoNo(existing, ymd);
      const id = String(body.id || randomUUID());
      const payload = body.payload && typeof body.payload === "object"
        ? body.payload
        : buildRepartoPayload(body);
      const actor = String(body.createdBy || body.actor || req.headers["x-user"] || "").slice(0, 120);

      await pool.query(
        `insert into repartos (
           id, reparto_no, status, delivery_date, truck_l, vehicle_label,
           transportista, patente, payload, created_by, revision
         ) values ($1,$2,'en_coordinacion',$3,$4,$5,$6,$7,$8::jsonb,$9,1)`,
        [
          id,
          repartoNo,
          ymd,
          body.truckL ?? payload.truckL ?? null,
          body.vehicleLabel || null,
          body.transportista || payload.info?.transportista || null,
          body.patente || payload.info?.patente || null,
          JSON.stringify(payload),
          actor,
        ],
      );
      await insertEvent(id, "reparto.created", `Reparto ${repartoNo} en coordinación`, actor, {
        repartoNo,
        stopCount: stopSummariesForReparto(payload.stops).length,
      });

      log.info?.({ repartoNo, id }, "[repartos] created");
      res.status(201).json({
        ok: true,
        reparto: {
          id,
          repartoNo,
          status: "en_coordinacion",
          statusLabel: repartoStatusLabel("en_coordinacion"),
          deliveryDate: ymd,
          revision: 1,
        },
      });
    }),
  );

  /** GET /api/repartos/:id */
  router.get(
    "/repartos/:id",
    requireDb,
    auth,
    asyncHandler(async (req, res) => {
      await ensureSchema();
      const id = String(req.params.id || "").trim();
      const { rows } = await pool.query(`select * from repartos where id = $1 or reparto_no = $1`, [id]);
      if (!rows.length) return res.status(404).json({ ok: false, error: "not_found" });
      const r = rows[0];
      const { rows: events } = await pool.query(
        `select id, at, actor, type, message, meta from reparto_events
         where reparto_id = $1 order by at desc limit 100`,
        [r.id],
      );
      const { rows: docs } = await pool.query(
        `select id, kind, name, drive_file_id, drive_url, stop_id, created_at
         from reparto_documents where reparto_id = $1 order by created_at desc`,
        [r.id],
      );
      res.json({
        ok: true,
        reparto: {
          ...r,
          statusLabel: repartoStatusLabel(r.status),
          stopsSummary: stopSummariesForReparto(r.payload?.stops),
        },
        events,
        documents: docs,
      });
    }),
  );

  /** PUT /api/repartos/:id — autosave while en_coordinacion */
  router.put(
    "/repartos/:id",
    requireDb,
    auth,
    asyncHandler(async (req, res) => {
      await ensureSchema();
      const id = String(req.params.id || "").trim();
      const body = req.body || {};
      const { rows } = await pool.query(`select * from repartos where id = $1 or reparto_no = $1`, [id]);
      if (!rows.length) return res.status(404).json({ ok: false, error: "not_found" });
      const cur = rows[0];
      const status = normalizeRepartoStatus(cur.status);
      if (status === "coordinado" || status === "cerrado" || status === "cancelado") {
        return res.status(409).json({
          ok: false,
          error: "immutable",
          message: "Reparto confirmado/cerrado — no se puede editar. Creá uno nuevo.",
        });
      }
      const expected = body.expectedRevision != null ? Number(body.expectedRevision) : null;
      if (expected != null && expected !== cur.revision) {
        return res.status(409).json({
          ok: false,
          error: "conflict",
          revision: cur.revision,
        });
      }
      const payload = body.payload && typeof body.payload === "object"
        ? body.payload
        : { ...(cur.payload || {}), ...buildRepartoPayload(body) };
      const nextRev = cur.revision + 1;
      await pool.query(
        `update repartos set
           payload = $2::jsonb,
           truck_l = coalesce($3, truck_l),
           transportista = coalesce($4, transportista),
           patente = coalesce($5, patente),
           vehicle_label = coalesce($6, vehicle_label),
           status = 'en_coordinacion',
           revision = $7,
           updated_at = now()
         where id = $1`,
        [
          cur.id,
          JSON.stringify(payload),
          body.truckL ?? null,
          body.transportista ?? null,
          body.patente ?? null,
          body.vehicleLabel ?? null,
          nextRev,
        ],
      );
      res.json({
        ok: true,
        id: cur.id,
        repartoNo: cur.reparto_no,
        status: "en_coordinacion",
        statusLabel: repartoStatusLabel("en_coordinacion"),
        revision: nextRev,
      });
    }),
  );

  /**
   * POST /api/repartos/:id/confirm
   * Snapshot + status coordinado. Drive tree write is best-effort (path planned in payload.drivePlan).
   */
  router.post(
    "/repartos/:id/confirm",
    requireDb,
    auth,
    asyncHandler(async (req, res) => {
      await ensureSchema();
      const id = String(req.params.id || "").trim();
      const body = req.body || {};
      const actor = String(body.actor || req.headers["x-user"] || "").slice(0, 120);
      const { rows } = await pool.query(`select * from repartos where id = $1 or reparto_no = $1`, [id]);
      if (!rows.length) return res.status(404).json({ ok: false, error: "not_found" });
      const cur = rows[0];
      // Confirmed snapshots are immutable — identity transition (coordinado→coordinado) must NOT rewrite payload.
      if (!canConfirmReparto(cur.status)) {
        return res.status(409).json({
          ok: false,
          error: "immutable",
          message: "Reparto ya confirmado/cerrado — no se puede re-confirmar. Creá uno nuevo.",
          status: normalizeRepartoStatus(cur.status),
          statusLabel: repartoStatusLabel(cur.status),
        });
      }

      // Client payload must carry expectedRevision so a stale tab cannot stamp an
      // older stops list as the immutable coordinado snapshot (Bug AU).
      const hasClientPayload = body.payload && typeof body.payload === "object";
      const expected =
        body.expectedRevision != null && body.expectedRevision !== ""
          ? Number(body.expectedRevision)
          : null;
      if (hasClientPayload && (expected == null || !Number.isFinite(expected))) {
        return res.status(400).json({
          ok: false,
          error: "expected_revision_required",
          message: "Confirm con payload requiere expectedRevision (refrescá y reintentá).",
          revision: cur.revision,
        });
      }
      if (hasClientPayload && expected !== Number(cur.revision)) {
        return res.status(409).json({
          ok: false,
          error: "conflict",
          message: "El borrador cambió en otra pestaña — recargá antes de confirmar.",
          revision: cur.revision,
        });
      }

      const payloadIn = hasClientPayload ? body.payload : cur.payload || {};
      const stops = Array.isArray(payloadIn.stops) ? payloadIn.stops : [];
      if (!stops.length) {
        return res.status(400).json({ ok: false, error: "no_stops", message: "No hay paradas para coordinar" });
      }

      // delivery_date from node-pg is a Date at UTC midnight — use calendar key, not UY wall clock
      const ymd = calendarDateKeyFromDb(cur.delivery_date) || repartoDateKey();
      const drivePlan = {
        rootEnv: "DRIVE_REPARTOS_FOLDER_ID",
        path: `_Repartos/${ymd.slice(0, 4)}/${ymd.slice(0, 7)}/${cur.reparto_no}`,
        clients: stopSummariesForReparto(stops).map((s) => ({
          orderId: s.orderId,
          cliente: s.cliente,
          legajoPath: `Clientes/${String(s.cliente || "cliente").replace(/[/\\]/g, "-")}/Entregas/${ymd}_${cur.reparto_no}`,
        })),
        note: "Drive materialization: phase 3 — path reserved in snapshot",
      };

      const confirmedAt = new Date().toISOString();
      const payload = {
        ...payloadIn,
        schema: "bmc-reparto-payload-v1",
        confirmedAt,
        stopsSummary: stopSummariesForReparto(stops),
        drivePlan,
      };

      // Soft Drive: store planned path; real upload when DRIVE_REPARTOS_FOLDER_ID wired
      const folderUrl = cur.drive_folder_url || null;

      // Atomic gate: status + optional revision (when client sends payload).
      // revision = revision + 1 avoids colliding with a concurrent PUT's nextRev.
      const params = [cur.id, JSON.stringify(payload), folderUrl];
      let where = `where id = $1 and status = 'en_coordinacion'`;
      if (hasClientPayload) {
        params.push(expected);
        where += ` and revision = $${params.length}`;
      }
      const upd = await pool.query(
        `update repartos set
           status = 'coordinado',
           payload = $2::jsonb,
           confirmed_at = now(),
           revision = revision + 1,
           updated_at = now(),
           drive_folder_url = coalesce(drive_folder_url, $3)
         ${where}
         returning id, revision, confirmed_at`,
        params,
      );
      if (!upd.rowCount) {
        // Lost race: another confirm won, or revision moved (stale payload).
        if (hasClientPayload) {
          const again = await pool.query(`select status, revision from repartos where id = $1`, [cur.id]);
          const st = normalizeRepartoStatus(again.rows[0]?.status);
          if (st === "en_coordinacion") {
            return res.status(409).json({
              ok: false,
              error: "conflict",
              message: "El borrador cambió en otra pestaña — recargá antes de confirmar.",
              revision: again.rows[0]?.revision,
            });
          }
        }
        return res.status(409).json({
          ok: false,
          error: "immutable",
          message: "Reparto ya confirmado/cerrado — no se puede re-confirmar. Creá uno nuevo.",
        });
      }
      await insertEvent(
        cur.id,
        "coordination.confirmed",
        `Coordinación confirmada · ${stops.length} parada(s) · ${cur.reparto_no}`,
        actor,
        { stopCount: stops.length, drivePlan },
      );

      log.info?.({ repartoNo: cur.reparto_no, stops: stops.length }, "[repartos] confirmed");
      res.json({
        ok: true,
        reparto: {
          id: cur.id,
          repartoNo: cur.reparto_no,
          status: "coordinado",
          statusLabel: repartoStatusLabel("coordinado"),
          revision: upd.rows[0]?.revision,
          confirmedAt: payload.confirmedAt,
          drivePlan,
          stopsSummary: payload.stopsSummary,
        },
      });
    }),
  );

  /** GET /api/repartos/:id/events */
  router.get(
    "/repartos/:id/events",
    requireDb,
    auth,
    asyncHandler(async (req, res) => {
      await ensureSchema();
      const id = String(req.params.id || "").trim();
      const { rows: r0 } = await pool.query(`select id from repartos where id = $1 or reparto_no = $1`, [id]);
      if (!r0.length) return res.status(404).json({ ok: false, error: "not_found" });
      const { rows } = await pool.query(
        `select id, at, actor, type, message, meta from reparto_events
         where reparto_id = $1 order by at desc limit 200`,
        [r0[0].id],
      );
      res.json({ ok: true, events: rows });
    }),
  );

  return router;
}
