/**
 * SuperAgent tool routes — single-call quoting interface for AI agents.
 *
 * POST /api/agent/quote-lead
 *   Body: { consulta: string, cliente?: string, canal?: string }
 *   Returns: { ok, method, response_text, pdf_url, bom_summary, missing_params, total_usd }
 *
 * The agent sends a raw client inquiry; this route extracts params, runs the
 * calculator, generates the commercial response, uploads to GCS, and returns
 * everything in one call — ready to send to the client.
 *
 * Mount at: app.use("/api/agent", createSuperAgentRouter(config))
 */
import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import {
  calcTechoCompleto,
  calcParedCompleto,
  calcTotalesSinIVA,
} from "../../src/utils/calculations.js";
import { setListaPrecios } from "../../src/data/constants.js";
import { bomToGroups, fmtPrice, generatePrintHTML } from "../../src/utils/helpers.js";
import { uploadQuoteToGcs } from "../lib/gcsUpload.js";
import { uploadQuoteToDrive } from "../lib/driveUpload.js";

const HAIKU = "claude-haiku-4-5-20251001";
const MIN_LEN = 15;

const EXTRACT_PROMPT = `Sos un extractor de datos para BMC Uruguay (paneles de aislamiento térmico).
Dado el texto de consulta de un cliente, extraé los parámetros para calcular un presupuesto.
Respondé SOLO con un objeto JSON válido, sin texto adicional, sin markdown.

Familias techo: ISODEC_EPS (más común), ISOROOF_3G, ISODEC_PIR, ISOROOF_FOIL_3G, ISOROOF_PLUS_3G, ISOROOF_COLONIAL
Familias pared: ISOPANEL_EPS (más común), ISOWALL_PIR
Escenarios: solo_techo (galpón/nave/tinglado), solo_fachada (paredes), techo_fachada, camara_frig

{"escenario":"solo_techo|solo_fachada|techo_fachada|camara_frig|null","techo":{"familia":"string|null","espesor":0,"largo":0,"ancho":0,"tipoEst":"metal|hormigon|madera|null"},"pared":{"familia":"string|null","espesor":0,"alto":0,"perimetro":0},"camara":{"largo_int":0,"ancho_int":0,"alto_int":0},"confianza":"alta|media|baja","faltan":["datos faltantes"]}`;

const RESPONSE_PROMPT = `Sos Panelin, asistente comercial de BMC Uruguay. Dado un resumen de cotización calculado, redactá una respuesta comercial profesional en español rioplatense (2-4 párrafos). Incluí los números del presupuesto. Terminá siempre con "Saludos, BMC URUGUAY!"`;

function requireAuth(config, req, res) {
  const expected = config.apiAuthToken;
  if (!expected) return true;
  const header =
    req.headers["x-api-key"] ||
    (req.headers.authorization
      ? String(req.headers.authorization).replace(/^Bearer\s+/i, "")
      : "");
  if (String(header) !== String(expected)) {
    res.status(401).json({ ok: false, error: "API key inválida o ausente" });
    return false;
  }
  return true;
}

