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
import { getPdf } from "../routes/calc.js";
import { postCotizar, postCotizarPdf, postPresupuestoLibre } from "./calcLoopbackClient.js";
import {
  getTimerCurrent as tkTimerCurrent,
  startTimer as tkStartTimer,
  stopTimer as tkStopTimer,
  listEntries as tkListEntries,
  createEntry as tkCreateEntry,
  getDayReport as tkDayReport,
  getMonthReport as tkMonthReport,
  getBillableReport as tkBillable,
} from "./traktimeLoopbackClient.js";
import { appendQuoteToCrm } from "./crmAppend.js";
import { dualWriteQuote } from "./quoteDualWrite.js";
import {
  getQuotation as getQuotationFromRegistry,
  listQuotations as listQuotationsFromRegistry,
  cancelQuotation as cancelQuotationInRegistry,
} from "./quoteRegistry.js";
import { searchCrmClients } from "./crmSearch.js";
import { readCrmRowTaxonomy, writeCrmRowTaxonomy } from "./crmTaxonomy.js";
import { sendWhatsAppText } from "./whatsappOutbound.js";
import {
  loadStore as loadFollowupStore,
  saveStore as saveFollowupStore,
  addItem as addFollowupItem,
  parseDueInput,
  parseDays,
} from "./followUpStore.js";
import { recordToolCall, classifyError } from "./toolStats.js";
import { INTENT_HINTS } from "./userIntentClassifier.js";
import { retrieveSimilarQuotes, formatRetrievedContextForPrompt } from "./rag.js";

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
      "Lista las cotizaciones generadas recientemente (registry persistente en GCS, sin TTL). " +
      "Cada entrada incluye id, code, cliente, escenario, total, lista, source ('ae_agent' | 'calculator') y la URL del PDF. " +
      "Usar cuando el usuario diga 'mandale otra vez la cotización a Juan', 'pasame el link del último presupuesto', " +
      "'¿qué cotizaciones hice hoy?', '¿qué generó la IA?' (filtrar source='ae_agent').",
    input_schema: {
      type: "object",
      properties: {
        cliente:           { type: "string", description: "Filtrar por nombre de cliente (match parcial, case-insensitive)" },
        source:            { type: "string", enum: ["ae_agent", "calculator"], description: "Filtrar por origen: 'ae_agent' (generado por el agente) o 'calculator' (UI manual)" },
        include_cancelled: { type: "boolean", description: "Si true, incluye cotizaciones canceladas. Default false." },
        limite:            { type: "number", description: "Máx resultados a devolver. Default 10" },
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
      "REQUIERE el flag user_confirmed=true en el input — el server rechaza la escritura si falta. " +
      "Nunca la llames automáticamente después de generar_pdf — primero formatear_resumen_crm y esperar la confirmación. " +
      "ANTES de llamar esta tool, llamá buscar_cliente_crm para evitar filas duplicadas. " +
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
        user_confirmed:        { type: "boolean", description: "OBLIGATORIO=true. Confirma que el usuario aprobó la escritura explícitamente." },
      },
      required: ["pdf_url", "user_confirmed"],
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

  {
    name: "buscar_cliente_crm",
    description:
      "Busca filas existentes en CRM_Operativo por nombre, teléfono o RUT antes de crear una nueva fila. " +
      "Usar SIEMPRE antes de guardar_en_crm cuando el usuario pide guardar una cotización — así evitamos duplicados. " +
      "También útil cuando el usuario pregunta \"¿ya cotizamos a Juan Pérez?\" o \"¿qué tenemos del cliente X?\". " +
      "Devuelve hasta `limite` matches con fila, cliente, teléfono, link al último presupuesto y timestamp.",
    input_schema: {
      type: "object",
      properties: {
        query:  { type: "string", description: "Nombre del cliente, teléfono (con o sin dígitos no numéricos), o RUT" },
        limite: { type: "number", description: "Máx matches a devolver. Default 10, max 50." },
      },
      required: ["query"],
    },
  },

  {
    name: "enviar_whatsapp_link",
    description:
      "Envía un mensaje de texto con el link de la cotización al WhatsApp del cliente vía WhatsApp Business Cloud API. " +
      "REGLA OBLIGATORIA: SOLO llamar cuando el usuario confirma EXPLÍCITAMENTE el envío " +
      "(\"mandale por WhatsApp\", \"envialo al cliente\", \"mandale el link\"). " +
      "REQUIERE el flag user_confirmed=true en el input — el server rechaza el envío si falta. " +
      "El mensaje default es un texto corto profesional con el link; podés override con el campo `text`. " +
      "El destinatario `to` debe ser el teléfono del CLIENTE (no del operador), en formato E.164 sin '+' o solo dígitos.",
    input_schema: {
      type: "object",
      properties: {
        to:             { type: "string", description: "Teléfono del cliente (dígitos, formato E.164 sin '+')" },
        pdf_url:        { type: "string", description: "URL pública de la cotización (GCS preferido)" },
        cliente:        { type: "string", description: "Nombre del cliente (para personalizar el saludo)" },
        total:          { type: "number", description: "Total USD c/IVA (para incluir en el mensaje)" },
        scenario:       { type: "string", description: "Escenario de la cotización" },
        text:           { type: "string", description: "Texto override completo. Si está, ignora pdf_url/cliente/total para componer." },
        user_confirmed: { type: "boolean", description: "OBLIGATORIO=true. Confirma que el usuario aprobó el envío explícitamente." },
      },
      required: ["to", "user_confirmed"],
    },
  },

  {
    name: "comparar_escenarios",
    description:
      "Calcula DOS escenarios distintos sobre el mismo proyecto y devuelve el delta. " +
      "Usar cuando el usuario pregunta \"¿cuánto extra si le sumo la fachada?\" (solo_techo vs techo_fachada), " +
      "\"¿cuánto baja si solo cotizo techo?\" (techo_fachada vs solo_techo), o cualquier comparación entre escenarios. " +
      "Mantiene listaPrecios fija en ambos cálculos (default web). Si necesitás comparar listas, usá comparar_listas.",
    input_schema: {
      type: "object",
      properties: {
        scenario_a:   { type: "string", enum: ["solo_techo", "solo_fachada", "techo_fachada", "camara_frig"] },
        scenario_b:   { type: "string", enum: ["solo_techo", "solo_fachada", "techo_fachada", "camara_frig"] },
        listaPrecios: { type: "string", enum: ["web", "venta"], description: "Default: web" },
        techo:  { type: "object", description: "Mismo shape que en calcular_cotizacion" },
        pared:  { type: "object", description: "Mismo shape que en calcular_cotizacion" },
        camara: { type: "object", description: "Mismo shape que en calcular_cotizacion" },
      },
      required: ["scenario_a", "scenario_b"],
    },
  },

  {
    name: "cancelar_cotizacion",
    description:
      "Marca una cotización como cancelada en el registry persistente (no la borra). " +
      "Usar cuando el cliente declina, los datos cambiaron, o el operador quiere limpiar la cotización del listado activo. " +
      "REGLA OBLIGATORIA: SOLO con confirmación explícita del usuario " +
      "(\"cancelá la cotización X\", \"borrá la cotización Y\", \"el cliente desistió\"). " +
      "REQUIERE user_confirmed=true en el input — el server rechaza si falta. " +
      "La cotización sigue accesible vía obtener_cotizacion_por_id pero no aparece en listar_cotizaciones_recientes salvo include_cancelled=true.",
    input_schema: {
      type: "object",
      properties: {
        pdf_id:         { type: "string", description: "UUID de la cotización a cancelar" },
        motivo:         { type: "string", description: "Motivo de la cancelación (ej: 'cliente declinó', 'datos incorrectos')" },
        user_confirmed: { type: "boolean", description: "OBLIGATORIO=true. Confirma que el usuario aprobó la cancelación." },
      },
      required: ["pdf_id", "user_confirmed"],
    },
  },

  {
    name: "obtener_pdf_html",
    description:
      "Devuelve el HTML crudo de una cotización por su pdf_id (no el link, sino el contenido). " +
      "Útil cuando el agente necesita inspeccionar / modificar / traducir el PDF, o cuando otra tool " +
      "consume el HTML directamente. Para compartir con el cliente preferí pdf_url (de obtener_cotizacion_por_id) — es más liviano.",
    input_schema: {
      type: "object",
      properties: {
        pdf_id: { type: "string", description: "UUID de la cotización" },
      },
      required: ["pdf_id"],
    },
  },

  {
    name: "programar_seguimiento",
    description:
      "Programa un follow-up interno para el operador (recordatorio): \"recordame en 3 días llamar a Juan\", " +
      "\"agendá seguimiento para el lunes\", \"avisame cuando expire la cotización X\". " +
      "REQUIERE user_confirmed=true — el server rechaza si falta. " +
      "Pasá title (qué) + uno de daysUntil (días desde hoy) o nextFollowUpAt (ISO date / 'YYYY-MM-DD'). Tags opcional.",
    input_schema: {
      type: "object",
      properties: {
        title:           { type: "string", description: "Qué hay que hacer (ej: 'Llamar a Juan Pérez por cotización ABC123')" },
        detail:          { type: "string", description: "Detalles opcionales / contexto" },
        daysUntil:       { type: "number", description: "Días desde hoy hasta el follow-up. Mutuamente exclusivo con nextFollowUpAt." },
        nextFollowUpAt:  { type: "string", description: "Fecha ISO o 'YYYY-MM-DD'. Mutuamente exclusivo con daysUntil." },
        tags:            { type: "array", items: { type: "string" }, description: "Tags libres (ej: ['cotizacion', 'cliente-juan'])" },
        user_confirmed:  { type: "boolean", description: "OBLIGATORIO=true. Confirma que el usuario aprobó programar el recordatorio." },
      },
      required: ["title", "user_confirmed"],
    },
  },

  {
    name: "historial_cliente",
    description:
      "Devuelve el historial completo de un cliente: filas en CRM_Operativo + cotizaciones del registry, " +
      "agrupadas y ordenadas por fecha desc. Usar cuando el usuario pregunta " +
      "\"¿qué tenemos del cliente X?\", \"mostrame todo lo de Juan Pérez\", \"historial de María\". " +
      "Compone buscar_cliente_crm + listar_cotizaciones_recientes — más útil que llamar las dos por separado.",
    input_schema: {
      type: "object",
      properties: {
        cliente: { type: "string", description: "Nombre o teléfono del cliente" },
        limite:  { type: "number", description: "Máx filas/cotizaciones por sección. Default 10." },
      },
      required: ["cliente"],
    },
  },

  {
    name: "recuperar_casos_similares",
    description:
      "Busca cotizaciones históricas similares usando búsqueda semántica (RAG sobre quote_embeddings en Postgres). " +
      "Devuelve casos reales de obras pasadas (cliente, familia de panel, espesor, m², precio total, similitud). " +
      "Úsala cuando quieras fundamentar una recomendación, precio o propuesta con datos reales: " +
      "'en obras similares de 150-200m² con ISOROOF qué cobramos', 'qué pidieron clientes industriales como este', 'casos parecidos para justificar el flete'. " +
      "El 'query' debe ser una descripción rica y específica de la obra actual.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Descripción de la obra/requerimiento para buscar similitud semántica (ej: 'techo 180m2 ISOROOF_PLUS 100mm dos aguas cliente galpón industrial Montevideo')" },
        k: { type: "number", description: "Máximo de casos a devolver. Default 5, máximo 10." },
        threshold: { type: "number", description: "Similitud mínima requerida (0.4-0.95). Default 0.65" },
      },
      required: ["query"],
    },
  },

  {
    name: "leer_crm_taxonomia",
    description:
      "Lee la taxonomía de clasificación de una fila de CRM_Operativo (cols AL–AN): tipo de contacto " +
      "(cliente/proveedor/lead/interno/otro), tags y notas, más datos base de la misma fila (cliente, consulta). " +
      "Usar después de buscar_cliente_crm cuando el usuario dio un número de fila o querés verificar etiquetas en Sheets.",
    input_schema: {
      type: "object",
      properties: {
        row: { type: "number", description: "Número de fila en CRM_Operativo (≥4, misma convención que buscar_cliente_crm.row)" },
      },
      required: ["row"],
    },
  },

  {
    name: "escribir_crm_taxonomia",
    description:
      "Escribe en CRM_Operativo las columnas AL–AN: tipo de contacto, tags (texto o lista) y notas libres. " +
      "Solo actualiza los campos que pasás (no borra el resto). " +
      "REQUIERE confirmación explícita del usuario (user_confirmed=true o frase autorizada en el mensaje). " +
      "Usar cuando el operador pide clasificar la fila (proveedor vs cliente, tags de obra, etc.).",
    input_schema: {
      type: "object",
      properties: {
        row: { type: "number", description: "Fila CRM (≥4)" },
        tipo_contacto: {
          type: "string",
          enum: ["cliente", "proveedor", "lead", "interno", "otro"],
          description: "Opcional si solo actualizás tags/notas",
        },
        tags: {
          anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
          description: "Tags separados por coma y/o array de strings",
        },
        notas: { type: "string", description: "Notas de clasificación (col AN)" },
        user_confirmed: { type: "boolean", description: "OBLIGATORIO=true salvo que el mensaje del usuario ya autorizó la herramienta." },
      },
      required: ["row", "user_confirmed"],
    },
  },

  // ─── Wolfboard Hub (admin cotizaciones management) ─────────────────────────

  {
    name: "wolfboard_pendientes",
    description:
      "Lista filas pendientes del Wolfboard hub (Admin 2.0). " +
      "scope=consulta (default) → solo filas con consulta del cliente; scope=admin → todas las filas. " +
      "Cada fila trae: rowNum, fecha, cliente, telefono, origen (WA/EM/CL/LO/LL), zona, consulta, respuestaAI, linkDrive, estado, replaySnapshotUrl. " +
      "Usar para listar lo que está pendiente de respuesta o aprobación.",
    input_schema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["consulta", "admin"], description: "Default: consulta" },
      },
    },
  },

  {
    name: "wolfboard_export",
    description:
      "Exporta el listado del Wolfboard hub como CSV (mismo criterio que wolfboard_pendientes). " +
      "Usar cuando el operador pide \"bajame el CSV de pendientes\" / \"exportá la lista para Excel\".",
    input_schema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["consulta", "admin"], description: "Default: consulta" },
      },
    },
  },

  {
    name: "wolfboard_sync",
    description:
      "Propaga las respuestas del Admin Wolfboard (col J) hacia CRM_Operativo (col AF), " +
      "matcheando por consulta original. Operación batch: actualiza todas las filas del Admin que tienen respuesta válida. " +
      "REQUIERE user_confirmed=true. SOLO con confirmación explícita (\"sincronizá Wolfboard\", \"propagá las respuestas al CRM\").",
    input_schema: {
      type: "object",
      properties: {
        user_confirmed: { type: "boolean", description: "OBLIGATORIO=true." },
      },
      required: ["user_confirmed"],
    },
  },

  {
    name: "wolfboard_actualizar_fila",
    description:
      "Actualiza una fila específica del Admin Wolfboard. Permite escribir respuestaAI (col J), " +
      "linkDrive (col K), estado (col L), o replaySnapshotUrl (col M). " +
      "REQUIERE user_confirmed=true. Usar cuando el operador edita una respuesta antes de enviarla al cliente.",
    input_schema: {
      type: "object",
      properties: {
        rowNum:             { type: "number", description: "Número de fila (1-based, fila 2 = primer registro)" },
        respuesta:          { type: "string", description: "Texto de respuesta para col J" },
        linkDrive:          { type: "string", description: "URL al PDF / Drive para col K" },
        estado:             { type: "string", description: "Estado para col L (ej: 'Aprobado', 'En revisión')" },
        replaySnapshotUrl:  { type: "string", description: "URL al snapshot JSON para col M" },
        user_confirmed:     { type: "boolean", description: "OBLIGATORIO=true." },
      },
      required: ["rowNum", "user_confirmed"],
    },
  },

  {
    name: "wolfboard_marcar_enviado",
    description:
      "Marca una fila Admin como enviada al cliente: la mueve al tab 'Enviados' y la borra del Admin. " +
      "REQUIERE user_confirmed=true. SOLO después de que el operador confirma el envío al cliente.",
    input_schema: {
      type: "object",
      properties: {
        rowNum:         { type: "number", description: "Número de fila a mover" },
        user_confirmed: { type: "boolean", description: "OBLIGATORIO=true." },
      },
      required: ["rowNum", "user_confirmed"],
    },
  },

  {
    name: "wolfboard_quote_batch",
    description:
      "Genera respuestas comerciales con IA (Claude Haiku) para todas las filas pendientes del Admin que tienen consulta válida (≥20 chars). " +
      "Escribe la respuesta en col J. Operación batch — puede afectar muchas filas. " +
      "REQUIERE user_confirmed=true. Pasá force=true para regenerar respuestas existentes.",
    input_schema: {
      type: "object",
      properties: {
        force:          { type: "boolean", description: "Si true, regenera respuestas que ya estaban completadas. Default false." },
        user_confirmed: { type: "boolean", description: "OBLIGATORIO=true." },
      },
      required: ["user_confirmed"],
    },
  },

  // New: list recent user-submitted bug reports (with logs, severity, optional screenshot URLs).
  // Powers "recent bugs" list in Wolfboard hub + AI-assisted triage/debug (ties into WOLF flows).
  {
    name: "list_bug_reports",
    description:
      "Lista reportes recientes de bugs enviados por usuarios desde la interfaz (incluye logs capturados, ruta, severidad y URLs de capturas de pantalla si se adjuntaron). " +
      "Úsalo para triage de problemas reportados, ver contexto de errores en calculadora o Wolfboard, o alimentar investigación de bugs WOLF. " +
      "Soporta filtros simples (limit, severity). Lectura protegida (usa token de ops).",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Máx. resultados (default 20, máx 100)" },
        severity: { type: "string", description: "Filtrar por severidad exacta: baja|media|alta|critica" },
        routeContains: { type: "string", description: "Filtrar reportes cuya URL contenga este texto (ej. 'wolfboard' o '/hub/cotizaciones')" },
      },
    },
  },

  // ─── TraKtiMe (time tracking) — driven on behalf of the logged-in user ──────
  // These act *as* the user: they require a user JWT (forwarded from the chat
  // session or passed as user_jwt). Reads are protected (return a user's own
  // time data); start/stop/create are writes and need explicit confirmation.
  {
    name: "traktime_timer_current",
    description:
      "TraKtiMe: devuelve el timer en curso del usuario (si hay uno corriendo), con proyecto, inicio y segundos transcurridos. Úsalo antes de iniciar/detener para no duplicar.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "traktime_timer_start",
    description:
      "TraKtiMe: inicia un timer para un proyecto (y tarea opcional). ACCIÓN DE ESCRITURA: requiere confirmación explícita del usuario. Falla con 409 si ya hay un timer corriendo.",
    input_schema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "UUID del proyecto TraKtiMe" },
        task_id: { type: "string", description: "UUID de la tarea (opcional)" },
        description: { type: "string", description: "Descripción libre (opcional)" },
        tags: { type: "array", items: { type: "string" }, description: "Tags (opcional)" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "traktime_timer_stop",
    description:
      "TraKtiMe: detiene el timer activo del usuario y cierra la entrada. ACCIÓN DE ESCRITURA: requiere confirmación explícita.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "traktime_list_entries",
    description:
      "TraKtiMe: lista las entradas de tiempo del usuario, filtrables por proyecto y rango de fechas. Lectura protegida.",
    input_schema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Filtrar por proyecto (opcional)" },
        from: { type: "string", description: "Desde (ISO 8601, opcional)" },
        to: { type: "string", description: "Hasta (ISO 8601, opcional)" },
        limit: { type: "number", description: "Máx entradas (default 50, máx 1000)" },
      },
    },
  },
  {
    name: "traktime_create_entry",
    description:
      "TraKtiMe: crea una entrada de tiempo cerrada (con inicio y fin explícitos), p. ej. para registrar trabajo pasado. ACCIÓN DE ESCRITURA: requiere confirmación explícita.",
    input_schema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "UUID del proyecto" },
        started_at: { type: "string", description: "Inicio (ISO 8601)" },
        stopped_at: { type: "string", description: "Fin (ISO 8601)" },
        task_id: { type: "string", description: "UUID de la tarea (opcional)" },
        description: { type: "string", description: "Descripción libre (opcional)" },
        billable: { type: "boolean", description: "¿Facturable? (default true)" },
      },
      required: ["project_id", "started_at", "stopped_at"],
    },
  },
  {
    name: "traktime_day_report",
    description:
      "TraKtiMe: reporte de jornada de un día (UY-local) — entradas ordenadas, gaps de coordinación/pausa, tiempo efectivo, span de jornada e idle. Lectura protegida.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Fecha YYYY-MM-DD (UY-local)" },
        user: { type: "string", description: "user_id (solo admin; default: el propio usuario)" },
      },
      required: ["date"],
    },
  },
  {
    name: "traktime_month_report",
    description:
      "TraKtiMe: reporte mensual de horas (para administración). Devuelve totales por día + rollup por cliente/proyecto y una ruta autenticada para descargar el PDF. Lectura protegida.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "string", description: "Mes YYYY-MM" },
        user: { type: "string", description: "user_id (solo admin; default: el propio usuario)" },
      },
      required: ["month"],
    },
  },
  {
    name: "traktime_billable_report",
    description:
      "TraKtiMe: horas no facturadas agrupadas por proyecto+cliente con redondeo y monto USD (preview de facturación). Solo admin. Lectura protegida.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string", description: "Filtrar por cliente (opcional)" },
        from: { type: "string", description: "Desde (ISO 8601, opcional)" },
        to: { type: "string", description: "Hasta (ISO 8601, opcional)" },
      },
    },
  },
  {
    name: "traktime_suggest_entry",
    description:
      "TraKtiMe ('casi-automático'): reúne el contexto del usuario (timer en curso + entradas recientes + hora actual) para que propongas un borrador de entrada/categorización que el usuario confirme con una palabra. NO escribe nada; solo lee contexto.",
    input_schema: {
      type: "object",
      properties: {
        lookback_hours: { type: "number", description: "Ventana de entradas recientes a mirar (default 24)" },
      },
    },
  },
];

