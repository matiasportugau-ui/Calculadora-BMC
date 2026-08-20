// BMC admin control plane for white-label tenants.
// Every query is scoped by tenant_id or payload.tenant — never mix slugs.
import { WHITELABEL_BRANDS } from "../../src/config/whitelabel.js";
import {
  getTenantBySlug,
  listMembers,
  listTenantQuotes,
  saleCopyOfQuote,
} from "./tenantBc.js";
import { listTenantActivity } from "./tenantActivity.js";
import { presenceLight } from "./tenantAnalytics.js";
import { agentIdentity } from "../../src/config/whitelabel.js";
import {
  getFleetAiStats,
  getTenantAiStats,
  listTenantConversations,
  getTenantConversation,
} from "./tenantAgentEval.js";

export const TENANT_STATUSES = ["active", "paused"];

export function normalizeTenantStatus(value) {
  return value === "paused" ? "paused" : "active";
}

export function tenantStatusOf(row) {
  if (!row) return "active";
  return normalizeTenantStatus(row.status || row.branding?.status);
}

export function isTenantPaused(row) {
  return tenantStatusOf(row) === "paused";
}

export function tenantSiteUrl(slug, branding = {}) {
  const pack = WHITELABEL_BRANDS[slug] || {};
  return branding.site || branding.url || pack.site || null;
}

export function assertTenantWritable(tenant) {
  if (!tenant) {
    throw Object.assign(new Error("tenant_not_found"), { status: 404 });
  }
  if (isTenantPaused(tenant)) {
    throw Object.assign(new Error("tenant_paused"), { status: 423 });
  }
  return tenant;
}

export async function getTenantBySlugWithStatus(pool, slug) {
  const tenant = await getTenantBySlug(pool, slug);
  if (!tenant) return null;
  return { ...tenant, status: tenantStatusOf(tenant) };
}

export async function setTenantStatus(pool, slug, status) {
  const next = normalizeTenantStatus(status);
  const { rows } = await pool.query(
    `update identity.tenants
        set branding = jsonb_set(
              coalesce(branding, '{}'::jsonb),
              '{status}',
              to_jsonb($2::text),
              true
            )
      where slug = $1
      returning tenant_id, slug, display_name, legal_name, branding,
                coalesce(nullif(branding->>'status', ''), 'active') as status`,
    [slug, next],
  );
  return rows[0] || null;
}

export async function revokeMember(pool, { tenantId, email }) {
  const em = String(email || "").trim().toLowerCase();
  if (!em) {
    throw Object.assign(new Error("invalid_email"), { status: 400 });
  }
  const owners = await pool.query(
    `select invited_email, role
       from identity.tenant_members
      where tenant_id = $1 and role = 'owner'`,
    [tenantId],
  );
  const target = await pool.query(
    `select invited_email, role from identity.tenant_members
      where tenant_id = $1 and lower(invited_email::text) = $2`,
    [tenantId, em],
  );
  if (!target.rows[0]) {
    throw Object.assign(new Error("member_not_found"), { status: 404 });
  }
  if (target.rows[0].role === "owner" && owners.rows.length <= 1) {
    throw Object.assign(new Error("last_owner"), { status: 409 });
  }
  const del = await pool.query(
    `delete from identity.tenant_members
      where tenant_id = $1 and lower(invited_email::text) = $2
      returning invited_email, role, user_id`,
    [tenantId, em],
  );
  return del.rows[0];
}

export async function listTenantsWithStats(pool) {
  const { rows } = await pool.query(
    `select t.tenant_id, t.slug, t.display_name, t.legal_name, t.branding,
            t.created_at, t.updated_at,
            coalesce(nullif(t.branding->>'status', ''), 'active') as status,
            (select count(*)::int from identity.tenant_members m
              where m.tenant_id = t.tenant_id) as member_count,
            (select count(*)::int from identity.tenant_members m
              where m.tenant_id = t.tenant_id and m.claimed_at is not null) as claimed_count,
            (select count(*)::int from identity.quotes q
              where q.tenant_id = t.tenant_id and q.status <> 'deleted') as quote_count,
            (select coalesce(sum(q.total_usd), 0)::float from identity.quotes q
              where q.tenant_id = t.tenant_id and q.status <> 'deleted') as quote_usd,
            (select max(q.created_at) from identity.quotes q
              where q.tenant_id = t.tenant_id and q.status <> 'deleted') as last_quote_at
       from identity.tenants t
      order by t.display_name asc`,
  );
  const slugs = rows.map((r) => r.slug).filter(Boolean);
  let activityBySlug = {};
  if (slugs.length) {
    const act = await pool.query(
      `select coalesce(payload->>'tenant', '') as slug,
              count(*)::int as activity_30d,
              max(at) as last_activity_at
         from identity.user_activity_log
        where module = 'tenant'
          and at > now() - interval '30 days'
          and coalesce(payload->>'tenant', '') = any($1)
        group by 1`,
      [slugs],
    );
    activityBySlug = Object.fromEntries(
      act.rows.map((r) => [r.slug, r]),
    );
  }
  let aiBySlug = {};
  try {
    aiBySlug = await getFleetAiStats(pool, slugs, 30);
  } catch {
    aiBySlug = {};
  }
  return rows.map((row) => shapeFleetTenant(row, activityBySlug[row.slug], aiBySlug[row.slug]));
}

