import { addMonths, eachMonthOfInterval, format, parseISO, startOfMonth } from "date-fns";
import { getCurrentCashDisplay, getMonthlyBurnDisplay, getTransactionDisplayAmount } from "./currency.js";

export function getMergedTransactions(state) {
  const txs = [...state.transactions];
  state.scenarios.filter((s) => s.isActive).forEach((s) => txs.push(...s.transactions));
  return txs;
}

function signed(tx, mode, fx) {
  const a = getTransactionDisplayAmount(tx, mode, fx);
  if (a == null) return 0;
  return tx.type === "outflow" ? -Math.abs(a) : Math.abs(a);
}

function seriesFor(state, withScenarios) {
  const mode = state.currencyMode;
  const fx = state.fx;
  const sim = {
    ...state,
    scenarios: withScenarios ? state.scenarios : state.scenarios.map((s) => ({ ...s, isActive: false })),
  };
  const txs = getMergedTransactions(sim);
  const pending = txs.filter((t) => t.status === "pending");
  const months = eachMonthOfInterval({ start: startOfMonth(new Date()), end: addMonths(startOfMonth(new Date()), 6) });
  let cash = getCurrentCashDisplay(state);
  const pts = [];
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const end = addMonths(m, 1);
    if (i === 0) {
      pts.push({ label: format(m, "MMM"), actual: cash, projection: cash });
      continue;
    }
    const flow = pending.filter((t) => { const d = parseISO(t.date); return d >= m && d < end; })
      .reduce((s, t) => s + signed(t, mode, fx), 0);
    const burn = -getMonthlyBurnDisplay(state);
    const prev = pts[i - 1];
    pts.push({ label: format(m, "MMM"), actual: prev.actual + flow * 0.65 + burn * 0.85, projection: prev.projection + flow + burn });
  }
  return pts;
}

export function getProjectedSeries(state) {
  const base = seriesFor(state, false);
  const sc = seriesFor(state, true);
  const on = state.scenarios.some((s) => s.isActive);
  return base.map((b, i) => ({
    ...b,
    scenarioMin: on ? Math.min(b.projection, sc[i].projection) : null,
    scenarioMax: on ? Math.max(b.projection, sc[i].projection) : null,
  }));
}

export function getRunwayMonths(state) {
  const burn = getMonthlyBurnDisplay(state);
  return burn > 0 ? getCurrentCashDisplay(state) / burn : null;
}

export function getMoneyNeeded(state, txs) {
  const list = txs ?? getMergedTransactions(state).filter((t) => t.status === "pending");
  return list.reduce((n, tx) => {
    const a = getTransactionDisplayAmount(tx, state.currencyMode, state.fx);
    if (a == null) return n;
    return n + (tx.type === "outflow" ? a : -a);
  }, 0);
}

export function wouldCreateNegativeGap(state, id, newDate) {
  let bal = getCurrentCashDisplay(state);
  const txs = getMergedTransactions(state).map((t) => (t.id === id ? { ...t, date: newDate } : t))
    .filter((t) => t.status === "pending").sort((a, b) => a.date.localeCompare(b.date));
  for (const t of txs) { bal += signed(t, state.currencyMode, state.fx); if (bal < 0) return true; }
  return bal - getMonthlyBurnDisplay(state) * 2 < 0;
}

export function applyTransactionDateMove(state, id, newDate) {
  const p = (t) => (t.id === id ? { ...t, date: newDate } : t);
  return { ...state, transactions: state.transactions.map(p), scenarios: state.scenarios.map((s) => ({ ...s, transactions: s.transactions.map(p) })) };
}
