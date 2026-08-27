/**
 * Deterministic one-plan chooser: route order + packing strategy.
 * Never invents geo. LLM only conducts; this file owns the pick.
 */

import { placeCargo } from "./cargoPacking.js";
import { PANEL_ON_PROFILE_RULE_ES } from "./stackConstraints.js";
import { suggestRoute } from "./routeSuggest.js";
import { buildRutaFaltas } from "./rutaFaltas.js";
import { createWizardUi } from "./wizardState.js";
import { orderStopsByIds, renumberStops } from "./stopReorder.js";

export const TRIP_PLAN_STRATEGIES = Object.freeze(["doorPriority", "balanced", "compact"]);

export const LOGISTICA_PLAN_CHANNEL = "bmc-logistica-plan-v1";

/**
 * @param {object} [stop]
 * @returns {"east"|"west"|""}
 */
export function deliveryCluster(stop) {
  const t = String(`${stop?.zona || ""} ${stop?.direccion || ""} ${stop?.cliente || ""}`)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/maldonado|punta del este|punta ballena|chacras del pinar/.test(t)) return "east";
  if (/montevideo|paullier/.test(t)) return "west";
  return "";
}

function byOrden(a, b) {
  return (a?.orden ?? 0) - (b?.orden ?? 0);
}

function sortByCluster(stops, prefer) {
  const want = prefer === "west" ? "west" : "east";
  const other = want === "east" ? "west" : "east";
  const rank = (s) => {
    const c = deliveryCluster(s);
    if (c === want) return 0;
    if (c === other) return 1;
    return 2;
  };
  return [...(stops || [])].sort((a, b) => rank(a) - rank(b) || byOrden(a, b));
}

function deliveryIdsFromRoute(route) {
  return (route?.orderedLegs || [])
    .filter((l) => l && l.type === "delivery")
    .map((l) => l.stopId || l.refId)
    .filter(Boolean);
}

function unloadIdsFromCargo(cargo) {
  return (cargo?.stopUnloadOrder || []).map((row) => row?.stop?.id).filter(Boolean);
}

function sameIdList(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((id, i) => id === b[i]);
}

function panelOnProfile(cargo) {
  const warns = cargo?.warns || [];
  if (cargo?.stackConstraintsOk === false) return true;
  const needle = String(PANEL_ON_PROFILE_RULE_ES || "panel").toLowerCase();
  return warns.some((w) => {
    const t = String(w || "").toLowerCase();
    return t.includes("panel") && (t.includes("perfil") || t.includes("accesorio") || t.includes(needle));
  });
}

/**
 * @param {{ info?: object, stops?: object[], truckL?: number, wizard?: object, route?: object }} input
 */
export function collectTripFacts(input = {}) {
  const stops = Array.isArray(input.stops) ? input.stops : [];
  const info = input.info && typeof input.info === "object" ? input.info : {};
  const wizard = createWizardUi(input.wizard || {});
  const faltas = buildRutaFaltas({
    stops,
    info,
    route: input.route || {},
    wizard,
  });
  const CHOOSER_SOFT_BLOCKS = new Set(["geo-mix"]);
  const blocks = faltas.filter((f) => f.severity === "block" && !CHOOSER_SOFT_BLOCKS.has(f.id));
  const warns = faltas.filter(
    (f) => f.severity === "warn" || (f.severity === "block" && CHOOSER_SOFT_BLOCKS.has(f.id)),
  );
  return { stops, info, wizard, faltas, blocks, warns, truckL: Number(input.truckL) || 12 };
}

/**
 * Same stop ids, different delivery permutations (never drops a stop).
 * @param {{ stops?: object[], wizard?: object, places?: object[], info?: object }} input
 */
export function buildRouteCandidates(input = {}) {
  const stops = Array.isArray(input.stops) ? input.stops : [];
  const places = Array.isArray(input.places) ? input.places : [];
  const info = input.info || {};
  const wizard = createWizardUi(input.wizard || {});
  const clusters = new Set(stops.map(deliveryCluster).filter(Boolean));
  const variants = [{ id: "current", ordered: renumberStops([...stops].sort(byOrden)) }];
  if (clusters.has("east") && clusters.has("west")) {
    variants.push({ id: "east-then-west", ordered: renumberStops(sortByCluster(stops, "east")) });
    variants.push({ id: "west-then-east", ordered: renumberStops(sortByCluster(stops, "west")) });
  }
  const seen = new Set();
  const out = [];
  for (const v of variants) {
    const key = v.ordered.map((s) => s.id).join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    const route = suggestRoute({
      basePointId: info.basePointId,
      places,
      stops: v.ordered,
      defaultPickupPointId: wizard.defaultPickupPointId,
    });
    out.push({
      id: v.id,
      stops: v.ordered,
      stopOrder: v.ordered.map((s) => s.id),
      route,
    });
  }
  return out;
}

/**
 * @param {{
 *   route: object,
 *   cargo: object,
 *   warnFaltaCount?: number,
 *   bestKm?: number|null,
 *   deliveryIds?: string[],
 * }} args
 */
