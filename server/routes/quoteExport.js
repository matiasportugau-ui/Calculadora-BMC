// ═══════════════════════════════════════════════════════════════════════════
// quoteExport — admin export engine + per-user single-quote export.
// ───────────────────────────────────────────────────────────────────────────
// Endpoints:
//   POST /api/admin/export
//        body: { entities: [...], formats: [...], dateRange?: {from, to}, ids?: [] }
//        → application/zip with <entity>.<format> files inside
//   GET  /api/me/quotes/:id/export.csv
//   GET  /api/me/quotes/:id/export.json
//   GET  /api/me/quotes/:id/export.pdf
//
// PDF reuses server/routes/pdf.js puppeteer pipeline via internal helper —
// for now we render a minimal HTML shell server-side and attach as PDF
// through the existing /api/pdf/generate endpoint shape.
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import JSZip from "jszip";
import { config } from "../config.js";
import { getWaPool } from "../lib/waDb.js";
import { requireUser } from "../lib/identityAuth.js";
import { safeErr as _safeErr } from "../lib/safeErr.js";
import { renderHtmlToPdfBuffer, PdfRendererUnavailableError } from "../lib/quotePdf.js";
import { buildCotizacionHtml } from "./calc.js";

const router = express.Router();

const ALLOWED_ENTITIES = new Set([
  "users", "quotes", "crm_personal_contacts", "crm_personal_leads",
  "special_quote_requests", "access_requests", "audit_log",
]);
// "html" is what the admin export bundle emits today. The puppeteer-based
// PDF rendering path is a follow-up (see GOLIVE doc §"Out of scope"); until
// then, the admin tool ships HTML so the API contract isn't ambiguous.
const ALLOWED_FORMATS = new Set(["csv", "json", "html"]);

function pool() {
  const p = getWaPool(config.databaseUrl);
  if (!p) throw Object.assign(new Error("db_unavailable"), { status: 503 });
  return p;
}

// ─── Helpers ───────────────────────────────────────────────────────────

// cursor[bot] round-9 MEDIUM: CSV formula injection mitigation.
// Excel/Sheets/LibreOffice treat any cell whose first non-whitespace char is
// =, +, -, @, TAB, CR, or LF as a formula. The export bundle includes user-
// controlled fields (special_quote_requests.notes, users.name, etc.), so an
// authenticated user can submit `=HYPERLINK("https://attacker", "open")` and
// trigger payload execution when an admin opens the CSV. Standard mitigation
// (OWASP, Google Sheets docs) is to prefix the value with a single quote so
// the spreadsheet treats it as a literal string.
const CSV_FORMULA_PREFIX = /^[\s\t\r\n]*[=+\-@\t\r\n]/;

function csvEscape(v) {
  if (v == null) return "";
  let s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (CSV_FORMULA_PREFIX.test(s)) {
    s = `'${s}`; // literal single-quote prefix neutralizes formula evaluation
  }
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  }
  return lines.join("\n");
}

function dateRangeWhere(prefix = "created_at", range, paramOffset = 1) {
  if (!range || (!range.from && !range.to)) return { sql: "", params: [] };
  const conds = [];
  const params = [];
  if (range.from) { params.push(range.from); conds.push(`${prefix} >= $${paramOffset + params.length - 1}`); }
  if (range.to)   { params.push(range.to);   conds.push(`${prefix} <= $${paramOffset + params.length - 1}`); }
  return { sql: ` where ${conds.join(" and ")}`, params };
}

