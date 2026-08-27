/**
 * Short rioplatense summary of a chooseTripPlan preview. No WA.
 */

const STRAT_LABEL = {
  doorPriority: "Acceso rápido",
  balanced: "Balanceado",
  compact: "Compacto",
};

/**
 * @param {object} preview
 * @returns {string}
 */
export function formatTripPlanPreview(preview) {
  if (!preview || preview.status === "blocked") {
    const b = preview?.blocks?.[0];
    const label = b?.label || "Faltan datos de una parada";
    return `No armo ruta todavía.\n${label}.\nDecime el dato; no invento calle ni pin.`;
  }
  const legs = (preview.route?.orderedLegs || [])
    .map((l, i) => {
      const kind =
        l.type === "pickup" ? "Levante" : l.type === "delivery" ? "Entrega" : l.type === "depot" ? "Depo" : "Base";
      return `${i + 1}. ${kind}: ${l.label || l.addressText || l.refId || "—"}`;
    })
    .join("\n");
  const km =
    preview.route?.totalKm != null ? `~${Number(preview.route.totalKm).toFixed(0)} km` : "sin km";
  const how = preview.roadUnverified ? "aire (calles no verificadas)" : "calles";
  const strat = STRAT_LABEL[preview.strategy] || preview.strategy;
  const unload = (preview.unloadStopIds || []).length
    ? `Descarga: ${preview.unloadStopIds.length} parada(s) (puerta primero).`
    : "";
  return [
    preview.why || "Una propuesta.",
    legs,
    `Km ${km} · ${how}`,
    `Carga: ${strat}${preview.cabe ? " · entra" : ""}`,
    unload,
    "¿Aplico este plan?",
  ]
    .filter(Boolean)
    .join("\n");
}
