/**
 * Run: node tests/customerTrackView.test.js
 */
import assert from "node:assert/strict";
import {
  deriveCustomerTrack,
  lastFreshGeo,
  sanitizeSnapshot,
  osmEmbedUrl,
  GPS_MAX_AGE_MS,
} from "../src/utils/logistica/customerTrackView.js";

console.log("customerTrackView");

{
  const dirty = sanitizeSnapshot({
    quote_ref: " BMC-2026-1048 ",
    customer_display_name: "Silva",
    driver_phone: "+59899111222",
    notes: "internal",
    product_summary: "ISOFRIG 80",
  });
  assert.equal(dirty.quote_ref, "BMC-2026-1048");
  assert.equal(dirty.driver_phone, undefined);
  assert.equal(dirty.notes, undefined);
  console.log("  ✓ sanitize drops internal fields");
}

{
  const now = Date.parse("2026-08-16T15:00:00.000Z");
  const fresh = lastFreshGeo(
    [
      { geo_lat: -34.9, geo_lng: -56.16, at_server: "2026-08-16T14:50:00.000Z" },
    ],
    { now },
  );
  assert.ok(fresh);
  assert.equal(fresh.lat, -34.9);
  const stale = lastFreshGeo(
    [{ geo_lat: -34.9, geo_lng: -56.16, at_server: "2026-08-16T12:00:00.000Z" }],
    { now, maxAgeMs: GPS_MAX_AGE_MS },
  );
  assert.equal(stale, null);
  console.log("  ✓ GPS only when fresh");
}

{
  const view = deriveCustomerTrack({
    snapshot: {
      quote_ref: "BMC-2026-1048",
      customer_display_name: "Silva",
      product_summary: "ISOFRIG 80 · 240 m²",
      order_at: "2026-08-12T10:14:00.000Z",
      production_date: "2026-08-18",
      pickup_label: "Kingspan (Bromyros)",
      pickup_scheduled_at: "2026-08-19T09:00:00.000Z",
      destination_label: "Las Piedras",
    },
    tripStatus: "draft",
    events: [],
  });
  assert.equal(view.stages[0].status, "done");
  assert.equal(view.stages[1].status, "current");
  assert.equal(view.stages[1].date, "2026-08-18");
  assert.equal(view.stages[2].status, "current");
  assert.equal(view.stages[2].pickupLabel, "Kingspan (Bromyros)");
  assert.equal(view.stages[3].status, "pending");
  assert.equal(view.truck, null);
  assert.equal(view.inTransit, false);
  console.log("  ✓ order + production + scheduled transport before truck leaves");
}

{
  const now = Date.parse("2026-08-19T11:00:00.000Z");
  const view = deriveCustomerTrack({
    snapshot: { quote_ref: "BMC-2026-1048", customer_display_name: "Silva" },
    tripStatus: "assigned",
    events: [
      { event_type: "factory_departed", at_server: "2026-08-19T10:40:00.000Z" },
      {
        event_type: "location_ping",
        geo_lat: -34.83,
        geo_lng: -56.2,
        at_server: "2026-08-19T10:55:00.000Z",
      },
    ],
    now,
  });
  assert.equal(view.stages[3].status, "current");
  assert.ok(view.inTransit);
  assert.ok(view.truck);
  assert.equal(view.truck.lat, -34.83);
  console.log("  ✓ truck GPS only after factory_departed");
}

{
  const view = deriveCustomerTrack({
    snapshot: { quote_ref: "X" },
    events: [
      { event_type: "factory_departed", at_server: "2026-08-19T10:00:00.000Z" },
      { event_type: "delivery_completed", at_server: "2026-08-19T12:00:00.000Z" },
      {
        event_type: "location_ping",
        geo_lat: -34.8,
        geo_lng: -56.1,
        at_server: "2026-08-19T12:01:00.000Z",
      },
    ],
    now: Date.parse("2026-08-19T12:02:00.000Z"),
  });
  assert.equal(view.stages[3].status, "done");
  assert.equal(view.truck, null);
  assert.equal(view.inTransit, false);
  console.log("  ✓ hide GPS after delivered");
}

{
  const url = osmEmbedUrl(-34.8776, -56.1033);
  assert.ok(url.includes("openstreetmap.org"));
  assert.ok(url.includes("-34.8776"));
  assert.equal(osmEmbedUrl("x", "y"), null);
  console.log("  ✓ OSM embed");
}

console.log("customerTrackView OK");
