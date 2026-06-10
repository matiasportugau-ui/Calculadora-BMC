import React, { useState } from "react";

const guideBox = {
  background: "#fffbeb",
  border: "1px solid #ffe066",
  borderRadius: 8,
  padding: "12px 14px",
  marginBottom: 12,
  fontSize: 12,
  color: "#5c4d00",
};

const codeStyle = {
  fontFamily: "'Courier New', monospace",
  background: "#f0f0f5",
  borderRadius: 3,
  padding: "1px 5px",
  fontSize: 11,
};

/**
 * Cockpit auth status for hub modules (S5 Phase B: identity JWT primary).
 */
export default function CockpitTokenPanel({
  tokenAutoLoaded,
  tokenLoadError,
  tokenInput,
  setTokenInput,
  onSave,
  onClear,
  isJwt = false,
  userEmail = "",
  onLogin,
  inputStyle = {},
  btnPrimaryStyle = {},
  btnGhostStyle = {},
  actions,
}) {
  const [showOverride, setShowOverride] = useState(false);

  if (isJwt && tokenAutoLoaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#2a7a2a", fontWeight: 600 }}>
          ✓ Sesión activa{userEmail ? ` (${userEmail})` : ""}
        </span>
        {actions}
      </div>
    );
  }

  if (tokenAutoLoaded && !isJwt) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#2a7a2a", fontWeight: 600 }}>
          ✓ Token de servicio (override dev)
        </span>
        <button
          type="button"
          style={{ ...btnGhostStyle, fontSize: 12, padding: "4px 10px" }}
          onClick={onClear}
        >
          Borrar override
        </button>
        {actions}
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 600 }}>
        Autenticación operador
      </div>

      {tokenLoadError && (
        <div style={{ fontSize: 12, color: "#8b4000", marginBottom: 10 }}>
          {tokenLoadError}
        </div>
      )}

      {onLogin ? (
        <div style={{ marginBottom: 12 }}>
          <button type="button" style={btnPrimaryStyle} onClick={onLogin}>
            Iniciar sesión con Google
          </button>
        </div>
      ) : null}

      <button
        type="button"
        style={{ ...btnGhostStyle, fontSize: 12, marginBottom: showOverride ? 10 : 0 }}
        onClick={() => setShowOverride((v) => !v)}
      >
        {showOverride ? "Ocultar override dev" : "Avanzado: token de servicio (dev/CI)"}
      </button>

      {showOverride ? (
        <>
          <div style={guideBox}>
            Solo para scripts locales o emergencia si JWT no está disponible.
            Pegá <code style={codeStyle}>API_AUTH_TOKEN</code> del servidor.
          </div>
          <input
            type="password"
            autoComplete="off"
            placeholder="API_AUTH_TOKEN (override)"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSave()}
            style={{ ...inputStyle, marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={btnPrimaryStyle} onClick={onSave}>
              Guardar override
            </button>
            {actions}
          </div>
        </>
      ) : (
        actions
      )}
    </>
  );
}