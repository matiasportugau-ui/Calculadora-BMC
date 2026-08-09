/**
 * Envíos P5 — draft payload pure helpers
 * Run: node tests/enviosDraft.test.js
 */
import assert from "node:assert/strict";
import {
  DRAFT_SCHEMA,
  DRAFT_SCHEMA_VERSION,
  draftIdFromEnvNo,
  buildEnviosDraft,
  parseEnviosDraftPayload,
  preferDraftSource,
} from "../src/utils/logistica/enviosDraft.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("enviosDraft");

{
  assert.equal(draftIdFromEnvNo("ENV-260805-001"), "ENV-260805-001");
  assert.equal(draftIdFromEnvNo("  env/260805 001  "), "ENV-260805-001");
  assert.equal(draftIdFromEnvNo(""), "");
  ok("draftIdFromEnvNo");
}

{
  const built = buildEnviosDraft(
    {
      info: { numero: "ENV-260805-001", fecha: "2026-08-05" },
      stops: [{ id: "s1", cliente: "A" }],
      truckL: 12,
      ui: { collapsedStopIds: ["s1"] },
    },
    { now: () => "2026-08-05T12:00:00.000Z" },
  );
  assert.equal(built.ok, true);
  assert.equal(built.id, "ENV-260805-001");
  assert.equal(built.payload.schema, DRAFT_SCHEMA);
  assert.equal(built.payload.schemaVersion, DRAFT_SCHEMA_VERSION);
  assert.equal(built.payload.stops.length, 1);
  assert.equal(built.payload.savedAt, "2026-08-05T12:00:00.000Z");
  ok("buildEnviosDraft");
}

{
  const missing = buildEnviosDraft({ info: {}, stops: [] });
  assert.equal(missing.ok, false);
  assert.equal(missing.error, "missing_env_no");
  ok("buildEnviosDraft requires numero");
}

{
  const built = buildEnviosDraft({
    info: { numero: "ENV-1" },
    stops: [{ id: "x" }],
    cargoLayoutMode: "manual",
    rowOverrides: { k: 1 },
  });
  const parsed = parseEnviosDraftPayload(built.payload);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.payload.cargoLayoutMode, "manual");
  assert.equal(parsed.payload.rowOverrides.k, 1);
  ok("parseEnviosDraftPayload round-trip");
}

{
  // legacy localStorage blob without schema
  const legacy = parseEnviosDraftPayload({
    info: { numero: "ENV-2" },
    stops: [],
  });
  assert.equal(legacy.ok, true);
  ok("legacy blob accepted");
}

{
  assert.equal(preferDraftSource("2026-08-05T10:00:00Z", "2026-08-05T11:00:00Z"), "cloud");
  assert.equal(preferDraftSource("2026-08-05T12:00:00Z", "2026-08-05T11:00:00Z"), "local");
  assert.equal(preferDraftSource(null, "2026-08-05T11:00:00Z"), "cloud");
  assert.equal(preferDraftSource("2026-08-05T11:00:00Z", "2026-08-05T11:00:00Z"), "equal");
  ok("preferDraftSource LWW");
}

{
  const built = buildEnviosDraft({
    info: { numero: "ENV-WIZ" },
    stops: [{ id: "s1" }],
    route: { orderedLegs: [{ type: "base", label: "Base" }], totalKm: 10 },
    ui: {
      collapsedStopIds: [],
      wizard: { enabled: true, activeStep: "ruta", done: { pedidos: true }, defaultPickupPointId: "p1" },
    },
  });
  assert.equal(built.ok, true);
  assert.equal(built.payload.route?.orderedLegs?.length, 1);
  assert.equal(built.payload.ui?.wizard?.activeStep, "ruta");
  const parsed = parseEnviosDraftPayload(built.payload);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.payload.route?.totalKm, 10);
  assert.equal(parsed.payload.ui?.wizard?.defaultPickupPointId, "p1");
  ok("build/parse keeps route + ui.wizard");
}

console.log(`enviosDraft: ${passed} passed`);
