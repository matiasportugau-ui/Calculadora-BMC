// Default react-grid-layout positions per dashboard scope.
// Grid: 12 cols (lg), rowHeight=60px.
// Each `i` must match a widget id used in the page's widgets map.

export const defaultLayouts = {
  comercial: {
    lg: [
      { i: 'kpi-revenue',   x: 0, y: 0, w: 3, h: 2 },
      { i: 'kpi-margin',    x: 3, y: 0, w: 3, h: 2 },
      { i: 'kpi-aov',       x: 6, y: 0, w: 3, h: 2 },
      { i: 'kpi-conv',      x: 9, y: 0, w: 3, h: 2 },
      { i: 'ventas-canal',  x: 0, y: 2, w: 8, h: 5 },
      { i: 'metas-ventas',  x: 8, y: 2, w: 4, h: 5 },
      { i: 'pagos-aging',   x: 0, y: 7, w: 12, h: 6 },
    ],
    md: [
      { i: 'kpi-revenue',   x: 0, y: 0, w: 5, h: 2 },
      { i: 'kpi-margin',    x: 5, y: 0, w: 5, h: 2 },
      { i: 'kpi-aov',       x: 0, y: 2, w: 5, h: 2 },
      { i: 'kpi-conv',      x: 5, y: 2, w: 5, h: 2 },
      { i: 'ventas-canal',  x: 0, y: 4, w: 10, h: 5 },
      { i: 'metas-ventas',  x: 0, y: 9, w: 10, h: 4 },
      { i: 'pagos-aging',   x: 0, y: 13, w: 10, h: 6 },
    ],
  },
  crm: {
    lg: [
      { i: 'cotizaciones',  x: 0, y: 0, w: 12, h: 7 },
      { i: 'entregas',      x: 0, y: 7, w: 6, h: 5 },
      { i: 'logistica',     x: 6, y: 7, w: 6, h: 5 },
    ],
    md: [
      { i: 'cotizaciones',  x: 0, y: 0, w: 10, h: 7 },
      { i: 'entregas',      x: 0, y: 7, w: 10, h: 5 },
      { i: 'logistica',     x: 0, y: 12, w: 10, h: 5 },
    ],
  },
  devops: {
    lg: [
      { i: 'health',        x: 0, y: 0, w: 12, h: 4 },
      { i: 'stock',         x: 0, y: 4, w: 8, h: 6 },
      { i: 'build-info',    x: 8, y: 4, w: 4, h: 6 },
    ],
    md: [
      { i: 'health',        x: 0, y: 0, w: 10, h: 4 },
      { i: 'stock',         x: 0, y: 4, w: 10, h: 6 },
      { i: 'build-info',    x: 0, y: 10, w: 10, h: 5 },
    ],
  },
};
