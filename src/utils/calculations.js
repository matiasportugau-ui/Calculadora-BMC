// ═══════════════════════════════════════════════════════════════════════════
// src/utils/calculations.js — Pure calculation functions for BMC calculator
// ═══════════════════════════════════════════════════════════════════════════

import { p } from "../data/constants.js";
import { getPricing } from "../data/pricing.js";
import { getIVA } from "./calculatorConfig.js";
import { getDimensioningParam } from "./dimensioningFormulas.js";

// ── §0 PENDIENTE ─────────────────────────────────────────────────────────────

export function calcFactorPendiente(pendienteGrados) {
  if (!pendienteGrados || pendienteGrados === 0) return 1;
  const clamped = Math.min(Math.abs(pendienteGrados), 89);
  const rad = clamped * Math.PI / 180;
  return +(1 / Math.cos(rad)).toFixed(4);
}

export function calcLargoReal(largoProyectado, pendienteGrados) {
  return +(largoProyectado * calcFactorPendiente(pendienteGrados)).toFixed(3);
}

/** Calcula largo real según modo de pendiente */
export function calcLargoRealFromModo(largo, pendienteModo, pendienteGrados = 0, alturaDif = 0) {
  if (pendienteModo === "incluye_pendiente") return +(largo).toFixed(3);
  if (pendienteModo === "calcular_altura" && alturaDif > 0) return +(Math.sqrt(largo * largo + alturaDif * alturaDif)).toFixed(3);
  return calcLargoReal(largo, pendienteGrados);
}

// ── §1 ENGINE TECHO ──────────────────────────────────────────────────────────

export function normalizarMedida(modo, valor, panel) {
  if (modo === "paneles") {
    const cantPaneles = Math.max(1, Math.ceil(valor));
    const ancho = +(cantPaneles * panel.au).toFixed(2);
    return { cantPaneles, ancho };
  }
  const cantPaneles = Math.ceil(valor / panel.au);
  return { cantPaneles, ancho: valor };
}

export function resolveSKU_techo(tipo, familiaP, espesor) {
  const { PERFIL_TECHO } = getPricing();
  const byTipo = PERFIL_TECHO[tipo];
  if (!byTipo) return null;
  /** Isoroof Colonial: misma perfilería ISOROOF 3G excepto cumbrera (2,2 m colonial bajo cumbrera.ISOROOF_COLONIAL). */
  let fam = familiaP;
  if (fam === "ISOROOF_COLONIAL" && tipo !== "cumbrera") {
    fam = "ISOROOF";
  }
  const byFam = byTipo[fam];
  if (!byFam) return null;
  if (byFam[espesor]) return { ...byFam[espesor] };
  if (byFam._all) return { ...byFam._all };
  return null;
}

export function calcPanelesTecho(panel, espesor, largo, ancho) {
  const espData = panel.esp[espesor];
  if (!espData) return null;
  const cantPaneles = Math.ceil(ancho / panel.au);
  const anchoTotal = cantPaneles * panel.au;
  const areaTotal = +(cantPaneles * largo * panel.au).toFixed(2);
  const precioM2 = p(espData);
  const costoPaneles = +(precioM2 * areaTotal).toFixed(2);
  const descarteAncho = +(anchoTotal - ancho).toFixed(2);
  const descarteArea = +(descarteAncho * largo).toFixed(2);
  const descartePct = ancho > 0 ? +((descarteAncho / ancho) * 100).toFixed(1) : 0;
  return {
    cantPaneles, areaTotal, anchoTotal, costoPaneles, precioM2,
    descarte: { anchoM: descarteAncho, areaM2: descarteArea, porcentaje: descartePct }
  };
}

/**
 * Autoportancia vs largo de fabricación:
 * - maxSpan (`esp.ap`): vano máximo entre apoyos (m). `ok` y `apoyos` se basan solo en esto.
 * - largoMinOK / largoMaxOK: si `largo` entra en el rango comercial panel.lmin–panel.lmax (fabricación).
 *   No usar lmin/lmax como límite estructural de vano; eso es `ap`.
 */
export function calcAutoportancia(panel, espesor, largo) {
  const espData = panel.esp[espesor];
  if (!espData || espData.ap == null) {
    return { ok: true, apoyos: null, maxSpan: null, largoMinOK: true, largoMaxOK: true };
  }
  const maxSpan = espData.ap;
  const apoyos = Math.ceil((largo / maxSpan) + 1);
  const ok = largo <= maxSpan;
  const largoMinOK = largo >= (panel.lmin || 0);
  const largoMaxOK = largo <= (panel.lmax || Infinity);
  return { ok, apoyos, maxSpan, largoMinOK, largoMaxOK };
}

