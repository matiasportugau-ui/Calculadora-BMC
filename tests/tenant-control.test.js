// tests/tenant-control.test.js — BMC fleet: silo + pause + export
import test from "node:test";
import assert from "node:assert/strict";
import {
  assertTenantWritable,
  isTenantPaused,
  normalizeTenantStatus,
  quotesToCsv,
  revokeMember,
  setTenantStatus,
  shapeFleetTenant,
  tenantSiteUrl,
  tenantStatusOf,
  listTenantsWithStats,
  getTenantMonitorStats,
} from "../server/lib/tenantControl.js";
import { ACTION_TAXONOMY } from "../server/lib/userActivityLog.js";

test("status is active unless explicitly paused", () => {
  assert.equal(normalizeTenantStatus("paused"), "paused");
  assert.equal(normalizeTenantStatus("active"), "active");
  assert.equal(normalizeTenantStatus("nope"), "active");
  assert.equal(tenantStatusOf({ branding: { status: "paused" } }), "paused");
  assert.equal(tenantStatusOf({ branding: {} }), "active");
  assert.equal(isTenantPaused({ status: "paused" }), true);
  assert.equal(isTenantPaused({ branding: { marca: "BC" } }), false);
});

test("each tenant site is independent", () => {
  assert.equal(tenantSiteUrl("bc", {}), "https://calculadora-bc.vercel.app");
  assert.equal(tenantSiteUrl("paneleslam", {}), "https://calculadora-paneleslam.vercel.app");
  assert.equal(tenantSiteUrl("smartbuilding", {}), "https://calculadora-smartbuilding.vercel.app");
  assert.equal(tenantSiteUrl("bc", { site: "https://example.test" }), "https://example.test");
});

test("paused tenant is not writable; missing tenant 404s", () => {
  assert.throws(() => assertTenantWritable(null), (e) => e.status === 404);
  assert.throws(
    () => assertTenantWritable({ slug: "bc", branding: { status: "paused" } }),
    (e) => e.status === 423 && e.message === "tenant_paused",
  );
  assert.equal(assertTenantWritable({ slug: "bc", branding: {} }).slug, "bc");
});

test("fleet card never mixes another slug's numbers", () => {
  const card = shapeFleetTenant({
    tenant_id: "t1",
    slug: "bc",
    display_name: "BC",
    legal_name: "Jenerik",
    branding: { marca: "BC" },
    member_count: 2,
    claimed_count: 1,
    quote_count: 4,
    quote_usd: 1000,
    last_quote_at: "2026-08-19",
  }, { activity_30d: 9, last_activity_at: "2026-08-19T12:00:00Z" });
  assert.equal(card.slug, "bc");
  assert.equal(card.member_count, 2);
  assert.equal(card.quote_count, 4);
  assert.equal(card.activity_30d, 9);
  assert.equal(card.site, "https://calculadora-bc.vercel.app");
  assert.equal(card.agent_name, "JenIA");
});

test("fleet card agent names stay siloed", () => {
  assert.equal(shapeFleetTenant({ slug: "paneleslam", branding: {} }).agent_name, "MonkIA");
  assert.equal(shapeFleetTenant({ slug: "smartbuilding", branding: {} }).agent_name, "Basuuuu IA");
});

test("quotes CSV is sale-only columns", () => {
  const csv = quotesToCsv([
    {
      quote_id: "q1",
      code: "BC-2026-0001",
      user_email: "a@b.com",
      status: "draft",
      total_usd: 10,
      usage: { area_m2: 2.5 },
      created_at: "2026-08-19",
    },
  ]);
  assert.match(csv, /quote_id,code,user_email/);
  assert.match(csv, /BC-2026-0001/);
  assert.doesNotMatch(csv, /comision|factory_cost/);
});

test("setTenantStatus writes branding.status for that slug only", async () => {
  const calls = [];
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [{ slug: params[0], branding: { status: params[1] }, status: params[1] }] };
    },
  };
  const row = await setTenantStatus(pool, "paneleslam", "paused");
  assert.equal(row.slug, "paneleslam");
  assert.equal(calls[0].params[0], "paneleslam");
  assert.equal(calls[0].params[1], "paused");
  assert.match(calls[0].sql, /where slug = \$1/i);
});

test("revoke refuses the last owner", async () => {
  const pool = {
    query: async (sql) => {
      if (/role = 'owner'/.test(sql)) {
        return { rows: [{ invited_email: "owner@x.com", role: "owner" }] };
      }
      if (/select invited_email, role from identity.tenant_members/.test(sql)) {
        return { rows: [{ invited_email: "owner@x.com", role: "owner" }] };
      }
      return { rows: [] };
    },
  };
  await assert.rejects(
    () => revokeMember(pool, { tenantId: "t1", email: "owner@x.com" }),
    (e) => e.status === 409 && e.message === "last_owner",
  );
});

test("listTenantsWithStats filters activity by tenant slugs", async () => {
  const calls = [];
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (/from identity.tenants/.test(sql)) {
        return {
          rows: [
            { slug: "bc", display_name: "BC", branding: {}, member_count: 1, quote_count: 0, quote_usd: 0 },
            { slug: "paneleslam", display_name: "LAM", branding: {}, member_count: 1, quote_count: 0, quote_usd: 0 },
          ],
        };
      }
      return { rows: [{ slug: "bc", activity_30d: 3, last_activity_at: "2026-08-19" }] };
    },
  };
  const items = await listTenantsWithStats(pool);
  assert.equal(items.length, 2);
  assert.deepEqual(calls[1].params[0], ["bc", "paneleslam"]);
  assert.match(calls[1].sql, /payload->>'tenant'/);
  assert.equal(items.find((t) => t.slug === "bc").activity_30d, 3);
  assert.equal(items.find((t) => t.slug === "paneleslam").activity_30d, 0);
});

test("monitor stats query is scoped to one tenant_id and one slug", async () => {
  const calls = [];
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (/from identity.quotes/.test(sql)) return { rows: [{ n: 2, usd: 50, completed: 1, last_at: null }] };
      if (/from identity.tenant_members/.test(sql)) return { rows: [{ n: 3, claimed: 1 }] };
      return { rows: [{ action: "tenant.ui.click", n: 4 }] };
    },
  };
  const stats = await getTenantMonitorStats(pool, { tenantId: "tid-bc", slug: "bc" });
  assert.equal(stats.quotes, 2);
  assert.equal(stats.quote_usd, 50);
  assert.equal(stats.members, 3);
  assert.equal(calls[0].params[0], "tid-bc");
  assert.match(calls[0].sql, /tenant_id = \$1/);
  assert.equal(calls[2].params[0], "bc");
  assert.match(calls[2].sql, /payload->>'tenant'/);
});

test("control actions are in the activity taxonomy", () => {
  for (const a of [
    "tenant.control.pause",
    "tenant.control.resume",
    "tenant.member.revoke",
    "tenant.export",
  ]) {
    assert.equal(ACTION_TAXONOMY.has(a), true, a);
  }
});
