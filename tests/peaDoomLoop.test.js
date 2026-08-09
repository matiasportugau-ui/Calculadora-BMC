/**
 * Doom-loop guard (offline).
 */
import { checkDoomLoop, resetDoomLoopSessions } from "../server/lib/pea/doomLoopGuard.js";

let passed = 0;
let failed = 0;
function assert(c, l) { if (c) passed++; else { failed++; console.error(`  ✗ ${l}`); } }

resetDoomLoopSessions();
for (let i = 0; i < 5; i += 1) {
  assert(checkDoomLoop("sess1", "calcular_cotizacion").ok, `call ${i + 1} ok`);
}
const blocked = checkDoomLoop("sess1", "calcular_cotizacion");
assert(!blocked.ok && blocked.error === "doom_loop_detected", "6th call blocked");

console.log(`\npeaDoomLoop: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
