/**
 * When to close a trip/reparto after driver delivery_completed events.
 * Pickups/levantes are never required — only delivery stops (matches joinRepartoToTrip.deliveryStops).
 */
import { isPickupStop } from "./driverId.js";

/**
 * @param {{ stops?: object[] } | null | undefined} planSnapshot
 * @returns {string[]}
 */
export function deliveryStopIdsForClose(planSnapshot) {
  const stops = planSnapshot?.stops;
  if (!Array.isArray(stops)) return [];
  return stops
    .filter((s) => s && s.id && !isPickupStop(s))
    .map((s) => String(s.id));
}

/**
 * @param {string[]} neededIds
 * @param {Array<string|null|undefined>} completedStopIds
 */
export function allDeliveryStopsCompleted(neededIds, completedStopIds) {
  const needed = Array.isArray(neededIds) ? neededIds : [];
  const got = new Set((completedStopIds || []).map((id) => String(id ?? "")));
  return needed.length > 0 && needed.every((id) => got.has(id));
}
