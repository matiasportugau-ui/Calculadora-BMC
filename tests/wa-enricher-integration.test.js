// ═══════════════════════════════════════════════════════════════════════════
// WA Cockpit — integration tests against a real Postgres
//
// Estos tests validan las garantías SQL que protegen al wa enricher worker:
//   - FOR UPDATE SKIP LOCKED: no double-claim entre instancias.
//   - Índice parcial único en wa_suggestions (migración 008).
//   - Índice parcial único en wa_quotes (AI only) (migración 008).
//   - SAVEPOINT rollback aislado (no aborta tx).
//   - CHECK constraint + backfill de enrichment_status (migración 009).
//
// Gated por WA_TEST_DATABASE_URL o DATABASE_URL — en ausencia se skipean
// (sin fallar) para que el `npm run gate:local` por defecto siga pasando
// sin Postgres. Ejecutar con:
//
//   WA_TEST_DATABASE_URL=postgres://localhost/bmc_test npm run test:wa-integration
//
// La DB debe tener migraciones 000..009 ya aplicadas (npm run wa:migrate).
// ═══════════════════════════════════════════════════════════════════════════

import pg from "pg";

const url = process.env.WA_TEST_DATABASE_URL || process.env.DATABASE_URL;

if (!url) {
  console.log("⚠️  WA enricher integration tests SKIPPED");
  console.log("   Set WA_TEST_DATABASE_URL or DATABASE_URL to a Postgres with wa_* migrations applied.");
  process.exit(0);
}

const RUN_ID = `integ-${process.pid}-${Date.now()}`;
const CHAT_PREFIX = `${RUN_ID}-chat`;
const MSG_PREFIX = `${RUN_ID}-msg`;

let passed = 0;
let failed = 0;

