/**
 * Driver trip-feed edges the happy-path file still passes if they regress:
 * plan vs snapshot precedence, JSON snapshots, pickup/delivery split, qty sum.
 * Run: node tests/driverTripFeedGates.test.js
 */
import assert from "node:assert/strict";
import { projectDriverTripFeed } from "../src/utils/logistica/driverTripFeed.js";

console.log("driverTripFeedGates");

{
  const snapStops = [{ direccion: "Desde snap", qty: 9 }];
  const planStops = [{ kind: "delivery", direccion: "Desde plan", qty: 1 }];
  const input = {
    plan: { reparto_no: "ENV-PLAN", stops: planStops },
    trip: {
      trip_id: "t1",
      plan_snapshot: { reparto_no: "ENV-SNAP", stops: snapStops },
    },
  };
  const feed = projectDriverTripFeed(input);
  assert.equal(feed.remito, "ENV-PLAN");
  assert.equal(feed.origin, "Desde plan");
  assert.equal(feed.dest, "Desde plan");
  assert.equal(feed.qty, 1);
  assert.equal(feed.demo, false);
  assert.equal(snapStops[0].qty, 9);
  assert.equal(input.trip.plan_snapshot.reparto_no, "ENV-SNAP");
  console.log("  ✓ plan object wins over trip.plan_snapshot");
}

{
  const feed = projectDriverTripFeed({
    plan: JSON.stringify({
      reparto_no: "FROM-STR",
      stops: [{ direccion: "String plan", qty: 3 }],
    }),
    trip: {
      plan_snapshot: { reparto_no: "SNAP", stops: [{ direccion: "Snap", qty: 9 }] },
    },
  });
  assert.equal(feed.remito, "FROM-STR");
  assert.equal(feed.dest, "String plan");
  assert.equal(feed.qty, 3);
  console.log("  ✓ string plan JSON is parsed and still beats the snapshot");
}

{
  const feed = projectDriverTripFeed({
    plan: "{",
    trip: {
      trip_id: "t-bad-plan",
      plan_snapshot: { reparto_no: "SNAP", stops: [{ direccion: "Snap", qty: 4 }] },
    },
  });
  assert.equal(feed.dest, "Snap");
  assert.equal(feed.qty, 4);
  assert.equal(feed.remito, "SNAP");
  assert.equal(feed.demo, false);
  console.log("  ✓ corrupt plan JSON falls through to the snapshot");
}

{
  const feed = projectDriverTripFeed({
    trip: {
      plan_snapshot: JSON.stringify({
        reparto_no: "ENV-9",
        info: { pickup_label: "Planta BMC" },
        stops: [
          { kind: "planta", direccion: "Fábrica", qty: 1 },
          {
            kind: "entrega",
            cliente: "Obra",
            direccion: "Las Piedras",
            paneles: [{ cantidad: "2" }, { qty: 3 }],
            cantidad: 4,
          },
          { role: "deposito", label: "Depósito final" },
        ],
      }),
    },
  });
  assert.equal(feed.origin, "Planta BMC");
  assert.notEqual(feed.origin, "Fábrica");
  assert.equal(feed.dest, "Las Piedras");
  assert.notEqual(feed.dest, "Depósito final");
  assert.equal(feed.qty, 10);
  assert.equal(feed.stopCount, 3);
  assert.equal(feed.remito, "ENV-9");
  console.log("  ✓ string snapshot: pickup_label, delivery dest, panel+stop qty");
}

{
  const feed = projectDriverTripFeed({
    trip: { trip_id: "t-bad", plan_snapshot: "{not json" },
  });
  assert.equal(feed.origin, "");
  assert.equal(feed.dest, "");
  assert.equal(feed.qty, 0);
  assert.equal(feed.hasTrip, true);
  assert.equal(feed.demo, false);
  console.log("  ✓ corrupt snapshot JSON does not throw; trip id is not a demo");
}

{
  const feed = projectDriverTripFeed({
    trip: { trip_id: "t-num", plan_snapshot: 4 },
  });
  assert.equal(feed.stops.length, 0);
  assert.equal(feed.origin, "");
  assert.equal(feed.hasTrip, true);
  assert.equal(feed.demo, false);
  console.log("  ✓ numeric plan_snapshot is ignored");
}

{
  const feed = projectDriverTripFeed({
    plan: {},
    trip: {
      reparto_no: "SOLO",
      plan_snapshot: { info: { pickupName: "Galpón" }, stops: [] },
    },
  });
  assert.equal(feed.origin, "Galpón");
  assert.equal(feed.dest, "");
  assert.equal(feed.remito, "SOLO");
  assert.equal(feed.hasTrip, true);
  assert.equal(feed.demo, false);
  console.log("  ✓ empty plan object falls through to snapshot pickupName");
}

{
  const feed = projectDriverTripFeed({
    stops: [{ direccion: "Override", qty: 7 }],
    trip: { plan_snapshot: { stops: [{ direccion: "Snap", qty: 1 }], reparto_no: "R" } },
  });
  assert.equal(feed.origin, "Override");
  assert.equal(feed.dest, "Override");
  assert.equal(feed.qty, 7);
  assert.equal(feed.stopCount, 1);
  assert.equal(feed.remito, "R");
  console.log("  ✓ input.stops replace snapshot stops; remito stays on the snapshot");
}

{
  const feed = projectDriverTripFeed({
    stops: [],
    trip: {
      plan_snapshot: { reparto_no: "R", stops: [{ direccion: "Snap", qty: 2 }] },
    },
  });
  assert.equal(feed.dest, "Snap");
  assert.equal(feed.qty, 2);
  assert.equal(feed.remito, "R");
  console.log("  ✓ empty stops array does not hide the snapshot");
}

{
  const feed = projectDriverTripFeed({
    trip: {
      trip_id: "t-bound",
      plan_snapshot: {
        stops: [
          { kind: "depositoextra", direccion: "No es planta", qty: 1 },
          { tipo: "mi deposito norte", cliente: "Cliente", qty: 2 },
        ],
      },
    },
  });
  assert.equal(feed.origin, "Cliente");
  assert.equal(feed.dest, "No es planta");
  assert.equal(feed.qty, 3);
  console.log("  ✓ deposito word boundary: extra is a delivery; pickup qty still counts");
}

{
  const feed = projectDriverTripFeed({
    trip: {
      trip_id: "t-nan",
      plan_snapshot: { stops: [{ paneles: [{ cantidad: "abc" }], qty: 1 }] },
    },
  });
  assert.equal(Number.isNaN(feed.qty), true);
  console.log("  ✓ non-numeric panel cantidad poisons qty (not coerced to 0)");
}

{
  const feed = projectDriverTripFeed({ trip: { trip_id: "only-id" } });
  assert.equal(feed.origin, "");
  assert.equal(feed.dest, "");
  assert.equal(feed.hasTrip, true);
  assert.equal(feed.demo, false);
  console.log("  ✓ trip id without places stays empty — no invented city");
}

console.log("driverTripFeedGates OK");
