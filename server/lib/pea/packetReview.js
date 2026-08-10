/**
 * EvolutionPacket operator review — accept / reject / escalate (M2b+).
 *
 * Bug CS: status checks must run under row lock inside a transaction, and
 * UPDATEs must be status-predicate guarded (RETURNING). Otherwise concurrent
 * accept+reject (or accept+escalate) both return ok and last-writer wins —
 * wrong terminal packet/gap state and spurious L3 grants.
 */
import { createPeaGrant } from "./grants.js";
import { recordPeaAudit } from "./auditEvents.js";
import { insertOutboxEvent } from "./outbox.js";
import { persistRatchetLinks, validateRatchetLinks } from "./ratchetGate.js";

/**
 * Packet statuses that may be accepted (operator closeout).
 */
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
 */
export async function loadPacketWithGap(db, packetId) {
  const { rows } = await db.query(
    `SELECT p.*, g.id AS gap_row_id, g.status AS gap_status, g.signal_type, g.fingerprint
       FROM pea.evolution_packets p
       JOIN pea.gaps g ON g.id = p.gap_id
      WHERE p.id = $1`,
    [packetId],
  );
  return rows[0] || null;
}

/**
 * Lock packet (+ gap join) for the duration of the current transaction (Bug CS).
 * @param {import('pg').PoolClient} client
 * @param {string} packetId
 */
async function loadPacketWithGapForUpdate(client, packetId) {
  const { rows } = await client.query(
    `SELECT p.*, g.id AS gap_row_id, g.status AS gap_status, g.signal_type, g.fingerprint
       FROM pea.evolution_packets p
       JOIN pea.gaps g ON g.id = p.gap_id
      WHERE p.id = $1
      FOR UPDATE OF p`,
    [packetId],
  );
  return rows[0] || null;
}

/**
 * @param {import('pg').Pool} db
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
async function withPeaTx(db, fn) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    if (result && typeof result === "object" && result.error) {
      await client.query("ROLLBACK");
      return result;
    }
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {import('../../config.js').config} config
 * @param {{ packetId: string, actorId: string, note?: string, ratchetLinks?: unknown, ratchet_links?: unknown }} input
 */
export async function acceptPeaPacket(db, config, input) {
  // Ratchet validation is pure (no DB) — fail fast before taking a connection.
  const ratchetRaw = input.ratchetLinks ?? input.ratchet_links;
  const ratchetRequired = config.peaRatchetRequired !== false;
  const ratchet = validateRatchetLinks(ratchetRaw, { required: ratchetRequired });
  if (!ratchet.ok) {
    return { error: "ratchet_required", failures: ratchet.failures };
  }

  return withPeaTx(db, async (client) => {
    const row = await loadPacketWithGapForUpdate(client, input.packetId);
    if (!row) return { error: "not_found" };
    if (!ACCEPTABLE_PACKET_STATUSES.has(row.status)) {
      return { error: "invalid_status", status: row.status };
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

    const allowed = [...ACCEPTABLE_PACKET_STATUSES];
    const { rows: updated } = await client.query(
      `UPDATE pea.evolution_packets
          SET status = 'accepted', updated_at = now()
        WHERE id = $1 AND status = ANY($2::text[])
        RETURNING id`,
      [input.packetId, allowed],
    );
    if (!updated[0]) {
      // Race: another writer flipped status between FOR UPDATE and UPDATE (should be rare).
      const again = await loadPacketWithGap(client, input.packetId);
      return { error: "invalid_status", status: again?.status || row.status };
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
  });
}

/**
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {{ packetId: string, actorId: string, reason?: string }} input
 */
export async function rejectPeaPacket(db, input) {
  return withPeaTx(db, async (client) => {
    const row = await loadPacketWithGapForUpdate(client, input.packetId);
    if (!row) return { error: "not_found" };
    if (!REJECTABLE_PACKET_STATUSES.has(row.status)) {
      return { error: "invalid_status", status: row.status };
    }

    const allowed = [...REJECTABLE_PACKET_STATUSES];
    const { rows: updated } = await client.query(
      `UPDATE pea.evolution_packets
          SET status = 'rejected', updated_at = now()
        WHERE id = $1 AND status = ANY($2::text[])
        RETURNING id`,
      [input.packetId, allowed],
    );
    if (!updated[0]) {
      const again = await loadPacketWithGap(client, input.packetId);
      return { error: "invalid_status", status: again?.status || row.status };
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
  });
}

/**
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {import('../../config.js').config} config
 * @param {{ packetId: string, actorId: string, maxLevel?: number, note?: string }} input
 */
export async function escalatePeaPacket(db, config, input) {
  return withPeaTx(db, async (client) => {
    const row = await loadPacketWithGapForUpdate(client, input.packetId);
    if (!row) return { error: "not_found" };
    // Bug BZ + CS: under FOR UPDATE, refuse terminal packets before minting a grant.
    // Escalate does not change packet.status, so the row lock is the serialization
    // point vs concurrent accept/reject.
    if (!ESCALATABLE_PACKET_STATUSES.has(row.status)) {
      return { error: "invalid_status", status: row.status };
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
  });
}
