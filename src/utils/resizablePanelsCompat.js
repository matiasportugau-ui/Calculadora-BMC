export function toResizablePanelSize(value) {
  return typeof value === "number" ? `${value}%` : value;
}

export function panelLayoutArrayToMap(panelIds, layout) {
  if (!Array.isArray(layout)) return layout;
  if (!Array.isArray(panelIds) || panelIds.length !== layout.length) return undefined;

  return panelIds.reduce((acc, panelId, index) => {
    acc[String(panelId)] = layout[index];
    return acc;
  }, {});
}