export function calcFijacionesVarilla(cantP, apoyos, largo, tipoEst, ptsHorm, ptsMetal, ptsMadera, opts = {}) {
  const { FIJACIONES } = getPricing();
  let puntosFijacion, pMetal, pH, pMadera;
  const overridePts = opts.overridePuntosFijacion;
  if (tipoEst === "combinada") {
    pH = Math.max(0, Math.floor(ptsHorm || 0));
    pMetal = Math.max(0, Math.floor(ptsMetal || 0));
    pMadera = Math.max(0, Math.floor(ptsMadera || 0));
    puntosFijacion = pH + pMetal + pMadera;
  } else if (overridePts != null && overridePts > 0) {
    puntosFijacion = Math.round(overridePts);
    if (tipoEst === "metal") { pMetal = puntosFijacion; pH = 0; pMadera = 0; }
    else if (tipoEst === "hormigon") { pMetal = 0; pH = puntosFijacion; pMadera = 0; }
    else if (tipoEst === "madera") { pMetal = 0; pH = 0; pMadera = puntosFijacion; }
    else { pH = Math.min(ptsHorm || 0, puntosFijacion); pMetal = puntosFijacion - pH; pMadera = 0; }
  } else {
    const espPerim = getDimensioningParam("FIJACIONES_VARILLA.espaciado_perimetro", 2.5);
    puntosFijacion = Math.ceil(((cantP * apoyos) * 2) + (largo * 2 / espPerim));
    if (tipoEst === "metal") { pMetal = puntosFijacion; pH = 0; pMadera = 0; }
    else if (tipoEst === "hormigon") { pMetal = 0; pH = puntosFijacion; pMadera = 0; }
    else if (tipoEst === "madera") { pMetal = 0; pH = 0; pMadera = puntosFijacion; }
    else { pH = Math.min(ptsHorm || 0, puntosFijacion); pMetal = puntosFijacion - pH; pMadera = 0; }
  }
  const tuercas = (pMetal * 2) + (pH * 1) + (pMadera * 2);
  const tacos = pH;
  const varillasPorPunto = getDimensioningParam("FIJACIONES_VARILLA.varillas_por_punto", 4);
  const varillas = Math.ceil(puntosFijacion / varillasPorPunto);
  const items = [];
  const c = (x) => (x?.costo ?? 0);
  const puVar = p(FIJACIONES.varilla_38);
  items.push({ label: FIJACIONES.varilla_38.label, sku: "varilla_38", cant: varillas, unidad: "unid", pu: puVar, costo: c(FIJACIONES.varilla_38), total: +(varillas * puVar).toFixed(2) });
  const puTuer = p(FIJACIONES.tuerca_38);
  items.push({ label: FIJACIONES.tuerca_38.label, sku: "tuerca_38", cant: tuercas, unidad: "unid", pu: puTuer, costo: c(FIJACIONES.tuerca_38), total: +(tuercas * puTuer).toFixed(2) });
  if (tacos > 0) {
    const puTaco = p(FIJACIONES.taco_expansivo);
    items.push({ label: FIJACIONES.taco_expansivo.label, sku: "taco_expansivo", cant: tacos, unidad: "unid", pu: puTaco, costo: c(FIJACIONES.taco_expansivo), total: +(tacos * puTaco).toFixed(2) });
  }
  const puArand = p(FIJACIONES.arandela_carrocero);
  items.push({ label: FIJACIONES.arandela_carrocero.label, sku: "arandela_carrocero", cant: puntosFijacion, unidad: "unid", pu: puArand, costo: c(FIJACIONES.arandela_carrocero), total: +(puntosFijacion * puArand).toFixed(2) });
  const puPP = p(FIJACIONES.arandela_pp);
  items.push({ label: FIJACIONES.arandela_pp.label, sku: "arandela_pp", cant: puntosFijacion, unidad: "unid", pu: puPP, costo: c(FIJACIONES.arandela_pp), total: +(puntosFijacion * puPP).toFixed(2) });
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2), puntosFijacion };
}

export function calcFijacionesCaballete(cantP, largo) {
  const { FIJACIONES } = getPricing();
  const factorLargo = getDimensioningParam("FIJACIONES_CABALETE.factor_largo", 2.9);
  const factorAncho = getDimensioningParam("FIJACIONES_CABALETE.factor_ancho", 0.3);
  const caballetes = Math.ceil((cantP * 3 * (largo / factorLargo + 1)) + ((largo * 2) / factorAncho));
  const tornillosAguja = caballetes * 2;
  const items = [];
  const c = (x) => (x?.costo ?? 0);
  const puCab = p(FIJACIONES.caballete);
  items.push({ label: FIJACIONES.caballete.label, sku: "caballete", cant: caballetes, unidad: "unid", pu: puCab, costo: c(FIJACIONES.caballete), total: +(caballetes * puCab).toFixed(2) });
  const puAguja = p(FIJACIONES.tornillo_aguja);
  items.push({ label: FIJACIONES.tornillo_aguja.label, sku: "tornillo_aguja", cant: tornillosAguja, unidad: "unid", pu: puAguja, costo: c(FIJACIONES.tornillo_aguja), total: +(tornillosAguja * puAguja).toFixed(2) });
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2), puntosFijacion: caballetes };
}

