import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useBmcAuth } from "../../../hooks/useBmcAuth.js";
import { isLocalDevApp } from "../../../utils/localDevAuth.js";

const FinanzasUnlockContext = createContext(null);

/** Call when a banco API returns 403 finanzas_locked (session expired). */
export function useFinanzasUnlock() {
  return useContext(FinanzasUnlockContext);
}

const ApiBase = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/+$/, "");
  }
  return "";
})();

export default function FinanzasUnlockGate({ children }) {
  const auth = useBmcAuth();
  const localDev = isLocalDevApp();
  const [status, setStatus] = useState(localDev ? "unlocked" : "loading");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const lockSession = useCallback(() => {
    if (!localDev) setStatus("locked");
  }, [localDev]);

  const ctx = useMemo(() => ({ lockSession }), [lockSession]);

  const apiFetch = useCallback(
    async (path, opts = {}) => {
      const r = await fetch(`${ApiBase}${path}`, {
        ...opts,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
          ...(opts.headers || {}),
        },
      });
      const body = await r.json().catch(() => null);
      return { ok: r.ok, status: r.status, body };
    },
    [auth.accessToken],
  );

  const refreshStatus = useCallback(async () => {
    if (localDev) {
      setStatus("unlocked");
      return;
    }
    setError(null);
    try {
      const { ok, body } = await apiFetch("/api/banco/unlock-status");
      if (!ok) throw new Error(body?.error || "unlock_status_failed");
      setStatus(body?.unlocked ? "unlocked" : "locked");
    } catch (e) {
      setError(e.message);
      setStatus("locked");
    }
  }, [apiFetch, localDev]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const submitPassword = useCallback(
    async (ev) => {
      ev.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        const { ok, body } = await apiFetch("/api/banco/unlock", {
          method: "POST",
          body: JSON.stringify({ password }),
        });
        if (!ok) {
          if (body?.error === "invalid_password") {
            setError("Contraseña incorrecta.");
          } else {
            setError("No se pudo desbloquear Finanzas.");
          }
          return;
        }
        setPassword("");
        setStatus("unlocked");
      } catch {
        setError("No se pudo desbloquear Finanzas.");
      } finally {
        setSubmitting(false);
      }
    },
    [apiFetch, password],
  );

  if (status === "loading") {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>
        Verificando acceso a Finanzas…
      </div>
    );
  }

  if (status === "unlocked") {
    return (
      <FinanzasUnlockContext.Provider value={ctx}>
        {children}
      </FinanzasUnlockContext.Provider>
    );
  }

  return (
    <div style={{ minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h2 style={{ margin: "0 0 6px", fontSize: 18, color: "#0f172a" }}>Finanzas protegido</h2>
        <p style={{ margin: "0 0 16px", color: "#475569", fontSize: 14 }}>
          Ingresá la contraseña del módulo para ver movimientos bancarios y cash flow.
        </p>
        <form onSubmit={submitPassword}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Contraseña"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: 14,
              marginBottom: 12,
            }}
          />
          <button
            type="submit"
            disabled={submitting || !password.trim()}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #0f172a",
              background: submitting ? "#64748b" : "#0f172a",
              color: "#fff",
              cursor: submitting ? "default" : "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {submitting ? "Verificando…" : "Entrar a Finanzas"}
          </button>
        </form>
        {error ? <div style={{ marginTop: 12, color: "#b91c1c", fontSize: 12 }}>{error}</div> : null}
      </div>
    </div>
  );
}
