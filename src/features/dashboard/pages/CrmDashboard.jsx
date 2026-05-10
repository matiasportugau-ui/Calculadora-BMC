import React from 'react';
import DashboardCanvas from '../DashboardCanvas.jsx';
import { useDashboardLayout } from '../useDashboardLayout.js';

const widgets = {
  'cotizaciones': { type: 'CotizacionesTable', props: {} },
  'entregas':     { type: 'EntregasTable',     props: {} },
  'logistica':    { type: 'LogisticaWidget',   props: {} },
};

export default function CrmDashboard({ editable }) {
  const { layouts, save } = useDashboardLayout('crm');
  return <DashboardCanvas layouts={layouts} widgets={widgets} editable={editable} onLayoutChange={save} />;
}