export function calcPerfileriaTecho(borders, cantP, largo, anchoTotal, familiaP, espesor, opciones) {
  const items = [];
  let totalML = 0;
  const addPerfil = (label, tipo, dim, famOverride) => {
    const fam = famOverride || familiaP;
    const resolved = resolveSKU_techo(tipo, fam, espesor);
    if (!resolved) return;
    const precio = p(resolved);
    const costoUn = resolved.costo ?? 0;
    const pzas = Math.ceil(dim / resolved.largo);
    const ml = pzas * resolved.largo;
    totalML += ml;
    items.push({ label, sku: resolved.sku, tipo, cant: pzas, unidad: "unid", pu: precio, costo: costoUn, total: +(pzas * precio).toFixed(2), ml: +ml.toFixed(2), largoBarra: resolved.largo });
  };

  const em = opciones?.edgeML && typeof opciones.edgeML === "object" ? opciones.edgeML : null;
  const dimFrente = em && Number.isFinite(em.frente) ? em.frente : anchoTotal;
  const dimFondo = em && Number.isFinite(em.fondo) ? em.fondo : anchoTotal;
  const dimLatIzq = em && Number.isFinite(em.latIzq) ? em.latIzq : largo;
  const dimLatDer = em && Number.isFinite(em.latDer) ? em.latDer : largo;

  // Canalón en frente: agregar canalón + soporte automáticamente
  if (borders.frente === "canalon") {
    const canData = resolveSKU_techo("canalon", familiaP, espesor);
    if (canData) {
      const precioCan = p(canData);
      const pzasCan = Math.ceil(dimFrente / canData.largo);
      totalML += pzasCan * canData.largo;
      items.push({ label: "Frente Inf: Canalón", sku: canData.sku, tipo: "canalon", cant: pzasCan, unidad: "unid", pu: precioCan, costo: canData.costo ?? 0, total: +(pzasCan * precioCan).toFixed(2), largoBarra: canData.largo });
    }
    const sopData = resolveSKU_techo("soporte_canalon", familiaP, espesor);
    if (sopData) {
      const mlPorApoyo = getDimensioningParam("PERFILERIA.soporte_canalon_ml_por_apoyo", 0.30);
      const mlSoportes = (cantP + 1) * mlPorApoyo;
      const barrasSoporte = Math.ceil(mlSoportes / sopData.largo);
      const precioSop = p(sopData);
      items.push({ label: "Soporte canalón", sku: sopData.sku, tipo: "soporte_canalon", cant: barrasSoporte, unidad: "unid", pu: precioSop, costo: sopData.costo ?? 0, total: +(barrasSoporte * precioSop).toFixed(2), largoBarra: sopData.largo });
    }
  } else if (borders.frente && borders.frente !== "none" && dimFrente > 0) {
    addPerfil("Frente Inf: " + borders.frente, borders.frente, dimFrente);
  }

  if (borders.fondo && borders.fondo !== "none" && dimFondo > 0) {
    addPerfil("Frente Sup: " + borders.fondo, borders.fondo, dimFondo);
  }
  if (borders.latIzq && borders.latIzq !== "none" && dimLatIzq > 0) {
    addPerfil("Lat.Izq: " + borders.latIzq, borders.latIzq, dimLatIzq);
  }
  if (borders.latDer && borders.latDer !== "none" && dimLatDer > 0) {
    addPerfil("Lat.Der: " + borders.latDer, borders.latDer, dimLatDer);
  }

  if (opciones && opciones.inclGotSup) {
    const gs = resolveSKU_techo("gotero_superior", familiaP, espesor);
    if (gs) {
      const precio = p(gs);
      const pzas = Math.ceil(dimFrente / gs.largo);
      totalML += pzas * gs.largo;
      items.push({ label: "Gotero superior", sku: gs.sku, tipo: "gotero_superior", cant: pzas, unidad: "unid", pu: precio, costo: gs.costo ?? 0, total: +(pzas * precio).toFixed(2), largoBarra: gs.largo });
    }
  }

  for (const j of opciones?.encounterJunctions || []) {
    const tipo = j.perfil || j.tipo;
    if (!tipo || tipo === "none") continue;
    const len = Number(j.lengthM);
    if (!Number.isFinite(len) || len <= 0) continue;
    addPerfil(j.label || `Encuentro: ${tipo}`, tipo, len);
  }

  if (totalML > 0) {
    const { FIJACIONES } = getPricing();
    const espFijMl = getDimensioningParam("PERFILERIA.espaciado_fijacion_ml", 0.30);
    const fijPerf = Math.ceil(totalML / espFijMl);
    const puT1 = p(FIJACIONES.tornillo_t1);
    const coT1 = FIJACIONES.tornillo_t1?.costo ?? 0;
    items.push({ label: FIJACIONES.tornillo_t1.label, sku: "tornillo_t1", tipo: "fijacion_perfileria", cant: fijPerf, unidad: "unid", pu: puT1, costo: coT1, total: +(fijPerf * puT1).toFixed(2) });
  }
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2), totalML: +totalML.toFixed(2) };
}

/**
 * Calcula selladores según uso real:
 * - Barrera condensación: juntas longitudinales entre paneles
 * - Solapes: 2 cordones × ancho útil × paneles solapados
 * - Encuentros con muros (babetas): ml × 2 (panel–babeta y babeta–muro)
 * - Canalones: 2 cordones entre empalmes (~60 cm por extensión)
 */
export function calcSelladoresTecho(cantP, { panel, borders = {}, anchoTotal = 0, largoReal = 0, familiaP, espesor, edgeML } = {}) {
  const { SELLADORES } = getPricing();
  const ML_POR_UNID_SILICONA = getDimensioningParam("SELLADORES_TECHO.silicona_ml_por_unid", SELLADORES.silicona?.ml_por_unid ?? 10.27);
  const items = [];

  let mlSilicona = 0;

  // 1. Barrera condensación: juntas longitudinales entre paneles
  if (cantP > 1 && largoReal > 0) {
    mlSilicona += (cantP - 1) * largoReal;
  }

  // 2. Solapes: 2 cordones × ancho útil × cantidad de paneles solapados
  const au = panel?.au ?? 1;
  mlSilicona += 2 * au * cantP;

  // 3. Encuentros con muros (babetas): ml × 2 cuando hay babeta_adosar o babeta_empotrar
  const em = edgeML && typeof edgeML === "object" ? edgeML : null;
  const dimFrente = em && Number.isFinite(em.frente) ? em.frente : anchoTotal;
  const dimFondo = em && Number.isFinite(em.fondo) ? em.fondo : anchoTotal;
  const dimLatIzq = em && Number.isFinite(em.latIzq) ? em.latIzq : largoReal;
  const dimLatDer = em && Number.isFinite(em.latDer) ? em.latDer : largoReal;

  const BABETAS = ["babeta_adosar", "babeta_empotrar"];
  let mlBabetas = 0;
  if (borders.frente && BABETAS.includes(borders.frente)) mlBabetas += dimFrente;
  if (borders.fondo && BABETAS.includes(borders.fondo)) mlBabetas += dimFondo;
  if (borders.latIzq && BABETAS.includes(borders.latIzq)) mlBabetas += dimLatIzq;
  if (borders.latDer && BABETAS.includes(borders.latDer)) mlBabetas += dimLatDer;
  mlSilicona += mlBabetas * 2;

  // 4. Canalones: 2 cordones entre empalmes (~60 cm por extensión)
  if (borders.frente === "canalon" && dimFrente > 0) {
    const canData = resolveSKU_techo("canalon", familiaP, espesor);
    const largoCan = canData?.largo ?? 3.03;
    const pzasCan = Math.ceil(dimFrente / largoCan);
    if (pzasCan > 1) {
      const empalmeMl = getDimensioningParam("PERFILERIA.canalon_empalme_silicona_ml", 0.6);
      mlSilicona += (pzasCan - 1) * empalmeMl * 2; // 2 cordones por empalme
    }
  }

  const c = (x) => (x?.costo ?? 0);
  const siliconas = Math.ceil(mlSilicona / ML_POR_UNID_SILICONA);
  const puSil = p(SELLADORES.silicona);
  items.push({ label: SELLADORES.silicona.label, sku: "silicona", cant: siliconas, unidad: "unid", pu: puSil, costo: c(SELLADORES.silicona), total: +(siliconas * puSil).toFixed(2) });

  const panelesPorRollo = getDimensioningParam("SELLADORES_TECHO.cinta_paneles_por_rollo", 10);
  const cintas = Math.ceil(cantP / panelesPorRollo);
  const puCinta = p(SELLADORES.cinta_butilo);
  items.push({ label: SELLADORES.cinta_butilo.label, sku: "cinta_butilo", cant: cintas, unidad: "unid", pu: puCinta, costo: c(SELLADORES.cinta_butilo), total: +(cintas * puCinta).toFixed(2) });

  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2) };
}