export function scoreTripPlan(args = {}) {
  const cargo = args.cargo || {};
  if (!cargo.cabe || cargo.stackConstraintsOk === false || panelOnProfile(cargo)) {
    return { score: 0, reject: true, roadUnverified: false, unloadAligned: false };
  }
  let score = 100;
  const missingGeo = Number(args.route?.missingGeoCount) || 0;
  score -= missingGeo * 15;
  const src = String(args.route?.suggestionSource || "haversine");
  const roadUnverified = src !== "osrm";
  if (roadUnverified) score -= 10;
  const deliveryIds = args.deliveryIds || deliveryIdsFromRoute(args.route);
  const unloadIds = unloadIdsFromCargo(cargo);
  const rev = [...deliveryIds].reverse();
  const unloadAligned = unloadIds.length > 0 && sameIdList(rev, unloadIds);
  if (unloadIds.length && !unloadAligned) score -= 20;
  score -= (Number(args.warnFaltaCount) || 0) * 5;
  const warns = cargo.warns || [];
  if (warns.some((w) => /excede|sobresale|2° camión|2º camion/i.test(String(w)))) score -= 8;
  const km = Number(args.route?.totalKm);
  const best = Number(args.bestKm);
  if (Number.isFinite(km) && Number.isFinite(best) && km > best) {
    score -= 0.2 * (km - best);
  }
  if (score < 20 && missingGeo > 0) score = 20;
  return {
    score: Math.max(0, Math.round(score * 10) / 10),
    reject: false,
    roadUnverified,
    unloadAligned,
  };
}

function whyLine(plan) {
  if (!plan || plan.status === "blocked") {
    const b = plan?.blocks?.[0];
    return b?.label ? `Falta ${b.label}. No armo ruta sin eso.` : "Faltan datos. No armo ruta.";
  }
  const km = plan.route?.totalKm != null ? `~${Number(plan.route.totalKm).toFixed(0)} km` : "sin km";
  const how = plan.roadUnverified ? "aire" : "calles";
  const strat =
    plan.strategy === "doorPriority" ? "acceso rápido (última entrega en puerta)" : plan.strategy;
  return `Una propuesta: ${km} (${how}), ${strat}.`;
}

/**
 * @param {{
 *   info?: object,
 *   stops?: object[],
 *   truckL?: number,
 *   wizard?: object,
 *   places?: object[],
 *   route?: object,
 * }} input
 */
export function chooseTripPlan(input = {}) {
  const facts = collectTripFacts(input);
  if (facts.blocks.length) {
    const preview = {
      status: "blocked",
      reliability: 0,
      roadUnverified: true,
      blocks: facts.blocks,
      warnings: facts.warns.map((w) => w.label),
      stopOrder: facts.stops.map((s) => s.id),
      strategy: "doorPriority",
      cargoLayoutMode: "auto",
      route: input.route || null,
      unloadStopIds: [],
      cabe: false,
      why: "",
    };
    preview.why = whyLine(preview);
    return preview;
  }

  const routes = buildRouteCandidates({
    stops: facts.stops,
    wizard: facts.wizard,
    places: input.places,
    info: facts.info,
  });
  const kms = routes.map((r) => r.route?.totalKm).filter((n) => Number.isFinite(n));
  const bestKm = kms.length ? Math.min(...kms) : null;

  let winner = null;
  for (const rc of routes) {
    for (const strategy of TRIP_PLAN_STRATEGIES) {
      const cargo = placeCargo(rc.stops, facts.truckL, strategy, { mode: "auto" });
      const scored = scoreTripPlan({
        route: rc.route,
        cargo,
        warnFaltaCount: facts.warns.length,
        bestKm,
        deliveryIds: deliveryIdsFromRoute(rc.route),
      });
      if (scored.reject) continue;
      const candidate = {
        status: "ok",
        reliability: scored.score,
        roadUnverified: scored.roadUnverified,
        blocks: [],
        warnings: [
          ...facts.warns.map((w) => w.label),
          ...(cargo.warns || []),
          scored.roadUnverified ? "km por aire — calles no verificadas" : null,
        ].filter(Boolean),
        stopOrder: rc.stopOrder,
        strategy,
        cargoLayoutMode: "auto",
        route: rc.route,
        unloadStopIds: unloadIdsFromCargo(cargo),
        cabe: cargo.cabe === true,
        why: "",
        _tie: { strategy, missingGeo: rc.route?.missingGeoCount || 0, variant: rc.id },
      };
      candidate.why = whyLine(candidate);
      if (!winner || better(candidate, winner)) winner = candidate;
    }
  }

  if (!winner) {
    const preview = {
      status: "blocked",
      reliability: 0,
      roadUnverified: true,
      blocks: [
        {
          id: "cargo-no-cabe",
          severity: "block",
          label: "La carga no entra sin romper estiba (paneles sobre perfil o no cabe)",
        },
      ],
      warnings: facts.warns.map((w) => w.label),
      stopOrder: facts.stops.map((s) => s.id),
      strategy: "doorPriority",
      cargoLayoutMode: "auto",
      route: input.route || null,
      unloadStopIds: [],
      cabe: false,
      why: "",
    };
    preview.why = whyLine(preview);
    return preview;
  }

  delete winner._tie;
  return winner;
}

function better(a, b) {
  if (a.reliability !== b.reliability) return a.reliability > b.reliability;
  const rank = (s) => (s === "doorPriority" ? 0 : s === "balanced" ? 1 : 2);
  if (rank(a.strategy) !== rank(b.strategy)) return rank(a.strategy) < rank(b.strategy);
  if (a._tie.missingGeo !== b._tie.missingGeo) return a._tie.missingGeo < b._tie.missingGeo;
  return a._tie.variant === "current";
}

export { orderStopsByIds, deliveryIdsFromRoute, unloadIdsFromCargo };
