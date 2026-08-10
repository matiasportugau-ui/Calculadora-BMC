/**
 * Logística AI verify (P0) — pure evidence pack + proposal normalize/apply.
 * Human-gated: apply only after operator confirms in UI.
 *
 * Allowed panel tipos match BmcLogisticaApp TIPOS.
 */

export const AI_VERIFY_PANEL_TIPOS = Object.freeze([
  "ISODEC",
  "ISOPANEL",
  "ISOROOF",
  "ISOWALL",
  "ISOFRIG",
  "ISOFRIG_PIR",
]);

const ESPESORES_OK = new Set([40, 50, 60, 80, 100, 120, 150, 200, 250]);

/**
 * @param {object} stop
 * @returns {boolean}
 */
export function isStopIncompleteForAi(stop) {
  if (!stop || typeof stop !== "object") return false;
  const paneles = Array.isArray(stop.paneles) ? stop.paneles : [];
  const tel = String(stop.telefono || "").trim();
  const dir = String(stop.direccion || "").trim();
  const cliente = String(stop.cliente || "").trim();
  const metaFail = stop.adjuntoMeta && stop.adjuntoMeta.ok === false;
  if (!paneles.length) return true;
  if (!cliente || !tel || !dir) return true;
  if (metaFail) return true;
  return false;
}

/**
 * Cap long free-text for LLM cost/latency.
 * @param {string} s
 * @param {number} max
 */