/**
 * BOM comercial ISODEC PIR (alineado a presupuestos manuales típicos):
 * 2 goteros frontales + 6 babetas empotrar 3 m + T1 según ML de perfilería.
 * No usa bordes perimetrales (goteros/babetas por lado).
 */
export function calcPerfileriaTechoComercial(familiaP, espesor) {
  const items = [];
  const gf = resolveSKU_techo("gotero_frontal", familiaP, espesor);
  const bb = resolveSKU_techo("babeta_empotrar", familiaP, espesor);
  if (!gf || !bb) return { items: [], total: 0, totalML: 0 };
  const { FIJACIONES } = getPricing();
  const cantG = 2;
  const cantB = 6;
  const puG = p(gf);
  const puB = p(bb);
  items.push({
    label: "Gotero frontal (BOM comercial)",
    sku: gf.sku,
    tipo: "gotero_frontal",
    cant: cantG,
    unidad: "unid",
    pu: puG,
    costo: gf.costo ?? 0,
    total: +(cantG * puG).toFixed(2),
    ml: +(cantG * gf.largo).toFixed(2),
    largoBarra: gf.largo,
  });
  items.push({
    label: "Babeta empotrar (BOM comercial)",
    sku: bb.sku,
    tipo: "babeta_empotrar",
    cant: cantB,
    unidad: "unid",
    pu: puB,
    costo: bb.costo ?? 0,
    total: +(cantB * puB).toFixed(2),
    ml: +(cantB * bb.largo).toFixed(2),
    largoBarra: bb.largo,
  });
  const totalML = cantG * gf.largo + cantB * bb.largo;
  const espFijMl = getDimensioningParam("PERFILERIA.espaciado_fijacion_ml", 0.30);
  const fijPerf = Math.ceil(totalML / espFijMl);
  const puT1 = p(FIJACIONES.tornillo_t1);
  const coT1 = FIJACIONES.tornillo_t1?.costo ?? 0;
  items.push({
    label: `${FIJACIONES.tornillo_t1.label} (perfilería comercial)`,
    sku: "tornillo_t1",
    tipo: "fijacion_perfileria",
    cant: fijPerf,
    unidad: "unid",
    pu: puT1,
    costo: coT1,
    total: +(fijPerf * puT1).toFixed(2),
  });
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2), totalML: +totalML.toFixed(2) };
}

/**
 * Kit selladores comercial: silicona + membrana + espuma PU (cantidades por dimensionamiento).
 */
export function calcSelladoresTechoComercial() {
  const { SELLADORES } = getPricing();
  const c = (x) => (x?.costo ?? 0);
  const nSil = getDimensioningParam("SELLADORES_TECHO.comercial_siliconas", 4);
  const nMem = getDimensioningParam("SELLADORES_TECHO.comercial_membranas", 2);
  const nEsp = getDimensioningParam("SELLADORES_TECHO.comercial_espumas", 4);
  const items = [];
  const puSi = p(SELLADORES.silicona);
  items.push({
    label: `${SELLADORES.silicona.label} (kit comercial)`,
    sku: "silicona",
    cant: nSil,
    unidad: "unid",
    pu: puSi,
    costo: c(SELLADORES.silicona),
    total: +(nSil * puSi).toFixed(2),
  });
  const puMe = p(SELLADORES.membrana);
  items.push({
    label: `${SELLADORES.membrana.label} (kit comercial)`,
    sku: "membrana",
    cant: nMem,
    unidad: "unid",
    pu: puMe,
    costo: c(SELLADORES.membrana),
    total: +(nMem * puMe).toFixed(2),
  });
  const puEs = p(SELLADORES.espuma_pu);
  items.push({
    label: `${SELLADORES.espuma_pu.label} (kit comercial)`,
    sku: "espuma_pu",
    cant: nEsp,
    unidad: "unid",
    pu: puEs,
    costo: c(SELLADORES.espuma_pu),
    total: +(nEsp * puEs).toFixed(2),
  });
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2) };
}

export function calcTotalesSinIVA(allItems) {
  const ivaRate = getIVA();
  const sumSinIVA = allItems.reduce((s, i) => s + (i.total || 0), 0);
  const subtotalSinIVA = +sumSinIVA.toFixed(2);
  const iva = +(subtotalSinIVA * ivaRate).toFixed(2);
  const totalConIVA = +(subtotalSinIVA + iva).toFixed(2);
  return { subtotalSinIVA, iva, totalFinal: totalConIVA };
}

