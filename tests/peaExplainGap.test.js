/**
 * PEA explain gap (offline).
 * Run: node tests/peaExplainGap.test.js
 */
import {
  assertNoInventedPrices,
  buildGapNarrative,
  explainGap,
} from "../server/lib/pea/explainGap.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

const gap = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Tool fail: calcular_cotizacion",
  signal_type: "tool_fail",
  occurrence_count: 3,
  summary: "validation error on zones",
};

const packet = {
  id: "00000000-0000-4000-8000-000000000002",
  status: "ready_for_review",
  primary_lane: "H",
  diagnosis: "Diagnóstico: revisar contrato de zonas en calc loopback.",
  blast_radius: {
    summary: "read-only L2",
    operator_summary: "Panelin detectó fallos recurrentes en calcular_cotizacion.",
  },
  recommended_changes: [{ description: "Agregar golden de zonas vacías" }],
};

const { narrative, softHint } = buildGapNarrative(packet, gap);
assert(narrative.includes("tool_fail"), "narrative mentions signal");
assert(narrative.includes("Lane recomendada"), "narrative includes lane");
assert(softHint.includes("calcular_cotizacion"), "soft hint points to calc tool");
assert(assertNoInventedPrices(narrative, gap.summary).ok, "no invented prices");

const disabled = await explainGap(null, { peaEnabled: false }, {});
assert(disabled.pea_enabled === false, "disabled env message");
assert(disabled.soft_hint, "disabled still has soft hint");

const badPrice = assertNoInventedPrices("Total USD 4500", "sin precios");
assert(!badPrice.ok, "detects invented USD");

console.log(`\npeaExplainGap: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
