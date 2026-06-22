import React from 'react';
import { useCampaigns, useAdReports } from '../hooks/useMlConnector.js';

export default function AdsTab() {
  const campaigns = useCampaigns();
  const reports = useAdReports();

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.4px', color: '#6e6e73', marginBottom: '4px' }}>Gasto hoy</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#1d1d1f' }}>$0</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.4px', color: '#6e6e73', marginBottom: '4px' }}>Impresiones</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#1d1d1f' }}>0</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.4px', color: '#6e6e73', marginBottom: '4px' }}>Clics</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#1d1d1f' }}>0</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.4px', color: '#6e6e73', marginBottom: '4px' }}>ACOS</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#d97706' }}>N/A</div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e5ea', fontSize: '13px', fontWeight: '700' }}>Campañas activas</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f5f5f7' }}>
              <th style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.4px', color: '#6e6e73', padding: '10px 12px', textAlign: 'left', borderBottom: '1.5px solid #e5e5ea' }}>Campaña</th>
              <th style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.4px', color: '#6e6e73', padding: '10px 12px', textAlign: 'left', borderBottom: '1.5px solid #e5e5ea' }}>Presupuesto</th>
              <th style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.4px', color: '#6e6e73', padding: '10px 12px', textAlign: 'left', borderBottom: '1.5px solid #e5e5ea' }}>ACOS</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.data?.results?.length ? (
              campaigns.data.results.slice(0, 3).map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #e5e5ea' }}>
                  <td style={{ padding: '11px 12px', fontWeight: '600' }}>{c.name}</td>
                  <td style={{ padding: '11px 12px' }}>${c.budget}</td>
                  <td style={{ padding: '11px 12px', color: '#d97706', fontWeight: '700' }}>N/A</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="3" style={{ padding: '40px 12px', textAlign: 'center', color: '#6e6e73' }}>Sin campañas</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
