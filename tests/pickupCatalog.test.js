/**
 * Run: node tests/pickupCatalog.test.js
 */
import assert from "node:assert/strict";
import {
  buildSeedPlaces,
  mergeCatalogPlaces,
  addUserPlace,
  parseCatalog,
  serializeCatalog,
  getPlaceById,
  SEED_PICKUPS,
} from "../src/utils/logistica/pickupCatalog.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("pickupCatalog");

{
  const seeds = buildSeedPlaces();
  assert.equal(seeds.length, 4);
  assert.ok(seeds.every((p) => p.source === "seed"));
  assert.ok(seeds.find((p) => p.id === "pickup-kingspan-bromyros" && p.kind === "pickup"));
  assert.ok(seeds.find((p) => p.id === "base-deposito-bmc" && p.kind === "base" && p.label === "BMC URUGUAY"));
  assert.ok(seeds.find((p) => p.mapUrl.includes("share.google")));
  ok("seed 3 pickups + BMC URUGUAY base");
}

{
  const custom = {
    id: "pickup-user-x",
    kind: "pickup",
    label: "Depósito X",
    mapUrl: "https://maps.google.com/?q=test",
    source: "user",
    active: true,
  };
  const merged = mergeCatalogPlaces([custom]);
  assert.equal(merged.length, 5);
  assert.ok(getPlaceById(merged, "pickup-user-x"));
  assert.ok(getPlaceById(merged, "pickup-montfrio"));
  ok("merge seed + user custom");
}

{
  const seeds = buildSeedPlaces();
  const merged = mergeCatalogPlaces([
    { ...seeds[0], label: "Kingspan HQ", source: "user" },
  ]);
  const k = getPlaceById(merged, "pickup-kingspan-bromyros");
  assert.equal(k.label, "Kingspan HQ");
  assert.equal(k.source, "user");
  ok("user override of seed id keeps id");
}

{
  let places = mergeCatalogPlaces([]);
  const r = addUserPlace(places, { label: "Nuevo levante", mapUrl: "https://example.com" });
  assert.equal(r.ok, true);
  assert.equal(r.place.source, "user");
  places = r.places;
  const blob = serializeCatalog(places);
  const again = parseCatalog(blob);
  assert.ok(again.length >= 4);
  assert.ok(again.some((p) => p.label === "Nuevo levante"));
  ok("serialize/parse round-trip keeps custom");
}

{
  assert.equal(SEED_PICKUPS.length, 4);
  assert.ok(SEED_PICKUPS.some((p) => p.id === "base-deposito-bmc" && p.label === "BMC URUGUAY"));
  ok("SEED_PICKUPS constant");
}

{
  const r = addUserPlace(mergeCatalogPlaces([]), {
    label: "Evil",
    mapUrl: "javascript:alert(1)",
  });
  assert.equal(r.ok, true);
  assert.equal(r.place.mapUrl, "");
  const poisoned = mergeCatalogPlaces([
    {
      id: "pickup-evil",
      kind: "pickup",
      label: "Evil",
      mapUrl: "javascript:alert(document.domain)",
      source: "user",
      active: true,
    },
  ]);
  assert.equal(getPlaceById(poisoned, "pickup-evil")?.mapUrl, "");
  ok("normalizePlace strips javascript: mapUrl");
}

console.log(`pickupCatalog: ${passed} passed`);
