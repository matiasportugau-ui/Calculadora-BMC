/**
 * PEA transactional outbox → pea.jobs enqueue.
 * Seal: PEA_POSTGRES_QUEUE_V1
 */

/**
 * @param {import('pg').PoolClient} client
 * @param {{ aggregateType: string, aggregateId: string, eventType: string, payload?: object }} evt
 */
export async function insertOutboxEvent(client, evt) {
  const { rows } = await client.query(
    `INSERT INTO pea.outbox (aggregate_type, aggregate_id, event_type, payload)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id`,
    [
      evt.aggregateType,
      evt.aggregateId,
      evt.eventType,
      JSON.stringify(evt.payload || {}),
    ],
  );
  return rows[0].id;
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ jobType: string, gapId?: string|null, input?: object, runAfter?: Date|null }} job
 */
export async function enqueuePeaJob(client, job) {
  const { rows } = await client.query(
    `INSERT INTO pea.jobs (job_type, gap_id, status, input_json, run_after)
     VALUES ($1, $2, 'pending', $3::jsonb, $4)
     RETURNING id`,
    [
      job.jobType,
      job.gapId || null,
      JSON.stringify(job.input || {}),
      job.runAfter || null,
    ],
  );
  return rows[0].id;
}

/** Statuses that still occupy the per-gap analyze slot (Bug CF). */
export const ACTIVE_ANALYZE_GAP_STATUSES = Object.freeze(["pending", "running", "failed"]);

/**
 * Enqueue analyze_gap with per-gap coalescing (Bug CF).
 * Returns the existing active job when one is already pending/running/failed
 * so threshold storms and diagnose double-submit cannot mint N concurrent
 * ArchitectRuntime runs (budget burn + packet/status races).
 *
 * Requires migration `004_pea_analyze_gap_active_dedup.sql` for race safety;
 * the SELECT path still collapses sequential duplicates before the index lands.
 *
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {{ gapId: string, input?: object, runAfter?: Date|null }} job
 * @returns {Promise<{ jobId: string|null, coalesced: boolean }>}
 */
export async function enqueueAnalyzeGapJob(db, job) {
  const gapId = job?.gapId;
  if (!gapId) {
    throw new Error("gap_id_required");
  }

  const existing = await db.query(
    `SELECT id FROM pea.jobs
      WHERE gap_id = $1
        AND job_type = 'analyze_gap'
        AND status = ANY($2::text[])
      ORDER BY created_at ASC
      LIMIT 1`,
    [gapId, ACTIVE_ANALYZE_GAP_STATUSES],
  );
  if (existing.rows[0]?.id) {
    return { jobId: existing.rows[0].id, coalesced: true };
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO pea.jobs (job_type, gap_id, status, input_json, run_after)
       VALUES ('analyze_gap', $1, 'pending', $2::jsonb, $3)
       RETURNING id`,
      [gapId, JSON.stringify(job.input || {}), job.runAfter || null],
    );
    return { jobId: rows[0]?.id || null, coalesced: false };
  } catch (e) {
    // Unique violation from pea_jobs_analyze_gap_active_dedup (concurrent enqueue).
    if (e && (e.code === "23505" || /pea_jobs_analyze_gap_active_dedup/i.test(String(e.message || "")))) {
      const again = await db.query(
        `SELECT id FROM pea.jobs
          WHERE gap_id = $1
            AND job_type = 'analyze_gap'
            AND status = ANY($2::text[])
          ORDER BY created_at ASC
          LIMIT 1`,
        [gapId, ACTIVE_ANALYZE_GAP_STATUSES],
      );
      return { jobId: again.rows[0]?.id || null, coalesced: true };
    }
    throw e;
  }
}

/**
 * Write gap_event + outbox + optional analyze job in one transaction (M2a-ready API).
 * @param {import('pg').Pool} pool
 */
export async function writeGapEventWithOutbox(pool, { gapEvent, enqueueAnalyze = false }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: evRows } = await client.query(
      `INSERT INTO pea.gap_events
         (gap_id, source, signal_type, tool_id, session_id, conversation_id, severity, fingerprint_inputs, payload, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb, COALESCE($10, now()))
       RETURNING id`,
      [
        gapEvent.gap_id || null,
        gapEvent.source,
        gapEvent.signal_type,
        gapEvent.tool_id || null,
        gapEvent.session_id || null,
        gapEvent.conversation_id || null,
        gapEvent.severity || "medium",
        JSON.stringify(gapEvent.fingerprint_inputs || {}),
        JSON.stringify(gapEvent.payload || {}),
        gapEvent.occurred_at || null,
      ],
    );
    const eventId = evRows[0].id;
    const outboxId = await insertOutboxEvent(client, {
      aggregateType: "gap_event",
      aggregateId: eventId,
      eventType: "gap_event.created",
      payload: { gap_event_id: eventId, gap_id: gapEvent.gap_id || null },
    });
    let jobId = null;
    if (enqueueAnalyze) {
      if (!gapEvent.gap_id) {
        throw new Error("gap_id_required");
      }
      const enqueued = await enqueueAnalyzeGapJob(client, {
        gapId: gapEvent.gap_id,
        input: { gap_event_id: eventId, outbox_id: outboxId },
      });
      jobId = enqueued.jobId;
    }
    await client.query("COMMIT");
    return { eventId, outboxId, jobId };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Publish unpublished outbox rows → dispatch_outbox jobs.
 * @param {import('pg').Pool} pool
 * @param {number} [limit]
 */
export async function dispatchPendingOutbox(pool, limit = 20) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT id, aggregate_type, aggregate_id, event_type, payload
         FROM pea.outbox
        WHERE published_at IS NULL
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED`,
      [limit],
    );
    const jobIds = [];
    for (const row of rows) {
      await client.query(`UPDATE pea.outbox SET published_at = now() WHERE id = $1`, [row.id]);
      const jobId = await enqueuePeaJob(client, {
        jobType: "dispatch_outbox",
        gapId: row.payload?.gap_id || null,
        input: { outbox_id: row.id, event_type: row.event_type },
      });
      jobIds.push(jobId);
    }
    await client.query("COMMIT");
    return { dispatched: rows.length, jobIds };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
