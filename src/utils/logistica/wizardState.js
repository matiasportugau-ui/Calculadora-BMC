/**
 * BMC Envíos Setup Wizard — pure step gates + summaries.
 * SDD-ENVIO-WIZARD.md
 */

export const WIZARD_STEPS = Object.freeze(["pedidos", "flota", "levantes", "ruta", "carga"]);

export const DEFAULT_WIZARD_UI = Object.freeze({
  /** Closed by default — user opens via "Configuración del envío" launcher. */
  enabled: false,
  activeStep: "pedidos",
  done: Object.freeze({
    pedidos: false,
    flota: false,
    levantes: false,
    ruta: false,
    carga: false,
  }),
  /** Per-load origin is the default; “un solo levante” is an explicit shortcut. */
  singlePickup: false,
  defaultPickupPointId: "pickup-kingspan-bromyros",
  routeStale: false,
  /** Operator explicitly allows some loads without pickup origin. */
  unassignedPickupApproved: false,
});

/**
 * @param {object} [partial]
 */
export function createWizardUi(partial = {}) {
  const done = { ...DEFAULT_WIZARD_UI.done, ...(partial.done || {}) };
  const activeStep = WIZARD_STEPS.includes(partial.activeStep)
    ? partial.activeStep
    : DEFAULT_WIZARD_UI.activeStep;
  return {
    enabled: typeof partial.enabled === "boolean" ? partial.enabled : DEFAULT_WIZARD_UI.enabled,
    activeStep,
    done,
    singlePickup:
      typeof partial.singlePickup === "boolean"
        ? partial.singlePickup
        : DEFAULT_WIZARD_UI.singlePickup,
    defaultPickupPointId:
      partial.defaultPickupPointId != null
        ? String(partial.defaultPickupPointId)
        : DEFAULT_WIZARD_UI.defaultPickupPointId,
    routeStale: partial.routeStale === true,
    unassignedPickupApproved: partial.unassignedPickupApproved === true,
  };
}

/**
 * Effective pickup id for a stop (single-mode default fills empty per-stop ids).
 * @param {object} stop
 * @param {{ singlePickup?: boolean, defaultPickupPointId?: string }} [wizard]
 */
export function pickupIdForStop(stop, wizard = {}) {
  const own = String(stop?.pickupPointId || "").trim();
  if (wizard.singlePickup === true) {
    return String(own || wizard.defaultPickupPointId || "").trim();
  }
  return own;
}

/**
 * @param {object[]} stops
 * @param {object} [wizard]
 * @returns {{ assigned: object[], missing: object[] }}
 */
export function partitionLevantes(stops, wizard = {}) {
  const list = Array.isArray(stops) ? stops : [];
  const assigned = [];
  const missing = [];
  for (const s of list) {
    if (pickupIdForStop(s, wizard)) assigned.push(s);
    else missing.push(s);
  }
  return { assigned, missing };
}

/**
 * Group assigned stops by origin for the levantes summary.
 * @param {object[]} stops
 * @param {object} [wizard]
 * @param {object[]} [places]
 */
export function consolidateLevantes(stops, wizard = {}, places = []) {
  const { assigned, missing } = partitionLevantes(stops, wizard);
  const groups = [];
  const indexById = new Map();
  for (const s of assigned) {
    const id = pickupIdForStop(s, wizard);
    let g = indexById.get(id);
    if (!g) {
      g = { id, label: placeLabel(places, id) || id, stops: [] };
      indexById.set(id, g);
      groups.push(g);
    }
    g.stops.push(s);
  }
  return { groups, missing };
}

/**
 * @param {object[]} stops
 */
export function isPedidosComplete(stops) {
  if (!Array.isArray(stops) || stops.length < 1) return false;
  return stops.every((s) => {
    const orderId = String(s?.orderId || s?.cotizacionId || "").trim();
    const cliente = String(s?.cliente || "").trim();
    return Boolean(orderId || cliente);
  });
}

/**
 * @param {object} info
 * @param {number|null|undefined} truckL
 */
