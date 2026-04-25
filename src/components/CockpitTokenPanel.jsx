import React from "react";

const CLOUD_RUN_ENV_URL =
  "https://console.cloud.google.com/run/detail/us-central1/panelin-calc/edit?project=chatbot-bmc-live";

const guideBox = {
  background: "#fffbeb",
  border: "1px solid #ffe066",
  borderRadius: 8,
  padding: "12px 14px",
  marginBottom: 12,
  fontSize: 12,
  color: "#5c4d00",
};

const linkStyle = {
  color: "#0071e3",
  textDecoration: "none",
  fontWeight: 600,
};

const codeStyle = {
  fontFamily: "'Courier New', monospace",
  background: "#f0f0f5",
  borderRadius: 3,
  padding: "1px 5px",
  fontSize: 11,
};

/**
 * Shared cockpit auth panel used by ML, WA, Canales, Admin modules.
 *
 * Props:
 *   tokenAutoLoaded  boolean
 *   tokenLoadError   string
 *   tokenInput       string
 *   setTokenInput    fn
 *   onSave           fn
 *   onClear          fn  — clears stored token so user can enter new one
 *   inputStyle       object (optional)
 *   btnPrimaryStyle  object (optional)
 *   btnGhostStyle    object (optional)
 *   actions          ReactNode — extra buttons shown in the "loaded" row
 */
export default function CockpitTokenPanel({
  tokenAutoLoaded,
  tokenLoadError,
  tokenInput,
  setTokenInput,
  onSave,
  onClear,
  inputStyle = {},
  btnPrimaryStyle = {},
  btnGhostStyle = {},
  actions,
}) {
  if (tokenAutoLoaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#2a7a2a", fontWeight: 600 }}>
          ✓ Token activo
        </span>
        <button
          type="button"
          style={{ ...btnGhostStyle, fontSize: 12, padding: "4px 10px" }}
          onClick={onClear}
        >
          Cambiar token
        </button>
        {actions}
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 600 }}>
        Autenticación cockpit
      </div>

      {tokenLoadError && (
        <div style={{ fontSize: 12, color: "#8b4000", marginBottom: 10 }}>
          {tokenLoadError}
        </div>
      )}

      <div style={guideBox}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>
          ⚠️ Solo necesario si el token fue comprometido o el servidor no pudo entregarlo
        </div>
        <ol style={{ margin: "0 0 0 16px", padding: 0, lineHeight: "1.9" }}>
          <li>
            Generá un nuevo token en tu terminal:{" "}
            <code style={codeStyle}>openssl rand -hex 32</code>
          </li>
          <li>Copiá el valor generado</li>
          <li>
            Actualizá la variable <code style={codeStyle}>API_AUTH_TOKEN</code> en Cloud Run:{" "}
            <a
              href={CLOUD_RUN_ENV_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
            >
              Abrir configuración Cloud Run ↗
            </a>
          </li>
          <li>
            Actualizá también en tu <code style={codeStyle}>.env</code> local y reiniciá el servidor
          </li>
          <li>Pegá el nuevo token aquí abajo y guardá</li>
        </ol>
      </div>

      <input
        type="password"
        autoComplete="off"
        placeholder="Pegá API_AUTH_TOKEN"
        value={tokenInput}
        onChange={(e) => setTokenInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSave()}
        style={{ ...inputStyle, marginBottom: 10 }}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={btnPrimaryStyle} onClick={onSave}>
          Guardar token
        </button>
        {actions}
      </div>
    </>
  );
}
