/**
 * Envíos G-U3 — STOP_STATUS FSM map + transition guards (SDD §7.4).
 * Pure module; no React / storage.
 */

/** Ops UI enum (order = forward lifecycle for non-side states). */
export const STOP_STATUS = Object.freeze([
  "Pendiente",
  "Lista para carga",
  "Cargada",
  "En reparto",
  "Entregada",
  "Observada",
]);

/** Formal FSM labels (documentation / telemetry). */
export const FSM_STATES = Object.freeze([
  "Draft",
  "Scheduled",
  "Dispatched",
  "InTransit",
  "Delivered",
  "Observada",
  "Cancelled",
]);

/**
 * Map ops status → formal FSM.
 * @param {string} status
 * @returns {string}
 */
export function toFsmState(status) {
  const s = String(status || "").trim();
  switch (s) {
    case "Pendiente":
    case "Lista para carga":
      return "Scheduled";
    case "Cargada":
      return "Dispatched";
    case "En reparto":
      return "InTransit";
    case "Entregada":
      return "Delivered";
    case "Observada":
      return "Observada";
    case "Cancelada":
    case "Cancelled":
      return "Cancelled";
    default:
      return "Scheduled";
  }
}

/** Forward pipeline (excludes Observada side-state). */
const FORWARD = Object.freeze([
  "Pendiente",
  "Lista para carga",
  "Cargada",
  "En reparto",
  "Entregada",
]);

/**
 * @param {string} status
 * @returns {number} index in FORWARD, or -1 if Observada/unknown
 */
export function forwardIndex(status) {
  return FORWARD.indexOf(String(status || "").trim());
}

/**
 * Context for guards (optional).
 * @typedef {{
 *   formValid?: boolean,
 *   quoteOk?: boolean,
 *   manualFlete?: number,
 *   retiro?: boolean,
 *   listaParaCarga?: boolean,
 *   adminOverride?: boolean,
 * }} TransitionCtx
 */

/**
 * Whether transition from → to is allowed.
 * Default: forward-only along FORWARD; Observada is a side pocket.
 *
 * @param {string} from
 * @param {string} to
 * @param {TransitionCtx} [ctx]
 * @returns {boolean}
 */
export function canTransition(from, to, ctx = {}) {
  const a = String(from || "Pendiente").trim() || "Pendiente";
  const b = String(to || "").trim();
  if (!b || !STOP_STATUS.includes(b)) return false;
  if (a === b) return true;

  // Terminal: Entregada only leaves with admin override
  if (a === "Entregada") {
    return Boolean(ctx.adminOverride);
  }

  // Into Observada from any non-terminal ops state (or from En reparto/Cargada)
  if (b === "Observada") {
    return a !== "Entregada" || Boolean(ctx.adminOverride);
  }

  // Out of Observada: only back to En reparto (or Cargada if never departed)
  if (a === "Observada") {
    return b === "En reparto" || b === "Cargada" || b === "Lista para carga";
  }

  const ia = forwardIndex(a);
  const ib = forwardIndex(b);
  if (ia < 0 || ib < 0) return false;

  // Forward one or more steps allowed (ops often skip "Lista para carga")
  if (ib > ia) {
    // Scheduled → Dispatched soft guard: prefer lista/checks when provided
    if (a === "Pendiente" && b === "Cargada" && ctx.listaParaCarga === false) {
      return false;
    }
    // Draft-ish → Scheduled soft: if formValid explicitly false, block leaving Pendiente
    if (a === "Pendiente" && ib > ia && ctx.formValid === false) {
      return false;
    }
    return true;
  }

  // Backward: only one step, and not from Entregada (handled above)
  if (ib < ia) {
    // Allow single-step back for corrections (Lista→Pendiente, Cargada→Lista, En reparto→Cargada)
    return ia - ib === 1;
  }

  return false;
}

/**
 * @param {string} from
 * @param {string} to
 * @param {TransitionCtx} [ctx]
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function assertTransition(from, to, ctx = {}) {
  if (canTransition(from, to, ctx)) return { ok: true };
  return {
    ok: false,
    error: `transicion_invalida:${String(from || "")}→${String(to || "")}`,
  };
}

/**
 * Options for a <select>: each status with disabled flag.
 * @param {string} current
 * @param {TransitionCtx} [ctx]
 * @returns {Array<{ value: string, disabled: boolean }>}
 */
export function statusSelectOptions(current, ctx = {}) {
  const cur = String(current || "Pendiente").trim() || "Pendiente";
  return STOP_STATUS.map((value) => ({
    value,
    disabled: !canTransition(cur, value, ctx),
  }));
}

/**
 * Apply transition or keep previous.
 * @param {string} from
 * @param {string} to
 * @param {TransitionCtx} [ctx]
 * @returns {{ status: string, changed: boolean, error?: string }}
 */
export function applyStatusTransition(from, to, ctx = {}) {
  const cur = String(from || "Pendiente").trim() || "Pendiente";
  const next = String(to || "").trim();
  if (cur === next) return { status: cur, changed: false };
  const check = assertTransition(cur, next, ctx);
  if (!check.ok) return { status: cur, changed: false, error: check.error };
  return { status: next, changed: true };
}