export function calcTechoCompleto(inputs) {
  const { PANELS_TECHO } = getPricing();
  const { familia, espesor, largo, ancho, tipoEst, ptsHorm, ptsMetal, ptsMadera, borders, opciones, color, pendiente = 0, pendienteModo = "calcular_pendiente", alturaDif = 0 } = inputs;
  const panel = PANELS_TECHO[familia];
  if (!panel) return { error: `Familia "${familia}" no encontrada` };
  const espData = panel.esp[espesor];
  if (!espData) return { error: `Espesor ${espesor}mm no disponible` };
  const warnings = [];

  const largoReal = calcLargoRealFromModo(largo, pendienteModo, pendiente, alturaDif);
  const factorPend = calcFactorPendiente(pendiente);

  if (color) {
    if (!panel.col.includes(color)) warnings.push(`Color "${color}" no disponible para ${familia}`);
    if (panel.colMax && panel.colMax[color] && espesor > panel.colMax[color]) warnings.push(`Color ${color} solo hasta ${panel.colMax[color]}mm`);
  }
  if (largoReal > panel.lmax) warnings.push(`Largo real ${largoReal}m (con pendiente ${pendiente}°) excede máximo fabricable ${panel.lmax}m`);
  if (largoReal < panel.lmin) warnings.push(`Largo real ${largoReal}m (con pendiente ${pendiente}°) < mínimo ${panel.lmin}m`);

  const paneles = calcPanelesTecho(panel, espesor, largoReal, ancho);
  if (!paneles) return { error: "Error calculando paneles" };
  if (color && panel.colMinArea && panel.colMinArea[color] && paneles.areaTotal < panel.colMinArea[color]) {
    warnings.push(`Color ${color} requiere mín. ${panel.colMinArea[color]} m² (cotizado: ${paneles.areaTotal.toFixed(1)} m²)`);
  }
  const autoportancia = calcAutoportancia(panel, espesor, largo);
  if (!autoportancia.ok) warnings.push(`Largo ${largo}m excede autoportancia máx ${autoportancia.maxSpan}m. Requiere ${autoportancia.apoyos} apoyos.`);
  if (autoportancia.ok && autoportancia.maxSpan != null) {
    const headroom = (autoportancia.maxSpan - largo) / autoportancia.maxSpan;
    if (headroom >= 0 && headroom < 0.05) {
      warnings.push(`Largo ${largo}m está dentro del 5% de la autoportancia máx (${autoportancia.maxSpan}m). Superar ese límite requeriría ${autoportancia.apoyos + 1} apoyos y aumentaría la fijación considerablemente.`);
    }
  }

  const bomComercial = opciones?.bomComercial === true && familia === "ISODEC_PIR" && panel.sist === "varilla_tuerca";
  if (bomComercial) {
    warnings.push("BOM comercial ISODEC PIR: 2 goteros + 6 babetas + kit selladores + puntos fijación fijos (ajustable en dimensionamiento). Ignora bordes perimetrales para accesorios.");
  }

  let fijaciones;
  if (panel.sist === "varilla_tuerca") {
    const ptsComercial = bomComercial ? getDimensioningParam("FIJACIONES_VARILLA.puntos_comercial_default", 22) : null;
    const fijOpts = ptsComercial != null ? { overridePuntosFijacion: ptsComercial } : {};
    fijaciones = calcFijacionesVarilla(paneles.cantPaneles, autoportancia.apoyos || 2, largoReal, tipoEst || "metal", ptsHorm || 0, ptsMetal || 0, ptsMadera || 0, fijOpts);
  } else {
    fijaciones = calcFijacionesCaballete(paneles.cantPaneles, largoReal);
  }

  let perfileria;
  if (bomComercial) {
    perfileria = calcPerfileriaTechoComercial(panel.fam, espesor);
  } else {
    perfileria = calcPerfileriaTecho(borders || { frente: "none", fondo: "none", latIzq: "none", latDer: "none" }, paneles.cantPaneles, largoReal, paneles.anchoTotal, panel.fam, espesor, opciones || {});
  }

  let selladores = { items: [], total: 0 };
  if (!opciones || opciones.inclSell !== false) {
    selladores = bomComercial
      ? calcSelladoresTechoComercial()
      : calcSelladoresTecho(paneles.cantPaneles, {
          panel,
          borders: borders || {},
          anchoTotal: paneles.anchoTotal,
          largoReal,
          familiaP: panel.fam,
          espesor,
          edgeML: opciones?.edgeML,
        });
  }
  const costoM2 = espData.costo ?? 0;
  const panelItem = { label: panel.label + ` ${espesor}mm`, sku: `${familia}-${espesor}`, cant: paneles.areaTotal, unidad: "m²", pu: paneles.precioM2, costo: costoM2, total: paneles.costoPaneles, cantPaneles: paneles.cantPaneles, largoPanel: largoReal };
  const allItems = [panelItem, ...fijaciones.items, ...perfileria.items, ...selladores.items];
  const totales = calcTotalesSinIVA(allItems);

  const pendienteInfo = largoReal !== largo ? {
    pendienteGrados: pendiente,
    factorPendiente: factorPend,
    pendienteModo,
    largoProyectado: largo,
    largoReal,
    incrementoPct: largo > 0 ? +(((largoReal / largo) - 1) * 100).toFixed(1) : 0,
    alturaDif: pendienteModo === "calcular_altura" ? alturaDif : undefined,
  } : null;

  return { paneles, autoportancia, fijaciones, perfileria, selladores, totales, warnings, allItems, pendienteInfo };
}

// ── §1b MULTI-ZONE MERGE ──────────────────────────────────────────────────────

