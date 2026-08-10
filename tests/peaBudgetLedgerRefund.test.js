/**
 * PEA budget ledger — refund must reverse daily spend (Bug CD).
 * Settle at full reserve keeps daily spend accurate (Bug CR).
 * Run: node tests/peaBudgetLedgerRefund.test.js
 */
import { getDailyPeaSpend, refundBudget, settleBudget } from "../server/lib/pea/budgetLedger.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

function makePool(rows) {
  const ledger = [...rows];
  return {
    ledger,
    async query(sql, params = []) {
      if (/SELECT COALESCE\(SUM\(amount_usd\)/i.test(sql)) {
        assert(
          /entry_type IN \('reserve', 'settle', 'refund'\)/.test(sql),
          "getDailyPeaSpend SQL includes refund",
        );
        const total = ledger
          .filter((r) => ["reserve", "settle", "refund"].includes(r.entry_type))
          .reduce((s, r) => s + Number(r.amount_usd), 0);
        return { rows: [{ total }] };
      }
      if (/SELECT gap_id, analysis_run_id, amount_usd, tokens FROM pea\.budget_ledger WHERE id/i.test(sql)) {
        const row = ledger.find((r) => r.id === params[0]);
        return { rows: row ? [row] : [] };
      }
      if (/SELECT gap_id, analysis_run_id, amount_usd FROM pea\.budget_ledger WHERE id/i.test(sql)) {
        const row = ledger.find((r) => r.id === params[0]);
        return { rows: row ? [row] : [] };
      }
      if (/INSERT INTO pea\.budget_ledger/i.test(sql) && /'refund'/i.test(sql)) {
        const typed = {
          id: `refund-${ledger.length + 1}`,
          gap_id: params[0],
          analysis_run_id: params[1],
          entry_type: "refund",
          amount_usd: Number(params[2]),
          tokens: Number(params[3]) || 0,
        };
        ledger.push(typed);
        return { rows: [typed] };
      }
      if (/INSERT INTO pea\.budget_ledger/i.test(sql) && /'settle'/i.test(sql)) {
        const typed = {
          id: `settle-${ledger.length + 1}`,
          gap_id: params[0],
          analysis_run_id: params[1],
          entry_type: "settle",
          amount_usd: Number(params[2]),
          tokens: Number(params[3]) || 0,
        };
        ledger.push(typed);
        return { rows: [typed] };
      }
      throw new Error(`unexpected SQL: ${sql.slice(0, 120)}`);
    },
  };
}

// ── reserve then refund → daily spend back to 0 ───────────────────────────
{
  const pool = makePool([
    {
      id: "res-1",
      gap_id: "gap-1",
      analysis_run_id: "run-1",
      entry_type: "reserve",
      amount_usd: 1.2,
      tokens: 4000,
    },
  ]);
  const before = await getDailyPeaSpend(pool);
  assert(before === 1.2, "reserve alone counts toward daily spend");
  await refundBudget(pool, "res-1", { error: "architect_llm_invalid_json" });
  const after = await getDailyPeaSpend(pool);
  assert(Math.abs(after) < 1e-9, "Bug CD: refund zeroes daily spend (was permanently burned)");
}

// ── reserve + settle(actual) nets to actual ───────────────────────────────
{
  const pool = makePool([
    {
      id: "res-2",
      gap_id: "gap-2",
      analysis_run_id: "run-2",
      entry_type: "reserve",
      amount_usd: 1.0,
      tokens: 3000,
    },
  ]);
  await settleBudget(pool, "res-2", { actualUsd: 0.4, actualTokens: 1200 });
  const spend = await getDailyPeaSpend(pool);
  assert(Math.abs(spend - 0.4) < 1e-9, "reserve+settle nets to actual spend");
}

// ── Bug CR: analyze_gap must not settle at 50% of reserve ─────────────────
{
  const pool = makePool([
    {
      id: "res-3",
      gap_id: "gap-3",
      analysis_run_id: "run-3",
      entry_type: "reserve",
      amount_usd: 2.0,
      tokens: 5000,
    },
  ]);
  // Correct settle uses full reserved amount → delta 0 → daily spend stays reserved.
  await settleBudget(pool, "res-3", { actualUsd: 2.0, actualTokens: 5000 });
  const spend = await getDailyPeaSpend(pool);
  assert(Math.abs(spend - 2.0) < 1e-9, "Bug CR: full-reserve settle keeps daily spend = reserved");

  const here = dirname(fileURLToPath(import.meta.url));
  const analyzeSrc = readFileSync(join(here, "../server/lib/pea/analyzeGapJob.js"), "utf8");
  assert(
    !/reservedUsd\s*\*\s*0\.5/.test(analyzeSrc),
    "Bug CR: analyzeGapJob no longer settles at reservedUsd * 0.5",
  );
  assert(
    /actualUsd:\s*preflight\.reservedUsd/.test(analyzeSrc),
    "Bug CR: analyzeGapJob settles at preflight.reservedUsd",
  );
}

console.log(`\npeaBudgetLedgerRefund: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
