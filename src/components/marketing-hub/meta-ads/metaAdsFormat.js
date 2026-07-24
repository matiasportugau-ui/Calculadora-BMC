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
