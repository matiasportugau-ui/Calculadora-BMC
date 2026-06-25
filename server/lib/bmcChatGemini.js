// web/gemini.mjs — Gemini integration with BMC interpretation + deterministic post-passes
import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_MODEL = process.env.BMC_GEMINI_MODEL || "gemini-2.5-flash";

function getGenAI(config) {
  const apiKey = config?.geminiApiKey;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  return new GoogleGenerativeAI(apiKey);
}

// Family thickness tables
const TECHO_FAMILIAS = {
  ISODEC_EPS: [100, 150, 200, 250],
  ISODEC_PIR: [50, 80, 120],
  ISOROOF_3G: [30, 40, 50, 80, 100],
  ISOROOF_FOIL: [30, 50],
  ISOROOF_COLONIAL: [40],
  ISOROOF_PLUS: [50, 80],
};
const PARED_FAMILIAS = {
  ISOPANEL_EPS: [50, 100, 150, 200, 250],
  ISOWALL_PIR: [50, 80, 100],
  ISOFRIG_PIR: [40, 60, 80, 100, 150, 200],
};

const ESPESOR_TABLE = "TECHO: " + Object.entries(TECHO_FAMILIAS).map(([f, e]) => `${f}(${e.join("/")})`).join(", ") + " | PARED: " + Object.entries(PARED_FAMILIAS).map(([f, e]) => `${f}(${e.join("/")})`).join(", ");
const ANCHO_UTIL_TABLE = "ISOPANEL_EPS=1.14m, ISODEC_EPS=1.12m, ISOROOF_3G=1.0m, ISOROOF_FOIL=1.0m, ISOROOF_COLONIAL=1.0m, ISOROOF_PLUS=1.0m";

