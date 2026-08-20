#!/usr/bin/env node
// Grant Jenerik (or any Google email) owner access to tenant BC.
// Safe to run before they exist: first Google login claims the invite.
//
//   doppler run --project=bmc-backend --config=prd -- \
//     node scripts/jenerik-grant-owner.mjs  alguien@gmail.com

import pg from "pg";

const email = String(process.argv[2] || "").trim().toLowerCase();
const slug = String(process.argv[3] || process.env.TENANT_SLUG || "bc").trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("usage: node scripts/jenerik-grant-owner.mjs <google-email> [slug]");
  process.exit(2);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing (run via doppler bmc-backend/prd)");
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  const tenant = await pool.query(
    `select tenant_id, slug, display_name from identity.tenants where slug = $1`,
    [slug],
  );
  if (!tenant.rows[0]) {
    console.error(`tenant ${slug} missing — apply tenant migration / seed`);
    process.exit(1);
  }
  const existing = await pool.query(
    `select user_id from identity.users where email = $1`,
    [email],
  );
  const userId = existing.rows[0]?.user_id || null;
  const row = await pool.query(
    `insert into identity.tenant_members (tenant_id, user_id, invited_email, role, claimed_at)
     values ($1, $2, $3, 'owner', $4)
     on conflict (tenant_id, invited_email) do update
        set role = 'owner',
            user_id = coalesce(identity.tenant_members.user_id, excluded.user_id),
            claimed_at = coalesce(identity.tenant_members.claimed_at, excluded.claimed_at)
     returning invited_email, role, user_id, claimed_at`,
    [tenant.rows[0].tenant_id, userId, email, userId ? new Date() : null],
  );
  console.log(JSON.stringify({
    ok: true,
    tenant: tenant.rows[0].slug,
    member: row.rows[0],
    already_has_google_user: Boolean(userId),
    next: userId
      ? "Ya puede entrar con Google y ver /mi-espacio?tab=equipo"
      : "Cuando entre con ese Google, la invite se reclama sola",
  }, null, 2));
} finally {
  await pool.end();
}
