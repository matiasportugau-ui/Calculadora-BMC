import React, { Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import '../../admin-cotizaciones/styles.css';
import { useConnectorStatus } from './hooks/useMlConnector.js';
import OverviewTab from './tabs/OverviewTab.jsx';
import ListingsTab from './tabs/ListingsTab.jsx';
import MessagesTab from './tabs/MessagesTab.jsx';
import AdsTab from './tabs/AdsTab.jsx';
import ShipmentsTab from './tabs/ShipmentsTab.jsx';
import AnalyticsTab from './tabs/AnalyticsTab.jsx';

const tabDefs = [
  { key: 'overview', label: 'Resumen', component: OverviewTab },
  { key: 'listings', label: 'Publicaciones', component: ListingsTab },
  { key: 'messages', label: 'Mensajes', component: MessagesTab },
  { key: 'ads', label: 'Publicidad', component: AdsTab },
  { key: 'shipments', label: 'Envíos', component: ShipmentsTab },
  { key: 'analytics', label: 'Analítica', component: AnalyticsTab },
];

export default function MlManagerModule() {
  const [activeTab, setActiveTab] = useState('overview');
  const status = useConnectorStatus();

  const hasToken = status.data?.access_token;

  return (
    <div className="adminCot" data-skin="macos" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--ac-bg)' }}>
      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid var(--ac-border)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
          <Link to="/hub" style={{ color: 'var(--ac-accent)', textDecoration: 'none' }}>Hub</Link>
          <span style={{ color: 'var(--ac-text-2)' }}>›</span>
          <span style={{ color: 'var(--ac-text)', fontWeight: '600' }}>ML Manager</span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          fontWeight: '500',
          padding: '5px 12px',
          borderRadius: '20px',
          border: '1px solid',
          ...(hasToken ? {
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
            background: hasToken ? 'var(--ac-success)' : 'var(--ac-error)',
          }} />
          <span>{hasToken ? 'Cuenta conectada' : 'Sin cuenta'}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', borderBottom: '1.5px solid var(--ac-border)', paddingLeft: '24px', marginBottom: '20px' }}>
        {tabDefs.map((tab) => {
          const isUnread = tab.key === 'messages' && status.data?.unread_count > 0;
          return (
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
              {isUnread && (
                <span style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  minWidth: '16px',
                  height: '16px',
                  background: 'var(--ac-error)',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '9px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}>3</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingLeft: '24px', paddingRight: '24px', paddingBottom: '40px' }}>
        <Suspense fallback={<div style={{ padding: '20px', color: 'var(--ac-text-2)' }}>Cargando...</div>}>
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
