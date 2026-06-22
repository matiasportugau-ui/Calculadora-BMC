import React, { useState } from 'react';
import { useListings } from '../hooks/useMlConnector.js';

export default function ListingsTab() {
  const [offset] = useState(0);
  const listings = useListings({ limit: 50, offset });

  if (!listings.data) {
    return <div style={{ padding: '40px', color: '#6e6e73', textAlign: 'center' }}>Cargando publicaciones...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
        <input type="text" placeholder="🔍 Buscar publicación…" style={{ flex: 1, minWidth: '200px', padding: '7px 12px', fontSize: '13px', border: '1.5px solid #e5e5ea', borderRadius: '8px', fontFamily: 'inherit' }} />
        <select style={{ padding: '7px 10px', fontSize: '13px', border: '1.5px solid #e5e5ea', borderRadius: '8px', fontFamily: 'inherit' }}>
          <option>Todos los estados</option>
          <option>Activas</option>
          <option>Pausadas</option>
          <option>Cerradas</option>
        </select>
        <button style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', background: '#0071e3', color: '#fff', border: 'none', cursor: 'pointer' }}>+ Nueva</button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f5f5f7' }}>
              <th style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.4px', color: '#6e6e73', padding: '10px 12px', textAlign: 'left', borderBottom: '1.5px solid #e5e5ea' }}>Título</th>
              <th style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.4px', color: '#6e6e73', padding: '10px 12px', textAlign: 'left', borderBottom: '1.5px solid #e5e5ea' }}>Precio</th>
              <th style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.4px', color: '#6e6e73', padding: '10px 12px', textAlign: 'left', borderBottom: '1.5px solid #e5e5ea' }}>Estado</th>
              <th style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.4px', color: '#6e6e73', padding: '10px 12px', textAlign: 'left', borderBottom: '1.5px solid #e5e5ea' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {listings.data?.results?.length ? (
              listings.data.results.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #e5e5ea' }}>
                  <td style={{ padding: '11px 12px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</td>
                  <td style={{ padding: '11px 12px', fontWeight: '600' }}>
                    ${item.price?.toLocaleString() || 'N/A'}
                  </td>
                  <td style={{ padding: '11px 12px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                      ● Activa
                    </span>
                  </td>
                  <td style={{ padding: '11px 12px' }}>
                    <button style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '6px', background: 'transparent', color: '#6e6e73', border: '1.5px solid #e5e5ea', cursor: 'pointer' }}>⏸ Pausar</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ padding: '40px 12px', textAlign: 'center', color: '#6e6e73' }}>
                  Sin publicaciones
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
