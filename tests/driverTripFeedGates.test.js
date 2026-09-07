/**
 * Driver trip-feed gates left open by #1209 happy-path tests.
 * Multi-stop dest, JSON snapshots, qty aliases, remito/hasTrip, input precedence.
 * Run: node tests/driverTripFeedGates.test.js
 */
import assert from "node:assert/strict";
import { projectDriverTripFeed } from "../src/utils/logistica/driverTripFeed.js";

console.log("driverTripFeedGates");

{
  const feed = projectDriverTripFeed({
    trip: {
      trip_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      plan_snapshot: {
        stops: [
          { kind: "levante", direccion: "Pedro Cosio" },
          { cliente: "Silva", direccion: "Las Piedras" },
          { kind: "entrega", direccion: "Pando" },
        ],
      },
    },
  });
  assert.equal(feed.origin, "Pedro Cosio");
  assert.equal(feed.dest, "Pando");
  assert.equal(feed.stopCount, 3);
  assert.notEqual(feed.dest, "Pedro Cosio");
  console.log("  ✓ dest is last delivery, not last pickup");
}

{
  const feed = projectDriverTripFeed({
    trip: {
      trip_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      plan_snapshot: {
        stops: [
          { direccion: "Obra" },
          { kind: "planta", direccion: "Fábrica Kingspan" },
        ],
      },
    },
  });
  assert.equal(feed.dest, "Obra");
  assert.equal(feed.origin, "Fábrica Kingspan");
  console.log("  ✓ trailing planta stop is not dest");
}

{
  const snap = {
    reparto_no: "ENV-JSON-1",
    info: { pickup_label: "Galpón Pepe" },
    stops: [{ cliente: "Obra", direccion: "Atlántida", qty: 4 }],
  };
  const feed = projectDriverTripFeed({
    trip: {
      trip_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      plan_snapshot: JSON.stringify(snap),
    },
  });
  assert.equal(feed.origin, "Galpón Pepe");
  assert.equal(feed.dest, "Atlántida");
  assert.equal(feed.remito, "ENV-JSON-1");
  assert.equal(feed.qty, 4);
  assert.equal(feed.demo, false);
  console.log("  ✓ string plan_snapshot JSON parses");
}

{
  const feed = projectDriverTripFeed({
    trip: {
      trip_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      plan_snapshot: "{not-json",
    },
  });
  assert.equal(feed.origin, "");
  assert.equal(feed.dest, "");
  assert.equal(feed.stopCount, 0);
  assert.equal(feed.demo, false);
  console.log("  ✓ invalid JSON snapshot does not throw; trip_id still hasTrip");
}

{
  const feed = projectDriverTripFeed({
    trip: { trip_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" },
    plan: JSON.stringify({
      stops: [{ direccion: "From-plan", paneles: [{ cantidad: 2 }, { qty: 3 }] }],
    }),
  });
  assert.equal(feed.dest, "From-plan");
  assert.equal(feed.qty, 5);
  console.log("  ✓ input.plan JSON string + panel cantidad/qty sum");
}

{
  const feed = projectDriverTripFeed({
    trip: {
      trip_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      plan_snapshot: {
        stops: [{ direccion: "Snapshot-city", qty: 9 }],
      },
    },
    plan: { stops: [{ direccion: "Live-plan-city", cantidad: 1 }] },
  });
  assert.equal(feed.dest, "Live-plan-city");
  assert.equal(feed.qty, 1);
  console.log("  ✓ non-empty input.plan wins over trip.plan_snapshot");
}

{
  const feed = projectDriverTripFeed({
    trip: {
      trip_id: "11111111-1111-4111-8111-111111111111",
      plan_snapshot: {
        stops: [{ direccion: "Snapshot-only", qty: 7 }],
      },
    },
    stops: [
      { direccion: "Override-A", qty: 2 },
      { direccion: "Override-B", cantidad: 3 },
    ],
  });
  assert.equal(feed.origin, "Override-A");
  assert.equal(feed.dest, "Override-B");
  assert.equal(feed.qty, 5);
  assert.equal(feed.stopCount, 2);
  console.log("  ✓ non-empty input.stops wins over snapshot.stops");
}

{
  const feed = projectDriverTripFeed({
    trip: {
      trip_id: "22222222-2222-4222-8222-222222222222",
      plan_snapshot: {
        stops: [
          {
            direccion: "Mix",
            qty: 10,
            cantidad: 1,
            paneles: [{ cantidad: 0, qty: 4 }, { cantidad: 2 }],
          },
        ],
      },
    },
  });
  // cantidad 0 is falsy → falls through to panel qty 4; stop uses qty (10) before cantidad.
  assert.equal(feed.qty, 16);
  console.log("  ✓ qty aliases: zero cantidad uses qty; stop qty beats cantidad");
}

{
  const feed = projectDriverTripFeed({
    trip: { reparto_no: "  ENV-TRIP-ONLY  ", plan_snapshot: {} },
  });
  assert.equal(feed.remito, "ENV-TRIP-ONLY");
  assert.equal(feed.hasTrip, true);
  assert.equal(feed.demo, false);
  console.log("  ✓ remito from trip.reparto_no (trimmed) is enough for hasTrip");
}

{
  const feed = projectDriverTripFeed({
    trip: {
      plan_snapshot: {
        info: { pickup_label: "  Levante custom  " },
        stops: [{ pickupPointId: "pickup-kingspan-bromyros", direccion: "Las Piedras" }],
      },
    },
  });
  assert.equal(feed.origin, "Levante custom");
  assert.notEqual(feed.origin, "Kingspan (Bromyros)");
  assert.notEqual(feed.origin, "Las Piedras");
  console.log("  ✓ info.pickup_label wins over seed catalog and dest city");
}

{
  const feed = projectDriverTripFeed({
    trip: { trip_id: "33333333-3333-4333-8333-333333333333" },
    plan: [],
  });
  assert.equal(feed.dest, "");
  assert.equal(feed.origin, "");
  console.log("  ✓ JSON-array plan does not throw");
}

console.log("driverTripFeedGates OK");
