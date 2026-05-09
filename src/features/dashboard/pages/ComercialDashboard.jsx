import React from 'react';
import DashboardCanvas from '../DashboardCanvas.jsx';
import { useDashboardLayout } from '../useDashboardLayout.js';

const widgets = {
  'kpi-revenue': { type: 'KPICard',              props: { title: 'Ingresos brutos',      metric: 'revenue_uyu',     format: 'currency_uyu', subtitle: 'Últimos 30 días' } },
  'kpi-margin':  { type: 'KPICard',              props: { title: 'Margen bruto',         metric: 'margin_uyu',      format: 'currency_uyu' } },
  'kpi-aov':     { type: 'KPICard',              props: { title: 'Ticket promedio',      metric: 'aov_uyu',         format: 'currency_uyu' } },
  'kpi-conv':    { type: 'KPICard',              props: { title: 'Tasa de conversión',   metric: 'conversion_rate', format: 'percent' } },
  'ventas-canal':{ type: 'VentasPorCanalChart',  props: {} },
  'metas-ventas':{ type: 'MetasVentasWidget',    props: {} },
  'pagos-aging': { type: 'PagosPendientesTable', props: {} },
};

export default function ComercialDashboard({ editable }) {
  const { layouts, save } = useDashboardLayout('comercial');
  return <DashboardCanvas layouts={layouts} widgets={widgets} editable={editable} onLayoutChange={save} />;
}
