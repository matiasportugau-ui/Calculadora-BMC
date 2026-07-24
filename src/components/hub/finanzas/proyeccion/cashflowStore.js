import { create } from "zustand";
import { MOCK_CASHFLOW_STATE } from "../../../../lib/cashflow/mockData.js";
import { isUnifiedModeAvailable } from "../../../../lib/cashflow/currency.js";
import { applyTransactionDateMove, wouldCreateNegativeGap } from "../../../../lib/cashflow/project.js";

const apiBase = (import.meta.env?.VITE_API_BASE || "").replace(/\/+$/, "");
const useMock = import.meta.env?.VITE_CASHFLOW_MOCK === "1";

export const useCashflowStore = create((set, get) => ({
  state: null,
  loading: false,
  error: null,
  view: "chart",
  toast: null,
  chartSeries: { actual: true, projection: true, band: true },

  hydrate: async (token) => {
    set({ loading: true, error: null });
    try {
      if (useMock) throw new Error("mock");
      const r = await fetch(`${apiBase}/api/panelin/cashflow-init`, {
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!r.ok) throw new Error(String(r.status));
      set({ state: await r.json(), loading: false });
    } catch (e) {
      set({ state: structuredClone(MOCK_CASHFLOW_STATE), loading: false, error: e.message === "mock" ? null : e.message });
    }
  },

  setView: (view) => set({ view }),
  toggleChartSeries: (key) => set((s) => ({ chartSeries: { ...s.chartSeries, [key]: !s.chartSeries[key] } })),
  clearToast: () => set({ toast: null }),

  setCurrencyMode: (mode) => {
    const { state } = get();
    if (state && isUnifiedModeAvailable(mode, state.fx)) set({ state: { ...state, currencyMode: mode } });
  },

  setMonthlyBurn: (v) => {
    const { state } = get();
    if (state) set({ state: { ...state, monthlyBurn: Number(v) } });
  },

  toggleScenario: (id) => {
    const { state } = get();
    if (!state) return;
    set({ state: { ...state, scenarios: state.scenarios.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s)) } });
  },

  moveTransactionDate: (id, newDate, token) => {
    const { state } = get();
    if (!state) return;
    const prevDate =
      state.transactions.find((t) => t.id === id)?.date ??
      state.scenarios.flatMap((s) => s.transactions).find((t) => t.id === id)?.date;
    if (!prevDate) return;
    const next = applyTransactionDateMove(state, id, newDate);
    set({
      state: next,
      toast: wouldCreateNegativeGap(next, id, newDate)
        ? { type: "warn", msg: "Liquidez proyectada negativa — se guarda igual (soft-warn)." }
        : null,
    });
    if (useMock) return;
    fetch(`${apiBase}/api/panelin/vencimientos`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ transactionId: id, newDate }),
    })
      .then((r) => {
        // HTTP 4xx/5xx resolve the promise — must check ok or optimistic UI silently lies
        if (!r.ok) throw new Error(String(r.status));
      })
      .catch(() => {
        const current = get().state;
        if (!current) return;
        // Revert only this tx from latest state so a failed save does not wipe concurrent moves
        set({
          state: applyTransactionDateMove(current, id, prevDate),
          toast: { type: "err", msg: "Error al guardar — cambio revertido." },
        });
      });
  },
}));
