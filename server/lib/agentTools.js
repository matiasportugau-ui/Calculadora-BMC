/**
 * Anthropic tool_use definitions and handlers for the Panelin agent.
 *
 * Tools give the agent real-time read access to the calculator engine —
 * pricing, BOM, autoportance checks, and live calc state — replacing the
 * static snapshot injected in the system prompt for numerical queries.
 */
import {
  calcTechoCompleto,
  calcParedCompleto,
  calcTotalesSinIVA,
  mergeZonaResults,
} from "../../src/utils/calculations.js";
import { PANELS_TECHO, PANELS_PARED, IVA_MULT, setListaPrecios } from "../../src/data/constants.js";

// ─── Tool definitions (Anthropic input_schema format) ────────────────────────

export const AGENT_TOOLS = [
  {
    name: "calcular_cotizacion",
    description:
      "Calcula una cotización completa (BOM, área, cantidad de paneles, subtotal sin IVA, total con IVA 22%). " +
      "Usar cuando el usuario confirme dimensiones + familia + espesor. " +
      "Devuelve números exactos del motor de cotización — nunca afirmes precios sin llamar esta tool primero.",
    input_schema: {
      type: "object",
      properties: {
        scenario: {
          type: "string",
          enum: ["solo_techo", "solo_fachada", "techo_fachada", "camara_frig"],
          description: "Escenario de cotización",
        },
        listaPrecios: {
          type: "string",
          enum: ["web", "venta"],
          description: "Lista de precios activa. Default: web",
        },
        techo: {
          type: "object",
          description: "Datos del techo (solo_techo / techo_fachada / camara_frig)",
          properties: {
            familia: { type: "string", description: "ID de familia: ISODEC_EPS | ISODEC_PIR | ISOROOF_3G | ISOROOF_FOIL | ISOROOF_PLUS | ISOROOF_COLONIAL" },
            espesor: { type: "number", description: "Espesor en mm" },
            tipoAguas: { type: "string", enum: ["una_agua", "dos_aguas"] },
            pendiente: { type: "number", description: "Pendiente en grados" },
            tipoEst: { type: "string", enum: ["metal", "hormigon", "madera", "combinada"] },
            color: { type: "string" },
            zonas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  largo: { type: "number" },
                  ancho: { type: "number" },
                },
                required: ["largo", "ancho"],
              },
            },
            borders: {
              type: "object",
              properties: {
                frente: { type: "string" },
                fondo: { type: "string" },
                latIzq: { type: "string" },
                latDer: { type: "string" },
              },
            },
          },
          required: ["familia", "espesor", "zonas"],
        },
        pared: {
          type: "object",
          description: "Datos de pared/fachada (solo_fachada / techo_fachada / camara_frig)",
          properties: {
            familia: { type: "string", description: "ID: ISOPANEL_EPS | ISODEC_EPS_PARED | ISOWALL_PIR" },
            espesor: { type: "number" },
            alto: { type: "number", description: "Alto de pared en metros" },
            perimetro: { type: "number", description: "Perímetro total en metros" },
            numEsqExt: { type: "number" },
            numEsqInt: { type: "number" },
            color: { type: "string" },
          },
          required: ["familia", "espesor", "alto", "perimetro"],
        },
        camara: {
          type: "object",
          description: "Dimensiones internas de cámara frigorífica",
          properties: {
            largo_int: { type: "number" },
            ancho_int: { type: "number" },
            alto_int: { type: "number" },
          },
          required: ["largo_int", "ancho_int", "alto_int"],
        },
      },
      required: ["scenario"],
    },
  },

  {
    name: "obtener_precio_panel",
    description:
      "Obtiene el precio exacto (USD/m² sin IVA) de un panel por familia, espesor y lista. " +
      "También devuelve autoportancia, ancho útil y sistema de fijación. " +
      "Usar antes de confirmar cualquier precio unitario al cliente.",
    input_schema: {
      type: "object",
      properties: {
        familia: {
          type: "string",
          description: "ID de familia de panel (techo o pared)",
        },
        espesor: {
          type: "number",
          description: "Espesor en mm",
        },
        lista: {
          type: "string",
          enum: ["web", "venta"],
          description: "Lista de precios",
        },
      },
      required: ["familia", "espesor", "lista"],
    },
  },

  {
    name: "listar_opciones_panel",
    description:
      "Lista todas las familias y espesores disponibles para techo o pared con precios web, venta y autoportancia. " +
      "Usar cuando el usuario pregunta qué opciones hay, compara familias, o quiere ver el catálogo completo.",
    input_schema: {
      type: "object",
      properties: {
        tipo: {
          type: "string",
          enum: ["techo", "pared", "todos"],
          description: "Filtrar por tipo de panel",
        },
        lista: {
          type: "string",
          enum: ["web", "venta"],
          description: "Lista de precios a mostrar. Default: web",
        },
      },
      required: ["tipo"],
    },
  },

  {
    name: "get_calc_state",
    description:
      "Devuelve el estado actual de la calculadora tal como lo envió el usuario: " +
      "escenario, familia, espesor, zonas, pendiente, etc., y el resultado calculado si hay datos suficientes. " +
      "Usar cuando necesites confirmar qué tiene cargado el usuario antes de hacer una pregunta o acción.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
];

