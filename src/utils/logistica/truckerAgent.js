/**
 * On-site Panelin (American trucker skin) for /logistica.
 * Pure helpers: snapshot, greeting, ACTION_JSON apply. No WA send.
 */

import {
  WIZARD_STEPS,
  createWizardUi,
  tryCompleteStep,
  firstIncompleteStep,
} from "./wizardState.js";

export const TRUCKER_ART_SRC = "/images/panelin-trucker.jpg";
export const TRUCKER_NAME = "Panelin";

export const TRUCKER_ACTION_TYPES = Object.freeze([
  "setStopField",
  "setEnviosInfo",
  "setEnviosTruck",
  "setLogisticaWizard",
  "advanceLogisticaWizard",
]);

export const STOP_FIELDS = Object.freeze([
  "direccion",
  "telefono",
  "zona",
  "horarioEntrega",
  "fechaEntrega",
  "pickupId",
  "cliente",
  "observacionesLogistica",
  "contactoRecepcion",
  "mapLink",
]);

export const INFO_FIELDS = Object.freeze([
  "transportista",
  "patente",
  "notas",
  "fecha",
  "numero",
  "basePointId",
]);

const STOP_FIELD_SET = new Set(STOP_FIELDS);
const INFO_FIELD_SET = new Set(INFO_FIELDS);

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function fold(s) {
  return norm(s).replace(/[^a-z0-9]+/g, "");
}

/**
 * @param {object} stop
 * @returns {string[]}
 */
export function stopGaps(stop) {
  const gaps = [];
  if (!String(stop?.cliente || "").trim()) gaps.push("cliente");
  if (!String(stop?.direccion || "").trim() || /falta calle|sin dir|ciudad de maldonado$/i.test(String(stop?.direccion || ""))) {
    gaps.push("direccion");
  }
  if (!String(stop?.telefono || "").trim()) gaps.push("telefono");
  if (!String(stop?.orderId || stop?.cotizacionId || "").trim()) gaps.push("pedido");
  return gaps;
}

/**
 * Compact calcState for POST /api/agent/chat (logistica branch).
 * @param {{ info?: object, stops?: object[], truckL?: number, wizard?: object, route?: object }} app
 */
export function buildLogisticaSnapshot(app = {}) {
  const info = app.info && typeof app.info === "object" ? app.info : {};
  const stops = Array.isArray(app.stops) ? app.stops : [];
  const wizard = createWizardUi(app.wizard || {});
  return {
    logistica: true,
    module: "logistica",
    envNo: String(info.numero || ""),
    fecha: String(info.fecha || ""),
    truckL: app.truckL ?? null,
    transportista: String(info.transportista || ""),
    patente: String(info.patente || ""),
    basePointId: String(info.basePointId || ""),
    notas: String(info.notas || "").slice(0, 400),
    wizardStep: wizard.activeStep,
    wizardDone: { ...wizard.done },
    nextGap: firstIncompleteStep({
      stops,
      info,
      truckL: app.truckL,
      wizard,
      route: app.route,
    }),
    persona: app.persona && typeof app.persona === "object"
      ? {
          look: String(app.persona.look || ""),
          corrections: Array.isArray(app.persona.corrections)
            ? app.persona.corrections.map((c) => String(c)).filter(Boolean).slice(-24)
            : [],
        }
      : undefined,
    stops: stops.map((s, i) => ({
      id: s.id,
      orden: s.orden ?? i + 1,
      cliente: s.cliente || "",
      direccion: s.direccion || "",
      telefono: s.telefono || "",
      orderId: s.orderId || "",
      pickupId: s.pickupId || "",
      zona: s.zona || "",
      horarioEntrega: s.horarioEntrega || "",
      fechaEntrega: s.fechaEntrega || "",
      paneles: Array.isArray(s.paneles)
        ? s.paneles.map((p) => ({
            tipo: p.tipo,
            espesor: p.espesor,
            longitud: p.longitud,
            cantidad: p.cantidad,
          }))
        : [],
      gaps: stopGaps(s),
    })),
  };
}

/**
 * @param {object} snapshot
 * @returns {string}
 */
