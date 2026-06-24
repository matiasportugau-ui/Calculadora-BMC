import { getCalcApiBase } from "./calcApiBase.js";

/**
 * Authenticated fetch for hub cockpit / wolfboard routes.
 * @param {string} token Bearer token (identity JWT or service override)
 * @param {string} path Path starting with /api/…
 */
export async function cockpitOperatorFetch(token, path, options = {}) {
  const base = getCalcApiBase().replace(/\/+$/, "");
  const headers = {
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${base}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export default cockpitOperatorFetch;