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
      jobId = await enqueuePeaJob(client, {
        jobType: "analyze_gap",
        gapId: gapEvent.gap_id || null,
        input: { gap_event_id: eventId, outbox_id: outboxId },
      });
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
