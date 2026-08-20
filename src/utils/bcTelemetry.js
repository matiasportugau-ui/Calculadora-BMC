// Client telemetry for tenant BC only. No-ops without WHITELABEL=bc.
// Posts to /bc-telemetry (Vercel function, not Cloud Run) so BMC API stays untouched.

import { WHITELABEL } from "../config/whitelabel.js";

export const BC_TELEMETRY_PATH = "/bc-telemetry";

export const TENANT_HEARTBEAT_MS = 60_000;

export const TENANT_CLIENT_TRACK_ACTIONS = [
  "tenant.session.start",
  "tenant.session.end",
  "tenant.session.ping",
  "tenant.nav.route",
  "tenant.ui.click",
  "tenant.wizard.step",
  "tenant.quote.autosave",
  "tenant.quote.open",
  "tenant.quote.export.pdf",
  "tenant.quote.export.html",
];

const ALLOWED = new Set(TENANT_CLIENT_TRACK_ACTIONS);

export function shouldEmitTenantPing({
  lastAt = 0,
  now = Date.now(),
  hidden = false,
  intervalMs = TENANT_HEARTBEAT_MS,
} = {}) {
  if (hidden) return false;
  return now - lastAt >= intervalMs;
}

let lastKey = "";
let lastAt = 0;
const MIN_MS = 400;

export function trackBc(action, payload = {}) {
  if (!WHITELABEL) return;
  if (!ALLOWED.has(action)) return;
  const now = Date.now();
  const key = `${action}:${payload.label || payload.step_id || payload.path || ""}`;
  if (key === lastKey && now - lastAt < MIN_MS) return;
  lastKey = key;
  lastAt = now;
  const body = JSON.stringify({
    action,
    resource_type: payload.resource_type || undefined,
    resource_id: payload.resource_id || undefined,
    payload: { ...payload, tenant: WHITELABEL },
  });
  try {
    fetch(BC_TELEMETRY_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "omit",
    }).catch(() => {});
  } catch {
    /* never block the calc */
  }
}

export function clickLabel(el) {
  if (!el || typeof el.getAttribute !== "function") return "";
  const named = el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("data-bc-track");
  if (named) return String(named).trim().slice(0, 80);
  const text = String(el.textContent || "").replace(/\s+/g, " ").trim();
  return text.slice(0, 80);
}
