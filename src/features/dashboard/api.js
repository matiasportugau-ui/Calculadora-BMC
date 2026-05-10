// Thin fetch wrappers for the existing /api endpoints exposed by server/routes/bmcDashboard.js.
// All requests use credentials:'include' so the existing httpOnly session cookie travels.

const base = '';

async function getJSON(path, params) {
  const url = new URL(base + path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.pathname + url.search, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} — ${txt.slice(0, 200)}`);
  }
  return res.json();
}

export const dashboardApi = {
  kpiFinanciero: () => getJSON('/api/kpi-financiero'),
  ventas: (range) => getJSON('/api/ventas', range ? { range } : undefined),
  ventasTabs: () => getJSON('/api/ventas/tabs'),
  pagosPendientes: () => getJSON('/api/pagos-pendientes'),
  cotizaciones: () => getJSON('/api/cotizaciones'),
  proximasEntregas: () => getJSON('/api/proximas-entregas'),
  coordinacionLogistica: () => getJSON('/api/coordinacion-logistica'),
  metasVentas: () => getJSON('/api/metas-ventas'),
  stockEcommerce: () => getJSON('/api/stock-ecommerce'),
  calendarioVencimientos: () => getJSON('/api/calendario-vencimientos'),
  health: () => getJSON('/health'),
};
