import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";

const VISION_SCHEMA = `{
  "techoZonas": [{"largoM": number, "anchoM": number}],
  "tipoAguas": "una_agua" | "dos_aguas" | null,
  "pendienteGrados": number | null,
  "paredAltoM": number | null,
  "paredPerimetroM": number | null,
  "aberturas": [{"anchoM": number, "altoM": number, "cant": number}],
  "escenarioDetectado": "solo_techo" | "techo_fachada" | "solo_fachada" | "camara_frig",
  "confianza": "alta" | "media" | "baja",
  "notas": [string]
}`;

const SYSTEM_PROMPT = `Sos un asistente experto en interpretar planos de obras de construcción para BMC Uruguay, empresa que vende paneles de aislación térmica.
Tu tarea es extraer dimensiones de superficies (techos y paredes) del plano y devolverlas en formato JSON estricto.

REGLAS:
- Extraé todas las zonas de techo que identifiques como rectángulos independientes (con sus largos y anchos en metros)
- Si hay cotas en el plano, respetá esas medidas exactas
- Si el plano es un DXF, interpretá las entidades DIMENSION y TEXT que contienen medidas
- El tipo de panel (familia, espesor) NO aparece en planos arquitectónicos — no lo inventes
- Las medidas pueden estar en mm en planos técnicos — convertí a metros
- Si no podés determinar una dimensión con seguridad, dejá null
- Respondé SOLO con el JSON válido, sin texto adicional antes ni después

ESQUEMA JSON esperado:
${VISION_SCHEMA}`;

export async function interpretPlan(fileBuffer, mimeType, filename) {
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  const isDxf = (filename || "").toLowerCase().endsWith(".dxf") || mimeType === "text/plain";

  if (!config.anthropicApiKey && !config.geminiApiKey) {
    throw Object.assign(
      new Error("Sin proveedor IA configurado. Configurá ANTHROPIC_API_KEY o GEMINI_API_KEY."),
      { status: 503 }
    );
  }

  let extracted;
  if (config.anthropicApiKey) {
    extracted = await callClaude(fileBuffer, mimeType, isImage, isPdf, isDxf);
  } else {
    extracted = await callGemini(fileBuffer, mimeType, isImage, isPdf, isDxf);
  }

  return mapToBmc(extracted);
}

async function callClaude(buffer, mimeType, isImage, isPdf, isDxf) {
  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
  const content = [];

  if (isImage) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: mimeType, data: buffer.toString("base64") },
    });
  } else if (isPdf) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
    });
  } else if (isDxf) {
    const dxfText = buffer.toString("utf-8").slice(0, 40_000);
    content.push({ type: "text", text: `Archivo DXF de plano:\n\n${dxfText}` });
  } else {
    throw Object.assign(new Error("Tipo de archivo no procesable"), { status: 400 });
  }

  content.push({
    type: "text",
    text: "Analizá este plano y devolvé el JSON con las dimensiones según el esquema indicado.",
  });

  const resp = await anthropic.messages.create({
    model: config.anthropicChatModel || "claude-opus-4-7",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  return parseAiJson(resp.content[0]?.text || "");
}

async function callGemini(buffer, mimeType, isImage, isPdf, isDxf) {
  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const model = genAI.getGenerativeModel({ model: config.geminiChatModel || "gemini-2.0-flash" });

  const parts = [];
  if (isImage) {
    parts.push({ inlineData: { data: buffer.toString("base64"), mimeType } });
  } else if (isPdf) {
    parts.push({ inlineData: { data: buffer.toString("base64"), mimeType: "application/pdf" } });
  } else if (isDxf) {
    const dxfText = buffer.toString("utf-8").slice(0, 40_000);
    parts.push({ text: `Archivo DXF de plano:\n\n${dxfText}` });
  } else {
    throw Object.assign(new Error("Tipo de archivo no procesable"), { status: 400 });
  }

  parts.push({ text: SYSTEM_PROMPT + "\n\nAnalizá y devolvé SOLO el JSON." });

  const result = await model.generateContent({ contents: [{ role: "user", parts }] });
  return parseAiJson(result.response.text());
}

function parseAiJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw Object.assign(
      new Error("No se pudo extraer información dimensional del plano. Intentá con una imagen más clara o un DXF con cotas visibles."),
      { status: 422 }
    );
  }
  try {
    return JSON.parse(match[0]);
  } catch {
    throw Object.assign(new Error("Respuesta IA con formato inválido"), { status: 422 });
  }
}

function mapToBmc(extracted) {
  const warnings = [];
  const gaps = ["familia", "espesor"];

  const zonas = (extracted.techoZonas || [])
    .filter(z => z.largoM > 0 && z.anchoM > 0)
    .map(z => ({ largo: +Number(z.largoM).toFixed(2), ancho: +Number(z.anchoM).toFixed(2) }));

  if (!extracted.tipoAguas) {
    warnings.push("Tipo de aguas no detectado — se asumió 1 agua");
  }
  if (extracted.confianza === "baja") {
    warnings.push("Confianza baja en la extracción — verificá las dimensiones antes de cotizar");
  } else if (extracted.confianza === "media") {
    warnings.push("Confianza media — revisá que las medidas sean correctas");
  }

  const scenario =
    zonas.length > 0 && extracted.paredPerimetroM ? "techo_fachada"
    : zonas.length > 0 ? "solo_techo"
    : extracted.paredPerimetroM ? "solo_fachada"
    : null;

  if (!scenario) gaps.push("scenario");
  if (zonas.length === 0 && scenario !== "solo_fachada") gaps.push("zonas");

  const techo = zonas.length > 0 ? {
    zonas,
    tipoAguas: extracted.tipoAguas || "una_agua",
    pendiente: extracted.pendienteGrados || 0,
    familia: "",
    espesor: "",
    color: "Blanco",
    tipoEst: "metal",
    borders: {
      frente: "gotero_frontal",
      fondo: "gotero_lateral",
      latIzq: "gotero_lateral",
      latDer: "gotero_lateral",
    },
    opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
  } : null;

  const pared = extracted.paredPerimetroM ? {
    alto: extracted.paredAltoM || 3.5,
    perimetro: +Number(extracted.paredPerimetroM).toFixed(2),
    aberturas: (extracted.aberturas || []).map(a => ({
      ancho: a.anchoM,
      alto: a.altoM,
      cant: a.cant || 1,
    })),
    numEsqExt: 4,
    numEsqInt: 0,
    familia: "",
    espesor: "",
    color: "Blanco",
  } : null;

  return {
    ok: gaps.length === 0,
    bmcPayload: { scenario, techo, pared },
    gaps,
    warnings,
    extractedRaw: extracted,
  };
}