function runCalc(extracted, usedDefaults) {
  const { escenario, techo, pared, camara } = extracted || {};
  if (!escenario || escenario === "null") return null;
  setListaPrecios("web");

  if (escenario === "solo_techo" || escenario === "techo_fachada") {
    if (!techo?.largo || !techo?.ancho) return null;
    const familia = techo.familia && techo.familia !== "null" ? techo.familia
      : (usedDefaults.push("ISODEC EPS"), "ISODEC_EPS");
    const espesor = techo.espesor || (usedDefaults.push("100mm"), 100);
    try {
      const r = calcTechoCompleto({
        familia, espesor, color: "Blanco",
        tipoEst: techo.tipoEst && techo.tipoEst !== "null" ? techo.tipoEst : "metal",
        largo: techo.largo, ancho: techo.ancho,
        borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
        opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
      });
      return r?.error ? null : { ...r, _escenario: "solo_techo" };
    } catch { return null; }
  }

  if (escenario === "solo_fachada") {
    if (!pared?.alto || !pared?.perimetro) return null;
    const familia = pared.familia && pared.familia !== "null" ? pared.familia
      : (usedDefaults.push("ISOPANEL EPS"), "ISOPANEL_EPS");
    const espesor = pared.espesor || (usedDefaults.push("100mm"), 100);
    try {
      const r = calcParedCompleto({
        familia, espesor, alto: pared.alto, perimetro: pared.perimetro,
        tipoEst: "metal", numEsqExt: 4, numEsqInt: 0, inclSell: true,
      });
      return r?.error ? null : { ...r, _escenario: "solo_fachada" };
    } catch { return null; }
  }

  if (escenario === "camara_frig") {
    if (!camara?.largo_int || !camara?.ancho_int || !camara?.alto_int) return null;
    const familia = pared?.familia && pared.familia !== "null" ? pared.familia
      : (usedDefaults.push("ISOPANEL EPS"), "ISOPANEL_EPS");
    const espesor = pared?.espesor || (usedDefaults.push("150mm"), 150);
    try {
      const perim = 2 * (camara.largo_int + camara.ancho_int);
      const rP = calcParedCompleto({
        familia, espesor, perimetro: perim, alto: camara.alto_int,
        tipoEst: "metal", numEsqExt: 4, numEsqInt: 0, inclSell: true,
      });
      const rT = calcTechoCompleto({
        familia, espesor, largo: camara.largo_int, ancho: camara.ancho_int, tipoEst: "metal",
        borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
        opciones: { inclCanalon: false, inclGotSup: false, inclSell: true }, color: "Blanco",
      });
      const allItems = [...(rP?.allItems || []), ...(rT?.allItems || [])];
      return { ...rP, techoResult: rT, allItems, totales: calcTotalesSinIVA(allItems), _escenario: "camara_frig" };
    } catch { return null; }
  }
  return null;
}

const ESCENARIO_LABELS = {
  solo_techo: "Solo Techo", solo_fachada: "Solo Fachada",
  techo_fachada: "Techo + Fachada", camara_frig: "Cámara Frigorífica",
};

