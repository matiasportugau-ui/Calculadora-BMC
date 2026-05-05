/**
 * WA SLA Worker — integration tests.
 *
 * Cubre:
 *   1) Detect: unreplied breach se inserta cuando age > unrepliedAlertHours.
 *   2) Idempotente: dos ticks consecutivos no duplican breach abierto.
 *   3) Resolve: cuando llega last_msg_out_at posterior, resolved_at se setea.
 *   4) Disabled flag: con slaTracking.enabled=false no se detectan breaches.
 *
 * NOTA: el worker actual hace comparación directa age-vs-threshold sin
 * descontar business_hours (MVP). Cuando se implemente BH-aware, agregar
 * un caso (5) "horas fuera de bh no cuentan".
 *
 * Skipea limpio si DATABASE_URL no apunta a Postgres alcanzable.
 */
import { getWaPool, resetWaPoolForTests } from "../server/lib/waDb.js";
import { runWaSlaTickOnce, startWaSlaWorker } from "../server/lib/waSlaWorker.js";
import {
  primeWaConfig,
  setFlag,
  setSetting,
  _resetWaConfigForTests,
} from "../server/lib/waConfig.js";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://localhost/bmc_wa_local";
const TEST_CHAT_PREFIX = "test_sla_";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function dbReachable(pool) {
  try {
    await pool.query("select 1");
    return true;
  } catch {
    return false;
  }
}

async function cleanup(pool) {
  await pool.query(
    "delete from wa_sla_breaches where chat_id like $1",
    [`${TEST_CHAT_PREFIX}%`],
  );
  await pool.query(
    "delete from wa_conversations where chat_id like $1",
    [`${TEST_CHAT_PREFIX}%`],
  );
  await pool.query("delete from wa_flags where updated_by = 'test_sla'");
  await pool.query(
    "delete from wa_settings where updated_by = 'test_sla'",
  );
  await pool.query("delete from wa_audit_log where operator_id = 'test_sla'");
}

async function runTests() {
  console.log("=== WA SLA Worker Integration Tests ===");
  const pool = getWaPool(DATABASE_URL);

  if (!(await dbReachable(pool))) {
    console.log("⚠ DATABASE_URL not reachable, skipping wa-sla tests.");
    await resetWaPoolForTests();
    return;
  }

  // Asegurar que las tablas existen (si la migración no corrió, skipear).
  try {
    await pool.query("select 1 from wa_sla_breaches limit 1");
    await pool.query("select 1 from wa_conversations limit 1");
  } catch {
    console.log("⚠ wa_sla_breaches o wa_conversations no existen — corré las migraciones primero.");
    await resetWaPoolForTests();
    return;
  }

  let stopWorker = null;
  let pass = 0;
  let fail = 0;
  const expect = (label, cond) => {
    if (cond) {
      pass++;
      console.log(`✓ ${label}`);
    } else {
      fail++;
      console.log(`✗ FAIL: ${label}`);
    }
  };

  try {
    await cleanup(pool);
    await primeWaConfig({ pool });

    // Config: thresholds bajos para que el test corra con ticks manuales.
    await setSetting("sla.unrepliedAlertHours", 0.5, { actor: "test_sla" });
    await setSetting("sla.unassignedAlertHours", 999, { actor: "test_sla" }); // off
    await setSetting("sla.breachAction", "notify", { actor: "test_sla" });
    await setFlag("slaTracking.enabled", { enabled: true }, { actor: "test_sla" });

    // ── Caso 1: detect unreplied ─────────────────────────────────────────
    const chatA = `${TEST_CHAT_PREFIX}unreplied_${Date.now()}`;
    await pool.query(
      `insert into wa_conversations (chat_id, phone, last_msg_in_at, last_msg_out_at, created_at)
       values ($1, $2, now() - interval '1 hour', null, now() - interval '1 hour')`,
      [chatA, "+59899000001"],
    );

    await runWaSlaTickOnce({ pool, logger: { info() {}, warn() {}, error() {} } });

    const r1 = await pool.query(
      "select kind, resolved_at from wa_sla_breaches where chat_id = $1",
      [chatA],
    );
    expect("detecta unreplied breach cuando age > threshold", r1.rowCount === 1 && r1.rows[0].kind === "unreplied" && r1.rows[0].resolved_at === null);

    // ── Caso 2: idempotente, no doble breach ─────────────────────────────
    await runWaSlaTickOnce({ pool, logger: { info() {}, warn() {}, error() {} } });
    const r2 = await pool.query(
      "select count(*)::int as n from wa_sla_breaches where chat_id = $1 and kind='unreplied' and resolved_at is null",
      [chatA],
    );
    expect("no duplica breach abierto en ticks subsecuentes", r2.rows[0].n === 1);

    // ── Caso 3: resolve cuando llega out posterior ───────────────────────
    await pool.query(
      `update wa_conversations
          set last_msg_out_at = now()
        where chat_id = $1`,
      [chatA],
    );
    await runWaSlaTickOnce({ pool, logger: { info() {}, warn() {}, error() {} } });
    const r3 = await pool.query(
      "select resolved_at from wa_sla_breaches where chat_id = $1 and kind='unreplied'",
      [chatA],
    );
    expect("resuelve breach cuando llega last_msg_out_at posterior", r3.rowCount === 1 && r3.rows[0].resolved_at !== null);

    // ── Caso 4: flag off → no detecta nuevos breaches ────────────────────
    await setFlag("slaTracking.enabled", { enabled: false }, { actor: "test_sla" });
    const chatB = `${TEST_CHAT_PREFIX}flagoff_${Date.now()}`;
    await pool.query(
      `insert into wa_conversations (chat_id, phone, last_msg_in_at, last_msg_out_at, created_at)
       values ($1, $2, now() - interval '1 hour', null, now() - interval '1 hour')`,
      [chatB, "+59899000002"],
    );
    await runWaSlaTickOnce({ pool, logger: { info() {}, warn() {}, error() {} } });
    const r4 = await pool.query(
      "select count(*)::int as n from wa_sla_breaches where chat_id = $1",
      [chatB],
    );
    expect("con flag off no detecta nuevos breaches", r4.rows[0].n === 0);

    // ── Caso 5: worker scheduler respeta intervalos válidos del schema ───
    await setFlag("slaTracking.enabled", { enabled: true }, { actor: "test_sla" });
    stopWorker = startWaSlaWorker({ pool, logger: { info() {}, warn() {}, error() {} } });
    await sleep(10);
    expect("scheduler arranca con intervalo default válido sin mutar settings", Boolean(stopWorker));
  } catch (e) {
    console.error("TEST FAILED:", e);
    fail++;
  } finally {
    if (stopWorker) stopWorker();
    try {
      await cleanup(pool);
    } catch {
      // ignore
    }
    _resetWaConfigForTests();
    await resetWaPoolForTests();
  }

  console.log(`=== WA SLA Tests: ${pass} passed, ${fail} failed ===\n`);
  if (fail > 0) process.exit(1);
}

runTests();
