// S5 Phase B PR2 — hub cockpit auth via BmcAuth JWT (fallback: env / dev override).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBmcAuth, useModuleGrants } from "./useBmcAuth.js";
import {
  COCKPIT_TOKEN_KEY,
  resolveApiKeyFromEnv,
} from "../utils/operatorApiClient.js";

function readOverride() {
  try {
    return String(localStorage.getItem(COCKPIT_TOKEN_KEY) || "").trim();
  } catch {
    return "";
  }
}

function writeOverride(t) {
  try {
    if (t) localStorage.setItem(COCKPIT_TOKEN_KEY, t);
    else localStorage.removeItem(COCKPIT_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

const ROLE_RANK = { superadmin: 4, admin: 3, operator: 2, comprador: 1 };

/**
 * @param {{ module?: string, minLevel?: 'read'|'write'|'admin', role?: string }} [opts]
 */
export function useCockpitOperatorAuth(opts = {}) {
  const moduleKey = opts.module || "canales";
  const minLevel = opts.minLevel || "read";
  const requiredRole = opts.role || "";

  const auth = useBmcAuth();
  const grants = useModuleGrants();
  const [overrideToken, setOverrideToken] = useState(() => readOverride());
  const [overrideInput, setOverrideInput] = useState("");

  const hasGrant = useMemo(() => {
    if (grants.role === "superadmin") return true;
    if (requiredRole) {
      return (ROLE_RANK[grants.role] || 0) >= (ROLE_RANK[requiredRole] || 0);
    }
    return grants.has(moduleKey, minLevel);
  }, [grants, moduleKey, minLevel, requiredRole]);

  const envToken =
    typeof import.meta !== "undefined"
      ? resolveApiKeyFromEnv(import.meta.env || {})
      : "";

  const jwtToken = auth.accessToken || "";

  const token = useMemo(() => {
    if (jwtToken && hasGrant) return jwtToken;
    if (envToken) return envToken;
    if (overrideToken) return overrideToken;
    return "";
  }, [jwtToken, hasGrant, envToken, overrideToken]);

  const isJwt = !!token && token === jwtToken;

  useEffect(() => {
    if (auth.status === "authenticated" && !auth.accessToken) {
      auth.refreshAccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depend on specific auth fields, not the whole auth object, to avoid re-running on every auth mutation
  }, [auth.status, auth.accessToken, auth.refreshAccess]);

  const authError = useMemo(() => {
    if (auth.status === "loading") return "";
    if (auth.isAuthenticated && !hasGrant) {
      if (requiredRole) {
        return `Necesitás rol ${requiredRole} o superior. Pedilo en Admin → Usuarios.`;
      }
      return `Necesitás permiso ${minLevel} en ${moduleKey}. Pedilo en Admin → Usuarios.`;
    }
    if (!auth.isAuthenticated && !envToken && !overrideToken) {
      return "Iniciá sesión con Google para operar este módulo.";
    }
    if (auth.isAuthenticated && hasGrant && !jwtToken) {
      return "Renovando sesión…";
    }
    return "";
  }, [
    auth.status,
    auth.isAuthenticated,
    hasGrant,
    jwtToken,
    envToken,
    overrideToken,
    moduleKey,
    minLevel,
    requiredRole,
  ]);

  const saveToken = useCallback(() => {
    const v = String(overrideInput || "").trim();
    writeOverride(v);
    setOverrideToken(v);
  }, [overrideInput]);

  const clearToken = useCallback(() => {
    writeOverride("");
    setOverrideToken("");
    setOverrideInput("");
  }, []);

  return {
    token,
    isJwt,
    authReady: auth.status !== "loading",
    authError,
    tokenAutoLoaded: isJwt || !!token,
    tokenLoadError: authError,
    tokenInput: overrideInput,
    setTokenInput: setOverrideInput,
    saveToken,
    clearToken,
    login: auth.login,
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
    hasGrant,
    moduleKey,
    minLevel,
  };
}

export default useCockpitOperatorAuth;