/**
 * Driver trip-feed projector — origin must not steal the delivery city
 * when pickup is a custom /logistica place.
 * Run: node tests/driverTripFeed.test.js
 */
import assert from "node:assert/strict";
import { pickDriverActiveTrip, projectDriverTripFeed } from "../src/utils/logistica/driverTripFeed.js";

console.log("driverTripFeed");

{
  const pick = pickDriverActiveTrip([
    { trip_id: "closed", status: "closed", closed_at: "2026-09-09T12:00:00.000Z", updated_at: "2026-09-09T12:00:00.000Z" },
    { trip_id: "open", status: "assigned", closed_at: null, updated_at: "2026-09-09T10:00:00.000Z" },
  ]);
  assert.equal(pick.trip_id, "open");
  assert.equal(pickDriverActiveTrip([{ trip_id: "only-closed", status: "closed" }]).trip_id, "only-closed");
  assert.equal(pickDriverActiveTrip([]), null);
  console.log("  ✓ pickDriverActiveTrip prefers open over closed");
}
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

console.log("driverTripFeed OK");
