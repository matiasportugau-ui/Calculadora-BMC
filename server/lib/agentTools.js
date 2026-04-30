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
import { config } from "../config.js";
import { appendQuoteToCrm } from "./crmAppend.js";

function apiBase() {
  return config.publicBaseUrl.replace(/\/$/, "");
}

async function fetchJson(pathSuffix, init = {}) {
  const url = `${apiBase()}${pathSuffix}`;
  const resp = await fetch(url, init);
  const txt = await resp.text();
  try { return JSON.parse(txt); } catch { return { ok: false, error: `Respuesta no-JSON desde ${pathSuffix}: ${txt.slice(0, 200)}` }; }
}

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

  {
    name: "generar_pdf",
    description:
      "Genera un PDF de cotización y devuelve una URL para compartir con el cliente. " +
      "Llamar SOLO después de que calcular_cotizacion confirmó los datos y el usuario aprobó la cotización. " +
      "La URL se puede compartir por WhatsApp o email — el cliente la abre en el navegador e imprime.",
    input_schema: {
      type: "object",
      properties: {
        scenario: {
          type: "string",
          enum: ["solo_techo", "solo_fachada", "techo_fachada", "camara_frig"],
        },
        listaPrecios: { type: "string", enum: ["web", "venta"] },
        techo: {
          type: "object",
          properties: {
            familia: { type: "string" },
            espesor: { type: "number" },
            tipoAguas: { type: "string" },
            pendiente: { type: "number" },
            tipoEst: { type: "string" },
            color: { type: "string" },
            zonas: { type: "array", items: { type: "object", properties: { largo: { type: "number" }, ancho: { type: "number" } }, required: ["largo", "ancho"] } },
            borders: { type: "object" },
          },
        },
        pared: {
          type: "object",
          properties: {
            familia: { type: "string" },
            espesor: { type: "number" },
            alto: { type: "number" },
            perimetro: { type: "number" },
            numEsqExt: { type: "number" },
            numEsqInt: { type: "number" },
            color: { type: "string" },
          },
        },
        camara: {
          type: "object",
          properties: {
            largo_int: { type: "number" },
            ancho_int: { type: "number" },
            alto_int: { type: "number" },
          },
        },
        flete: { type: "number", description: "Flete en USD" },
        cliente: {
          type: "object",
          description: "Datos del cliente para el encabezado del PDF",
          properties: {
            nombre: { type: "string" },
            rut: { type: "string" },
            telefono: { type: "string" },
            direccion: { type: "string" },
            obra: { type: "string" },
            ref: { type: "string" },
          },
        },
      },
      required: ["scenario"],
    },
  },

  {
    name: "obtener_escenarios",
    description:
      "Devuelve la lista canónica de escenarios de cotización con sus campos REQUERIDOS y OPCIONALES. " +
      "Usar al inicio de cada cotización para saber exactamente qué datos pedirle al usuario sin re-preguntar lo que ya está en calcState. " +
      "Es la fuente de verdad para slot-filling: si un campo no está en `campos_requeridos`, no lo pidas como obligatorio.",
    input_schema: { type: "object", properties: {} },
  },

  {
    name: "obtener_catalogo",
    description:
      "Devuelve el catálogo completo de paneles (techo + pared) con familias, espesores válidos, colores permitidos, " +
      "ancho útil, sistemas de fijación y bordes disponibles. Usar antes de aplicar setTecho/setPared para validar " +
      "que la combinación familia+espesor+color que el usuario pidió existe en la lista activa.",
    input_schema: {
      type: "object",
      properties: {
        lista: { type: "string", enum: ["web", "venta"], description: "Lista de precios. Default: web" },
      },
    },
  },

  {
    name: "obtener_informe_completo",
    description:
      "Dump completo de pricing + reglas de asesoría + fórmulas de cálculo + endpoints. Más pesado que catalogo, " +
      "pero útil cuando el usuario pregunta cosas tipo \"¿cuánto vale el flete a Salto?\", \"¿qué autoportancia necesito para 6m?\", " +
      "\"¿cuál es la regla para Blanco en ISOROOF 3G?\". No llamarla en cotizaciones rutinarias — preferí catalogo.",
    input_schema: {
      type: "object",
      properties: {
        lista: { type: "string", enum: ["web", "venta"] },
      },
    },
  },

  {
    name: "presupuesto_libre",
    description:
      "Genera una cotización en formato BOM libre (líneas manuales): el usuario describe paneles + perfilería + fijaciones + selladores " +
      "uno por uno, sin pasar por el wizard de escenario. Usar cuando el usuario diga 'presupuesto libre', 'BOM manual', " +
      "'cotización a medida', o cuando lo que pide no encaja en solo_techo / solo_fachada / techo_fachada / camara_frig.",
    input_schema: {
      type: "object",
      properties: {
        lista: { type: "string", enum: ["web", "venta"] },
        librePanelLines: {
          type: "array",
          description: "Líneas de panel manuales: cada línea es { familia, espesor, color, m2, largo? }",
          items: { type: "object" },
        },
        librePerfilQty: { type: "object", description: "Mapa { perfilId: cantidad }" },
        libreFijQty:    { type: "object", description: "Mapa { fijacionId: cantidad }" },
        libreSellQty:   { type: "object", description: "Mapa { selladorId: cantidad }" },
        libreExtra:     { type: "object", description: "Items extra { label, pu, cant }" },
        flete:          { type: "number", description: "Flete USD" },
      },
    },
  },

  {
    name: "listar_cotizaciones_recientes",
    description:
      "Lista las cotizaciones generadas recientemente en esta instancia (últimas 24h). " +
      "Cada entrada incluye id, code, cliente, escenario, total, lista y la URL del PDF. " +
      "Usar cuando el usuario diga 'mandale otra vez la cotización a Juan', 'pasame el link del último presupuesto', " +
      "'¿qué cotizaciones hice hoy?'.",
    input_schema: {
      type: "object",
      properties: {
        cliente: { type: "string", description: "Filtrar por nombre de cliente (match parcial, case-insensitive)" },
        limite:  { type: "number", description: "Máx resultados a devolver. Default 10" },
      },
    },
  },

  {
    name: "obtener_cotizacion_por_id",
    description:
      "Recupera el resumen + URL del PDF de una cotización por su pdf_id (UUID). " +
      "Usar cuando el usuario referencia un id específico o cuando listar_cotizaciones_recientes devolvió varios y necesitás el detalle de uno.",
    input_schema: {
      type: "object",
      properties: {
        pdf_id: { type: "string", description: "UUID de la cotización" },
      },
      required: ["pdf_id"],
    },
  },

  {
    name: "aplicar_estado_calc",
    description:
      "Aplica datos extraídos de la conversación al estado live de la calculadora (auto-rellena el formulario). " +
      "Emite las ACTION_JSON correspondientes en una sola llamada: setScenario, setLP, setTecho, setTechoZonas, setPared, setCamara, setFlete, setProyecto. " +
      "Pasá SOLO los campos que el usuario confirmó explícitamente. Llamala en cuanto tengas datos suficientes para un campo — no esperes a tener todo. " +
      "Tras llamarla, calculá con calcular_cotizacion para mostrar el total parcial al usuario.",
    input_schema: {
      type: "object",
      properties: {
        scenario:     { type: "string", enum: ["solo_techo", "solo_fachada", "techo_fachada", "camara_frig", "presupuesto_libre"] },
        listaPrecios: { type: "string", enum: ["web", "venta"] },
        techo: {
          type: "object",
          description: "Campos de techo. Las zonas se aplican vía setTechoZonas si están presentes.",
          properties: {
            familia:    { type: "string" },
            espesor:    { type: ["string", "number"] },
            color:      { type: "string" },
            tipoAguas:  { type: "string", enum: ["una_agua", "dos_aguas"] },
            pendiente:  { type: "number" },
            tipoEst:    { type: "string", enum: ["metal", "hormigon", "madera", "combinada"] },
            borders:    { type: "object" },
            zonas:      { type: "array", items: { type: "object" } },
          },
        },
        pared: {
          type: "object",
          properties: {
            familia: { type: "string" }, espesor: { type: ["string", "number"] }, color: { type: "string" },
            alto: { type: "number" }, perimetro: { type: "number" },
            numEsqExt: { type: "number" }, numEsqInt: { type: "number" },
          },
        },
        camara: {
          type: "object",
          properties: {
            largo_int: { type: "number" }, ancho_int: { type: "number" }, alto_int: { type: "number" },
          },
        },
        flete:    { type: "number", description: "Flete USD" },
        proyecto: {
          type: "object",
          properties: {
            nombre: { type: "string" }, rut: { type: "string" }, telefono: { type: "string" },
            direccion: { type: "string" }, descripcion: { type: "string" },
            tipoCliente: { type: "string", enum: ["empresa", "particular"] },
          },
        },
      },
    },
  },

  {
    name: "formatear_resumen_crm",
    description:
      "Formatea un bloque copy-pasteable listo para pegar en el CRM con los datos clave de la cotización: " +
      "código, cliente, escenario, total USD, link PDF (GCS) y link Drive. " +
      "Llamarla DESPUÉS de generar_pdf, antes de mostrarle el resumen final al usuario. " +
      "El bloque se muestra al humano para que lo pegue manualmente en su sheet/CRM.",
    input_schema: {
      type: "object",
      properties: {
        cliente:   { type: "string" },
        scenario:  { type: "string" },
        total:     { type: "number" },
        lista:     { type: "string" },
        pdf_url:   { type: "string" },
        drive_url: { type: "string" },
        pdf_id:    { type: "string" },
        code:      { type: "string" },
      },
      required: ["pdf_url"],
    },
  },

  {
    name: "guardar_en_crm",
    description:
      "Guarda la cotización en la planilla CRM_Operativo de BMC (Google Sheets). Crea una fila nueva con cliente, " +
      "teléfono, total, escenario, link al PDF (col AH = LINK_PRESUPUESTO) y observaciones. " +
      "REGLA OBLIGATORIA: SOLO llamar esta tool cuando el usuario confirma EXPLÍCITAMENTE que quiere guardarla " +
      "(\"guardalo en CRM\", \"pegalo al CRM\", \"sumalo al CRM\", \"agregalo a la planilla\"). " +
      "Nunca la llames automáticamente después de generar_pdf — primero formatear_resumen_crm y esperar la confirmación. " +
      "La fila se crea con AI/AK = \"No\" (gate humano), el operador aprueba manualmente desde la planilla.",
    input_schema: {
      type: "object",
      properties: {
        cliente:               { type: "string" },
        telefono:              { type: "string" },
        ubicacion:             { type: "string" },
        scenario:              { type: "string" },
        lista:                 { type: "string", enum: ["web", "venta"] },
        total:                 { type: "number", description: "USD con IVA" },
        pdf_url:               { type: "string" },
        drive_url:             { type: "string" },
        vendedor:              { type: "string" },
        tipo_cliente:          { type: "string" },
        urgencia:              { type: "string" },
        probabilidad_cierre:   { type: "string" },
        observaciones:         { type: "string" },
      },
      required: ["pdf_url"],
    },
  },

  {
    name: "comparar_listas",
    description:
      "Calcula la MISMA cotización en lista web y lista venta y devuelve el delta (diferencia USD y %). " +
      "Usar cuando el usuario pregunta \"¿cuánto baja con lista venta?\", \"¿cuál es el descuento?\", " +
      "\"¿cuánto cambia si soy distribuidor?\", o cuando el vendedor evalúa precio para un cliente con red comercial. " +
      "Internamente llama calcular_cotizacion dos veces — pasá los mismos campos que pasarías a calcular_cotizacion (sin listaPrecios).",
    input_schema: {
      type: "object",
      properties: {
        scenario: {
          type: "string",
          enum: ["solo_techo", "solo_fachada", "techo_fachada", "camara_frig"],
        },
        techo:  { type: "object", description: "Mismo shape que en calcular_cotizacion" },
        pared:  { type: "object", description: "Mismo shape que en calcular_cotizacion" },
        camara: { type: "object", description: "Mismo shape que en calcular_cotizacion" },
      },
      required: ["scenario"],
    },
  },
];

