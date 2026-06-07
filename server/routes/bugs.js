/**
 * bugs.js — User bug reports from the interface.
 * Mounted at /api/bugs.
 *
 * POST /report
 *   Body: { shortDescription (req), details, severity, url, capturedAt, userAgent, context (full captureBugContext with optional screenshotDataUrl) }
 *   - Auth is SOFT/optional for /report only (to support calculator users + JWT users without cockpit token).
 *     On success row includes authMode: 'token' | 'jwt' | 'none'. Still uses requireServiceOrUser dual-mode when available.
 *   - If context.screenshotDataUrl present + bucket configured: server uploads via uploadBugScreenshotToGcs and replaces with screenshotUrl in stored context.
 *
 * GET /?limit=20&severity=alta (protected, same token as wolfboard lists)
 *   Returns lightweight summaries (full context omitted or truncated to keep responses small). Use for Wolfboard "recent bugs" list + agent tools.
 *
 * Storage: appends to BUG_REPORTS tab (create with headers once) + AUDIT_LOG sidecar (USER_BUG_REPORT).
 * Rich logs + (optional) screenshot URL stored for WOLF debugging / replay-style triage.
 */

import { Router } from "express";
import { google } from "googleapis";
import { getGoogleAuthClient } from "../lib/googleAuthCache.js";
import { sanitizeCellValue } from "../lib/sheetsCsvGuard.js";
import { uploadBugScreenshotToGcs } from "../lib/gcsUpload.js";

const SCOPE_WRITE = "https://www.googleapis.com/auth/spreadsheets";

function envMissing503(res, envVar) {
  return res.status(503).json({
    ok: false,
    code: "ENV_MISSING",
    envVar,
    error: `${envVar} not configured`,
  });
}

function requireAuth(config, req, res) {
  const expected = config.apiAuthToken;
  if (!expected) {
    return envMissing503(res, "API_AUTH_TOKEN");
  }
  const header =
    req.headers["x-api-key"] ||
    (req.headers.authorization ? String(req.headers.authorization).replace(/^Bearer\s+/i, "") : "");
  if (String(header || "") !== String(expected)) {
    res.status(401).json({ ok: false, error: "API key inválida o ausente" });
    return false;
  }
  return true;
}

async function getSheets() {
  const authClient = await getGoogleAuthClient(SCOPE_WRITE);
  return google.sheets({ version: "v4", auth: authClient });
}

