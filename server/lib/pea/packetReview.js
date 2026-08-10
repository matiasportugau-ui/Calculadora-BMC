/**
 * EvolutionPacket operator review — accept / reject / escalate (M2b+).
 *
 * Bug CS: accept/reject/escalate used check-then-act without row locks or
 * status-guarded UPDATEs. Concurrent operators could both get ok:true and leave
 * inconsistent terminal state (e.g. accepted packet + ignored/blocked gap, or
 * accepted packet + spurious L3 grant).
 */
import { createPeaGrant } from "./grants.js";
import { recordPeaAudit } from "./auditEvents.js";
import { insertOutboxEvent } from "./outbox.js";
import { persistRatchetLinks, validateRatchetLinks } from "./ratchetGate.js";

/** Packet statuses that may be accepted (Bug CS). */
export const ACCEPTABLE_PACKET_STATUSES = new Set([
  "ready_for_review",
  "critic_pending",
]);

/**
 * Packet statuses that may still be rejected (Bug BT / #972).
 * Accepted/rejected/superseded must not be clobbered → gap ignored.
 */
export const REJECTABLE_PACKET_STATUSES = new Set([
  "draft",
  "critic_pending",
  "critic_failed",
  "ready_for_review",
]);

/**
 * Packet statuses that may be escalated to L3 (Bug BZ).
 * Escalating an accepted/rejected packet would flip a resolved gap to blocked
 * and mint a spurious L3 grant.
 */
export const ESCALATABLE_PACKET_STATUSES = new Set([
  "draft",
  "critic_pending",
  "critic_failed",
  "ready_for_review",
]);

/**
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {string} packetId
 * @param {{ forUpdate?: boolean }} [opts]
 */
export async function loadPacketWithGap(db, packetId, opts = {}) {
  const forUpdate = opts.forUpdate === true;
  const { rows } = await db.query(
    `SELECT p.*, g.id AS gap_row_id, g.status AS gap_status, g.signal_type, g.fingerprint
       FROM pea.evolution_packets p
       JOIN pea.gaps g ON g.id = p.gap_id
      WHERE p.id = $1${forUpdate ? " FOR UPDATE OF p" : ""}`,
    [packetId],
  );
  return rows[0] || null;
}

/**
 * Run work on a PoolClient. If `db` is a Pool (has connect), open a connection.
 * Query-only mocks (tests) are used directly.
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {(client: import('pg').Pool|import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
async function withClient(db, fn) {
  if (typeof db.connect === "function") {
    const client = await db.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }
  return fn(db);
}

/**
 * @param {import('pg').Pool|import('pg').PoolClient} client
 * @param {boolean} transactional
 * @param {() => Promise<T>} work
 * @returns {Promise<T>}
 * @template T
 */
async function maybeTransaction(client, transactional, work) {
  if (!transactional) return work();
  await client.query("BEGIN");
  try {
    const result = await work();
    // Early error returns (not_found / invalid_status) still COMMIT nothing
    // meaningful — ROLLBACK keeps the lock release clean.
    if (result && result.error) {
      await client.query("ROLLBACK").catch(() => {});
      return result;
    }
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  }
}

/**
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {import('../../config.js').config} config
 * @param {{ packetId: string, actorId: string, note?: string, ratchetLinks?: unknown, ratchet_links?: unknown }} input
 */
export async function acceptPeaPacket(db, config, input) {
  // Ratchet validation is pure (no DB) — fail fast before taking a lock.
  const ratchetRaw = input.ratchetLinks ?? input.ratchet_links;
  const ratchetRequired = config.peaRatchetRequired !== false;
  const ratchet = validateRatchetLinks(ratchetRaw, { required: ratchetRequired });
  if (!ratchet.ok) {
    return { error: "ratchet_required", failures: ratchet.failures };
  }

  const transactional = typeof db.connect === "function";
  return withClient(db, (client) =>
    maybeTransaction(client, transactional, async () => {
      const row = await loadPacketWithGap(client, input.packetId, { forUpdate: transactional });
      if (!row) return { error: "not_found" };
      if (!ACCEPTABLE_PACKET_STATUSES.has(row.status)) {
        return { error: "invalid_status", status: row.status };
      }
      // Bug CS sibling: escalate leaves packet ready_for_review but sets gap=blocked
      // + L3 grant. Accept must not overwrite blocked/terminal gaps after escalate.
      if (["blocked", "resolved", "ignored"].includes(row.gap_status)) {
        return { error: "invalid_status", status: row.status, gap_status: row.gap_status };
      }

      let savedLinks = [];
      if (ratchet.links.length > 0) {
        savedLinks = await persistRatchetLinks(client, {
          gapId: row.gap_id,
          packetId: input.packetId,
          actorId: input.actorId,
          links: ratchet.links,
        });
      }

      // Bug CS: status-guarded UPDATE — concurrent reject/escalate lose cleanly.
      const allowed = [...ACCEPTABLE_PACKET_STATUSES];
      const flipped = await client.query(
        `UPDATE pea.evolution_packets
            SET status = 'accepted', updated_at = now()
          WHERE id = $1
            AND status = ANY($2::text[])
          RETURNING id, status`,
        [input.packetId, allowed],
      );
      if ((flipped.rowCount ?? flipped.rows?.length ?? 0) === 0) {
        const latest = await loadPacketWithGap(client, input.packetId);
        return { error: "invalid_status", status: latest?.status || row.status };
      }

      await client.query(
        `UPDATE pea.gaps
           SET status = 'resolved',
               metadata = metadata || $2::jsonb,
               updated_at = now()
         WHERE id = $1`,
        [
          row.gap_id,
          JSON.stringify({
            ratchet_link_ids: savedLinks.map((l) => l.id),
            resolved_at: new Date().toISOString(),
          }),
        ],
      );

      await recordPeaAudit(client, {
        actorId: input.actorId,
        action: "packet.accept",
        resourceType: "evolution_packet",
        resourceId: input.packetId,
        metadata: {
          gap_id: row.gap_id,
          note: input.note || null,
          ratchet_count: savedLinks.length,
        },
      });

      await insertOutboxEvent(client, {
        aggregateType: "packet",
        aggregateId: input.packetId,
        eventType: "packet.accepted",
        payload: {
          packet_id: input.packetId,
          gap_id: row.gap_id,
          ratchet_link_ids: savedLinks.map((l) => l.id),
        },
      });

      return {
        ok: true,
        packet_id: input.packetId,
        status: "accepted",
        ratchet_links: savedLinks,
      };
    }),
  );
}