// ─── Tool handlers ────────────────────────────────────────────────────────────

function fmt2(n) {
  return typeof n === "number" ? +n.toFixed(2) : n;
}

function runTecho(techo, lista) {
  setListaPrecios(lista === "venta" ? "venta" : "web");
  const zonas = techo.zonas || [];
  if (zonas.length === 0) return null;

  const zonaResults = zonas.map((z) =>
    calcTechoCompleto({
      familia: techo.familia,
      espesor: Number(techo.espesor),
      largo: Number(z.largo),
      ancho: Number(z.ancho),
      tipoAguas: techo.tipoAguas || "una_agua",
      pendiente: Number(techo.pendiente || 0),
      tipoEst: techo.tipoEst || "metal",
      color: techo.color || "Blanco",
      borders: techo.borders || {
        frente: "gotero_frontal",
        fondo: "gotero_lateral",
        latIzq: "gotero_lateral",
        latDer: "gotero_lateral",
      },
      opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
    })
  );

  return zonaResults.length === 1 ? zonaResults[0] : mergeZonaResults(zonaResults);
}

function runPared(pared, lista) {
  setListaPrecios(lista === "venta" ? "venta" : "web");
  return calcParedCompleto({
    familia: pared.familia,
    espesor: Number(pared.espesor),
    alto: Number(pared.alto),
    perimetro: Number(pared.perimetro),
    numEsqExt: Number(pared.numEsqExt ?? 4),
    numEsqInt: Number(pared.numEsqInt ?? 0),
    color: pared.color || "Blanco",
    aberturas: pared.aberturas || [],
  });
}

function summarizeResult(result, scenario) {
  if (!result) return { error: "Datos insuficientes para calcular" };
  const totales = result.totales || calcTotalesSinIVA(result.allItems || []);
  const base = {
    subtotalSinIVA: fmt2(totales.subtotalSinIVA),
    totalConIVA: fmt2(totales.totalFinal),
    iva22: fmt2(totales.iva),
  };

  if (scenario === "solo_techo" || result.cantPaneles !== undefined) {
    base.techo = {
      cantPaneles: result.cantPaneles,
      areaTotal: fmt2(result.areaTotal),
      autoportanciaOk: result.autoportancia?.ok,
      autoportanciaVano: fmt2(result.autoportancia?.vano),
    };
  }
  if (result.paredResult) {
    const pr = result.paredResult;
    base.pared = {
      cantPaneles: pr.cantPaneles,
      areaBruta: fmt2(pr.areaBruta),
      areaNeta: fmt2(pr.areaNeta),
    };
  }
  if (result.techoResult) {
    const tr = result.techoResult;
    base.techoResult = {
      cantPaneles: tr.cantPaneles,
      areaTotal: fmt2(tr.areaTotal),
    };
  }
  return base;
}

/**
 * Execute a tool call and return the result string.
 * @param {string} name - Tool name
 * @param {object} input - Tool input
 * @param {object} calcState - Current calculator state from frontend
 * @returns {string} JSON-stringified result
 */
