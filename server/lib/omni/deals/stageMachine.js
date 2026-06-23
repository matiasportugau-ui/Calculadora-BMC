/** Deal pipeline stage transitions (ADR-006). */

export const DEAL_STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
];

const TERMINAL = new Set(["closed_won", "closed_lost"]);

const TRANSITIONS = {
  lead: new Set(["qualified", "closed_lost"]),
  qualified: new Set(["proposal", "closed_lost"]),
  proposal: new Set(["negotiation", "closed_lost"]),
  negotiation: new Set(["closed_won", "closed_lost"]),
  closed_won: new Set(),
  closed_lost: new Set(),
};

export function normalizeStage(stage) {
  const s = String(stage || "lead").toLowerCase().trim();
  return DEAL_STAGES.includes(s) ? s : null;
}

export function canTransition(fromStage, toStage) {
  const from = normalizeStage(fromStage);
  const to = normalizeStage(toStage);
  if (!from || !to) return false;
  if (from === to) return true;
  return TRANSITIONS[from]?.has(to) ?? false;
}

export function isTerminalStage(stage) {
  return TERMINAL.has(normalizeStage(stage));
}

/** Map omni stage → CRM_Operativo Estado label (approximate). */
export function stageToCrmEstado(stage) {
  const map = {
    lead: "Nuevo",
    qualified: "Calificado",
    proposal: "Propuesta enviada",
    negotiation: "Negociación",
    closed_won: "Cerrado ganado",
    closed_lost: "Cerrado perdido",
  };
  return map[normalizeStage(stage)] || "Nuevo";
}
