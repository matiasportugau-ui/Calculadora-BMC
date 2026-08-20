// Tenant agent eval: durable transcripts + token/$ estimates for BMC analysis.
// Fail-soft on write. Never mix slugs. BMC (no slug) does not land here.

import { agentIdentity } from "../../src/config/whitelabel.js";
import { estimateCostUSD } from "./aiProviderConfig.js";

export const TENANT_AGENT_SLUGS = ["bc", "paneleslam", "smartbuilding"];

const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export function normalizeTenantSlug(value) {
  const s = String(value || "").trim().toLowerCase();
  return TENANT_AGENT_SLUGS.includes(s) ? s : null;
}

export function isValidConversationId(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

export function isBmcProdOrigin(origin) {
  try {
    const host = new URL(String(origin || "")).hostname.toLowerCase();
    return host === "calculadora-bmc.vercel.app";
  } catch {
    return false;
  }
}

export function tenantSlugFromOrigin(origin) {
  try {
    const host = new URL(String(origin || "")).hostname.toLowerCase();
    if (host === "calculadora-bc.vercel.app") return "bc";
    if (host === "calculadora-paneleslam.vercel.app") return "paneleslam";
    if (host === "calculadora-smartbuilding.vercel.app") return "smartbuilding";
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Resolve tenant for a chat request.
 * Membership > Origin host > API WHITELABEL env > body (never from BMC prod Origin).
 */
export function resolveTenantSlug({
  bodyTenant,
  origin,
  membershipSlug,
  envSlug,
} = {}) {
  const mem = normalizeTenantSlug(membershipSlug);
  if (mem) return mem;
  const fromOrigin = tenantSlugFromOrigin(origin);
  if (fromOrigin) return fromOrigin;
  // Shared Cloud Run must never tag BMC prod as a tenant, even if WHITELABEL=bc.
  if (isBmcProdOrigin(origin)) return null;
  const env = normalizeTenantSlug(envSlug);
  if (env) return env;
  return normalizeTenantSlug(bodyTenant);
}

export function personaLine(slug) {
  const id = agentIdentity(slug);
  if (!id.slug) {
    return "Sos Panelin (BMC Uruguay). Respondé en español rioplatense, breve y útil.";
  }
  return `Sos ${id.name}, asistente de cotización de ${id.brandName}. Respondé en español rioplatense, breve y útil.`;
}

function num(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

/**
 * Persist one user or assistant turn. Upserts conversation totals.
 * @returns {{ ok: boolean, skipped?: string, error?: string }}
 */
export async function recordTenantChatTurn({
  pool,
  conversationId,
  tenantSlug,
  userId = null,
  userEmail = null,
  role,
  content,
  turnIndex,
  provider = null,
  model = null,
  inputTokens = 0,
  outputTokens = 0,
  estimatedCostUsd = null,
  latencyMs = null,
} = {}) {
  const slug = normalizeTenantSlug(tenantSlug);
  if (!slug) return { ok: false, skipped: "not_tenant" };
  if (!pool || typeof pool.query !== "function") return { ok: false, skipped: "no_pool" };
  if (!isValidConversationId(conversationId)) return { ok: false, skipped: "bad_conversation_id" };
  const r = role === "assistant" ? "assistant" : role === "user" ? "user" : null;
  if (!r) return { ok: false, skipped: "bad_role" };

  const id = agentIdentity(slug);
  const inTok = Math.max(0, Math.round(num(inputTokens)));
  const outTok = Math.max(0, Math.round(num(outputTokens)));
  let usd = estimatedCostUsd;
  if (usd == null && (inTok || outTok) && provider) {
    usd = estimateCostUSD(provider, model, { input_tokens: inTok, output_tokens: outTok });
  }
  usd = +(num(usd).toFixed(6));
  const idx = Math.max(0, Math.round(num(turnIndex)));
  const text = String(content || "").slice(0, 200_000);
  const latency = latencyMs == null ? null : Math.max(0, Math.round(num(latencyMs)));

  await pool.query(
    `insert into identity.tenant_agent_conversations (
        conversation_id, tenant_slug, agent_name, user_id, user_email,
        provider, model, started_at, last_at, turn_count,
        input_tokens, output_tokens, estimated_cost_usd
      ) values ($1, $2, $3, $4, $5, $6, $7, now(), now(), 1, $8, $9, $10)
      on conflict (conversation_id) do update set
        tenant_slug = excluded.tenant_slug,
        agent_name = excluded.agent_name,
        user_id = coalesce(identity.tenant_agent_conversations.user_id, excluded.user_id),
        user_email = coalesce(nullif(identity.tenant_agent_conversations.user_email, ''), excluded.user_email),
        provider = coalesce(excluded.provider, identity.tenant_agent_conversations.provider),
        model = coalesce(excluded.model, identity.tenant_agent_conversations.model),
        last_at = now(),
        turn_count = identity.tenant_agent_conversations.turn_count + 1,
        input_tokens = identity.tenant_agent_conversations.input_tokens + excluded.input_tokens,
        output_tokens = identity.tenant_agent_conversations.output_tokens + excluded.output_tokens,
        estimated_cost_usd = identity.tenant_agent_conversations.estimated_cost_usd + excluded.estimated_cost_usd`,
    [conversationId, slug, id.name, userId, userEmail, provider, model, inTok, outTok, usd],
  );

  await pool.query(
    `insert into identity.tenant_agent_turns (
        conversation_id, turn_index, role, content,
        provider, model, input_tokens, output_tokens,
        estimated_cost_usd, latency_ms, at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
      on conflict (conversation_id, turn_index) do update set
        content = excluded.content,
        provider = coalesce(excluded.provider, identity.tenant_agent_turns.provider),
        model = coalesce(excluded.model, identity.tenant_agent_turns.model),
        input_tokens = excluded.input_tokens,
        output_tokens = excluded.output_tokens,
        estimated_cost_usd = excluded.estimated_cost_usd,
        latency_ms = coalesce(excluded.latency_ms, identity.tenant_agent_turns.latency_ms)`,
    [conversationId, idx, r, text, provider, model, inTok, outTok, usd, latency],
  );

  return { ok: true };
}

export function clampDays(value, fallback = 30) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(n, 90));
}

export async function listTenantConversations(pool, { slug, days = 30, limit = 80 } = {}) {
  const tenantSlug = normalizeTenantSlug(slug);
  if (!tenantSlug) return [];
  const cap = Math.min(Math.max(Number(limit) || 80, 1), 200);
  const period = clampDays(days);
  const { rows } = await pool.query(
    `select conversation_id, tenant_slug, agent_name, user_id, user_email,
            provider, model, started_at, last_at, turn_count,
            input_tokens, output_tokens, estimated_cost_usd,
            (
              select left(t.content, 180)
                from identity.tenant_agent_turns t
               where t.conversation_id = c.conversation_id
                 and t.role = 'user'
               order by t.turn_index desc
               limit 1
            ) as last_user_preview
       from identity.tenant_agent_conversations c
      where c.tenant_slug = $1
        and c.last_at > now() - ($2::int * interval '1 day')
      order by c.last_at desc
      limit $3`,
    [tenantSlug, period, cap],
  );
  return rows;
}

export async function getTenantConversation(pool, { slug, conversationId } = {}) {
  const tenantSlug = normalizeTenantSlug(slug);
  if (!tenantSlug || !isValidConversationId(conversationId)) return null;
  const head = await pool.query(
    `select conversation_id, tenant_slug, agent_name, user_id, user_email,
            provider, model, started_at, last_at, turn_count,
            input_tokens, output_tokens, estimated_cost_usd
       from identity.tenant_agent_conversations
      where conversation_id = $1 and tenant_slug = $2`,
    [conversationId, tenantSlug],
  );
  if (!head.rows[0]) return null;
  const turns = await pool.query(
    `select turn_id, turn_index, role, content, provider, model,
            input_tokens, output_tokens, estimated_cost_usd, latency_ms, at
       from identity.tenant_agent_turns
      where conversation_id = $1
      order by turn_index asc, turn_id asc`,
    [conversationId],
  );
  return { ...head.rows[0], turns: turns.rows };
}

export async function getTenantAiStats(pool, { slug, days = 30 } = {}) {
  const tenantSlug = normalizeTenantSlug(slug);
  if (!tenantSlug) {
    return emptyAiStats(days);
  }
  const period = clampDays(days);
  const { rows } = await pool.query(
    `select count(*)::int as conversations,
            coalesce(sum(turn_count), 0)::int as turns,
            coalesce(sum(input_tokens), 0)::bigint as input_tokens,
            coalesce(sum(output_tokens), 0)::bigint as output_tokens,
            coalesce(sum(estimated_cost_usd), 0)::float as estimated_cost_usd
       from identity.tenant_agent_conversations
      where tenant_slug = $1
        and last_at > now() - ($2::int * interval '1 day')`,
    [tenantSlug, period],
  );
  const r = rows[0] || {};
  const input = Number(r.input_tokens || 0);
  const output = Number(r.output_tokens || 0);
  return {
    days: period,
    agent_name: agentIdentity(tenantSlug).name,
    conversations: Number(r.conversations || 0),
    turns: Number(r.turns || 0),
    input_tokens: input,
    output_tokens: output,
    tokens: input + output,
    estimated_cost_usd: +Number(r.estimated_cost_usd || 0).toFixed(6),
    estimate_note: "estimación (eval) — no es factura del proveedor",
  };
}

function emptyAiStats(days) {
  return {
    days: clampDays(days),
    agent_name: null,
    conversations: 0,
    turns: 0,
    input_tokens: 0,
    output_tokens: 0,
    tokens: 0,
    estimated_cost_usd: 0,
    estimate_note: "estimación (eval) — no es factura del proveedor",
  };
}

export async function getFleetAiStats(pool, slugs, days = 30) {
  const list = (slugs || []).map(normalizeTenantSlug).filter(Boolean);
  if (!list.length) return {};
  const period = clampDays(days);
  const { rows } = await pool.query(
    `select tenant_slug,
            count(*)::int as conv_30d,
            coalesce(sum(input_tokens + output_tokens), 0)::bigint as tokens_30d,
            coalesce(sum(estimated_cost_usd), 0)::float as cost_30d
       from identity.tenant_agent_conversations
      where tenant_slug = any($1)
        and last_at > now() - ($2::int * interval '1 day')
      group by 1`,
    [list, period],
  );
  return Object.fromEntries(rows.map((r) => [r.tenant_slug, r]));
}

export function conversationsToCsv(items) {
  const header = [
    "conversation_id", "tenant_slug", "agent_name", "user_email",
    "started_at", "last_at", "turn_count", "input_tokens", "output_tokens",
    "tokens", "estimated_cost_usd",
  ];
  const lines = [header.join(",")];
  for (const c of items || []) {
    const inTok = Number(c.input_tokens || 0);
    const outTok = Number(c.output_tokens || 0);
    const cells = [
      c.conversation_id,
      c.tenant_slug,
      c.agent_name,
      c.user_email,
      c.started_at,
      c.last_at,
      c.turn_count,
      inTok,
      outTok,
      inTok + outTok,
      c.estimated_cost_usd,
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
