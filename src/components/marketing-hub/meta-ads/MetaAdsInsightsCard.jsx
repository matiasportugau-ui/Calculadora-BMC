import React from 'react';

const card = {
  background: 'var(--ac-surface)',
  border: '1px solid var(--ac-border)',
  borderRadius: 'var(--ac-radius)',
  padding: 16,
  boxShadow: 'var(--ac-shadow-1)',
};

export default function MetaAdsInsightsCard({ insights, loading, error, onRegenerate }) {
  return (
    <section style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ac-text)', fontFamily: 'var(--ac-font-display)' }}>
          Lectura del analista
        </h3>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={loading}
          style={{
            fontSize: 12,
            padding: '6px 12px',
            borderRadius: 'var(--ac-radius-sm)',
            border: '1px solid var(--ac-border)',
            background: 'var(--ac-surface)',
            color: 'var(--ac-text)',
            cursor: loading ? 'wait' : 'pointer',
            fontWeight: 600,
          }}
        >
          {loading ? 'Generando…' : 'Regenerar'}
        </button>
      </div>
      {error && (
        <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--ac-error)' }}>{error}</p>
      )}
      {!insights && !loading && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ac-text-3)' }}>Sin insights aún. Pulsá Regenerar o esperá la carga automática.</p>
      )}
      {insights && (
        <>
          {insights.data_mode_note && (
            <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--ac-text-3)' }}>{insights.data_mode_note}</p>
          )}
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ac-text)', lineHeight: 1.55 }}>
            {insights.executive_summary}
          </p>
          {Array.isArray(insights.insights) && insights.insights.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {insights.insights.map((i, idx) => (
                <span
                  key={`${i.title}-${idx}`}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 999,
                    border: '1px solid var(--ac-border)',
                    background: 'var(--ac-surface-2)',
                    color: i.type === 'risk' ? 'var(--ac-error)' : i.type === 'win' ? 'var(--ac-success)' : 'var(--ac-text-2)',
                  }}
                  title={i.detail}
                >
                  {i.type}: {i.title}
                </span>
              ))}
            </div>
          )}
          {Array.isArray(insights.client_bullets) && insights.client_bullets.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--ac-text-2)', lineHeight: 1.5 }}>
              {insights.client_bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
          <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--ac-text-3)' }}>
            confidence={insights.confidence || '—'}
            {insights.parse_failed ? ' · parse_failed (reglas retenidas)' : ''}
            {insights.rules_retained ? ' · rules_ok' : ''}
          </p>
        </>
      )}
    </section>
  );
}