// ─── Tool handlers ────────────────────────────────────────────────────────────

function fmt2(n) {
  return typeof n === "number" ? +n.toFixed(2) : n;
}

/**
 * Return a JSON-stringified `{ ok:false, error }` if any of `names` is
 * missing/empty in `input`, otherwise null. Lets executors short-circuit
 * with `const err = requireField(input, "pdf_id"); if (err) return err;`
 * instead of the same hand-written conditional everywhere.
 */
function requireField(input, ...names) {
  for (const n of names) {
    const v = input?.[n];
    if (v == null || v === "") {
      return JSON.stringify({ ok: false, error: `${n} requerido` });
    }
  }
  return null;
}

/**
 * Two-path confirmation guard for write tools.
 *
 * Chat path (opts.approvedActions is a Set): the user's last message was
 * classified server-side; the tool fires only if its name is in the set.
 * The model cannot fabricate this set — it comes from the user's words.
 *
 * MCP / external path (opts.approvedActions is undefined): the request
 * came through /api/agent/exec-tool which already enforced Bearer auth.
 * We fall back to the legacy `user_confirmed: true` flag so external
 * automation keeps working — but the threat model is different (auth'd).
 *
 * @returns {string|null} JSON-stringified rejection if guard fails, null otherwise.
 */
function requireConfirmedAction(name, input, opts) {
  if (opts?.approvedActions instanceof Set) {
    if (opts.approvedActions.has(name)) return null;
    const phrases = INTENT_HINTS[name] || [];
    return JSON.stringify({
      ok: false,
      error: "Esperá que el usuario confirme explícitamente la acción en sus propias palabras antes de llamar esta tool.",
      hint: phrases.length > 0 ? `Frases que cuentan: ${phrases.join(" / ")}` : undefined,
    });
  }
  if (input?.user_confirmed === true) return null;
  return JSON.stringify({ ok: false, error: "requiere confirmación explícita del usuario (user_confirmed=true)" });
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
 * Execute a tool call and return the result string. Public entry point —
 * wraps the impl with telemetry (latency, ok/error, error class) so the
 * dev panel can surface per-tool health without log scraping.
 * @param {string} name
 * @param {object} input
 * @param {object} calcState
 * @param {object} [opts]
 * @param {(action:object)=>void} [opts.emitAction]
 * @returns {Promise<string>} JSON-stringified result
 */
export async function executeTool(name, input, calcState = {}, opts = {}) {
  const t0 = Date.now();
  let raw = "";
  let parsed = null;
  let ok = false;
  let errorClass = null;

  try {
    raw = await executeToolImpl(name, input, calcState, opts);
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
    if (parsed && typeof parsed === "object") {
      // Tools return either { ok: true, ... } or { error: "..." } / { ok: false, error: "..." }.
      if (parsed.ok === true) ok = true;
      else if (parsed.ok === false) {
        ok = false;
        errorClass = classifyError(parsed.error);
      } else if (parsed.error) {
        ok = false;
        errorClass = classifyError(parsed.error);
      } else {
        // No explicit ok/error → treat as success (e.g. read tools that return data only).
        ok = true;
      }
    } else {
      ok = false;
      errorClass = "internal:non_json";
    }
  } catch (err) {
    ok = false;
    errorClass = "internal:throw";
    raw = JSON.stringify({ error: err?.message || "Error desconocido" });
  } finally {
    const latencyMs = Date.now() - t0;
    recordToolCall({ tool: name, ok, latencyMs, errorClass });
    const logger = opts.logger;
    if (logger?.info) {
      logger.info(
        { event: "agent_tool_call", tool: name, ok, latency_ms: latencyMs, error_class: errorClass },
        "agent tool call",
      );
    }
  }

  return raw;
}

/**
 * Internal impl. Keep separate from executeTool so the public wrapper
 * can attach telemetry without polluting every branch.
 */
async function executeToolImpl(name, input, calcState = {}, opts = {}) {
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
      const t0 = Date.now();
      const { scenario, listaPrecios = "web", techo, pared, camara } = input;

      // Route through the same /calc/cotizar HTTP surface humans use, via
      // 127.0.0.1 loopback. This keeps the calc routes as the single source
      // of truth (advisory text, warnings, BOM shape) and means any future
      // middleware on /calc/cotizar applies to AE quotes automatically.
      const techoNorm = techo ? { ...techo, familia: normalizeFamilia(techo.familia) } : undefined;
      const paredNorm = pared ? { ...pared, familia: normalizeFamilia(pared.familia) } : undefined;

      const body = {
        lista: listaPrecios,
        escenario: scenario,
        flete: 0,
        source: "ae_agent",
        ...(techoNorm && { techo: techoNorm }),
        ...(paredNorm && { pared: paredNorm }),
        ...(camara && { camara }),
      };

      const result = await postCotizar(body);
      console.log(JSON.stringify({
        event: "ae_agent_quote",
        tool: "calcular_cotizacion",
        scenario,
        lista: listaPrecios,
        duration_ms: Date.now() - t0,
        ok: result.ok,
      }));

      if (!result.ok) {
        return JSON.stringify({ error: result.error || "Error al calcular cotización" });
      }
      const gpt = result.body || {};
      const out = {
        scenario,
        listaPrecios,
        subtotalSinIVA: gpt.resumen?.subtotal_usd,
        totalConIVA: gpt.resumen?.total_usd,
        iva22: gpt.resumen?.iva_usd,
        area_m2: gpt.resumen?.area_m2,
        cant_paneles: gpt.resumen?.cant_paneles,
        autoportancia: gpt.autoportancia || null,
        warnings: gpt.advertencias || [],
      };
      if (scenario === "camara_frig" && camara) {
        out.camara_dims = `${camara.largo_int}×${camara.ancho_int}×${camara.alto_int}m`;
      }
      return JSON.stringify(out);
    }

    if (name === "generar_pdf") {
      const t0 = Date.now();
      const { scenario, listaPrecios = "web", techo, pared, camara, flete = 0, cliente = {} } = input;

      // Map tool input to /calc/cotizar/pdf body format. `source: "ae_agent"`
      // marks the registry entry as agent-generated for downstream audit
      // (listar_cotizaciones_recientes / historial_cliente surface this field).
      const body = {
        lista: listaPrecios,
        escenario: scenario,
        flete,
        cliente,
        source: "ae_agent",
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

      const result = await postCotizarPdf(body);
      const data = result.body || {};

      // Structured log event for durable out-of-process audit (Cloud Logging /
      // pino scrapers can filter on event="ae_agent_quote"). Never includes
      // full cliente body — only PII-free fields.
      console.log(JSON.stringify({
        event: "ae_agent_quote",
        tool: "generar_pdf",
        scenario,
        lista: listaPrecios,
        duration_ms: Date.now() - t0,
        ok: result.ok,
        pdf_id: data.pdf_id || null,
      }));

      if (!result.ok) return JSON.stringify({ error: result.error || data.error || "Error al generar PDF" });

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
      const t0 = Date.now();
      const lista = input?.lista === "venta" ? "venta" : "web";
      const body = {
        lista,
        librePanelLines: Array.isArray(input?.librePanelLines) ? input.librePanelLines : [],
        librePerfilQty: input?.librePerfilQty || {},
        libreFijQty: input?.libreFijQty || {},
        libreSellQty: input?.libreSellQty || {},
        flete: Number(input?.flete || 0),
        libreExtra: input?.libreExtra || {},
        source: "ae_agent",
      };
      const result = await postPresupuestoLibre(body);
      const data = result.body || {};
      console.log(JSON.stringify({
        event: "ae_agent_quote",
        tool: "presupuesto_libre",
        lista,
        duration_ms: Date.now() - t0,
        ok: result.ok,
      }));
      if (!result.ok) return JSON.stringify({ error: result.error || data.error || "Error en presupuesto libre" });
      return JSON.stringify({
        ok: true,
        resumen: data.resumen,
        bom: data.bom,
        advertencias: data.advertencias || [],
        texto_resumen: data.texto_resumen,
      });
    }

    if (name === "listar_cotizaciones_recientes") {
      // Direct registry call — bypasses HTTP/auth roundtrip and pushes
      // filtering server-side so matches outside the first page are not
      // silently dropped (Copilot finding).
      const cliente = String(input?.cliente || "").trim();
      const source = input?.source && ["ae_agent", "calculator"].includes(input.source) ? input.source : null;
      const includeCancelled = input?.include_cancelled === true;
      const limit = Math.max(1, Math.min(50, Number(input?.limite || 10)));
      try {
        const entries = await listQuotationsFromRegistry({
          limit,
          includeCancelled,
          cliente: cliente || null,
          source,
        });
        return JSON.stringify({ ok: true, count: entries.length, cotizaciones: entries });
      } catch (err) {
        return JSON.stringify({ error: err.message || "Error al listar cotizaciones" });
      }
    }

    if (name === "obtener_cotizacion_por_id") {
      const missing = requireField(input, "pdf_id");
      if (missing) return missing;
      const id = String(input.pdf_id).trim();
      // Direct registry lookup — fixes Codex/Copilot finding that the prior
      // list-then-find missed quotes outside the first 50 or marked cancelled.
      const entry = await getQuotationFromRegistry(id);
      if (!entry) return JSON.stringify({ error: `Cotización ${id} no encontrada en el registry` });
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
        source: entry.source || "calculator",
        status: entry.status || "active",
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
      const missing = requireField(input, "scenario");
      if (missing) return missing;
      const { scenario, techo, pared, camara } = input || {};
      const baseInput = { scenario, techo, pared, camara };
      const [webRaw, ventaRaw] = await Promise.all([
        executeTool("calcular_cotizacion", { ...baseInput, listaPrecios: "web" }, calcState, opts),
        executeTool("calcular_cotizacion", { ...baseInput, listaPrecios: "venta" }, calcState, opts),
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
      { const _conf = requireConfirmedAction(name, input, opts); if (_conf) return _conf; }
      const dualResult = await dualWriteQuote({
        cliente_nombre: input?.cliente,
        cliente: input?.cliente,
        telefono: input?.telefono,
        ubicacion: input?.ubicacion,
        scenario: input?.scenario,
        lista: input?.lista,
        total_con_iva_usd: input?.total,
        total: input?.total,
        pdf_url: input?.pdf_url,
        drive_url: input?.drive_url,
        vendedor: input?.vendedor,
        tipo_cliente: input?.tipo_cliente,
        urgencia: input?.urgencia,
        probabilidad_cierre: input?.probabilidad_cierre,
        observaciones: input?.observaciones,
        canal_origen: "panelin_chat",
      });
      // El agente solo necesita ver el resultado del CRM canónico
      return JSON.stringify(dualResult.crm);
    }

    if (name === "buscar_cliente_crm") {
      const result = await searchCrmClients({
        query: input?.query,
        limite: input?.limite,
      });
      return JSON.stringify(result);
    }

    if (name === "leer_crm_taxonomia") {
      const row = Number(input?.row);
      if (!row || row < 4) return JSON.stringify({ ok: false, error: "row debe ser un número >= 4" });
      const result = await readCrmRowTaxonomy(row);
      return JSON.stringify(result);
    }

    if (name === "escribir_crm_taxonomia") {
      { const _conf = requireConfirmedAction(name, input, opts); if (_conf) return _conf; }
      const row = Number(input?.row);
      if (!row || row < 4) return JSON.stringify({ ok: false, error: "row debe ser un número >= 4" });
      const hasTipo = input?.tipo_contacto !== undefined && input?.tipo_contacto !== null && String(input.tipo_contacto).trim() !== "";
      const hasTags = input?.tags !== undefined && input?.tags !== null && (Array.isArray(input.tags) ? input.tags.length > 0 : String(input.tags).trim() !== "");
      const hasNotas = input?.notas !== undefined && input?.notas !== null && String(input.notas).trim() !== "";
      if (!hasTipo && !hasTags && !hasNotas) {
        return JSON.stringify({ ok: false, error: "Pasá al menos uno de: tipo_contacto, tags, notas" });
      }
      const result = await writeCrmRowTaxonomy(row, {
        tipoContacto: hasTipo ? input.tipo_contacto : undefined,
        tags: hasTags ? input.tags : undefined,
        notas: hasNotas ? input.notas : undefined,
      });
      return JSON.stringify(result);
    }

    if (name === "enviar_whatsapp_link") {
      { const _conf = requireConfirmedAction(name, input, opts); if (_conf) return _conf; }
      const to = String(input?.to || "").trim();
      if (!to) return JSON.stringify({ ok: false, error: "to (teléfono del cliente) es requerido" });
      if (!config.whatsappAccessToken || !config.whatsappPhoneNumberId) {
        return JSON.stringify({ ok: false, error: "WhatsApp no configurado (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)" });
      }
      // Compose default message if `text` not provided
      let text = String(input?.text || "").trim();
      if (!text) {
        const cliente = String(input?.cliente || "").trim();
        const total = Number(input?.total || 0);
        const pdfUrl = String(input?.pdf_url || "").trim();
        if (!pdfUrl) return JSON.stringify({ ok: false, error: "pdf_url requerido cuando no se pasa text override" });
        const greeting = cliente ? `Hola ${cliente}, ` : "Hola, ";
        const totalLine = Number.isFinite(total) && total > 0 ? `\nTotal: USD ${total.toFixed(2)} c/IVA.` : "";
        text = `${greeting}te paso la cotización de BMC Uruguay:${totalLine}\n${pdfUrl}\n\nAbrila en el navegador y se imprime como PDF desde Archivo → Imprimir. Saludos, BMC Uruguay.`;
      }
      try {
        const data = await sendWhatsAppText({
          to,
          text,
          accessToken: config.whatsappAccessToken,
          phoneNumberId: config.whatsappPhoneNumberId,
        });
        const messageId = data?.messages?.[0]?.id || null;
        return JSON.stringify({
          ok: true,
          to: String(to).replace(/\D/g, ""),
          message_id: messageId,
          text_preview: text.slice(0, 120),
        });
      } catch (err) {
        return JSON.stringify({ ok: false, error: err.message || "Error al enviar WhatsApp" });
      }
    }

    if (name === "comparar_escenarios") {
      const { scenario_a, scenario_b, listaPrecios = "web", techo, pared, camara } = input || {};
      if (!scenario_a || !scenario_b) return JSON.stringify({ error: "scenario_a y scenario_b requeridos" });
      const baseInput = { listaPrecios, techo, pared, camara };
      const [aRaw, bRaw] = await Promise.all([
        executeTool("calcular_cotizacion", { ...baseInput, scenario: scenario_a }, calcState, opts),
        executeTool("calcular_cotizacion", { ...baseInput, scenario: scenario_b }, calcState, opts),
      ]);
      const a = JSON.parse(aRaw);
      const b = JSON.parse(bRaw);
      if (a.error) return JSON.stringify({ error: `${scenario_a}: ${a.error}` });
      if (b.error) return JSON.stringify({ error: `${scenario_b}: ${b.error}` });
      const totalA = Number(a.totalConIVA || 0);
      const totalB = Number(b.totalConIVA || 0);
      const deltaUsd = +(totalB - totalA).toFixed(2);
      const deltaPct = totalA > 0 ? +((deltaUsd / totalA) * 100).toFixed(2) : 0;
      return JSON.stringify({
        ok: true,
        listaPrecios,
        a: { scenario: scenario_a, subtotalSinIVA: a.subtotalSinIVA, totalConIVA: totalA },
        b: { scenario: scenario_b, subtotalSinIVA: b.subtotalSinIVA, totalConIVA: totalB },
        delta_usd: deltaUsd,
        delta_pct: deltaPct,
        nota: deltaUsd > 0
          ? `${scenario_b} es USD ${deltaUsd} (${deltaPct}%) más caro que ${scenario_a}.`
          : deltaUsd < 0
            ? `${scenario_b} es USD ${Math.abs(deltaUsd)} (${Math.abs(deltaPct)}%) más barato que ${scenario_a}.`
            : `${scenario_a} y ${scenario_b} cuestan lo mismo en esta combinación.`,
      });
    }

    if (name === "cancelar_cotizacion") {
      { const _conf = requireConfirmedAction(name, input, opts); if (_conf) return _conf; }
      const missing = requireField(input, "pdf_id");
      if (missing) return missing;
      const pdfId = String(input.pdf_id).trim();
      const motivo = String(input?.motivo || "").trim();
      // Direct registry call — bypass HTTP/auth roundtrip. The HTTP route is
      // now requireAuth-gated for external callers; in-process agent uses the
      // intent-classifier gate above (requireConfirmedAction) instead.
      const result = await cancelQuotationInRegistry(pdfId, { reason: motivo, by: "panelin-chat" });
      if (!result.ok) return JSON.stringify({ ok: false, error: result.error || "Error al cancelar cotización" });
      const entry = result.entry || {};
      return JSON.stringify({
        ok: true,
        id: entry.id,
        status: entry.status,
        cancelledAt: entry.cancelledAt,
        cancelReason: entry.cancelReason,
        alreadyCancelled: !!result.alreadyCancelled,
      });
    }

    if (name === "obtener_pdf_html") {
      const missing = requireField(input, "pdf_id");
      if (missing) return missing;
      const id = String(input.pdf_id).trim();
      // Direct in-process read from pdfStore (still 24h TTL — HTML is a
      // regenerable artifact). No HTTP, no auth roundtrip.
      const html = getPdf(id);
      if (!html) return JSON.stringify({ ok: false, error: `Cotización ${id} no encontrada o expirada` });
      return JSON.stringify({
        ok: true,
        pdf_id: id,
        html,
        length: html.length,
        viewer_url: `${apiBase()}/calc/pdf/${id}`,
      });
    }

    if (name === "programar_seguimiento") {
      { const _conf = requireConfirmedAction(name, input, opts); if (_conf) return _conf; }
      const missing = requireField(input, "title");
      if (missing) return missing;
      const title = String(input.title).trim();

      let due = null;
      if (input?.nextFollowUpAt) {
        try { due = parseDueInput(String(input.nextFollowUpAt)); } catch { /* ignore */ }
      }
      if (!due && input?.daysUntil != null) {
        try { due = parseDays(Number(input.daysUntil)); } catch { /* ignore */ }
      }

      const tags = Array.isArray(input?.tags) ? input.tags.filter((t) => typeof t === "string") : [];

      try {
        const store = loadFollowupStore();
        const item = addFollowupItem(store, {
          title,
          detail: input?.detail ? String(input.detail) : "",
          tags,
          nextFollowUpAt: due,
        });
        saveFollowupStore(store);
        return JSON.stringify({
          ok: true,
          id: item.id,
          title: item.title,
          nextFollowUpAt: item.nextFollowUpAt,
          tags: item.tags,
          status: item.status,
        });
      } catch (err) {
        return JSON.stringify({ ok: false, error: err.message || "Error al programar seguimiento" });
      }
    }

    if (name === "historial_cliente") {
      const missing = requireField(input, "cliente");
      if (missing) return missing;
      const cliente = String(input.cliente).trim();
      const limite = Math.max(1, Math.min(50, Number(input?.limite || 10)));

      const [crmRaw, quotesRaw] = await Promise.all([
        executeTool("buscar_cliente_crm", { query: cliente, limite }, calcState, opts),
        executeTool("listar_cotizaciones_recientes", { cliente, limite }, calcState, opts),
      ]);
      const crm = JSON.parse(crmRaw);
      const quotes = JSON.parse(quotesRaw);

      const crmRows = crm.ok ? (crm.matches || []) : [];
      const quoteRows = quotes.ok ? (quotes.cotizaciones || []) : [];

      return JSON.stringify({
        ok: true,
        cliente,
        crm: {
          available: crm.ok,
          error: crm.ok ? null : crm.error || null,
          count: crmRows.length,
          rows: crmRows,
        },
        cotizaciones: {
          available: quotes.ok,
          error: quotes.ok ? null : quotes.error || null,
          count: quoteRows.length,
          items: quoteRows,
        },
        nota: !crm.ok && !quotes.ok
          ? "No hay datos disponibles para este cliente (CRM/registry no configurados o sin matches)."
          : null,
      });
    }

    if (name === "recuperar_casos_similares") {
      const query = String(input?.query || "").trim();
      if (!query || query.length < 3) {
        return JSON.stringify({ ok: false, error: "query es requerido (descripción rica de la obra actual, mínimo 3 caracteres)" });
      }
      const k = Math.max(1, Math.min(10, Number(input?.k || 5)));
      const threshold = Math.max(0.4, Math.min(0.95, Number(input?.threshold || 0.65)));

      try {
        const results = await retrieveSimilarQuotes(query, k, threshold);
        const contexto = formatRetrievedContextForPrompt(results);

        return JSON.stringify({
          ok: true,
          query,
          k,
          threshold,
          count: results.length,
          cases: results,
          contexto_markdown: contexto,   // ya formateado, listo para mostrar al usuario o razonar
          nota: results.length === 0
            ? "No se encontraron casos con suficiente similitud (RAG puede estar desactivado o no hay datos históricos similares)."
            : null,
        });
      } catch (err) {
        return JSON.stringify({ ok: false, error: `Error consultando casos similares: ${err.message}` });
      }
    }

    if (name === "wolfboard_pendientes" || name === "wolfboard_export") {
      const scope = (input?.scope === "admin") ? "admin" : "consulta";
      const path = name === "wolfboard_export"
        ? `/api/wolfboard/export?scope=${scope}`
        : `/api/wolfboard/pendientes?scope=${scope}`;
      return await wolfboardForward(path, { method: "GET" }, name);
    }

    if (name === "wolfboard_sync") {
      { const _conf = requireConfirmedAction(name, input, opts); if (_conf) return _conf; }
      return await wolfboardForward("/api/wolfboard/sync", { method: "POST", body: {} }, name);
    }

    if (name === "wolfboard_actualizar_fila") {
      { const _conf = requireConfirmedAction(name, input, opts); if (_conf) return _conf; }
      const rowNum = Number(input?.rowNum);
      if (!Number.isFinite(rowNum) || rowNum < 2) {
        return JSON.stringify({ ok: false, error: "rowNum (>=2) requerido" });
      }
      const body = { rowNum };
      if (input?.respuesta != null) body.respuesta = String(input.respuesta);
      if (input?.linkDrive != null) body.linkDrive = String(input.linkDrive);
      if (input?.estado != null) body.estado = String(input.estado);
      if (input?.replaySnapshotUrl != null) body.replaySnapshotUrl = String(input.replaySnapshotUrl);
      return await wolfboardForward("/api/wolfboard/row", { method: "POST", body }, name);
    }

    if (name === "wolfboard_marcar_enviado") {
      { const _conf = requireConfirmedAction(name, input, opts); if (_conf) return _conf; }
      const rowNum = Number(input?.rowNum);
      if (!Number.isFinite(rowNum) || rowNum < 2) {
        return JSON.stringify({ ok: false, error: "rowNum (>=2) requerido" });
      }
      return await wolfboardForward("/api/wolfboard/enviados", { method: "POST", body: { rowNum } }, name);
    }

    if (name === "wolfboard_quote_batch") {
      { const _conf = requireConfirmedAction(name, input, opts); if (_conf) return _conf; }
      const body = { force: !!input?.force };
      return await wolfboardForward("/api/wolfboard/quote-batch", { method: "POST", body }, name);
    }

    if (name === "list_bug_reports") {
      // Read-only; no user_confirmed required (safe list operation)
      const params = new URLSearchParams();
      if (input?.limit) params.set("limit", String(input.limit));
      if (input?.severity) params.set("severity", String(input.severity));
      if (input?.routeContains) params.set("routeContains", String(input.routeContains));
      const qs = params.toString() ? `?${params.toString()}` : "";
      // Reuse the same forward pattern (server-side token) but hit the bugs surface
      return await bugsForward(`/api/bugs${qs}`, { method: "GET" }, name);
    }

    // ─── TraKtiMe tools ────────────────────────────────────────────────────
    if (name.startsWith("traktime_")) {
      // The agent acts as the user: forward their JWT (from the chat session
      // via opts.callerAuthToken, or an explicit input.user_jwt). No token →
      // honest auth error rather than a silent 401.
      const authToken = opts?.callerAuthToken || input?.user_jwt || null;
      if (!authToken) {
        return JSON.stringify({
          ok: false,
          error: "traktime_requires_user_identity",
          hint: "Esta acción opera sobre el tiempo de un usuario; necesita su sesión (JWT). Iniciá sesión o pasá user_jwt.",
        });
      }
      const o = { authToken };

      if (name === "traktime_timer_current") {
        const r = await tkTimerCurrent(o);
        if (!r.ok) return JSON.stringify({ ok: false, error: r.error });
        const e = r.body?.running;
        return JSON.stringify({
          ok: true,
          running: !!e,
          entry_id: e?.entry_id || null,
          project_id: e?.project_id || null,
          project_name: e?.project_name || null,
          started_at: e?.started_at || null,
          elapsed_seconds: e ? Math.max(0, Math.round((Date.now() - new Date(e.started_at)) / 1000)) : 0,
        });
      }

      if (name === "traktime_timer_start") {
        { const _conf = requireConfirmedAction(name, input, opts); if (_conf) return _conf; }
        if (!input?.project_id) return JSON.stringify({ ok: false, error: "project_id requerido" });
        const body = { project_id: input.project_id };
        if (input.task_id) body.task_id = input.task_id;
        if (input.description) body.description = String(input.description);
        if (Array.isArray(input.tags)) body.tags = input.tags.map(String);
        const r = await tkStartTimer(body, o);
        if (!r.ok) return JSON.stringify({ ok: false, error: r.error });
        return JSON.stringify({ ok: true, entry: r.body?.entry || null });
      }

      if (name === "traktime_timer_stop") {
        { const _conf = requireConfirmedAction(name, input, opts); if (_conf) return _conf; }
        const r = await tkStopTimer(o);
        if (!r.ok) return JSON.stringify({ ok: false, error: r.error });
        const e = r.body?.entry;
        return JSON.stringify({
          ok: true,
          entry_id: e?.entry_id || null,
          duration_seconds: e?.duration_seconds ?? null,
          started_at: e?.started_at || null,
          stopped_at: e?.stopped_at || null,
        });
      }

      if (name === "traktime_list_entries") {
        const query = {};
        if (input?.project_id) query.project_id = input.project_id;
        if (input?.from) query.from = input.from;
        if (input?.to) query.to = input.to;
        if (input?.limit) query.limit = Math.max(1, Math.min(1000, Number(input.limit) || 50));
        const r = await tkListEntries(query, o);
        if (!r.ok) return JSON.stringify({ ok: false, error: r.error });
        return JSON.stringify({
          ok: true,
          entries: (r.body?.entries || []).map((e) => ({
            entry_id: e.entry_id,
            project_id: e.project_id,
            project_name: e.project_name,
            client_name: e.client_name,
            description: e.description,
            started_at: e.started_at,
            stopped_at: e.stopped_at,
            duration_seconds: e.duration_seconds,
            billable: e.billable,
            tags: e.tags,
          })),
        });
      }

      if (name === "traktime_create_entry") {
        { const _conf = requireConfirmedAction(name, input, opts); if (_conf) return _conf; }
        const { project_id, started_at, stopped_at } = input || {};
        if (!project_id || !started_at || !stopped_at) {
          return JSON.stringify({ ok: false, error: "project_id, started_at y stopped_at requeridos" });
        }
        const body = { project_id, started_at, stopped_at };
        if (input.task_id) body.task_id = input.task_id;
        if (input.description) body.description = String(input.description);
        if (input.billable != null) body.billable = !!input.billable;
        const r = await tkCreateEntry(body, o);
        if (!r.ok) return JSON.stringify({ ok: false, error: r.error });
        return JSON.stringify({ ok: true, entry: r.body?.entry || null });
      }

      if (name === "traktime_day_report") {
        if (!input?.date) return JSON.stringify({ ok: false, error: "date (YYYY-MM-DD) requerido" });
        const query = { date: input.date };
        if (input.user) query.user = input.user;
        const r = await tkDayReport(query, o);
        if (!r.ok) return JSON.stringify({ ok: false, error: r.error });
        return JSON.stringify({ ok: true, date: r.body?.date, tz: r.body?.tz, day: r.body?.day });
      }

      if (name === "traktime_month_report") {
        if (!input?.month) return JSON.stringify({ ok: false, error: "month (YYYY-MM) requerido" });
        const query = { month: input.month };
        if (input.user) query.user = input.user;
        const r = await tkMonthReport(query, o);
        if (!r.ok) return JSON.stringify({ ok: false, error: r.error });
        return JSON.stringify({
          ok: true,
          month: r.body?.month,
          tz: r.body?.tz,
          totals: r.body?.report?.totals || null,
          projects: r.body?.report?.projects || [],
          pdf_url: r.body?.pdf_url || null,
          pdf_download_url: r.body?.pdf_download_url || null,
        });
      }

      if (name === "traktime_billable_report") {
        const query = {};
        if (input?.client_id) query.client_id = input.client_id;
        if (input?.from) query.from = input.from;
        if (input?.to) query.to = input.to;
        const r = await tkBillable(query, o);
        if (!r.ok) return JSON.stringify({ ok: false, error: r.error });
        return JSON.stringify({ ok: true, groups: r.body?.groups || [], subtotal_usd: r.body?.subtotal_usd });
      }

      if (name === "traktime_suggest_entry") {
        // Read-only context gather for an AI-proposed draft (no write).
        const lookbackHours = Math.max(1, Math.min(168, Number(input?.lookback_hours) || 24));
        const fromIso = new Date(Date.now() - lookbackHours * 3600 * 1000).toISOString();
        const [cur, recent] = await Promise.all([
          tkTimerCurrent(o),
          tkListEntries({ from: fromIso, limit: 20 }, o),
        ]);
        if (!cur.ok && cur.status === 401) {
          return JSON.stringify({ ok: false, error: cur.error || "no autorizado" });
        }
        const e = cur.body?.running;
        return JSON.stringify({
          ok: true,
          now: new Date().toISOString(),
          running_timer: e
            ? { project_id: e.project_id, project_name: e.project_name, started_at: e.started_at }
            : null,
          recent_entries: (recent.body?.entries || []).slice(0, 20).map((x) => ({
            project_name: x.project_name,
            description: x.description,
            started_at: x.started_at,
            stopped_at: x.stopped_at,
            duration_seconds: x.duration_seconds,
          })),
          note: "Proponé un borrador de entrada/categorización al usuario y pedí confirmación antes de escribir.",
        });
      }
    }

    return JSON.stringify({ error: `Tool "${name}" no implementada` });
  } catch (err) {
    return JSON.stringify({ error: err.message });
  }
}

/**
 * Forward a request to the Wolfboard router (mounted at /api/wolfboard).
 * The router enforces requireAuth(config, ...) on every route, so we
 * include the in-process API_AUTH_TOKEN as Bearer. If unset, return a
 * helpful config error instead of going through the round-trip.
 *
 * @param {string} path
 * @param {{ method:"GET"|"POST", body?:object }} opts
 * @param {string} toolName  — for error context only
 * @returns {Promise<string>} JSON-stringified result
 */
async function wolfboardForward(path, { method = "GET", body } = {}, toolName = "wolfboard_*") {
  if (!config.apiAuthToken) {
    return JSON.stringify({
      ok: false,
      error: "API_AUTH_TOKEN no configurado — el Wolfboard hub requiere autenticación. Configurá API_AUTH_TOKEN o API_KEY en el server.",
      tool: toolName,
    });
  }
  const headers = {
    Authorization: `Bearer ${config.apiAuthToken}`,
  };
  const init = { method, headers };
  if (method === "POST") {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body || {});
  }
  const url = `${apiBase()}${path}`;
  const resp = await fetch(url, init);
  const ct = resp.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      return JSON.stringify({ ok: false, status: resp.status, error: data?.error || `HTTP ${resp.status}`, tool: toolName });
    }
    return JSON.stringify({ ok: true, ...data });
  }
  // CSV / text response (wolfboard_export)
  const text = await resp.text();
  if (!resp.ok) {
    return JSON.stringify({ ok: false, status: resp.status, error: text.slice(0, 500), tool: toolName });
  }
  return JSON.stringify({
    ok: true,
    contentType: ct || "text/plain",
    body: text.length > 100_000 ? `${text.slice(0, 100_000)}\n\n[truncated to 100KB]` : text,
    length: text.length,
    tool: toolName,
  });
}

