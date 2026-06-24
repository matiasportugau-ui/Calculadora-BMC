import { getCalcApiBase } from '../../../../utils/calcApiBase.js';

/**
 * Fetch helper for the ML Manager module.
 *
 * The MercadoLibre routes (`/ml/*`, `/auth/ml/*`) live on the SAME backend as
 * the rest of the calculator API (`panelin-calc`), not on a separate connector.
 * So we resolve the base URL through `getCalcApiBase()` — the same helper the
 * calculator and ML Operativo modules use — and inherit its origin/proxy logic.
 *
 * Auth: the backend holds the seller's OAuth token server-side, so these routes
 * need no client-side API key. We send credentials in case the API host shares
 * the session cookie.
 */
export async function mlFetch(path, init = {}) {
  const base = getCalcApiBase();
  const { body, ...rest } = init;

  const res = await fetch(`${base}${path}`, {
    credentials: 'include',
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
    // Auto-stringify object bodies so callers can pass plain objects.
    ...(body !== undefined
      ? { body: typeof body === 'string' ? body : JSON.stringify(body) }
      : {}),
  });

  if (!res.ok) {
    const err = new Error(`ML API ${res.status}`);
    err.status = res.status;
    try {
      err.payload = await res.json();
    } catch {
      /* ignore non-JSON error body */
    }
    throw err;
  }

  // 204 / empty body → null
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
