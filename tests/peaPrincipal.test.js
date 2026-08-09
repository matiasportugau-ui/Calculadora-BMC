/**
 * PEA principal authorize (offline).
 */
import { authorizePea, buildPeaPrincipal, PEA_ACTIONS } from "../server/lib/pea/principal.js";

let passed = 0;
let failed = 0;
function assert(c, l) { if (c) passed++; else { failed++; console.error(`  ✗ ${l}`); } }

const cfg = { appEnv: "development" };
const admin = buildPeaPrincipal({ sub: "u1", role: "admin" }, cfg);
const operator = buildPeaPrincipal({ sub: "u2", role: "operator" }, cfg);

assert(authorizePea(admin, PEA_ACTIONS.GRANT_WRITE).allowed, "admin grant write");
assert(authorizePea(operator, PEA_ACTIONS.GRANT_WRITE).allowed === false, "operator no grant write");
assert(authorizePea(operator, PEA_ACTIONS.GAP_READ).allowed, "operator gap read");

console.log(`\npeaPrincipal: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