export function mergeZonaResults(zonaResults) {
  if (!zonaResults.length) return null;
  if (zonaResults.length === 1) return zonaResults[0];

  const combined = JSON.parse(JSON.stringify(zonaResults[0]));

  for (let i = 1; i < zonaResults.length; i++) {
    const r = zonaResults[i];

    if (r.paneles) {
      combined.paneles.cantPaneles += r.paneles.cantPaneles;
      combined.paneles.areaTotal = +(combined.paneles.areaTotal + r.paneles.areaTotal).toFixed(2);
      combined.paneles.anchoTotal = +((combined.paneles.anchoTotal || 0) + (r.paneles.anchoTotal || 0)).toFixed(2);
      combined.paneles.costoPaneles = +(combined.paneles.costoPaneles + r.paneles.costoPaneles).toFixed(2);
      if (combined.paneles.descarte && r.paneles.descarte) {
        combined.paneles.descarte.areaM2 = +(combined.paneles.descarte.areaM2 + r.paneles.descarte.areaM2).toFixed(2);
        combined.paneles.descarte.anchoM = +(combined.paneles.descarte.anchoM + r.paneles.descarte.anchoM).toFixed(2);
        const anchoSolicitadoTotal = +(combined.paneles.anchoTotal - combined.paneles.descarte.anchoM).toFixed(2);
        combined.paneles.descarte.porcentaje = anchoSolicitadoTotal > 0
          ? +((combined.paneles.descarte.anchoM / anchoSolicitadoTotal) * 100).toFixed(1)
          : 0;
      }
    }

    const mergeItemsBySku = (target, source) => {
      source.forEach(item => {
        const existing = target.find(ci => ci.sku === item.sku);
        if (existing) {
          existing.cant += item.cant;
          existing.total = +(existing.total + item.total).toFixed(2);
        } else {
          target.push({ ...item });
        }
      });
    };

    if (r.fijaciones) {
      mergeItemsBySku(combined.fijaciones.items, r.fijaciones.items);
      combined.fijaciones.total = +(combined.fijaciones.total + r.fijaciones.total).toFixed(2);
      if (r.fijaciones.puntosFijacion) {
        combined.fijaciones.puntosFijacion = (combined.fijaciones.puntosFijacion || 0) + r.fijaciones.puntosFijacion;
      }
    }

    if (r.perfileria) {
      mergeItemsBySku(combined.perfileria.items, r.perfileria.items);
      combined.perfileria.total = +(combined.perfileria.total + r.perfileria.total).toFixed(2);
      combined.perfileria.totalML = +((combined.perfileria.totalML || 0) + (r.perfileria.totalML || 0)).toFixed(2);
    }

    if (r.selladores) {
      mergeItemsBySku(combined.selladores.items, r.selladores.items);
      combined.selladores.total = +(combined.selladores.total + r.selladores.total).toFixed(2);
    }

    combined.warnings = [...(combined.warnings || []), ...(r.warnings || [])];
  }

  const panelItem = {
    ...combined.allItems[0],
    cant: combined.paneles.areaTotal,
    total: combined.paneles.costoPaneles,
    cantPaneles: combined.paneles.cantPaneles,
    largoPanel: zonaResults.length === 1 ? zonaResults[0].allItems[0]?.largoPanel : undefined,
  };
  combined.allItems = [panelItem, ...combined.fijaciones.items, ...combined.perfileria.items, ...combined.selladores.items];
  combined.totales = calcTotalesSinIVA(combined.allItems);

  return combined;
}

// ── §2 ENGINE PARED ──────────────────────────────────────────────────────────

export function resolvePerfilPared(tipo, familia, espesor) {
  const { PERFIL_PARED } = getPricing();
  const byTipo = PERFIL_PARED[tipo];
  if (!byTipo) return null;
  const byFam = byTipo[familia];
  if (byFam) {
    if (byFam[espesor]) return { ...byFam[espesor] };
    if (byFam._all) return { ...byFam._all };
  }
  if (byTipo._all) return { ...byTipo._all };
  return null;
}

export function calcPanelesPared(panel, espesor, alto, perimetro, aberturas) {
  const espData = panel.esp[espesor];
  if (!espData) return null;
  const cantPaneles = Math.ceil(perimetro / panel.au);
  const areaBruta = +(cantPaneles * alto * panel.au).toFixed(2);
  let areaAberturas = 0;
  if (aberturas && aberturas.length > 0) {
    for (const ab of aberturas) {
      const w = Number(ab.ancho) || 0;
      const h = Number(ab.alto) || 0;
      areaAberturas += w * h * (ab.cant || 1);
    }
  }
  areaAberturas = +areaAberturas.toFixed(2);
  const areaNeta = +Math.max(areaBruta - areaAberturas, 0).toFixed(2);
  const precioM2 = p(espData);
  const costoPaneles = +(precioM2 * areaNeta).toFixed(2);
  return { cantPaneles, areaBruta, areaAberturas, areaNeta, costoPaneles, precioM2 };
}

export function calcPerfilesU(panel, espesor, perimetro) {
  const perfData = resolvePerfilPared("perfil_u", panel.fam, espesor);
  if (!perfData) return { items: [], total: 0 };
  const precio = p(perfData);
  const pzas = Math.ceil(perimetro / perfData.largo);
  const items = [];
  const costoUn = perfData.costo ?? 0;
  items.push({ label: "Perfil U base " + espesor + "mm", sku: perfData.sku, cant: pzas, unidad: "unid", pu: precio, costo: costoUn, total: +(pzas * precio).toFixed(2), largoBarra: perfData.largo });
  items.push({ label: "Perfil U coronación " + espesor + "mm", sku: perfData.sku, cant: pzas, unidad: "unid", pu: precio, costo: costoUn, total: +(pzas * precio).toFixed(2), largoBarra: perfData.largo });
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2) };
}

export function calcEsquineros(alto, numExt, numInt) {
  const items = [];
  const pExt = resolvePerfilPared("esquinero_ext", null, null);
  const pInt = resolvePerfilPared("esquinero_int", null, null);
  if (pExt && numExt > 0) {
    const pzas = Math.ceil(alto / pExt.largo) * numExt;
    const precio = p(pExt);
    items.push({ label: pExt.label, sku: pExt.sku, cant: pzas, unidad: "unid", pu: precio, costo: pExt.costo ?? 0, total: +(pzas * precio).toFixed(2), largoBarra: pExt.largo });
  }
  if (pInt && numInt > 0) {
    const pzas = Math.ceil(alto / pInt.largo) * numInt;
    const precio = p(pInt);
    items.push({ label: pInt.label, sku: pInt.sku, cant: pzas, unidad: "unid", pu: precio, costo: pInt.costo ?? 0, total: +(pzas * precio).toFixed(2), largoBarra: pInt.largo });
  }
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2) };
}

