// ═══════════════════════════════════════════════════════════════════════════
// src/utils/calculations.js — Pure calculation functions for BMC calculator
// ═══════════════════════════════════════════════════════════════════════════

import {
  p, IVA,
  PANELS_TECHO, PANELS_PARED, FIJACIONES, SELLADORES, PERFIL_TECHO,
  PERFIL_PARED,
} from "../data/constants.js";

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
  const byTipo = PERFIL_TECHO[tipo];
  if (!byTipo) return null;
  const byFam = byTipo[familiaP];
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

export function calcFijacionesVarilla(cantP, apoyos, largo, tipoEst, ptsHorm) {
  const puntosFijacion = Math.ceil(((cantP * apoyos) * 2) + (largo * 2 / 2.5));
  const varillas = Math.ceil(puntosFijacion / 4);
  let pMetal, pH;
  if (tipoEst === "metal") { pMetal = puntosFijacion; pH = 0; }
  else if (tipoEst === "hormigon") { pMetal = 0; pH = puntosFijacion; }
  else { pH = Math.min(ptsHorm || 0, puntosFijacion); pMetal = puntosFijacion - pH; }
  const tuercas = (pMetal * 2) + (pH * 1);
  const tacos = pH;
  const items = [];
  const puVar = p(FIJACIONES.varilla_38);
  items.push({ label: FIJACIONES.varilla_38.label, sku: "varilla_38", cant: varillas, unidad: "unid", pu: puVar, total: +(varillas * puVar).toFixed(2) });
  const puTuer = p(FIJACIONES.tuerca_38);
  items.push({ label: FIJACIONES.tuerca_38.label, sku: "tuerca_38", cant: tuercas, unidad: "unid", pu: puTuer, total: +(tuercas * puTuer).toFixed(2) });
  if (tacos > 0) {
    const puTaco = p(FIJACIONES.taco_expansivo);
    items.push({ label: FIJACIONES.taco_expansivo.label, sku: "taco_expansivo", cant: tacos, unidad: "unid", pu: puTaco, total: +(tacos * puTaco).toFixed(2) });
  }
  const puArand = p(FIJACIONES.arandela_carrocero);
  items.push({ label: FIJACIONES.arandela_carrocero.label, sku: "arandela_carrocero", cant: puntosFijacion, unidad: "unid", pu: puArand, total: +(puntosFijacion * puArand).toFixed(2) });
  const puPP = p(FIJACIONES.arandela_pp);
  items.push({ label: FIJACIONES.arandela_pp.label, sku: "arandela_pp", cant: puntosFijacion, unidad: "unid", pu: puPP, total: +(puntosFijacion * puPP).toFixed(2) });
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2), puntosFijacion };
}

