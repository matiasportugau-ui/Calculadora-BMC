// ═══════════════════════════════════════════════════════════════════════════
// src/utils/sheetExport.js
// Generador de TSV para exportar cotización a Google Sheets.
// Extraído de PanelinCalculadoraV3.jsx.
// ═══════════════════════════════════════════════════════════════════════════

import { borderOptionLabel } from "./quotationViews.js";

/**
 * Genera un string TSV para pegar en una pestaña libre de Google Sheets.
 * Incluye datos del proyecto, KPIs, alertas, bordes y sugerencias de adjuntos.
 */
export function buildGoogleSheetReportTsv({
  proyecto,
  scenario,
  scenarioLabel,
  vis,
  techo,
  pared,
  camara,
  kpiArea,
  kpiPaneles,
  kpiApoyos,
  kpiFij,
  results,
  panelLine,
  grandTotal,
  presupuestoLibre,
}) {
  const escTab = (s) => String(s ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ");
  const lines = [];
  lines.push("Campo\tValor");
  lines.push(`Fecha\t${escTab(proyecto.fecha)}`);
  lines.push(`Ref. interna\t${escTab(proyecto.refInterna)}`);
  lines.push(`Cliente\t${escTab(proyecto.nombre)}`);
  lines.push(`Obra\t${escTab(proyecto.descripcion)}`);
  lines.push(`Escenario\t${escTab(scenarioLabel)}`);
  if (!presupuestoLibre) lines.push(`Panel cotizado\t${escTab(panelLine)}`);
  lines.push(`Área paneles (m²)\t${typeof kpiArea === "number" ? kpiArea.toFixed(1) : ""}`);
  lines.push(`Cant. paneles\t${kpiPaneles ?? ""}`);
  lines.push(`${vis.autoportancia ? "Apoyos" : "Esquinas"}\t${kpiApoyos ?? ""}`);
  lines.push(`Pts. fijación\t${kpiFij ?? ""}`);
  lines.push(`Subtotal USD s/IVA\t${grandTotal?.subtotalSinIVA != null ? Number(grandTotal.subtotalSinIVA).toFixed(2) : ""}`);
  lines.push(`IVA 22% USD\t${grandTotal?.iva != null ? Number(grandTotal.iva).toFixed(2) : ""}`);
  lines.push(`Total USD c/IVA\t${grandTotal?.totalFinal != null ? Number(grandTotal.totalFinal).toFixed(2) : ""}`);
  lines.push("");
  lines.push("Alertas / validación");
  const warns = results?.warnings || [];
  if (warns.length === 0) lines.push("(ninguna)");
  else warns.forEach((w) => lines.push(escTab(w)));
  if (!presupuestoLibre && vis.borders && techo.borders) {
    lines.push("");
    lines.push("Ubicación (cubierta)\tPerfil / accesorio");
    lines.push(`Fondo ▲\t${escTab(borderOptionLabel("fondo", techo.borders.fondo))}`);
    lines.push(`Frente ▼\t${escTab(borderOptionLabel("frente", techo.borders.frente))}`);
    lines.push(`Lateral izq. ◀\t${escTab(borderOptionLabel("latIzq", techo.borders.latIzq))}`);
    lines.push(`Lateral der. ▶\t${escTab(borderOptionLabel("latDer", techo.borders.latDer))}`);
    if (techo.opciones?.inclCanalon) lines.push(`Opción perimetral\t${escTab("Canalón")}`);
    if (techo.opciones?.inclGotSup) lines.push(`Opción perimetral\t${escTab("Gotero superior")}`);
  }
  if (!presupuestoLibre && (scenario === "solo_fachada" || scenario === "techo_fachada" || scenario === "camara_frig")) {
    lines.push("");
    lines.push("Fachada / cerramiento");
    const alto = scenario === "camara_frig" ? camara?.alto_int : pared?.alto;
    const perim = scenario === "camara_frig" ? 2 * ((Number(camara?.largo_int) || 0) + (Number(camara?.ancho_int) || 0)) : pared?.perimetro;
    lines.push(`Alto (m)\t${escTab(alto)}`);
    lines.push(`Perímetro (m)\t${escTab(perim)}`);
  }
  lines.push("");
  lines.push("Imágenes / adjuntos");
  lines.push(`Sugerencia\tCaptura de KPIs (tarjetas Área / Paneles / Apoyos / Pts fijación) — pegar como imagen en la planilla.`);
  lines.push(`Sugerencia\tPDF cotización página 2 — esquema de paneles y cuadrícula de accesorios por lado.`);
  return lines.join("\n");
}
