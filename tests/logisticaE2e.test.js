/**
 * Internal Logística E2E — no Playwright, no browser.
 * Walks shipped functions: wizard → packing → confirm/join → driver session
 * → GPS ping → Torre live → customer track → QR payloads.
 *
 * Run: node tests/logisticaE2e.test.js
 */
import assert from "node:assert/strict";
import { createTransportistaMemoryPool } from "../server/lib/transportistaMemoryPool.js";
import { ensureTransportistaSchema } from "../server/lib/transportistaSchema.js";
import { joinRepartoToTrip } from "../server/lib/repartoTripBridge.js";
import {
  registerChofer,
  loginChofer,
  assignTripToChofer,
} from "../server/lib/choferRoster.js";
import { resolveDriverAuth, listTripsForDriverAuth } from "../server/lib/driverAuth.js";
import { loadTorreLive } from "../server/lib/torreLive.js";
import { lookupTrackByOrderId } from "../server/lib/orderIdLookup.js";
import { isAllowedDriverEventType } from "../server/lib/transportistaFsm.js";
import {
  WIZARD_STEPS,
  createWizardUi,
  tryCompleteStep,
  firstIncompleteStep,
} from "../src/utils/logistica/wizardState.js";
import { placeCargo, STANDARD_BED_M } from "../src/utils/logistica/cargoPacking.js";
import { canTransition } from "../src/utils/logistica/stopStatusFsm.js";
import { shouldWatchGps } from "../src/utils/logistica/torreLiveView.js";
import { applyTowerAction } from "../src/utils/logistica/torreAgent.js";
import { driverInstallUrl, driverRouteUrl, isDriverRouteUrl } from "../src/utils/logistica/driverQr.js";
import { sanitizeSnapshot } from "../src/utils/logistica/customerTrackView.js";

console.log("logisticaE2e (no Playwright)");

const frontend = "https://calculadora-bmc.vercel.app";
const now = Date.parse("2026-08-28T15:00:00Z");

const stops = [
  {
    cliente: "Silva",
    orderId: "BMC-2026-3102",
    direccion: "Las Piedras",
    pickupPointId: "pickup-kingspan-bromyros",
    paneles: [{ id: "p1", tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 16 }],
  },
];
const info = {
  transportista: "Juan",
  chofer_phone: "099111222",
  basePointId: "base-bmc",
};
const truckL = 13.5;
let wizard = createWizardUi({
  enabled: true,
  singlePickup: true,
  defaultPickupPointId: "pickup-kingspan-bromyros",
  pickupDate: "2026-08-28",
  pickupTime: "09:00",
});
const route = { orderedLegs: [{ label: "Kingspan" }, { label: "Las Piedras" }] };

{
  assert.equal(firstIncompleteStep({ stops, info, truckL, wizard, route: null }), "ruta");
  for (const step of ["pedidos", "flota", "levantes"]) {
    const r = tryCompleteStep(step, wizard, { stops, info, truckL, wizard, route });
    assert.equal(r.ok, true, step);
    wizard = r.wizard;
  }
  wizard = createWizardUi({ ...wizard, routeStale: false });
  const ruta = tryCompleteStep("ruta", wizard, { stops, info, truckL, wizard, route });
  assert.equal(ruta.ok, true);
  wizard = ruta.wizard;
  const carga = tryCompleteStep("carga", wizard, { stops, info, truckL, wizard, route });
  assert.equal(carga.ok, true);
  assert.equal(WIZARD_STEPS.every((s) => carga.wizard.done[s]), true);
  console.log("  ✓ wizard pedidos→flota→levantes→ruta→carga");
}

{
  const pack = placeCargo(stops, STANDARD_BED_M, { maxH: 2.4 });
  assert.ok(pack.placed.length >= 1);
  assert.equal(canTransition("Pendiente", "Lista para carga"), true);
  assert.equal(canTransition("Cargada", "En reparto"), true);
  assert.equal(canTransition("En reparto", "Entregada"), true);
  console.log("  ✓ packing + stop FSM happy path");
}

const pool = createTransportistaMemoryPool();
await ensureTransportistaSchema(pool);

