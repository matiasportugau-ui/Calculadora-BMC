/**
 * What the ML Manager overview should show when data did not load.
 * "session" = the operator JWT is missing (401).
 * "reauth" = the server-side Mercado Libre token needs /auth/ml/start.
 * null = render the dashboard.
 * @param {Array<{ status?: number } | null | undefined>} errors
 * @param {{ data?: { ok?: boolean } | null, error?: { status?: number } | null } | null} [connector]
 * @returns {"session" | "reauth" | null}
 */
export function mlOverviewFailure(errors, connector) {
  const list = (errors || []).filter(Boolean);
  const operatorSessionDown = list.some((err) => err.status === 401)
    || connector?.error?.status === 401;
  if (operatorSessionDown) return "session";
  const tokenDown = connector?.data?.ok === false;
  if (list.length > 0 || tokenDown) return "reauth";
  return null;
}
