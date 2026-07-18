/**
 * Co-Work capture toolbar — Capturar pestaña + Live assist + frame thumb.
 */
import React from "react";

const btnBase = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 999,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  background: "#fff",
  color: "#202124",
  lineHeight: 1.2,
};

export default function CoWorkToolbar({ cowork, disabled = false, compact = false }) {
  if (!cowork?.enabled) return null;
  const {
    consent,
    acceptConsent,
    sharing,
    liveAssist,
    thumbUrl,
    error,
    clearError,
    oneShotCapture,
    setLiveAssistOn,
    stopShare,
    clearFrame,
  } = cowork;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        padding: compact ? "6px 0" : "8px 12px",
        borderBottom: compact ? "none" : "1px solid rgba(0,0,0,0.06)",
        background: liveAssist ? "rgba(217,48,37,0.04)" : "transparent",
      }}
    >
      {!consent && (
        <button
          type="button"
          style={{ ...btnBase, background: "#e8f0fe", borderColor: "#1a73e8", color: "#174ea6" }}
          onClick={acceptConsent}
          disabled={disabled}
          title="Panelin puede ver la pestaña que elijas. No se graba al disco."
        >
          Activar Co-Work (visión)
        </button>
      )}

      <button
        type="button"
        style={btnBase}
        disabled={disabled || !consent}
        onClick={() => oneShotCapture()}
        title="Capturar la pestaña de Sheets (una vez) y adjuntar al próximo mensaje"
      >
        📷 Capturar pestaña
      </button>

      <button
        type="button"
        style={{
          ...btnBase,
          ...(liveAssist
            ? { background: "#d93025", color: "#fff", borderColor: "#d93025" }
            : {}),
        }}
        disabled={disabled || !consent}
        onClick={() => setLiveAssistOn(!liveAssist)}
        title="Live assist: captura cada ~4s en buffer local; se adjunta al enviar mensaje"
      >
        {liveAssist ? "● Live ON" : "Live assist"}
      </button>

      {(sharing || liveAssist) && (
        <button type="button" style={{ ...btnBase, color: "#5f6368" }} onClick={stopShare} disabled={disabled}>
          Detener
        </button>
      )}

      {thumbUrl && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <img
            src={thumbUrl}
            alt="Última captura"
            style={{
              width: 48,
              height: 32,
              objectFit: "cover",
              borderRadius: 4,
              border: "1px solid rgba(0,0,0,0.12)",
            }}
          />
          <button
            type="button"
            style={{ ...btnBase, padding: "4px 8px", fontSize: 11 }}
            onClick={clearFrame}
            title="Quitar frame del buffer"
          >
            ✕
          </button>
        </span>
      )}

      {liveAssist && (
        <span style={{ fontSize: 11, color: "#d93025", fontWeight: 600 }}>
          Buffer activo · se envía con tu mensaje
        </span>
      )}

      {error && (
        <span style={{ fontSize: 11, color: "#d93025", maxWidth: 220 }} title={error}>
          {error}{" "}
          <button type="button" onClick={clearError} style={{ ...btnBase, padding: "2px 6px", fontSize: 10 }}>
            ok
          </button>
        </span>
      )}
    </div>
  );
}
