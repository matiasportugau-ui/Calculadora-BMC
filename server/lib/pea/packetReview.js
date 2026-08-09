/**
 * EvolutionPacket operator review — accept / reject / escalate (M2b+).
 */
import { createPeaGrant } from "./grants.js";
import { recordPeaAudit } from "./auditEvents.js";
import { insertOutboxEvent } from "./outbox.js";
import { persistRatchetLinks, validateRatchetLinks } from "./ratchetGate.js";

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
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {import('../../config.js').config} config
 * @param {{ packetId: string, actorId: string, note?: string, ratchetLinks?: unknown, ratchet_links?: unknown }} input
 */
export async function acceptPeaPacket(db, config, input) {
  const row = await loadPacketWithGap(db, input.packetId);
  if (!row) return { error: "not_found" };
  if (!["ready_for_review", "critic_pending"].includes(row.status)) {
    return { error: "invalid_status", status: row.status };
  }

  const ratchetRaw = input.ratchetLinks ?? input.ratchet_links;
  const ratchetRequired = config.peaRatchetRequired !== false;
  const ratchet = validateRatchetLinks(ratchetRaw, { required: ratchetRequired });
  if (!ratchet.ok) {
    return { error: "ratchet_required", failures: ratchet.failures };
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    let savedLinks = [];
    if (ratchet.links.length > 0) {
      savedLinks = await persistRatchetLinks(client, {
        gapId: row.gap_id,
        packetId: input.packetId,
        actorId: input.actorId,
        links: ratchet.links,
      });
    }

    await client.query(
      `UPDATE pea.evolution_packets SET status = 'accepted', updated_at = now() WHERE id = $1`,
      [input.packetId],
    );
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

    await client.query("COMMIT");

    return {
      ok: true,
      packet_id: input.packetId,
      status: "accepted",
      ratchet_links: savedLinks,
    };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

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
 * @param {{ packetId: string, actorId: string, reason?: string }} input
 */
export async function rejectPeaPacket(db, input) {
  const row = await loadPacketWithGap(db, input.packetId);
  if (!row) return { error: "not_found" };
  // Do not allow reject to clobber accepted/rejected/superseded packets
  // (would flip a resolved gap back to ignored — data corruption).
  if (!REJECTABLE_PACKET_STATUSES.has(row.status)) {
    return { error: "invalid_status", status: row.status };
  }

  await db.query(
    `UPDATE pea.evolution_packets SET status = 'rejected', updated_at = now() WHERE id = $1`,
    [input.packetId],
  );
  await db.query(
    `UPDATE pea.gaps SET status = 'ignored', updated_at = now() WHERE id = $1`,
    [row.gap_id],
  );

  await recordPeaAudit(db, {
    actorId: input.actorId,
    action: "packet.reject",
    resourceType: "evolution_packet",
    resourceId: input.packetId,
    metadata: { gap_id: row.gap_id, reason: input.reason || null },
  });

  return { ok: true, packet_id: input.packetId, status: "rejected" };
}

/**
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {import('../../config.js').config} config
 * @param {{ packetId: string, actorId: string, maxLevel?: number, note?: string }} input
 */
export async function escalatePeaPacket(db, config, input) {
  const row = await loadPacketWithGap(db, input.packetId);
  if (!row) return { error: "not_found" };
  // Bug BZ: never escalate terminal/resolved packets (would set gap=blocked + new grant).
  if (!ESCALATABLE_PACKET_STATUSES.has(row.status)) {
    return { error: "invalid_status", status: row.status };
  }

  const grant = await createPeaGrant(db, config, {
    maxLevel: input.maxLevel ?? 3,
    scope: `packet:${input.packetId}`,
    grantedBy: input.actorId,
    gapIds: [row.gap_id],
    packetId: input.packetId,
    metadata: { note: input.note || null, escalated_from: "console" },
  });

  await db.query(
    `UPDATE pea.gaps SET status = 'blocked', updated_at = now() WHERE id = $1`,
    [row.gap_id],
  );

  await recordPeaAudit(db, {
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
}
