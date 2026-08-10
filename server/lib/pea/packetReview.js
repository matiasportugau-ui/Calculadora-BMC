/**
 * EvolutionPacket operator review — accept / reject / escalate (M2b+).
 */
import { createPeaGrant } from "./grants.js";
import { recordPeaAudit } from "./auditEvents.js";
import { insertOutboxEvent } from "./outbox.js";
import { persistRatchetLinks, validateRatchetLinks } from "./ratchetGate.js";
import { TERMINAL_GAP_STATUSES } from "./gapEvents.js";

/**
 * Packet statuses that may still be accepted (Bug CS).
 * Must match the conditional UPDATE predicate under row lock.
 */
export const ACCEPTABLE_PACKET_STATUSES = new Set(["ready_for_review", "critic_pending"]);

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
      WHERE p.id = $1${forUpdate ? "\n       FOR UPDATE OF p, g" : ""}`,
    [packetId],
  );
  return rows[0] || null;
}

/**
 * @param {Set<string>} allowed
 * @returns {string[]}
 */
function statusList(allowed) {
  return [...allowed];
}

/**
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {import('../../config.js').config} config
 * @param {{ packetId: string, actorId: string, note?: string, ratchetLinks?: unknown, ratchet_links?: unknown }} input
 */
export async function acceptPeaPacket(db, config, input) {
  const ratchetRaw = input.ratchetLinks ?? input.ratchet_links;
  const ratchetRequired = config.peaRatchetRequired !== false;
  const ratchet = validateRatchetLinks(ratchetRaw, { required: ratchetRequired });
  if (!ratchet.ok) {
    return { error: "ratchet_required", failures: ratchet.failures };
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Bug CS: re-check status under row lock so concurrent reject/escalate cannot both win.
    const row = await loadPacketWithGap(client, input.packetId, { forUpdate: true });
    if (!row) {
      await client.query("ROLLBACK");
      return { error: "not_found" };
    }
    if (!ACCEPTABLE_PACKET_STATUSES.has(row.status)) {
      await client.query("ROLLBACK");
      return { error: "invalid_status", status: row.status };
    }
    // Refuse accept when gap already terminal/blocked (concurrent escalate won the lock).
    if (TERMINAL_GAP_STATUSES.has(row.gap_status) || row.gap_status === "blocked") {
      await client.query("ROLLBACK");
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

    const updated = await client.query(
      `UPDATE pea.evolution_packets
          SET status = 'accepted', updated_at = now()
        WHERE id = $1 AND status = ANY($2::text[])
        RETURNING id`,
      [input.packetId, statusList(ACCEPTABLE_PACKET_STATUSES)],
    );
    if (!updated.rowCount) {
      await client.query("ROLLBACK");
      return { error: "invalid_status", status: "conflict" };
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
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {{ packetId: string, actorId: string, reason?: string }} input
 */
export async function rejectPeaPacket(db, input) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Bug CS: lock packet+gap before decide — concurrent accept must not both return ok.
    const row = await loadPacketWithGap(client, input.packetId, { forUpdate: true });
    if (!row) {
      await client.query("ROLLBACK");
      return { error: "not_found" };
    }
    if (!REJECTABLE_PACKET_STATUSES.has(row.status)) {
      await client.query("ROLLBACK");
      return { error: "invalid_status", status: row.status };
    }

    const updated = await client.query(
      `UPDATE pea.evolution_packets
          SET status = 'rejected', updated_at = now()
        WHERE id = $1 AND status = ANY($2::text[])
        RETURNING id`,
      [input.packetId, statusList(REJECTABLE_PACKET_STATUSES)],
    );
    if (!updated.rowCount) {
      await client.query("ROLLBACK");
      return { error: "invalid_status", status: "conflict" };
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

    await client.query("COMMIT");
    return { ok: true, packet_id: input.packetId, status: "rejected" };
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
 * @param {{ packetId: string, actorId: string, maxLevel?: number, note?: string }} input
 */
export async function escalatePeaPacket(db, config, input) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Bug CS sibling: accept↔escalate TOCTOU — lock before minting L3 grant / blocking gap.
    const row = await loadPacketWithGap(client, input.packetId, { forUpdate: true });
    if (!row) {
      await client.query("ROLLBACK");
      return { error: "not_found" };
    }
    // Bug BZ: never escalate terminal/resolved packets (would set gap=blocked + new grant).
    if (!ESCALATABLE_PACKET_STATUSES.has(row.status)) {
      await client.query("ROLLBACK");
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

    await client.query("COMMIT");

    return {
      ok: true,
      packet_id: input.packetId,
      grant_id: grant.id,
      max_level: grant.max_level,
      implement_still_disabled: true,
    };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
