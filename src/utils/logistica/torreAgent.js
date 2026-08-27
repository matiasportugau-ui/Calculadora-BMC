/**
 * Torre live-ops HITL agent. Distinct from El Transportador packing tools.
 * Propose only — never send WhatsApp.
 */
import { TRUCKER_ACTION_TYPES } from "./truckerAgent.js";

export const TOWER_NAME = "Torre";

export const TOWER_ACTION_TYPES = Object.freeze([
  "listLiveTrips",
  "getTripEta",
  "simulateRoute",
  "draftDriverDirective",
  "flagException",
]);

const TOWER_SET = new Set(TOWER_ACTION_TYPES);

export function isTowerAction(type) {
  return TOWER_SET.has(String(type || ""));
}

export function towerVsTruckerOverlap() {
  return TOWER_ACTION_TYPES.filter((t) => TRUCKER_ACTION_TYPES.includes(t));
}

/**
 * @returns {{ ok: boolean, applied: boolean, whatsapp: false, proposal?: object, error?: string }}
 */
export function applyTowerAction(_ctx, action = {}) {
  const type = String(action?.type || "");
  if (type === "sendWhatsApp" || type === "notify_driver" || type === "insertOutbox") {
    return { ok: false, error: "hitl_required", applied: false, whatsapp: false };
  }
  if (TRUCKER_ACTION_TYPES.includes(type) && !isTowerAction(type)) {
    return { ok: false, error: "trucker_tool_not_allowed_on_tower", applied: false, whatsapp: false };
  }
  if (!isTowerAction(type)) {
    return { ok: false, error: "unknown_action", applied: false, whatsapp: false };
  }
  return {
    ok: true,
    applied: false,
    whatsapp: false,
    proposal: {
      type,
      payload: action.payload && typeof action.payload === "object" ? action.payload : {},
      needs_human_apply: true,
    },
  };
}
