import { SCENARIOS_DEF } from "../data/constants.js";

/** BC/Jenerik: capture client + obra before the technical steps. BMC order is unchanged. */
export function withProyectoFirst(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return steps;
  const i = steps.findIndex((s) => s.id === "proyecto");
  if (i <= 0) return steps;
  return [steps[i], ...steps.slice(0, i), ...steps.slice(i + 1)];
}

export function getWizardSteps(scenarioId) {
  return SCENARIOS_DEF.find((s) => s.id === scenarioId)?.wizardSteps ?? [];
}

export function wizardStepIndex(steps, id) {
  return Array.isArray(steps) ? steps.findIndex((s) => s.id === id) : -1;
}
