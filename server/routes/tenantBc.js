// Tenant HTTP:
//   GET  /api/me/tenant
//   GET  /api/me/tenant/quotes          owner: all tenant quotes (sale-only)
//   POST /api/me/tenant/members         owner invites { email, role? }
//   GET  /api/me/tenant/members
//   GET  /api/admin/tenants             BMC fleet
//   GET  /api/admin/tenants/:slug       BMC admin: members + counts
//   PATCH /api/admin/tenants/:slug      pause / resume
//   GET  /api/admin/tenants/:slug/quotes
//   GET  /api/admin/tenants/:slug/stats
//   GET  /api/admin/tenants/:slug/analytics
//   GET  /api/admin/tenants/:slug/funnel
//   GET  /api/admin/tenants/:slug/live
//   GET  /api/admin/tenants/:slug/sessions
//   GET  /api/admin/tenants/:slug/export
//   POST /api/admin/tenants/:slug/members
//   DELETE /api/admin/tenants/:slug/members

import express from "express";
import rateLimit from "express-rate-limit";
import { getWaPool } from "../lib/waDb.js";
import { config } from "../config.js";
import { requireUser } from "../lib/identityAuth.js";
import { tenantSlugFromRequest, tenantSiloDecision } from "../../src/utils/tenantAccess.js";
import { safeErr as _safeErr } from "../lib/safeErr.js";
import {
  getMembership,
  getTenantBySlug,
  inviteMember,
  listMembers,
  listTenantQuotes,
  saleCopyOfQuote,
  getTenantQuote,
  attachQuoteToBcTenant,
  takeNextTenantCode,
  toSalePayload,
} from "../lib/tenantBc.js";
import {
  isTenantClientAction,
  listTenantActivity,
  recordTenantActivity,
} from "../lib/tenantActivity.js";
import {
  assertTenantWritable,
  buildTenantExport,
  getTenantMonitorStats,
  isTenantPaused,
  listTenantsWithStats,
  quotesToCsv,
  revokeMember,
  setTenantStatus,
  tenantSiteUrl,
  tenantStatusOf,
} from "../lib/tenantControl.js";
import {
  getTenantAnalytics,
  getTenantFunnel,
  getTenantLive,
  getTenantSessions,
  parseRange,
} from "../lib/tenantAnalytics.js";
import {
  conversationsToCsv,
  getTenantAiStats,
  getTenantConversation,
  listTenantConversations,
} from "../lib/tenantAgentEval.js";
import { agentIdentity } from "../../src/config/whitelabel.js";
import { upsertQuote, getMyQuote } from "../lib/quoteStore.js";

const router = express.Router();

let _testPool = null;
function pool() {
  if (_testPool) return _testPool;
  const p = getWaPool(config.databaseUrl);
  if (!p) throw Object.assign(new Error("db_unavailable"), { status: 503 });
  return p;
}

export const __test__ = {
  setPool(p) { _testPool = p; },
  reset() { _testPool = null; },
};

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

function isBmcAdmin(user) {
  const roles = user?.roles || (user?.role ? [user.role] : []);
  return roles.includes("admin") || roles.includes("superadmin") || user?.role === "admin" || user?.role === "superadmin";
}

