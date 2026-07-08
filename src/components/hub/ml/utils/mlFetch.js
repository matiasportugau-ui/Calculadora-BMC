import { getCalcApiBase } from '../../../../utils/calcApiBase.js';
import { ensureOperatorToken } from '../../../../utils/operatorApiClient.js';

/**
 * Fetch helper for the ML Manager module.
 *
 * The MercadoLibre routes (`/ml/*`, `/auth/ml/*`) live on the SAME backend as
 * the rest of the calculator API (`panelin-calc`), not on a separate connector.
 * So we resolve the base URL through `getCalcApiBase()` — the same helper the
 * calculator and ML Operativo modules use — and inherit its origin/proxy logic.
 *
 * Auth: the read-only `/ml/*` routes hold the seller's OAuth token server-side
 * and need no client credentials. BUT the AI-draft route this module also calls
 * — `POST /api/crm/suggest-response` — was hardened to require an identity JWT
 * (or the static service token); a cookie is NOT accepted as an access token
 * (`requireUser` reads `Authorization: Bearer` only). So we attach the operator
 * token via `ensureOperatorToken()` (the identity JWT registered by
 * BmcAuthProvider, with env/localStorage fallbacks) as `Authorization: Bearer`.
 * Without it, "Generar con IA" 401s → "IA no disponible." The open `/ml/*`
 * routes simply ignore the extra header. `credentials: 'include'` is kept for
 * hosts that share the session cookie.
 */
export async function mlFetch(path, init = {}) {
  const base = getCalcApiBase();
  const { body, ...rest } = init;

  const token = String((await ensureOperatorToken()) || '').trim();

  const res = await fetch(`${base}${path}`, {
    credentials: 'include',
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
