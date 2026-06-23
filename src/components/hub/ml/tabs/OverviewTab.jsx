import React from 'react';
import { useUserMe, useListings, useQuestions, useOrders } from '../hooks/useMlConnector.js';

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

export default function OverviewTab() {
  const me = useUserMe();
  const listings = useListings({ limit: 1 });
  const questions = useQuestions({ status: 'UNANSWERED', limit: 1 });
  const orders = useOrders({ limit: 1 });

  const anyError = me.error || listings.error || questions.error || orders.error;
  if (anyError) {
    return (
      <div style={{ padding: '40px', color: 'var(--ac-error)', textAlign: 'center' }}>
        Error al cargar el resumen. Verificá la conexión con Mercado Libre.
      </div>
    );
  }

  const reputation = me.data?.seller_reputation?.level_id || me.data?.seller_reputation?.power_seller_status || 'sin clasificar';

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
        <div style={card}>
          <div style={cardLabel}>Vendedor</div>
          <div style={{ ...cardValue('var(--ac-accent)'), fontSize: '18px' }}>
            {me.isLoading ? 'Cargando…' : (me.data?.nickname || 'N/A')}
          </div>
          <div style={cardSub}>Reputación: {me.isLoading ? '…' : reputation}</div>
        </div>
        <div style={card}>
          <div style={cardLabel}>Publicaciones</div>
          <div style={cardValue('var(--ac-accent)')}>
            {listings.isLoading ? '…' : (listings.data?.paging?.total ?? 0)}
          </div>
          <div style={cardSub}>totales</div>
        </div>
        <div style={card}>
          <div style={cardLabel}>Preguntas</div>
          <div style={cardValue('var(--ac-warn)')}>
            {questions.isLoading ? '…' : (questions.data?.paging?.total ?? 0)}
          </div>
          <div style={cardSub}>sin responder</div>
        </div>
        <div style={card}>
          <div style={cardLabel}>Pedidos</div>
          <div style={cardValue('var(--ac-success)')}>
            {orders.isLoading ? '…' : (orders.data?.paging?.total ?? 0)}
          </div>
          <div style={cardSub}>recientes</div>
        </div>
      </div>
    </div>
  );
}