export function createSuperAgentRouter(config) {
  const router = Router();

  router.post("/quote-lead", async (req, res) => {
    if (!requireAuth(config, req, res)) return;

    const { consulta, cliente = "Cliente", canal = "" } = req.body || {};
    if (!consulta || consulta.length < MIN_LEN) {
      return res.status(400).json({ ok: false, error: "consulta demasiado corta (min 15 chars)" });
    }

    const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

    // Step 1: extract structured params
    let extracted = null;
    const usedDefaults = [];
    try {
      const msg = await anthropic.messages.create({
        model: HAIKU, max_tokens: 400,
        system: EXTRACT_PROMPT,
        messages: [{ role: "user", content: consulta }],
      });
      const raw = (msg.content?.[0]?.text || "").trim()
        .replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
      extracted = JSON.parse(raw);
    } catch (e) { console.error("[superAgent] extraction error:", e?.message); extracted = null; }

    // Step 2: run calculator
    const calcRaw = runCalc(extracted, usedDefaults);
    let method = "text";
    let responseText = "";
    let pdfUrl = null;
    let driveUrl = null;
    let bomSummary = null;
    let totalUsd = null;

    if (calcRaw) {
      method = "calc";
      const allItems = calcRaw.allItems || [];
      const totales = calcRaw.totales || calcTotalesSinIVA(allItems);
      totalUsd = totales.totalFinal;
      const area = calcRaw.paneles?.areaTotal ?? calcRaw.paneles?.areaNeta ?? 0;
      const cantPaneles = calcRaw.paneles?.cantPaneles ?? 0;
      const panelLabel = allItems.find(i => i.unidad === "m²")?.label || "";
      const escenario = calcRaw._escenario;

      bomSummary = {
        escenario: ESCENARIO_LABELS[escenario] || escenario,
        panel: panelLabel,
        area_m2: area,
        cant_paneles: cantPaneles,
        subtotal_usd: totales.subtotalSinIVA,
        iva_usd: totales.iva,
        total_usd: totales.totalFinal,
        supuestos: usedDefaults,
        faltan: extracted?.faltan || [],
      };

      const resumenTexto = `${panelLabel} — ${ESCENARIO_LABELS[escenario] || escenario}. `
        + `Área: ${area} m². Paneles: ${cantPaneles}. `
        + `Subtotal: USD ${fmtPrice(totales.subtotalSinIVA)} + IVA 22%: USD ${fmtPrice(totales.iva)} = TOTAL USD ${fmtPrice(totales.totalFinal)}.`;

      // Step 3: generate commercial response text
      try {
        const respMsg = await anthropic.messages.create({
          model: HAIKU, max_tokens: 512,
          system: RESPONSE_PROMPT,
          messages: [{ role: "user", content: `Cliente: ${cliente}\nCanal: ${canal || "N/A"}\nConsulta: ${consulta}\n\nPresupuesto calculado: ${resumenTexto}${usedDefaults.length ? `\nSupuestos usados: ${usedDefaults.join(", ")}.` : ""}${(extracted?.faltan || []).length ? `\nFaltan: ${extracted.faltan.join(", ")}.` : ""}` }],
        });
        responseText = respMsg.content?.[0]?.text?.trim() || resumenTexto + "\n\nSaludos, BMC URUGUAY!";
      } catch {
        responseText = resumenTexto + "\n\nSaludos, BMC URUGUAY!";
      }

      // Step 4: generate PDF and upload to GCS+Drive in parallel (best-effort)
      if (config.gcsQuotesBucket || config.driveQuoteFolderId) {
        try {
          const groups = bomToGroups(calcRaw);
          const htmlDate = new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
          const html = generatePrintHTML({
            client: { nombre: cliente, rut: "", telefono: "" },
            project: { fecha: htmlDate, refInterna: `SA-${Date.now().toString(36).toUpperCase()}`, descripcion: consulta.slice(0, 80) },
            scenario: escenario,
            panel: { label: panelLabel, espesor: extracted?.techo?.espesor || extracted?.pared?.espesor || "", color: "Blanco" },
            autoportancia: null, groups,
            totals: { subtotalSinIVA: totales.subtotalSinIVA, iva: totales.iva, totalFinal: totales.totalFinal },
            warnings: calcRaw.warnings || [], dimensions: {}, listaPrecios: "web",
            showSKU: false, showUnitPrices: true,
          });
          const filename = `SA-${Date.now().toString(36)}-${new Date().toISOString().slice(0, 10)}.html`;
          const [gcsRes, driveRes] = await Promise.allSettled([
            config.gcsQuotesBucket
              ? uploadQuoteToGcs(html, filename, config.gcsQuotesBucket)
              : Promise.resolve(null),
            config.driveQuoteFolderId
              ? uploadQuoteToDrive(html, filename, config.driveQuoteFolderId)
              : Promise.resolve(null),
          ]);
          pdfUrl = gcsRes.status === "fulfilled" ? gcsRes.value : null;
          driveUrl = driveRes.status === "fulfilled" ? driveRes.value : null;
        } catch { /* non-critical */ }
      }
    } else {
      // Text-only fallback
      try {
        const msg = await anthropic.messages.create({
          model: HAIKU, max_tokens: 512,
          system: "Sos Panelin, asistente comercial de BMC Uruguay (paneles de aislamiento térmico). Respondé en español rioplatense. Terminá siempre con 'Saludos, BMC URUGUAY!'",
          messages: [{ role: "user", content: consulta }],
        });
        responseText = msg.content?.[0]?.text?.trim() || "Necesito más información para cotizar.";
      } catch (e) {
        console.error("[superAgent] text fallback error:", e?.message);
        responseText = "No pude procesar la consulta. Por favor contactanos directamente.";
      }
    }

    return res.json({
      ok: true,
      method,
      response_text: responseText,
      pdf_url: pdfUrl,
      drive_url: driveUrl || null,
      bom_summary: bomSummary,
      missing_params: extracted?.faltan || [],
      total_usd: totalUsd,
    });
  });

  return router;
}
