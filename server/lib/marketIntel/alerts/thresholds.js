// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15

/**
 * Alert threshold defaults — all overridable via environment variables.
 * @returns {{ warnPct: number, criticalPct: number, criticalOfflineRuns: number }}
 */
export function getThresholds() {
  return {
    warnPct: parseInt(process.env.ALERT_WARN_PCT ?? '5', 10),
    criticalPct: parseInt(process.env.ALERT_CRITICAL_PCT ?? '15', 10),
    criticalOfflineRuns: parseInt(process.env.ALERT_CRITICAL_OFFLINE_RUNS ?? '2', 10),
  };
}

/**
 * Determine alert level based on absolute percentage change.
 *
 * @param {number} pctChange - absolute % change (always positive)
 * @param {{ warnPct: number, criticalPct: number }} thresholds
 * @returns {'info'|'warning'|'critical'}
 */
export function determineAlertLevel(pctChange, thresholds) {
  if (pctChange >= thresholds.criticalPct) return 'critical';
  if (pctChange >= thresholds.warnPct) return 'warning';
  return 'info';
}
