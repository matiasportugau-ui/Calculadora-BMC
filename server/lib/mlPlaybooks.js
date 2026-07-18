// Read-only ML playbooks — derives actionable queue from marketIntel static loaders.
// No AI call; safe for ML Manager operators (canales grant).

import {
  getBaselinePrices,
  getCompetitorMap,
  getMlPulse,
} from "./marketIntel/productIntelligence.js";
import { buildAnalisisPrecios } from "./marketIntel/priceGap.js";

const PRIORITY_ORDER = { alta: 0, media: 1, baja: 2 };

function severityToPriority(severidad) {
  if (severidad === "alta" || severidad === "high") return "alta";
  if (severidad === "baja" || severidad === "low") return "baja";
  return "media";
}

/**
 * @returns {{ items: object[], summary: string, generated_at: string, sources: string[] }}
 */
export function buildMlPlaybooks() {
  const ml = getMlPulse();
  const items = [];

  for (const [idx, p] of (ml?.problemas_identificados || []).entries()) {
    const area = p.area?.includes("pregunta") ? "ml" : p.area?.includes("listing") || p.area?.includes("titulo") || p.area?.includes("datos") || p.area?.includes("calidad") ? "ml" : "estrategia";
    items.push({
      id: `pulse-${idx}-${p.area}`,
      area,
      priority: severityToPriority(p.severidad),
      title: p.area?.replace(/_/g, " ") || "Acción ML",
      action: p.accion_sugerida || "Revisar en ML Manager",
      detail: p.descripcion || "",
      source: "ml_pulse",
      tab_hint: area === "ml" && p.area?.includes("pregunta") ? "questions" : "listings",
    });
  }

  const prices = getBaselinePrices();
  const compMap = getCompetitorMap();
  const analisis = buildAnalisisPrecios(prices, compMap);
  const brechas = (analisis.brechas || [])
    .filter((b) => Math.abs(b.diferencia_porcentaje) >= 8)
    .sort((a, b) => Math.abs(b.diferencia_porcentaje) - Math.abs(a.diferencia_porcentaje))
    .slice(0, 4);

  for (const b of brechas) {
    items.push({
      id: `price-${b.producto}`,
      area: "pricing",
      priority: b.diferencia_usd_m2 > 0 ? "alta" : "media",
      title: `Brecha precio · ${b.producto}`,
      action: b.diferencia_usd_m2 > 0
        ? "Revisar precio en publicaciones ML vs referencia de mercado"
        : "Evaluar ajuste de margen en listings del producto",
      detail: b.interpretacion,
      source: "product_matrix",
      tab_hint: "listings",
      meta: {
        delta_pct: b.diferencia_porcentaje,
        precio_bmc_usd_m2: b.precio_bmc_usd_m2,
      },
    });
  }

  items.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));

  const summary = ml?.metricas
    ? `${ml.metricas.preguntas_sin_respuesta ?? "—"} preguntas sin responder · ${items.length} playbooks sugeridos`
    : `${items.length} playbooks sugeridos desde inteligencia de mercado`;

  return {
    items,
    summary,
    generated_at: new Date().toISOString(),
    sources: ["ml_pulse", "product_matrix"],
    data_freshness: ml?.fecha_captura || null,
  };
}
