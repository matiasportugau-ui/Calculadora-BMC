import React from 'react';
import { useReputation, useSales, useItemQuality } from '../hooks/useMlConnector.js';

export default function AnalyticsTab() {
  const reputation = useReputation();
  const sales = useSales({ limit: 10 });
  const quality = useItemQuality();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Reputation Card */}
      <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '14px' }}>Reputación</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#6e6e73', fontWeight: '500' }}>Nivel</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#15803d', marginTop: '4px' }}>
              {reputation.data?.rating_level || 'N/A'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#6e6e73', fontWeight: '500' }}>Positivas</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#0071e3', marginTop: '4px' }}>
              {reputation.data?.positive_percentage || 0}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#6e6e73', fontWeight: '500' }}>Reclamaciones</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#d97706', marginTop: '4px' }}>
              {reputation.data?.claim_percentage || 0}%
            </div>
          </div>
        </div>
      </div>

      {/* Sales Trend */}
      <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '14px' }}>Ventas Recientes</div>
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {sales.data?.results?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sales.data.results.map((sale) => (
                <div
                  key={sale.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#f5f5f7',
                    fontSize: '12px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '500' }}>{sale.buyer_nickname || 'Anónimo'}</div>
                    <div style={{ color: '#6e6e73', fontSize: '11px' }}>
                      {new Date(sale.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ fontWeight: '600', color: '#15803d' }}>
                    ${sale.price?.toLocaleString() || '0'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#6e6e73', textAlign: 'center', padding: '20px' }}>
              Sin ventas recientes
            </div>
          )}
        </div>
      </div>

      {/* Item Quality */}
      <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '14px' }}>Calidad de Ítems</div>
        {quality.data?.results?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {quality.data.results.slice(0, 5).map((item) => (
              <div key={item.id} style={{ paddingBottom: '10px', borderBottom: '1px solid #e5e5ea' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '500', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: item.quality_score >= 80 ? '#15803d' : item.quality_score >= 60 ? '#d97706' : '#b91c1c' }}>
                    {item.quality_score || 0}%
                  </div>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#e5e5ea', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: item.quality_score >= 80 ? '#15803d' : item.quality_score >= 60 ? '#d97706' : '#b91c1c',
                      width: `${item.quality_score || 0}%`,
                    }}
                  />
                </div>
                {item.issues?.length > 0 && (
                  <div style={{ marginTop: '6px', fontSize: '11px', color: '#b91c1c' }}>
                    ⚠ {item.issues.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#6e6e73', textAlign: 'center', padding: '20px' }}>
            Sin datos de calidad
          </div>
        )}
      </div>
    </div>
  );
}