// ─── Tool handlers ────────────────────────────────────────────────────────────

function fmt2(n) {
  return typeof n === "number" ? +n.toFixed(2) : n;
}

function normalizeFamilia(f) {
  return f ? String(f).toUpperCase().replace(/-/g, "_") : f;
}

function runTecho(techo, lista) {
  setListaPrecios(lista === "venta" ? "venta" : "web");
  const zonas = techo.zonas || [];
  if (zonas.length === 0) return null;

  const zonaResults = zonas.map((z) =>
    calcTechoCompleto({
      familia: normalizeFamilia(techo.familia),
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
    familia: normalizeFamilia(pared.familia),
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

// Allow-listed action types — must match VALID_ACTION_TYPES in agentChat.js.
const APLICAR_ALLOWED_ACTIONS = new Set([
  "setScenario", "setLP", "setTecho", "setTechoZonas",
  "setPared", "setCamara", "setFlete", "setProyecto",
]);

function buildAplicarActions(input = {}) {
  const actions = [];
  if (input.scenario) actions.push({ type: "setScenario", payload: String(input.scenario) });
  if (input.listaPrecios) actions.push({ type: "setLP", payload: String(input.listaPrecios) });
  if (input.techo && typeof input.techo === "object") {
    const { zonas, ...rest } = input.techo;
    const techoFields = { ...rest };
    if (techoFields.familia) techoFields.familia = normalizeFamilia(techoFields.familia);
    if (techoFields.espesor != null) techoFields.espesor = String(techoFields.espesor);
    if (Object.keys(techoFields).length > 0) actions.push({ type: "setTecho", payload: techoFields });
    if (Array.isArray(zonas) && zonas.length > 0) {
      const safeZonas = zonas
        .map((z) => ({ largo: Number(z.largo), ancho: Number(z.ancho) }))
        .filter((z) => Number.isFinite(z.largo) && Number.isFinite(z.ancho));
      if (safeZonas.length > 0) actions.push({ type: "setTechoZonas", payload: safeZonas });
    }
  }
  if (input.pared && typeof input.pared === "object") {
    const paredFields = { ...input.pared };
    if (paredFields.familia) paredFields.familia = normalizeFamilia(paredFields.familia);
    if (paredFields.espesor != null) paredFields.espesor = String(paredFields.espesor);
    if (Object.keys(paredFields).length > 0) actions.push({ type: "setPared", payload: paredFields });
  }
  if (input.camara && typeof input.camara === "object") {
    const c = input.camara;
    if (c.largo_int != null && c.ancho_int != null && c.alto_int != null) {
      actions.push({ type: "setCamara", payload: {
        largo_int: Number(c.largo_int), ancho_int: Number(c.ancho_int), alto_int: Number(c.alto_int),
      }});
    }
  }
  if (input.flete != null && Number.isFinite(Number(input.flete))) {
    actions.push({ type: "setFlete", payload: Number(input.flete) });
  }
  if (input.proyecto && typeof input.proyecto === "object" && Object.keys(input.proyecto).length > 0) {
    actions.push({ type: "setProyecto", payload: input.proyecto });
  }
  return actions.filter((a) => APLICAR_ALLOWED_ACTIONS.has(a.type));
}

/**
 * Execute a tool call and return the result string.
 * @param {string} name - Tool name
 * @param {object} input - Tool input
 * @param {object} calcState - Current calculator state from frontend
 * @param {object} [opts]
 * @param {(action:object)=>void} [opts.emitAction] - Callback to emit ACTION_JSON live to the SSE stream
 * @returns {Promise<string>} JSON-stringified result
 */
export async function executeTool(name, input, calcState = {}, opts = {}) {
  const { emitAction } = opts;
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
      const { familia: familiaRaw, espesor, lista } = input;
      const familia = normalizeFamilia(familiaRaw);
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
        largo_min_m: def.lmin ?? null,
        largo_max_m: def.lmax ?? null,
        sistema_fijacion: def.sist,
        tipo: def.tipo,
        nota: def[`nota${espesor}`] ?? null,
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

    if (name === "generar_pdf") {
      const { scenario, listaPrecios = "web", techo, pared, camara, flete = 0, cliente = {} } = input;

      // Map tool input to /calc/cotizar/pdf body format
      const body = {
        lista: listaPrecios,
        escenario: scenario,
        flete,
        cliente,
        ...(techo && {
          techo: {
            ...techo,
            familia: techo.familia ? String(techo.familia).toUpperCase().replace(/-/g, "_") : undefined,
            espesor: techo.espesor ? String(techo.espesor) : undefined,
          },
        }),
        ...(pared && {
          pared: {
            ...pared,
            familia: pared.familia ? String(pared.familia).toUpperCase().replace(/-/g, "_") : undefined,
            espesor: pared.espesor ? String(pared.espesor) : undefined,
          },
        }),
        ...(camara && { camara }),
      };

      const apiBase = config.publicBaseUrl.replace(/\/$/, "");
      const resp = await fetch(`${apiBase}/calc/cotizar/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();

      if (!data.ok) return JSON.stringify({ error: data.error || "Error al generar PDF" });

      return JSON.stringify({
        ok: true,
        pdf_id: data.pdf_id,
        pdf_url: data.pdf_url,
        gcs_url: data.gcs_url || null,
        drive_url: data.drive_url || null,
        expires_in_hours: data.expires_in_hours || null,
        resumen: data.resumen,
        instrucciones: "Compartí este link con el cliente. Se abre en el navegador y se puede imprimir como PDF desde Archivo → Imprimir.",
      });
    }

    if (name === "obtener_escenarios") {
      const data = await fetchJson("/calc/escenarios");
      if (!data.ok) return JSON.stringify({ error: data.error || "Error al obtener escenarios" });
      return JSON.stringify({ ok: true, escenarios: data.escenarios });
    }

    if (name === "obtener_catalogo") {
      const lista = input?.lista === "venta" ? "venta" : "web";
      const data = await fetchJson(`/calc/catalogo?lista=${lista}`);
      if (!data.ok) return JSON.stringify({ error: data.error || "Error al obtener catálogo" });
      return JSON.stringify({
        ok: true,
        lista: data.lista,
        paneles_techo: data.paneles_techo,
        paneles_pared: data.paneles_pared,
        bordes_techo: data.bordes_techo,
        tipos_estructura: data.tipos_estructura,
        escenarios: data.escenarios,
      });
    }

    if (name === "obtener_informe_completo") {
      const lista = input?.lista === "venta" ? "venta" : "web";
      const data = await fetchJson(`/calc/informe?lista=${lista}`);
      if (!data.ok) return JSON.stringify({ error: data.error || "Error al obtener informe" });
      return JSON.stringify({
        ok: true,
        lista: data.meta?.lista,
        paneles_techo: data.paneles_techo,
        paneles_pared: data.paneles_pared,
        fijaciones: data.fijaciones,
        selladores: data.selladores,
        servicios: data.servicios,
        matriz_precios: data.matriz_precios,
        bordes_techo: data.bordes_techo,
        reglas_asesoria: data.reglas_asesoria,
        formulas_calculo: data.formulas_calculo,
      });
    }

    if (name === "presupuesto_libre") {
      const body = {
        lista: input?.lista === "venta" ? "venta" : "web",
        librePanelLines: Array.isArray(input?.librePanelLines) ? input.librePanelLines : [],
        librePerfilQty: input?.librePerfilQty || {},
        libreFijQty: input?.libreFijQty || {},
        libreSellQty: input?.libreSellQty || {},
        flete: Number(input?.flete || 0),
        libreExtra: input?.libreExtra || {},
      };
      const data = await fetchJson("/calc/cotizar/presupuesto-libre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!data.ok) return JSON.stringify({ error: data.error || "Error en presupuesto libre" });
      return JSON.stringify({
        ok: true,
        resumen: data.resumen,
        bom: data.bom,
        advertencias: data.advertencias || [],
        texto_resumen: data.texto_resumen,
      });
    }

    if (name === "listar_cotizaciones_recientes") {
      const data = await fetchJson("/calc/cotizaciones");
      if (!data.ok) return JSON.stringify({ error: data.error || "Error al listar cotizaciones" });
      const filtroCliente = String(input?.cliente || "").trim().toLowerCase();
      const limite = Math.max(1, Math.min(50, Number(input?.limite || 10)));
      let entries = data.cotizaciones || [];
      if (filtroCliente) {
        entries = entries.filter((e) => String(e.client || "").toLowerCase().includes(filtroCliente));
      }
      entries = entries.slice(0, limite);
      return JSON.stringify({ ok: true, count: entries.length, cotizaciones: entries });
    }

    if (name === "obtener_cotizacion_por_id") {
      const id = String(input?.pdf_id || "").trim();
      if (!id) return JSON.stringify({ error: "pdf_id requerido" });
      const list = await fetchJson("/calc/cotizaciones");
      if (!list.ok) return JSON.stringify({ error: list.error || "No se pudo consultar el registro" });
      const entry = (list.cotizaciones || []).find((e) => e.id === id);
      if (!entry) return JSON.stringify({ error: `Cotización ${id} no encontrada o expirada (24h TTL)` });
      return JSON.stringify({
        ok: true,
        id: entry.id,
        code: entry.code,
        client: entry.client,
        scenario: entry.scenario,
        total: entry.total,
        lista: entry.lista,
        pdf_url: entry.pdfUrl,
        viewer_url: `${apiBase()}/calc/pdf/${id}`,
        timestamp: entry.timestamp,
      });
    }

    if (name === "aplicar_estado_calc") {
      const actions = buildAplicarActions(input || {});
      if (actions.length === 0) {
        return JSON.stringify({ ok: false, error: "Sin campos válidos para aplicar — pasá scenario, listaPrecios, techo, pared, camara, flete o proyecto." });
      }
      if (typeof emitAction === "function") {
        for (const a of actions) {
          try { emitAction(a); } catch { /* swallow individual emit errors */ }
        }
      }
      return JSON.stringify({
        ok: true,
        applied: actions.map((a) => a.type),
        count: actions.length,
        nota: "Acciones emitidas al frontend. Usá calcular_cotizacion ahora si los datos requeridos están completos.",
      });
    }

    if (name === "formatear_resumen_crm") {
      const cliente = String(input?.cliente || "—");
      const scenario = String(input?.scenario || "");
      const total = Number(input?.total || 0);
      const lista = String(input?.lista || "");
      const pdfUrl = String(input?.pdf_url || "");
      const driveUrl = String(input?.drive_url || "");
      const code = String(input?.code || input?.pdf_id || "").slice(0, 8);
      const fecha = new Date().toISOString().slice(0, 10);
      const lines = [
        `📋 Cotización ${code ? `${code} ` : ""}— ${fecha}`,
        `Cliente: ${cliente}`,
        scenario ? `Escenario: ${scenario}` : null,
        lista ? `Lista: ${lista}` : null,
        Number.isFinite(total) && total > 0 ? `Total: USD ${total.toFixed(2)} c/IVA` : null,
        pdfUrl ? `PDF: ${pdfUrl}` : null,
        driveUrl ? `Drive: ${driveUrl}` : null,
      ].filter(Boolean);
      const crmText = lines.join("\n");
      return JSON.stringify({
        ok: true,
        crm_text: crmText,
        instrucciones: "Mostrale el bloque al usuario para que lo pegue en el CRM. Si pide guardarlo automáticamente, llamá guardar_en_crm.",
      });
    }

    if (name === "comparar_listas") {
      const { scenario, techo, pared, camara } = input || {};
      if (!scenario) return JSON.stringify({ error: "scenario requerido" });
      const baseInput = { scenario, techo, pared, camara };
      const [webRaw, ventaRaw] = await Promise.all([
        executeTool("calcular_cotizacion", { ...baseInput, listaPrecios: "web" }, calcState),
        executeTool("calcular_cotizacion", { ...baseInput, listaPrecios: "venta" }, calcState),
      ]);
      const web = JSON.parse(webRaw);
      const venta = JSON.parse(ventaRaw);
      if (web.error) return JSON.stringify({ error: `Lista web: ${web.error}` });
      if (venta.error) return JSON.stringify({ error: `Lista venta: ${venta.error}` });
      const totalWeb = Number(web.totalConIVA || 0);
      const totalVenta = Number(venta.totalConIVA || 0);
      const deltaUsd = +(totalWeb - totalVenta).toFixed(2);
      const deltaPct = totalWeb > 0 ? +((deltaUsd / totalWeb) * 100).toFixed(2) : 0;
      return JSON.stringify({
        ok: true,
        scenario,
        web:   { subtotalSinIVA: web.subtotalSinIVA,   totalConIVA: totalWeb },
        venta: { subtotalSinIVA: venta.subtotalSinIVA, totalConIVA: totalVenta },
        delta_usd: deltaUsd,
        delta_pct: deltaPct,
        ahorro_lista_venta_usd: deltaUsd,
        nota: deltaUsd > 0
          ? `Lista venta es USD ${deltaUsd} (${deltaPct}%) más barata que web.`
          : "No hay diferencia entre listas para esta combinación.",
      });
    }

    if (name === "guardar_en_crm") {
      const result = await appendQuoteToCrm({
        cliente: input?.cliente,
        telefono: input?.telefono,
        ubicacion: input?.ubicacion,
        scenario: input?.scenario,
        lista: input?.lista,
        total: input?.total,
        pdf_url: input?.pdf_url,
        drive_url: input?.drive_url,
        vendedor: input?.vendedor,
        tipo_cliente: input?.tipo_cliente,
        urgencia: input?.urgencia,
        probabilidad_cierre: input?.probabilidad_cierre,
        observaciones: input?.observaciones,
      });
      return JSON.stringify(result);
    }

    return JSON.stringify({ error: `Tool "${name}" no implementada` });
  } catch (err) {
    return JSON.stringify({ error: err.message });
  }
}