router.get("/api/me/tenant", requireUser(), async (req, res) => {
  try {
    const mem = await getMembership(pool(), req.user.id);
    if (!mem) return res.json({ ok: true, tenant: null });
    res.json({
      ok: true,
      tenant: {
        slug: mem.slug,
        display_name: mem.display_name,
        legal_name: mem.legal_name,
        role: mem.role,
        branding: mem.branding,
        status: tenantStatusOf(mem),
        cost_visible: false,
        commission_enabled: false,
      },
    });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.get("/api/me/tenant/members", requireUser(), async (req, res) => {
  try {
    const mem = await getMembership(pool(), req.user.id);
    if (!mem) return res.status(403).json({ ok: false, error: "not_tenant_member" });
    const items = await listMembers(pool(), mem.tenant_id);
    res.json({ ok: true, items });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.post("/api/me/tenant/members", requireUser(), writeLimiter, async (req, res) => {
  try {
    const mem = await getMembership(pool(), req.user.id);
    if (!mem || mem.role !== "owner") {
      return res.status(403).json({ ok: false, error: "owner_required" });
    }
    assertTenantWritable(mem);
    const row = await inviteMember(pool(), {
      tenantId: mem.tenant_id,
      email: req.body?.email,
      role: req.body?.role === "owner" ? "owner" : "user",
      invitedBy: req.user.id,
    });
    await recordTenantActivity({
      pool: pool(),
      actorId: req.user.id,
      sessionId: req.user.sessionId,
      action: "tenant.member.invite",
      resourceType: "tenant_member",
      resourceId: row.invited_email,
      payload: { role: row.role, email: row.invited_email },
      req,
    });
    res.json({ ok: true, member: row });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.get("/api/me/tenant/quotes/:id", requireUser(), async (req, res) => {
  try {
    const mem = await getMembership(pool(), req.user.id);
    if (!mem || mem.role !== "owner") {
      const own = await getMyQuote({ userId: req.user.id, quoteId: req.params.id });
      if (!own) return res.status(404).json({ ok: false, error: "not_found" });
      return res.json({ ok: true, quote: saleCopyOfQuote({ ...own, user_email: req.user.email }) });
    }
    const row = await getTenantQuote(pool(), { tenantId: mem.tenant_id, quoteId: req.params.id });
    if (!row) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, quote: saleCopyOfQuote(row) });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.get("/api/me/tenant/quotes", requireUser(), async (req, res) => {
  try {
    const mem = await getMembership(pool(), req.user.id);
    if (!mem) return res.status(403).json({ ok: false, error: "not_tenant_member" });
    if (mem.role !== "owner") {
      return res.status(403).json({ ok: false, error: "owner_required" });
    }
    const rows = await listTenantQuotes(pool(), { tenantId: mem.tenant_id, limit: req.query.limit });
    res.json({ ok: true, items: rows.map(saleCopyOfQuote) });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.get("/api/admin/tenants", requireUser({ role: "admin" }), async (req, res) => {
  try {
    const items = await listTenantsWithStats(pool());
    res.json({
      ok: true,
      items,
      summary: {
        tenants: items.length,
        active: items.filter((t) => t.status === "active").length,
        paused: items.filter((t) => t.status === "paused").length,
        quotes: items.reduce((s, t) => s + t.quote_count, 0),
        quote_usd: items.reduce((s, t) => s + t.quote_usd, 0),
      },
    });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.get("/api/admin/tenants/:slug", requireUser({ role: "admin" }), async (req, res) => {
  try {
    const tenant = await getTenantBySlug(pool(), req.params.slug);
    if (!tenant) return res.status(404).json({ ok: false, error: "tenant_not_found" });
    const members = await listMembers(pool(), tenant.tenant_id);
    const quotes = await listTenantQuotes(pool(), { tenantId: tenant.tenant_id, limit: 5 });
    const stats = await getTenantMonitorStats(pool(), {
      tenantId: tenant.tenant_id,
      slug: tenant.slug,
    });
    res.json({
      ok: true,
      tenant: {
        slug: tenant.slug,
        display_name: tenant.display_name,
        legal_name: tenant.legal_name,
        status: tenantStatusOf(tenant),
        site: tenantSiteUrl(tenant.slug, tenant.branding),
        branding: tenant.branding || {},
        member_count: members.length,
        quote_count_sample: quotes.length,
        cost_visible: false,
        commission_enabled: false,
      },
      members,
      stats,
    });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.patch("/api/admin/tenants/:slug", requireUser({ role: "admin" }), writeLimiter, async (req, res) => {
  try {
    if (!isBmcAdmin(req.user)) {
      return res.status(403).json({ ok: false, error: "admin_required" });
    }
    const status = req.body?.status;
    if (status !== "active" && status !== "paused") {
      return res.status(400).json({ ok: false, error: "invalid_status" });
    }
    const row = await setTenantStatus(pool(), req.params.slug, status);
    if (!row) return res.status(404).json({ ok: false, error: "tenant_not_found" });
    await recordTenantActivity({
      pool: pool(),
      actorId: req.user.id,
      sessionId: req.user.sessionId,
      action: status === "paused" ? "tenant.control.pause" : "tenant.control.resume",
      resourceType: "tenant",
      resourceId: row.slug,
      payload: { tenant: row.slug, status, by: "bmc" },
      req,
    });
    res.json({ ok: true, tenant: { ...row, status: tenantStatusOf(row) } });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.delete("/api/admin/tenants/:slug/members", requireUser({ role: "admin" }), writeLimiter, async (req, res) => {
  try {
    if (!isBmcAdmin(req.user)) {
      return res.status(403).json({ ok: false, error: "admin_required" });
    }
    const tenant = await getTenantBySlug(pool(), req.params.slug);
    if (!tenant) return res.status(404).json({ ok: false, error: "tenant_not_found" });
    const member = await revokeMember(pool(), {
      tenantId: tenant.tenant_id,
      email: req.body?.email || req.query?.email,
    });
    await recordTenantActivity({
      pool: pool(),
      actorId: req.user.id,
      sessionId: req.user.sessionId,
      action: "tenant.member.revoke",
      resourceType: "tenant_member",
      resourceId: member.invited_email,
      payload: { tenant: tenant.slug, email: member.invited_email, role: member.role, by: "bmc" },
      req,
    });
    res.json({ ok: true, member });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.get("/api/admin/tenants/:slug/analytics", requireUser({ role: "admin" }), async (req, res) => {
  try {
    const tenant = await getTenantBySlug(pool(), req.params.slug);
    if (!tenant) return res.status(404).json({ ok: false, error: "tenant_not_found" });
    const { from, to } = parseRange(req.query);
    const analytics = await getTenantAnalytics(pool(), { slug: tenant.slug, from, to });
    res.json({ ok: true, slug: tenant.slug, ...analytics });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.get("/api/admin/tenants/:slug/funnel", requireUser({ role: "admin" }), async (req, res) => {
  try {
    const tenant = await getTenantBySlug(pool(), req.params.slug);
    if (!tenant) return res.status(404).json({ ok: false, error: "tenant_not_found" });
    const { from, to } = parseRange(req.query);
    const funnel = await getTenantFunnel(pool(), { slug: tenant.slug, from, to });
    res.json({ ok: true, slug: tenant.slug, ...funnel });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.get("/api/admin/tenants/:slug/live", requireUser({ role: "admin" }), async (req, res) => {
  try {
    const tenant = await getTenantBySlug(pool(), req.params.slug);
    if (!tenant) return res.status(404).json({ ok: false, error: "tenant_not_found" });
    const live = await getTenantLive(pool(), { slug: tenant.slug });
    res.json({ ok: true, slug: tenant.slug, ...live });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.get("/api/admin/tenants/:slug/sessions", requireUser({ role: "admin" }), async (req, res) => {
  try {
    const tenant = await getTenantBySlug(pool(), req.params.slug);
    if (!tenant) return res.status(404).json({ ok: false, error: "tenant_not_found" });
    const to = req.query.to ? new Date(String(req.query.to)).toISOString() : new Date().toISOString();
    const from = req.query.from
      ? new Date(String(req.query.from)).toISOString()
      : new Date(Date.now() - 30 * 86_400_000).toISOString();
    const sessions = await getTenantSessions(pool(), {
      slug: tenant.slug,
      from,
      to,
    });
    res.json({ ok: true, slug: tenant.slug, ...sessions });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.get("/api/admin/tenants/:slug/stats", requireUser({ role: "admin" }), async (req, res) => {
  try {
    const tenant = await getTenantBySlug(pool(), req.params.slug);
    if (!tenant) return res.status(404).json({ ok: false, error: "tenant_not_found" });
    const stats = await getTenantMonitorStats(pool(), {
      tenantId: tenant.tenant_id,
      slug: tenant.slug,
    });
    res.json({ ok: true, stats });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.get("/api/admin/tenants/:slug/export", requireUser({ role: "admin" }), async (req, res) => {
  try {
    const tenant = await getTenantBySlug(pool(), req.params.slug);
    if (!tenant) return res.status(404).json({ ok: false, error: "tenant_not_found" });
    const bundle = await buildTenantExport(pool(), { tenant, limit: req.query.limit });
    await recordTenantActivity({
      pool: pool(),
      actorId: req.user.id,
      sessionId: req.user.sessionId,
      action: "tenant.export",
      resourceType: "tenant",
      resourceId: tenant.slug,
      payload: { tenant: tenant.slug, format: req.query.format || "json" },
      req,
    });
    if (String(req.query.format || "") === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${tenant.slug}-quotes.csv"`,
      );
      return res.send(quotesToCsv(bundle.quotes));
    }
    if (String(req.query.format || "") === "conversations-csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${tenant.slug}-conversations.csv"`,
      );
      return res.send(conversationsToCsv(bundle.conversations));
    }
    res.json({ ok: true, ...bundle });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.get("/api/admin/tenants/:slug/quotes", requireUser({ role: "admin" }), async (req, res) => {
  try {
    const tenant = await getTenantBySlug(pool(), req.params.slug);
    if (!tenant) return res.status(404).json({ ok: false, error: "tenant_not_found" });
    const rows = await listTenantQuotes(pool(), { tenantId: tenant.tenant_id, limit: req.query.limit });
    res.json({ ok: true, items: rows.map(saleCopyOfQuote) });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.post("/api/admin/tenants/:slug/members", requireUser({ role: "admin" }), writeLimiter, async (req, res) => {
  try {
    if (!isBmcAdmin(req.user)) {
      return res.status(403).json({ ok: false, error: "admin_required" });
    }
    const tenant = await getTenantBySlug(pool(), req.params.slug);
    if (!tenant) return res.status(404).json({ ok: false, error: "tenant_not_found" });
    const row = await inviteMember(pool(), {
      tenantId: tenant.tenant_id,
      email: req.body?.email,
      role: req.body?.role === "user" ? "user" : "owner",
      invitedBy: req.user.id,
    });
    await recordTenantActivity({
      pool: pool(),
      actorId: req.user.id,
      sessionId: req.user.sessionId,
      action: "tenant.member.invite",
      resourceType: "tenant_member",
      resourceId: row.invited_email,
      payload: { role: row.role, email: row.invited_email, by: "bmc" },
      req,
    });
    res.json({ ok: true, member: row });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/api/admin/tenants/:slug/ai-stats", requireUser({ role: "admin" }), async (req, res) => {
  try {
    const tenant = await getTenantBySlug(pool(), req.params.slug);
    if (!tenant) return res.status(404).json({ ok: false, error: "tenant_not_found" });
    const stats = await getTenantAiStats(pool(), {
      slug: tenant.slug,
      days: req.query.days,
    });
    res.json({ ok: true, agent_name: agentIdentity(tenant.slug).name, stats });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.get("/api/admin/tenants/:slug/conversations/:id", requireUser({ role: "admin" }), async (req, res) => {
  try {
    const tenant = await getTenantBySlug(pool(), req.params.slug);
    if (!tenant) return res.status(404).json({ ok: false, error: "tenant_not_found" });
    const conv = await getTenantConversation(pool(), {
      slug: tenant.slug,
      conversationId: req.params.id,
    });
    if (!conv) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, conversation: conv });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.get("/api/admin/tenants/:slug/conversations", requireUser({ role: "admin" }), async (req, res) => {
  try {
    const tenant = await getTenantBySlug(pool(), req.params.slug);
    if (!tenant) return res.status(404).json({ ok: false, error: "tenant_not_found" });
    const items = await listTenantConversations(pool(), {
      slug: tenant.slug,
      days: req.query.days,
      limit: req.query.limit,
    });
    res.json({
      ok: true,
      agent_name: agentIdentity(tenant.slug).name,
      items,
    });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.get("/api/admin/tenants/:slug/activity", requireUser({ role: "admin" }), async (req, res) => {
  try {
    const tenant = await getTenantBySlug(pool(), req.params.slug);
    if (!tenant) return res.status(404).json({ ok: false, error: "tenant_not_found" });
    const items = await listTenantActivity(pool(), {
      tenantId: tenant.tenant_id,
      slug: tenant.slug,
      limit: req.query.limit,
    });
    res.json({ ok: true, items });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.post("/bc-telemetry", publicLimiter, async (req, res) => {
  try {
    const tenantSlug = tenantSlugFromRequest(req);
    if (!tenantSlug) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }
    const action = String(req.body?.action || "");
    if (!isTenantClientAction(action)) {
      return res.status(400).json({ ok: false, error: "unknown_action" });
    }
    await recordTenantActivity({
      pool: pool(),
      action,
      resourceType: typeof req.body?.resource_type === "string" ? req.body.resource_type : undefined,
      resourceId: typeof req.body?.resource_id === "string" ? req.body.resource_id : undefined,
      payload: req.body?.payload && typeof req.body.payload === "object" ? req.body.payload : {},
      req,
      clientEmitted: true,
    });
    res.status(202).json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

router.post("/api/public/bc-quotes", publicLimiter, requireUser({ optional: true }), async (req, res) => {
  try {
    const tenantSlug = tenantSlugFromRequest(req);
    if (!tenantSlug) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }
    const member = req.user?.id ? await getMembership(pool(), req.user.id) : null;
    const silo = tenantSiloDecision({ slug: tenantSlug, user: req.user, member });
    if (!silo.ok) {
      return res.status(silo.status).json({ ok: false, error: silo.error });
    }
    const tenantRow = await getTenantBySlug(pool(), tenantSlug);
    if (tenantRow && isTenantPaused(tenantRow)) {
      return res.status(423).json({ ok: false, error: "tenant_paused" });
    }
    const { clientQuoteId, payload, wizardStep } = req.body || {};
    if (!clientQuoteId || typeof clientQuoteId !== "string") {
      return res.status(400).json({ ok: false, error: "missing_client_quote_id" });
    }
    const sale = toSalePayload(payload && typeof payload === "object" ? payload : {});
    const existing = await pool().query(
      `select quote_id, payload from identity.quotes
        where client_quote_id = $1 and status <> 'deleted'
        order by created_at desc limit 1`,
      [clientQuoteId],
    );
    let bcCode = existing.rows[0]?.payload?.bc_code;
    if (!bcCode) bcCode = await takeNextTenantCode(pool(), tenantSlug);
    sale.bc_code = bcCode;
    const q = await upsertQuote({
      userId: req.user?.id || null,
      clientQuoteId,
      payload: sale,
      status: "draft",
      wizardStep: Number.isFinite(Number(wizardStep)) ? Number(wizardStep) : 7,
    });
    await attachQuoteToBcTenant(pool(), q.quote_id, tenantSlug);
    await recordTenantActivity({
      pool: pool(),
      action: "tenant.quote.autosave",
      resourceType: "quote",
      resourceId: q.quote_id,
      payload: {
        wizard_step: wizardStep,
        client_quote_id: clientQuoteId,
        bc_code: bcCode,
        total_usd: sale.totalUsd || sale.total_usd || null,
      },
      req,
    });
    res.json({ ok: true, quote: { ...q, code: bcCode } });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: _safeErr(e) });
  }
});

export default router;
