#!/usr/bin/env node
// Apply tenant BC migration (idempotent). Does not need Jenerik's email.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing (run via doppler bmc-backend/prd)");
  process.exit(2);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const files = [
  "20260818000001_tenant_bc.sql",
  "20260818000002_bc_quote_counter.sql",
  "20260818000003_tenant_activity.sql",
  "20260818000004_tenant_paneleslam.sql",
  "20260818000005_tenant_smartbuilding.sql",
  "20260819000001_tenant_agent_eval.sql",
];

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  for (const name of files) {
    const sqlPath = path.join(here, "../supabase/migrations", name);
    if (!fs.existsSync(sqlPath)) continue;
    await pool.query(fs.readFileSync(sqlPath, "utf8"));
  }
  const t = await pool.query(
    `select slug, display_name, legal_name from identity.tenants where slug = 'bc'`,
  );
  const n = await pool.query(
    `select count(*)::int as n from identity.tenant_members m
       join identity.tenants t on t.tenant_id = m.tenant_id where t.slug = 'bc'`,
  );
  console.log(JSON.stringify({
    ok: true,
    tenant: t.rows[0] || null,
    members: n.rows[0]?.n ?? 0,
  }, null, 2));
} finally {
  await pool.end();
}