/**
 * Forward helper for the bugs surface (modeled exactly on wolfboardForward).
 * Used by list_bug_reports tool. Hits /api/bugs (protected by its own requireAuth on GET).
 */
async function bugsForward(path, { method = "GET", body } = {}, toolName = "bugs_*") {
  if (!config.apiAuthToken) {
    return JSON.stringify({
      ok: false,
      error: "API_AUTH_TOKEN no configurado — los reportes de bugs y su listado requieren autenticación de ops.",
      tool: toolName,
    });
  }
  const headers = { Authorization: `Bearer ${config.apiAuthToken}` };
  const init = { method, headers };
  if (method === "POST") {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body || {});
  }
  const url = `${apiBase()}${path}`;
  const resp = await fetch(url, init);
  const ct = resp.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      return JSON.stringify({ ok: false, status: resp.status, error: data?.error || `HTTP ${resp.status}`, tool: toolName });
    }
    return JSON.stringify({ ok: true, ...data });
  }
  const text = await resp.text();
  if (!resp.ok) {
    return JSON.stringify({ ok: false, status: resp.status, error: text.slice(0, 500), tool: toolName });
  }
  return JSON.stringify({
    ok: true,
    contentType: ct || "text/plain",
    body: text.length > 100_000 ? `${text.slice(0, 100_000)}\n\n[truncated]` : text,
    length: text.length,
    tool: toolName,
  });
}
