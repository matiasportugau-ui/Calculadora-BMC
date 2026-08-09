/**
 * implement_gap job + route handler — L3 manual adapter path.
 */
import { assertImplementEnvironment } from "./stagingGuard.js";
import { runManualImplementer } from "./implementer/manualAdapter.js";
import { runNativeImplementer } from "./implementer/nativeAdapter.js";
import { recordPeaAudit } from "./auditEvents.js";
import { loadPacketWithGap } from "./packetReview.js";

/**
 * @param {import('pg').Pool} pool
 * @param {string} packetId
 */
export async function findActiveGrantForPacket(pool, packetId) {
  const { rows } = await pool.query(
    `SELECT * FROM pea.grants
      WHERE revoked_at IS NULL
        AND expires_at > now()
        AND max_level >= 3
        AND (packet_id = $1 OR scope = $2)
      ORDER BY granted_at DESC
      LIMIT 1`,
    [packetId, `packet:${packetId}`],
  );
  return rows[0] || null;
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('../../config.js').config} config
 * @param {{ packetId: string, actorId: string, repoRoot?: string }} input
 */
export async function runImplementPacket(pool, config, input) {
  const envCheck = assertImplementEnvironment(config);
  if (!envCheck.ok) return envCheck;

  const grant = await findActiveGrantForPacket(pool, input.packetId);
  if (!grant) {
    return { ok: false, error: "grant_required", min_level: 3 };
  }

  const row = await loadPacketWithGap(pool, input.packetId);
  if (!row) return { error: "not_found" };

  const gap = {
    id: row.gap_id,
    fingerprint: row.fingerprint,
    signal_type: row.signal_type,
    title: row.title,
    summary: row.summary,
  };

  const artifact = await runImplementerAdapter({
    adapter: input.adapter || "manual",
    packet: row,
    gap,
    repoRoot: input.repoRoot || process.cwd(),
  });

  await recordPeaAudit(pool, {
    actorId: input.actorId,
    action: "packet.implement.manual",
    resourceType: "evolution_packet",
    resourceId: input.packetId,
    metadata: { grant_id: grant.id, artifact_path: artifact.path || artifact.artifact_path, adapter: artifact.adapter },
  });

  return {
    ok: true,
    adapter: artifact.adapter,
    artifact_path: artifact.path || artifact.artifact_path,
    grant_id: grant.id,
    branch: artifact.branch,
    pr_draft: artifact.pr_draft,
    implement_still_manual: artifact.implement_still_manual ?? artifact.adapter === "manual",
  };
}

/**
 * @param {{ adapter?: string, packet: object, gap: object, repoRoot?: string }} ctx
 */
async function runImplementerAdapter(ctx) {
  const adapter = ctx.adapter || "manual";
  if (adapter === "native") {
    return runNativeImplementer(ctx);
  }
  return runManualImplementer(ctx);
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('../../config.js').config} config
 * @param {object} job
 */
export async function runImplementGapJob(pool, config, job) {
  const packetId = job.input_json?.packet_id;
  const actorId = job.input_json?.actor_id || "worker";
  const result = await runImplementPacket(pool, config, { packetId, actorId });
  await pool.query(
    `UPDATE pea.jobs SET status = $2, output_json = $3::jsonb, completed_at = now(), error = $4 WHERE id = $1`,
    [
      job.id,
      result.ok ? "completed" : "failed",
      JSON.stringify(result),
      result.ok ? null : result.error || "implement_failed",
    ],
  );
  return result;
}
