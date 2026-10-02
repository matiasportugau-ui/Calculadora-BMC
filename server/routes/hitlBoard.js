/**
 * HITL cola live board — bidirectional bridge between the Admin. sheet
 * (SoT: WOLFB_ADMIN_SHEET_ID / tab Admin.) and the bmc-cola-hitl Vercel
 * dashboard (https://bmc-cola-hitl-matprompts-projects.vercel.app).
 *
 * Routes:
 *   GET  /api/hitl/health          — fast capability probe (no sheet read).
 *   GET  /api/hitl/board           — full actionable pending set from Admin.
 *                                    Supports If-None-Match → 304. Includes
 *                                    an ETag computed over actionable data
 *                                    (ignores generated_at) so cheap polls
 *                                    (<=60s cadence) stay cheap when nothing
 *                                    changed.
 *   GET  /api/hitl/board.json      — board.json-compat flat shape so the
 *                                    Vercel app can swap data sources without
 *                                    rewriting its UI.
 *   POST /api/hitl/row/update      — bidirectional write-back. Writes any of
 *                                    estado / respuesta / link /
 *                                    replay_snapshot_url to the Admin row.
 *                                    Admin remains book of record.
 *
 * Design notes:
 *   - Reuses the existing Google Sheets service-account path
 *     (GOOGLE_APPLICATION_CREDENTIALS) and the Admin. layout documented
 *     in server/routes/wolfboard.js. No duplicate pipeline.
 *   - Auth: `requireServiceOrUser({ role: "admin" })` — same contract as
 *     /api/wolfboard/*. In practice bmc-cola-hitl calls with Bearer
 *     API_AUTH_TOKEN; a human admin JWT also works.
 *   - CORS: dedicated allowlist via HITL_DASHBOARD_ORIGINS (CSV).
 *   - Dry-run: honours WOLFB_DRY_RUN=1 (never issues the sheet update).
 */

import { Router } from "express";
import { config } from "../config.js";
import { getSheetsClient, redactGoogleError } from "../lib/googleSheetsAuth.js";
import { requireServiceOrUser } from "../middleware/requireServiceOrUser.js";
import { sanitizeCellValue } from "../lib/sheetsCsvGuard.js";
import {
  buildHitlBoardSnapshot,
  projectBoardJsonCompat,
  validateRowUpdate,
} from "../lib/hitlAdminBoard.js";

const requireHitlRead = requireServiceOrUser({ role: "admin" });
const requireHitlWrite = requireServiceOrUser({ role: "admin" });

function parseOrigins(csv) {
  return String(csv || "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Minimal CORS middleware tied to HITL_DASHBOARD_ORIGINS (CSV). */
function hitlCors(req, res, next) {
  const origin = String(req.headers.origin || "");
  const allowed = parseOrigins(process.env.HITL_DASHBOARD_ORIGINS);
  // Always vary on Origin so caches don't cross-pollinate.
  res.setHeader("Vary", "Origin");
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, X-Api-Key, If-None-Match",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "ETag");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  return next();
}

function envMissing503(res, envVar) {
  return res.status(503).json({
    ok: false,
    code: "ENV_MISSING",
    envVar,
    error: `${envVar} not configured`,
  });
}

async function readAdminRows({ sheets, sheetId, tab }) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tab}'!A2:M`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return resp.data.values || [];
}

