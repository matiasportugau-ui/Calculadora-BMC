/**
 * PanelinLivePage — ambient voice-character experience (/panelin/live).
 * Built on the existing, already-secure voice plumbing
 * (server/routes/agentVoice.js + useVoiceSession.js) via
 * usePanelinCharacterVoice; the character rendering lives in
 * PanelinLiveCharacter.jsx.
 *
 * Two extra modes layered on top of the original full-screen page:
 *  - Lead context via URL (?quoteId&cliente&consulta): when launched from the
 *    CRM sheet "💬 Más info" hyperlink, the voice agent starts already knowing
 *    which quote / info-request the operator is on.
 *  - Detachable, always-on-top floating window (?floating=1 + a "Fijar arriba"
 *    button → Document Picture-in-Picture) so it can sit over Google Sheets.
 *    See ./panelin-live/detach.js. PiP is Chromium-only, consistent with the
 *    existing WebRTC/Safari gate; a same-origin popup is the fallback.
 */
import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { Mic, MicOff, X, Pin, ExternalLink } from "lucide-react";
import { useBmcAuthContext } from "../contexts/bmcAuthContext.js";
import { usePanelinCharacterVoice } from "../hooks/usePanelinCharacterVoice.js";
import { isBrowserSupported, isSafari } from "../hooks/voiceSupport.js";
import { openFloatingPanelinLive } from "./panelin-live/detach.js";
import PanelinLiveCharacter from "./PanelinLiveCharacter.jsx";

const CONSULTA_MAX = 800;

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

/** Small pill (top-center) showing which lead/quote the session is scoped to. */
function LeadChip({ leadContext }) {
  const who = leadContext.cliente || "cliente";
  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth: "70vw",
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "rgba(94,234,212,0.16)",
        border: "1px solid rgba(94,234,212,0.35)",
        color: "#5eead4",
        padding: "6px 14px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        backdropFilter: "blur(8px)",
        pointerEvents: "none",
      }}
      title={leadContext.consulta || `Consulta de ${who}`}
    >
      Consulta de {who}
    </div>
  );
}

const ICON_BTN_STYLE = {
  width: 34,
  height: 34,
  borderRadius: "50%",
  border: "none",
  background: "rgba(0,0,0,0.55)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  backdropFilter: "blur(8px)",
};

export default function PanelinLivePage() {
  const { accessToken } = useBmcAuthContext();
  const [searchParams] = useSearchParams();
  const [voiceError, setVoiceError] = useState(null);
  const [started, setStarted] = useState(false);
  const [pipWindow, setPipWindow] = useState(null);

  const floatingParam = searchParams.get("floating") === "1";
  // Compact chrome when the page is running as a small floating window (popup /
  // ?floating=1) or has been promoted into a Document-PiP window.
  const compact = floatingParam || Boolean(pipWindow);

  // Lead context from the CRM sheet hyperlink. Cap consulta before it ever
  // leaves the browser; the server sanitizes + caps again defensively.
  const leadContext = useMemo(() => {
    const quoteId = searchParams.get("quoteId") || "";
    const cliente = searchParams.get("cliente") || "";
    const consulta = (searchParams.get("consulta") || "").slice(0, CONSULTA_MAX);
    if (!quoteId && !cliente && !consulta) return null;
    return { quoteId, cliente, consulta };
  }, [searchParams]);

  const handleError = useCallback((msg) => setVoiceError(msg), []);

  const { status, isListening, remoteVuLevel, emotion, start, stop } = usePanelinCharacterVoice({
    authHeader: accessToken ? `Bearer ${accessToken}` : undefined,
    leadContext,
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

  // Detach into an always-on-top floating window (Document-PiP, else popup).
  const handleDetach = useCallback(async (e) => {
    e?.stopPropagation?.();
    const pip = await openFloatingPanelinLive();
    if (pip?.documentPiP) {
      pip.window.addEventListener("pagehide", () => setPipWindow(null), { once: true });
      setPipWindow(pip.window);
    }
    // Popup fallback: a new /panelin/live?floating=1 window already loaded; nothing to track.
  }, []);

  const handleClose = useCallback(
    (e) => {
      e?.stopPropagation?.();
      if (pipWindow) {
        try { pipWindow.close(); } catch { /* ignore */ }
        setPipWindow(null);
        return;
      }
      // Popup windows opened by script can self-close; a normal tab will ignore this.
      window.close();
    },
    [pipWindow]
  );

  const notSupported = !isBrowserSupported() || isSafari();

  const rootStyle = {
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
  };

  const liveBody = (
    <div onClick={handleGestureStart} style={rootStyle}>
      <style>{BG_KEYFRAMES}</style>

      {/* Top-left chrome: "volver" (full page) or close/pin controls (compact) */}
      {compact ? (
        <div style={{ position: "fixed", top: 16, left: 16, display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={handleClose}
            style={ICON_BTN_STYLE}
            aria-label="Cerrar ventana flotante"
            title="Cerrar"
          >
            <X size={16} />
          </button>
          {!pipWindow && "documentPictureInPicture" in window && (
            <button
              type="button"
              onClick={handleDetach}
              style={ICON_BTN_STYLE}
              aria-label="Fijar arriba (ventana siempre visible)"
              title="Fijar arriba"
            >
              <Pin size={16} />
            </button>
          )}
        </div>
      ) : (
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
      )}

      {leadContext && <LeadChip leadContext={leadContext} />}

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

          {/* Detach button — only on the normal full-page view (not compact). */}
          {!compact && (
            <button
              type="button"
              onClick={handleDetach}
              style={{
                position: "fixed",
                bottom: 32,
                right: 24,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(0,0,0,0.55)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              }}
              title="Abrir en ventana flotante siempre visible (sobre las planillas)"
            >
              <ExternalLink size={16} /> Ventana flotante
            </button>
          )}
        </>
      )}
    </div>
  );

  // When promoted to Document-PiP, render the live UI into the PiP window via a
  // portal (the voice session stays mounted here in the main JS context), and
  // leave a small placeholder in the origin tab.
  if (pipWindow) {
    return (
      <>
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 16,
            background: "linear-gradient(160deg, #1a1a2e 0%, #12121f 100%)",
            color: "#fff",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          <ExternalLink size={32} color="#5eead4" />
          <p style={{ fontSize: 14, opacity: 0.85 }}>Panelin Live está en la ventana flotante.</p>
          <button type="button" onClick={handleClose} style={{ ...ICON_BTN_STYLE, width: "auto", borderRadius: 999, padding: "8px 16px", gap: 8, fontSize: 13 }}>
            <X size={16} /> Traer de vuelta
          </button>
          <Link to="/" style={{ color: "#9ca3af", fontSize: 13 }}>← Volver a la calculadora</Link>
        </div>
        {createPortal(liveBody, pipWindow.document.body)}
      </>
    );
  }

  return liveBody;
}
