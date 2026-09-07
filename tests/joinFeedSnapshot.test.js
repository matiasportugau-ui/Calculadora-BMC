/**
 * joinRepartoToTrip plan_snapshot → projectDriverTripFeed.
 * This is the #1209 /conductor bind: screens render origin/dest/qty/remito
 * from the snapshot join writes, not demo copy.
 * Run: node tests/joinFeedSnapshot.test.js
 */
import assert from "node:assert/strict";
import { prepareJoinContext } from "../server/lib/repartoTripBridge.js";
import { projectDriverTripFeed } from "../src/utils/logistica/driverTripFeed.js";

console.log("joinFeedSnapshot");

const payload = {
  stops: [
    {
      kind: "levante",
      cliente: "Kingspan",
      direccion: "Pedro Cosio",
      pickupPointId: "pickup-kingspan-bromyros",
      paneles: [{ id: "p1", tipo: "ISODEC", cantidad: 8 }],
    },
    {
      cliente: "Silva",
      orderId: "BMC-2026-3102",
      direccion: "Las Piedras",
      paneles: [{ id: "p2", tipo: "ISODEC", qty: 8 }],
    },
  ],
  info: { chofer_phone: "099111222", transportista: "Juan" },
  truckL: 13.5,
};

{
  const ctx = prepareJoinContext({ id: "rep-feed-1", reparto_no: "ENV-260907-001" }, payload);
  assert.equal(ctx.deliveryStops.length, 1);
  assert.equal(ctx.deliveryStops[0].orderId, "BMC-2026-3102");
  assert.equal(ctx.plan.reparto_no, "ENV-260907-001");
  assert.equal(ctx.plan.schema, "bmc-trip-from-reparto-v1");

  const feed = projectDriverTripFeed({
    trip: {
      trip_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      plan_snapshot: ctx.plan,
    },
  });
  assert.equal(feed.demo, false);
  assert.equal(feed.hasTrip, true);
  assert.equal(feed.remito, "ENV-260907-001");
  assert.equal(feed.origin, "Pedro Cosio");
  assert.equal(feed.dest, "Las Piedras");
  assert.equal(feed.qty, 16);
  assert.equal(feed.stopCount, 2);
  assert.notEqual(feed.origin, "Las Piedras");
  console.log("  ✓ join plan object → remito/origin/dest/qty for Driver Home");
}

{
  const ctx = prepareJoinContext({ id: "rep-feed-2", reparto_no: "ENV-260907-002" }, payload);
  const feed = projectDriverTripFeed({
    trip: {
      trip_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      plan_snapshot: JSON.stringify(ctx.plan),
    },
  });
  assert.equal(feed.remito, "ENV-260907-002");
  assert.equal(feed.origin, "Pedro Cosio");
  assert.equal(feed.dest, "Las Piedras");
  assert.equal(feed.qty, 16);
  console.log("  ✓ join plan as JSON string (pg text) projects the same");
}

{
  const ctx = prepareJoinContext(
    { id: "rep-feed-3", reparto_no: "ENV-260907-003" },
    {
      stops: [
        { kind: "planta", cliente: "Montfrío", pickupPointId: "pickup-montfrio" },
        { cliente: "Obra", orderId: "BMC-9", direccion: "Maldonado", cantidad: 12 },
      ],
      info: { pickup_label: "Montfrío patio" },
    },
  );
  const feed = projectDriverTripFeed({
    trip: { trip_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", plan_snapshot: ctx.plan },
  });
  assert.equal(feed.origin, "Montfrío patio");
  assert.equal(feed.dest, "Maldonado");
  assert.equal(feed.qty, 12);
  assert.equal(ctx.deliveryStops.length, 1);
  console.log("  ✓ info.pickup_label from join info survives onto feed origin");
}

{
  const ctx = prepareJoinContext({ id: "rep-empty", reparto_no: "" }, { stops: [], info: {} });
  const feed = projectDriverTripFeed({ trip: { plan_snapshot: ctx.plan } });
  assert.equal(feed.demo, true);
  assert.equal(feed.origin, "");
  assert.equal(feed.dest, "");
  assert.equal(feed.hasTrip, false);
  console.log("  ✓ empty join (no remito, no stops) → demo feed / disabled CTA");
}

console.log("joinFeedSnapshot OK");
