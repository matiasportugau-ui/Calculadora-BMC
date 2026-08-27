import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyTruckerAction,
  buildLogisticaSnapshot,
  buildTruckerGreeting,
  matchStop,
  stopGaps,
} from "../src/utils/logistica/truckerAgent.js";
import { buildSystemPrompt } from "../server/lib/chatPrompts.js";
import {
  applyPersonaAction,
  emptyPersona,
  loadTruckerPersona,
  saveTruckerPersona,
} from "../src/utils/logistica/truckerPersona.js";

const stops = [
  {
    id: "s1",
    orden: 1,
    cliente: "Kingspan / METALOG SAS retiro",
    direccion: "Camino San Juan S/N",
    telefono: "091958537",
    orderId: "1345381",
  },
  {
    id: "s2",
    orden: 2,
    cliente: "Alvaro Gonzalez",
    direccion: "Ciudad de Maldonado",
    telefono: "094650240",
    orderId: "1345381",
  },
];

describe("logistica trucker agent", () => {
  it("flags vague Maldonado as missing street", () => {
    assert.ok(stopGaps(stops[1]).includes("direccion"));
    assert.equal(stopGaps(stops[0]).includes("direccion"), false);
  });

  it("matches stop by name fragment", () => {
    const hit = matchStop(stops, { cliente: "álvaro" });
    assert.equal(hit?.id, "s2");
  });

  it("applies street to Álvaro without mutating input", () => {
    const state = {
      info: { numero: "ENV-260821-RUTA", fecha: "2026-08-21", transportista: "" },
      stops: stops.map((s) => ({ ...s })),
      truckL: 11,
    };
    const out = applyTruckerAction(state, {
      type: "setStopField",
      payload: { cliente: "Alvaro", field: "direccion", value: "18 de Julio 1234" },
    });
    assert.equal(out.ok, true);
    assert.equal(state.stops[1].direccion, "Ciudad de Maldonado");
    assert.equal(out.state.stops[1].direccion, "18 de Julio 1234");
  });

  it("rejects unknown action types and WA-like fields", () => {
    const state = { info: {}, stops, truckL: 11 };
    assert.equal(applyTruckerAction(state, { type: "sendWhatsApp", payload: {} }).ok, false);
    assert.equal(
      applyTruckerAction(state, { type: "setStopField", payload: { cliente: "Alvaro", field: "waSend", value: "x" } }).ok,
      false,
    );
  });

  it("snapshot marks logistica and greeting names the gap", () => {
    const snap = buildLogisticaSnapshot({
      info: { numero: "ENV-260821-RUTA", fecha: "2026-08-21" },
      stops,
      truckL: 11,
    });
    assert.equal(snap.logistica, true);
    assert.equal(snap.stops.length, 2);
    const g = buildTruckerGreeting(snap);
    assert.match(g, /Transportador/);
    assert.match(g, /calle/i);
  });

  it("system prompt switches to trucker logistics when calcState.logistica", () => {
    const prompt = buildSystemPrompt({
      logistica: true,
      envNo: "ENV-260821-RUTA",
      stops: [{ orden: 2, cliente: "Alvaro Gonzalez", gaps: ["direccion"] }],
    });
    assert.match(prompt, /Transportador/);
    assert.match(prompt, /proposeTripPlan/);
    assert.match(prompt, /setStopField/);
    assert.match(prompt, /NUNCA envíes WhatsApp/);
    assert.doesNotMatch(prompt, /setTechoZonas/);
  });

  it("calculator prompt is unchanged without logistica flag", () => {
    const prompt = buildSystemPrompt({ scenario: "solo_techo" });
    assert.match(prompt, /asistente experto de ventas/);
    assert.doesNotMatch(prompt, /setStopField/);
  });

  it("persists operator corrections and look in a storage mock", () => {
    const mem = { store: {} };
    const storage = {
      getItem: (k) => mem.store[k] ?? null,
      setItem: (k, v) => { mem.store[k] = v; },
    };
    const seeded = saveTruckerPersona(emptyPersona(), storage);
    assert.ok(seeded.corrections.some((c) => /logística/i.test(c)));
    const added = applyPersonaAction(seeded, {
      type: "addTruckerCorrection",
      payload: "Esto es logística mía, la conversación.",
    });
    assert.equal(added.ok, true);
    const looked = applyPersonaAction(added.persona, {
      type: "setTruckerLook",
      payload: "Camisa a cuadros negra y roja, más ancha.",
    });
    const saved = saveTruckerPersona(looked.persona, storage);
    const reloaded = loadTruckerPersona(storage);
    assert.equal(reloaded.look, "Camisa a cuadros negra y roja, más ancha.");
    assert.ok(reloaded.corrections.includes("Esto es logística mía, la conversación."));
    assert.equal(saved.look, reloaded.look);
  });

  it("injects persisted corrections into logistics system prompt", () => {
    const prompt = buildSystemPrompt({
      logistica: true,
      envNo: "ENV-260821-RUTA",
      persona: {
        look: "gorra gastada",
        corrections: ["Esto es logística mía, la conversación."],
      },
    });
    assert.match(prompt, /Esto es logística mía/);
    assert.match(prompt, /gorra gastada/);
  });
});
