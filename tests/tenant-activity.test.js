// tests/tenant-activity.test.js — Jenerik action trail; BMC default stays quiet
import test from "node:test";
import assert from "node:assert/strict";
import { ACTION_TAXONOMY, CLIENT_EMITTABLE, scrubPayload } from "../server/lib/userActivityLog.js";
import {
  isTenantClientAction,
  listTenantActivity,
  recordTenantActivity,
  TENANT_CLIENT_ACTIONS,
} from "../server/lib/tenantActivity.js";
import { WHITELABEL } from "../src/config/whitelabel.js";
import { BC_TELEMETRY_PATH } from "../src/utils/bcTelemetry.js";

test("tenant actions are in the shipped taxonomy and client-emittable", () => {
  for (const a of TENANT_CLIENT_ACTIONS) {
    assert.equal(ACTION_TAXONOMY.has(a), true, a);
    assert.equal(CLIENT_EMITTABLE.has(a), true, a);
    assert.equal(isTenantClientAction(a), true, a);
  }
  assert.equal(isTenantClientAction("quote.complete"), false);
  assert.equal(isTenantClientAction("admin.user.suspend"), false);
  assert.equal(ACTION_TAXONOMY.has("tenant.agent.turn"), true);
});

test("recordTenantActivity stamps payload.tenant=bc and uses logActivity", async () => {
  const inserts = [];
  const pool = {
    query: async (sql, params) => {
      inserts.push({ sql, params });
      return { rows: [] };
    },
  };
  const r = await recordTenantActivity({
    pool,
    action: "tenant.ui.click",
    payload: { label: "Agregar producto", costo: 99, factory_cost: 1 },
  });
  assert.equal(r.ok, true);
  assert.equal(inserts.length, 1);
  const payload = JSON.parse(inserts[0].params[11]);
  assert.equal(payload.tenant, "bc");
  assert.equal(payload.label, "Agregar producto");
  assert.equal(payload.costo, undefined);
  assert.equal(payload.factory_cost, undefined);
});

test("listTenantActivity filters by payload.tenant, not a fake origin", async () => {
  const calls = [];
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [{ event_id: 1, action: "tenant.wizard.step", payload: { tenant: "bc" } }] };
    },
  };
  const rows = await listTenantActivity(pool, { tenantId: "11111111-1111-1111-1111-111111111111", slug: "bc", limit: 20 });
  assert.equal(rows.length, 1);
  assert.equal(calls[0].params[0], "bc");
  assert.match(calls[0].sql, /payload->>'tenant'/);
});

test("BMC default build does not activate white-label telemetry path as brand", () => {
  assert.equal(WHITELABEL, null);
  assert.equal(BC_TELEMETRY_PATH, "/bc-telemetry");
});

test("scrubPayload still drops cost/commission keys used in tenant payloads", () => {
  const clean = scrubPayload({ tenant: "bc", comision_usd: 4, total_usd: 10 });
  assert.equal(clean.tenant, "bc");
  assert.equal(clean.total_usd, 10);
  assert.equal(clean.comision_usd, undefined);
});
