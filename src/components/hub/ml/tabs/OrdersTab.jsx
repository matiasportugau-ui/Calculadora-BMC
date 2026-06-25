import React from 'react';
import { useOrders } from '../hooks/useMlConnector.js';

const th = {
  fontSize: '11px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '.4px',
  color: 'var(--ac-text-2)',
  padding: '10px 12px',
  textAlign: 'left',
  borderBottom: '1.5px solid var(--ac-border)',
};
const td = { padding: '11px 12px', color: 'var(--ac-text)', verticalAlign: 'top' };

export default function OrdersTab() {
  const orders = useOrders({ limit: 50 });

  if (orders.isLoading) {
    return <div style={{ padding: '40px', color: 'var(--ac-text-2)', textAlign: 'center' }}>Cargando pedidos…</div>;
  }
  if (orders.error) {
    return <div style={{ padding: '40px', color: 'var(--ac-error)', textAlign: 'center' }}>Error al cargar los pedidos.</div>;
  }

  const results = orders.data?.results || [];

  return (
    <div style={{ background: 'var(--ac-surface)', border: '1px solid var(--ac-border)', borderRadius: '12px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: 'var(--ac-bg)' }}>
            <th style={th}>ID</th>
            <th style={th}>Fecha</th>
            <th style={th}>Comprador</th>
            <th style={th}>Estado</th>
            <th style={{ ...th, textAlign: 'right' }}>Total</th>
            <th style={th}>Productos</th>
          </tr>
        </thead>
        <tbody>
          {results.length ? (
            results.map((order) => (
              <tr key={order.id} style={{ borderBottom: '1px solid var(--ac-border)' }}>
                <td style={{ ...td, fontFamily: 'monospace' }}>{order.id}</td>
                <td style={td}>
                  {order.date_created ? new Date(order.date_created).toLocaleDateString('es-UY') : '—'}
                </td>
                <td style={td}>{order.buyer?.nickname || '—'}</td>
                <td style={td}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: 'var(--ac-bg)', color: 'var(--ac-text-2)', border: '1px solid var(--ac-border)' }}>
                    {order.status || '—'}
                  </span>
                </td>
                <td style={{ ...td, textAlign: 'right', fontWeight: '600' }}>
                  {order.currency_id ? `${order.currency_id} ` : ''}
                  {order.total_amount != null ? Number(order.total_amount).toLocaleString('es-UY') : '—'}
                </td>
                <td style={td}>
                  {order.order_items?.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {order.order_items.map((oi, i) => (
                        <span key={i} style={{ fontSize: '12px' }}>
                          {oi.quantity}× {oi.item?.title || 'Producto'}
                        </span>
                      ))}
                    </div>
                  ) : '—'}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--ac-text-2)' }}>
                Sin pedidos
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
