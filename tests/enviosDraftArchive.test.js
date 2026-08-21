/**
 * Per-ENV local draft archive — route persistence.
 * Run: node tests/enviosDraftArchive.test.js
 */
import assert from "node:assert/strict";
import {
  ARCHIVE_INDEX_KEY,
  archiveItemKey,
  decideDraftLoad,
  mergeKeepRouteWork,
  writeDraftArchive,
  readDraftArchive,
  listDraftArchive,
  routeLegCount,
} from "../src/utils/logistica/enviosDraftArchive.js";

function memStorage(seed = {}) {
  const m = { ...seed };
  return {
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => {
      m[k] = String(v);
    },
    removeItem: (k) => {
      delete m[k];
    },
    _m: m,
  };
}

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("enviosDraftArchive");

{
  assert.equal(archiveItemKey("ENV-260821-RUTA"), "bmc-logistica-draft-v1:ENV-260821-RUTA");
  ok("archiveItemKey");
}

{
  const worked = {
    info: { numero: "ENV-1" },
    stops: [{ id: "a" }, { id: "b" }],
    route: { orderedLegs: [{ type: "pickup" }, { type: "delivery" }] },
    ui: { wizard: { enabled: true, activeStep: "ruta" } },
  };
  const seed = {
    info: { numero: "ENV-1" },
    stops: [{ id: "a" }],
    route: null,
    ui: { wizard: { enabled: true, activeStep: "pedidos" } },
  };
  assert.equal(decideDraftLoad(worked, seed), "keep");
  assert.equal(mergeKeepRouteWork(worked, seed), worked);
  ok("seed does not wipe worked route");
}

{
  const thin = { info: { numero: "ENV-1" }, stops: [{ id: "a" }], route: null };
  const richerIncoming = {
    info: { numero: "ENV-1" },
    stops: [{ id: "a" }, { id: "b" }, { id: "c" }],
    route: { orderedLegs: [{ type: "base" }, { type: "delivery" }] },
  };
  assert.equal(decideDraftLoad(thin, richerIncoming), "take");
  ok("richer incoming is taken");
}

{
  const current = {
    info: { numero: "ENV-1" },
    stops: [{ id: "a" }],
    route: { orderedLegs: [{ type: "pickup" }, { type: "delivery" }] },
    ui: { wizard: { enabled: true, activeStep: "ruta" } },
  };
  const incoming = {
    info: { numero: "ENV-1" },
    stops: [{ id: "a" }, { id: "b" }],
    route: null,
  };
  assert.equal(decideDraftLoad(current, incoming), "merge");
  const m = mergeKeepRouteWork(current, incoming);
  assert.equal(routeLegCount(m), 2);
  assert.equal(m.stops.length, 2);
  ok("merge keeps legs when incoming has more stops but no route");
}

{
  const st = memStorage();
  const payload = {
    schema: "bmc-envios-draft-v1",
    savedAt: "2026-08-21T00:00:00.000Z",
    info: { numero: "ENV-260821-RUTA" },
    stops: [{ id: "1", cliente: "Alvaro" }],
    route: { orderedLegs: [{ type: "pickup", label: "Kingspan" }] },
  };
  const w = writeDraftArchive(st, payload);
  assert.equal(w.ok, true);
  const read = readDraftArchive(st, "ENV-260821-RUTA");
  assert.equal(read.stops[0].cliente, "Alvaro");
  assert.equal(read.route.orderedLegs[0].label, "Kingspan");
  const list = listDraftArchive(st);
  assert.equal(list[0].id, "ENV-260821-RUTA");
  assert.equal(list[0].legCount, 1);
  assert.ok(st.getItem(ARCHIVE_INDEX_KEY));
  ok("write/read/list round-trip");
}

{
  const st = memStorage();
  writeDraftArchive(st, { info: { numero: "ENV-A" }, stops: [{ id: "1" }], savedAt: "2026-08-21T01:00:00Z" });
  writeDraftArchive(st, { info: { numero: "ENV-B" }, stops: [{ id: "2" }], savedAt: "2026-08-21T02:00:00Z" });
  const list = listDraftArchive(st);
  assert.equal(list[0].id, "ENV-B");
  assert.equal(list[1].id, "ENV-A");
  const a = readDraftArchive(st, "ENV-A");
  assert.equal(a.stops[0].id, "1");
  ok("two ENVs both survive");
}

{
  const st = memStorage();
  writeDraftArchive(st, {
    info: { numero: "ENV-260821-001" },
    stops: [{ id: "1" }, { id: "2" }, { id: "3" }],
  });
  const skip = writeDraftArchive(st, {
    info: { numero: "ENV-260821-001" },
    stops: [],
  });
  assert.equal(skip.skipped, true);
  assert.equal(readDraftArchive(st, "ENV-260821-001").stops.length, 3);
  ok("autosave empty does not clobber richer archive");
}

console.log(`enviosDraftArchive ${passed} ok`);