const join = await joinRepartoToTrip({
  pool,
  config: { frontendBaseUrl: frontend },
  reparto: { id: "rep-e2e-1", reparto_no: "ENV-260828-001" },
  payload: { stops, info, truckL },
  notifyDriver: false,
});
assert.equal(join.ok, true, join.error);
assert.ok(join.trip_id);
assert.ok(isDriverRouteUrl(join.driver_url));
assert.ok(join.driver_url.includes("/conductor?t="));
assert.ok(!join.driver_url.includes("run.app"));
assert.equal((join.customer_links || []).length, 1);
assert.ok(String(join.customer_links[0].url).includes("/seguimiento/"));
assert.equal(pool.rows.outbox_notifications.length, 0);
console.log("  ✓ confirm join: trip + driver_url + customer link, no WA outbox");

const token = new URL(join.driver_url).searchParams.get("t");
assert.ok(token && token.length >= 16);

{
  const authz = await resolveDriverAuth(pool, token);
  assert.equal(authz.ok, true);
  assert.equal(authz.kind, "driver_session");
  const listed = await listTripsForDriverAuth(pool, authz);
  assert.equal(listed.ok, true);
  assert.equal(listed.trips[0].trip_id, join.trip_id);
  assert.equal(isAllowedDriverEventType("location_ping"), true);
  assert.equal(isAllowedDriverEventType("factory_arrived"), true);
  console.log("  ✓ driver session lists assigned trip (GET /api/driver/trips path)");
}

{
  const pingAt = new Date(now - 20_000).toISOString();
  await pool.query(
    `insert into trip_events (trip_id, stop_id, event_type, actor_type, actor_id, idempotency_key, geo_lat, geo_lng, at_server, payload)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      join.trip_id,
      null,
      "location_ping",
      "driver",
      null,
      "e2e-ping-1",
      -34.9,
      -56.16,
      pingAt,
      JSON.stringify({ source: "e2e" }),
    ],
  );
  const live = await loadTorreLive(pool, { now });
  assert.equal(live.ok, true);
  assert.equal(live.trips.length, 1);
  assert.equal(live.trips[0].online, true);
  assert.ok(!JSON.stringify(live).includes(token));
  assert.equal(shouldWatchGps(live.trips[0]), true);
  assert.equal(shouldWatchGps({ status: "closed" }), false);
  console.log("  ✓ torre live online after ping; GPS off when closed");
}

{
  const view = await lookupTrackByOrderId(pool, "BMC-2026-3102", { now });
  assert.equal(view.ok, true);
  assert.equal(view.order.ref, "BMC-2026-3102");
  const blob = JSON.stringify(view);
  assert.ok(!blob.includes("099111222"));
  assert.ok(!blob.includes(token));
  const dirty = sanitizeSnapshot({ driver_phone: "+59899111222", other_stop: "secret", quote_ref: "X" });
  assert.equal(dirty.driver_phone, undefined);
  assert.equal(dirty.other_stop, undefined);
  console.log("  ✓ customer Order ID uses sanitizer (no phone, no token)");
}

{
  const install = driverInstallUrl(frontend);
  const routeUrl = driverRouteUrl(frontend, token);
  assert.equal(install, `${frontend}/conductor`);
  assert.equal(routeUrl, join.driver_url);
  assert.equal(isDriverRouteUrl(install), false);
  assert.equal(isDriverRouteUrl(routeUrl), true);
  console.log("  ✓ install QR /conductor; route QR = driver_url");
}

{
  const reg = await registerChofer(pool, {
    name: "Flota",
    email: "flota-e2e@bmc.uy",
    phone: "099888777",
    password: "secreto1",
  });
  assert.equal(reg.ok, true);
  const login = await loginChofer(pool, { email: "flota-e2e@bmc.uy", password: "secreto1" });
  const asg = await assignTripToChofer(pool, {
    tripId: join.trip_id,
    choferId: reg.chofer.chofer_id,
    frontendBaseUrl: frontend,
  });
  assert.ok(isDriverRouteUrl(asg.driver_url));
  const listed = await listTripsForDriverAuth(pool, await resolveDriverAuth(pool, login.token));
  assert.equal(listed.trips[0].trip_id, join.trip_id);
  console.log("  ✓ HITL chofer login lists assigned trip");
}

{
  const wa = applyTowerAction({}, { type: "sendWhatsApp" });
  assert.equal(wa.applied, false);
  assert.equal(wa.whatsapp, false);
  const pack = applyTowerAction({}, { type: "setStopField" });
  assert.equal(pack.ok, false);
  console.log("  ✓ Torre HITL: no auto-WA, packing tools blocked");
}

console.log("logisticaE2e OK");
