import assert from "node:assert/strict";
import {
  digitsPhone,
  prepareJoinContext,
  shouldInsertDriverOutbox,
  joinRepartoToTrip,
  isJoinSchemaMissing,
} from "../server/lib/repartoTripBridge.js";
import { isPickupStop } from "../server/lib/driverId.js";
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
  assert.equal(isPickupStop({ tipo: "deposito" }), true);
  assert.equal(isPickupStop({ role: "planta" }), true);
  assert.equal(isPickupStop({ kind: "fábrica" }), true);
  assert.equal(isPickupStop({ kind: "obra" }), false);
  assert.equal(isPickupStop({ kind: "delivery" }), false);
  assert.equal(digitsPhone("+598 99 111 222"), "59899111222");
  assert.equal(digitsPhone("1234567"), "");
  assert.equal(digitsPhone(""), "");
  assert.equal(shouldInsertDriverOutbox(true, "1234567"), false);
  console.log("  ✓ prepareJoinContext + outbox gate");
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
  assert.equal(r.customer_links.length, 1);
  assert.equal(r.customer_links[0].cliente, "Obra");
  assert.ok(String(r.customer_links[0].url).includes("/seguimiento/"));
  console.log("  ✓ join mock: outbox when notify+phone; pickup skipped");
}

{
  const calls = [];
  const existingId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const client = {
    async query(sql, params) {
      calls.push({ sql: String(sql).replace(/\s+/g, " ").trim(), params });
      if (/BEGIN/i.test(sql)) return { rows: [] };
      if (/plan_snapshot->>'reparto_id'/i.test(sql)) return { rows: [{ trip_id: existingId }] };
      if (/COMMIT/i.test(sql)) return { rows: [] };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  const pool = { connect: async () => client, query: client.query };
  const r = await joinRepartoToTrip({
    pool,
    config: { frontendBaseUrl: "https://calculadora-bmc.vercel.app" },
    reparto: { id: "rep-11", reparto_no: "REP-2026-08-21-011" },
    payload: {
      stops: [{ cliente: "Obra", orderId: "BMC-11", direccion: "Maldonado" }],
      info: { chofer_phone: "099111222" },
    },
    notifyDriver: false,
  });
  assert.equal(r.ok, true);
  assert.equal(r.trip_id, existingId);
  assert.ok(!calls.some((c) => /insert into trips/i.test(c.sql)));
  assert.ok(calls.some((c) => /insert into driver_sessions/i.test(c.sql)));
  console.log("  ✓ join mock: reuse existing trip, mint new session");
}

{
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(String(sql).replace(/\s+/g, " ").trim());
      if (/BEGIN/i.test(sql)) return { rows: [] };
      if (/plan_snapshot->>'reparto_id'/i.test(sql)) return { rows: [] };
      if (/insert into trips/i.test(sql)) {
        const err = new Error('relation "trips" does not exist');
        err.code = "42P01";
        throw err;
      }
      if (/ROLLBACK/i.test(sql)) return { rows: [] };
      return { rows: [] };
    },
    release() {},
  };
  const pool = { connect: async () => client, query: client.query };
  const r = await joinRepartoToTrip({
    pool,
    config: {},
    reparto: { id: "rep-12", reparto_no: "REP-2026-08-21-012" },
    payload: { stops: [{ cliente: "X", orderId: "1" }], info: { chofer_phone: "099111222" } },
  });
  assert.equal(r.ok, false);
  assert.equal(r.code, "42P01");
  assert.ok(calls.some((sql) => /ROLLBACK/i.test(sql)));
  assert.equal(isJoinSchemaMissing(r), true);
  assert.equal(isJoinSchemaMissing({ error: "timeout" }), false);
  console.log("  ✓ join mock: rollback + schema-missing classify");
}

console.log("repartoTripBridge OK");
