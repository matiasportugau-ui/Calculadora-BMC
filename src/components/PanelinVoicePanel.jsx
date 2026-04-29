/**
 * PanelinVoicePanel — fluent voice conversation UI.
 *
 * Renders when voice mode is active inside PanelinChatPanel.
 * Uses useVoiceSession for WebRTC + OpenAI Realtime.
 *
 * UX:
 *  - Big pulsing mic button (idle → tap to start, active → tap to stop)
 *  - VU meter ring around mic button
 *  - Live transcript of user + assistant turns
 *  - "Interrumpir" button while assistant is speaking (barge-in)
 *  - "Pasar a texto" link exits voice mode
 *  - Safari / unsupported browser fallback banner
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { useVoiceSession } from "../hooks/useVoiceSession.js";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif";

function isBrowserSupported() {
  if (typeof window === "undefined") return false;
  return !!(
    window.RTCPeerConnection &&
    navigator.mediaDevices?.getUserMedia &&
    (window.SpeechRecognition || window.webkitSpeechRecognition || true) // RTCPeerConnection is the real gate
  );
}

function isSafari() {
  if (typeof navigator === "undefined") return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

function VuRing({ level, isSpeaking, isListening, primary, size = 80 }) {
  const r = size / 2 - 4;
  const circ = 2 * Math.PI * r;
  const baseStroke = isSpeaking ? "#ef4444" : isListening ? primary : "#9ca3af";
  const glow = (isSpeaking || isListening) ? `0 0 ${12 + level * 20}px ${baseStroke}` : "none";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={baseStroke}
        strokeWidth={3}
        strokeDasharray={`${circ * (0.1 + level * 0.9)} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{
          transition: "stroke-dasharray 80ms linear, filter 80ms linear",
          filter: glow !== "none" ? `drop-shadow(${glow})` : "none",
        }}
      />
    </svg>
  );
}

function TranscriptLine({ role, text, primary }) {
  return (
    <div
      style={{
        alignSelf: role === "user" ? "flex-end" : "flex-start",
        background: role === "user" ? primary : "#f3f4f6",
        color: role === "user" ? "#fff" : "#1d1d1f",
        borderRadius: role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
        padding: "7px 12px",
        fontSize: 13,
        maxWidth: "85%",
        wordBreak: "break-word",
        fontFamily: FONT,
      }}
    >
      {text}
    </div>
  );
}

export default function PanelinVoicePanel({
  calcState,
  onAction,
  onSwitchToText,
  skinTokens,
  devMode = false,
  authHeader,
  voiceMode = true,
}) {
  const PRIMARY = skinTokens?.primary || "#0071e3";
  const [transcript, setTranscript] = useState([]);
  const [voiceError, setVoiceError] = useState(null);
  const transcriptEndRef = useRef(null);

  const handleTranscriptDelta = useCallback(({ role, delta, transcript: full }) => {
    setTranscript((prev) => {
      const last = prev[prev.length - 1];
      if (delta !== undefined) {
        if (last?.role === role) {
          return [...prev.slice(0, -1), { role, text: last.text + delta }];
        }
        return [...prev, { role, text: delta }];
      }
      if (full !== undefined) {
        if (last?.role === role && !last.finalized) {
          return [...prev.slice(0, -1), { role, text: full, finalized: true }];
        }
        return [...prev, { role, text: full, finalized: true }];
      }
      return prev;
    });
  }, []);

  const handleError = useCallback((msg) => setVoiceError(msg), []);

  const { status, isSpeaking, isListening, vuLevel, start, stop, interrupt } = useVoiceSession({
    onAction,
    onTranscriptDelta: handleTranscriptDelta,
    onError: handleError,
    devMode,
    authHeader,
  });

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Release mic + WebRTC when the user toggles voice mode off (panel stays mounted but hidden)
  useEffect(() => {
    if (!voiceMode && status !== "idle") stop();
  }, [voiceMode, status, stop]);

  const handleMicButton = useCallback(() => {
    if (status === "idle" || status === "error") {
      setVoiceError(null);
      setTranscript([]);
      start(calcState);
    } else {
      stop();
    }
  }, [status, start, stop, calcState]);

  const notSupported = !isBrowserSupported();
  const safari = isSafari();

  if (notSupported || safari) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          fontFamily: FONT,
          textAlign: "center",
        }}
      >
        <MicOff size={40} color="#9ca3af" />
        <p style={{ fontSize: 14, color: "#6e6e73", margin: 0 }}>
          {safari
            ? "El modo voz fluido requiere Chrome o Edge. Safari no soporta WebRTC con OpenAI Realtime."
            : "Tu navegador no soporta el modo voz fluido."}
        </p>
        <button
          type="button"
          onClick={onSwitchToText}
          style={{
            border: "none",
            background: PRIMARY,
            color: "#fff",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            cursor: "pointer",
            fontFamily: FONT,
          }}
        >
          Usar modo texto
        </button>
      </div>
    );
  }

  const MIC_SIZE = 80;
  const isActive = status === "active";
  const isConnecting = status === "connecting";

  const micBg = isActive
    ? isSpeaking
      ? "#ef4444"
      : isListening
        ? PRIMARY
        : "#6b7280"
    : PRIMARY;

  const statusLabel = isConnecting
    ? "Conectando..."
    : isActive
      ? isSpeaking
        ? "Panelin está hablando…"
        : isListening
          ? "Escuchando…"
          : "Listo — hablá"
      : status === "error"
        ? "Error de voz"
        : "Toca para empezar";

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: FONT,
      }}
    >
      <style>{`@keyframes panelin-mic-pulse{0%,100%{box-shadow:0 0 0 4px rgba(0,113,227,0.2)}50%{box-shadow:0 0 0 10px rgba(0,113,227,0.05)}}`}</style>
      {/* Transcript area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {transcript.length === 0 && (
          <p style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", marginTop: 32 }}>
            La transcripción aparecerá aquí mientras hablás.
          </p>
        )}
        {transcript.map((line, i) => (
          <TranscriptLine key={i} role={line.role} text={line.text} primary={PRIMARY} />
        ))}
        <div ref={transcriptEndRef} />
      </div>

      {/* Error banner */}
      {voiceError && (
        <div
          style={{
            background: "#fef2f2",
            color: "#dc2626",
            fontSize: 12,
            padding: "8px 14px",
            borderTop: "1px solid #fecaca",
            flexShrink: 0,
          }}
        >
          {voiceError}
        </div>
      )}

      {/* Controls */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          padding: "20px 14px",
          borderTop: "1px solid #e5e5ea",
          flexShrink: 0,
          background: skinTokens?.drawerBg || "#fff",
        }}
      >
        <p style={{ fontSize: 12, color: "#6e6e73", margin: 0 }}>{statusLabel}</p>

        {/* Mic button + VU ring */}
        <div style={{ position: "relative", width: MIC_SIZE, height: MIC_SIZE }}>
          {isActive && (
            <VuRing
              level={vuLevel}
              isSpeaking={isSpeaking}
              isListening={isListening}
              primary={PRIMARY}
              size={MIC_SIZE}
            />
          )}
          <button
            type="button"
            onClick={handleMicButton}
            disabled={isConnecting}
            aria-label={isActive ? "Detener voz" : "Iniciar voz"}
            style={{
              width: MIC_SIZE,
              height: MIC_SIZE,
              borderRadius: "50%",
              border: "none",
              background: isConnecting ? "#d1d5db" : micBg,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: isConnecting ? "default" : "pointer",
              transition: "background 200ms ease",
              boxShadow: isActive ? `0 0 0 4px ${micBg}22` : "0 2px 8px rgba(0,0,0,0.15)",
              animation: isListening ? "panelin-mic-pulse 1.5s infinite" : "none",
            }}
          >
            {isActive ? <PhoneOff size={28} /> : <Mic size={28} />}
          </button>
        </div>

        {/* Barge-in hint */}
        {isSpeaking && (
          <button
            type="button"
            onClick={interrupt}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 8,
              background: "#fff",
              color: "#374151",
              fontSize: 12,
              padding: "5px 12px",
              cursor: "pointer",
              fontFamily: FONT,
            }}
          >
            Interrumpir
          </button>
        )}

        <button
          type="button"
          onClick={() => { stop(); onSwitchToText?.(); }}
          style={{
            border: "none",
            background: "transparent",
            color: "#9ca3af",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: FONT,
            textDecoration: "underline",
          }}
        >
          Pasar a texto
        </button>
      </div>
    </div>
  );
}
