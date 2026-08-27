import assert from "node:assert/strict";
import {
  TORRE_ONLINE_MS,
  isLiveTripStatus,
  shouldWatchGps,
  lastLocationPing,
  isOnline,
  phoneTail,
  projectLiveTrip,
  projectLiveBoard,
} from "../src/utils/logistica/torreLiveView.js";

console.log("torreLiveView");

{
  assert.equal(isLiveTripStatus("assigned"), true);
  assert.equal(isLiveTripStatus("closed"), false);
  assert.equal(shouldWatchGps({ status: "assigned" }), true);
  assert.equal(shouldWatchGps({ status: "closed" }), false);
  assert.equal(shouldWatchGps(null), false);
  console.log("  ✓ live status + GPS watch policy");
}

{
  const now = Date.parse("2026-08-27T15:00:00Z");
  const ping = lastLocationPing(
    [
      { event_type: "factory_arrived", at_server: "2026-08-27T14:00:00Z" },
      {
        event_type: "location_ping",
        geo_lat: -34.9,
        geo_lng: -56.16,
        at_server: "2026-08-27T14:59:30Z",
      },
    ],
    { now },
  );
  assert.equal(ping.lat, -34.9);
  assert.equal(isOnline(ping, { now, windowMs: TORRE_ONLINE_MS }), true);
  assert.equal(isOnline(ping, { now: now + TORRE_ONLINE_MS + 1 }), false);
  assert.equal(lastLocationPing([{ event_type: "location_ping", geo_lat: 999, geo_lng: 0 }]), null);
  console.log("  ✓ last ping + online window 90s");
}

{
  assert.equal(phoneTail("+598 99 123 456"), "3456");
  const card = projectLiveTrip({
    trip: {
      trip_id: "11111111-1111-4111-8111-111111111111",
      status: "assigned",
      assigned_phone_e164: "+59899123456",
      plan_snapshot: {
        reparto_no: "REP-1",
        reparto_id: "r1",
        transportista: "Juan",
        stops: [{}, {}],
      },
    },
    events: [
      { event_type: "evidence_committed", at_server: "2026-08-27T14:20:00Z" },
      { event_type: "factory_departed", at_server: "2026-08-27T14:50:00Z" },
      {
        event_type: "location_ping",
        geo_lat: -34.8,
        geo_lng: -56.1,
        at_server: "2026-08-27T14:59:00Z",
      },
    ],
    now: Date.parse("2026-08-27T15:00:00Z"),
  });
  assert.equal(card.reparto_no, "REP-1");
  assert.equal(card.phone_tail, "3456");
  assert.equal(card.online, true);
  assert.equal(card.evidence_count, 1);
  assert.equal(card.last_event.type, "factory_departed");
  assert.ok(!JSON.stringify(card).includes("99123456"));
  assert.ok(!("token" in card));
  console.log("  ✓ projectLiveTrip sanitizes phone / no token");
}

{
  const board = projectLiveBoard({
    trips: [
      { trip_id: "a", status: "assigned", plan_snapshot: { reparto_no: "ON" } },
      { trip_id: "b", status: "closed", plan_snapshot: { reparto_no: "OFF" } },
    ],
    eventsByTrip: {},
  });
  assert.equal(board.length, 1);
  assert.equal(board[0].reparto_no, "ON");
  console.log("  ✓ board drops closed trips");
}

console.log("torreLiveView OK");
