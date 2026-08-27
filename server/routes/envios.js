/**
 * BMC Envíos P2/P5 — API under /api
 * - POST /api/envios/geocode  (Nominatim proxy, Uruguay-biased)
 * - POST /api/envios/route    (OSRM public driving polyline; haversine fallback)
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
import {
  matchAdminQuotes,
  normalizeAdminQuoteRow,
} from "../../src/utils/logistica/adminQuoteMatch.js";
import {
  ADJUNTO_MAX_BYTES,
  extractGoogleDriveFileId,
  fetchAdjuntoUpstream,
  readBodyWithLimit,
  resolveAdjuntoFetchUrl,
} from "../lib/enviosAdjuntoFetch.js";
import { runEnviosAiVerify } from "../lib/enviosAiVerify.js";

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
const OSRM_ROUTE_BASE =
  process.env.OSRM_ROUTE_URL || "https://router.project-osrm.org/route/v1/driving";
/** Simple process-level rate gate for Nominatim courtesy (1 req / ~1.1s). */
let lastNominatimAt = 0;
let lastOsrmAt = 0;
const osrmRouteCache = new Map();
const OSRM_CACHE_MAX = 48;
const OSRM_CACHE_TTL_MS = 10 * 60 * 1000;

function osrmCacheGet(key) {
  const hit = osrmRouteCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > OSRM_CACHE_TTL_MS) {
    osrmRouteCache.delete(key);
    return null;
  }
  return hit.payload;
}