export function calcFijacionesCaballete(cantP, largo) {
  const caballetes = Math.ceil((cantP * 3 * (largo / 2.9 + 1)) + ((largo * 2) / 0.3));
  const tornillosAguja = caballetes * 2;
  const items = [];
  const puCab = p(FIJACIONES.caballete);
  items.push({ label: FIJACIONES.caballete.label, sku: "caballete", cant: caballetes, unidad: "unid", pu: puCab, total: +(caballetes * puCab).toFixed(2) });
  const paquetesAguja = Math.ceil(tornillosAguja / 100);
  const puAguja = p(FIJACIONES.tornillo_aguja);
  items.push({ label: FIJACIONES.tornillo_aguja.label, sku: "tornillo_aguja", cant: paquetesAguja, unidad: "x100", pu: puAguja, total: +(paquetesAguja * puAguja).toFixed(2) });
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
    const pzas = Math.ceil(dim / resolved.largo);
    const ml = pzas * resolved.largo;
    totalML += ml;
    items.push({ label, sku: resolved.sku, tipo, cant: pzas, unidad: "unid", pu: precio, total: +(pzas * precio).toFixed(2), ml: +ml.toFixed(2) });
  };

  // Canalón en frente: agregar canalón + soporte automáticamente
  if (borders.frente === "canalon") {
    const canData = resolveSKU_techo("canalon", familiaP, espesor);
    if (canData) {
      const precioCan = p(canData);
      const pzasCan = Math.ceil(anchoTotal / canData.largo);
      totalML += pzasCan * canData.largo;
      items.push({ label: "Frente Inf: Canalón", sku: canData.sku, tipo: "canalon", cant: pzasCan, unidad: "unid", pu: precioCan, total: +(pzasCan * precioCan).toFixed(2) });
    }
    // Soporte canalón: (cantPaneles + 1) * 0.30 / largo_barra
    const sopData = resolveSKU_techo("soporte_canalon", familiaP, espesor);
    if (sopData) {
      const mlSoportes = (cantP + 1) * 0.30;
      const barrasSoporte = Math.ceil(mlSoportes / sopData.largo);
      const precioSop = p(sopData);
      items.push({ label: "Soporte canalón", sku: sopData.sku, tipo: "soporte_canalon", cant: barrasSoporte, unidad: "unid", pu: precioSop, total: +(barrasSoporte * precioSop).toFixed(2) });
    }
  } else if (borders.frente && borders.frente !== "none") {
    addPerfil("Frente Inf: " + borders.frente, borders.frente, anchoTotal);
  }

  if (borders.fondo && borders.fondo !== "none") addPerfil("Frente Sup: " + borders.fondo, borders.fondo, anchoTotal);
  if (borders.latIzq && borders.latIzq !== "none") addPerfil("Lat.Izq: " + borders.latIzq, borders.latIzq, largo);
  if (borders.latDer && borders.latDer !== "none") addPerfil("Lat.Der: " + borders.latDer, borders.latDer, largo);

  if (opciones && opciones.inclGotSup) {
    const gs = resolveSKU_techo("gotero_superior", familiaP, espesor);
    if (gs) {
      const precio = p(gs);
      const pzas = Math.ceil(anchoTotal / gs.largo);
      totalML += pzas * gs.largo;
      items.push({ label: "Gotero superior", sku: gs.sku, tipo: "gotero_superior", cant: pzas, unidad: "unid", pu: precio, total: +(pzas * precio).toFixed(2) });
    }
  }

  if (totalML > 0) {
    const fijPerf = Math.ceil(totalML / 0.30);
    const paquetesT1 = Math.ceil(fijPerf / 100);
    const puT1 = p(FIJACIONES.tornillo_t1);
    items.push({ label: FIJACIONES.tornillo_t1.label, sku: "tornillo_t1", tipo: "fijacion_perfileria", cant: paquetesT1, unidad: "x100", pu: puT1, total: +(paquetesT1 * puT1).toFixed(2) });
  }
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2), totalML: +totalML.toFixed(2) };
}

export function calcSelladoresTecho(cantP) {
  const items = [];
  const siliconas = Math.ceil(cantP * 0.5);
  const puSil = p(SELLADORES.silicona);
  items.push({ label: SELLADORES.silicona.label, sku: "silicona", cant: siliconas, unidad: "unid", pu: puSil, total: +(siliconas * puSil).toFixed(2) });
  const cintas = Math.ceil(cantP / 10);
  const puCinta = p(SELLADORES.cinta_butilo);
  items.push({ label: SELLADORES.cinta_butilo.label, sku: "cinta_butilo", cant: cintas, unidad: "unid", pu: puCinta, total: +(cintas * puCinta).toFixed(2) });
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2) };
}

export function calcTotalesSinIVA(allItems) {
  const sumSinIVA = allItems.reduce((s, i) => s + (i.total || 0), 0);
  const subtotalSinIVA = +sumSinIVA.toFixed(2);
  const iva = +(subtotalSinIVA * IVA).toFixed(2);
  const totalConIVA = +(subtotalSinIVA + iva).toFixed(2);
  return { subtotalSinIVA, iva, totalFinal: totalConIVA };
}

