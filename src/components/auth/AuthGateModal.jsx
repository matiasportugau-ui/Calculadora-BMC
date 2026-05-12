// ═══════════════════════════════════════════════════════════════════════════
// AuthGateModal — listens to the global window event "bmc-auth-gate-required"
// and displays a blocking dialog with a "Continuar con Google" CTA. After a
// successful login the modal closes and re-emits "bmc-wizard-next" so the
// caller (e.g. PanelinCalculadoraV3 wizard) can resume the action that was
// originally blocked.
//
// Mounted once at the root of <App/> so it has a stable position regardless
// of route or wizard state.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import { useBmcAuth } from "../../hooks/useBmcAuth.js";

export default function AuthGateModal() {
  const { user, login, isAuthenticated } = useBmcAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    function onGate(_e) {
      // Auth gate disabled app-wide — never block. Immediately resume any
      // wizard flow that was awaiting the gate to close.
      setOpen(false);
      window.dispatchEvent(new CustomEvent("bmc-wizard-next", { detail: { source: "auth-gate-disabled" } }));
    }
    window.addEventListener("bmc-auth-gate-required", onGate);
    return () => window.removeEventListener("bmc-auth-gate-required", onGate);
  }, [isAuthenticated]);

  const handleLogin = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await login();
      setOpen(false);
      // Re-emit the wizard advance event so the caller resumes.
      window.dispatchEvent(new CustomEvent("bmc-wizard-next", { detail: { source: "auth-gate" } }));
    } catch (e) {
      setError(e?.message || "auth_failed");
    } finally {
      setLoading(false);
    }
  }, [login]);

  if (!open || isAuthenticated) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#fff",
          maxWidth: 440,
          width: "100%",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 20px 50px rgba(0,0,0,.25)",
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600, color: "#0f172a" }}>
          Iniciá sesión para continuar
        </h2>
        <p style={{ margin: "0 0 16px", color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
          A partir de este paso necesitamos identificarte para guardar tu cotización en
          tu cuenta y poder retomarla luego.
        </p>
        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            padding: "10px 14px",
            borderRadius: 10,
            background: loading ? "#94a3b8" : "#0f172a",
            color: "#fff",
            border: "none",
            cursor: loading ? "wait" : "pointer",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {loading ? "Conectando…" : "Continuar con Google"}
        </button>
        {error ? (
          <div style={{ marginTop: 12, color: "#b91c1c", fontSize: 13 }}>
            Error: {error}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "8px",
            background: "transparent",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Cancelar
        </button>
        {user ? (
          <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
            (sesión existente: {user.email})
          </div>
        ) : null}
        <div style={{ marginTop: 8, fontSize: 11, color: "#cbd5e1", textAlign: "right" }}>
          {reason ? `motivo: ${reason}` : ""}
        </div>
      </div>
    </div>
  );
}

/**
 * Helper to fire the gate event from anywhere in the app. Returns true if the
 * caller should abort their action (i.e. user is anonymous and we triggered
 * the modal); false if the user is already authenticated.
 */
export function requestAuthGate(reason = "wizard") {
  // We cannot read context here; let the modal decide based on its own state.
  window.dispatchEvent(
    new CustomEvent("bmc-auth-gate-required", { detail: { reason } }),
  );
}
