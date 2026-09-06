/**
 * Driver trip-feed projector — origin must not steal the delivery city
 * when pickup is a custom /logistica place.
 * Run: node tests/driverTripFeed.test.js
 */
import assert from "node:assert/strict";
import { projectDriverTripFeed } from "../src/utils/logistica/driverTripFeed.js";
import { applyDefaultPickupToStops } from "../src/utils/logistica/wizardState.js";
import { buildRepartoPayload } from "../src/utils/logistica/repartoStatus.js";

console.log("driverTripFeed");

{
  const feed = projectDriverTripFeed({
    trip: {
      trip_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      plan_snapshot: {
        reparto_no: "ENV-1",
        stops: [
          {
            pickupPointId: "pickup-kingspan-bromyros",
            cliente: "Silva",
            direccion: "Las Piedras",
            paneles: [{ cantidad: 16 }],
          },
        ],
      },
    },
  });
  assert.equal(feed.origin, "Kingspan (Bromyros)");
  assert.equal(feed.dest, "Las Piedras");
  assert.equal(feed.qty, 16);
  assert.equal(feed.demo, false);
  console.log("  ✓ seed pickup id → catalog label, dest from stop");
}

{
  const feed = projectDriverTripFeed({
    trip: {
      trip_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      plan_snapshot: {
        reparto_no: "ENV-2",
        stops: [
          {
            pickupPointId: "custom-galpon-pepe",
            pickupLabel: "Galpón Pepe",
            cliente: "Obra",
            direccion: "Pando",
          },
        ],
      },
    },
  });
  assert.equal(feed.origin, "Galpón Pepe");
  assert.equal(feed.dest, "Pando");
  assert.equal(feed.demo, false);
  console.log("  ✓ user-created pickup keeps pickupLabel, not dest city");
}

{
  const feed = projectDriverTripFeed({
    trip: {
      plan_snapshot: {
        stops: [{ pickupPointId: "custom-xyz", cliente: "Obra", direccion: "Pando" }],
      },
    },
  });
  assert.equal(feed.origin, "custom-xyz");
  assert.notEqual(feed.origin, "Pando");
  console.log("  ✓ unknown pickup id is not replaced by delivery address");
}

{
  const empty = projectDriverTripFeed({});
  assert.equal(empty.demo, true);
  assert.equal(empty.origin, "");
  console.log("  ✓ no trip → demo feed");
}

{
  // Real confirm path: applyDefaultPickup stamps label → join → driver feed
  const places = [{ id: "pickup-custom-pepe", label: "Galpón Pepe" }];
  const stops = applyDefaultPickupToStops(
    [
      {
        cliente: "Obra",
        direccion: "Pando",
        orderId: "BMC-1",
        paneles: [{ cantidad: 8 }],
      },
    ],
    "pickup-custom-pepe",
    places,
  );
  assert.equal(stops[0].pickupLabel, "Galpón Pepe");
  const payload = buildRepartoPayload({ stops, info: { chofer_phone: "099111222" }, places });
  assert.equal(payload.stops[0].pickupLabel, "Galpón Pepe");
  assert.equal(payload.info.pickup_label, "Galpón Pepe");
  const feed = projectDriverTripFeed({
    trip: {
      trip_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      plan_snapshot: {
        reparto_no: "ENV-3",
        stops: payload.stops,
        info: payload.info,
      },
    },
  });
  assert.equal(feed.origin, "Galpón Pepe");
  assert.equal(feed.dest, "Pando");
  assert.equal(feed.qty, 8);
  assert.notEqual(feed.origin, "pickup-custom-pepe");
  console.log("  ✓ custom levante confirm stamps label → driver origin not opaque id");
}

{
  // paneles[] + legacy qty must not double-count
  const feed = projectDriverTripFeed({
    trip: {
      trip_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      plan_snapshot: {
        stops: [
          {
            pickupPointId: "pickup-kingspan-bromyros",
            direccion: "Las Piedras",
            paneles: [{ cantidad: 10 }],
            qty: 10,
          },
        ],
      },
    },
  });
  assert.equal(feed.qty, 10);
  console.log("  ✓ qty prefers paneles[] (no double-count with legacy qty)");
}

console.log("driverTripFeed OK");