async function fetchEntity(entity, { ids, dateRange }) {
  const p = pool();
  switch (entity) {
    case "users": {
      const w = dateRangeWhere("created_at", dateRange);
      const { rows } = await p.query(
        `select user_id, email, name, plan_tier, status, created_at, last_login_at
           from identity.users${w.sql} order by created_at desc limit 5000`,
        w.params,
      );
      return rows;
    }
    case "quotes": {
      const params = [];
      const conds = [];
      if (ids?.length) { params.push(ids); conds.push(`quote_id = any($${params.length}::uuid[])`); }
      if (dateRange?.from) { params.push(dateRange.from); conds.push(`created_at >= $${params.length}`); }
      if (dateRange?.to)   { params.push(dateRange.to);   conds.push(`created_at <= $${params.length}`); }
      const where = conds.length ? ` where ${conds.join(" and ")}` : "";
      const { rows } = await p.query(
        `select quote_id, user_id, total_usd, total_uyu, status, pdf_url, created_at
           from identity.quotes${where} order by created_at desc limit 5000`,
        params,
      );
      return rows;
    }
    case "crm_personal_contacts": {
      const w = dateRangeWhere("created_at", dateRange);
      const { rows } = await p.query(
        `select contact_id, user_id, display_name, email, phone, company, created_at
           from identity.crm_personal_contacts${w.sql} order by created_at desc limit 5000`,
        w.params,
      );
      return rows;
    }
    case "crm_personal_leads": {
      const w = dateRangeWhere("created_at", dateRange);
      const { rows } = await p.query(
        `select lead_id, user_id, contact_id, quote_id, title, stage, value_usd, created_at
           from identity.crm_personal_leads${w.sql} order by created_at desc limit 5000`,
        w.params,
      );
      return rows;
    }
    case "special_quote_requests": {
      const w = dateRangeWhere("created_at", dateRange);
      const { rows } = await p.query(
        `select request_id, quote_id, user_id, status, notes, created_at
           from identity.special_quote_requests${w.sql} order by created_at desc limit 5000`,
        w.params,
      );
      return rows;
    }
    case "access_requests": {
      const w = dateRangeWhere("created_at", dateRange);
      const { rows } = await p.query(
        `select request_id, user_id, module, status, created_at, resolved_at
           from identity.access_requests${w.sql} order by created_at desc limit 5000`,
        w.params,
      );
      return rows;
    }
    case "audit_log": {
      const w = dateRangeWhere("at", dateRange);
      const { rows } = await p.query(
        `select audit_id, actor_user_id, action, resource, resource_id, ip, at
           from identity.audit_log${w.sql} order by at desc limit 5000`,
        w.params,
      );
      return rows;
    }
    default:
      throw Object.assign(new Error(`unsupported_entity_${entity}`), { status: 400 });
  }
}

function entityToHtmlTable(entity, rows) {
  if (!rows.length) return `<h2>${entity}</h2><p><em>(no rows)</em></p>`;
  const headers = Object.keys(rows[0]);
  const tr = (cells, tag = "td") => `<tr>${cells.map((c) => `<${tag}>${escapeHtml(c)}</${tag}>`).join("")}</tr>`;
  return `<h2>${entity} (${rows.length})</h2>
<table border="1" cellpadding="4" style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:12px">
${tr(headers, "th")}
${rows.map((r) => tr(headers.map((h) => formatCell(r[h])))).join("\n")}
</table>`;
}

function escapeHtml(v) {
  if (v == null) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatCell(v) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return v;
}

// ─── Admin multi-entity export ─────────────────────────────────────────

