import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  convertAmount,
  getCurrentCashDisplay,
  getMonthlyBurnDisplay,
  isUnifiedModeAvailable,
} from "../src/lib/cashflow/currency.js";
import { createMockCashflowState } from "../src/lib/cashflow/mockData.js";
import {
  applyTransactionDateMove,
  getMergedTransactions,
  getMoneyNeeded,
  getProjectedSeries,
  getRunwayMonths,
  wouldCreateNegativeGap,
} from "../src/lib/cashflow/project.js";
import { getWeekStartKey, groupPendingByWeek } from "../src/lib/cashflow/weeks.js";
import {
  getCashflowStateForApi,
  patchVencimientoDate,
  resetCashflowMockOverrides,
} from "../server/lib/cashflowMockState.js";

describe("cashflow currency", () => {
  it("filters UYU-only mode", () => {
    const fx = { rate: 40, rateDate: "2026-01-01", source: "mock" };
    assert.equal(convertAmount(100, "USD", "uyu", fx), null);
    assert.equal(convertAmount(100, "UYU", "uyu", null), 100);
  });

  it("unified conversion uses FX", () => {
    const fx = { rate: 40, rateDate: "2026-01-01", source: "mock" };
    assert.equal(convertAmount(10, "USD", "unified_uyu", fx), 400);
    assert.equal(isUnifiedModeAvailable("unified_uyu", null), false);
  });

  it("unified cash sums both currencies", () => {
    const state = createMockCashflowState();
    state.currencyMode = "unified_uyu";
    assert.equal(getCurrentCashDisplay(state), state.currentCashUyu + state.currentCashUsd * state.fx.rate);
  });

  it("USD mode converts UYU burn via FX (never raw pesos-as-dollars)", () => {
    const state = createMockCashflowState();
    assert.equal(state.monthlyBurnCurrency, "UYU");
    assert.equal(getMonthlyBurnDisplay(state), 420000);

    state.currencyMode = "usd";
    const burnUsd = getMonthlyBurnDisplay(state);
    assert.equal(burnUsd, state.monthlyBurn / state.fx.rate); // 420000/40 = 10500
    assert.ok(burnUsd < state.currentCashUsd * 2, "burn must be in USD units, not UYU");

    const runway = getRunwayMonths(state);
    assert.ok(runway != null && runway > 0.5 && runway < 2, `expected ~0.8m runway, got ${runway}`);
  });

  it("burn returns 0 when FX missing and currencies differ", () => {
    const state = createMockCashflowState();
    state.currencyMode = "usd";
    state.fx = null;
    assert.equal(getMonthlyBurnDisplay(state), 0);
    assert.equal(getRunwayMonths(state), null);
  });
});

describe("cashflow scenarios", () => {
  it("inactive scenarios contribute zero txs", () => {
    const state = createMockCashflowState();
    const base = getMergedTransactions(state).length;
    state.scenarios[0].isActive = true;
    assert.ok(getMergedTransactions(state).length > base);
  });

  it("runway decreases when burn increases", () => {
    const state = createMockCashflowState();
    const r1 = getRunwayMonths(state);
    state.monthlyBurn = 840000;
    assert.ok(getRunwayMonths(state) < r1);
  });

  it("projected series length", () => {
    assert.equal(getProjectedSeries(createMockCashflowState()).length, 7);
  });
});

describe("cashflow weeks", () => {
  it("week start is Monday-based", () => {
    assert.equal(getWeekStartKey("2026-07-22"), "2026-07-20");
    assert.equal(groupPendingByWeek(createMockCashflowState(), 4).length, 4);
  });
});

describe("cashflow gap + patch", () => {
  it("negative gap on low cash", () => {
    const state = createMockCashflowState();
    state.currentCashUyu = 50000;
    const sueldos = state.transactions.find((t) => t.id === "tx_sueldos");
    assert.ok(wouldCreateNegativeGap(state, sueldos.id, sueldos.date));
  });

  it("applyTransactionDateMove", () => {
    const next = applyTransactionDateMove(createMockCashflowState(), "tx_c1", "2026-12-01");
    assert.equal(next.transactions.find((t) => t.id === "tx_c1")?.date, "2026-12-01");
  });

  it("money needed", () => {
    assert.equal(typeof getMoneyNeeded(createMockCashflowState()), "number");
  });
});

describe("cashflow API mock", () => {
  it("PATCH vencimientos", () => {
    resetCashflowMockOverrides();
    assert.equal(patchVencimientoDate("nope", "2026-08-01").status, 404);
    assert.equal(patchVencimientoDate("tx_c1", "2026-09-15").status, 200);
    assert.equal(getCashflowStateForApi().transactions.find((t) => t.id === "tx_c1")?.date, "2026-09-15");
    resetCashflowMockOverrides();
  });
});
