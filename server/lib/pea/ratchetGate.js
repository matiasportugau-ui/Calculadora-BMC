/**
 * Ratchet gate — Module 9 / IMP-PEA-13 (M2c manual closeout).
 * Accept requires ≥1 durable artifact link: golden | fitness_sensor | rule_provenance.
 */

export const CLOSEOUT_RATCHET_TYPES = new Set(["golden", "fitness_sensor", "rule_provenance"]);

/**
 * Normalize operator-supplied ratchet links from API body.
 * @param {unknown} raw
 */
export function normalizeRatchetLinks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      type: String(item.type || item.artifact_type || "").trim(),
      path: String(item.path || "").trim(),
      description: String(item.description || "").trim(),
    }));
}

/**
 * @param {unknown} rawLinks
 * @param {{ required?: boolean }} [opts]
 */
export function validateRatchetLinks(rawLinks, opts = {}) {
  const required = opts.required !== false;
  const links = normalizeRatchetLinks(rawLinks);
  const failures = [];

  if (required && links.length === 0) {
    failures.push("ratchet_links_empty");
  }

  let closeoutCount = 0;
  for (let i = 0; i < links.length; i += 1) {
    const link = links[i];
    if (!link.type) {
      failures.push(`link_${i}_missing_type`);
      continue;
    }
    if (!CLOSEOUT_RATCHET_TYPES.has(link.type)) {
      failures.push(`link_${i}_invalid_type:${link.type}`);
      continue;
    }
    if (!link.path && link.description.length < 8) {
      failures.push(`link_${i}_needs_path_or_description`);
      continue;
    }
    closeoutCount += 1;
  }

  if (required && closeoutCount === 0 && links.length > 0) {
    failures.push("no_closeout_type_link");
  }

  return {
    ok: failures.length === 0,
    failures,
    links: links.filter((l) => CLOSEOUT_RATCHET_TYPES.has(l.type)),
  };
}

/**
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {{ gapId: string, packetId: string, actorId: string, links: object[] }} input
 */
export async function persistRatchetLinks(db, input) {
  const saved = [];
  for (const link of input.links) {
    const { rows } = await db.query(
      `INSERT INTO pea.ratchet_links
         (gap_id, packet_id, artifact_type, path, description, confirmed_by, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING id, artifact_type, path, description, created_at`,
      [
        input.gapId,
        input.packetId,
        link.type,
        link.path || "",
        link.description || "",
        input.actorId,
        JSON.stringify({ source: "accept_manual_m2c" }),
      ],
    );
    saved.push(rows[0]);
  }
  return saved;
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} gapId
 */
export async function listRatchetLinksForGap(pool, gapId) {
  const { rows } = await pool.query(
    `SELECT id, artifact_type, path, description, confirmed_by, created_at
       FROM pea.ratchet_links
      WHERE gap_id = $1
      ORDER BY created_at DESC`,
    [gapId],
  );
  return rows;
}