/**
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {{ packetId: string, actorId: string, reason?: string }} input
 */
export async function rejectPeaPacket(db, input) {
  const transactional = typeof db.connect === "function";
  return withClient(db, (client) =>
    maybeTransaction(client, transactional, async () => {
      const row = await loadPacketWithGap(client, input.packetId, { forUpdate: transactional });
      if (!row) return { error: "not_found" };
      // Do not allow reject to clobber accepted/rejected/superseded packets
      // (would flip a resolved gap back to ignored — data corruption).
      if (!REJECTABLE_PACKET_STATUSES.has(row.status)) {
        return { error: "invalid_status", status: row.status };
      }

      // Bug CS: status-guarded UPDATE — concurrent accept wins, reject returns invalid_status.
      const allowed = [...REJECTABLE_PACKET_STATUSES];
      const flipped = await client.query(
        `UPDATE pea.evolution_packets
            SET status = 'rejected', updated_at = now()
          WHERE id = $1
            AND status = ANY($2::text[])
          RETURNING id, status`,
        [input.packetId, allowed],
      );
      if ((flipped.rowCount ?? flipped.rows?.length ?? 0) === 0) {
        const latest = await loadPacketWithGap(client, input.packetId);
        return { error: "invalid_status", status: latest?.status || row.status };
      }

      await client.query(
        `UPDATE pea.gaps SET status = 'ignored', updated_at = now() WHERE id = $1`,
        [row.gap_id],
      );

      await recordPeaAudit(client, {
        actorId: input.actorId,
        action: "packet.reject",
        resourceType: "evolution_packet",
        resourceId: input.packetId,
        metadata: { gap_id: row.gap_id, reason: input.reason || null },
      });

      return { ok: true, packet_id: input.packetId, status: "rejected" };
    }),
  );
}

/**
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {import('../../config.js').config} config
 * @param {{ packetId: string, actorId: string, maxLevel?: number, note?: string }} input
 */
export async function escalatePeaPacket(db, config, input) {
  const transactional = typeof db.connect === "function";
  return withClient(db, (client) =>
    maybeTransaction(client, transactional, async () => {
      const row = await loadPacketWithGap(client, input.packetId, { forUpdate: transactional });
      if (!row) return { error: "not_found" };
      // Bug BZ: never escalate terminal/resolved packets (would set gap=blocked + new grant).
      if (!ESCALATABLE_PACKET_STATUSES.has(row.status)) {
        return { error: "invalid_status", status: row.status };
      }

      // Bug CS: re-check under the same lock after any concurrent accept/reject.
      // Status-guarded no-op on gap if packet left the escalatable set mid-flight.
      const allowed = [...ESCALATABLE_PACKET_STATUSES];
      const stillOpen = await client.query(
        `SELECT id, status FROM pea.evolution_packets
          WHERE id = $1 AND status = ANY($2::text[])`,
        [input.packetId, allowed],
      );
      if ((stillOpen.rowCount ?? stillOpen.rows?.length ?? 0) === 0) {
        const latest = await loadPacketWithGap(client, input.packetId);
        return { error: "invalid_status", status: latest?.status || row.status };
      }

      const grant = await createPeaGrant(client, config, {
        maxLevel: input.maxLevel ?? 3,
        scope: `packet:${input.packetId}`,
        grantedBy: input.actorId,
        gapIds: [row.gap_id],
        packetId: input.packetId,
        metadata: { note: input.note || null, escalated_from: "console" },
      });

      await client.query(
        `UPDATE pea.gaps SET status = 'blocked', updated_at = now() WHERE id = $1`,
        [row.gap_id],
      );

      await recordPeaAudit(client, {
        actorId: input.actorId,
        action: "packet.escalate",
        resourceType: "evolution_packet",
        resourceId: input.packetId,
        metadata: { grant_id: grant.id, gap_id: row.gap_id },
      });

      return {
        ok: true,
        packet_id: input.packetId,
        grant_id: grant.id,
        max_level: grant.max_level,
        implement_still_disabled: true,
      };
    }),
  );
}
