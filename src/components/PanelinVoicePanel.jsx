/**
 * PanelinVoicePanel — hands-free voice conversation UI (embedded chat).
 *
 * Renders when voice mode is active inside PanelinChatPanel.
 * Uses useHandsFreeVoice (Web Speech API + browser TTS + wake word "Panelin").
 * OpenAI Realtime / WebRTC lives on /panelin/live via useVoiceSession — not here.
 *
 * Fallback (Firefox / no Web Speech): push-to-talk → POST /api/agent/transcribe
 * (Whisper) via useDictation, then send() + browser TTS for the reply.
 *
 * UX:
 *  - Big pulsing mic button (idle → tap to start, active → tap to stop)
 *  - VU meter ring around mic button
 *  - Live transcript of user + assistant turns
 *  - Wake-word barge-in during TTS (Hands-free only)
 *  - "Pasar a texto" link exits voice mode
 *  - Unsupported-browser banner when neither Hands-free nor Whisper mic works
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { useHandsFreeVoice } from "../hooks/useHandsFreeVoice.js";
import { useDictation } from "../hooks/useDictation.js";
import { isHandsFreeSupported, canUseWhisperVoice } from "../hooks/voiceSupport.js";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif";


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

function speakAssistant(text) {
  if (typeof window === "undefined" || !window.speechSynthesis || !text) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-UY";
    utterance.rate = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const esVoice = voices.find((v) => v.lang.startsWith("es"));
    if (esVoice) utterance.voice = esVoice;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

/** Push-to-talk Whisper path for browsers without Web Speech (e.g. Firefox). */
function WhisperVoicePanel({
  send,
  messages = [],
  onSwitchToText,
  skinTokens,
  PRIMARY,
}) {
  const [transcript, setTranscript] = useState([]);
  const [voiceError, setVoiceError] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const transcriptEndRef = useRef(null);
  const pendingReplyFromRef = useRef(null);

  const handleError = useCallback((msg) => setVoiceError(msg), []);

  const onTranscript = useCallback(
    (text) => {
      const t = String(text || "").trim();
      if (!t) return;
      setTranscript((prev) => [...prev, { role: "user", text: t }]);
      pendingReplyFromRef.current = messages.length;
      send(t);
    },
    [send, messages.length],
  );

  const { status, vuLevel, start, stop, reset } = useDictation({
    onTranscript,
    onError: handleError,
    preferBrowserSpeech: false,
    language: "es",
    maxSeconds: 60,
  });

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    if (pendingReplyFromRef.current == null) return;
    if (messages.length <= pendingReplyFromRef.current) return;
    const newMessages = messages.slice(pendingReplyFromRef.current);
    const assistantMsg = newMessages.find((m) => m.role === "assistant" && m.content);
    if (!assistantMsg) return;
    pendingReplyFromRef.current = null;
    setTranscript((prev) => [...prev, { role: "assistant", text: assistantMsg.content }]);
    setIsSpeaking(true);
    speakAssistant(assistantMsg.content).finally(() => setIsSpeaking(false));
  }, [messages]);

  const isRecording = status === "recording" || status === "transcribing";
  const MIC_SIZE = 80;

  const handleMicButton = useCallback(async () => {
    setVoiceError(null);
    if (status === "idle" || status === "error") {
      reset();
      await start();
    } else if (status === "recording") {
      await stop();
    }
  }, [status, start, stop, reset]);

  const statusLabel =
    status === "transcribing"
      ? "Transcribiendo…"
      : status === "recording"
        ? "Grabando — tocá para enviar"
        : isSpeaking
          ? "Hablando…"
          : "Tocá para hablar (Whisper)";

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
            Este navegador no tiene Web Speech. Usá el micrófono (transcripción Whisper) o pasá a texto.
          </p>
        )}
        {transcript.map((line, i) => (
          <TranscriptLine key={i} role={line.role} text={line.text} primary={PRIMARY} />
        ))}
        <div ref={transcriptEndRef} />
      </div>

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
        <div style={{ position: "relative", width: MIC_SIZE, height: MIC_SIZE }}>
          {isRecording && (
            <VuRing
              level={vuLevel}
              isSpeaking={false}
              isListening
              primary={PRIMARY}
              size={MIC_SIZE}
            />
          )}
          <button
            type="button"
            onClick={handleMicButton}
            disabled={status === "transcribing"}
            aria-label={isRecording ? "Detener y enviar" : "Grabar con Whisper"}
            style={{
              width: MIC_SIZE,
              height: MIC_SIZE,
              borderRadius: "50%",
              border: "none",
              background: isRecording ? "#ef4444" : PRIMARY,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: status === "transcribing" ? "default" : "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
          >
            {isRecording ? <PhoneOff size={28} /> : <Mic size={28} />}
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            window.speechSynthesis?.cancel();
            reset();
            onSwitchToText?.();
          }}
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

export default function PanelinVoicePanel({
  calcState,
  onAction,
  onSwitchToText,
  skinTokens,
  devMode = false,
  authHeader,
  voiceMode = true,
  send,
  messages = [],
}) {
  const PRIMARY = skinTokens?.primary || "#0071e3";
  const [voiceError, setVoiceError] = useState(null);
  const transcriptEndRef = useRef(null);

  const handleError = useCallback((msg) => setVoiceError(msg), []);

  const handsFreeOk = isHandsFreeSupported();
  const whisperOk = canUseWhisperVoice();

  const { status, phase, transcript, isSpeaking, isListening, vuLevel, start, stop } = useHandsFreeVoice({
    onAction,
    onError: handleError,
    send,
    messages,
  });

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Release mic when the user toggles voice mode off (panel stays mounted but hidden)
  useEffect(() => {
    if (!voiceMode && status !== "idle") stop();
  }, [voiceMode, status, stop]);

  const handleMicButton = useCallback(() => {
    if (status === "idle" || status === "error") {
      setVoiceError(null);
      start(calcState);
    } else {
      stop();
    }
  }, [status, start, stop, calcState]);

  if (!handsFreeOk && whisperOk) {
    return (
      <WhisperVoicePanel
        send={send}
        messages={messages}
        onSwitchToText={onSwitchToText}
        skinTokens={skinTokens}
        PRIMARY={PRIMARY}
      />
    );
  }

  if (!handsFreeOk) {
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
          Tu navegador no soporta reconocimiento de voz ni captura de micrófono. Probá Chrome, Edge o Safari actualizado.
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
  const isConnecting = false; // Hands-free doesn't have a connecting state

  const micBg = isActive
    ? isSpeaking
      ? "#ef4444"
      : isListening
        ? PRIMARY
        : "#6b7280"
    : PRIMARY;

  const statusLabel = phase || (status === "error" ? "Error de voz" : "Toca para empezar");

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

        {/* Wake word hint */}
        {status === "active" && !isSpeaking && !isListening && (
          <p style={{ fontSize: 11, color: "#9ca3af", margin: 0, textAlign: "center" }}>
            Decí &quot;Panelin&quot; para comenzar
          </p>
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
