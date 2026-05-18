// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15

import React from 'react';
import Pagination from './Pagination.jsx';

const levelCfg = {
  info:     { borderLeft: '4px solid #91caff', bg: '#e6f4ff', label: 'INFO',  text: '#0958d9' },
  warning:  { borderLeft: '4px solid #ffd591', bg: '#fffbe6', label: 'WARN',  text: '#d46b08' },
  critical: { borderLeft: '4px solid #ff7875', bg: '#fff1f0', label: 'CRIT',  text: '#cf1322' },
};

function AlertRow({ alert }) {
  const s = levelCfg[alert.level] ?? levelCfg.info;
  return (
    <div style={{ ...s, borderLeft: s.borderLeft, background: s.bg, borderRadius: '0 8px 8px 0', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: s.text }}>{s.label}</span>
        <p style={{ fontSize: 13, color: '#262626', margin: '2px 0 0' }}>{alert.message}</p>
        {alert.competitor_name && <p style={{ fontSize: 11, color: '#aaa', margin: '2px 0 0' }}>{alert.competitor_name} · {alert.domain}</p>}
      </div>
      <div style={{ textAlign: 'right', fontSize: 11, color: '#aaa', flexShrink: 0 }}>
        <p style={{ margin: 0 }}>{new Date(alert.created_at).toLocaleString('es-UY')}</p>
        <div style={{ marginTop: 4, display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          {alert.notified_inapp && <span style={{ padding: '1px 6px', background: '#f5f5f5', borderRadius: 4, fontSize: 10 }}>in-app</span>}
          {alert.notified_email && <span style={{ padding: '1px 6px', background: '#f5f5f5', borderRadius: 4, fontSize: 10 }}>email</span>}
        </div>
      </div>
    </div>
  );
}

export default function AlertsFeed({ data, currentPage, onPageChange }) {
  if (!data.total) {
    return <div style={{ background: '#fafafa', border: '1px solid #e5e5ea', borderRadius: 10, padding: 24, textAlign: 'center', fontSize: 13, color: '#888' }}>No hay alertas registradas.</div>;
  }
  return (
    <div>
      {data.data.map(a => <AlertRow key={a.id} alert={a} />)}
      <Pagination currentPage={currentPage} totalPages={data.total_pages} onPageChange={onPageChange} />
    </div>
  );
}
