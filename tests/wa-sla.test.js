/**
 * WA Cockpit — SLA Worker Integration Tests
 */
import pg from "pg";
import dotenv from "dotenv";
import { startWaSlaWorker } from "../server/lib/waSlaWorker.js";
import { primeWaConfig, setSetting, setFlag } from "../server/lib/waConfig.js";
import { initWaWebhooks } from "../server/lib/waWebhooks.js";

dotenv.config();

const { Pool } = pg;

async function runTests() {
  console.log("=== WA SLA Worker Integration Tests ===");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // 0. Setup
    await primeWaConfig({ pool });
    initWaWebhooks({ pool });

    // Enable SLA tracking
    await setFlag("slaTracking.enabled", { enabled: true });
    await setSetting("sla.unrepliedAlertHours", 0.1); // 6 mins
    await setSetting("sla.unassignedAlertHours", 0.1);
    await setSetting("sla.workerIntervalMs", 1000);

    const testChatId = "test_sla_" + Date.now();

    // 1. Unassigned Breach
    console.log("→ Testing unassigned breach...");
    await pool.query(
      `insert into wa_conversations (chat_id, created_at) values ($1, now() - interval '1 hour')`,
      [testChatId]
    );

    const stopWorker = startWaSlaWorker({ pool, logger: console });

    // Wait for tick
    await new Promise((r) => setTimeout(r, 2500));

    const { rows: breaches } = await pool.query(
      "select * from wa_sla_breaches where chat_id = $1 and resolved_at is null",
      [testChatId]
    );

    if (breaches.some((b) => b.kind === "unassigned")) {
      console.log("✓ Unassigned breach detected");
    } else {
      throw new Error("Unassigned breach NOT detected");
    }

    // 2. Resolve Unassigned (assign owner)
    console.log("→ Testing resolution of unassigned...");
    await pool.query(
      "update wa_conversations set owner_op = 'test_op' where chat_id = $1",
      [testChatId]
    );

    await new Promise((r) => setTimeout(r, 1000));

    const { rows: resolved } = await pool.query(
      "select * from wa_sla_breaches where chat_id = $1 and kind = 'unassigned' and resolved_at is not null",
      [testChatId]
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
      [testChatId]
    );

    await new Promise((r) => setTimeout(r, 2500));

    const { rows: unreplied } = await pool.query(
      "select * from wa_sla_breaches where chat_id = $1 and kind = 'unreplied' and resolved_at is null",
      [testChatId]
    );

    if (unreplied.length > 0) {
      console.log("✓ Unreplied breach detected");
    } else {
      throw new Error("Unreplied breach NOT detected");
    }

    // 4. Resolve Unreplied (send message out)
    console.log("→ Testing resolution of unreplied...");
    await pool.query(
      "update wa_conversations set last_msg_out_at = now() where chat_id = $1",
      [testChatId]
    );

    await new Promise((r) => setTimeout(r, 1000));

    const { rows: unrepliedResolved } = await pool.query(
      "select * from wa_sla_breaches where chat_id = $1 and kind = 'unreplied' and resolved_at is not null",
      [testChatId]
    );

    if (unrepliedResolved.length > 0) {
      console.log("✓ Unreplied breach resolved");
    } else {
      throw new Error("Unreplied breach NOT resolved after reply");
    }

    stopWorker();
    console.log("✓ Cleanup done");
    console.log("=== WA SLA Tests Passed ===");
  } catch (e) {
    console.error("TEST FAILED:", e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
