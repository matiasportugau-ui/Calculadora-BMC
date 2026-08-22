/**
 * Complementary Driver Loop gates after #1078 (not covered by tip or open #1082).
 * POD evidence, phone aliases, factory→en_curso projection, FSM transitions.
 * Run: node tests/driverLoopGates.test.js
 *
 * Intentionally does not pin location_ping allowlist (open #1081)
 * or per-stop delivery_completed close (open #1080).
 */
import assert from "node:assert/strict";
import { hasEvidenceForStop, isAllowedDriverEventType } from "../server/lib/transportistaFsm.js";
import { projectRepartoFromDriverEvent } from "../server/routes/transportista.js";
import { prepareJoinContext } from "../server/lib/repartoTripBridge.js";
import { generateOpaqueToken, sha256Hex } from "../server/lib/driverToken.js";
import { sanitizeSnapshot, deriveCustomerTrack } from "../src/utils/logistica/customerTrackView.js";
import {
  canTransitionReparto,
  normalizeRepartoStatus,
} from "../src/utils/logistica/repartoStatus.js";
import { isUuid } from "../src/utils/logistica/stopUuid.js";

console.log("driverLoopGates");

{
  assert.equal(await hasEvidenceForStop({ query: async () => ({ rows: [{ ok: 1 }] } ) }, "t", null), false);
  assert.equal(await hasEvidenceForStop({ query: async () => ({ rows: [{ ok: 1 }] } ) }, "t", ""), false);
  const empty = { query: async () => ({ rows: [] }) };
  assert.equal(await hasEvidenceForStop(empty, "t", "11111111-1111-4111-8111-111111111111"), false);
  const hit = {
    async query(sql, params) {
      assert.match(String(sql), /evidence_committed/);
      assert.equal(params[0], "trip-a");
      assert.equal(params[1], "stop-a");
      return { rows: [{ "?column?": 1 }] };
    },
  };
  assert.equal(await hasEvidenceForStop(hit, "trip-a", "stop-a"), true);
  console.log("  ✓ hasEvidenceForStop: missing stopId / empty / match");
}

{
  assert.equal(isAllowedDriverEventType("delivery_partial"), true);
  assert.equal(isAllowedDriverEventType("delivery_failed"), true);
  assert.equal(isAllowedDriverEventType("stop_departed"), true);
  assert.equal(isAllowedDriverEventType("evidence_committed"), false);
  assert.equal(isAllowedDriverEventType("  factory_arrived"), false);
  console.log("  ✓ ingest allowlist: partial/fail/depart; reject evidence + padded type");
}

{
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql: String(sql).replace(/\s+/g, " ").trim(), params });
      if (/select plan_snapshot/i.test(sql)) {
        return { rows: [{ plan_snapshot: { reparto_id: "rep-1", stops: [] } }] };
      }
      return { rows: [], rowCount: 1 };
    },
  };
  await projectRepartoFromDriverEvent(pool, "trip-1", "factory_arrived");
  assert.ok(calls.some((c) => /update repartos set status = 'en_curso'/i.test(c.sql)));
  assert.equal(calls.find((c) => /update repartos/i.test(c.sql))?.params[0], "rep-1");
  assert.ok(!calls.some((c) => /status = 'cerrado'/i.test(c.sql)));
  console.log("  ✓ factory_arrived projects coordinado → en_curso");
}

{
  const calls = [];
  const pool = {
    async query(sql) {
      calls.push(String(sql).replace(/\s+/g, " ").trim());
      return { rows: [{ plan_snapshot: { stops: [] } }] };
    },
  };
  await projectRepartoFromDriverEvent(pool, "trip-2", "factory_arrived");
  assert.ok(!calls.some((s) => /update repartos/i.test(s)));
  console.log("  ✓ no-op when plan has no reparto_id");
}

{
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql: String(sql).replace(/\s+/g, " ").trim(), params });
      if (/select plan_snapshot/i.test(sql)) {
        return { rows: [{ plan_snapshot: { reparto_id: "rep-3", stops: [] } }] };
      }
      return { rows: [], rowCount: 1 };
    },
  };
  await projectRepartoFromDriverEvent(pool, "trip-3", "incident_reported");
  assert.ok(!calls.some((c) => /update repartos/i.test(c.sql)));
  console.log("  ✓ incident_reported does not start the trip");
}

{
  const fromAssigned = prepareJoinContext(
    { id: "rep-p", assigned_phone_e164: "+598 99 333 444" },
    { stops: [{ cliente: "A", orderId: "1" }], info: {} },
  );
  assert.equal(fromAssigned.phone, "59899333444");

  const fromAlias = prepareJoinContext(
    { id: "rep-a" },
    { stops: [{ cliente: "A", orderId: "1" }], info: { telefono_chofer: "099555666" } },
  );
  assert.equal(fromAlias.phone, "099555666");

  const preferChofer = prepareJoinContext(
    { id: "rep-c", assigned_phone_e164: "59811111111" },
    {
      stops: [{ cliente: "A", orderId: "1" }],
      info: { chofer_phone: "099222333", telefono_chofer: "099999999" },
    },
  );
  assert.equal(preferChofer.phone, "099222333");
  console.log("  ✓ chofer_phone > telefono_chofer > assigned_phone_e164");
}

{
  const ctx = prepareJoinContext(
    { id: "rep-ws" },
    { stops: [{ cliente: "   ", direccion: "Las Piedras" }], info: {} },
  );
  assert.equal(ctx.deliveryStops.length, 1);
  const snap = sanitizeSnapshot({
    quote_ref: ctx.deliveryStops[0].orderId || ctx.deliveryStops[0].cotizacionId || "",
    customer_display_name: ctx.deliveryStops[0].cliente || "",
  });
  assert.ok(!snap.quote_ref);
  assert.ok(!snap.customer_display_name);
  console.log("  ✓ whitespace-only cliente does not mint a public track snapshot");
}

{
  const view = deriveCustomerTrack({ snapshot: {}, events: [] });
  assert.equal(view.stages[0].status, "pending");
  assert.equal(view.stages[3].status, "pending");
  assert.equal(view.inTransit, false);
  console.log("  ✓ empty snapshot stays pending (no order / no truck)");
}

{
  assert.equal(canTransitionReparto("coordinado", "en_curso"), true);
  assert.equal(canTransitionReparto("en_curso", "cerrado"), true);
  assert.equal(canTransitionReparto("en_curso", "coordinado"), false);
  assert.equal(canTransitionReparto("cerrado", "en_curso"), false);
  assert.equal(normalizeRepartoStatus("encoordinacion"), "en_coordinacion");
  assert.equal(normalizeRepartoStatus("???"), "draft");
  console.log("  ✓ Driver Loop FSM: coordinado→en_curso→cerrado; junk → draft");
}

{
  const a = generateOpaqueToken();
  const b = generateOpaqueToken();
  assert.notEqual(a, b);
  assert.ok(a.length >= 32);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.equal(sha256Hex(a).length, 64);
  assert.equal(sha256Hex(a), sha256Hex(a));
  assert.notEqual(sha256Hex(a), sha256Hex(b));
  console.log("  ✓ opaque token unique + sha256 hex");
}

{
  assert.equal(isUuid(""), false);
  assert.equal(isUuid("not-a-uuid"), false);
  assert.equal(isUuid("00000000-0000-0000-0000-000000000000"), false);
  assert.equal(isUuid("11111111-1111-4111-8111-111111111111"), true);
  console.log("  ✓ isUuid rejects empty / nil / junk");
}

console.log("driverLoopGates OK");
