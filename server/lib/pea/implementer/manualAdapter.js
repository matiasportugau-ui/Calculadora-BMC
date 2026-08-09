/**
 * Manual L3 implementer — writes goal-prompt file from EvolutionPacket (IMP-PEA-12 partial).
 */
import fs from "fs/promises";
import path from "path";

/**
 * @param {object} packet
 * @param {object} gap
 * @param {{ repoRoot?: string }} [opts]
 */
export function buildImplementGoalPrompt(packet, gap, opts = {}) {
  const fp = (gap?.fingerprint || "gap").slice(0, 12);
  return `# PEA L3 Implement — ${gap?.signal_type || "gap"}

Generated from packet \`${packet?.id || "?"}\` · gap \`${gap?.id || "?"}\` · lane **${packet?.primary_lane || "?"}**

## Diagnosis

${packet?.diagnosis || "(no diagnosis)"}

## Recommended changes

${JSON.stringify(packet?.recommended_changes || [], null, 2)}

## Ratchet plan

${JSON.stringify(packet?.ratchet_plan || {}, null, 2)}

## Instructions

1. Implement minimal diff aligned with lane ${packet?.primary_lane || "H"}.
2. Run \`npm run gate:local\`.
3. Do not enable PEA prod flags.
4. Link ratchet artifact on Accept (M2c).

Fingerprint: \`${gap?.fingerprint || ""}\`
`;
}

/**
 * @param {object} ctx
 */
export async function runManualImplementer(ctx) {
  const { packet, gap, repoRoot = process.cwd() } = ctx;
  const content = buildImplementGoalPrompt(packet, gap);
  const slug = (gap?.fingerprint || packet?.id || "packet").slice(0, 12);
  const filename = `goal-prompt-pea-implement-${slug}.md`;
  const outPath = path.join(repoRoot, filename);
  await fs.writeFile(outPath, content, "utf8");
  return { ok: true, adapter: "manual", path: outPath, filename };
}
