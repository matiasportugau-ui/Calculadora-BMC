/**
 * WA Cockpit — SLA Worker Integration Tests
 */
import dotenv from "dotenv";
import { getWaPool, resetWaPoolForTests } from "../server/lib/waDb.js";
import { startWaSlaWorker } from "../server/lib/waSlaWorker.js";
import { primeWaConfig, setSetting, setFlag, _resetWaConfigForTests } from "../server/lib/waConfig.js";
import { initWaWebhooks, _resetWaWebhooksForTests } from "../server/lib/waWebhooks.js";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || "postgres://localhost/bmc_wa_local";

/** @param {import("pg").Pool | null} pool */
async function dbReachable(pool) {
  if (!pool) return false;
  try {
    const r = await pool.query("select 1 as ok");
    return Number(r?.rows?.[0]?.ok) === 1;
  } catch {
    return false;
  }
}

async function runTests() {
  console.log("=== WA SLA Worker Integration Tests ===");
  const pool = getWaPool(DATABASE_URL);

  if (!(await dbReachable(pool))) {
    console.warn(
      "SKIP: PostgreSQL not reachable (DATABASE_URL). WA SLA integration tests need a live DB and migrations.",
    );
    await resetWaPoolForTests();
    process.exit(0);
  }

  let stopWorker = null;
  let testChatId = null;

  try {
    // 0. Setup
    await primeWaConfig({ pool });
    initWaWebhooks({ pool });

    // Enable SLA tracking
    await setFlag("slaTracking.enabled", { enabled: true });
    await setSetting("sla.unrepliedAlertHours", 0.1); // 6 mins
    await setSetting("sla.unassignedAlertHours", 0.1);
    await setSetting("sla.workerIntervalMs", 1000);

    testChatId = "test_sla_" + Date.now();

    // 1. Unassigned Breach
    console.log("→ Testing unassigned breach...");
    await pool.query(
      `insert into wa_conversations (chat_id, created_at) values ($1, now() - interval '1 hour')`,
      [testChatId],
    );

    stopWorker = startWaSlaWorker({ pool, logger: console });

    // Wait for tick
    await new Promise((r) => setTimeout(r, 2500));

    const { rows: breaches } = await pool.query(
      "select * from wa_sla_breaches where chat_id = $1 and resolved_at is null",
      [testChatId],
    );

    if (breaches.some((b) => b.kind === "unassigned")) {
      console.log("✓ Unassigned breach detected");
    } else {
      throw new Error("Unassigned breach NOT detected");
    }

    // 2. Resolve Unassigned (assign owner)
    console.log("→ Testing resolution of unassigned...");
    await pool.query("update wa_conversations set owner_op = 'test_op' where chat_id = $1", [testChatId]);

    await new Promise((r) => setTimeout(r, 1000));

    const { rows: resolved } = await pool.query(
      "select * from wa_sla_breaches where chat_id = $1 and kind = 'unassigned' and resolved_at is not null",
      [testChatId],
    );

    if (resolved.length > 0) {
      console.log("✓ Unassigned breach resolved");
    } else {
      throw new Error("Unassigned breach NOT resolved after assignment");
    }

    // 3. Unreplied Breach
    console.log("→ Testing unreplied breach...");
    await pool.query(
      "update wa_conversations set last_msg_in_at = now() - interval '1 hour', last_msg_out_at = now() - interval '2 hours' where chat_id = $1",
      [testChatId],
    );

    await new Promise((r) => setTimeout(r, 2500));

    const { rows: unreplied } = await pool.query(
      "select * from wa_sla_breaches where chat_id = $1 and kind = 'unreplied' and resolved_at is null",
      [testChatId],
    );

    if (unreplied.length > 0) {
      console.log("✓ Unreplied breach detected");
    } else {
      throw new Error("Unreplied breach NOT detected");
    }

    // 4. Resolve Unreplied (send message out)
    console.log("→ Testing resolution of unreplied...");
    await pool.query("update wa_conversations set last_msg_out_at = now() where chat_id = $1", [testChatId]);

    await new Promise((r) => setTimeout(r, 1000));

    const { rows: unrepliedResolved } = await pool.query(
      "select * from wa_sla_breaches where chat_id = $1 and kind = 'unreplied' and resolved_at is not null",
      [testChatId],
    );

    if (unrepliedResolved.length > 0) {
      console.log("✓ Unreplied breach resolved");
    } else {
      throw new Error("Unreplied breach NOT resolved after reply");
    }

    console.log("✓ Cleanup done");
    console.log("=== WA SLA Tests Passed ===");
  } catch (e) {
    console.error("TEST FAILED:", e);
    process.exitCode = 1;
  } finally {
    stopWorker?.();
    if (testChatId && pool) {
      await pool.query("delete from wa_sla_breaches where chat_id = $1", [testChatId]).catch(() => {});
      await pool.query("delete from wa_conversations where chat_id = $1", [testChatId]).catch(() => {});
    }
    _resetWaWebhooksForTests();
    _resetWaConfigForTests();
    await resetWaPoolForTests();
  }

  if (process.exitCode === 1) {
    process.exit(1);
  }
}

runTests();
