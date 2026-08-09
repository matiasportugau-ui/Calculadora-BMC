/**
 * PEA ArchitectRuntime + Critic + lanes (offline).
 * Run: node tests/peaArchitectRuntime.test.js
 */
import { routeLane } from "../server/lib/pea/laneRouter.js";
import { runCritic, revisePacketOnce } from "../server/lib/pea/critic.js";
import {
  buildMockArchitectPacket,
  finalizePacketWithCritic,
} from "../server/lib/pea/evolutionPackets.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

assert(routeLane({ signal_type: "tool_fail" }).primary === "H", "tool_fail → H");
assert(routeLane({ signal_type: "kb_gap" }).primary === "K", "kb_gap → K");
assert(routeLane({ signal_type: "calc_error" }).primary === "C", "calc_error → C");
assert(routeLane({ signal_type: "provider_fail" }).primary === "H", "provider_fail → H");

const gap = {
  id: "00000000-0000-4000-8000-000000000001",
  signal_type: "tool_fail",
  occurrence_count: 4,
  summary: "calcular_cotizacion validation failed",
  fingerprint: "abcd1234ef567890",
  metadata: { tool_id: "calcular_cotizacion" },
};

const laneInfo = routeLane(gap);
const draft = buildMockArchitectPacket(gap, laneInfo, "Explore notes for test.");
const critic = runCritic(draft, { gap });
assert(critic.passed, "mock packet passes critic on first pass");

const bad = { ...draft, spec_citations: [], blast_radius: {} };
const badCritic = runCritic(bad, { gap });
assert(!badCritic.passed, "invalid packet fails critic");
const revised = revisePacketOnce(bad, badCritic, gap);
const revisedCritic = runCritic(revised, { gap });
assert(revisedCritic.passed, "one revise fixes packet");

const finalized = finalizePacketWithCritic(draft, gap);
assert(finalized.status === "ready_for_review", "finalize sets ready_for_review");
assert(finalized.critic_result?.passed, "finalize attaches critic result");

console.log(`\npeaArchitectRuntime: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
