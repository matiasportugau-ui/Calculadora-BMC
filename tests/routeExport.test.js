/**
 * Run: node tests/routeExport.test.js
 */
import assert from "node:assert/strict";
import {
  legsWithGeo,
  googleMapsDirectionsUrl,
  legNavToken,
  isNavigableAddressText,
  routeToShareText,
  routeToGeoJson,
  routeToGpx,
  projectRouteToSvg,
  routeExportBasename,
} from "../src/utils/logistica/routeExport.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("routeExport");

const sampleRoute = {
  suggestionSource: "haversine",
  totalKm: 42.5,
  updatedAt: "2026-08-07T12:00:00.000Z",
  orderedLegs: [
    { type: "base", refId: "b1", label: "Base Cerro", geo: { lat: -34.88, lng: -56.25 } },
    {
      type: "pickup",
      refId: "p1",
      label: "Kingspan",
      geo: { lat: -34.7, lng: -56.2 },
      legKmFromPrev: 20,
    },
    {
      type: "delivery",
      refId: "s1",
      label: "Petinho",
      geo: { lat: -34.9, lng: -56.1 },
      legKmFromPrev: 22.5,
    },
  ],
};

{
  assert.equal(legsWithGeo(sampleRoute.orderedLegs).length, 3);
  assert.equal(legsWithGeo([{ geo: null }, { geo: { lat: 1 } }]).length, 0);
  ok("legsWithGeo");
}

{
  const url = googleMapsDirectionsUrl(sampleRoute.orderedLegs);
  assert.ok(url.includes("google.com/maps/dir"));
  assert.ok(url.includes("origin="));
  assert.ok(url.includes("destination="));
  assert.equal(googleMapsDirectionsUrl([]), "");
  assert.ok(googleMapsDirectionsUrl([sampleRoute.orderedLegs[0]]).includes("maps/search"));
  // Name-only path when no geo (transportista share) — address for delivery, not client name
  const byName = googleMapsDirectionsUrl([
    { type: "base", label: "Maldonado" },
    { type: "pickup", label: "Kingspan", addressText: "Pedro Cosio, Malvín, Montevideo" },
    { type: "delivery", label: "Cliente", addressText: "Av. Italia 1234" },
  ]);
  assert.ok(byName.includes("google.com/maps/dir/"));
  const decoded = decodeURIComponent(byName);
  assert.ok(decoded.includes("Maldonado"));
  assert.ok(decoded.includes("Italia") || decoded.includes("Pedro"));
  assert.ok(!decoded.includes("Cliente"), "must not send client label as Maps place");
  ok("googleMapsDirectionsUrl");
}

{
  // Clean "Falta ubi" / Url; expand Maldo → Maldonado; never bare client name
  const garagorry = {
    type: "delivery",
    label: "Eduardo Garagorry",
    addressText: "4H, Maldo - Falta ubi",
    mapUrl: "",
  };
  const garagorry2 = {
    type: "delivery",
    label: "Eduardo Garagorry",
    addressText: "Garagorry, 4H, Maldo - Falta ubi, Url",
  };
  assert.equal(isNavigableAddressText("Eduardo Garagorry"), false);
  assert.equal(isNavigableAddressText("Chacras del Pinar, Av. Antonio Lussich 5"), true);
  // After clean: usable with locality
  const tok = legNavToken(garagorry);
  assert.ok(tok, "weak address with Maldo still yields a token");
  assert.ok(/Maldonado/i.test(tok), "expands Maldo → Maldonado");
  assert.ok(!/Falta ubi/i.test(tok), "strips Falta ubi");
  assert.ok(!/Eduardo/i.test(tok), "does not use full client first name");

  const tok2 = legNavToken(garagorry2);
  assert.ok(tok2, "Garagorry street + 4H + Maldo still navigable after clean");
  assert.ok(!/Falta ubi/i.test(tok2));
  assert.ok(!/\bUrl\b/i.test(tok2));

  const url = googleMapsDirectionsUrl([
    { type: "base", label: "Maldonado" },
    {
      type: "pickup",
      label: "Kingspan (Bromyros)",
      addressText: "Pedro Cosio, Malvín, Montevideo, Uruguay",
      geo: { lat: -34.8776, lng: -56.1033 },
    },
    {
      type: "delivery",
      label: "Abril Rodriguez",
      addressText: "Chacras del Pinar, Av. Antonio Lussich 5",
    },
    garagorry2,
  ]);
  const d = decodeURIComponent(url);
  assert.ok(!/Falta ubi/i.test(d), "placeholder not in Maps URL");
  assert.ok(/Maldonado|Lussich|34\.8776/i.test(d), "route still has real places");
  // Garagorry as street fragment may appear (from address), but not as sole client-only token
  ok("legNavToken cleans Falta ubi and keeps stop in route");
}

{
  const text = routeToShareText(sampleRoute);
  assert.ok(text.includes("Base Cerro"));
  assert.ok(text.includes("Kingspan"));
  assert.ok(text.includes("Petinho"));
  assert.ok(text.includes("Google Maps") || text.includes("Navegación"));
  assert.ok(text.includes("Total ~43 km") || text.includes("Total ~42 km"));
  ok("routeToShareText");
}

{
  const gj = routeToGeoJson(sampleRoute);
  assert.equal(gj.type, "FeatureCollection");
  assert.ok(gj.features.some((f) => f.geometry.type === "LineString"));
  assert.equal(gj.features.filter((f) => f.geometry.type === "Point").length, 3);
  ok("routeToGeoJson");
}

{
  const gpx = routeToGpx(sampleRoute);
  assert.ok(gpx.includes("<gpx"));
  assert.ok(gpx.includes("<trkpt"));
  assert.ok(gpx.includes("Kingspan"));
  ok("routeToGpx");
}

{
  const proj = projectRouteToSvg(sampleRoute.orderedLegs, { width: 300, height: 180 });
  assert.equal(proj.hasGeo, true);
  assert.equal(proj.points.length, 3);
  assert.ok(proj.pathD.startsWith("M"));
  assert.ok(proj.points.every((p) => p.x >= 0 && p.x <= 300 && p.y >= 0 && p.y <= 180));
  assert.equal(projectRouteToSvg([]).hasGeo, false);
  ok("projectRouteToSvg");
}

{
  assert.equal(routeExportBasename(sampleRoute, "gpx"), "bmc-ruta-20260807.gpx");
  ok("routeExportBasename");
}

console.log(`routeExport: ${passed} passed`);