function makeBugId() {
  const d = new Date();
  const stamp = d.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BUG-${stamp}-${rnd}`;
}

export function createBugsRouter(config) {
  const router = Router();

  // POST /api/bugs/report  (auth is intentionally soft/optional for this path)
  router.post("/report", async (req, res) => {
    // Soft auth: try dual-mode (token or JWT) but do not fail the report.
    // This enables pure calculator users and full BmcAuth JWT users without a cockpit token.
    let authMode = "none";
    const hasStaticToken = !!config.apiAuthToken;
    if (hasStaticToken) {
      // Use the local requireAuth (token) for backward compat with existing ops callers.
      // If it fails we still proceed (authMode=none) so reports always succeed.
      const tokenOk = requireAuth(config, req, { /* dummy res to avoid early send */ sendStatus: () => {}, status: () => ({ json: () => {} }) });
      if (tokenOk) authMode = "token";
    }
    // Note: full dual requireServiceOrUser can be layered here in future for JWT detection if headers present.
    // For now we detect presence of Authorization that is not the static one as "jwt-ish".
    const authHeader = (req.headers.authorization || req.headers["x-api-key"] || "").toString();
    if (authMode === "none" && authHeader && !authHeader.includes(config.apiAuthToken || "___")) {
      authMode = "jwt-or-other";
    }

    const {
      shortDescription = "",
      details = "",
      severity = "media",
      url = "",
      capturedAt = "",
      userAgent = "",
      context = null,
    } = req.body || {};

    if (!String(shortDescription || "").trim()) {
      return res.status(400).json({ ok: false, error: "shortDescription es requerido" });
    }

    const sheetId = config.bmcSheetId;
    if (!sheetId) {
      return envMissing503(res, "BMC_SHEET_ID");
    }

    const bugTab = process.env.BMC_BUG_REPORTS_TAB || (config && config.bugReportsTab) || "BUG_REPORTS";
    const auditTab = config.bmcAuditTab || "AUDIT_LOG";

    let sheets;
    try {
      sheets = await getSheets();
    } catch (e) {
      return res.status(503).json({ ok: false, error: "Sheets auth error: " + e.message });
    }

    const id = makeBugId();
    const now = new Date().toISOString();
    const safeShort = sanitizeCellValue(String(shortDescription).slice(0, 300));
    const safeDetails = sanitizeCellValue(String(details || "").slice(0, 2000));
    const safeUrl = sanitizeCellValue(String(url || ""));
    const safeUa = sanitizeCellValue(String(userAgent || "").slice(0, 300));
    const safeSeverity = sanitizeCellValue(String(severity || "media"));

    // Process screenshot (simple canvas capture from client) if present.
    // Upload server-side if bucket configured (reuses gcs pattern), store URL not raw base64.
    let finalContext = context ? { ...context } : {};
    if (finalContext.screenshotDataUrl && config.gcsQuotesBucket) {
      try {
        const shotFilename = `bug-${id}.jpg`;
        const shotUrl = await uploadBugScreenshotToGcs(finalContext.screenshotDataUrl, shotFilename, config.gcsQuotesBucket);
        if (shotUrl) {
          finalContext.screenshotUrl = shotUrl;
          delete finalContext.screenshotDataUrl;
        }
      } catch {
        // best-effort; keep dataUrl (will be truncated) if upload fails
      }
    }

    // Store the full context (logs + extra + optional screenshotUrl) as compact JSON.
    let contextJson = "";
    try {
      const slim = { ...finalContext };
      if (slim.logs && Array.isArray(slim.logs) && slim.logs.length > 60) {
        slim.logs = slim.logs.slice(-60);
      }
      contextJson = JSON.stringify(slim);
      if (contextJson.length > 45000) contextJson = contextJson.slice(0, 45000) + "…(truncado)";
    } catch {
      contextJson = JSON.stringify({ note: "context could not be serialized" });
    }
    const safeContext = sanitizeCellValue(contextJson);

    // Row now includes authMode and screenshot support.
    // Columns: A id, B ts, C short, D details, E sev, F url, G ua, H capturedAt, I contextJson, J status, K source, L authMode, M screenshotUrl?
    const row = [
      id,
      now,
      safeShort,
      safeDetails,
      safeSeverity,
      safeUrl,
      safeUa,
      capturedAt || now,
      safeContext,
      "nuevo",
      "api/bugs/report",
      authMode,
      finalContext.screenshotUrl || "",
    ];

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `'${bugTab}'!A:M`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] },
      });
    } catch (e) {
      const msg = String(e?.message || e);
      if (/Unable to parse range|does not exist|not found/i.test(msg)) {
        return res.status(503).json({
          ok: false,
          error: `La pestaña '${bugTab}' no existe. Creala con headers (id,timestamp,shortDescription,details,severity,url,userAgent,capturedAt,context,status,source,authMode,screenshotUrl) y reintenta.`,
        });
      }
      return res.status(503).json({ ok: false, error: "Error al escribir el reporte: " + msg });
    }

    // Sidecar to AUDIT_LOG (best effort)
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `'${auditTab}'!A:H`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[now, "USER_BUG_REPORT", id, safeShort, safeSeverity, "api", safeUrl.slice(0, 120), bugTab]],
        },
      });
    } catch {}

    return res.json({ ok: true, id, tab: bugTab, severity: safeSeverity, authMode });
  });

  // GET /api/bugs (protected list for Wolfboard recent bugs UI + agent tools)
  // Query: ?limit=20&severity=alta&routeContains=wolfboard
  router.get("/", async (req, res) => {
    if (!requireAuth(config, req, res)) return;

    const sheetId = config.bmcSheetId;
    if (!sheetId) return envMissing503(res, "BMC_SHEET_ID");

    const bugTab = process.env.BMC_BUG_REPORTS_TAB || (config && config.bugReportsTab) || "BUG_REPORTS";
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));

    let sheets;
    try { sheets = await getSheets(); } catch (e) {
      return res.status(503).json({ ok: false, error: "Sheets auth error: " + e.message });
    }

    let raw;
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${bugTab}'!A:M`,
        valueRenderOption: "FORMATTED_VALUE",
      });
      raw = resp.data.values || [];
    } catch (e) {
      return res.status(503).json({ ok: false, error: "Error leyendo BUG_REPORTS: " + e.message });
    }

    // Map (header row assumed absent or we skip first if looks like header)
    const startIdx = (raw[0] && String(raw[0][0]).toLowerCase().includes("id")) ? 1 : 0;
    let items = raw.slice(startIdx).map((r, i) => ({
      rowNum: startIdx + i + 1,
      id: String(r[0] || "").trim(),
      timestamp: String(r[1] || ""),
      shortDescription: String(r[2] || ""),
      details: String(r[3] || ""),
      severity: String(r[4] || "media"),
      url: String(r[5] || ""),
      authMode: String(r[11] || "unknown"),
      screenshotUrl: String(r[12] || ""),
      hasScreenshot: !!r[12],
    })).filter(it => it.id);

    // Simple filters
    const sev = req.query.severity ? String(req.query.severity).toLowerCase() : null;
    if (sev) items = items.filter(it => String(it.severity).toLowerCase() === sev);
    const routeQ = req.query.routeContains ? String(req.query.routeContains).toLowerCase() : null;
    if (routeQ) items = items.filter(it => (it.url || "").toLowerCase().includes(routeQ));

    // Most recent first (by timestamp string compare is good enough for ISO)
    items.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    items = items.slice(0, limit);

    return res.json({ ok: true, count: items.length, data: items });
  });

  return router;
}

export default createBugsRouter;
