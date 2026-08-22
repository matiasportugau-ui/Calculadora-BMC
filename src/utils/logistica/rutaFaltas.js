/**
 * Actionable "faltas" queue for the Ruta dispatch desk (pure).
 */
import {
  isIncompleteStreet,
  isOffTruckDelivery,
  isPlantPickupStop,
  isDepotPickupStop,
  isUyPhoneOk,
} from "./uyGazetteer.js";
import { partitionLevantes } from "./wizardState.js";

function tripRegion(stop) {
  const t = String(`${stop?.zona || ""} ${stop?.direccion || ""}`)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/maldonado|punta del este|punta ballena|chacras del pinar/.test(t)) return "east";
  if (/montevideo|paullier/.test(t)) return "west";
  return "";
}

/**
 * @param {{
 *   stops?: object[],
 *   info?: object,
 *   route?: object|null,
 *   wizard?: object,
 * }} ctx
 * @returns {{ id: string, severity: "block"|"warn", label: string, action?: string, stopId?: string, step?: string }[]}
 */
export function buildRutaFaltas(ctx = {}) {
  const stops = Array.isArray(ctx.stops) ? ctx.stops : [];
  const info = ctx.info || {};
  const route = ctx.route || {};
  const wizard = ctx.wizard || {};
  const faltas = [];

  if (!String(info.transportista || "").trim()) {
    faltas.push({
      id: "transportista",
      severity: "warn",
      label: "Falta transportista / patente",
      step: "flota",
      action: "goto_flota",
    });
  }
  if (!String(info.basePointId || "").trim()) {
    faltas.push({
      id: "base",
      severity: "warn",
      label: "Falta base / zona de salida",
      step: "flota",
      action: "goto_flota",
    });
  }

  const { missing } = partitionLevantes(stops, wizard);
  if (missing.length && wizard.unassignedPickupApproved !== true) {
    faltas.push({
      id: "sin-origen",
      severity: "warn",
      label: `${missing.length} carga${missing.length === 1 ? "" : "s"} sin origen`,
      step: "levantes",
      action: "goto_levantes",
    });
  }

  for (const s of stops) {
    const name = String(s.cliente || s.orderId || "Parada").trim();
    if (isPlantPickupStop(s)) {
      if (!isUyPhoneOk(s.telefono)) {
        faltas.push({
          id: `tel-${s.id}`,
          severity: "warn",
          label: `${name}: falta teléfono (retiran en planta)`,
          stopId: s.id,
          action: "ask_phone",
        });
      }
      continue;
    }
    if (!isUyPhoneOk(s.telefono)) {
      faltas.push({
        id: `tel-${s.id}`,
        severity: "block",
        label: `${name}: falta teléfono`,
        stopId: s.id,
        action: "ask_phone",
      });
    }
    if (isDepotPickupStop(s)) continue;
    if (isIncompleteStreet(s.direccion)) {
      faltas.push({
        id: `street-${s.id}`,
        severity: "block",
        label: `${name}: dirección (calle y nro, o 2 calles)`,
        stopId: s.id,
        action: "ask_street",
      });
    }
  }

  const legs = Array.isArray(route.orderedLegs) ? route.orderedLegs : [];
  if (!legs.length) {
    faltas.push({
      id: "no-route",
      severity: "warn",
      label: "Todavía no hay itinerario — se genera al abrir Ruta",
      action: "recalc",
    });
  } else {
    const missingGeo = legs.filter((l) => !l?.geo).length;
    if (missingGeo) {
      faltas.push({
        id: "geo",
        severity: "warn",
        label: `${missingGeo} punto(s) sin pin — se usa gazetteer/Nominatim al recalcular`,
        action: "recalc",
      });
    }
  }

  if (wizard.routeStale) {
    faltas.push({
      id: "stale",
      severity: "warn",
      label: "Ruta desactualizada respecto a pedidos/levantes",
      action: "recalc",
    });
  }

  const live = stops.filter((s) => !isOffTruckDelivery(s));
  const hasEast = live.some((s) => tripRegion(s) === "east");
  const hasWest = live.some((s) => tripRegion(s) === "west");
  if (hasEast && hasWest) {
    faltas.push({
      id: "geo-mix",
      severity: "block",
      label: "Entregas este (Maldonado) y oeste (Montevideo) en el mismo viaje",
      step: "levantes",
      action: "goto_levantes",
    });
  }

  return faltas;
}
