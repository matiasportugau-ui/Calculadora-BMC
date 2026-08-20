// Tenant BC membership + sale-only quote copies.
// No factory cost, no commission in this layer.

import { toSalePayload, saleUsageMetrics } from "../../src/utils/tenantSaleView.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function getMembership(pool, userId) {
  if (!userId) return null;
  const { rows } = await pool.query(
    `select m.tenant_id, m.role, m.invited_email, t.slug, t.display_name, t.legal_name, t.branding
       from identity.tenant_members m
       join identity.tenants t on t.tenant_id = m.tenant_id
      where m.user_id = $1
      limit 1`,
    [userId],
  );
  return rows[0] || null;
}

export async function getTenantBySlug(pool, slug = "bc") {
  const { rows } = await pool.query(
    `select tenant_id, slug, display_name, legal_name, branding,
            coalesce(nullif(branding->>'status', ''), 'active') as status
       from identity.tenants where slug = $1`,
    [slug],
  );
  return rows[0] || null;
}

export async function claimTenantInvites(tx, userId, email) {
  const em = normalizeEmail(email);
  if (!userId || !em) return { claimed: 0 };
  const { rowCount } = await tx.query(
    `update identity.tenant_members
        set user_id = $1, claimed_at = now()
      where invited_email = $2 and user_id is null`,
    [userId, em],
  );
  return { claimed: rowCount || 0 };
}

export async function inviteMember(pool, {
  tenantId, email, role = "user", invitedBy,
}) {
  const em = normalizeEmail(email);
  if (!EMAIL_RE.test(em)) {
    throw Object.assign(new Error("invalid_email"), { status: 400 });
  }
  if (role !== "owner" && role !== "user") {
    throw Object.assign(new Error("invalid_role"), { status: 400 });
  }
  const existingUser = await pool.query(
    `select user_id from identity.users where email = $1`,
    [em],
  );
  const userId = existingUser.rows[0]?.user_id || null;
  const ins = await pool.query(
    `insert into identity.tenant_members (tenant_id, user_id, invited_email, role, invited_by, claimed_at)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (tenant_id, invited_email) do update
        set role = excluded.role,
            user_id = coalesce(identity.tenant_members.user_id, excluded.user_id),
            claimed_at = coalesce(identity.tenant_members.claimed_at, excluded.claimed_at)
     returning tenant_id, user_id, invited_email, role, created_at, claimed_at`,
    [tenantId, userId, em, role, invitedBy || null, userId ? new Date() : null],
  );
  return ins.rows[0];
}

export async function listMembers(pool, tenantId) {
  const { rows } = await pool.query(
    `select m.invited_email, m.role, m.user_id, m.created_at, m.claimed_at,
            u.name, u.status
       from identity.tenant_members m
       left join identity.users u on u.user_id = m.user_id
      where m.tenant_id = $1
      order by m.role desc, m.created_at asc`,
    [tenantId],
  );
  return rows;
}

export async function attachQuoteToTenant(pool, { quoteId, userId, payload }) {
  const mem = await getMembership(pool, userId);
  if (!mem || !quoteId) return null;
  const sale = toSalePayload(payload || {});
  await pool.query(
    `update identity.quotes
        set tenant_id = $2,
            payload = $3::jsonb
      where quote_id = $1`,
    [quoteId, mem.tenant_id, JSON.stringify(sale)],
  );
  return { tenant_id: mem.tenant_id, slug: mem.slug };
}

export async function listTenantQuotes(pool, { tenantId, limit = 50 }) {
  const { rows } = await pool.query(
    `select q.quote_id, q.user_id, q.client_quote_id, q.total_usd, q.total_uyu,
            q.status, q.wizard_step, q.created_at, q.updated_at, q.payload,
            u.email as user_email, u.name as user_name
       from identity.quotes q
       left join identity.users u on u.user_id = q.user_id
      where q.tenant_id = $1 and q.status <> 'deleted'
      order by q.created_at desc
      limit $2`,
    [tenantId, Math.min(Number(limit) || 50, 200)],
  );
  return rows.map((row) => ({
    ...row,
    payload: toSalePayload(row.payload || {}),
  }));
}

export function saleCopyOfQuote(quote) {
  if (!quote) return null;
  const payload = toSalePayload(quote.payload || {});
  return {
    quote_id: quote.quote_id,
    user_id: quote.user_id,
    user_email: quote.user_email || null,
    user_name: quote.user_name || null,
    client_quote_id: quote.client_quote_id || null,
    total_usd: quote.total_usd,
    total_uyu: quote.total_uyu,
    status: quote.status,
    wizard_step: quote.wizard_step ?? payload.wizardStep ?? null,
    created_at: quote.created_at,
    updated_at: quote.updated_at,
    code: payload.bc_code || quote.client_quote_id || null,
    cliente: payload.cliente || payload.project?.proyecto?.nombre || null,
    escenario: payload.scenario || payload.project?.scenario || null,
    producto: payload.producto || null,
    payload,
    usage: saleUsageMetrics({ ...quote, payload }),
  };
}

export async function getTenantQuote(pool, { tenantId, quoteId }) {
  const { rows } = await pool.query(
    `select q.quote_id, q.user_id, q.client_quote_id, q.total_usd, q.total_uyu,
            q.status, q.wizard_step, q.created_at, q.updated_at, q.payload,
            u.email as user_email, u.name as user_name
       from identity.quotes q
       left join identity.users u on u.user_id = q.user_id
      where q.quote_id = $1 and q.tenant_id = $2 and q.status <> 'deleted'`,
    [quoteId, tenantId],
  );
  return rows[0] || null;
}

export async function attachQuoteToBcTenant(pool, quoteId, slug = "bc") {
  const tenant = await getTenantBySlug(pool, slug);
  if (!tenant || !quoteId) return null;
  await pool.query(
    `update identity.quotes set tenant_id = $2 where quote_id = $1`,
    [quoteId, tenant.tenant_id],
  );
  return tenant.tenant_id;
}

export async function takeNextTenantCode(pool, slug = "bc") {
  const PREFIX = { bc: "BC", paneleslam: "LAM", smartbuilding: "SMART" };
  const key = String(slug || "bc").toLowerCase();
  const prefix = PREFIX[key] || key.toUpperCase();
  const year = parseInt(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric" }).format(new Date()),
    10,
  );
  await pool.query(`
    create table if not exists tenant_quote_counter (
      slug text not null,
      year int not null,
      seq int not null default 0,
      updated_at timestamptz not null default now(),
      primary key (slug, year)
    )
  `);
  const { rows } = await pool.query(
    `insert into tenant_quote_counter (slug, year, seq)
     values ($1, $2, 1)
     on conflict (slug, year)
     do update set seq = tenant_quote_counter.seq + 1, updated_at = now()
     returning seq, year`,
    [slug, year],
  );
  const seq = rows[0].seq;
  return `${prefix}-${rows[0].year}-${String(seq).padStart(4, "0")}`;
}

export async function takeNextBcCode(pool) {
  return takeNextTenantCode(pool, "bc");
}

export { toSalePayload, saleUsageMetrics };
