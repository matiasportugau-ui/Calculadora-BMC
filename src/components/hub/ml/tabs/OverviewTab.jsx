import React from 'react';
import { useUserMe, useListings, useQuestions, useOrders, useMlPlaybooks } from '../hooks/useMlConnector.js';

const card = {
  background: 'var(--ac-surface)',
  border: '1px solid var(--ac-border)',
  borderRadius: '12px',
  padding: '14px 16px',
  boxShadow: '0 1px 3px rgba(0,0,0,.04)',
};
const cardLabel = {
  fontSize: '11px',
  color: 'var(--ac-text-2)',
  fontWeight: '500',
  textTransform: 'uppercase',
  letterSpacing: '.4px',
};
const cardValue = (color) => ({
  fontSize: '26px',
  fontWeight: '700',
  letterSpacing: '-.5px',
  color,
  marginTop: '4px',
});
const cardSub = { fontSize: '11px', color: 'var(--ac-text-2)', marginTop: '2px' };

const priorityColor = {
  alta: 'var(--ac-error)',
  media: 'var(--ac-warn)',
  baja: 'var(--ac-text-2)',
};

const TAB_LABELS = {
  questions: 'Preguntas',
  listings: 'Publicaciones',
  orders: 'Pedidos',
  overview: 'Resumen',
};

function KpiCard({ label, value, sub, color, loading }) {
  return (
    <div style={card}>
      <div style={cardLabel}>{label}</div>
      <div style={typeof value === 'string' && value.length > 12 ? { ...cardValue(color), fontSize: '18px' } : cardValue(color)}>
        {loading ? '…' : value}
      </div>
      <div style={cardSub}>{sub}</div>
    </div>
  );
}

export default function OverviewTab({ onNavigateTab }) {
  const me = useUserMe();
  const listings = useListings({ limit: 1 });
  const questions = useQuestions({ status: 'UNANSWERED', limit: 1 });
  const orders = useOrders({ limit: 1 });
  const playbooks = useMlPlaybooks();

  const mlDegraded = Boolean(me.error || listings.error || questions.error || orders.error);
  const reputation = me.data?.seller_reputation?.level_id || me.data?.seller_reputation?.power_seller_status || 'sin clasificar';
  const items = playbooks.data?.items || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {mlDegraded && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid var(--ac-border)',
            background: 'var(--ac-bg)',
            fontSize: '12px',
            color: 'var(--ac-text-2)',
          }}
        >
          KPIs de cuenta ML no disponibles (OAuth o API). Los playbooks de inteligencia de mercado siguen abajo.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
        <KpiCard
          label="Vendedor"
          value={me.error ? '—' : (me.data?.nickname || 'N/A')}
          sub={me.error ? 'sin conexión' : `Reputación: ${me.isLoading ? '…' : reputation}`}
          color="var(--ac-accent)"
          loading={me.isLoading && !me.error}
        />
        <KpiCard
          label="Publicaciones"
          value={listings.error ? '—' : (listings.data?.paging?.total ?? 0)}
          sub="totales"
          color="var(--ac-accent)"
          loading={listings.isLoading && !listings.error}
        />
        <KpiCard
          label="Preguntas"
          value={questions.error ? '—' : (questions.data?.total ?? 0)}
          sub="sin responder"
          color="var(--ac-warn)"
          loading={questions.isLoading && !questions.error}
        />
        <KpiCard
          label="Pedidos"
          value={orders.error ? '—' : (orders.data?.paging?.total ?? 0)}
          sub="recientes"
          color="var(--ac-success)"
          loading={orders.isLoading && !orders.error}
        />
      </div>

      <div style={{ ...card, padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--ac-text)' }}>Playbooks · intel → ML</div>
            <div style={{ fontSize: '11px', color: 'var(--ac-text-2)', marginTop: '2px' }}>
              {playbooks.isLoading ? 'Cargando sugerencias…' : (playbooks.data?.summary || 'Sin datos de inteligencia')}
            </div>
          </div>
          {playbooks.data?.data_freshness && (
            <span style={{ fontSize: '10px', color: 'var(--ac-text-2)' }}>Intel {playbooks.data.data_freshness}</span>
          )}
        </div>

        {playbooks.error && (
          <div style={{ fontSize: '12px', color: 'var(--ac-text-2)' }}>
            Playbooks no disponibles ({playbooks.error.message || 'error'}). Requiere sesión operador.
          </div>
        )}

        {!playbooks.error && items.length === 0 && !playbooks.isLoading && (
          <div style={{ fontSize: '12px', color: 'var(--ac-text-2)' }}>No hay playbooks sugeridos por ahora.</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.slice(0, 6).map((item) => (
            <div
              key={item.id}
              style={{
                border: '1px solid var(--ac-border)',
                borderRadius: '10px',
                padding: '10px 12px',
                background: 'var(--ac-bg)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--ac-text)' }}>{item.title}</div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    color: priorityColor[item.priority] || 'var(--ac-text-2)',
                    textTransform: 'uppercase',
                  }}
                >
                  {item.priority}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ac-text-2)', marginTop: '4px', lineHeight: 1.35 }}>{item.action}</div>
              {item.detail && (
                <div style={{ fontSize: '10px', color: 'var(--ac-text-2)', marginTop: '4px', opacity: 0.9 }}>{item.detail}</div>
              )}
              {item.tab_hint && onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab(item.tab_hint)}
                  style={{
                    marginTop: '8px',
                    padding: '4px 10px',
                    fontSize: '10px',
                    fontWeight: '600',
                    borderRadius: '6px',
                    border: '1px solid var(--ac-border)',
                    background: 'var(--ac-surface)',
                    color: 'var(--ac-accent)',
                    cursor: 'pointer',
                  }}
                >
                  Ir a {TAB_LABELS[item.tab_hint] || item.tab_hint}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