export function isFlotaComplete(info, truckL) {
  const transportista = String(info?.transportista || "").trim();
  const base = String(info?.basePointId || "").trim();
  const L = Number(truckL);
  return Boolean(transportista && base && Number.isFinite(L) && L > 0);
}

/**
 * @param {object[]} stops
 * @param {{ singlePickup?: boolean, defaultPickupPointId?: string }} wizard
 */
export function isLevantesComplete(stops, wizard = {}) {
  if (!Array.isArray(stops) || !stops.length) return false;
  const single = wizard.singlePickup === true;
  const def = String(wizard.defaultPickupPointId || "").trim();
  if (single && !def) return false;
  const { missing } = partitionLevantes(stops, wizard);
  if (missing.length === 0) return true;
  return wizard.unassignedPickupApproved === true;
}

/**
 * @param {object|null|undefined} route
 */
export function isRutaComplete(route) {
  const legs = route?.orderedLegs;
  if (!Array.isArray(legs) || legs.length < 2) return false;
  return legs.every((leg) => leg && String(leg.label || leg.type || "").trim());
}

/**
 * Optional packing step — always "completable" (warnings OK).
 */
export function isCargaComplete() {
  return true;
}

/**
 * @param {string} step
 * @param {{ stops, info, truckL, wizard, route }} ctx
 */
export function isStepComplete(step, ctx = {}) {
  const wizard = ctx.wizard || {};
  switch (step) {
    case "pedidos":
      return isPedidosComplete(ctx.stops);
    case "flota":
      return isFlotaComplete(ctx.info, ctx.truckL);
    case "levantes":
      return isLevantesComplete(ctx.stops, wizard);
    case "ruta":
      return isRutaComplete(ctx.route) && wizard.routeStale !== true;
    case "carga":
      return isCargaComplete(ctx);
    default:
      return false;
  }
}

/**
 * First incomplete step, or last step if all done.
 * @param {object} ctx
 */
export function firstIncompleteStep(ctx = {}) {
  for (const step of WIZARD_STEPS) {
    if (!isStepComplete(step, ctx)) return step;
  }
  return "carga";
}

/**
 * @param {string} current
 * @param {"next"|"prev"} dir
 */
export function adjacentStep(current, dir = "next") {
  const i = WIZARD_STEPS.indexOf(current);
  if (i < 0) return dir === "next" ? "pedidos" : "carga";
  if (dir === "prev") return WIZARD_STEPS[Math.max(0, i - 1)];
  return WIZARD_STEPS[Math.min(WIZARD_STEPS.length - 1, i + 1)];
}

/**
 * Mark step done and advance if valid.
 * @returns {{ ok: boolean, wizard: object, missing?: string[] }}
 */
export function tryCompleteStep(step, wizard, ctx) {
  const w = createWizardUi(wizard);
  const missing = stepMissingHints(step, ctx);
  if (missing.length) {
    return { ok: false, wizard: w, missing };
  }
  const done = { ...w.done, [step]: true };
  const next = adjacentStep(step, "next");
  return {
    ok: true,
    wizard: createWizardUi({
      ...w,
      done,
      activeStep: next,
      routeStale: step === "pedidos" || step === "levantes" || step === "flota" ? true : w.routeStale,
    }),
  };
}

/**
 * Human-readable missing fields.
 * @param {string} step
 * @param {object} ctx
 * @returns {string[]}
 */