export function buildTruckerGreeting(snapshot = {}) {
  const n = Array.isArray(snapshot.stops) ? snapshot.stops.length : 0;
  const env = snapshot.envNo || "este envío";
  const truck = snapshot.truckL ? ` · camión ${snapshot.truckL} m` : "";
  const firstGap = (snapshot.stops || []).find((s) => (s.gaps || []).includes("direccion"));
  if (n === 0) {
    return `Soy ${TRUCKER_NAME}, hoy de ruta. No veo paradas en ${env}. Decime un cliente o pedido y lo cargamos.`;
  }
  if (firstGap) {
    return `Soy ${TRUCKER_NAME}, hoy de ruta. ${env} · ${n} paradas${truck}. ${firstGap.cliente || "Una parada"} todavía no tiene calle. ¿Me la dictás?`;
  }
  const next = snapshot.nextGap && snapshot.nextGap !== "carga" ? snapshot.nextGap : "carga";
  return `Soy ${TRUCKER_NAME}, hoy de ruta. ${env} · ${n} paradas${truck}. Pedidos listos. Seguimos por ${next}.`;
}

/**
 * @param {object[]} stops
 * @param {object} payload
 */
export function matchStop(stops, payload = {}) {
  const list = Array.isArray(stops) ? stops : [];
  if (payload.stopId) {
    const hit = list.find((s) => String(s.id) === String(payload.stopId));
    if (hit) return hit;
  }
  if (payload.orden != null && payload.orden !== "") {
    const n = Number(payload.orden);
    const hit = list.find((s) => Number(s.orden) === n);
    if (hit) return hit;
  }
  if (payload.orderId) {
    const oid = String(payload.orderId).trim();
    const hit = list.find((s) => String(s.orderId || s.cotizacionId || "") === oid);
    if (hit) return hit;
  }
  if (payload.cliente) {
    const q = fold(payload.cliente);
    if (q) {
      const hit = list.find((s) => fold(s.cliente).includes(q) || q.includes(fold(s.cliente)));
      if (hit) return hit;
    }
  }
  return null;
}

function cloneState(state) {
  return {
    info: { ...(state.info || {}) },
    stops: Array.isArray(state.stops) ? state.stops.map((s) => ({ ...s })) : [],
    truckL: state.truckL,
    wizard: createWizardUi(state.wizard || {}),
  };
}

/**
 * Apply one trucker ACTION_JSON. Never sends WhatsApp.
 * @param {{ info: object, stops: object[], truckL?: number, wizard?: object, route?: object }} state
 * @param {{ type: string, payload?: any }} action
 * @returns {{ ok: boolean, state: object, error?: string, applied?: object }}
 */
export function applyTruckerAction(state, action) {
  const type = action?.type;
  const payload = action?.payload;
  if (!TRUCKER_ACTION_TYPES.includes(type)) {
    return { ok: false, state, error: "unknown_type" };
  }
  const next = cloneState(state);

  if (type === "setStopField") {
    const field = String(payload?.field || "");
    if (!STOP_FIELD_SET.has(field)) return { ok: false, state, error: "bad_field" };
    const stop = matchStop(next.stops, payload);
    if (!stop) return { ok: false, state, error: "stop_not_found" };
    const value = payload?.value == null ? "" : String(payload.value);
    next.stops = next.stops.map((s) => (s.id === stop.id ? { ...s, [field]: value } : s));
    return { ok: true, state: next, applied: { type, stopId: stop.id, field, value } };
  }

  if (type === "setEnviosInfo") {
    const patch = payload && typeof payload === "object" ? payload : {};
    const applied = {};
    for (const k of Object.keys(patch)) {
      if (!INFO_FIELD_SET.has(k)) continue;
      next.info[k] = patch[k] == null ? "" : String(patch[k]);
      applied[k] = next.info[k];
    }
    if (!Object.keys(applied).length) return { ok: false, state, error: "empty_info" };
    return { ok: true, state: next, applied: { type, ...applied } };
  }

  if (type === "setEnviosTruck") {
    const L = Number(payload);
    if (!Number.isFinite(L) || L < 4 || L > 18) return { ok: false, state, error: "bad_truck" };
    next.truckL = L;
    return { ok: true, state: next, applied: { type, truckL: L } };
  }

  if (type === "setLogisticaWizard") {
    const step = String(payload || "");
    if (!WIZARD_STEPS.includes(step)) return { ok: false, state, error: "bad_step" };
    next.wizard = createWizardUi({ ...next.wizard, enabled: true, activeStep: step });
    return { ok: true, state: next, applied: { type, step } };
  }

  if (type === "advanceLogisticaWizard") {
    const step = next.wizard.activeStep;
    const result = tryCompleteStep(step, next.wizard, {
      stops: next.stops,
      info: next.info,
      truckL: next.truckL,
      wizard: next.wizard,
      route: state.route,
    });
    if (!result.ok) {
      return { ok: false, state, error: "step_incomplete", missing: result.missing };
    }
    next.wizard = result.wizard;
    return { ok: true, state: next, applied: { type, step: result.wizard.activeStep } };
  }

  return { ok: false, state, error: "unknown_type" };
}
