// ═══════════════════════════════════════════════════════════════════════════
// RequireGrant — route-level guard that renders children only when the user
// has at least the given role and module level. Otherwise renders a 403 page
// with a "Solicitar acceso" button.
//
// Usage:
//   <Route path="/hub/wa" element={
//     <RequireGrant module="wa" minLevel="read"><WaModule/></RequireGrant>
//   }/>
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useState } from "react";
import { useBmcAuth, useModuleGrants } from "../../hooks/useBmcAuth.js";
import { isLocalDevApp } from "../../utils/localDevAuth.js";
import { requestAuthGate } from "./AuthGateModal.jsx";

const ApiBase = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/+$/, "");
  }
  return "";
})();

export default function RequireGrant({ module, role, minLevel = "read", children }) {
  const auth = useBmcAuth();
  const grants = useModuleGrants();
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState(null);
  const localDev = isLocalDevApp();

  const submitRequest = useCallback(async () => {
    if (!auth.isAuthenticated) {
      requestAuthGate("require-grant");
      return;
    }
    setRequesting(true);
    setError(null);
    try {
      const r = await fetch(`${ApiBase}/api/access-requests`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
        },
        body: JSON.stringify({ module, notes: `Solicitud desde ruta ${typeof window !== "undefined" ? window.location.pathname : ""}` }),
      });
      if (!r.ok) throw new Error(`http_${r.status}`);
      setRequested(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setRequesting(false);
    }
  }, [auth.isAuthenticated, auth.accessToken, module]);

  // Local Vite dev: skip Google OAuth gates (session minted silently via API).
  if (localDev) return children;

  if (auth.status === "loading") {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>
        Verificando acceso…
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <div style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {/* Video background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 0,
          }}
        >
          <source src={`${import.meta.env.BASE_URL}videos/login.mp4`} type="video/mp4" />
        </video>
        {/* Dark overlay */}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0, 0, 0, 0.5)", zIndex: 1 }} />
        {/* Content on top */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <Forbidden
            title="Iniciá sesión"
            body="Para acceder a este módulo necesitás iniciar sesión con tu cuenta."
            cta={{ label: "Iniciar sesión", onClick: () => requestAuthGate("require-grant") }}
          />
        </div>
      </div>
    );
  }

  // role check
  if (role) {
    const ROLE_RANK = { superadmin: 4, admin: 3, operator: 2, comprador: 1 };
    if ((ROLE_RANK[grants.role] || 0) < (ROLE_RANK[role] || 0)) {
      return (
        <Forbidden
          title="Acceso restringido"
          body={`Esta sección requiere rol "${role}". Tu rol actual es "${grants.role || "comprador"}".`}
        />
      );
    }
  }

  // module level check (superadmin bypasses)
  if (module && grants.role !== "superadmin" && !grants.has(module, minLevel)) {
    return (
      <Forbidden
        title="No tenés acceso a este módulo"
        body={`Permiso requerido: ${minLevel} en ${module}.`}
        cta={
          requested
            ? { label: "Solicitud enviada", disabled: true }
            : { label: requesting ? "Enviando…" : "Solicitar acceso", onClick: submitRequest, disabled: requesting }
        }
        error={error}
      />
    );
  }

  return children;
}

function Forbidden({ title, body, cta, error }) {
  return (
    <div style={{ minHeight: 240, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h2 style={{ margin: "0 0 6px", fontSize: 18, color: "#0f172a" }}>{title}</h2>
        <p style={{ margin: "0 0 16px", color: "#475569", fontSize: 14 }}>{body}</p>
        {cta ? (
          <button
            type="button"
            onClick={cta.onClick}
            disabled={cta.disabled}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #0f172a",
              background: cta.disabled ? "#e2e8f0" : "#0f172a",
              color: cta.disabled ? "#64748b" : "#fff",
              cursor: cta.disabled ? "default" : "pointer",
              fontSize: 13,
            }}
          >
            {cta.label}
          </button>
        ) : null}
        {error ? <div style={{ marginTop: 12, color: "#b91c1c", fontSize: 12 }}>Error: {error}</div> : null}
      </div>
    </div>
  );
}
