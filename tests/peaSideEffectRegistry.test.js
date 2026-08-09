/**
 * SideEffect registry (offline).
 */
import { assertToolRegistered, getSideEffect, isToolRegistered } from "../server/lib/pea/sideEffectRegistry.js";

let passed = 0;
let failed = 0;
function assert(c, l) { if (c) passed++; else { failed++; console.error(`  ✗ ${l}`); } }

assert(isToolRegistered("pea_explain_gap"), "pea tool registered");
assert(getSideEffect("calcular_cotizacion")?.risk_level === "R0", "calc R0");
assert(assertToolRegistered("unknown_tool_xyz", { peaSideEffectEnforce: false }).ok, "enforce off skips");
assert(assertToolRegistered("unknown_tool_xyz", { peaSideEffectEnforce: true }).ok === false, "enforce on denies");

console.log(`\npeaSideEffectRegistry: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
