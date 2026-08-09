/**
 * PAOS feature flags — defaults OFF preserve current prod behavior (SDD ADR / IMP guide).
 */

function flag(name, defaultOff = true) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return !defaultOff ? true : false;
  }
  return /^(1|true|yes|on)$/i.test(String(raw).trim());
}

function numEnv(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? n : fallback;
}

/** Master switch — when false, PAOS mutators and gates are no-ops. */
export function isPaosEnabled() {
  return flag("PAOS_ENABLED", true);
}

/** Allow promoter writes to Training KB via PAOS path. */
export function isPaosPromoteEnabled() {
  return isPaosEnabled() && flag("PAOS_PROMOTE", true);
}

/** 0–100 staff/session canary fraction (TARGET; not enforced in v1 ledger). */
export function paosCanaryPct() {
  const n = numEnv("PAOS_CANARY_PCT", 0);
  return Math.max(0, Math.min(100, n));
}

export function paosLedgerRetentionDays() {
  return Math.max(1, numEnv("PAOS_LEDGER_RETENTION_DAYS", 90));
}

export function getPaosFlags() {
  return {
    enabled: isPaosEnabled(),
    promote: isPaosPromoteEnabled(),
    canaryPct: paosCanaryPct(),
    ledgerRetentionDays: paosLedgerRetentionDays(),
  };
}
