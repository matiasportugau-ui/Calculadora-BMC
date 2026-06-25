// ═══════════════════════════════════════════════════════════════════════════
// src/components/activity/ActivityTracker.jsx
// ───────────────────────────────────────────────────────────────────────────
// Renders nothing; mounted once inside BmcAuthProvider in App.jsx. Emits:
//   - nav.route.change      every time the route changes (debounced 1s so
//                           rapid back/forward doesn't spam)
//   - auth.session.end      on `beforeunload` via navigator.sendBeacon so
//                           tab-close gets a graceful session boundary
//
// Only fires for authenticated users. Failures are silent — the helper is
// best-effort telemetry, never blocks UX.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useBmcAuth } from "../../hooks/useBmcAuth.js";

const NAV_DEBOUNCE_MS = 1000;
const ApiBase = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/+$/, "");
  }
  return "";
})();

export default function ActivityTracker() {
  const auth = useBmcAuth();
  const { pathname } = useLocation();
  const lastNavRef = useRef(null);
  const sessionStartRef = useRef(null);
  const navCountRef = useRef(0);
  const modulesTouchedRef = useRef(new Set());
  const debounceRef = useRef(null);

  useEffect(() => {
    if (sessionStartRef.current === null) sessionStartRef.current = Date.now();
  }, []);

  // 1. nav.route.change emitter (debounced)
  useEffect(() => {
    if (!auth?.isAuthenticated || !auth.accessToken) return undefined;
    if (lastNavRef.current === pathname) return undefined;
    lastNavRef.current = pathname;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navCountRef.current += 1;
      const mod = pathnameToModule(pathname);
      if (mod) modulesTouchedRef.current.add(mod);
      fetch(`${ApiBase}/api/me/activity`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({
          action: "nav.route.change",
          module: mod,
          resource_id: pathname,
        }),
      }).catch(() => { /* best-effort */ });
    }, NAV_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [pathname, auth?.isAuthenticated, auth?.accessToken]);

  // 2. auth.session.end on pagehide / beforeunload via fetch(keepalive:true).
  // keepalive is supported by all modern browsers and survives unload while
  // letting us send Authorization: Bearer (sendBeacon cannot). The endpoint
  // is the standard /api/me/activity (CLIENT_EMITTABLE includes
  // 'auth.session.end').
  useEffect(() => {
    if (!auth?.isAuthenticated || !auth.accessToken) return undefined;
    function flushSessionEnd() {
      try {
        fetch(`${ApiBase}/api/me/activity`, {
          method: "POST",
          credentials: "include",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.accessToken}`,
          },
          body: JSON.stringify({
            action: "auth.session.end",
            duration_ms: Date.now() - sessionStartRef.current,
            payload: {
              nav_count: navCountRef.current,
              modules_touched: [...modulesTouchedRef.current],
              source: "beforeunload",
            },
          }),
        }).catch(() => { /* best-effort */ });
      } catch { /* ignore */ }
    }
    // pagehide is more reliable than beforeunload on iOS Safari + bfcache;
    // both are wired and idempotent on the server (latest wins; the orphan
    // TTL job dedupes if both fire).
    window.addEventListener("pagehide", flushSessionEnd);
    window.addEventListener("beforeunload", flushSessionEnd);
    return () => {
      window.removeEventListener("pagehide", flushSessionEnd);
      window.removeEventListener("beforeunload", flushSessionEnd);
    };
  }, [auth?.isAuthenticated, auth?.accessToken]);

  return null;
}

// Map a frontend pathname to its module identifier (matches the names in
// identity.modules + ACTION_TAXONOMY's MODULE_PREFIX_MAP).
function pathnameToModule(pathname) {
  if (pathname === "/" || pathname === "/calculadora") return "calc";
  if (pathname.startsWith("/hub/wa")) return "wa";
  if (pathname.startsWith("/hub/ml")) return "ml";
  if (pathname.startsWith("/hub/canales")) return "canales";
  if (pathname.startsWith("/hub/admin")) return "admin";
  if (pathname.startsWith("/hub/planos")) return "plan-import";
  if (pathname.startsWith("/hub/plan-import")) return "plan-import";
  if (pathname.startsWith("/hub/crear-plano")) return "plan-import";
  if (pathname.startsWith("/hub/agent-admin")) return "agent-admin";
  if (pathname.startsWith("/hub/traktime")) return "traktime";
  if (pathname.startsWith("/hub/tareas")) return "tareas";
  if (pathname.startsWith("/hub/marketing")) return "marketing";
  if (pathname.startsWith("/mi-espacio")) return "me";
  if (pathname.startsWith("/hub")) return "hub";
  return "nav";
}
