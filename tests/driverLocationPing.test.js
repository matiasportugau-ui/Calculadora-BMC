/**
 * Driver Loop GPS: location_ping must be an allowed FSM event.
 * Run: node tests/driverLocationPing.test.js
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isAllowedDriverEventType } from "../server/lib/transportistaFsm.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const session = readFileSync(join(root, "src/components/driver/useDriverSession.js"), "utf8");
const transportista = readFileSync(join(root, "server/routes/transportista.js"), "utf8");

console.log("driverLocationPing");

assert.equal(isAllowedDriverEventType("location_ping"), true);
console.log("  ✓ FSM allows location_ping");

assert.match(session, /sendEvent\("location_ping"/);
assert.match(session, /if \(type === "location_ping"\) return;/);
console.log("  ✓ PWA emits location_ping and skips outbox on failure");

assert.match(transportista, /type !== "location_ping"/);
console.log("  ✓ server skips REP projection for location_ping");

console.log("driverLocationPing OK");