const SYSTEM_PROMPT = `Sos un cotizador de BMC (paneles aislantes, Uruguay). Interpretás consultas de clientes y las traducís a los inputs de la Calculadora BMC.
REGLAS:
- Si la consulta NO es de paneles (es HM/sellador/adhesivo/accesorio), quotable=false y explicá en interpretation_J.
- NO inventes geometría que afecta el precio (medidas, área, espesor, escenario). Si falta, va a question_K y missing_L, NO la defaultees.
- Marcá supuestos con [inferido] en interpretation_J (ej: color=Blanco [inferido]).
- question_K: UNA sola pregunta, en español, amable, la de mayor valor.
- ready_to_quote=true solo si escenario + familia + espesor + geometría están todos conocidos (no defaulteados).
- CADA familia solo existe en ciertos espesores (mm). El espesor elegido DEBE existir en la familia elegida.
  Tabla: ${ESPESOR_TABLE}.
- Si el espesor que pide el cliente existe en VARIAS familias (ej: "Isoroof 30" → ISOROOF_3G y ISOROOF_FOIL ambas en 30mm), NO adivines una: poné ready_to_quote=false y preguntá en question_K cuál familia. NUNCA marques ready con una combinación familia+espesor que no exista en la tabla.
- FAMILIA NOMBRADA vs APLICACIÓN: si el cliente NOMBRA una familia (Isopanel/Isodec/Isowall/Isoroof…), esa familia manda. La palabra de aplicación (techo/pared/fachada) define el ESCENARIO/superficie, NO reemplaza la familia. Un panel EPS nombrado para techo se mapea a su equivalente deck ISODEC_EPS (mismo espesor), NUNCA a una familia ISOROOF. Ej: "Isopanel para techo 150mm" → escenario=solo_techo, techo.familia=ISODEC_EPS 150mm (válido), JAMÁS ISOROOF_3G (que no existe en 150). El espesor nombrado debe existir en la familia final.
- ACCESORIOS POR UNIDAD: si el cliente pide SOLO accesorios cotizados por unidad (canalón, babeta, gotero, cumbrera, tornillería, perfil) SIN una superficie de paneles a cubrir, quotable=false y explicá en interpretation_J: "accesorios por unidad → derivar a Manager (el calculador cotiza por área de panel, no por unidad)". Marcá accessory_only=true. (Si además hay paneles con área/largos, cotizá los paneles normalmente — los accesorios de remate van con el panel.)
- COTIZABLE = HAY PANEL NOMBRADO: si la consulta NOMBRA un panel (Isodec/Isopanel/Isoroof/Isowall/Isofrig…) — con o sin espesor, con o sin geometría completa — quotable=true SIEMPRE. Lo que falte (geometría, espesor, escenario) va a missing_L, NUNCA a quotable=false. Sólo poné quotable=false + accessory_only=true cuando NO se nombra ningún panel y se piden únicamente accesorios sueltos (ej "1 canalón de 100mm", "4 embudos").
- "ACTUALIZAR / AJUSTAR presupuesto" (+ panel y/o accesorios): es un pedido real que el equipo cotiza → quotable=true. NO lo descartes como no-cotizable.
- ANCHO ÚTIL: el ancho útil del PANEL es un dato FIJO de ficha por familia (${ANCHO_UTIL_TABLE}). El calculador lo aplica solo — NUNCA se lo preguntes al cliente ni lo pongas en question_K / missing_L. No confundas el "ancho útil del panel" (fijo) con el "ancho del ÁREA a cubrir" (techo: largo×ancho de la superficie; pared: alto + perímetro), que sí es geometría del cliente.
- PRESUPUESTO LIBRE / PANELES SUELTOS: si el cliente pide N paneles con su largo (sin obra/pared), cada panel cubre largo×ancho_útil_ficha. NO pidas altura ni perímetro ni área de pared; con familia + espesor + largos ya alcanza.
- VARIOS ESPESORES misma familia (ej: "Isodec 100 y 150mm", "isopanel 100 y 150"): NO preguntes cuál elegir. Poné todos en espesor_variants (ej: [100,150]), el primero también en techo/pared.espesor, y ready_to_quote=true si lo demás está. Se cotiza un presupuesto por cada espesor.
CONOCIMIENTO ACUMULADO (reglas aprendidas de correcciones del equipo — SEGUILAS aunque contradigan los defaults arriba):
- Paneles sueltos / presupuesto libre: si el cliente pide N paneles de X largo sin contexto de obra/pared, cotizar como paneles sueltos. NO pedir altura de pared, perímetro ni área. Solo preguntar ancho útil si la familia no lo define en ficha.
- Varias propuestas: si el cliente pide varias propuestas con cantidades/largos ya definidos, generar UNA cotización independiente por cada una. NO pedir confirmación de cuál prefiere. NO agregar scope extra.
- Dos espesores misma familia: si pide 2 espesores distintos de la misma familia con mismas cantidades/largos, generar DOS presupuestos separados. NO pedir que elija uno.
- Accesorios de remate con medidas lineales: cotizar EXACTAMENTE los accesorios indicados con sus metros lineales. NO agregar accesorios no pedidos.
- Isoroof ≤40mm sin variante: interpretar directamente como ISOROOF_3G. NO preguntar variante.
- Scope mínimo: si el cliente ya definió cantidades y largos, cotizar solo y exactamente lo que pidió. NO agregar scope (instalación, estructura, accesorios) salvo que lo mencione explícitamente.
- Color default: si no se especifica color para ISOPANEL_EPS o ISODEC_EPS, inferir Blanco. NO preguntar color.
- Estructura default paneles sueltos: para presupuesto libre, inferir estructura metal por default. NO preguntar tipo de estructura si no hay contexto de obra/montaje.
- GEOMETRÍA "N paneles de X m": N = cantidad, X = largo de cada panel → zonas:[{cantidad:N, largo:X}]. El ancho es el útil de ficha (fijo): NO lo inventes, NO inviertas largo/ancho, NO metas la cantidad en "ancho". Con familia+espesor+cantidad+largo → ready_to_quote=true.
- DIMENSIONES DE ÁREA "A x B m" SIN cantidad de paneles (ej "6,5x6,5m", "7x7m"): geometría INCOMPLETA → ready_to_quote=false y preguntá en question_K cuántos paneles de qué largo (el calculador necesita largos de panel, no sólo el área).
- "COMPLETO": si dice "completo", completo=true y en interpretation_J enumerá explícito: paneles + perfilería perimetral (canalón/babeta/cumbrera/cantonera según escenario) + flete. No lo dejes implícito.
- FLETE: "completo"/"+flete"/"+envío" ⇒ flete="incluido". "sin flete" ⇒ "aparte". Si no aparece ⇒ "no_mencionado".
- ISOROOF: si dice "Isoroof"/"Roof" SIN la palabra literal FOIL/COLONIAL/PLUS, familia=ISOROOF_3G en cualquier espesor (30/40/50/80/100). NO uses FOIL ni PLUS salvo que el cliente escriba esa palabra exacta.
- "Isodec Isopanel" / "Ispanel Isodec" juntos NO es ambigüedad: es techo+pared (Isodec=techo ISODEC_EPS, Isopanel=pared ISOPANEL_EPS, mismo espesor). Si sólo se da una superficie usá esa familia; NUNCA devuelvas sin familia.
- "ºH" / "H°" = fijación/estructura a Hormigón, NO un color. El color sigue Blanco por defecto.
Devolvé SIEMPRE la interpretación como JSON con los campos: quotable, accessory_only, escenario, techo (con familia, espesor, zonas, color), pared (con familia, espesor, alto, perimetro, color), espesor_variants, ready_to_quote, interpretation_J, question_K, missing_L, completo, flete.`;

