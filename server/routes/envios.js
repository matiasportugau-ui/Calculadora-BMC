/**
 * BMC Envíos P2/P5 — API under /api
 * - POST /api/envios/geocode  (Nominatim proxy, Uruguay-biased)
 * - GET/PUT /api/envios/drafts[/:id]
 * - GET /api/envios/health
 */
import { Router } from "express";
import {
  getEnviosPool,
  ensureEnviosSchema,
} from "../lib/enviosDb.js";
import {
  buildGeocodeQuery,
  isValidLatLng,
  toStopGeo,
} from "../../src/utils/logistica/geocode.js";
import {
  draftIdFromEnvNo,
  parseEnviosDraftPayload,
} from "../../src/utils/logistica/enviosDraft.js";

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function requireCrmAuth(config) {
  return (req, res, next) => {
    const token = config.apiAuthToken;
    if (!token) {
      return res.status(503).json({
        ok: false,
        error: "API_AUTH_TOKEN not configured — envios API disabled",
      });
    }
    const auth = String(req.headers.authorization || "");
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const xKey = String(req.headers["x-api-key"] || req.query?.key || "");
    if (bearer === token || xKey === token) return next();
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  };
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
/** Simple process-level rate gate for Nominatim courtesy (1 req / ~1.1s). */
let lastNominatimAt = 0;

/** F11 — short-lived Ventas CSV cache (server-side gviz proxy). */
const ventasCsvCache = new Map();
const VENTAS_CSV_TTL_MS = 60_000;

/**
 * @param {import("../config.js").config} config
 * @param {import("pino").Logger} [logger]
 */
export default function createEnviosRouter(config, logger) {
  const router = Router();
  const pool = getEnviosPool(config.databaseUrl);
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

  router.get(
    "/envios/health",
    asyncHandler(async (_req, res) => {
      const out = {
        ok: true,
        module: "envios",
        geocode: true,
        draftsDb: Boolean(pool),
      };
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

  /**
   * GET /api/envios/ventas-csv?sheetId=&gid=
   * F11: server-side Google Sheets gviz proxy (avoids browser CORS / Failed to fetch).
   */
  router.get(
    "/envios/ventas-csv",
    auth,
    asyncHandler(async (req, res) => {
      const sheetId = String(req.query.sheetId || req.query.id || "").trim();
      const gid = String(req.query.gid || "0").trim();
      if (!sheetId || !/^[a-zA-Z0-9_-]{20,}$/.test(sheetId)) {
        return res.status(400).json({ ok: false, error: "invalid_sheet_id" });
      }
      const cacheKey = `${sheetId}:${gid}`;
      const hit = ventasCsvCache.get(cacheKey);
      if (hit && Date.now() - hit.at < VENTAS_CSV_TTL_MS) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("X-Envios-Cache", "HIT");
        return res.send(hit.csv);
      }

      const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(gid)}`;
      let upstream;
      try {
        upstream = await fetch(url, {
          headers: {
            Accept: "text/csv,text/plain,*/*",
            "User-Agent": "BMC-Envios/1.0 (ventas-csv-proxy)",
          },
          signal: AbortSignal.timeout(15000),
        });
      } catch (err) {
        log.warn?.({ err: err instanceof Error ? err.message : String(err) }, "[envios] ventas-csv fetch failed");
        return res.status(502).json({
          ok: false,
          error: "ventas_upstream_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
      if (!upstream.ok) {
        return res.status(502).json({
          ok: false,
          error: "ventas_upstream_status",
          status: upstream.status,
        });
      }
      const csv = await upstream.text();
      ventasCsvCache.set(cacheKey, { at: Date.now(), csv });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("X-Envios-Cache", "MISS");
      return res.send(csv);
    }),
  );

  /**
   * POST /api/envios/geocode
   * body: { address: string } | { lat, lng } (validate only)
   */
  router.post(
    "/envios/geocode",
    auth,
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      // Passthrough validation for pasted coords
      if (body.lat != null && body.lng != null) {
        const lat = Number(body.lat);
        const lng = Number(body.lng);
        if (!isValidLatLng(lat, lng)) {
          return res.status(400).json({ ok: false, error: "invalid_lat_lng" });
        }
        const geo = toStopGeo({
          lat,
          lng,
          label: body.label || body.address || "",
          source: "manual",
        });
        return res.json({ ok: true, geo, results: [geo] });
      }

      const address = String(body.address || body.q || "").trim();
      if (!address) {
        return res.status(400).json({ ok: false, error: "address_required" });
      }

      const q = buildGeocodeQuery(address);
      const now = Date.now();
      const wait = Math.max(0, 1100 - (now - lastNominatimAt));
      if (wait > 0) {
        await new Promise((r) => setTimeout(r, wait));
      }
      lastNominatimAt = Date.now();

      const url = new URL(NOMINATIM_URL);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "5");
      url.searchParams.set("countrycodes", "uy");
      url.searchParams.set("q", q);

      let upstream;
      try {
        upstream = await fetch(url.toString(), {
          headers: {
            Accept: "application/json",
            "User-Agent": "BMC-Envios/1.0 (logistica; contact=ops@bmcuruguay.com)",
          },
          signal: AbortSignal.timeout(12000),
        });
      } catch (err) {
        log.warn?.({ err: err instanceof Error ? err.message : String(err) }, "[envios] nominatim fetch failed");
        return res.status(502).json({ ok: false, error: "geocode_upstream_failed" });
      }

      if (!upstream.ok) {
        return res.status(502).json({
          ok: false,
          error: "geocode_upstream_status",
          status: upstream.status,
        });
      }

      const data = await upstream.json().catch(() => []);
      const rows = Array.isArray(data) ? data : [];
      const results = rows
        .map((r) =>
          toStopGeo({
            lat: r.lat,
            lng: r.lon,
            label: r.display_name,
            source: "nominatim",
          }),
        )
        .filter(Boolean);

      if (!results.length) {
        return res.json({ ok: true, geo: null, results: [], query: q });
      }

      res.json({ ok: true, geo: results[0], results, query: q });
    }),
  );

  /**
   * GET /api/envios/drafts — recent list
   */
  router.get(
    "/envios/drafts",
    requireDb,
    auth,
    asyncHandler(async (req, res) => {
      await ensureSchema();
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
      const { rows } = await pool.query(
        `select id, env_no, revision, updated_at, created_at, updated_by,
                (payload->>'savedAt') as saved_at,
                jsonb_array_length(coalesce(payload->'stops', '[]'::jsonb)) as stop_count
         from envios_drafts
         order by updated_at desc
         limit $1`,
        [limit],
      );
      res.json({ ok: true, drafts: rows });
    }),
  );

  /**
   * GET /api/envios/drafts/:id
   */
  router.get(
    "/envios/drafts/:id",
    requireDb,
    auth,
    asyncHandler(async (req, res) => {
      await ensureSchema();
      const id = draftIdFromEnvNo(req.params.id) || String(req.params.id || "").trim();
      if (!id) return res.status(400).json({ ok: false, error: "invalid_id" });
      const { rows } = await pool.query(
        `select id, env_no, payload, revision, updated_at, created_at, updated_by
         from envios_drafts where id = $1 limit 1`,
        [id],
      );
      if (!rows[0]) {
        return res.status(404).json({ ok: false, error: "not_found" });
      }
      const row = rows[0];
      res.json({
        ok: true,
        draft: {
          id: row.id,
          envNo: row.env_no,
          payload: row.payload,
          revision: row.revision,
          updatedAt: row.updated_at,
          createdAt: row.created_at,
          updatedBy: row.updated_by,
        },
      });
    }),
  );

  /**
   * PUT /api/envios/drafts/:id — upsert full draft
   * body: { payload, updatedBy? } or full draft state fields
   */
  router.put(
    "/envios/drafts/:id",
    requireDb,
    auth,
    asyncHandler(async (req, res) => {
      await ensureSchema();
      const idParam = draftIdFromEnvNo(req.params.id) || String(req.params.id || "").trim();
      if (!idParam) return res.status(400).json({ ok: false, error: "invalid_id" });

      const body = req.body || {};
      const rawPayload = body.payload != null ? body.payload : body;
      const parsed = parseEnviosDraftPayload(rawPayload);
      if (!parsed.ok) {
        return res.status(400).json({ ok: false, error: parsed.error });
      }
      const payload = parsed.payload;
      const envNo =
        String(payload.info?.numero || body.envNo || idParam).trim() || idParam;
      const id = draftIdFromEnvNo(envNo) || idParam;
      const updatedBy = body.updatedBy != null ? String(body.updatedBy).slice(0, 120) : null;

      const { rows } = await pool.query(
        `insert into envios_drafts (id, env_no, payload, revision, updated_by)
         values ($1, $2, $3::jsonb, 1, $4)
         on conflict (id) do update set
           env_no = excluded.env_no,
           payload = excluded.payload,
           revision = envios_drafts.revision + 1,
           updated_at = now(),
           updated_by = excluded.updated_by
         returning id, env_no, revision, updated_at, created_at, updated_by`,
        [id, envNo, JSON.stringify(payload), updatedBy],
      );
      const row = rows[0];
      res.json({
        ok: true,
        draft: {
          id: row.id,
          envNo: row.env_no,
          revision: row.revision,
          updatedAt: row.updated_at,
          createdAt: row.created_at,
          updatedBy: row.updated_by,
          stopCount: Array.isArray(payload.stops) ? payload.stops.length : 0,
        },
      });
    }),
  );

  /**
   * DELETE /api/envios/drafts/:id
   */
  router.delete(
    "/envios/drafts/:id",
    requireDb,
    auth,
    asyncHandler(async (req, res) => {
      await ensureSchema();
      const id = draftIdFromEnvNo(req.params.id) || String(req.params.id || "").trim();
      if (!id) return res.status(400).json({ ok: false, error: "invalid_id" });
      const { rowCount } = await pool.query(`delete from envios_drafts where id = $1`, [id]);
      if (!rowCount) return res.status(404).json({ ok: false, error: "not_found" });
      res.json({ ok: true, deleted: id });
    }),
  );

  return router;
}
