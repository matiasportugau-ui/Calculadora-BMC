/**
 * Driver POST /api/driver/events fail-closed types.
 * evidence_committed is written only by the remito upload path — not this allowlist.
 * Run: node tests/driverEventAllowlist.test.js
 */
import assert from "node:assert/strict";
import { isAllowedDriverEventType } from "../server/lib/transportistaFsm.js";

console.log("driverEventAllowlist");

const ALLOWED = [
  "stop_arrived",
  "stop_departed",
  "factory_arrived",
  "load_started",
  "load_completed",
  "factory_departed",
  "delivery_completed",
  "delivery_partial",
  "delivery_failed",
  "incident_reported",
  "location_ping",
  "presence",
];

for (const type of ALLOWED) {
  assert.equal(isAllowedDriverEventType(type), true, type);
}

const DENIED = [
  "",
  " ",
  null,
  undefined,
  "Location_Ping",
  "EVIDENCE_COMMITTED",
  "evidence_committed",
  "trip_assigned",
  "trip_confirmed",
  "trip_closed",
  "closed",
  "admin_override",
  "DROP TABLE trip_events",
  "location_ping;--",
];

for (const type of DENIED) {
  assert.equal(isAllowedDriverEventType(type), false, String(type));
}

console.log("driverEventAllowlist: ok");
