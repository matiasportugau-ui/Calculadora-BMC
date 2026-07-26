/**
 * IMP-10 — Hybrid ranking: fuse RAG embedding hits + Training KB keyword matches.
 * Default OFF via RAG_HYBRID; never invents prices (quotes stay metadata-only).
 */

/**
 * Tokenize for crude keyword overlap (ES-friendly-ish).
 * @param {string} s
 * @returns {Set<string>}
 */
function tokens(s) {
  return new Set(
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .split(/[^a-z0-9áéíóúñü]+/i)
      .filter((t) => t.length >= 3),
  );
}

/**
 * @param {Set<string>} a
 * @param {Set<string>} b
 */
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

/**
 * Fuse RAG quotes with KB training examples.
 *
 * @param {object} opts
 * @param {Array<{lead_id?:string, similarity?:number, metadata?:object}>} opts.ragQuotes
 * @param {Array<{id?:string, question?:string, goodAnswer?:string, matchScore?:number}>} opts.kbExamples
 * @param {string} opts.query
 * @param {number} [opts.alpha=0.7] weight for embedding similarity
 * @param {number} [opts.beta=0.3] weight for KB keyword boost
 * @param {number} [opts.topK=5]
 * @returns {{ fused: Array<object>, blockExtras: string }}
 */
export function fuseRagAndKb({
  ragQuotes = [],
  kbExamples = [],
  query = "",
  alpha = 0.7,
  beta = 0.3,
  topK = 5,
} = {}) {
  const qTok = tokens(query);
  const fused = [];

  for (const q of ragQuotes || []) {
    const meta = q.metadata || {};
    const blob = [meta.familia, meta.producto, meta.escenario, meta.notas]
      .filter(Boolean)
      .join(" ");
    const kw = jaccard(qTok, tokens(blob));
    const sim = Number(q.similarity) || 0;
    const score = alpha * sim + beta * kw;
    fused.push({
      kind: "rag",
      lead_id: q.lead_id,
      similarity: sim,
      keyword_boost: Number(kw.toFixed(4)),
      fused_score: Number(score.toFixed(4)),
      metadata: meta,
    });
  }

  for (const e of kbExamples || []) {
    const blob = `${e.question || ""} ${e.goodAnswer || ""}`;
    const kw = jaccard(qTok, tokens(blob));
    const match = Number(e.matchScore);
    const sim = Number.isFinite(match) ? Math.min(1, match / 10) : kw;
    const score = alpha * sim + beta * kw;
    if (score < 0.05) continue;
    fused.push({
      kind: "kb",
      id: e.id,
      similarity: Number(sim.toFixed(4)),
      keyword_boost: Number(kw.toFixed(4)),
      fused_score: Number(score.toFixed(4)),
      question: e.question,
    });
  }

  fused.sort((a, b) => b.fused_score - a.fused_score);
  const top = fused.slice(0, Math.max(1, topK));
  const kbLines = top
    .filter((x) => x.kind === "kb")
    .map((x) => `- KB score ${x.fused_score}: ${(x.question || "").slice(0, 80)}`);
  const blockExtras =
    kbLines.length > 0
      ? `\n### KB híbrido (keyword)\n${kbLines.join("\n")}\n`
      : "";
  return { fused: top, blockExtras };
}
