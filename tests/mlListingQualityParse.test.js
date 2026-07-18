import assert from "node:assert/strict";
import { parseListingQualityJson } from "../server/lib/mlListingQuality.js";

const sample = `\`\`\`json
{
  "scores": { "title": 8, "images": 6, "attributes": 7, "description": 5, "overall": 6.5 },
  "issues": [{ "area": "images", "severity": "high", "message": "Pocas fotos", "fix": "Subir ≥4" }],
  "suggested_patches": { "title": "Panel BMC 100mm", "description": null, "attributes": [], "image_notes": "Usar fotos reales" },
  "moderation_penalty_note": null,
  "summary": "Mejorar fotos y descripción."
}
\`\`\``;

const parsed = parseListingQualityJson(sample);
assert.equal(parsed.scores.title, 8);
assert.equal(parsed.issues.length, 1);
assert.equal(parsed.suggested_patches.title, "Panel BMC 100mm");

const raw = parseListingQualityJson(
  '{"scores":{"overall":5},"issues":[],"suggested_patches":{},"summary":"ok"}',
);
assert.equal(raw.scores.overall, 5, "raw model JSON must parse without fences");

const withPreamble = parseListingQualityJson(
  'Resultado de auditoría:\n{"scores":{"overall":7},"issues":[]}',
);
assert.equal(
  withPreamble.scores.overall,
  7,
  "JSON must be extracted when the model adds leading prose",
);

assert.throws(
  () => parseListingQualityJson("sin objeto JSON"),
  /No JSON object found/,
  "non-JSON model output must fail explicitly for the audit fallback",
);
assert.throws(
  () => parseListingQualityJson("```json\n{ broken }\n```"),
  SyntaxError,
  "malformed fenced JSON must reach the audit fallback",
);

console.log("mlListingQualityParse tests passed");
