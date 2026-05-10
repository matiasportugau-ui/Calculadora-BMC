import React from 'react';
import DashboardCanvas from '../DashboardCanvas.jsx';
import { useDashboardLayout } from '../useDashboardLayout.js';

const widgets = {
  'health':     { type: 'HealthCheckGrid',  props: {} },
  'stock':      { type: 'StockWidget',      props: {} },
  'build-info': { type: 'BuildInfoWidget',  props: {} },
};

export default function DevopsDashboard({ editable }) {
  const { layouts, save } = useDashboardLayout('devops');
  return <DashboardCanvas layouts={layouts} widgets={widgets} editable={editable} onLayoutChange={save} />;
}