export function stepMissingHints(step, ctx = {}) {
  const wizard = ctx.wizard || {};
  const hints = [];
  if (step === "pedidos") {
    if (!Array.isArray(ctx.stops) || !ctx.stops.length) hints.push("Agregá al menos un pedido");
    else if (!isPedidosComplete(ctx.stops)) hints.push("Cada parada necesita cliente o nº de pedido");
  }
  if (step === "flota") {
    if (!String(ctx.info?.transportista || "").trim()) hints.push("Elegí transportista");
    if (!(Number(ctx.truckL) > 0)) hints.push("Elegí largo de camión");
    if (!String(ctx.info?.basePointId || "").trim()) hints.push("Elegí base / zona de salida");
  }
  if (step === "levantes") {
    if (wizard.singlePickup === true) {
      if (!String(wizard.defaultPickupPointId || "").trim()) hints.push("Elegí lugar de levante");
    } else {
      const { missing } = partitionLevantes(ctx.stops, wizard);
      if (missing.length && wizard.unassignedPickupApproved !== true) {
        hints.push(
          `Hay ${missing.length} carga${missing.length === 1 ? "" : "s"} sin origen — confirmá que es adrede`,
        );
      }
    }
  }
  if (step === "ruta") {
    if (wizard.routeStale) hints.push("Recalculá la ruta (datos desactualizados)");
    else if (!isRutaComplete(ctx.route)) hints.push("Generá o completá la sugerencia de ruta");
  }
  return hints;
}

/**
 * One-line summary for collapsed step.
 */
export function stepSummary(step, ctx = {}, places = []) {
  const stops = ctx.stops || [];
  const wizard = ctx.wizard || {};
  if (step === "pedidos") {
    if (!stops.length) return "Sin pedidos";
    const names = stops
      .map((s) => s.cliente || s.orderId || "—")
      .slice(0, 3)
      .join(", ");
    const more = stops.length > 3 ? ` +${stops.length - 3}` : "";
    return `${stops.length} pedido${stops.length === 1 ? "" : "s"} · ${names}${more}`;
  }
  if (step === "flota") {
    const t = ctx.info?.transportista || "—";
    const L = ctx.truckL ? `${ctx.truckL} m` : "—";
    const base = placeLabel(places, ctx.info?.basePointId) || "sin base";
    return `${t} · camión ${L} · ${base}`;
  }
  if (step === "levantes") {
    const { groups, missing } = consolidateLevantes(stops, wizard, places);
    const bits = groups.map((g) => `${g.label} (×${g.stops.length})`);
    if (missing.length) bits.push(`sin origen (×${missing.length})`);
    if (wizard.singlePickup === true && !groups.length) {
      return `Un levante · ${placeLabel(places, wizard.defaultPickupPointId) || "—"}`;
    }
    return bits.join(" · ") || "Sin levantes";
  }
  if (step === "ruta") {
    const n = ctx.route?.orderedLegs?.length || 0;
    if (wizard.routeStale) return `⚠ Ruta desactualizada · ${n} tramos`;
    if (n < 2) return "Sin ruta";
    const km = ctx.route?.totalKm;
    return `${n} tramos${Number.isFinite(km) ? ` · ~${km.toFixed(0)} km` : ""}`;
  }
  if (step === "carga") {
    return "Packing · remito · 3D";
  }
  return "";
}

export function placeLabel(places, id) {
  if (!id) return "";
  const p = (places || []).find((x) => x.id === id);
  return p?.label || "";
}

/**
 * Catalog label for a stop's effective pickup origin (empty if none).
 */
export function originLabelForStop(stop, wizard = {}, places = []) {
  const id = pickupIdForStop(stop, wizard);
  if (!id) return "";
  return placeLabel(places, id) || id;
}

/**
 * Should open wizard for this session state?
 * Entry is always the "Configuración del envío" launcher unless draft/force says otherwise.
 */
export function shouldEnableWizard({ uiWizard, force } = {}) {
  if (force === true) return true;
  if (force === false) return false;
  if (uiWizard && typeof uiWizard.enabled === "boolean") return uiWizard.enabled;
  return false;
}

/**
 * Apply default pickup id to all stops (single mode).
 * Always overwrites: switching default / multi→single must not leave stale per-stop pickups
 * that would send the trip to the wrong levante while the UI shows one default.
 */
export function applyDefaultPickupToStops(stops, defaultPickupPointId) {
  const id = String(defaultPickupPointId || "").trim();
  if (!id || !Array.isArray(stops)) return stops || [];
  return stops.map((s) => ({
    ...s,
    pickupPointId: id,
  }));
}
