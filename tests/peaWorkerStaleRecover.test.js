/**
 * PEA worker stale-running recovery — Bug CW.
 * Hung jobs must dead-letter after attempts >= 2; unconditional `failed`
 * caused infinite reclaim (failed → claim → running → stale → failed…).
 * Run: node tests/peaWorkerStaleRecover.test.js
 */
import { claimAndRunPeaBatch } from "../server/lib/pea/peaWorker.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

async function testStaleRecoverRespectsAttempts() {
  const sqlLog = [];
  const pool = {
    async query(sql) {
      sqlLog.push(sql);
      return { rows: [], rowCount: 0 };
    },
    async connect() {
      return {
        async query(sql) {
          sqlLog.push(sql);
          if (/^BEGIN/i.test(sql)) return { rows: [] };
          if (/SELECT \* FROM pea\.jobs/i.test(sql)) return { rows: [] };
          if (/^COMMIT/i.test(sql)) return { rows: [] };
          if (/^ROLLBACK/i.test(sql)) return { rows: [] };
          return { rows: [] };
        },
        release() {},
      };
    },
  };

  const out = await claimAndRunPeaBatch(pool, { peaWorkerBatchSize: 2 }, { warn() {}, info() {} });
  assert(out.processed === 0, "CW empty claim processes 0");

  const staleSql = sqlLog.find((s) => /stale_running_recovered/i.test(s));
  assert(Boolean(staleSql), "CW stale recovery SQL runs");
  assert(
    /CASE WHEN attempts >= 2 THEN 'dead' ELSE 'failed' END/i.test(staleSql || ""),
    "CW stale recovery dead-letters when attempts >= 2",
  );
  assert(
    !/SET\s+status = 'failed',\s*error = 'stale_running_recovered'/i.test(staleSql || ""),
    "CW does not unconditionally set failed on stale reclaim",
  );
}

await testStaleRecoverRespectsAttempts();

console.log(`\npeaWorkerStaleRecover: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