function osrmCacheSet(key, payload) {
  osrmRouteCache.set(key, { at: Date.now(), payload });
  while (osrmRouteCache.size > OSRM_CACHE_MAX) {
    const first = osrmRouteCache.keys().next().value;
    osrmRouteCache.delete(first);
  }
}

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
   * POST /api/envios/route
   * body: { coordinates: [[lng, lat], ...] } in visit order (no TSP).
   * OSRM public driving; on failure returns provider=haversine_fallback (no invented polyline).
   */
  router.post(
    "/envios/route",
    auth,
    asyncHandler(async (req, res) => {
      const raw = req.body?.coordinates;
      if (!Array.isArray(raw) || raw.length < 2) {
        return res.status(400).json({ ok: false, error: "coordinates_required" });
      }
      if (raw.length > 25) {
        return res.status(400).json({ ok: false, error: "too_many_points" });
      }
      const coords = [];
      for (const pair of raw) {
        const lng = Number(Array.isArray(pair) ? pair[0] : pair?.lng);
        const lat = Number(Array.isArray(pair) ? pair[1] : pair?.lat);
        if (!isValidLatLng(lat, lng)) {
          return res.status(400).json({ ok: false, error: "invalid_lat_lng" });
        }
        coords.push([lng, lat]);
      }
      const cacheKey = coords.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(";");
      const cached = osrmCacheGet(cacheKey);
      if (cached) {
        return res.json({ ...cached, cached: true });
      }

      const wait = Math.max(0, 1100 - (Date.now() - lastOsrmAt));
      if (wait > 0) {
        await new Promise((r) => setTimeout(r, wait));
      }
      lastOsrmAt = Date.now();

      const path = coords.map(([lng, lat]) => `${lng},${lat}`).join(";");
      const base = String(OSRM_ROUTE_BASE).replace(/\/$/, "");
      const url = `${base}/${path}?overview=full&geometries=polyline`;

      let upstream;
      try {
        upstream = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(8000),
        });
      } catch (err) {
        log.warn?.({ err: err instanceof Error ? err.message : String(err) }, "[envios] osrm fetch failed");
        return res.json({ ok: true, provider: "haversine_fallback", error: "osrm_upstream_failed" });
      }

      if (!upstream.ok) {
        return res.json({
          ok: true,
          provider: "haversine_fallback",
          error: "osrm_status",
          status: upstream.status,
        });
      }

      const data = await upstream.json().catch(() => ({}));
      const route = data?.routes?.[0];
      if (data?.code !== "Ok" || !route?.geometry) {
        return res.json({ ok: true, provider: "haversine_fallback", error: "osrm_no_route" });
      }

      const payload = {
        ok: true,
        provider: "osrm",
        geometry: String(route.geometry),
        totalKm: Math.round((Number(route.distance) / 1000) * 10) / 10,
        totalDurationS: Number(route.duration) || null,
        legs: Array.isArray(route.legs)
          ? route.legs.map((leg) => ({
              distanceM: Number(leg.distance) || 0,
              durationS: Number(leg.duration) || 0,
            }))
          : [],
      };
      osrmCacheSet(cacheKey, payload);
      return res.json(payload);
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
   * body: { payload, updatedBy?, expectedRevision? }
   * When expectedRevision is set and row exists with different revision → 409.
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
      const expectedRevision =
        body.expectedRevision != null && body.expectedRevision !== ""
          ? Number(body.expectedRevision)
          : null;

      if (expectedRevision != null && Number.isFinite(expectedRevision)) {
        const { rows: existing } = await pool.query(
          `select id, env_no, payload, revision, updated_at, created_at, updated_by
           from envios_drafts where id = $1 limit 1`,
          [id],
        );
        if (existing[0] && Number(existing[0].revision) !== expectedRevision) {
          return res.status(409).json({
            ok: false,
            error: "revision_conflict",
            draft: {
              id: existing[0].id,
              envNo: existing[0].env_no,
              payload: existing[0].payload,
              revision: existing[0].revision,
              updatedAt: existing[0].updated_at,
              createdAt: existing[0].created_at,
              updatedBy: existing[0].updated_by,
            },
          });
        }
      }

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

  /**
   * POST /api/envios/match-quotes
   * body: { orderId?, nombre?, telefono?, quotes?: object[] }
   * If `quotes` omitted → 503 sheets_unavailable (client may pass quotes from /api/cotizaciones).
   * Pure multi-key match: pedido / nombre / teléfono.
   */
  router.post(
    "/envios/match-quotes",
    auth,
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const query = {
        orderId: body.orderId || body.pedido || "",
        nombre: body.nombre || body.cliente || "",
        telefono: body.telefono || body.tel || body.phone || "",
      };
      let quotes = Array.isArray(body.quotes) ? body.quotes : null;
      if (!quotes) {
        // Soft-degrade: Admin sheet load is owned by bmcDashboard /api/cotizaciones.
        // Callers should pass quotes when Sheets is up; we never invent credentials here.
        return res.status(503).json({
          ok: false,
          error: "quotes_required_or_sheets_unavailable",
          message:
            "Pasá body.quotes (p.ej. desde GET /api/cotizaciones) o configurá Sheets en el dashboard. Match puro listo en servidor cuando hay quotes.",
          query,
          matches: [],
          best: null,
          ambiguous: false,
          autoApply: false,
        });
      }
      const normalized = quotes.map(normalizeAdminQuoteRow).filter(Boolean);
      const result = matchAdminQuotes(query, normalized);
      res.json({
        ok: true,
        query,
        matches: result.matches.map((m) => ({
          id: m.id,
          score: m.score,
          reasons: m.reasons,
          hits: m.hits,
          quote: {
            id: m.quote.id,
            orderId: m.quote.orderId,
            nombre: m.quote.nombre,
            telefono: m.quote.telefono,
            pdfLink: m.quote.pdfLink,
          },
        })),
        best: result.best
          ? {
              id: result.best.id,
              score: result.best.score,
              reasons: result.best.reasons,
              hits: result.best.hits,
              quote: {
                id: result.best.quote.id,
                orderId: result.best.quote.orderId,
                nombre: result.best.quote.nombre,
                telefono: result.best.quote.telefono,
                pdfLink: result.best.quote.pdfLink,
              },
            }
          : null,
        ambiguous: result.ambiguous,
        autoApply: result.autoApply,
      });
    }),
  );

  /**
   * POST /api/envios/ai-verify-stop
   * body: { stop: object } — stop snapshot + optional pdfText / rawSheetText / adjuntoMeta
   * Returns structured proposal for operator to confirm (human gate). Never writes Sheets.
   */
  router.post(
    "/envios/ai-verify-stop",
    auth,
    asyncHandler(async (req, res) => {
      const stop = req.body?.stop || req.body;
      if (!stop || typeof stop !== "object") {
        return res.status(400).json({ ok: false, error: "stop_required" });
      }
      // Bound payload size (pdfText can be large)
      const pdfText = String(stop.pdfText || "").slice(0, 20_000);
      const rawSheetText = String(stop.rawSheetText || "").slice(0, 12_000);
      const slim = {
        ...stop,
        pdfText,
        rawSheetText,
        paneles: Array.isArray(stop.paneles) ? stop.paneles.slice(0, 80) : [],
        accesorios: Array.isArray(stop.accesorios) ? stop.accesorios.slice(0, 80) : [],
      };
      try {
        const result = await runEnviosAiVerify(slim);
        if (result.error === "ai_failed") {
          return res.status(502).json({
            ok: false,
            error: result.error,
            message: result.message,
            details: result.details,
            proposal: result.proposal,
            evidence: result.evidence,
          });
        }
        return res.json({
          ok: true,
          proposal: result.proposal,
          evidence: result.evidence,
          provider: result.provider || null,
          // rawPreview only in non-prod? keep short for debug
          rawPreview: result.rawPreview,
        });
      } catch (err) {
        log.warn?.(
          { err: err instanceof Error ? err.message : String(err) },
          "[envios] ai-verify-stop failed",
        );
        return res.status(502).json({
          ok: false,
          error: "ai_verify_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );

  /**
   * POST /api/envios/adjunto-fetch
   * body: { url: string }
   * Server-side fetch of Drive/Dropbox adjunto → base64 for client PDF text extract.
   * Avoids browser CORS / Failed to fetch on drive.google.com/file/d/…/view.
   * SSRF: https host allowlist only; redirects re-validated; body size capped.
   */
  router.post(
    "/envios/adjunto-fetch",
    auth,
    asyncHandler(async (req, res) => {
      const url = String(req.body?.url || req.query?.url || "").trim();
      let fetchUrl;
      try {
        fetchUrl = resolveAdjuntoFetchUrl(url);
      } catch (err) {
        const code = err?.code || "url_invalid";
        return res.status(400).json({
          ok: false,
          error: code,
          message:
            "Solo se permiten adjuntos https en Drive/Dropbox (y CDN googleusercontent en redirects).",
        });
      }

      let upstream;
      let finalFetchUrl = fetchUrl;
      try {
        const result = await fetchAdjuntoUpstream(fetchUrl);
        upstream = result.upstream;
        finalFetchUrl = result.fetchUrl;
      } catch (err) {
        const code = err?.code || "";
        if (code === "url_host_forbidden" || code === "url_https_required" || code === "url_credentials_forbidden") {
          return res.status(400).json({
            ok: false,
            error: code,
            message: "Redirect a host no permitido (SSRF guard).",
          });
        }
        if (code === "too_many_redirects" || code === "redirect_missing_location") {
          return res.status(502).json({ ok: false, error: code });
        }
        log.warn?.(
          { err: err instanceof Error ? err.message : String(err), url: fetchUrl },
          "[envios] adjunto-fetch failed",
        );
        return res.status(502).json({
          ok: false,
          error: "drive_fetch_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
      if (!upstream.ok) {
        return res.status(502).json({
          ok: false,
          error: "drive_fetch_status",
          status: upstream.status,
        });
      }

      let buf;
      try {
        buf = await readBodyWithLimit(upstream, ADJUNTO_MAX_BYTES);
      } catch (err) {
        if (err?.code === "file_too_large") {
          return res.status(413).json({
            ok: false,
            error: "file_too_large",
            maxBytes: ADJUNTO_MAX_BYTES,
          });
        }
        throw err;
      }

      const contentType = (upstream.headers.get("content-type") || "application/octet-stream").toLowerCase();
      // Google sometimes returns HTML interstitial
      const head = buf.slice(0, 20).toString("utf8");
      if (/<!doctype html|<html/i.test(head)) {
        return res.status(502).json({
          ok: false,
          error: "drive_html_interstitial",
          message: "Drive devolvió HTML (permisos o virus-scan). Compartí el PDF o usá filename ENCARGO.",
        });
      }
      res.json({
        ok: true,
        contentType,
        byteLength: buf.byteLength,
        base64: buf.toString("base64"),
        fetchUrl: finalFetchUrl,
        driveId: extractGoogleDriveFileId(url) || null,
      });
    }),
  );

  return router;
}