export function calcTechoCompleto(inputs) {
  const { familia, espesor, largo, ancho, tipoEst, ptsHorm, borders, opciones, color, pendiente = 0 } = inputs;
  const panel = PANELS_TECHO[familia];
  if (!panel) return { error: `Familia "${familia}" no encontrada` };
  const espData = panel.esp[espesor];
  if (!espData) return { error: `Espesor ${espesor}mm no disponible` };
  const warnings = [];

  const factorPend = calcFactorPendiente(pendiente);
  const largoReal = +(largo * factorPend).toFixed(3);

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
  let fijaciones;
  if (panel.sist === "varilla_tuerca") {
    fijaciones = calcFijacionesVarilla(paneles.cantPaneles, autoportancia.apoyos || 2, largoReal, tipoEst || "metal", ptsHorm || 0);
  } else {
    fijaciones = calcFijacionesCaballete(paneles.cantPaneles, largoReal);
  }
  const perfileria = calcPerfileriaTecho(borders || { frente: "none", fondo: "none", latIzq: "none", latDer: "none" }, paneles.cantPaneles, largoReal, paneles.anchoTotal, panel.fam, espesor, opciones || {});
  let selladores = { items: [], total: 0 };
  if (!opciones || opciones.inclSell !== false) selladores = calcSelladoresTecho(paneles.cantPaneles);
  const panelItem = { label: panel.label + ` ${espesor}mm`, sku: `${familia}-${espesor}`, cant: paneles.areaTotal, unidad: "m²", pu: paneles.precioM2, total: paneles.costoPaneles };
  const allItems = [panelItem, ...fijaciones.items, ...perfileria.items, ...selladores.items];
  const totales = calcTotalesSinIVA(allItems);

  const pendienteInfo = pendiente > 0 ? {
    pendienteGrados: pendiente,
    factorPendiente: factorPend,
    largoProyectado: largo,
    largoReal,
    incrementoPct: +((factorPend - 1) * 100).toFixed(1),
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
  };
  combined.allItems = [panelItem, ...combined.fijaciones.items, ...combined.perfileria.items, ...combined.selladores.items];
  combined.totales = calcTotalesSinIVA(combined.allItems);

  return combined;
}

// ── §2 ENGINE PARED ──────────────────────────────────────────────────────────

export function resolvePerfilPared(tipo, familia, espesor) {
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
  items.push({ label: "Perfil U base " + espesor + "mm", sku: perfData.sku, cant: pzas, unidad: "unid", pu: precio, total: +(pzas * precio).toFixed(2) });
  items.push({ label: "Perfil U coronación " + espesor + "mm", sku: perfData.sku, cant: pzas, unidad: "unid", pu: precio, total: +(pzas * precio).toFixed(2) });
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
    items.push({ label: pExt.label, sku: pExt.sku, cant: pzas, unidad: "unid", pu: precio, total: +(pzas * precio).toFixed(2) });
  }
  if (pInt && numInt > 0) {
    const pzas = Math.ceil(alto / pInt.largo) * numInt;
    const precio = p(pInt);
    items.push({ label: pInt.label, sku: pInt.sku, cant: pzas, unidad: "unid", pu: precio, total: +(pzas * precio).toFixed(2) });
  }
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2) };
}

// §B REESCRITO: Fijaciones de pared — NO usa varilla/tuerca/arandela/tortuga
export function calcFijacionesPared(panel, espesor, cantP, alto, perimetro, tipoEst) {
  const items = [];
  const anchoTotal = cantP * panel.au;
  // 1. ANCLAJES A HORMIGÓN — kit cada 0.30m en perímetro inferior
  const anclajes = Math.ceil(anchoTotal / 0.30);
  const puAnc = p(FIJACIONES.anclaje_h);
  items.push({ label: FIJACIONES.anclaje_h.label, sku: "anclaje_h", cant: anclajes, unidad: "unid", pu: puAnc, total: +(anclajes * puAnc).toFixed(2) });
  // 2. TORNILLOS T2 para fijar paneles a estructura (~5.5/m² para metal)
  if (tipoEst === "metal" || tipoEst === "mixto") {
    const areaNeta = cantP * alto * panel.au;
    const tornillosT2 = Math.ceil(areaNeta * 5.5);
    const paquetes = Math.ceil(tornillosT2 / 100);
    const puT2 = p(FIJACIONES.tornillo_t2);
    items.push({ label: FIJACIONES.tornillo_t2.label, sku: "tornillo_t2", cant: paquetes, unidad: "x100", pu: puT2, total: +(paquetes * puT2).toFixed(2) });
  }
  // 3. REMACHES POP para uniones entre perfiles — ~2 por panel
  const remaches = Math.ceil(cantP * 2);
  const paquetesRem = Math.ceil(remaches / 1000);
  if (paquetesRem > 0) {
    const puRem = p(FIJACIONES.remache_pop);
    items.push({ label: FIJACIONES.remache_pop.label, sku: "remache_pop", cant: paquetesRem, unidad: "x1000", pu: puRem, total: +(paquetesRem * puRem).toFixed(2) });
  }
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2) };
}