// ─── Post-pass helpers ──────────────────────────────────────────────────────────

function measuresAreExternal(consulta) {
  return /en\s*(el\s*)?chat|w(ha?ts?app|pp)\b|wsp\b|por\s*wp|plano|adjunt|foto|imagen|croquis|\bpdf\b/i.test(consulta || "");
}

function measurementsInExternalChannel(text) {
  return /plano|chat|foto|whats|wsp|adjunt|imagen|croquis|pdf/i.test(text || "");
}

function detectExternalBrand(consulta) {
  return /\bhia?nsa\b|chapa\s*teja|chapateja|paneltech|euroteja/i.test(consulta || "");
}

function familiesWithEspesor(surface, mm) {
  const table = surface === "pared" || surface === "camara" ? PARED_FAMILIAS : TECHO_FAMILIAS;
  return Object.entries(table).filter(([, esp]) => esp.includes(Number(mm))).map(([f]) => f);
}

function repairFamilyEspesor(interp) {
  if (!interp || typeof interp !== "object") return interp;
  const fix = (surfaceKey) => {
    const node = interp[surfaceKey];
    if (!node?.familia || node.espesor == null) return;
    const fams = surfaceKey === "pared" || surfaceKey === "camara" ? PARED_FAMILIAS : TECHO_FAMILIAS;
    if (fams[node.familia]?.includes(Number(node.espesor))) return;
    const opts = familiesWithEspesor(surfaceKey, node.espesor);
    if (opts.length === 1) node.familia = opts[0];
  };
  fix("techo");
  fix("pared");
  return interp;
}

// ─── Gemini call ────────────────────────────────────────────────────────────────

async function callGemini(config, contents) {
  const genAI = getGenAI(config);
  const model = genAI.getGenerativeModel({
    model: config.bmcGeminiModel || DEFAULT_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
  });

  const result = await model.generateContent({ contents });
  const response = result.response;
  const candidate = response.candidates?.[0];
  if (!candidate) throw new Error("Gemini: no candidates returned");
  if (candidate.finishReason && candidate.finishReason !== "STOP") {
    throw new Error(`Gemini blocked: ${candidate.finishReason}`);
  }
  const text = candidate.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");

  return JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
}

// ─── Public API ──────────────────────────────────────────────────────────────────

export async function interpretBmcChatInquiry(config, consulta, conversation, newUserMessage) {
  const contents = [];

  // First message: original consulta
  contents.push({
    role: "user",
    parts: [{ text: `Interpretá la siguiente consulta de cliente:\n"""${consulta}"""` }],
  });

  // Replay conversation history
  if (conversation?.turns?.length) {
    for (const turn of conversation.turns) {
      if (turn.role === "ai") {
        contents.push({ role: "model", parts: [{ text: JSON.stringify(turn.interpretation) }] });
      } else if (turn.role === "user") {
        contents.push({ role: "user", parts: [{ text: turn.text }] });
      }
    }
  }

  // Append new user message
  if (newUserMessage?.trim()) {
    contents.push({ role: "user", parts: [{ text: newUserMessage }] });
  }

  const interpretation = await callGemini(config, contents);

  // Post-pass 1: measures in external channel
  interpretation.measures_external = measuresAreExternal(consulta);
  if (interpretation.measures_external && !measurementsInExternalChannel(interpretation.missing_L || "")) {
    interpretation.missing_L = (interpretation.missing_L || "") + (interpretation.missing_L ? "; " : "") + "medidas en canal externo (plano/chat) — confirmar";
  }

  // Post-pass 2: ISOROOF sin variante literal → ISOROOF_3G
  const _t = interpretation.techo;
  if (_t && /^ISOROOF/.test(_t.familia || "") && _t.familia !== "ISOROOF_3G" && !/foil|colonial|plus/i.test(consulta) && TECHO_FAMILIAS.ISOROOF_3G.includes(Number(_t.espesor))) {
    _t.familia = "ISOROOF_3G";
  }

  // Post-pass 3: external brand
  if (detectExternalBrand(consulta)) {
    interpretation.missing_L = (interpretation.missing_L || "") + (interpretation.missing_L ? "; " : "") + "incluye producto fuera del catálogo del calculador (marca externa) — cotizar aparte";
    if (!(interpretation.techo?.familia || interpretation.pared?.familia)) {
      interpretation.quotable = false;
      interpretation.accessory_only = false;
    }
  }

  // Post-pass 4: repair familia+espesor mismatches
  repairFamilyEspesor(interpretation);

  return interpretation;
}
