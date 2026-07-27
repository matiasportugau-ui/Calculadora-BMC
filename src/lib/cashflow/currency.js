export function isUnifiedModeAvailable(mode, fx) {
  if (mode !== "unified_uyu" && mode !== "unified_usd") return true;
  return fx != null && Number(fx.rate) > 0;
}

export function convertAmount(amount, currency, mode, fx) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  if (mode === "uyu") return currency === "UYU" ? n : null;
  if (mode === "usd") return currency === "USD" ? n : null;
  if (!fx?.rate) return null;
  const rate = Number(fx.rate);
  if (mode === "unified_uyu") return currency === "UYU" ? n : n * rate;
  if (mode === "unified_usd") return currency === "USD" ? n : n / rate;
  return null;
}

export function getCurrentCashDisplay(state) {
  const { currencyMode, fx, currentCashUyu, currentCashUsd } = state;
  if (currencyMode === "uyu") return currentCashUyu;
  if (currencyMode === "usd") return currentCashUsd;
  if (!fx?.rate) return 0;
  return currencyMode === "unified_uyu"
    ? currentCashUyu + currentCashUsd * fx.rate
    : currentCashUsd + currentCashUyu / fx.rate;
}

/**
 * Company-level burn must always be expressed in the active display unit.
 * Single-currency modes (uyu/usd) filter transactions, but burn is one figure —
 * convert via FX when the stored burn currency differs. Never fall back to the
 * raw amount in the wrong currency (that poisoned USD runway/KPIs).
 */
export function getMonthlyBurnDisplay(state) {
  const { currencyMode, fx, monthlyBurn, monthlyBurnCurrency } = state;
  const displayMode =
    currencyMode === "uyu" ? "unified_uyu" :
    currencyMode === "usd" ? "unified_usd" :
    currencyMode;
  const converted = convertAmount(monthlyBurn, monthlyBurnCurrency, displayMode, fx);
  if (converted != null) return converted;
  // Same-currency path without FX, or unavailable conversion → 0 (runway becomes null)
  return convertAmount(monthlyBurn, monthlyBurnCurrency, currencyMode, fx) ?? 0;
}

export function getTransactionDisplayAmount(tx, mode, fx) {
  if ((mode === "uyu" && tx.currency !== "UYU") || (mode === "usd" && tx.currency !== "USD")) {
    if (mode === "uyu" || mode === "usd") return null;
  }
  return convertAmount(tx.amount, tx.currency, mode, fx);
}
