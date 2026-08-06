/**
 * Envíos P2 — geocode pure helpers
 * Run: node tests/geocode.test.js
 */
import assert from "node:assert/strict";
import {
  mapsSearchUrl,
  mapsCoordsUrl,
  parseLatLng,
  isValidLatLng,
  buildGeocodeQuery,
  haversineKm,
  tripLegDistances,
  toStopGeo,
  applyGeocodeToStop,
  GEOCODE_COUNTRY_BIAS,
} from "../src/utils/logistica/geocode.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("geocode");

{
  assert.ok(mapsSearchUrl("Maldonado").includes("Maldonado"));
  assert.equal(mapsSearchUrl(""), "");
  assert.ok(mapsCoordsUrl(-34.9, -56.1).includes("-34.9"));
  ok("maps urls");
}

{
  assert.deepEqual(parseLatLng("-34.9011, -56.1645"), { lat: -34.9011, lng: -56.1645 });
  assert.ok(parseLatLng("https://www.google.com/maps/@-34.9,-56.1,15z"));
  assert.equal(parseLatLng("https://www.google.com/maps/@-34.9,-56.1,15z").lat, -34.9);
  assert.ok(parseLatLng("https://maps.google.com/?q=-34.9,-56.2"));
  assert.equal(parseLatLng("not a coord"), null);
  assert.equal(isValidLatLng(91, 0), false);
  ok("parseLatLng");
}

{
  assert.ok(buildGeocodeQuery("Punta del Este").includes(GEOCODE_COUNTRY_BIAS));
  assert.equal(buildGeocodeQuery("Montevideo, Uruguay").includes("Uruguay, Uruguay"), false);
  assert.equal(buildGeocodeQuery(""), "");
  ok("buildGeocodeQuery bias");
}

{
  const km = haversineKm(-34.9011, -56.1645, -34.8833, -56.1667);
  assert.ok(km != null && km > 0 && km < 5);
  // MVD → Punta approx 100–140 km air
  const mvdPe = haversineKm(-34.9, -56.16, -34.96, -54.95);
  assert.ok(mvdPe > 80 && mvdPe < 160);
  ok("haversine");
}

{
  const legs = tripLegDistances([
    { id: "a", cliente: "A", geo: { lat: -34.9, lng: -56.16 } },
    { id: "b", cliente: "B", geo: { lat: -34.91, lng: -56.15 } },
    { id: "c", cliente: "C" },
  ]);
  assert.equal(legs.geocodedCount, 2);
  assert.equal(legs.legs.length, 1);
  assert.ok(legs.totalKm > 0);
  ok("tripLegDistances skips ungeocoded");
}

{
  const geo = toStopGeo({ lat: -34.9, lng: -56.1, label: "X", source: "nominatim" });
  assert.equal(geo.lat, -34.9);
  assert.equal(geo.source, "nominatim");
  const stop = applyGeocodeToStop(
    { direccion: "Calle 1", checks: { datosOk: true } },
    { lat: -34.9, lng: -56.1, label: "Calle 1" },
  );
  assert.equal(stop.checks.mapaOk, true);
  assert.ok(stop.mapLink.includes("maps"));
  assert.equal(stop.geo.lat, -34.9);
  ok("toStopGeo + applyGeocodeToStop");
}

console.log(`geocode: ${passed} passed`);
