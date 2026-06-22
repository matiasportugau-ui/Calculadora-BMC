import React, { useState } from 'react';
import { useSales } from '../hooks/useMlConnector.js';

export default function ShipmentsTab() {
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const sales = useSales({ limit: 50 });

  if (!sales.data) {
    return <div style={{ padding: '40px', color: '#6e6e73', textAlign: 'center' }}>Cargando envíos...</div>;
  }

  const orders = sales.data?.results || [];

  return (
    <div>
      <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f5f5f7' }}>
              <th style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.4px', color: '#6e6e73', padding: '10px 12px', textAlign: 'left', borderBottom: '1.5px solid #e5e5ea' }}>Orden</th>
              <th style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.4px', color: '#6e6e73', padding: '10px 12px', textAlign: 'left', borderBottom: '1.5px solid #e5e5ea' }}>Comprador</th>
              <th style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.4px', color: '#6e6e73', padding: '10px 12px', textAlign: 'left', borderBottom: '1.5px solid #e5e5ea' }}>Estado Envío</th>
              <th style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.4px', color: '#6e6e73', padding: '10px 12px', textAlign: 'left', borderBottom: '1.5px solid #e5e5ea' }}>Actualización</th>
            </tr>
          </thead>
          <tbody>
            {orders.length ? (
              orders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                return (
                  <React.Fragment key={order.id}>
                    <tr
                      style={{
                        borderBottom: '1px solid #e5e5ea',
                        cursor: 'pointer',
                        background: isExpanded ? '#f9f9fb' : '#fff',
                      }}
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    >
                      <td style={{ padding: '11px 12px', fontWeight: '600', color: '#0071e3' }}>{order.id}</td>
                      <td style={{ padding: '11px 12px' }}>{order.buyer_nickname || 'Anónimo'}</td>
                      <td style={{ padding: '11px 12px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 9px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: '#f0fdf4',
                            color: '#15803d',
                            border: '1px solid #bbf7d0',
                          }}
                        >
                          ● En tránsito
                        </span>
                      </td>
                      <td style={{ padding: '11px 12px', color: '#6e6e73', fontSize: '12px' }}>
                        {new Date(order.date).toLocaleDateString()}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ borderBottom: '1px solid #e5e5ea', background: '#fafbfc' }}>
                        <td colSpan="4" style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: '12px', lineHeight: '1.6', color: '#6e6e73' }}>
                            <div style={{ fontWeight: '600', marginBottom: '8px' }}>Historial de seguimiento:</div>
                            <div style={{ marginLeft: '16px' }}>
                              <div>✓ Orden confirmada - {new Date(order.date).toLocaleDateString()}</div>
                              <div>✓ Pago procesado</div>
                              <div>✓ Preparado para envío</div>
                              <div style={{ color: '#d97706' }}>◷ En tránsito (esperado hoy)</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan="4" style={{ padding: '40px 12px', textAlign: 'center', color: '#6e6e73' }}>
                  Sin envíos recientes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
