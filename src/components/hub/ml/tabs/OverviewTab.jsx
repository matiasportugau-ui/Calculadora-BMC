import React from 'react';
import { useDailyBrief, useConnectorStatus, useListings, useUnreadMessages, useCampaigns, useSales } from '../hooks/useMlConnector.js';

export default function OverviewTab() {
  const status = useConnectorStatus();
  const brief = useDailyBrief();
  const listings = useListings({ limit: 1 });
  const unread = useUnreadMessages();
  const campaigns = useCampaigns();
  const sales = useSales({ limit: 7 });

  if (!status.data?.access_token) {
    return <div style={{ padding: '40px', color: '#6e6e73', textAlign: 'center' }}>No ML account connected. Please authenticate first.</div>;
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ fontSize: '11px', color: '#6e6e73', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '.4px' }}>Reputación</div>
          <div style={{ fontSize: '26px', fontWeight: '700', letterSpacing: '-.5px', color: '#15803d', marginTop: '4px' }}>
            {status.data?.rating_level || 'N/A'}★
          </div>
          <div style={{ fontSize: '11px', color: '#6e6e73', marginTop: '2px' }}>Nivel {status.data?.rating_level || 'sin clasificar'}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ fontSize: '11px', color: '#6e6e73', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '.4px' }}>Publicaciones</div>
          <div style={{ fontSize: '26px', fontWeight: '700', letterSpacing: '-.5px', color: '#0071e3', marginTop: '4px' }}>{listings.data?.results?.length || 0}</div>
          <div style={{ fontSize: '11px', color: '#6e6e73', marginTop: '2px' }}>activas</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ fontSize: '11px', color: '#6e6e73', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '.4px' }}>Preguntas</div>
          <div style={{ fontSize: '26px', fontWeight: '700', letterSpacing: '-.5px', color: '#d97706', marginTop: '4px' }}>0</div>
          <div style={{ fontSize: '11px', color: '#6e6e73', marginTop: '2px' }}>sin responder</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ fontSize: '11px', color: '#6e6e73', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '.4px' }}>Mensajes</div>
          <div style={{ fontSize: '26px', fontWeight: '700', letterSpacing: '-.5px', color: '#d97706', marginTop: '4px' }}>{unread.data?.unread_count || 0}</div>
          <div style={{ fontSize: '11px', color: '#6e6e73', marginTop: '2px' }}>no leídos</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ fontSize: '11px', color: '#6e6e73', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '.4px' }}>Gasto hoy</div>
          <div style={{ fontSize: '26px', fontWeight: '700', letterSpacing: '-.5px', color: '#0071e3', marginTop: '4px' }}>$0</div>
          <div style={{ fontSize: '11px', color: '#6e6e73', marginTop: '2px' }}>{campaigns.data?.results?.length || 0} campañas</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ fontSize: '11px', color: '#6e6e73', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '.4px' }}>Ventas (7d)</div>
          <div style={{ fontSize: '26px', fontWeight: '700', letterSpacing: '-.5px', color: '#15803d', marginTop: '4px' }}>{sales.data?.results?.length || 0}</div>
          <div style={{ fontSize: '11px', color: '#6e6e73', marginTop: '2px' }}>órdenes</div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--ac-text)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px' }}>🤖</span>
          Resumen diario IA
        </div>
        {brief.isLoading && <div style={{ color: '#6e6e73' }}>Cargando...</div>}
        {brief.data?.daily_brief && (
          <div style={{ fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap', color: 'var(--ac-text)' }}>
            {brief.data.daily_brief}
          </div>
        )}
        {brief.error && <div style={{ color: 'var(--ac-error)' }}>Error al cargar resumen</div>}
      </div>
    </div>
  );
}
