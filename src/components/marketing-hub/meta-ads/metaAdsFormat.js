/** Format helpers for Meta Ads Live Report UI — null → em dash, never invent. */

export function money(n, currency = 'USD') {
  if (n == null || Number.isNaN(Number(n))) return '—';
  try {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Number(n));
  } catch {
    return `$${Number(n).toLocaleString('es-UY')}`;
  }
}

export function moneyPrecise(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `$${Number(n).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function num(n, digits = 0) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('es-UY', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function pct(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${Number(n).toLocaleString('es-UY', { maximumFractionDigits: 2 })}%`;
}

export function deltaLabel(pctVal) {
  if (pctVal == null || Number.isNaN(Number(pctVal))) return null;
  const v = Number(pctVal);
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
}

export function freshnessLabel(f) {
  const map = {
    live: 'LIVE',
    demo: 'Demo',
    snapshot: 'Snapshot',
    stale: 'Stale',
    error: 'Error',
  };
  return map[f] || f || '—';
}

export function freshnessColor(f) {
  if (f === 'live') return 'var(--ac-success)';
  if (f === 'demo') return 'var(--ac-accent)';
  if (f === 'snapshot') return 'var(--ac-warn)';
  if (f === 'stale' || f === 'error') return 'var(--ac-error)';
  return 'var(--ac-text-3)';
}

/** Campaign/line KPI badge — traffic muted (not failed lead-gen). */
export function kpiBadgeStyle(kpi) {
  const base = {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 7px',
    borderRadius: 999,
    border: '1px solid var(--ac-border)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  };
  if (kpi === 'traffic') {
    return {
      ...base,
      background: 'var(--ac-surface-2)',
      color: 'var(--ac-text-3)',
      borderColor: 'var(--ac-border-2)',
    };
  }
  if (kpi === 'lead') {
    return {
      ...base,
      background: 'color-mix(in srgb, var(--ac-success) 14%, transparent)',
      color: 'var(--ac-success)',
    };
  }
  return {
    ...base,
    background: 'var(--ac-surface-2)',
    color: 'var(--ac-text-2)',
  };
}

/** CPL cell for campaign rows: traffic → n/a */
export function campaignCplDisplay(c) {
  if (c?.kpi === 'traffic') return 'n/a';
  return moneyPrecise(c?.cpl);
}
