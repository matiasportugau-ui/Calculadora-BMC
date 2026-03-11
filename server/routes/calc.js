// ═══════════════════════════════════════════════════════════════════════════
// server/routes/calc.js — Calculator API for GPT Panelin Actions
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from "express";
import {
  calcTechoCompleto,
  calcParedCompleto,
  calcTotalesSinIVA,
  mergeZonaResults,
} from "../../src/utils/calculations.js";
import { bomToGroups, buildWhatsAppText, fmtPrice } from "../../src/utils/helpers.js";
import {
  setListaPrecios,
  PANELS_TECHO,
  PANELS_PARED,
  SCENARIOS_DEF,
  VIS,
  BORDER_OPTIONS,
  SERVICIOS,
  FIJACIONES,
  SELLADORES,
  p,
} from "../../src/data/constants.js";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveTechoForCamara(paredFamilia, paredEspesor) {
  const familia = paredFamilia in PANELS_TECHO ? paredFamilia : "ISODEC_EPS";
  const panel = PANELS_TECHO[familia];
  if (panel.esp[paredEspesor]) return { familia, espesor: paredEspesor, mapped: false };
  const available = Object.keys(panel.esp).map(Number).sort((a, b) => a - b);
  const espesor = available.find(e => e >= paredEspesor) || available[available.length - 1];
  return { familia, espesor, mapped: true, original: paredEspesor };
}

const SCENARIO_LABELS = {
  solo_techo: "Solo Techo",
  solo_fachada: "Solo Fachada",
  techo_fachada: "Techo + Fachada",
  camara_frig: "Cámara Frigorífica",
};

const LISTA_LABELS = { venta: "BMC Directo", web: "Web" };

function buildGptResponse(escenario, lista, results, flete) {
  if (!results || results.error) {
    return { ok: false, error: results?.error || "Sin resultados" };
  }

  let groups = bomToGroups(results);
  if (flete > 0) {
    groups.push({
      title: "SERVICIOS",
      items: [{ label: SERVICIOS.flete.label, sku: "FLETE", cant: 1, unidad: "servicio", pu: flete, total: flete }],
    });
  }

  const allItems = [];
  groups.forEach(g => g.items.forEach(i => allItems.push(i)));
  const totales = calcTotalesSinIVA(allItems);

  const bom = groups.map(g => {
    const subtotal = g.items.reduce((s, i) => s + (i.total || 0), 0);
    return {
      grupo: g.title,
      subtotal_usd: +subtotal.toFixed(2),
      items: g.items.map(i => ({
        descripcion: i.label,
        sku: i.sku || null,
        cant: i.cant,
        unidad: i.unidad,
        pu_usd: i.pu,
        total_usd: i.total,
      })),
    };
  });

  const resumen = {
    area_m2: results.paneles?.areaTotal ?? results.paneles?.areaNeta ?? 0,
    cant_paneles: results.paneles?.cantPaneles ?? 0,
    puntos_fijacion: results.fijaciones?.puntosFijacion ?? 0,
    subtotal_usd: totales.subtotalSinIVA,
    iva_usd: totales.iva,
    total_usd: totales.totalFinal,
  };

  const autoportancia = results.autoportancia
    ? { ok: results.autoportancia.ok, apoyos: results.autoportancia.apoyos, vano_max_m: results.autoportancia.maxSpan }
    : null;

  const descarte = results.paneles?.descarte?.areaM2 > 0
    ? { ancho_m: results.paneles.descarte.anchoM, area_m2: results.paneles.descarte.areaM2, porcentaje: results.paneles.descarte.porcentaje }
    : null;

  const panelLabel = allItems.find(i => i.unidad === "m²")?.label || "";
  const textoResumen = `Cotización ${panelLabel} — ${SCENARIO_LABELS[escenario]}. `
    + `Área: ${resumen.area_m2} m². Paneles: ${resumen.cant_paneles}. `
    + `Subtotal: USD ${fmtPrice(resumen.subtotal_usd)} + IVA 22%: USD ${fmtPrice(resumen.iva_usd)} = `
    + `TOTAL USD ${fmtPrice(resumen.total_usd)}.`;

  const textoWhatsapp = buildWhatsAppText({
    client: { nombre: "—", rut: "", telefono: "" },
    project: { fecha: new Date().toLocaleDateString("es-UY"), refInterna: "", descripcion: "" },
    scenario: escenario,
    panel: { label: panelLabel, espesor: "", color: "" },
    totals: totales,
    listaLabel: LISTA_LABELS[lista] || lista,
  });

  return {
    ok: true,
    meta: {
      escenario,
      escenario_label: SCENARIO_LABELS[escenario] || escenario,
      lista,
      lista_label: LISTA_LABELS[lista] || lista,
      version: "3.1.0",
      timestamp: new Date().toISOString(),
    },
    resumen,
    bom,
    descarte,
    autoportancia,
    advertencias: results.warnings || [],
    texto_whatsapp: textoWhatsapp,
    texto_resumen: textoResumen,
  };
}

