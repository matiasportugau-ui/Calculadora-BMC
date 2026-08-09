/**
 * pea_explain_gap — read-only narration for Panelin (Module 6).
 * Never invents prices; uses stored diagnosis / operator_summary only.
 */

const PRICE_PATTERN = /\$\s?\d|USD\s?\d|\d+\s?(?:USD|usd)|precio\s*[:=]\s*\d/i;

/**
 * @param {object} packet
 * @param {object} gap
 */
export function buildGapNarrative(packet, gap) {
  const parts = [];
  if (gap?.title) parts.push(`**${gap.title}**`);
  if (gap?.signal_type) parts.push(`Tipo: \`${gap.signal_type}\`.`);
  if (gap?.occurrence_count != null) {
    parts.push(`Ocurrencias: ${gap.occurrence_count}.`);
  }

  const blast = packet?.blast_radius || {};
  const operatorSummary =
    blast.operator_summary ||
    packet?.operator_summary ||
    null;
  if (operatorSummary) parts.push(operatorSummary);

  if (packet?.diagnosis) parts.push(packet.diagnosis);

  if (packet?.primary_lane) {
    parts.push(`Lane recomendada: **${packet.primary_lane}** (H=harness, K=KB, C=código).`);
  }

  const changes = packet?.recommended_changes || [];
  if (changes.length > 0) {
    const bullets = changes
      .slice(0, 3)
      .map((c) => `- ${c.description || c.kind || "cambio"}`)
      .join("\n");
    parts.push(`Cambios sugeridos:\n${bullets}`);
  }

  const narrative = parts.join("\n\n").trim();
  const softHint =
    "Si el cliente espera cotización, seguí con calcular_cotizacion — esto es contexto interno de evolución del sistema.";

  return { narrative, softHint };
}

/**
 * Strip or flag invented price-like strings not present in source fields.
 */
export function assertNoInventedPrices(narrative, sourceText = "") {
  if (!PRICE_PATTERN.test(narrative)) return { ok: true };
  if (PRICE_PATTERN.test(sourceText)) return { ok: true };
  return { ok: false, reason: "invented_price_pattern" };
}

/**
 * @param {import('pg').Pool|null} pool
 * @param {import('../../config.js').config} config
 * @param {{ gapId?: string, fingerprint?: string, signalType?: string }} query
 */
export async function explainGap(pool, config, query = {}) {
  if (!config?.peaEnabled) {
    return {
      ok: true,
      pea_enabled: false,
      narrative:
        "Panelin Evolution Architect (PEA) está desactivado en este entorno. No hay gaps persistidos para narrar.",
      soft_hint:
        "Continuá la cotización con las tools de cálculo habituales; no hay bloqueo comercial.",
    };
  }
  if (!pool) {
    return { ok: false, error: "db_unavailable" };
  }

  let gap = null;
  if (query.gapId) {
    const { rows } = await pool.query(`SELECT * FROM pea.gaps WHERE id = $1`, [query.gapId]);
    gap = rows[0] || null;
  } else if (query.fingerprint) {
    const { rows } = await pool.query(
      `SELECT * FROM pea.gaps WHERE fingerprint = $1 ORDER BY last_seen DESC LIMIT 1`,
      [query.fingerprint],
    );
    gap = rows[0] || null;
  } else if (query.signalType) {
    const { rows } = await pool.query(
      `SELECT * FROM pea.gaps WHERE signal_type = $1 ORDER BY last_seen DESC LIMIT 1`,
      [query.signalType],
    );
    gap = rows[0] || null;
  } else {
    const { rows } = await pool.query(
      `SELECT * FROM pea.gaps ORDER BY priority_score DESC, last_seen DESC LIMIT 1`,
    );
    gap = rows[0] || null;
  }

  if (!gap) {
    return {
      ok: true,
      found: false,
      narrative: "No encontré gaps registrados que coincidan con la consulta.",
      soft_hint: "Podés seguir cotizando con normalidad.",
    };
  }

  let packet = null;
  if (gap.latest_packet_id) {
    const { rows } = await pool.query(`SELECT * FROM pea.evolution_packets WHERE id = $1`, [
      gap.latest_packet_id,
    ]);
    packet = rows[0] || null;
  }
  if (!packet) {
    const { rows } = await pool.query(
      `SELECT * FROM pea.evolution_packets WHERE gap_id = $1 ORDER BY version DESC LIMIT 1`,
      [gap.id],
    );
    packet = rows[0] || null;
  }

  const sourceText = [gap.summary, packet?.diagnosis, JSON.stringify(packet?.blast_radius || {})].join(
    " ",
  );
  const { narrative, softHint } = buildGapNarrative(packet, gap);
  const priceCheck = assertNoInventedPrices(narrative, sourceText);

  return {
    ok: true,
    found: true,
    gap_id: gap.id,
    packet_id: packet?.id || null,
    packet_status: packet?.status || null,
    narrative,
    soft_hint: softHint,
    price_safe: priceCheck.ok,
  };
}
