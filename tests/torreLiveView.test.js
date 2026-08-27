import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
import { compactEventsForProjection } from "../server/lib/torreLive.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("torreLiveView");

{
  assert.equal(isLiveTripStatus("assigned"), true);
  assert.equal(isLiveTripStatus("closed"), false);
  assert.equal(shouldWatchGps({ status: "assigned" }), true);
  assert.equal(shouldWatchGps({ status: "confirmed" }), true);
  assert.equal(shouldWatchGps({ status: "closed" }), false);
  assert.equal(shouldWatchGps({ status: "" }), false);
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

{
  // Compact events must preserve last ping, last meaningful, evidence_count
  // without shipping full GPS history (resource bomb after location_ping enablement).
  const compact = compactEventsForProjection({
    lastMeaningful: { event_type: "factory_departed", at_server: "2026-08-27T14:50:00Z" },
    lastPing: {
      event_type: "location_ping",
      geo_lat: -34.8,
      geo_lng: -56.1,
      at_server: "2026-08-27T14:59:00Z",
    },
    evidenceCount: 3,
  });
  const card = projectLiveTrip({
    trip: {
      trip_id: "11111111-1111-4111-8111-111111111111",
      status: "confirmed",
      plan_snapshot: { reparto_no: "REP-2", stops: [] },
    },
    events: compact,
    now: Date.parse("2026-08-27T15:00:00Z"),
  });
  assert.equal(card.evidence_count, 3);
  assert.equal(card.last_event.type, "factory_departed");
  assert.equal(card.geo.lat, -34.8);
  assert.equal(card.online, true);
  assert.ok(compact.length < 10, "compact list stays tiny vs hour of pings");
  console.log("  ✓ compactEventsForProjection feeds projectLiveTrip");
}

{
  const mapSrc = readFileSync(join(root, "src/components/logistica/TorreLiveMap.jsx"), "utf8");
  assert.ok(mapSrc.includes("textContent"), "TorreLiveMap must use text node tooltips (no HTML)");
  assert.ok(!/bindTooltip\(\s*String\(/.test(mapSrc), "must not bindTooltip(String(...)) as HTML");
  const liveSrc = readFileSync(join(root, "server/lib/torreLive.js"), "utf8");
  assert.ok(liveSrc.includes("distinct on"), "torre live must use DISTINCT ON — not full event history");
  assert.ok(!/order by trip_id, at_server asc\s*`/.test(liveSrc) || liveSrc.includes("distinct on"), "no unbounded full-history EVENTS_SQL");
  const trackSrc = readFileSync(join(root, "server/routes/customerTrack.js"), "utf8");
  assert.ok(trackSrc.includes("45 minutes"), "customer track must bound location_ping window");
  const orderSrc = readFileSync(join(root, "server/lib/orderIdLookup.js"), "utf8");
  assert.ok(orderSrc.includes("45 minutes"), "order-id lookup must bound location_ping window");
  const healthSrc = readFileSync(join(root, "server/routes/torre.js"), "utf8");
  assert.ok(
    !/torre\/health[\s\S]{0,400}ensureTransportistaSchema/.test(healthSrc),
    "unauthenticated /torre/health must not run DDL",
  );
  const drv = readFileSync(join(root, "src/components/driver/useDriverSession.js"), "utf8");
  assert.ok(
    drv.includes('type !== "presence" && type !== "location_ping"'),
    "location_ping must not enter IndexedDB outbox",
  );
  console.log("  ✓ static guards: XSS tooltip, bounded SQL, no ping outbox, no health DDL");
}

console.log("torreLiveView OK");
