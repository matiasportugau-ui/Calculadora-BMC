import React, { Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import '../../admin-cotizaciones/styles.css';
import { useConnectorStatus } from './hooks/useMlConnector.js';
import { getMlReauthUrl } from './utils/mlFetch.js';
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

export default function MlManagerModule() {
  const [activeTab, setActiveTab] = useState('overview');
  const status = useConnectorStatus();

  const connected = status.data?.ok === true && status.data?.expired !== true;
  // A dormant token may still be "stored" (ok:true) but expired and no longer
  // refreshable. In that case the badge offers a re-auth fallback so the user
  // is not stranded on "Verificá la conexión" without guidance. See
  // docs/ML-OAUTH-SETUP.md → "Fallback de re-autorización (token dormido)".
  const reauthUrl = getMlReauthUrl();
  const statusLabel = connected
    ? 'Cuenta conectada'
    : (status.data?.expired ? 'Token vencido' : 'Sin cuenta');

  return (
    <div className="adminCot" data-skin="macos" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--ac-bg)' }}>
      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid var(--ac-border)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
          <Link to="/hub" style={{ color: 'var(--ac-accent)', textDecoration: 'none' }}>Hub</Link>
          <span style={{ color: 'var(--ac-text-2)' }}>›</span>
          <span style={{ color: 'var(--ac-text)', fontWeight: '600' }}>ML Manager</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
            <span>{statusLabel}</span>
          </div>
          {!connected && (
            <a
              href={reauthUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '12px',
                fontWeight: '600',
                padding: '5px 12px',
                borderRadius: '20px',
                textDecoration: 'none',
                color: '#fff',
                background: 'var(--ac-accent)',
                border: '1px solid var(--ac-accent)',
              }}
            >
              Reconectar con Mercado Libre
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', borderBottom: '1.5px solid var(--ac-border)', paddingLeft: '24px', marginBottom: '20px' }}>
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

      {/* Content */}
      <div style={{ flex: 1, paddingLeft: '24px', paddingRight: '24px', paddingBottom: '40px' }}>
        <Suspense fallback={<div style={{ padding: '20px', color: 'var(--ac-text-2)' }}>Cargando…</div>}>
          {tabDefs.map((tab) => {
            if (activeTab !== tab.key) return null;
            const Component = tab.component;
            return <Component key={tab.key} />;
          })}
        </Suspense>
      </div>
    </div>
  );
}
