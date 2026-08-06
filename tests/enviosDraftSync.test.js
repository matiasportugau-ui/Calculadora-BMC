/**
 * Envíos P5b — draft sync pure helpers
 * Run: node tests/enviosDraftSync.test.js
 */
import assert from "node:assert/strict";
import {
  fingerprintDraft,
  fingerprintSavedPayload,
  isDraftDirtyVersusPush,
  shouldAutosave,
  resolveConflict,
  parsePutDraftResponse,
  AUTOSAVE_MIN_INTERVAL_MS,
} from "../src/utils/logistica/enviosDraftSync.js";
import { buildEnviosDraft } from "../src/utils/logistica/enviosDraft.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("enviosDraftSync");

{
  const a = fingerprintDraft({
    info: { numero: "ENV-1", fecha: "2026-08-06" },
    stops: [{ id: "s1", cliente: "A", paneles: [] }],
    cargoLayoutMode: "auto",
  });
  const b = fingerprintDraft({
    info: { numero: "ENV-1", fecha: "2026-08-06" },
    stops: [{ id: "s1", cliente: "A", paneles: [] }],
    cargoLayoutMode: "auto",
  });
  const c = fingerprintDraft({
    info: { numero: "ENV-1", fecha: "2026-08-06" },
    stops: [{ id: "s1", cliente: "B", paneles: [] }],
    cargoLayoutMode: "auto",
  });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.ok(a.length > 10);
  ok("fingerprint stable + sensitive to content");
}

{
  assert.equal(shouldAutosave({ hydrated: false, envNo: "ENV-1", hasToken: true, dirty: true, autosaveEnabled: true }).ok, false);
  assert.equal(shouldAutosave({ hydrated: true, envNo: "", hasToken: true, dirty: true, autosaveEnabled: true }).reason, "missing_env_no");
  assert.equal(shouldAutosave({ hydrated: true, envNo: "ENV-1", hasToken: false, dirty: true, autosaveEnabled: true }).reason, "no_token");
  assert.equal(shouldAutosave({ hydrated: true, envNo: "ENV-1", hasToken: true, dirty: false, autosaveEnabled: true }).reason, "clean");
  const throttle = shouldAutosave({
    hydrated: true,
    envNo: "ENV-1",
    hasToken: true,
    dirty: true,
    autosaveEnabled: true,
    lastPushAt: Date.now(),
    now: Date.now() + 100,
    minIntervalMs: AUTOSAVE_MIN_INTERVAL_MS,
  });
  assert.equal(throttle.ok, false);
  assert.equal(throttle.reason, "throttle");
  const go = shouldAutosave({
    hydrated: true,
    envNo: "ENV-1",
    hasToken: true,
    dirty: true,
    autosaveEnabled: true,
    lastPushAt: 0,
    now: Date.now(),
  });
  assert.equal(go.ok, true);
  assert.equal(go.id, "ENV-1");
  ok("shouldAutosave gates");
}

{
  assert.equal(resolveConflict({ localRevision: 1, remoteRevision: 1, dirty: false }).action, "noop");
  assert.equal(resolveConflict({ localRevision: 1, remoteRevision: 1, dirty: true }).action, "push");
  assert.equal(resolveConflict({ localRevision: 1, remoteRevision: 3, dirty: false }).action, "pull");
  assert.equal(resolveConflict({ localRevision: 1, remoteRevision: 3, dirty: true }).action, "ask");
  assert.equal(resolveConflict({ localRevision: null, remoteRevision: 2, dirty: false }).action, "pull");
  ok("resolveConflict");
}

{
  const c = parsePutDraftResponse(409, { error: "revision_conflict", draft: { revision: 5 } });
  assert.equal(c.conflict, true);
  assert.equal(c.draft.revision, 5);
  const okRes = parsePutDraftResponse(200, { ok: true, draft: { revision: 2 } });
  assert.equal(okRes.ok, true);
  assert.equal(okRes.draft.revision, 2);
  ok("parsePutDraftResponse");
}

{
  // Regression: edits during an in-flight PUT must stay dirty after success.
  const baseState = {
    info: { numero: "ENV-RACE", fecha: "2026-08-06" },
    stops: [{ id: "s1", cliente: "A", paneles: [] }],
    cargoLayoutMode: "auto",
  };
  const built = buildEnviosDraft(baseState, { now: () => "t0" });
  assert.equal(built.ok, true);
  const savedFp = fingerprintSavedPayload(built.payload);
  const editedDuringFlight = {
    ...baseState,
    stops: [
      { id: "s1", cliente: "A", paneles: [] },
      { id: "s2", cliente: "B", paneles: [] },
    ],
  };
  assert.equal(isDraftDirtyVersusPush(editedDuringFlight, savedFp), true);
  // Anti-pattern from #886: fingerprinting live UI after PUT marks edits clean.
  const buggyFp = fingerprintDraft(editedDuringFlight);
  assert.equal(isDraftDirtyVersusPush(editedDuringFlight, buggyFp), false);
  assert.notEqual(savedFp, buggyFp);
  ok("in-flight edit stays dirty vs saved payload fingerprint");
}

console.log(`enviosDraftSync: ${passed} passed`);