export function executeTool(name, input, calcState = {}) {
  try {
    if (name === "get_calc_state") {
      const liveResult = (() => {
        try {
          const { scenario, listaPrecios, techo = {}, pared = {}, camara = {} } = calcState;
          if (!scenario) return null;
          setListaPrecios(listaPrecios === "venta" ? "venta" : "web");
          if (scenario === "solo_techo" && techo.familia && techo.espesor && techo.zonas?.length) {
            return summarizeResult(runTecho(techo, listaPrecios), "solo_techo");
          }
          if (scenario === "solo_fachada" && pared.familia && pared.espesor && pared.perimetro) {
            return summarizeResult(runPared(pared, listaPrecios), "solo_fachada");
          }
          return null;
        } catch { return null; }
      })();
      return JSON.stringify({ calcState, liveResult });
    }

    if (name === "obtener_precio_panel") {
      const { familia, espesor, lista } = input;
      const allPanels = { ...PANELS_TECHO, ...PANELS_PARED };
      const def = allPanels[familia];
      if (!def) return JSON.stringify({ error: `Familia "${familia}" no encontrada`, familias_disponibles: Object.keys(allPanels) });
      const espDef = def.esp?.[espesor];
      if (!espDef) {
        const available = Object.keys(def.esp || {}).map(Number).sort((a, b) => a - b);
        return JSON.stringify({ error: `Espesor ${espesor}mm no disponible para ${familia}`, espesores_disponibles: available });
      }
      return JSON.stringify({
        familia,
        label: def.label,
        espesor,
        lista,
        precio_usd_m2_sin_iva: lista === "venta" ? fmt2(espDef.venta) : fmt2(espDef.web),
        precio_web: fmt2(espDef.web),
        precio_venta: fmt2(espDef.venta),
        autoportancia_m: espDef.ap ?? null,
        ancho_util_m: def.au,
        sistema_fijacion: def.sist,
        tipo: def.tipo,
      });
    }

    if (name === "listar_opciones_panel") {
      const { tipo, lista = "web" } = input;
      const result = {};
      const addGroup = (key, map) => {
        result[key] = Object.entries(map).map(([id, def]) => ({
          id,
          label: def.label,
          tipo: def.tipo,
          au: def.au,
          sist: def.sist,
          espesores: Object.entries(def.esp || {})
            .map(([esp, data]) => ({
              mm: Number(esp),
              precio: fmt2(lista === "venta" ? data.venta : data.web),
              ap: data.ap ?? null,
            }))
            .sort((a, b) => a.mm - b.mm),
        }));
      };
      if (tipo === "techo" || tipo === "todos") addGroup("techo", PANELS_TECHO);
      if (tipo === "pared" || tipo === "todos") addGroup("pared", PANELS_PARED);
      return JSON.stringify({ lista, ...result });
    }

    if (name === "calcular_cotizacion") {
      const { scenario, listaPrecios = "web", techo, pared, camara } = input;
      setListaPrecios(listaPrecios === "venta" ? "venta" : "web");

      if (scenario === "solo_techo") {
        if (!techo) return JSON.stringify({ error: "Se requieren datos de techo" });
        const r = runTecho(techo, listaPrecios);
        return JSON.stringify({ scenario, listaPrecios, ...summarizeResult(r, "solo_techo") });
      }

      if (scenario === "solo_fachada") {
        if (!pared) return JSON.stringify({ error: "Se requieren datos de pared" });
        const r = runPared(pared, listaPrecios);
        return JSON.stringify({ scenario, listaPrecios, ...summarizeResult(r, "solo_fachada") });
      }

      if (scenario === "techo_fachada") {
        const rT = techo ? runTecho(techo, listaPrecios) : null;
        const rP = pared ? runPared(pared, listaPrecios) : null;
        const allItems = [...(rT?.allItems || []), ...(rP?.allItems || [])];
        if (allItems.length === 0) return JSON.stringify({ error: "Datos insuficientes para calcular techo+fachada" });
        const totales = calcTotalesSinIVA(allItems);
        const combined = { allItems, totales, paredResult: rP, ...(rT || {}) };
        return JSON.stringify({ scenario, listaPrecios, ...summarizeResult(combined, "techo_fachada") });
      }

      if (scenario === "camara_frig") {
        if (!pared || !camara) return JSON.stringify({ error: "Se requieren datos de pared y cámara" });
        const perim = 2 * (Number(camara.largo_int) + Number(camara.ancho_int));
        const rP = runPared({ ...pared, perimetro: perim, alto: Number(camara.alto_int), numEsqExt: 4, numEsqInt: 0 }, listaPrecios);
        const techoFam = techo?.familia || pared.familia;
        const techoEsp = techo?.espesor || pared.espesor;
        const rT = calcTechoCompleto({
          familia: techoFam,
          espesor: Number(techoEsp),
          largo: Number(camara.largo_int),
          ancho: Number(camara.ancho_int),
          tipoEst: "metal",
          borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
          opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
          color: pared.color || "Blanco",
        });
        const allItems = [...(rP?.allItems || []), ...(rT?.allItems || [])];
        const totales = calcTotalesSinIVA(allItems);
        return JSON.stringify({
          scenario, listaPrecios,
          subtotalSinIVA: fmt2(totales.subtotalSinIVA),
          totalConIVA: fmt2(totales.totalFinal),
          iva22: fmt2(totales.iva),
          pared: { cantPaneles: rP?.cantPaneles, areaBruta: fmt2(rP?.areaBruta) },
          techo: { cantPaneles: rT?.cantPaneles, areaTotal: fmt2(rT?.areaTotal) },
          camara_dims: `${camara.largo_int}×${camara.ancho_int}×${camara.alto_int}m`,
        });
      }

      return JSON.stringify({ error: `Escenario "${scenario}" no soportado` });
    }

    return JSON.stringify({ error: `Tool "${name}" no implementada` });
  } catch (err) {
    return JSON.stringify({ error: err.message });
  }
}
