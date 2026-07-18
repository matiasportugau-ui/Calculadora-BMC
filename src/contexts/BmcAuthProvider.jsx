// ═══════════════════════════════════════════════════════════════════════════
// BmcAuthProvider — global Comprador identity context.
// ───────────────────────────────────────────────────────────────────────────
// On mount: GET /api/auth/me with credentials:'include'. On 401, attempt one
// silent POST /api/auth/refresh; if that 401s too, status='anonymous'.
//
// login() drives the existing GIS flow in src/utils/googleDrive.js (signIn)
// and POSTs the resulting access token to /api/auth/google to mint a session
// (the server upserts identity.users + sets the bmc_sess httpOnly cookie).
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { signIn as gisSignIn, signOut as gisSignOut } from "../utils/googleDrive.js";
import { getPendingClientQuoteIds, clearPending } from "../utils/clientQuoteId.js";
// Top-30 run 2026-05-12 (#A13): context + hook extraídos a bmcAuthContext.js para que Fast Refresh trate este archivo como components-only.
import { BmcAuthContext } from "./bmcAuthContext.js";
import { setOperatorJwtGetter, setOperatorJwtRefresh } from "../utils/operatorApiClient.js";
import { devBrowserLogin, isLocalDevApp } from "../utils/localDevAuth.js";

const ApiBase = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/+$/, "");
  }
  return ""; // same-origin (Vercel rewrites /api → Cloud Run)
})();

export function BmcAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [planTier, setPlanTier] = useState(null);
  const [modules, setModules] = useState({});
  const [accessToken, setAccessToken] = useState(null);
  const [status, setStatus] = useState("loading"); // 'loading'|'anonymous'|'authenticated'

  const applyAuth = useCallback((data) => {
    if (!data?.user) {
      setUser(null);
      setRole(null);
      setPlanTier(null);
      setModules({});
      setAccessToken(null);
      setStatus("anonymous");
      return;
    }
    setUser(data.user);
    setRole(data.role || data.user.role || null);
    setPlanTier(data.plan_tier || data.user.plan_tier || "base");
    setModules(data.modules || {});
    if (data.accessToken) setAccessToken(data.accessToken);
    setStatus("authenticated");
  }, []);

  const refreshAccess = useCallback(async () => {
    try {
      const res = await fetch(`${ApiBase}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return false;
      const data = await res.json();
      applyAuth(data);
      return true;
    } catch {
      return false;
    }
  }, [applyAuth]);

  const fetchMeAndGrants = useCallback(
    async (token) => {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const meRes = await fetch(`${ApiBase}/api/auth/me`, {
        credentials: "include",
        headers,
      });
      if (!meRes.ok) return null;
      const me = await meRes.json();
      const gRes = await fetch(`${ApiBase}/api/auth/me/grants`, {
        credentials: "include",
        headers,
      });
      const g = gRes.ok ? await gRes.json() : { role: null, plan_tier: "base", modules: {} };
      return {
        user: me.user,
        role: g.role,
        plan_tier: g.plan_tier,
        modules: g.modules,
      };
    },
    [],
  );

  useEffect(() => {
    setOperatorJwtGetter(() => accessToken || "");
  }, [accessToken]);

  useEffect(() => {
    setOperatorJwtRefresh(refreshAccess);
  }, [refreshAccess]);

  // Bootstrap: try /me with current accessToken; if missing or 401, try refresh.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchMeAndGrants(accessToken);
        if (cancelled) return;
        if (me) {
          if (!accessToken) {
            // Cookie session without JWT in memory — refresh before ML/API bearer routes run.
            const refreshed = await refreshAccess();
            if (cancelled) return;
            if (refreshed) return;
            setStatus("anonymous");
            return;
          }
          applyAuth({ ...me, accessToken });
          return;
        }
        const refreshed = await refreshAccess();
        if (cancelled) return;
        if (refreshed) return;
        if (isLocalDevApp()) {
          const devData = await devBrowserLogin(ApiBase);
          if (cancelled) return;
          if (devData) {
            applyAuth(devData);
            return;
          }
        }
        setStatus("anonymous");
      } catch {
        if (!cancelled) setStatus("anonymous");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async () => {
    if (isLocalDevApp()) {
      const devData = await devBrowserLogin(ApiBase);
      if (!devData) throw new Error("dev_browser_login_failed");
      applyAuth(devData);
      return devData;
    }
    const gis = await gisSignIn();
    if (!gis?.accessToken) throw new Error("google_signin_failed");
    const res = await fetch(`${ApiBase}/api/auth/google`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: gis.accessToken }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`auth_google_${res.status}: ${body.slice(0, 120)}`);
    }
    const data = await res.json();
    applyAuth(data);

    // Anonymous→user merge (master plan §Phase F): claim any quotes the
    // browser created before this login. Best-effort — failure must NOT
    // break the login UX.
    try {
      const ids = getPendingClientQuoteIds();
      if (ids.length) {
        const claimRes = await fetch(`${ApiBase}/api/me/quotes/claim`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(data.accessToken ? { Authorization: `Bearer ${data.accessToken}` } : {}),
          },
          body: JSON.stringify({ clientQuoteIds: ids }),
        });
        if (claimRes.ok) clearPending();
      }
    } catch {
      /* ignore — claim is best-effort */
    }

    return data;
  }, [applyAuth]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${ApiBase}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      /* ignore */
    }
    try {
      gisSignOut?.();
    } catch {
      /* ignore */
    }
    applyAuth(null);
  }, [applyAuth]);

  // accessToken is intentionally exposed via context so consumers (RequireGrant,
  // MySpacePage) can attach `Authorization: Bearer ${accessToken}` headers.
  // Standard SPA pattern. NEVER log this value, NEVER pass it to analytics or
  // third-party scripts, and NEVER set it as a non-httpOnly cookie. Any new
  // consumer of this context should be reviewed in light of cursor[bot] H-2.
  const value = useMemo(
    () => ({
      user,
      role,
      plan_tier: planTier,
      modules,
      accessToken,
      status,
      isAnonymous: status === "anonymous",
      isAuthenticated: status === "authenticated",
      login,
      logout,
      refreshAccess,
    }),
    [user, role, planTier, modules, accessToken, status, login, logout, refreshAccess],
  );

  return <BmcAuthContext.Provider value={value}>{children}</BmcAuthContext.Provider>;
}

// useBmcAuthContext movido a ./bmcAuthContext.js (top-30 run #A13)
