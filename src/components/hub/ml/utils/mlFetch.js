import { getCalcApiBase } from '../../../../utils/calcApiBase.js';
import { ensureIdentityJwt, refreshIdentityJwt } from '../../../../utils/operatorApiClient.js';

/** Prefer Vercel same-origin rewrites for /ml/* and /auth/ml/* (matches BmcAuthProvider). */
function getMlApiBase() {
  if (typeof window !== 'undefined' && /\.vercel\.app$/i.test(window.location.hostname)) {
    return '';
  }
  return getCalcApiBase();
}

/**
 * Fetch helper for the ML Manager module.
 *
 * The MercadoLibre routes (`/ml/*`, `/auth/ml/*`) live on the SAME backend as
 * the rest of the calculator API (`panelin-calc`), not on a separate connector.
 * So we resolve the base URL through `getCalcApiBase()` — the same helper the
 * calculator and ML Operativo modules use — and inherit its origin/proxy logic.
 *
 * Auth: `/ml/*` and `/api/ml/*` require a valid identity JWT (`Authorization: Bearer`).
 * Legacy cockpit tokens in localStorage are intentionally NOT sent here — they caused
 * misleading 401s while `/auth/ml/status` still showed "Cuenta conectada".
 * On 401, mlFetch retries once after silent `/api/auth/refresh` (BmcAuthProvider).
 */
export async function mlFetch(path, init = {}) {
  const base = getMlApiBase();
  const { body, _authRetried, ...rest } = init;

  async function doFetch(retryAuth) {
    const token = String((await ensureIdentityJwt()) || '').trim();
    return fetch(`${base}${path}`, {
      credentials: 'include',
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
      ...(body !== undefined
        ? { body: typeof body === 'string' ? body : JSON.stringify(body) }
        : {}),
    });
  }

  let res = await doFetch(false);

  if (res.status === 401 && !_authRetried) {
    const refreshed = await refreshIdentityJwt();
    if (refreshed) {
      res = await doFetch(true);
    }
  }

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
