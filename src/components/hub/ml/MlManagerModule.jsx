import React, { Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import '../../admin-cotizaciones/styles.css';
import { useConnectorStatus } from './hooks/useMlConnector.js';
import OverviewTab from './tabs/OverviewTab.jsx';
import ListingsTab from './tabs/ListingsTab.jsx';
import QuestionsTab from './tabs/QuestionsTab.jsx';
import OrdersTab from './tabs/OrdersTab.jsx';

const tabDefs = [
  { key: 'overview', label: 'Resumen', component: OverviewTab },
  { key: 'listings', label: 'Publicaciones', component: ListingsTab },
  { key: 'questions', label: 'Preguntas', component: QuestionsTab },
  { key: 'orders', label: 'Pedidos', component: OrdersTab },
];

// `embedded` renders the manager inside another surface (e.g. the Canales hub's
// "ML Manager" tab): it drops the standalone page chrome — the full-height
// `adminCot data-skin="macos"` wrapper (which would override the host skin), the
// Hub › ML Manager breadcrumb, and the outer paddings — while keeping the
// connection pill, tab strip and content. Default `false` preserves the
// standalone /hub/ml-manager route unchanged.
export default function MlManagerModule({ embedded = false }) {
  const [activeTab, setActiveTab] = useState('overview');
  const status = useConnectorStatus();

  const connected = status.data?.ok === true;

  const connectionPill = (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '12px',
      fontWeight: '500',
      padding: '5px 12px',
      borderRadius: '20px',
      border: '1px solid',
      ...(connected ? {
        color: '#15803d',
        background: '#f0fdf4',
        borderColor: '#bbf7d0',
      } : {
        color: '#b91c1c',
        background: '#fff1f0',
        borderColor: '#fecaca',
      }),
    }}>
      <div style={{
        width: '7px',
        height: '7px',
        borderRadius: '50%',
        background: connected ? 'var(--ac-success)' : 'var(--ac-error)',
      }} />
      <span>{connected ? 'Cuenta conectada' : 'Sin cuenta'}</span>
    </div>
  );

  const tabStrip = (
    <div style={{ display: 'flex', gap: '2px', borderBottom: '1.5px solid var(--ac-border)', paddingLeft: embedded ? 0 : '24px', marginBottom: '20px' }}>
      {tabDefs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          style={{
            padding: '9px 16px',
            fontSize: '13px',
            fontWeight: activeTab === tab.key ? '600' : '500',
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            color: activeTab === tab.key ? 'var(--ac-accent)' : 'var(--ac-text-2)',
            borderBottom: activeTab === tab.key ? '2.5px solid var(--ac-accent)' : '2.5px solid transparent',
            marginBottom: '-1.5px',
            position: 'relative',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  const content = (
    <div style={{ flex: 1, paddingLeft: embedded ? 0 : '24px', paddingRight: embedded ? 0 : '24px', paddingBottom: embedded ? 0 : '40px' }}>
      <Suspense fallback={<div style={{ padding: '20px', color: 'var(--ac-text-2)' }}>Cargando…</div>}>
        {tabDefs.map((tab) => {
          if (activeTab !== tab.key) return null;
          const Component = tab.component;
          return <Component key={tab.key} onNavigateTab={setActiveTab} />;
        })}
      </Suspense>
    </div>
  );

  if (embedded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Lightweight header — just the connection status, right-aligned. */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          {connectionPill}
        </div>
        {tabStrip}
        {content}
      </div>
    );
  }

  return (
    <div className="adminCot" data-skin="macos" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--ac-bg)' }}>
      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid var(--ac-border)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
          <Link to="/hub" style={{ color: 'var(--ac-accent)', textDecoration: 'none' }}>Hub</Link>
          <span style={{ color: 'var(--ac-text-2)' }}>›</span>
          <span style={{ color: 'var(--ac-text)', fontWeight: '600' }}>ML Manager</span>
        </div>
        {connectionPill}
      </div>
      {tabStrip}
      {content}
    </div>
  );
}