// §B REESCRITO: Fijaciones de pared — NO usa varilla/tuerca/arandela/tortuga
export function calcFijacionesPared(panel, espesor, cantP, alto, perimetro, tipoEst) {
  const { FIJACIONES } = getPricing();
  const items = [];
  const anchoTotal = cantP * panel.au;
  const c = (x) => (x?.costo ?? 0);
  const espAnclaje = getDimensioningParam("FIJACIONES_PARED.anclaje_espaciado", 0.30);
  const anclajes = Math.ceil(anchoTotal / espAnclaje);
  const puAnc = p(FIJACIONES.anclaje_h);
  items.push({ label: FIJACIONES.anclaje_h.label, sku: "anclaje_h", cant: anclajes, unidad: "unid", pu: puAnc, costo: c(FIJACIONES.anclaje_h), total: +(anclajes * puAnc).toFixed(2) });
  if (tipoEst === "metal" || tipoEst === "mixto" || tipoEst === "combinada" || tipoEst === "madera") {
    const areaNeta = cantP * alto * panel.au;
    const tornillosPorM2 = getDimensioningParam("FIJACIONES_PARED.tornillo_t2_por_m2", 5.5);
    const tornillosT2 = Math.ceil(areaNeta * tornillosPorM2);
    const puT2 = p(FIJACIONES.tornillo_t2);
    const cuT2 = c(FIJACIONES.tornillo_t2);
    items.push({ label: FIJACIONES.tornillo_t2.label, sku: "tornillo_t2", cant: tornillosT2, unidad: "unid", pu: puT2, costo: cuT2, total: +(tornillosT2 * puT2).toFixed(2) });
  }
  const remachesPorPanel = getDimensioningParam("FIJACIONES_PARED.remaches_por_panel", 2);
  const remaches = Math.ceil(cantP * remachesPorPanel);
  if (remaches > 0) {
    const puRem = p(FIJACIONES.remache_pop);
    items.push({ label: FIJACIONES.remache_pop.label, sku: "remache_pop", cant: remaches, unidad: "unid", pu: puRem, costo: c(FIJACIONES.remache_pop), total: +(remaches * puRem).toFixed(2) });
  }
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2) };
}

// §C NUEVOS PERFILES: K2, G2, 5852
export function calcPerfilesParedExtra(panel, espesor, cantP, alto, opts) {
  const { PERFIL_PARED } = getPricing();
  const items = [];
  // Perfil K2 — junta interior entre paneles
  const k2Data = PERFIL_PARED.perfil_k2._all;
  if (cantP > 1) {
    const juntasK2 = (cantP - 1) * Math.ceil(alto / k2Data.largo);
    const puK2 = p(k2Data);
    items.push({ label: k2Data.label, sku: k2Data.sku, cant: juntasK2, unidad: "unid", pu: puK2, costo: k2Data.costo ?? 0, total: +(juntasK2 * puK2).toFixed(2), largoBarra: k2Data.largo });
  }
  const g2Data = resolvePerfilPared("perfil_g2", panel.fam, espesor);
  if (g2Data && cantP > 1) {
    const juntasG2 = (cantP - 1) * Math.ceil(alto / g2Data.largo);
    const puG2 = p(g2Data);
    items.push({ label: "Perfil G2 tapajunta", sku: g2Data.sku, cant: juntasG2, unidad: "unid", pu: puG2, costo: g2Data.costo ?? 0, total: +(juntasG2 * puG2).toFixed(2), largoBarra: g2Data.largo });
  }
  if (opts && opts.incl5852) {
    const d5852 = PERFIL_PARED.perfil_5852._all;
    const anchoTotal = cantP * panel.au;
    const cant5852 = Math.ceil(anchoTotal / d5852.largo) * (opts.apoyo5852doble ? 2 : 1);
    const pu5852 = p(d5852);
    items.push({ label: d5852.label, sku: d5852.sku, cant: cant5852, unidad: "unid", pu: pu5852, costo: d5852.costo ?? 0, total: +(cant5852 * pu5852).toFixed(2), largoBarra: d5852.largo });
  }
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2) };
}

