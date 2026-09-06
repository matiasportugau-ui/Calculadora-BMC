/** Factory carga sequence — 1:1 with driver FSM events. Pure; UI only displays this. */

export const FACTORY_STEPS = Object.freeze([
  { n: 1, type: "factory_arrived", label: "Llegué a fábrica" },
  { n: 2, type: "load_started", label: "Inicié carga" },
  { n: 3, type: "load_completed", label: "Carga lista" },
  { n: 4, type: "factory_departed", label: "Salí de fábrica" },
]);

export function eventTypes(timeline) {
  return new Set((timeline || []).map((e) => e.event_type));
}

/** Count of completed factory steps: 0..4. */
export function factoryPhase(timeline) {
  const t = eventTypes(timeline);
  if (t.has("factory_departed")) return 4;
  if (t.has("load_completed")) return 3;
  if (t.has("load_started")) return 2;
  if (t.has("factory_arrived")) return 1;
  return 0;
}

/**
 * @param {Array<{event_type?: string}>} [timeline]
 */
export function cargaFactoryView(timeline) {
  const phase = factoryPhase(timeline);
  const complete = phase >= 4;
  const current = complete ? FACTORY_STEPS[3] : FACTORY_STEPS[phase];
  const steps = FACTORY_STEPS.map((st) => {
    const done = phase >= st.n;
    const currentStep = !complete && phase + 1 === st.n;
    return {
      ...st,
      done,
      current: currentStep,
      status: done ? "Completado" : currentStep ? "En progreso" : "Pendiente",
    };
  });
  return {
    phase,
    complete,
    currentIndex: complete ? 4 : current.n,
    counter: `${complete ? 4 : current.n} de 4`,
    cta: complete ? null : current.label,
    eventType: complete ? null : current.type,
    steps,
  };
}
