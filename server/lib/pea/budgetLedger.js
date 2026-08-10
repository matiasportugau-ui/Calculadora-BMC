/**
 * PEA budget ledger — persistent reservations separate from Panelin chat budget.
 */

/**
 * @param {import('pg').Pool} pool
 */
export async function getDailyPeaSpend(pool) {
  // Include refund (negative amounts) so failed analyze_gap paths that call
  // refundBudget do not permanently burn peaAutoDailyBudgetUsd (Bug CD).
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(amount_usd), 0)::float AS total
       FROM pea.budget_ledger
      WHERE entry_type IN ('reserve', 'settle', 'refund')
        AND created_at >= date_trunc('day', now())`,
  );
  return rows[0]?.total ?? 0;
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ gapId?: string|null, analysisRunId?: string|null, amountUsd: number, tokens?: number, metadata?: object }} args
 */
export async function reserveBudget(pool, args) {
  const { rows } = await pool.query(
    `INSERT INTO pea.budget_ledger
       (gap_id, analysis_run_id, entry_type, amount_usd, tokens, metadata)
     VALUES ($1, $2, 'reserve', $3, $4, $5::jsonb)
     RETURNING id, amount_usd, tokens, created_at`,
    [
      args.gapId || null,
      args.analysisRunId || null,
      args.amountUsd,
      args.tokens || 0,
      JSON.stringify(args.metadata || {}),
    ],
  );
  return rows[0];
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} reserveId
 * @param {{ actualUsd: number, actualTokens?: number, metadata?: object }} args
 */
export async function settleBudget(pool, reserveId, args) {
  const { rows: src } = await pool.query(
    `SELECT gap_id, analysis_run_id, amount_usd FROM pea.budget_ledger WHERE id = $1`,
    [reserveId],
  );
  const base = src[0];
  if (!base) return null;
  const delta = args.actualUsd - Number(base.amount_usd);
  const { rows } = await pool.query(
    `INSERT INTO pea.budget_ledger
       (gap_id, analysis_run_id, entry_type, amount_usd, tokens, metadata)
     VALUES ($1, $2, 'settle', $3, $4, $5::jsonb)
     RETURNING id`,
    [
      base.gap_id,
      base.analysis_run_id,
      delta,
      args.actualTokens || 0,
      JSON.stringify({ reserve_id: reserveId, ...(args.metadata || {}) }),
    ],
  );
  return rows[0];
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} reserveId
 * @param {object} [metadata]
 */
export async function refundBudget(pool, reserveId, metadata = {}) {
  const { rows: src } = await pool.query(
    `SELECT gap_id, analysis_run_id, amount_usd, tokens FROM pea.budget_ledger WHERE id = $1`,
    [reserveId],
  );
  const base = src[0];
  if (!base) return null;
  const { rows } = await pool.query(
    `INSERT INTO pea.budget_ledger
       (gap_id, analysis_run_id, entry_type, amount_usd, tokens, metadata)
     VALUES ($1, $2, 'refund', $3, $4, $5::jsonb)
     RETURNING id`,
    [
      base.gap_id,
      base.analysis_run_id,
      -Number(base.amount_usd),
      -(base.tokens || 0),
      JSON.stringify({ reserve_id: reserveId, ...metadata }),
    ],
  );
  return rows[0];
}