// §C NUEVOS PERFILES: K2, G2, 5852
export function calcPerfilesParedExtra(panel, espesor, cantP, alto, opts) {
  const items = [];
  // Perfil K2 — junta interior entre paneles
  const k2Data = PERFIL_PARED.perfil_k2._all;
  if (cantP > 1) {
    const juntasK2 = (cantP - 1) * Math.ceil(alto / k2Data.largo);
    const puK2 = p(k2Data);
    items.push({ label: k2Data.label, sku: k2Data.sku, cant: juntasK2, unidad: "unid", pu: puK2, total: +(juntasK2 * puK2).toFixed(2) });
  }
  // Perfil G2 — tapajunta exterior: 1 por cada junta vertical entre paneles
  const g2Data = resolvePerfilPared("perfil_g2", panel.fam, espesor);
  if (g2Data && cantP > 1) {
    const juntasG2 = (cantP - 1) * Math.ceil(alto / g2Data.largo);
    const puG2 = p(g2Data);
    items.push({ label: "Perfil G2 tapajunta", sku: g2Data.sku, cant: juntasG2, unidad: "unid", pu: puG2, total: +(juntasG2 * puG2).toFixed(2) });
  }
  // Perfil 5852 aluminio — OPCIONAL
  if (opts && opts.incl5852) {
    const d5852 = PERFIL_PARED.perfil_5852._all;
    const anchoTotal = cantP * panel.au;
    const cant5852 = Math.ceil(anchoTotal / d5852.largo) * (opts.apoyo5852doble ? 2 : 1);
    const pu5852 = p(d5852);
    items.push({ label: d5852.label, sku: d5852.sku, cant: cant5852, unidad: "unid", pu: pu5852, total: +(cant5852 * pu5852).toFixed(2) });
  }
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2) };
}

// §D SELLADORES PARED: silicona + cinta butilo + membrana + espuma PU
export function calcSelladorPared(perimetro, cantPaneles, alto) {
  const items = [];
  const juntasV = cantPaneles - 1;
  const mlJuntas = +(juntasV * alto + perimetro * 2).toFixed(2);
  const siliconas = Math.ceil(mlJuntas / 8);
  const puSil = p(SELLADORES.silicona);
  items.push({ label: SELLADORES.silicona.label, sku: "silicona", cant: siliconas, unidad: "unid", pu: puSil, total: +(siliconas * puSil).toFixed(2) });
  const cintas = Math.ceil(mlJuntas / 22.5);
  const puCinta = p(SELLADORES.cinta_butilo);
  items.push({ label: SELLADORES.cinta_butilo.label, sku: "cinta_butilo", cant: cintas, unidad: "unid", pu: puCinta, total: +(cintas * puCinta).toFixed(2) });
  // Membrana autoadhesiva
  const mlMembrana = perimetro; // encuentros con muro
  const rollosMembrana = Math.ceil(mlMembrana / 10);
  const puMem = p(SELLADORES.membrana);
  items.push({ label: SELLADORES.membrana.label, sku: "membrana", cant: rollosMembrana, unidad: "rollo", pu: puMem, total: +(rollosMembrana * puMem).toFixed(2) });
  // Espuma PU: 2 por cada rollo de membrana
  const espumas = rollosMembrana * 2;
  const puEsp = p(SELLADORES.espuma_pu);
  items.push({ label: SELLADORES.espuma_pu.label, sku: "espuma_pu", cant: espumas, unidad: "unid", pu: puEsp, total: +(espumas * puEsp).toFixed(2) });
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2), mlJuntas };
}

export function calcParedCompleto(inputs) {
  const { familia, espesor, alto, perimetro, numEsqExt, numEsqInt, aberturas, tipoEst, inclSell, incl5852, color } = inputs;
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
  if (inclSell !== false) sellador = calcSelladorPared(perimetro, paneles.cantPaneles, alto);
  const panelItem = { label: panel.label + ` ${espesor}mm`, sku: `${familia}-${espesor}`, cant: paneles.areaNeta, unidad: "m²", pu: paneles.precioM2, total: paneles.costoPaneles };
  const allItems = [panelItem, ...perfilesU.items, ...esquineros.items, ...perfilesExtra.items, ...fijaciones.items, ...sellador.items];
  const totales = calcTotalesSinIVA(allItems);
  return { paneles, perfilesU, esquineros, perfilesExtra, fijaciones, sellador, totales, warnings, allItems };
}
