/**
 * Recovery meeting snapshot for Hub Finanzas «Recuperación».
 * Payload shape mirrors IAlfred ~/.ialfred/ops/plan-recuperacion/viz/data.json
 */
const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS public.finanzas_recovery_snapshots (
  id            bigserial PRIMARY KEY,
  as_of         date,
  payload       jsonb NOT NULL,
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS finanzas_recovery_snapshots_created_at_idx
  ON public.finanzas_recovery_snapshots (created_at DESC);
`;

/** @type {WeakMap<object, boolean>} */
const ensured = new WeakMap();

export async function ensureRecoverySnapshotTable(pool) {
  if (!pool) return;
  if (ensured.get(pool)) return;
  await pool.query(CREATE_SQL);
  ensured.set(pool, true);
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, payload: object } | { ok: false, error: string }}
 */
export function validateRecoveryPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "payload_required" };
  }
  const kpi = body.kpi;
  if (!kpi || typeof kpi !== "object" || Array.isArray(kpi)) {
    return { ok: false, error: "kpi_required" };
  }
  const numOrNull = (v) => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const payload = {
    as_of: typeof body.as_of === "string" ? body.as_of : null,
    bank_period_end: typeof body.bank_period_end === "string" ? body.bank_period_end : null,
    bank_generated_at: typeof body.bank_generated_at === "string" ? body.bank_generated_at : null,
    entity: typeof body.entity === "string" ? body.entity : null,
    kpi: {
      cash_uyu: numOrNull(kpi.cash_uyu),
      cash_usd: numOrNull(kpi.cash_usd),
      debt_bank_capital: numOrNull(kpi.debt_bank_capital),
      debt_bank_capital_note: kpi.debt_bank_capital_note ?? null,
      debt_ap: numOrNull(kpi.debt_ap),
      debt_ap_note: kpi.debt_ap_note ?? null,
      pipeline_usd: numOrNull(kpi.pipeline_usd),
      gap_30d_usd_proxy: numOrNull(kpi.gap_30d_usd_proxy),
      loan_service_usd_proxy: numOrNull(kpi.loan_service_usd_proxy),
      overdue_fixed_uyu_sum: numOrNull(kpi.overdue_fixed_uyu_sum),
    },
    sales_monthly: Array.isArray(body.sales_monthly) ? body.sales_monthly : [],
    pipeline: Array.isArray(body.pipeline) ? body.pipeline : [],
    waterfall_usd: Array.isArray(body.waterfall_usd) ? body.waterfall_usd : [],
    obligations: Array.isArray(body.obligations) ? body.obligations : [],
    sources: Array.isArray(body.sources) ? body.sources : [],
    disclaimers: Array.isArray(body.disclaimers) ? body.disclaimers : [],
  };
  return { ok: true, payload };
}

export async function getLatestRecoverySnapshot(pool) {
  await ensureRecoverySnapshotTable(pool);
  const { rows } = await pool.query(
    `select id, as_of, payload, created_by, created_at
       from public.finanzas_recovery_snapshots
      order by created_at desc
      limit 1`,
  );
  return rows[0] || null;
}

/**
 * @param {import("pg").Pool} pool
 * @param {object} payload validated payload
 * @param {{ createdBy?: string }} [meta]
 */
export async function putRecoverySnapshot(pool, payload, meta = {}) {
  await ensureRecoverySnapshotTable(pool);
  const asOf = payload.as_of && /^\d{4}-\d{2}-\d{2}/.test(payload.as_of)
    ? payload.as_of.slice(0, 10)
    : null;
  const { rows } = await pool.query(
    `insert into public.finanzas_recovery_snapshots (as_of, payload, created_by)
     values ($1, $2::jsonb, $3)
     returning id, as_of, payload, created_by, created_at`,
    [asOf, JSON.stringify(payload), meta.createdBy || null],
  );
  return rows[0];
}

/** Reset ensure cache (tests). */
export function __resetRecoverySnapshotEnsureForTests() {
  // WeakMap has no clear; new pools get re-ensured. No-op kept for API symmetry.
}