function clip(s, max = 6000) {
  const t = String(s || "");
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n…[truncado ${t.length - max} chars]`;
}

/**
 * Build multi-source evidence pack for the AI (and for the operator modal).
 * @param {object} stop
 * @returns {{ sources: Array<{id:string,label:string,content:string}>, current: object, gaps: string[] }}
 */
export function buildAiVerifyEvidencePack(stop) {
  const s = stop || {};
  const sources = [];

  sources.push({
    id: "stop_fields",
    label: "Campos actuales de la parada",
    content: JSON.stringify(
      {
        orden: s.orden,
        cliente: s.cliente || "",
        telefono: s.telefono || "",
        direccion: s.direccion || "",
        orderId: s.orderId || "",
        cotizacionId: s.cotizacionId || "",
        pickupId: s.pickupId || "",
        zona: s.zona || "",
        fechaEntrega: s.fechaEntrega || "",
        pdfLink: s.pdfLink || "",
        carpetaDrive: s.carpetaDrive || "",
        paneles: (s.paneles || []).map((p) => ({
          tipo: p.tipo,
          espesor: p.espesor,
          longitud: p.longitud,
          cantidad: p.cantidad,
        })),
        accesorios: (s.accesorios || []).map((a) => ({
          descr: a.descr || a.descripcion || "",
          cantidad: a.cantidad,
        })),
      },
      null,
      2,
    ),
  });

  if (s.rawSheetText) {
    sources.push({
      id: "ventas_row",
      label: "Texto fila Ventas / ENCARGO (planilla)",
      content: clip(s.rawSheetText, 8000),
    });
  }
  if (s.observacionesLogistica || s.recepcionDetalle) {
    sources.push({
      id: "obs",
      label: "Observaciones / warnings de autocarga",
      content: clip([s.observacionesLogistica, s.recepcionDetalle].filter(Boolean).join("\n"), 4000),
    });
  }
  if (s.adjuntoMeta) {
    sources.push({
      id: "adjunto_meta",
      label: "Meta de lectura de adjunto",
      content: JSON.stringify(
        {
          source: s.adjuntoMeta.source,
          ok: s.adjuntoMeta.ok,
          userMessage: s.adjuntoMeta.userMessage,
          warnings: s.adjuntoMeta.warnings,
        },
        null,
        2,
      ),
    });
  }
  if (s.pdfText) {
    sources.push({
      id: "pdf_text",
      label: "Texto extraído del PDF (si disponible)",
      content: clip(s.pdfText, 12000),
    });
  }
  if (s.adminMatchNote || s.adminMatch) {
    sources.push({
      id: "admin_match",
      label: "Match Admin cotizaciones",
      content: clip(s.adminMatchNote || JSON.stringify(s.adminMatch), 3000),
    });
  }

  const gaps = [];
  if (!(s.paneles || []).length) gaps.push("sin_paneles");
  if (!String(s.cliente || "").trim()) gaps.push("sin_cliente");
  if (!String(s.telefono || "").trim()) gaps.push("sin_telefono");
  if (!String(s.direccion || "").trim()) gaps.push("sin_direccion");
  if (!String(s.pdfLink || "").trim()) gaps.push("sin_pdf_link");
  if (s.adjuntoMeta?.ok === false) gaps.push("adjunto_fallo");

  return {
    sources,
    current: {
      cliente: s.cliente || "",
      telefono: s.telefono || "",
      direccion: s.direccion || "",
      orderId: s.orderId || "",
      panelesCount: (s.paneles || []).length,
      accesoriosCount: (s.accesorios || []).length,
    },
    gaps,
  };
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeTipo(raw) {
  const t = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
  if (AI_VERIFY_PANEL_TIPOS.includes(t)) return t;
  if (t.includes("ISOFRIG") && t.includes("PIR")) return "ISOFRIG_PIR";
  if (t.includes("ISOFRIG")) return "ISOFRIG";
  if (t.includes("ISOPANEL")) return "ISOPANEL";
  if (t.includes("ISODEC")) return "ISODEC";
  if (t.includes("ISOROOF")) return "ISOROOF";
  if (t.includes("ISOWALL")) return "ISOWALL";
  return "";
}

/**
 * Parse model JSON (strip fences) → normalized proposal.
 * @param {unknown} raw
 * @returns {{
 *   ok: boolean,
 *   confidence: 'alta'|'media'|'baja',
 *   notes: string[],
 *   needsHuman: string[],
 *   fields: { cliente?: string, telefono?: string, direccion?: string, orderId?: string },
 *   paneles: Array<{tipo:string,espesor:number,longitud:number,cantidad:number}>,
 *   accesorios: Array<{descr:string,cantidad:number}>,
 *   replacePaneles: boolean,
 *   replaceAccesorios: boolean,
 *   error?: string
 * }}
 */
export function normalizeAiVerifyProposal(raw) {
  let obj = raw;
  if (typeof raw === "string") {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    try {
      obj = JSON.parse(cleaned);
    } catch {
      // try first {...} block
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) {
        return emptyProposal("json_parse_failed");
      }
      try {
        obj = JSON.parse(m[0]);
      } catch {
        return emptyProposal("json_parse_failed");
      }
    }
  }
  if (!obj || typeof obj !== "object") return emptyProposal("empty_proposal");

  const confRaw = String(obj.confidence || obj.confianza || "media").toLowerCase();
  const confidence = confRaw.startsWith("alt")
    ? "alta"
    : confRaw.startsWith("baj")
      ? "baja"
      : "media";

  const notes = Array.isArray(obj.notes)
    ? obj.notes.map((n) => String(n || "").trim()).filter(Boolean)
    : [];
  const needsHuman = Array.isArray(obj.needsHuman || obj.needs_human)
    ? (obj.needsHuman || obj.needs_human).map((n) => String(n || "").trim()).filter(Boolean)
    : [];

  const fieldsIn = obj.fields && typeof obj.fields === "object" ? obj.fields : obj;
  const fields = {};
  for (const key of ["cliente", "telefono", "direccion", "orderId"]) {
    const v = fieldsIn[key] ?? obj[key];
    if (v != null && String(v).trim()) fields[key] = String(v).trim();
  }

  const paneles = [];
  const rawPaneles = Array.isArray(obj.paneles) ? obj.paneles : [];
  for (const p of rawPaneles) {
    const tipo = normalizeTipo(p?.tipo || p?.type || p?.familia);
    if (!tipo) continue;
    const espesor = Math.round(Number(p?.espesor ?? p?.esp ?? p?.thickness));
    if (!ESPESORES_OK.has(espesor)) continue;
    let longitud = Number(String(p?.longitud ?? p?.largo ?? p?.len ?? 6).replace(",", "."));
    if (!Number.isFinite(longitud) || longitud <= 0) longitud = 6;
    if (longitud > 14) longitud = 14;
    let cantidad = Math.round(Number(p?.cantidad ?? p?.cant ?? p?.qty ?? 1));
    if (!Number.isFinite(cantidad) || cantidad < 1) cantidad = 1;
    if (cantidad > 500) cantidad = 500;
    paneles.push({ tipo, espesor, longitud, cantidad });
  }

  const accesorios = [];
  const rawAcc = Array.isArray(obj.accesorios) ? obj.accesorios : [];
  for (const a of rawAcc) {
    const descr = String(a?.descr || a?.descripcion || a?.nombre || a?.name || "").trim();
    if (!descr) continue;
    let cantidad = Math.round(Number(a?.cantidad ?? a?.cant ?? a?.qty ?? 1));
    if (!Number.isFinite(cantidad) || cantidad < 1) cantidad = 1;
    if (cantidad > 999) cantidad = 999;
    accesorios.push({ descr, cantidad });
  }

  // Explicit opt-in only. applyAiVerifyProposal still fills empty cargo without this flag;
  // defaulting to true (old behavior) wiped correct paneles when the model echoed the schema.
  const replacePaneles = obj.replacePaneles === true || obj.replace_paneles === true;
  const replaceAccesorios = obj.replaceAccesorios === true || obj.replace_accesorios === true;

  const hasSomething =
    paneles.length > 0 ||
    accesorios.length > 0 ||
    Object.keys(fields).length > 0 ||
    needsHuman.length > 0;

  return {
    ok: hasSomething,
    confidence,
    notes,
    needsHuman,
    fields,
    paneles,
    accesorios,
    replacePaneles,
    replaceAccesorios,
  };
}

function emptyProposal(error) {
  return {
    ok: false,
    confidence: "baja",
    notes: [],
    needsHuman: ["La IA no pudo proponer datos útiles. Pegá el link del PDF o las líneas de producto."],
    fields: {},
    paneles: [],
    accesorios: [],
    replacePaneles: false,
    replaceAccesorios: false,
    error,
  };
}

/**
 * Apply a confirmed proposal onto a stop (immutable).
 * Cargo policy (Bug DN): fill empty paneles/accesorios only. Never wipe existing cargo
 * unless opts.forceReplaceCargo === true AND proposal.replace* === true (explicit dual gate).
 * Contact fields still fill-empty unless forceFields.
 *
 * @param {object} stop
 * @param {ReturnType<typeof normalizeAiVerifyProposal>} proposal
 * @param {{ uid?: () => string, forceFields?: boolean, forceReplaceCargo?: boolean }} [opts]
 */
export function applyAiVerifyProposal(stop, proposal, opts = {}) {
  const uid = typeof opts.uid === "function" ? opts.uid : () => `ai-${Math.random().toString(36).slice(2, 9)}`;
  const forceFields = opts.forceFields === true;
  const forceReplaceCargo = opts.forceReplaceCargo === true;
  if (!stop || !proposal) return stop;
  const hasCargo = (proposal.paneles || []).length > 0 || (proposal.accesorios || []).length > 0;
  const hasFields = proposal.fields && Object.keys(proposal.fields).length > 0;
  if (!proposal.ok && !hasCargo && !hasFields) return stop;

  const next = { ...stop };
  const existingPaneles = Array.isArray(stop.paneles) ? stop.paneles : [];
  const existingAccesorios = Array.isArray(stop.accesorios) ? stop.accesorios : [];
  let preservedPaneles = false;
  let preservedAccesorios = false;

  // Fill empty contact fields; only overwrite existing when forceFields
  const fill = (key) => {
    const v = proposal.fields?.[key];
    if (!v) return;
    if (forceFields || !String(stop[key] || "").trim()) next[key] = v;
  };
  fill("cliente");
  fill("telefono");
  fill("direccion");
  fill("orderId");

  if (proposal.paneles?.length) {
    const canReplace =
      !existingPaneles.length || (forceReplaceCargo && proposal.replacePaneles === true);
    if (canReplace) {
      next.paneles = proposal.paneles.map((p) => ({ id: uid(), ...p }));
    } else {
      preservedPaneles = true;
    }
  }
  if (proposal.accesorios?.length) {
    const canReplace =
      !existingAccesorios.length || (forceReplaceCargo && proposal.replaceAccesorios === true);
    if (canReplace) {
      next.accesorios = proposal.accesorios.map((a) => ({ id: uid(), ...a }));
    } else {
      preservedAccesorios = true;
    }
  }

  const preserveNote =
    preservedPaneles || preservedAccesorios
      ? `Cargo existente preservado (${[
          preservedPaneles ? "paneles" : null,
          preservedAccesorios ? "accesorios" : null,
        ]
          .filter(Boolean)
          .join("+")}); IA no reemplaza bultos ya cargados.`
      : "";

  const noteLine = [
    "IA verify aplicada (confirmada por operador).",
    proposal.confidence ? `Confianza: ${proposal.confidence}.` : "",
    preserveNote,
    ...(proposal.notes || []).slice(0, 3),
  ]
    .filter(Boolean)
    .join(" ");
  next.observacionesLogistica = [stop.observacionesLogistica, noteLine].filter(Boolean).join(" | ");
  next.aiVerifyMeta = {
    appliedAt: new Date().toISOString(),
    confidence: proposal.confidence,
    notes: proposal.notes || [],
    needsHuman: proposal.needsHuman || [],
    preservedPaneles,
    preservedAccesorios,
  };
  next.checks = {
    ...(stop.checks || {}),
    bultosOk: (next.paneles || []).length > 0 || stop.checks?.bultosOk,
    adjuntoOk: stop.checks?.adjuntoOk,
    datosOk:
      Boolean(String(next.cliente || "").trim() && String(next.telefono || "").trim()) || stop.checks?.datosOk,
  };
  return next;
}

/**
 * System prompt for the model (Spanish, logistics domain).
 */
export function buildAiVerifySystemPrompt() {
  return `Sos un asistente de logística BMC Uruguay (paneles sandwich: ISODEC, ISOPANEL, ISOROOF, ISOWALL, ISOFRIG, ISOFRIG_PIR).
Tu tarea: interpretar evidencia multi-fuente de UNA parada de entrega y proponer un JSON para completar paneles/accesorios y datos faltantes.

REGLAS:
- Respondé SOLO JSON válido (sin markdown).
- NO inventes paneles si no hay evidencia de tipo+espesor en el texto/PDF/filename/planilla.
- Si solo hay filename con Isopanel-100-mm, proponé ese panel (cantidad 1 si no hay qty).
- espesor mm válidos: 40,50,60,80,100,120,150,200,250.
- longitud en metros (típicamente 2–12; default 6 si falta).
- Si falta evidencia: needsHuman con instrucciones concretas (ej. "Pegá link Compartir del PDF").
- No escribas a planillas; solo proponé.
- Preferí no sobrescribir cliente/tel/dir si ya están completos; proponé solo si faltan o hay corrección clara en la evidencia.
- Si la parada YA tiene paneles/accesorios, NO propongas reemplazo de cargo (dejá paneles/accesorios vacíos o omitilos). Solo completá fields faltantes + needsHuman.
- replacePaneles / replaceAccesorios deben ser false salvo que la evidencia demuestre que el cargo actual está vacío o claramente erróneo (el cliente igual preserva cargo existente).

ESQUEMA:
{
  "confidence": "alta"|"media"|"baja",
  "notes": ["string"],
  "needsHuman": ["string"],
  "fields": { "cliente"?: string, "telefono"?: string, "direccion"?: string, "orderId"?: string },
  "paneles": [{ "tipo": "ISODEC"|"ISOPANEL"|..., "espesor": number, "longitud": number, "cantidad": number }],
  "accesorios": [{ "descr": string, "cantidad": number }],
  "replacePaneles": false,
  "replaceAccesorios": false
}`;
}

/**
 * @param {ReturnType<typeof buildAiVerifyEvidencePack>} pack
 */
export function buildAiVerifyUserMessage(pack) {
  const blocks = (pack.sources || [])
    .map((s) => `### ${s.label} (${s.id})\n${s.content}`)
    .join("\n\n");
  return `Gaps detectados: ${(pack.gaps || []).join(", ") || "ninguno"}\n\nEvidencia:\n\n${blocks}\n\nDevolvé el JSON de propuesta.`;
}
