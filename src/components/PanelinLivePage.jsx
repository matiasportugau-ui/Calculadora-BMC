/**
 * PanelinLivePage — full-screen ambient voice-character experience
 * (/panelin/live). Built on the existing, already-secure voice plumbing
 * (server/routes/agentVoice.js + useVoiceSession.js) via
 * usePanelinCharacterVoice; the character rendering lives in
 * PanelinLiveCharacter.jsx.
 */
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Mic, MicOff } from "lucide-react";
import { useBmcAuthContext } from "../contexts/bmcAuthContext.js";
import { usePanelinCharacterVoice } from "../hooks/usePanelinCharacterVoice.js";
import { isBrowserSupported, isSafari } from "../hooks/voiceSupport.js";
import PanelinLiveCharacter from "./PanelinLiveCharacter.jsx";

const STATUS_LABEL = {
  idle: "Desconectado",
  connecting: "Conectando…",
  active: "En vivo",
  error: "Error de conexión",
};

const EMOTION_LABEL = {
  neutral: "",
  listening: "Escuchando…",
  thinking: "Conectando…",
  speaking: "Hablando…",
  happy: "¡Cotización lista!",
};

const BG_KEYFRAMES = `
@keyframes panelin-bg-drift {
  0%, 100% { background-position: 50% 30%, 20% 80%; }
  50% { background-position: 55% 35%, 25% 75%; }
}
@keyframes panelin-cta-pulse {
  0%, 100% { transform: translateY(0); opacity: 0.85; }
  50% { transform: translateY(-4px); opacity: 1; }
}
`;

function StatusPill({ status, emotion }) {
  const color = status === "active" ? "#5eead4" : status === "error" ? "#f87171" : "#9ca3af";
  const label = EMOTION_LABEL[emotion] || STATUS_LABEL[status] || status;
  const live = status === "active" && emotion !== "neutral";
  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(0,0,0,0.55)",
        color: "#fff",
        padding: "8px 16px",
        borderRadius: 999,
        fontSize: 13,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        backdropFilter: "blur(8px)",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          boxShadow: live ? `0 0 8px ${color}` : "none",
          animation: live ? "panelin-cta-pulse 1.4s ease-in-out infinite" : "none",
        }}
      />
      {label}
    </div>
  );
}

export default function PanelinLivePage() {
  const { accessToken } = useBmcAuthContext();
  const [voiceError, setVoiceError] = useState(null);
  const [started, setStarted] = useState(false);

  const handleError = useCallback((msg) => setVoiceError(msg), []);

  const { status, isListening, remoteVuLevel, emotion, start, stop } = usePanelinCharacterVoice({
    authHeader: accessToken ? `Bearer ${accessToken}` : undefined,
    onError: handleError,
  });

  const handleGestureStart = useCallback(() => {
    if (started) return;
    setStarted(true);
    setVoiceError(null);
    start();
  }, [started, start]);

  const handleMicToggle = useCallback(
    (e) => {
      e.stopPropagation();
      if (status === "idle" || status === "error") {
        setVoiceError(null);
        start();
      } else {
        stop();
      }
    },
    [status, start, stop]
  );

  const notSupported = !isBrowserSupported() || isSafari();

  return (
    <div
      onClick={handleGestureStart}
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: `
          radial-gradient(circle at 50% 30%, #2a2a4a 0%, transparent 55%),
          radial-gradient(circle at 20% 80%, rgba(94,234,212,0.12) 0%, transparent 45%),
          linear-gradient(160deg, #1a1a2e 0%, #12121f 100%)
        `,
        backgroundSize: "120% 120%, 140% 140%, 100% 100%",
        animation: "panelin-bg-drift 14s ease-in-out infinite",
        overflow: "hidden",
        cursor: started ? "default" : "pointer",
      }}
    >
      <style>{BG_KEYFRAMES}</style>
      <Link
        to="/"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: 20,
          left: 20,
          color: "#fff",
          opacity: 0.7,
          fontSize: 13,
          textDecoration: "none",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        ← Volver a la calculadora
      </Link>

      <StatusPill status={status} emotion={emotion} />

      {notSupported ? (
        <div style={{ color: "#fff", textAlign: "center", padding: 24, maxWidth: 360 }}>
          <MicOff size={40} color="#9ca3af" style={{ marginBottom: 16 }} />
          <p style={{ fontSize: 14, opacity: 0.8 }}>
            El modo voz de Panelin requiere Chrome o Edge (WebRTC + OpenAI Realtime no funciona en Safari).
          </p>
        </div>
      ) : (
        <>
          <PanelinLiveCharacter emotion={emotion} visemeLevel={remoteVuLevel} isListening={isListening} />

          {!started && (
            <div
              style={{
                position: "fixed",
                bottom: 100,
                color: "#fff",
                fontSize: 15,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                background: "rgba(0,0,0,0.5)",
                padding: "10px 20px",
                borderRadius: 999,
                animation: "panelin-cta-pulse 2.2s ease-in-out infinite",
              }}
            >
              Tocá en cualquier lugar para empezar
            </div>
          )}

          {voiceError && (
            <div
              style={{
                position: "fixed",
                bottom: 100,
                color: "#f87171",
                fontSize: 13,
                background: "rgba(0,0,0,0.6)",
                padding: "8px 16px",
                borderRadius: 999,
              }}
            >
              {voiceError}
            </div>
          )}

          {started && (
            <button
              type="button"
              onClick={handleMicToggle}
              style={{
                position: "fixed",
                bottom: 32,
                width: 64,
                height: 64,
                borderRadius: "50%",
                border: "none",
                background: status === "active" || status === "connecting" ? "#ef4444" : "#5eead4",
                color: "#0f172a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              }}
              aria-label={status === "active" || status === "connecting" ? "Detener conversación" : "Iniciar conversación"}
            >
              {status === "active" || status === "connecting" ? <MicOff size={26} /> : <Mic size={26} />}
            </button>
          )}
        </>
      )}
    </div>
  );
}
