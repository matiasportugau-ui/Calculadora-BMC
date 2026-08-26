import assert from "node:assert/strict";
import {
  prepareJoinContext,
  shouldInsertDriverOutbox,
  joinRepartoToTrip,
} from "../server/lib/repartoTripBridge.js";
import { isPickupStop, deliveryStopIdsFromPlan } from "../server/lib/driverId.js";
import { withStopUuids, isUuid } from "../src/utils/logistica/stopUuid.js";
import { conductorPublicUrl } from "../src/utils/conductorUrl.js";

console.log("repartoTripBridge");

{
  const ctx = prepareJoinContext(
    { id: "rep-1", reparto_no: "REP-2026-08-21-001" },
    {
      stops: [
        { id: "p1", kind: "levante", cliente: "Kingspan", orderId: "PICK" },
        { cliente: "Silva", orderId: "BMC-1", direccion: "Las Piedras" },
      ],
      info: { chofer_phone: "+598 99 111 222", transportista: "Juan" },
    },
  );
  assert.equal(ctx.phone, "59899111222");
  assert.equal(ctx.deliveryStops.length, 1);
  assert.equal(ctx.deliveryStops[0].orderId, "BMC-1");
  assert.equal(ctx.plan.reparto_no, "REP-2026-08-21-001");
  assert.ok(ctx.stops.every((s) => isUuid(s.id)));
  assert.equal(shouldInsertDriverOutbox(false, ctx.phone), false);
  assert.equal(shouldInsertDriverOutbox(true, ctx.phone), true);
  assert.equal(shouldInsertDriverOutbox(true, ""), false);
  assert.equal(isPickupStop({ kind: "levante" }), true);
  console.log("  ✓ prepareJoinContext + outbox gate");
}

{
  const ids = deliveryStopIdsFromPlan([
    { id: "p1", kind: "levante", cliente: "Planta" },
    { id: "d1", cliente: "Silva" },
    { id: "d2", tipo: "entrega", cliente: "Perez" },
  ]);
  assert.deepEqual(ids, ["d1", "d2"]);
  console.log("  ✓ deliveryStopIdsFromPlan skips pickup");
}

{
  const stamped = withStopUuids([{ cliente: "A" }]);
  assert.ok(isUuid(stamped[0].id));
  const keep = withStopUuids([{ id: "11111111-1111-4111-8111-111111111111", cliente: "B" }]);
  assert.equal(keep[0].id, "11111111-1111-4111-8111-111111111111");
  console.log("  ✓ withStopUuids");
}

{
  const url = conductorPublicUrl("https://calculadora-bmc.vercel.app", "tok");
  assert.ok(url.includes("/conductor?t=tok"));
  assert.ok(!url.includes("/calculadora/conductor"));
  console.log("  ✓ driver URL path");
}

{
  const r = await joinRepartoToTrip({ pool: null, config: {}, reparto: { id: "x" }, payload: {} });
  assert.equal(r.ok, false);
  assert.equal(r.error, "no_pool");
  console.log("  ✓ join without pool");
}

{
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql: String(sql).replace(/\s+/g, " ").trim(), params });
      if (/BEGIN/i.test(sql)) return { rows: [] };
      if (/plan_snapshot->>'reparto_id'/i.test(sql)) return { rows: [] };
      if (/insert into trips/i.test(sql)) return { rows: [{ trip_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }] };
      if (/COMMIT/i.test(sql)) return { rows: [] };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  const pool = {
    connect: async () => client,
    query: client.query,
  };
  const r = await joinRepartoToTrip({
    pool,
    config: { frontendBaseUrl: "https://calculadora-bmc.vercel.app" },
    reparto: { id: "rep-9", reparto_no: "REP-2026-08-21-009" },
    payload: {
      stops: [{ cliente: "Obra", orderId: "BMC-9", direccion: "Maldonado" }],
      info: { chofer_phone: "099111222" },
    },
    notifyDriver: false,
  });
  assert.equal(r.ok, true);
  assert.ok(String(r.driver_url).includes("/conductor?t="));
  assert.ok(!calls.some((c) => /outbox_notifications/i.test(c.sql)));
  console.log("  ✓ join mock: URL + no outbox when notify false");
}

{
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql: String(sql).replace(/\s+/g, " ").trim(), params });
      if (/BEGIN/i.test(sql)) return { rows: [] };
      if (/plan_snapshot->>'reparto_id'/i.test(sql)) return { rows: [] };
      if (/insert into trips/i.test(sql)) return { rows: [{ trip_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }] };
      if (/COMMIT/i.test(sql)) return { rows: [] };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  const pool = { connect: async () => client, query: client.query };
  const r = await joinRepartoToTrip({
    pool,
    config: { frontendBaseUrl: "https://calculadora-bmc.vercel.app" },
    reparto: { id: "rep-10", reparto_no: "REP-2026-08-21-010" },
    payload: {
      stops: [
        { kind: "levante", cliente: "Kingspan", orderId: "PICK" },
        { cliente: "Obra", orderId: "BMC-10", direccion: "Maldonado" },
      ],
      info: { chofer_phone: "099111222" },
    },
    notifyDriver: true,
  });
  assert.equal(r.ok, true);
  assert.ok(String(r.driver_url).includes("/conductor?t="));
  assert.ok(!String(r.driver_url).includes("/calculadora/conductor"));
  assert.ok(calls.some((c) => /outbox_notifications/i.test(c.sql)));
  const ctx = prepareJoinContext(
    { id: "rep-10", reparto_no: "REP-2026-08-21-010" },
    {
      stops: [
        { kind: "levante", cliente: "Kingspan", orderId: "PICK" },
        { cliente: "Obra", orderId: "BMC-10", direccion: "Maldonado" },
      ],
      info: { chofer_phone: "099111222" },
    },
  );
  assert.equal(ctx.deliveryStops.length, 1);
  assert.equal(ctx.deliveryStops[0].orderId, "BMC-10");
  console.log("  ✓ join mock: outbox when notify+phone; pickup skipped");
}

console.log("repartoTripBridge OK");