router.post("/api/admin/export", requireUser({ role: "admin" }), async (req, res) => {
  try {
    const { entities = [], formats = [], dateRange, ids } = req.body || {};
    if (!Array.isArray(entities) || !entities.length) {
      return res.status(400).json({ ok: false, error: "missing_entities" });
    }
    if (!Array.isArray(formats) || !formats.length) {
      return res.status(400).json({ ok: false, error: "missing_formats" });
    }
    for (const e of entities) {
      if (!ALLOWED_ENTITIES.has(e)) return res.status(400).json({ ok: false, error: `bad_entity_${e}` });
    }
    for (const f of formats) {
      if (!ALLOWED_FORMATS.has(f)) return res.status(400).json({ ok: false, error: `bad_format_${f}` });
    }

    const zip = new JSZip();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");

    for (const entity of entities) {
      const rows = await fetchEntity(entity, { ids, dateRange });
      if (formats.includes("json")) {
        zip.file(`${entity}.json`, JSON.stringify(rows, null, 2));
      }
      if (formats.includes("csv")) {
        zip.file(`${entity}.csv`, toCsv(rows));
      }
      if (formats.includes("html")) {
        zip.file(`${entity}.html`, `<!doctype html><html><body>${entityToHtmlTable(entity, rows)}</body></html>`);
      }
    }

    const buf = await zip.generateAsync({ type: "nodebuffer" });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="bmc-export-${stamp}.zip"`);
    return res.send(buf);
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// ─── Per-user single-quote export ──────────────────────────────────────

async function loadOwnedQuote(userId, quoteId) {
  const { rows } = await pool().query(
    `select quote_id, user_id, payload, total_usd, total_uyu, status, created_at, pdf_url
       from identity.quotes
      where quote_id = $1 and user_id = $2`,
    [quoteId, userId],
  );
  return rows[0] || null;
}

router.get("/api/me/quotes/:id/export.json", requireUser(), async (req, res) => {
  try {
    const q = await loadOwnedQuote(req.user.id, req.params.id);
    if (!q) return res.status(404).json({ ok: false, error: "not_found" });
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="quote-${q.quote_id}.json"`);
    res.send(JSON.stringify(q, null, 2));
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.get("/api/me/quotes/:id/export.csv", requireUser(), async (req, res) => {
  try {
    const q = await loadOwnedQuote(req.user.id, req.params.id);
    if (!q) return res.status(404).json({ ok: false, error: "not_found" });
    const flat = {
      quote_id: q.quote_id,
      total_usd: q.total_usd,
      total_uyu: q.total_uyu,
      status: q.status,
      created_at: q.created_at,
      pdf_url: q.pdf_url,
    };
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="quote-${q.quote_id}.csv"`);
    res.send(toCsv([flat]));
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// PDF: redirect to existing pdf_url if present; otherwise re-render on demand
// from the request params persisted in payload.request (calc.js writes them
// since the shared quotePdf lib landed). Rows saved before that — or via
// flows that never stored request params — still return 404 pdf_not_available.
// Defense-in-depth allowlist (cursor[bot] H-1). The lib already validates on
// write, but pre-existing rows could carry attacker-controlled URLs from
// before the allowlist landed — re-check before redirecting.
const ALLOWED_PDF_REDIRECT = /^https:\/\/(?:storage\.googleapis\.com|drive\.google\.com|[a-z0-9-]+\.run\.app)\//i;

router.get("/api/me/quotes/:id/export.pdf", requireUser(), async (req, res) => {
  try {
    const q = await loadOwnedQuote(req.user.id, req.params.id);
    if (!q) return res.status(404).json({ ok: false, error: "not_found" });
    if (q.pdf_url) {
      if (!ALLOWED_PDF_REDIRECT.test(String(q.pdf_url))) {
        return res.status(400).json({
          ok: false,
          error: "invalid_pdf_url",
          detail: "stored pdf_url failed allowlist; re-render the quote via /api/me/quotes",
        });
      }
      return res.redirect(302, q.pdf_url);
    }

    // On-demand render: rebuild the exact calc HTML and rasterize it.
    const reqParams = q.payload?.request;
    if (reqParams?.escenario) {
      const built = await buildCotizacionHtml({ ...reqParams, cliente: q.payload?.client || {} });
      if (built.ok) {
        const pdfBuffer = await renderHtmlToPdfBuffer(built.html, { timeoutMs: 30000 });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="quote-${q.quote_id}.pdf"`);
        return res.send(pdfBuffer);
      }
    }

    return res.status(404).json({
      ok: false,
      error: "pdf_not_available",
      detail: "No pdf_url stored for this quote. Use export.html for a printable HTML view.",
    });
  } catch (e) {
    if (e instanceof PdfRendererUnavailableError) {
      return res.status(503).json({
        ok: false,
        error: "pdf_renderer_unavailable",
        detail: "Server PDF rendering unavailable on this platform. Use export.html instead.",
      });
    }
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

// HTML — printable view, always works for any owned quote.
router.get("/api/me/quotes/:id/export.html", requireUser(), async (req, res) => {
  try {
    const q = await loadOwnedQuote(req.user.id, req.params.id);
    if (!q) return res.status(404).json({ ok: false, error: "not_found" });
    res.setHeader("Content-Type", "text/html");
    res.setHeader("Content-Disposition", `attachment; filename="quote-${q.quote_id}.html"`);
    res.send(`<!doctype html><html><body>${entityToHtmlTable("quote", [q])}</body></html>`);
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

export default router;

// cursor[bot] round-9 regression coverage — exposed for tests/identity-security
// (no production code path imports these names directly).
export const __test__ = { csvEscape };