export function createHitlBoardRouter(cfg = config) {
  const router = Router();
  router.use(hitlCors);

  // ── GET /health ────────────────────────────────────────────────────────
  router.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "hitl-board",
      configured: {
        sheet_id: Boolean(cfg.wolfbAdminSheetId),
        tab: cfg.wolfbAdminTab || null,
        google_credentials: Boolean(
          cfg.googleApplicationCredentials ||
            process.env.GOOGLE_APPLICATION_CREDENTIALS,
        ),
        dashboard_origins: parseOrigins(process.env.HITL_DASHBOARD_ORIGINS),
        dry_run: Boolean(cfg.wolfbDryRun),
      },
    });
  });

  // ── GET /board ─────────────────────────────────────────────────────────
  router.get("/board", requireHitlRead, async (req, res) => {
    const sheetId = cfg.wolfbAdminSheetId;
    const tab = cfg.wolfbAdminTab || "Admin.";
    if (!sheetId) return envMissing503(res, "WOLFB_ADMIN_SHEET_ID");

    let sheets;
    try {
      sheets = await getSheetsClient();
    } catch (e) {
      return res.status(503).json({
        ok: false,
        error: "Sheets auth error: " + redactGoogleError(e?.message || e),
      });
    }

    let raw;
    try {
      raw = await readAdminRows({ sheets, sheetId, tab });
    } catch (e) {
      if (req.log) {
        req.log.error({ err: e?.message || String(e), sheetId, tab }, "hitl board read failed");
      }
      return res.status(503).json({ ok: false, error: "Error al leer Admin: " + (e?.message || e) });
    }

    const snapshot = buildHitlBoardSnapshot(raw, { sheetId, tab });
    const inm = req.headers["if-none-match"];
    if (inm && inm === snapshot.etag) {
      res.setHeader("ETag", snapshot.etag);
      return res.status(304).end();
    }
    res.setHeader("ETag", snapshot.etag);
    // Short cache so Vercel CDN / fetch() can coalesce bursts; dashboard
    // typically polls every 30–60s.
    res.setHeader("Cache-Control", "private, max-age=15, must-revalidate");
    return res.json(snapshot);
  });

  // ── GET /board.json (compat) ──────────────────────────────────────────
  router.get("/board.json", requireHitlRead, async (req, res) => {
    const sheetId = cfg.wolfbAdminSheetId;
    const tab = cfg.wolfbAdminTab || "Admin.";
    if (!sheetId) return envMissing503(res, "WOLFB_ADMIN_SHEET_ID");

    let sheets;
    try {
      sheets = await getSheetsClient();
    } catch (e) {
      return res.status(503).json({
        ok: false,
        error: "Sheets auth error: " + redactGoogleError(e?.message || e),
      });
    }

    let raw;
    try {
      raw = await readAdminRows({ sheets, sheetId, tab });
    } catch (e) {
      return res.status(503).json({ ok: false, error: "Error al leer Admin: " + (e?.message || e) });
    }

    const snapshot = buildHitlBoardSnapshot(raw, { sheetId, tab });
    const items = projectBoardJsonCompat(snapshot);
    return res.json({
      ok: true,
      generated_at: snapshot.generated_at,
      source: "admin",
      sheet_id: sheetId,
      tab,
      count: items.length,
      items,
    });
  });

  // ── POST /row/update ──────────────────────────────────────────────────
  router.post("/row/update", requireHitlWrite, async (req, res) => {
    const validated = validateRowUpdate(req.body || {});
    if (!validated.ok) return res.status(400).json({ ok: false, error: validated.error });

    const sheetId = cfg.wolfbAdminSheetId;
    const tab = cfg.wolfbAdminTab || "Admin.";
    if (!sheetId) return envMissing503(res, "WOLFB_ADMIN_SHEET_ID");

    const { admin_row: adminRow, patch } = validated;
    const dryRun = Boolean(cfg.wolfbDryRun) || /^(1|true|yes)$/i.test(String(req.query.dry_run || ""));

    const updates = [];
    if (patch.estado !== undefined) {
      updates.push({ range: `'${tab}'!L${adminRow}`, values: [[sanitizeCellValue(patch.estado)]] });
    }
    if (patch.respuesta !== undefined) {
      updates.push({ range: `'${tab}'!J${adminRow}`, values: [[sanitizeCellValue(patch.respuesta)]] });
    }
    if (patch.link !== undefined) {
      updates.push({ range: `'${tab}'!K${adminRow}`, values: [[sanitizeCellValue(patch.link)]] });
    }
    if (patch.replay_snapshot_url !== undefined) {
      updates.push({ range: `'${tab}'!M${adminRow}`, values: [[sanitizeCellValue(patch.replay_snapshot_url)]] });
    }

    if (dryRun) {
      return res.json({
        ok: true,
        admin_row: adminRow,
        dry_run: true,
        updates: updates.map((u) => u.range),
      });
    }

    let sheets;
    try {
      sheets = await getSheetsClient();
    } catch (e) {
      return res.status(503).json({
        ok: false,
        error: "Sheets auth error: " + redactGoogleError(e?.message || e),
      });
    }

    try {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { valueInputOption: "USER_ENTERED", data: updates },
      });
    } catch (e) {
      if (req.log) {
        req.log.error(
          { err: e?.message || String(e), sheetId, tab, adminRow },
          "hitl row update failed",
        );
      }
      return res.status(503).json({ ok: false, error: "Error al escribir en Admin: " + (e?.message || e) });
    }

    return res.json({
      ok: true,
      admin_row: adminRow,
      updated_fields: Object.keys(patch),
      updates: updates.map((u) => u.range),
    });
  });

  return router;
}

export default createHitlBoardRouter;
