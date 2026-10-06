// Operator trip-plan bubble. Offline. No network.
// node tests/tripPlanFormatGates.test.js
import assert from "node:assert/strict";
import { formatTripPlanPreview } from "../src/utils/logistica/tripPlanFormat.js";

const BLOCKED_TAIL = "Decime el dato; no invento calle ni pin.";

function okPlan(overrides = {}) {
  return {
    status: "ok",
    why: "Por la costa",
    strategy: "doorPriority",
    cabe: true,
    roadUnverified: false,
    unloadStopIds: [],
    route: {
      totalKm: 12.4,
      orderedLegs: [
        { type: "pickup", label: "Planta", addressText: "ignored", refId: "p1" },
        { type: "delivery", addressText: "Av. Italia 100", refId: "d1" },
      ],
    },
    ...overrides,
  };
}

{
  assert.equal(
    formatTripPlanPreview(null),
    `No armo ruta todavía.\nFaltan datos de una parada.\n${BLOCKED_TAIL}`,
  );
  assert.equal(formatTripPlanPreview(null).includes("¿Aplico este plan?"), false);
}

{
  const text = formatTripPlanPreview({
    status: "blocked",
    blocks: [{ label: "Primero" }, { label: "Segundo" }],
    why: "no debe salir",
  });
  assert.equal(text, `No armo ruta todavía.\nPrimero.\n${BLOCKED_TAIL}`);
  assert.equal(text.includes("Segundo"), false);
  assert.equal(text.includes("¿Aplico este plan?"), false);
  assert.equal(text.includes("no debe salir"), false);
}

{
  const text = formatTripPlanPreview({ status: "blocked", blocks: [{ label: "Calle." }] });
  assert.equal(text, `No armo ruta todavía.\nCalle..\n${BLOCKED_TAIL}`);
}

{
  const text = formatTripPlanPreview({ status: "blocked", blocks: [{}] });
  assert.match(text, /Faltan datos de una parada\./);
}

{
  const text = formatTripPlanPreview(okPlan());
  assert.equal(
    text,
    [
      "Por la costa",
      "1. Levante: Planta",
      "2. Entrega: Av. Italia 100",
      "Km ~12 km · calles",
      "Carga: Acceso rápido · entra",
      "¿Aplico este plan?",
    ].join("\n"),
  );
}

{
  const text = formatTripPlanPreview(okPlan({
    why: "",
    strategy: "balanced",
    cabe: false,
    roadUnverified: true,
    unloadStopIds: ["s1", "s2"],
    route: {
      totalKm: 0,
      orderedLegs: [
        { type: "depot", refId: "depo-1" },
        { type: "wait", label: "", addressText: "", refId: "" },
      ],
    },
  }));
  assert.equal(
    text,
    [
      "Una propuesta.",
      "1. Depo: depo-1",
      "2. Base: —",
      "Km ~0 km · aire (calles no verificadas)",
      "Carga: Balanceado",
      "Descarga: 2 parada(s) (puerta primero).",
      "¿Aplico este plan?",
    ].join("\n"),
  );
  assert.equal(text.includes("entra"), false);
}

{
  const compact = formatTripPlanPreview(okPlan({
    strategy: "compact",
    cabe: 1,
    route: { totalKm: 1.5, orderedLegs: [] },
  }));
  assert.match(compact, /Km ~2 km · calles/);
  assert.match(compact, /Carga: Compacto · entra/);

  const missingKm = formatTripPlanPreview(okPlan({
    route: { totalKm: null, orderedLegs: [] },
  }));
  assert.match(missingKm, /Km sin km · calles/);
  assert.equal(missingKm.includes("~"), false);

  const nanKm = formatTripPlanPreview(okPlan({
    route: { totalKm: "abc", orderedLegs: [] },
  }));
  assert.match(nanKm, /Km ~NaN km · calles/);

  const numericString = formatTripPlanPreview(okPlan({
    route: { totalKm: "10", orderedLegs: [] },
  }));
  assert.match(numericString, /Km ~10 km · calles/);
}

{
  const custom = formatTripPlanPreview(okPlan({ strategy: "custom", cabe: false, why: 0 }));
  assert.match(custom, /^Una propuesta\./);
  assert.match(custom, /Carga: custom$/m);
  assert.equal(custom.includes("entra"), false);
}

{
  const almost = formatTripPlanPreview({ status: "Blocked", blocks: [{ label: "Falta la calle" }] });
  assert.equal(almost.includes("¿Aplico este plan?"), true);
  assert.equal(almost.includes("No armo ruta todavía."), false);
}

console.log("tripPlanFormatGates tests OK");
