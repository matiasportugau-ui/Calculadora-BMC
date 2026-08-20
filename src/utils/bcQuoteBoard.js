// Client helper: persist BC drafts when the quote reaches Estructura, then reopen from the board.
// Gate is the step *id* (not a 1-based index) so reordering Datos del proyecto first
// does not fire a number on Pendiente.
const CLIENT_KEY = "bc-quote-client-id";
const CLAIM_KEY = "bc-quote-claim-ids";
export const BC_AUTOSAVE_STEP_ID = "estructura";

export function getOrCreateBcClientQuoteId() {
  if (typeof localStorage === "undefined") return `bc_${Date.now()}`;
  let id = localStorage.getItem(CLIENT_KEY);
  if (!id) {
    id = `cq_bc_${(globalThis.crypto && crypto.randomUUID && crypto.randomUUID()) || String(Date.now())}`;
    localStorage.setItem(CLIENT_KEY, id);
  }
  return id;
}

export function rotateBcClientQuoteId() {
  if (typeof localStorage === "undefined") return getOrCreateBcClientQuoteId();
  localStorage.removeItem(CLIENT_KEY);
  return getOrCreateBcClientQuoteId();
}

export function rememberBcClaimId(id) {
  if (!id || typeof localStorage === "undefined") return;
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem(CLAIM_KEY) || "[]"); } catch { arr = []; }
  if (!arr.includes(id)) arr.push(id);
  localStorage.setItem(CLAIM_KEY, JSON.stringify(arr.slice(-80)));
}

export function takeBcClaimIds() {
  if (typeof localStorage === "undefined") return [];
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem(CLAIM_KEY) || "[]"); } catch { arr = []; }
  localStorage.removeItem(CLAIM_KEY);
  return arr;
}

export async function persistBcDraft({ payload, wizardStep, token }) {
  const clientQuoteId = getOrCreateBcClientQuoteId();
  rememberBcClaimId(clientQuoteId);
  try {
    const { trackBc } = await import("./bcTelemetry.js");
    trackBc("tenant.quote.autosave", {
      resource_type: "quote",
      resource_id: clientQuoteId,
      wizard_step: wizardStep,
    });
  } catch { /* telemetry */ }
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const path = token ? "/api/me/quotes" : "/api/public/bc-quotes";
  const body = token
    ? { clientQuoteId, payload, wizardStep, status: "draft" }
    : { clientQuoteId, payload, wizardStep };
  const r = await fetch(path, { method: "POST", credentials: "include", headers, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || `http_${r.status}`);
  return j.quote || j;
}

export async function fetchBcQuote(quoteId, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let r = await fetch(`/api/me/tenant/quotes/${quoteId}`, { credentials: "include", headers });
  if (r.status === 404) {
    r = await fetch(`/api/me/quotes/${quoteId}`, { credentials: "include", headers });
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || `http_${r.status}`);
  return j.quote;
}

export async function claimBcQuotes(token) {
  const ids = takeBcClaimIds();
  if (!ids.length || !token) return { claimed: 0 };
  const r = await fetch("/api/me/quotes/claim", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ clientQuoteIds: ids }),
  });
  return r.json().catch(() => ({ claimed: 0 }));
}
