export function panelPercentSize(value) {
  return typeof value === "number" ? `${value}%` : value;
}

export function layoutArrayToObject(panelIds, layout) {
  if (!Array.isArray(layout)) return layout;
  return panelIds.reduce((acc, id, index) => {
    const value = Number(layout[index]);
    if (Number.isFinite(value)) acc[id] = value;
    return acc;
  }, {});
}

export function layoutObjectToArray(panelIds, layout) {
  if (Array.isArray(layout)) return layout;
  if (!layout || typeof layout !== "object") return [];
  return panelIds
    .map((id) => Number(layout[id]))
    .filter((value) => Number.isFinite(value));
}
