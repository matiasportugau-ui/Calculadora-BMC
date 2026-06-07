// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15

import React from 'react';

export default function SummaryCards({ summary }) {
  const { alert_counts, last_etl_run } = summary;

  const cards = [
    { label: 'Info',      value: alert_counts.info,     bg: '#e6f4ff', border: '#91caff', text: '#0958d9' },
    { label: 'Warning',   value: alert_counts.warning,  bg: '#fffbe6', border: '#ffe58f', text: '#d46b08' },
    { label: 'Críticas',  value: alert_counts.critical, bg: alert_counts.critical > 0 ? '#fff1f0' : '#fff1f0', border: alert_counts.critical > 0 ? '#ff7875' : '#ffccc7', text: '#cf1322' },
    {
      label: 'Competidores OK',
      value: last_etl_run ? `${last_etl_run.competitors_succeeded}/${last_etl_run.competitors_attempted}` : '—',
      bg: '#f6ffed', border: '#b7eb8f', text: '#389e0d',
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {cards.map(c => (
        <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '16px 18px' }}>
          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', margin: 0 }}>{c.label}</p>
          <p style={{ fontSize: 30, fontWeight: 700, color: c.text, margin: '4px 0 0' }}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
