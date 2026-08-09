// src/utils/leadTracking.js — conversion signal for the "solicitud de
// presupuesto" actions on the PUBLIC calculator (WhatsApp send, quote
// confirm). Fire-and-forget: never blocks or throws, telemetry only.
//
// Two things fire together at the same two call sites:
//   1. Server beacon → POST /api/public/lead-event (identity.user_activity_log,
//      actor_user_id=null) — the count BMC itself was missing.
//   2. Meta Pixel `Lead` event, if the base snippet loaded — the signal Meta
//      Ads needs to stop reporting 0 conversions on healthy-traffic campaigns.

const UTM_KEYS = ["utm_source", "utm_campaign", "utm_medium", "utm_content", "utm_term"];
const UTM_STORAGE_KEY = "bmc.utm";

export function captureUtmFromLocation() {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = {};
    let found = false;
    for (const key of UTM_KEYS) {
      const val = params.get(key);
      if (val) {
        utm[key] = val;
        found = true;
      }
    }
    if (found) sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
  } catch {
    // sessionStorage can throw under private-browsing/locked-down contexts.
  }
}

function getStoredUtm() {
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function trackLeadEvent(action) {
  const utm = getStoredUtm();
  try {
    fetch("/api/public/lead-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload: { utm } }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // never let telemetry break the user's actual action
  }
  try {
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", "Lead", { utm });
    }
  } catch {
    // ignore
  }
}
