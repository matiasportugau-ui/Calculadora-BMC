import { createMockCashflowState } from "../../src/lib/cashflow/mockData.js";

const overrides = new Map();

export function resetCashflowMockOverrides() {
  overrides.clear();
}

export function getCashflowStateForApi() {
  const base = createMockCashflowState();
  const p = (t) => (overrides.has(t.id) ? { ...t, date: overrides.get(t.id) } : t);
  return {
    ...base,
    transactions: base.transactions.map(p),
    scenarios: base.scenarios.map((s) => ({ ...s, transactions: s.transactions.map(p) })),
  };
}

export function patchVencimientoDate(id, newDate) {
  const all = [...getCashflowStateForApi().transactions, ...getCashflowStateForApi().scenarios.flatMap((s) => s.transactions)];
  if (!all.some((t) => t.id === id)) return { ok: false, status: 404, error: "not_found" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return { ok: false, status: 400, error: "invalid_date" };
  overrides.set(id, newDate);
  return { ok: true, status: 200, transactionId: id, newDate };
}