function runCalcTecho(techo) {
  const is2A = techo.tipoAguas === "dos_aguas";
  const zonas = techo.zonas || [{ largo: techo.largo || 6, ancho: techo.ancho || 5 }];

  const zonaResults = zonas.flatMap(zona => {
    if (is2A) {
      const ha = +(zona.ancho / 2).toFixed(2);
      const a1 = calcTechoCompleto({
        ...techo, largo: zona.largo, ancho: ha,
        borders: { ...techo.borders, fondo: "cumbrera" },
      });
      const a2 = calcTechoCompleto({
        ...techo, largo: zona.largo, ancho: ha,
        borders: {
          frente: techo.borders?.fondo === "cumbrera" ? "cumbrera" : (techo.borders?.fondo || "none"),
          fondo: "none",
          latIzq: techo.borders?.latIzq || "none",
          latDer: techo.borders?.latDer || "none",
        },
      });
      return [a1, a2];
    }
    return [calcTechoCompleto({ ...techo, largo: zona.largo, ancho: zona.ancho })];
  });
  return mergeZonaResults(zonaResults);
}

// ── POST /cotizar ────────────────────────────────────────────────────────────

router.post("/cotizar", (req, res) => {
  try {
    const { lista = "web", escenario, techo, pared, camara, flete = 0 } = req.body;
    if (!escenario) return res.status(400).json({ ok: false, error: "Campo 'escenario' es requerido." });
    if (!["solo_techo", "solo_fachada", "techo_fachada", "camara_frig"].includes(escenario)) {
      return res.status(400).json({ ok: false, error: `Escenario '${escenario}' no válido. Opciones: solo_techo, solo_fachada, techo_fachada, camara_frig.` });
    }

    setListaPrecios(lista === "venta" ? "venta" : "web");

    let results = null;

    if (escenario === "solo_techo") {
      if (!techo?.familia || !techo?.espesor) {
        return res.status(400).json({ ok: false, error: "Para 'solo_techo' se requiere techo.familia y techo.espesor." });
      }
      results = runCalcTecho(techo);
    }

    if (escenario === "solo_fachada") {
      if (!pared?.familia || !pared?.espesor) {
        return res.status(400).json({ ok: false, error: "Para 'solo_fachada' se requiere pared.familia y pared.espesor." });
      }
      results = calcParedCompleto(pared);
    }

    if (escenario === "techo_fachada") {
      let rT = null;
      if (techo?.familia && techo?.espesor) rT = runCalcTecho(techo);
      const rP = pared?.familia && pared?.espesor ? calcParedCompleto(pared) : null;
      if (!rT && !rP) {
        return res.status(400).json({ ok: false, error: "Para 'techo_fachada' se requiere al menos techo o pared con familia y espesor." });
      }
      const allItems = [...(rT?.allItems || []), ...(rP?.allItems || [])];
      const totales = calcTotalesSinIVA(allItems);
      results = { ...rT, paredResult: rP, allItems, totales, warnings: [...(rT?.warnings || []), ...(rP?.warnings || [])] };
    }

    if (escenario === "camara_frig") {
      if (!pared?.familia || !pared?.espesor) {
        return res.status(400).json({ ok: false, error: "Para 'camara_frig' se requiere pared.familia y pared.espesor." });
      }
      if (!camara?.largo_int || !camara?.ancho_int || !camara?.alto_int) {
        return res.status(400).json({ ok: false, error: "Para 'camara_frig' se requiere camara.largo_int, camara.ancho_int y camara.alto_int." });
      }
      const perim = 2 * (camara.largo_int + camara.ancho_int);
      const rP = calcParedCompleto({ ...pared, perimetro: perim, alto: camara.alto_int, numEsqExt: 4, numEsqInt: 0 });
      const techoMap = resolveTechoForCamara(pared.familia, pared.espesor);
      const extraWarnings = [];
      if (techoMap.mapped) {
        extraWarnings.push(`Techo cámara: espesor ${techoMap.original}mm no disponible en ${techoMap.familia}, se usó ${techoMap.espesor}mm.`);
      }
      const rT = calcTechoCompleto({
        familia: techoMap.familia, espesor: techoMap.espesor,
        largo: camara.largo_int, ancho: camara.ancho_int,
        tipoEst: "metal",
        borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
        opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
        color: pared.color,
      });
      if (rT?.error) extraWarnings.push(`Techo cámara: ${rT.error}`);
      const techoItems = rT?.error ? [] : (rT?.allItems || []);
      const allItems = [...(rP?.allItems || []), ...techoItems];
      const totales = calcTotalesSinIVA(allItems);
      results = { ...rP, techoResult: rT?.error ? null : rT, allItems, totales, warnings: [...(rP?.warnings || []), ...(rT?.warnings || []), ...extraWarnings] };
    }

    return res.json(buildGptResponse(escenario, lista, results, flete));
  } catch (err) {
    req.log.error({ err }, "calc/cotizar failed");
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /catalogo ────────────────────────────────────────────────────────────

function panelSummary(panels, listaPrecio) {
  setListaPrecios(listaPrecio);
  const out = {};
  for (const [id, panel] of Object.entries(panels)) {
    const espesores = {};
    for (const [esp, data] of Object.entries(panel.esp)) {
      espesores[esp] = { precio_m2_usd: p(data), autoportancia_m: data.ap ?? null };
    }
    out[id] = {
      label: panel.label,
      subtipo: panel.sub,
      ancho_util_m: panel.au,
      largo_min_m: panel.lmin,
      largo_max_m: panel.lmax,
      sistema_fijacion: panel.sist,
      colores: panel.col,
      espesores,
    };
  }
  return out;
}

router.get("/catalogo", (req, res) => {
  try {
    const lista = req.query.lista || "web";
    setListaPrecios(lista === "venta" ? "venta" : "web");

    res.json({
      ok: true,
      lista,
      lista_label: LISTA_LABELS[lista] || lista,
      paneles_techo: panelSummary(PANELS_TECHO, lista),
      paneles_pared: panelSummary(PANELS_PARED, lista),
      bordes_techo: BORDER_OPTIONS,
      tipos_estructura: ["metal", "hormigon", "mixto", "madera"],
      escenarios: SCENARIOS_DEF.map(s => ({
        id: s.id,
        label: s.label,
        descripcion: s.description,
        tiene_techo: s.hasTecho,
        tiene_pared: s.hasPared,
        es_camara: !!s.isCamara,
        familias_validas: s.familias,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "calc/catalogo failed");
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /escenarios ──────────────────────────────────────────────────────────

router.get("/escenarios", (req, res) => {
  try {
    const escenarios = SCENARIOS_DEF.map(s => {
      const vis = VIS[s.id];
      const camposRequeridos = [];
      if (s.hasTecho) camposRequeridos.push("techo.familia", "techo.espesor", "techo.zonas[].largo", "techo.zonas[].ancho");
      if (s.hasPared && !s.isCamara) camposRequeridos.push("pared.familia", "pared.espesor", "pared.alto", "pared.perimetro");
      if (s.isCamara) camposRequeridos.push("pared.familia", "pared.espesor", "camara.largo_int", "camara.ancho_int", "camara.alto_int");

      const camposOpcionales = [];
      if (s.hasTecho) {
        camposOpcionales.push("techo.color", "techo.pendiente", "techo.tipoAguas", "techo.tipoEst", "techo.borders", "techo.opciones");
      }
      if (s.hasPared) {
        camposOpcionales.push("pared.color", "pared.tipoEst", "pared.numEsqExt", "pared.numEsqInt", "pared.aberturas", "pared.inclSell", "pared.incl5852");
      }
      camposOpcionales.push("lista", "flete");

      return {
        id: s.id,
        label: s.label,
        descripcion: s.description,
        tiene_techo: s.hasTecho,
        tiene_pared: s.hasPared,
        es_camara: !!s.isCamara,
        familias_validas: s.familias,
        campos_requeridos: camposRequeridos,
        campos_opcionales: camposOpcionales,
        secciones_ui: vis,
      };
    });

    res.json({ ok: true, escenarios });
  } catch (err) {
    req.log.error({ err }, "calc/escenarios failed");
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
