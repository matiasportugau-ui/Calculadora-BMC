/**
 * Torre (airport-control) HITL identity. Not El Transportador packing tools.
 * Propose only. Never send WhatsApp. Never setTecho.
 */

export const LOGISTICA_TOWER_VOICE = "rex";

export const LOGISTICA_TOWER_FUNCTION_TOOLS = Object.freeze([
  {
    type: "function",
    name: "listLiveTrips",
    description: "List in-progress trips for the operator. Read-only.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "getTripEta",
    description: "Estimate ETA for one live trip. Proposal only.",
    parameters: {
      type: "object",
      properties: { trip_id: { type: "string" } },
      required: ["trip_id"],
    },
  },
  {
    type: "function",
    name: "simulateRoute",
    description: "What-if route. Does not mutate executed stops.",
    parameters: {
      type: "object",
      properties: { trip_id: { type: "string" } },
      required: ["trip_id"],
    },
  },
  {
    type: "function",
    name: "draftDriverDirective",
    description: "Draft a message for the operator to send. Never auto-send WhatsApp.",
    parameters: {
      type: "object",
      properties: { trip_id: { type: "string" }, text: { type: "string" } },
      required: ["trip_id", "text"],
    },
  },
  {
    type: "function",
    name: "flagException",
    description: "Flag an ops exception for HITL. No side effects.",
    parameters: {
      type: "object",
      properties: { trip_id: { type: "string" }, note: { type: "string" } },
      required: ["trip_id"],
    },
  },
]);

export const LOGISTICA_TOWER_INSTRUCTIONS = `You are Torre, BMC Uruguay live-ops assistant.
You propose. A human applies. Never send WhatsApp. Never use packing tools (setStopField, setTecho, applyTripPlan).
Spanish (UY). GPS only while a trip is open.`;
