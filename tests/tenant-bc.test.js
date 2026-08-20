// tests/tenant-bc.test.js — sale-only tenant BC (no cost / commission now)
import test from "node:test";
import assert from "node:assert/strict";
import { toSalePayload, saleUsageMetrics, isCostOrCommissionKey } from "../src/utils/tenantSaleView.js";
import { saleCopyOfQuote } from "../server/lib/tenantBc.js";

test("cost and commission keys are blocked; sale prices stay", () => {
  assert.equal(isCostOrCommissionKey("comision_usd"), true);
  assert.equal(isCostOrCommissionKey("factory_cost"), true);
  assert.equal(isCostOrCommissionKey("pu"), false);
  assert.equal(isCostOrCommissionKey("total_usd"), false);

  const cleaned = toSalePayload({
    pu: 48.6,
    total: 8491.4,
    total_usd: 10366.27,
    costo: 40.5,
    factory_cost: 40.5,
    comision_usd: 4.05,
    items: [{ desc: "ISODEC", pu: 48.6, costo: 40.5, comision: 4.05 }],
  });
  assert.equal(cleaned.pu, 48.6);
  assert.equal(cleaned.total_usd, 10366.27);
  assert.equal(cleaned.costo, undefined);
  assert.equal(cleaned.factory_cost, undefined);
  assert.equal(cleaned.comision_usd, undefined);
  assert.equal(cleaned.items[0].pu, 48.6);
  assert.equal(cleaned.items[0].costo, undefined);
  assert.equal(cleaned.items[0].comision, undefined);
});

test("usage metrics keep sale totals and drop commission", () => {
  const usage = saleUsageMetrics({
    total_usd: 10366.27,
    area_m2: 174.72,
    escenario: "Techo + Fachada",
    lista: "bmc",
    item_count: 3,
    comision_usd: 9.99,
    factory_cost: 40.5,
  });
  assert.equal(usage.total_usd, 10366.27);
  assert.equal(usage.area_m2, 174.72);
  assert.equal(usage.scenario, "Techo + Fachada");
  assert.equal(usage.comision_usd, undefined);
  assert.equal(usage.factory_cost, undefined);
});

test("BMC copy of a quote is sale-only", () => {
  const copy = saleCopyOfQuote({
    quote_id: "q1",
    user_id: "u1",
    user_email: "seller@bc.com",
    total_usd: 100,
    status: "completed",
    created_at: "2026-08-18",
    payload: { totalUsd: 100, costo: 70, comision_usd: 15 },
  });
  assert.equal(copy.payload.totalUsd, 100);
  assert.equal(copy.payload.costo, undefined);
  assert.equal(copy.payload.comision_usd, undefined);
  assert.equal(copy.usage.total_usd, 100);
});
