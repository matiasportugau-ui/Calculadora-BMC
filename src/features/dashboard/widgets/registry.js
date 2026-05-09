import KPICard from './KPICard.jsx';
import VentasPorCanalChart from './VentasPorCanalChart.jsx';
import PagosPendientesTable from './PagosPendientesTable.jsx';
import CotizacionesTable from './CotizacionesTable.jsx';
import EntregasTable from './EntregasTable.jsx';
import LogisticaWidget from './LogisticaWidget.jsx';
import StockWidget from './StockWidget.jsx';
import MetasVentasWidget from './MetasVentasWidget.jsx';
import HealthCheckGrid from './HealthCheckGrid.jsx';
import BuildInfoWidget from './BuildInfoWidget.jsx';

export const WidgetRegistry = {
  KPICard,
  VentasPorCanalChart,
  PagosPendientesTable,
  CotizacionesTable,
  EntregasTable,
  LogisticaWidget,
  StockWidget,
  MetasVentasWidget,
  HealthCheckGrid,
  BuildInfoWidget,
};

export const WidgetCatalog = [
  { type: 'KPICard',              label: 'KPI Card',                category: 'comercial' },
  { type: 'VentasPorCanalChart',  label: 'Ventas por canal',        category: 'comercial' },
  { type: 'PagosPendientesTable', label: 'Pagos pendientes',        category: 'comercial' },
  { type: 'MetasVentasWidget',    label: 'Metas de ventas',         category: 'comercial' },
  { type: 'CotizacionesTable',    label: 'Cotizaciones',            category: 'crm' },
  { type: 'EntregasTable',        label: 'Próximas entregas',       category: 'crm' },
  { type: 'LogisticaWidget',      label: 'Coordinación logística',  category: 'crm' },
  { type: 'StockWidget',          label: 'Stock e-commerce',        category: 'devops' },
  { type: 'HealthCheckGrid',      label: 'Health check',            category: 'devops' },
  { type: 'BuildInfoWidget',      label: 'Build info',              category: 'devops' },
];