// §D SELLADORES PARED: silicona + (opc.) cinta butilo + membrana + espuma PU + (opc.) silicona 300 ml
export function calcSelladorPared(perimetro, cantPaneles, alto, opts = {}) {
  const { SELLADORES } = getPricing();
  const items = [];
  const inclCintaButilo = opts.inclCintaButilo === true;
  const inclSil300 = opts.inclSilicona300Neutra === true;
  const juntasV = cantPaneles - 1;
  const mlJuntas = +(juntasV * alto + perimetro * 2).toFixed(2);
  const c = (x) => (x?.costo ?? 0);
  const silMlUnid = getDimensioningParam("SELLADORES_PARED.silicona_ml_por_unid", 8);
  const siliconas = Math.ceil(mlJuntas / silMlUnid);
  const puSil = p(SELLADORES.silicona);
  items.push({ label: SELLADORES.silicona.label, sku: "silicona", cant: siliconas, unidad: "unid", pu: puSil, costo: c(SELLADORES.silicona), total: +(siliconas * puSil).toFixed(2) });
  if (inclSil300 && SELLADORES.silicona_300_neutra) {
    const sil3 = SELLADORES.silicona_300_neutra;
    const mPorUnid = Number(sil3.metros_cobertura_por_unid) > 0 ? Number(sil3.metros_cobertura_por_unid) : 8;
    const cant3 = Math.ceil(mlJuntas / mPorUnid);
    const pu3 = p(sil3);
    items.push({ label: sil3.label, sku: "silicona_300_neutra", cant: cant3, unidad: "unid", pu: pu3, costo: c(sil3), total: +(cant3 * pu3).toFixed(2) });
  }
  if (inclCintaButilo) {
    const cintaMlRollo = getDimensioningParam("SELLADORES_PARED.cinta_ml_por_rollo", 22.5);
    const cintas = Math.ceil(mlJuntas / cintaMlRollo);
    const puCinta = p(SELLADORES.cinta_butilo);
    items.push({ label: SELLADORES.cinta_butilo.label, sku: "cinta_butilo", cant: cintas, unidad: "unid", pu: puCinta, costo: c(SELLADORES.cinta_butilo), total: +(cintas * puCinta).toFixed(2) });
  }
  const mlMembrana = perimetro;
  const membranaMlRollo = getDimensioningParam("SELLADORES_PARED.membrana_ml_por_rollo", 10);
  const rollosMembrana = Math.ceil(mlMembrana / membranaMlRollo);
  const puMem = p(SELLADORES.membrana);
  items.push({ label: SELLADORES.membrana.label, sku: "membrana", cant: rollosMembrana, unidad: "rollo", pu: puMem, costo: c(SELLADORES.membrana), total: +(rollosMembrana * puMem).toFixed(2) });
  const espumasPorRollo = getDimensioningParam("SELLADORES_PARED.espumas_por_rollo_membrana", 2);
  const espumas = rollosMembrana * espumasPorRollo;
  const puEsp = p(SELLADORES.espuma_pu);
  items.push({ label: SELLADORES.espuma_pu.label, sku: "espuma_pu", cant: espumas, unidad: "unid", pu: puEsp, costo: c(SELLADORES.espuma_pu), total: +(espumas * puEsp).toFixed(2) });
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2), mlJuntas };
}

export function calcParedCompleto(inputs) {
  const { PANELS_PARED } = getPricing();
  const { familia, espesor, alto, perimetro, numEsqExt, numEsqInt, aberturas, tipoEst, inclSell, incl5852, color, inclCintaButilo = false, inclSilicona300Neutra = false } = inputs;
  const panel = PANELS_PARED[familia];
  if (!panel) return { error: `Familia "${familia}" no encontrada` };
  const espData = panel.esp[espesor];
  if (!espData) return { error: `Espesor ${espesor}mm no disponible` };
  const warnings = [];
  if (familia === "ISOPANEL_EPS" && espesor === 50) warnings.push("50mm solo para subdivisiones interiores.");
  if (alto > panel.lmax) warnings.push(`Alto ${alto}m > máximo ${panel.lmax}m`);
  if (alto < panel.lmin) warnings.push(`Alto ${alto}m < mínimo ${panel.lmin}m`);
  if ((numEsqExt || 0) === 0) warnings.push("Sin esquinas exteriores — verificar geometría");
  if (color && !panel.col.includes(color)) warnings.push(`Color "${color}" no disponible`);
  const paneles = calcPanelesPared(panel, espesor, alto, perimetro, aberturas || []);
  if (!paneles) return { error: "Error calculando paneles" };
  const perfilesU = calcPerfilesU(panel, espesor, perimetro);
  const esquineros = calcEsquineros(alto, numEsqExt || 0, numEsqInt || 0);
  const fijaciones = calcFijacionesPared(panel, espesor, paneles.cantPaneles, alto, perimetro, tipoEst || "metal");
  const perfilesExtra = calcPerfilesParedExtra(panel, espesor, paneles.cantPaneles, alto, { incl5852 });
  let sellador = { items: [], total: 0 };
  if (inclSell !== false) sellador = calcSelladorPared(perimetro, paneles.cantPaneles, alto, { inclCintaButilo, inclSilicona300Neutra });
  const panelItem = { label: panel.label + ` ${espesor}mm`, sku: `${familia}-${espesor}`, cant: paneles.areaNeta, unidad: "m²", pu: paneles.precioM2, costo: espData.costo ?? 0, total: paneles.costoPaneles, cantPaneles: paneles.cantPaneles, largoPanel: alto };
  const allItems = [panelItem, ...perfilesU.items, ...esquineros.items, ...perfilesExtra.items, ...fijaciones.items, ...sellador.items];
  const totales = calcTotalesSinIVA(allItems);
  return { paneles, perfilesU, esquineros, perfilesExtra, fijaciones, sellador, totales, warnings, allItems };
}

/**
 * Presupuesto libre: líneas manuales desde FIJACIONES / HERRAMIENTAS.
 * `lineas`: [{ bucket?: "FIJACIONES"|"HERRAMIENTAS", id: string, cant: number }]
 */
export function calcPresupuestoLibre(lineas = []) {
  const pricing = getPricing();
  const c = (x) => (x?.costo ?? 0);
  const items = [];
  for (const row of lineas) {
    if (!row || row.id == null || row.cant == null || Number(row.cant) <= 0) continue;
    const bucket = row.bucket === "HERRAMIENTAS" ? "HERRAMIENTAS" : "FIJACIONES";
    const data = bucket === "HERRAMIENTAS" ? pricing.HERRAMIENTAS?.[row.id] : pricing.FIJACIONES?.[row.id];
    if (!data) continue;
    const pu = p(data);
    const co = c(data);
    const cant = Number(row.cant);
    items.push({
      label: data.label,
      sku: row.id,
      cant,
      unidad: data.unidad || "unid",
      pu,
      costo: co,
      total: +(cant * pu).toFixed(2),
    });
  }
  const sub = items.reduce((s, i) => s + i.total, 0);
  const totales = calcTotalesSinIVA(items);
  return {
    presupuestoLibre: true,
    allItems: items,
    fijaciones: { items, total: +sub.toFixed(2) },
    totales,
    warnings: [],
  };
}