function assert(name, cond, detail) {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function cleanup(pool) {
  // Borrar en orden para no romper FKs.
  await pool.query(`delete from wa_quotes where chat_id like $1`, [`${CHAT_PREFIX}%`]);
  await pool.query(`delete from wa_suggestions where chat_id like $1`, [`${CHAT_PREFIX}%`]);
  await pool.query(`delete from wa_followups where chat_id like $1`, [`${CHAT_PREFIX}%`]);
  await pool.query(`delete from wa_messages where chat_id like $1`, [`${CHAT_PREFIX}%`]);
  await pool.query(`delete from wa_conversations where chat_id like $1`, [`${CHAT_PREFIX}%`]);
}

async function seedConv(pool, chatId) {
  await pool.query(
    `insert into wa_conversations (chat_id) values ($1) on conflict (chat_id) do nothing`,
    [chatId],
  );
}

async function seedMsg(pool, { chatId, msgId, ts, text = "test", direction = "in" }) {
  await pool.query(
    `insert into wa_messages (msg_id, chat_id, ts, direction, type, text)
     values ($1, $2, $3::timestamptz, $4, 'text', $5)`,
    [msgId, chatId, ts, direction, text],
  );
}

async function main() {
  const pool = new pg.Pool({ connectionString: url, max: 6 });

  console.log(`\n═══ WA Cockpit · integration tests (run=${RUN_ID}) ═══\n`);

  try {
    await cleanup(pool);

    // ── Test 1: FOR UPDATE SKIP LOCKED → no overlap entre claimers concurrentes ──
    {
      const chatId = `${CHAT_PREFIX}-1`;
      await seedConv(pool, chatId);
      const baseTs = "2026-05-04T10:00:00Z";
      for (let i = 0; i < 5; i++) {
        await seedMsg(pool, {
          chatId,
          msgId: `${MSG_PREFIX}-1-${i}`,
          ts: new Date(`2026-05-04T10:0${i}:00Z`).toISOString(),
        });
      }

      const a = await pool.connect();
      const b = await pool.connect();
      try {
        await a.query("begin");
        await b.query("begin");

        const claimSql = `select msg_id from wa_messages
                          where enriched_at is null and direction='in' and text is not null
                            and chat_id = $1
                          order by ts asc
                          limit 3
                          for update skip locked`;
        const aRows = await a.query(claimSql, [chatId]);
        const bRows = await b.query(claimSql, [chatId]);

        const aIds = new Set(aRows.rows.map((r) => r.msg_id));
        const bIds = new Set(bRows.rows.map((r) => r.msg_id));
        const overlap = [...aIds].filter((id) => bIds.has(id));

        assert("[skip-locked] worker A got 3 rows", aIds.size === 3, `got ${aIds.size}`);
        assert("[skip-locked] worker B got 2 rows (rest)", bIds.size === 2, `got ${bIds.size}`);
        assert("[skip-locked] no overlap between A and B", overlap.length === 0, `overlap=${overlap.join(",")}`);

        await a.query("commit");
        await b.query("commit");
      } finally {
        a.release();
        b.release();
      }
    }

    // ── Test 2: índice parcial único en wa_suggestions ──
    {
      const chatId = `${CHAT_PREFIX}-2`;
      const msgId = `${MSG_PREFIX}-2-uniq`;
      await seedConv(pool, chatId);
      await seedMsg(pool, { chatId, msgId, ts: "2026-05-04T11:00:00Z" });

      // Primer insert → ok
      await pool.query(
        `insert into wa_suggestions (chat_id, trigger_msg_id, intent, options)
         values ($1, $2, 'cotizacion', '[]'::jsonb)`,
        [chatId, msgId],
      );

      // Segundo insert sin ON CONFLICT → debe romper por unique index
      let rawDuplicateRejected = false;
      try {
        await pool.query(
          `insert into wa_suggestions (chat_id, trigger_msg_id, intent, options)
           values ($1, $2, 'cotizacion', '[]'::jsonb)`,
          [chatId, msgId],
        );
      } catch (e) {
        rawDuplicateRejected = /duplicate|unique/i.test(e.message);
      }
      assert("[suggestions-unique] raw duplicate rejected", rawDuplicateRejected);

      // Con ON CONFLICT DO UPDATE → debe upsertear, no fallar
      const upd = await pool.query(
        `insert into wa_suggestions (chat_id, trigger_msg_id, intent, options)
         values ($1, $2, 'consulta_tecnica', '[]'::jsonb)
         on conflict (trigger_msg_id) where trigger_msg_id is not null
         do update set intent = excluded.intent, generated_at = now()
         returning intent`,
        [chatId, msgId],
      );
      assert("[suggestions-unique] ON CONFLICT DO UPDATE works", upd.rows[0]?.intent === "consulta_tecnica");

      // Conteo final: una sola fila para este trigger_msg_id
      const cnt = await pool.query(
        `select count(*)::int as n from wa_suggestions where trigger_msg_id = $1`,
        [msgId],
      );
      assert("[suggestions-unique] exactly 1 row after upsert", cnt.rows[0].n === 1, `got ${cnt.rows[0].n}`);
    }

    // ── Test 3: índice parcial único en wa_quotes (solo AI) ──
    {
      const chatId = `${CHAT_PREFIX}-3`;
      const msgId = `${MSG_PREFIX}-3-q`;
      await seedConv(pool, chatId);
      await seedMsg(pool, { chatId, msgId, ts: "2026-05-04T12:00:00Z" });

      // 1ª AI quote → ok
      await pool.query(
        `insert into wa_quotes (chat_id, trigger_msg_id, generated_by_ai, params)
         values ($1, $2, true, '{}'::jsonb)`,
        [chatId, msgId],
      );

      // 2ª AI quote con mismo trigger → debe romper
      let aiDupRejected = false;
      try {
        await pool.query(
          `insert into wa_quotes (chat_id, trigger_msg_id, generated_by_ai, params)
           values ($1, $2, true, '{}'::jsonb)`,
          [chatId, msgId],
        );
      } catch (e) {
        aiDupRejected = /duplicate|unique/i.test(e.message);
      }
      assert("[quotes-unique] AI duplicate rejected", aiDupRejected);

      // Manual quote con mismo trigger → debe pasar (fuera del índice parcial)
      let manualOk = false;
      try {
        await pool.query(
          `insert into wa_quotes (chat_id, trigger_msg_id, generated_by_ai, params)
           values ($1, $2, false, '{}'::jsonb)`,
          [chatId, msgId],
        );
        manualOk = true;
      } catch {
        manualOk = false;
      }
      assert("[quotes-unique] manual quote with same trigger allowed", manualOk);

      // ON CONFLICT DO NOTHING devuelve 0 filas en colisión
      const ins = await pool.query(
        `insert into wa_quotes (chat_id, trigger_msg_id, generated_by_ai, params)
         values ($1, $2, true, '{}'::jsonb)
         on conflict (trigger_msg_id) where trigger_msg_id is not null and generated_by_ai = true
         do nothing
         returning quote_id`,
        [chatId, msgId],
      );
      assert("[quotes-unique] ON CONFLICT DO NOTHING returns 0 rows on collision", ins.rows.length === 0);
    }

    // ── Test 4: SAVEPOINT rollback aislado ──
    {
      const chatId = `${CHAT_PREFIX}-4`;
      const msgIdA = `${MSG_PREFIX}-4-A`;
      const msgIdB = `${MSG_PREFIX}-4-B`;
      await seedConv(pool, chatId);
      await seedMsg(pool, { chatId, msgId: msgIdA, ts: "2026-05-04T13:00:00Z" });
      await seedMsg(pool, { chatId, msgId: msgIdB, ts: "2026-05-04T13:01:00Z" });

      const c = await pool.connect();
      try {
        await c.query("begin");

        // Marcar A como enriched (debe persistir)
        await c.query(
          `update wa_messages set enriched_at = now(), enrichment_status = 'ok' where msg_id = $1`,
          [msgIdA],
        );

        // Savepoint para B, que vamos a rollbackear
        await c.query("savepoint b");
        await c.query(
          `update wa_messages set enriched_at = now(), enrichment_status = 'ok' where msg_id = $1`,
          [msgIdB],
        );
        await c.query("rollback to savepoint b");

        await c.query("commit");
      } finally {
        c.release();
      }

      const result = await pool.query(
        `select msg_id, enriched_at from wa_messages where msg_id = any($1::text[]) order by msg_id`,
        [[msgIdA, msgIdB]],
      );
      const aRow = result.rows.find((r) => r.msg_id === msgIdA);
      const bRow = result.rows.find((r) => r.msg_id === msgIdB);
      assert("[savepoint] A enriched (outside savepoint)", aRow && aRow.enriched_at !== null);
      assert("[savepoint] B NOT enriched (rolled back to savepoint)", bRow && bRow.enriched_at === null);
    }

    // ── Test 5: CHECK constraint en enrichment_status ──
    {
      const chatId = `${CHAT_PREFIX}-5`;
      const msgIdOk = `${MSG_PREFIX}-5-ok`;
      const msgIdBad = `${MSG_PREFIX}-5-bad`;
      await seedConv(pool, chatId);

      // Valor válido → ok
      let okInsert = false;
      try {
        await pool.query(
          `insert into wa_messages (msg_id, chat_id, ts, direction, type, text, enrichment_status)
           values ($1, $2, '2026-05-04T14:00:00Z'::timestamptz, 'in', 'text', 'x', 'ok')`,
          [msgIdOk, chatId],
        );
        okInsert = true;
      } catch {
        okInsert = false;
      }
      assert("[check] valid enrichment_status='ok' accepted", okInsert);

      // Valor inválido → debe romper por CHECK
      let badRejected = false;
      try {
        await pool.query(
          `insert into wa_messages (msg_id, chat_id, ts, direction, type, text, enrichment_status)
           values ($1, $2, '2026-05-04T14:01:00Z'::timestamptz, 'in', 'text', 'x', 'bogus')`,
          [msgIdBad, chatId],
        );
      } catch (e) {
        badRejected = /check|constraint/i.test(e.message);
      }
      assert("[check] invalid enrichment_status rejected by CHECK", badRejected);
    }

    await cleanup(pool);
  } catch (err) {
    console.error("\n💥 fatal test error:", err.message);
    failed++;
  } finally {
    await pool.end();
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`RESULTADOS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`${"═".repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("uncaught:", err);
  process.exit(1);
});
