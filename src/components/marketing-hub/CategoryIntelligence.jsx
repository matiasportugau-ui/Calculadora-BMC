import React from 'react';

function SummaryCard({ label, value, color }) {
  return (
    <div style={{ background: '#fafafa', border: '1px solid #e5e5ea', borderRadius: 10, padding: 14, textAlign: 'center', flex: '1 1 140px' }}>
      <p style={{ fontSize: 22, fontWeight: 700, color: color || '#1a3a5c', margin: 0 }}>{value}</p>
      <p style={{ fontSize: 11, color: '#888', margin: '4px 0 0' }}>{label}</p>
    </div>
  );
}

const iconMap = {
  'techos_isodec_eps': 'TE',
  'techos_isodec_pir': 'TP',
  'techos_isoroof_3g': 'TR',
  'paredes_isopanel_eps': 'PE',
  'paredes_isowall_pir': 'PW',
  'paredes_iso frig_pir': 'PF',
  'perfiles_techo': 'PT',
  'perfiles_pared': 'PP',
  'fijaciones': 'FJ',
  'selladores': 'SL',
};

export default function CategoryIntelligence({ categories, summary }) {
  if (!categories) return null;

  const competitorCount = summary?.competitors?.length ?? 0;

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <SummaryCard label="Competidores activos" value={String(competitorCount)} color="#cf1322" />
        <SummaryCard label="Categorías" value={String(categories.length)} color="#1a3a5c" />
        <SummaryCard label="Alertas críticas" value={String(summary?.alert_counts?.critical ?? 0)} color={summary?.alert_counts?.critical > 0 ? '#cf1322' : '#389e0d'} />
        <SummaryCard label="Alertas totales" value={String((summary?.alert_counts?.critical ?? 0) + (summary?.alert_counts?.warning ?? 0) + (summary?.alert_counts?.info ?? 0))} color="#888" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {categories.map(cat => (
          <div key={cat.id} style={{ background: '#fff', border: '1px solid #e5e5ea', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a3a5c', background: '#e6f0fa', borderRadius: 6, padding: '2px 6px' }}>{iconMap[cat.id] || 'XX'}</span>
              <div>
                <p style={{ fontWeight: 600, fontSize: 13, color: '#1a3a5c', margin: 0 }}>{cat.label}</p>
                <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>{cat.id}</p>
              </div>
            </div>
            <p style={{ fontSize: 11, color: '#888', margin: 0 }}>
              Familias: {cat.families?.length ?? 0}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
