/**
 * Offline eval helpers for Learning Candidates (IMP-PAOS-03).
 * Money: never pass a candidate that invents numeric prices without calcProvenance.
 * Full golden suite remains CI-side; this is the in-process gate.
 */

/**
 * Detect money-adjacent deltas that must not invent prices.
 * @param {object} delta
 */
export function isMoneyAdjacent(delta = {}) {
  const blob = JSON.stringify(delta || {}).toLowerCase();
  if (!blob) return false;
  // Amount-like signals (not mere words "precio/price" alone)
  if (/\$\s*\d|usd\s*\d|u\$s|\d+[.,]\d{2}\s*(usd|u\$s)?|\/\s*m2|m²|iva\s*22\s*%?/.test(blob)) {
    return true;
  }
  // "precio/price" only when a number is also present (likely a quote amount)
  if (/\b(precios?|prices?|costos?)\b/.test(blob) && /\d{2,}/.test(blob)) {
    return true;
  }
  return false;
}

/**
 * Structural + money guard eval.
 * @param {{ delta?: object, evalHints?: object }} candidateLike
 * @returns {{ pass: boolean, details: object }}
 */
export function evaluateCandidateOffline(candidateLike = {}) {
  const delta = candidateLike.delta || {};
  const question = String(delta.question || delta.q || "").trim();
  const goodAnswer = String(delta.goodAnswer || delta.answer || "").trim();
  const details = {
    kind: "paos_offline_v1",
    checks: {},
  };

  if (!question || question.length < 3) {
    details.checks.question = "fail_too_short";
    return { pass: false, details };
  }
  details.checks.question = "ok";

  if (!goodAnswer || goodAnswer.length < 8) {
    details.checks.goodAnswer = "fail_too_short";
    return { pass: false, details };
  }
  details.checks.goodAnswer = "ok";

  if (isMoneyAdjacent(delta)) {
    details.checks.moneyAdjacent = true;
    const proven =
      delta.calcProvenance === true ||
      delta.calcProvenance === "ae_agent" ||
      delta.source === "calc_oracle" ||
      delta.totalUsd != null ||
      delta.calcResult != null;
    if (!proven) {
      details.checks.money = "fail_no_calc_provenance";
      return { pass: false, details };
    }
    details.checks.money = "ok_with_provenance";
  } else {
    details.checks.moneyAdjacent = false;
  }

  // Hard reject improvised-price patterns without provenance already handled
  if (/sin\s*herramienta|invent(e|é)|aproximad/i.test(goodAnswer) && isMoneyAdjacent(delta)) {
    details.checks.honesty = "fail_improvised_language";
    return { pass: false, details };
  }
  details.checks.honesty = "ok";

  return { pass: true, details };
}