export function shapeFleetTenant(row, activity = null, ai = null) {
  const slug = row.slug;
  const branding = row.branding || {};
  const id = agentIdentity(slug);
  return {
    tenant_id: row.tenant_id,
    slug,
    display_name: row.display_name,
    legal_name: row.legal_name,
    status: tenantStatusOf(row),
    site: tenantSiteUrl(slug, branding),
    agent_name: id.slug ? id.name : null,
    member_count: Number(row.member_count || 0),
    claimed_count: Number(row.claimed_count || 0),
    quote_count: Number(row.quote_count || 0),
    quote_usd: Number(row.quote_usd || 0),
    last_quote_at: row.last_quote_at || null,
    activity_30d: Number(activity?.activity_30d || 0),
    last_activity_at: activity?.last_activity_at || null,
    tokens_30d: Number(ai?.tokens_30d || 0),
    estimated_cost_usd_30d: +Number(ai?.cost_30d || 0).toFixed(6),
    conv_30d: Number(ai?.conv_30d || 0),
    branding,
    ...presenceLight({
      paused: tenantStatusOf(row) === "paused",
      lastAt: activity?.last_activity_at || row.last_quote_at || null,
    }),
  };
}

export async function getTenantMonitorStats(pool, { tenantId, slug }) {
  const quotes = await pool.query(
    `select count(*)::int as n,
            coalesce(sum(total_usd), 0)::float as usd,
            count(*) filter (where status = 'completed')::int as completed,
            max(created_at) as last_at
       from identity.quotes
      where tenant_id = $1 and status <> 'deleted'`,
    [tenantId],
  );
  const members = await pool.query(
    `select count(*)::int as n,
            count(*) filter (where claimed_at is not null)::int as claimed
       from identity.tenant_members
      where tenant_id = $1`,
    [tenantId],
  );
  const actions = await pool.query(
    `select action, count(*)::int as n
       from identity.user_activity_log
      where module = 'tenant'
        and coalesce(payload->>'tenant', '') = $1
        and at > now() - interval '30 days'
      group by action
      order by n desc
      limit 20`,
    [slug],
  );
  const q = quotes.rows[0] || {};
  const m = members.rows[0] || {};
  let ai = {
    conversations: 0, turns: 0, tokens: 0, estimated_cost_usd: 0, agent_name: agentIdentity(slug).name,
  };
  try {
    ai = await getTenantAiStats(pool, { slug, days: 30 });
  } catch {
    /* table may not exist yet */
  }
  return {
    quotes: Number(q.n || 0),
    quote_usd: Number(q.usd || 0),
    quotes_completed: Number(q.completed || 0),
    last_quote_at: q.last_at || null,
    members: Number(m.n || 0),
    members_claimed: Number(m.claimed || 0),
    actions_30d: actions.rows,
    activity_30d: actions.rows.reduce((s, r) => s + Number(r.n || 0), 0),
    agent_name: ai.agent_name,
    ai_conversations_30d: Number(ai.conversations || 0),
    ai_turns_30d: Number(ai.turns || 0),
    ai_tokens_30d: Number(ai.tokens || 0),
    ai_estimated_cost_usd_30d: +Number(ai.estimated_cost_usd || 0).toFixed(6),
  };
}

export function quotesToCsv(quotes) {
  const header = [
    "quote_id", "code", "user_email", "status", "total_usd", "area_m2", "created_at",
  ];
  const lines = [header.join(",")];
  for (const q of quotes || []) {
    const cells = [
      q.quote_id,
      q.code,
      q.user_email,
      q.status,
      q.total_usd,
      q.usage?.area_m2,
      q.created_at,
    ].map(csvCell);
    lines.push(cells.join(","));
  }
  return `${lines.join("\n")}\n`;
}

function csvCell(value) {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function buildTenantExport(pool, { tenant, limit = 200 } = {}) {
  const members = await listMembers(pool, tenant.tenant_id);
  const quotes = (await listTenantQuotes(pool, {
    tenantId: tenant.tenant_id,
    limit,
  })).map(saleCopyOfQuote);
  const activity = await listTenantActivity(pool, {
    tenantId: tenant.tenant_id,
    slug: tenant.slug,
    limit,
  });
  const stats = await getTenantMonitorStats(pool, {
    tenantId: tenant.tenant_id,
    slug: tenant.slug,
  });
  let conversations = [];
  let ai_stats = null;
  try {
    conversations = await listTenantConversations(pool, {
      slug: tenant.slug,
      days: 90,
      limit,
    });
    const withTurns = [];
    for (const c of conversations.slice(0, Math.min(conversations.length, 50))) {
      const full = await getTenantConversation(pool, {
        slug: tenant.slug,
        conversationId: c.conversation_id,
      });
      withTurns.push(full || c);
    }
    conversations = withTurns;
    ai_stats = await getTenantAiStats(pool, { slug: tenant.slug, days: 90 });
  } catch {
    conversations = [];
    ai_stats = null;
  }
  return {
    exported_at: new Date().toISOString(),
    tenant: {
      slug: tenant.slug,
      display_name: tenant.display_name,
      legal_name: tenant.legal_name,
      status: tenantStatusOf(tenant),
      site: tenantSiteUrl(tenant.slug, tenant.branding),
      branding: tenant.branding || {},
      agent_name: agentIdentity(tenant.slug).name,
    },
    stats,
    members,
    quotes,
    activity,
    conversations,
    ai_stats,
  };
}
