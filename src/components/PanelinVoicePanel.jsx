/**
 * PanelinVoicePanel — hands-free voice conversation UI (embedded chat).
 *
 * Renders when voice mode is active inside PanelinChatPanel.
 * Primary path: Grok Speech-to-Speech via useVoiceSession (same brain pack as
 * the xAI console agent + shared IAlfred↔Panelin lessons + form tools).
 * Fallback: useHandsFreeVoice (Web Speech API) or Whisper push-to-talk.
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
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { useHandsFreeVoice } from "../hooks/useHandsFreeVoice.js";
import { useVoiceSession } from "../hooks/useVoiceSession.js";
import { useDictation } from "../hooks/useDictation.js";
import {
  isHandsFreeSupported,
  canUseWhisperVoice,
  isGrokRealtimeSupported,
} from "../hooks/voiceSupport.js";
import {
  KERNEL_WAKE_RE,
  addressedToFromText,
  ingestTurn,
  postSnapshot,
  kernelFetch,
} from "../utils/kernelBus.js";
import { coalesceUserTranscript } from "../utils/voiceTranscriptCoalesce.js";
import { isNoiseUtterance } from "../utils/voiceNoiseFilter.js";
import {
  PANELIN_AI_EVENT,
  resolveEffectiveAiPick,
  formatAiChatModelLabel,
  loadPanelinAiSelection,
} from "../utils/panelinAiSelection.js";

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

function MuteChip({ label, muted, speaking, onMute, onUnmute, kind = "speaker" }) {
  const IconOn = kind === "mic" ? Mic : Volume2;
  const IconOff = kind === "mic" ? MicOff : VolumeX;
  return (
    <button
      type="button"
      onClick={muted ? onUnmute : onMute}
      title={muted ? (kind === "mic" ? "Activar micrófono" : `Oír ${label}`) : (kind === "mic" ? "Silenciar micrófono" : `Silenciar ${label}`)}
      aria-pressed={muted}
      aria-label={muted ? `Unmute ${label}` : `Mute ${label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        padding: "4px 8px",
        borderRadius: 6,
        border: muted ? "1px solid #e5e5ea" : "1px solid #111827",
        background: muted ? "#fff" : speaking ? "#111827" : "#f3f4f6",
        color: muted ? "#6e6e73" : speaking ? "#fff" : "#111827",
        cursor: "pointer",
        fontFamily: FONT,
      }}
    >
      {muted ? <IconOff size={12} /> : <IconOn size={12} />}
      {muted ? `${label} mute` : `${label} on`}
    </button>
  );
}

function TranscriptLine({ role, text, primary }) {
  const isUser = role === "user";
  const isKernel = role === "kernel";
  return (
    <div
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        background: isUser ? primary : isKernel ? "#111827" : "#f3f4f6",
        color: isUser || isKernel ? "#fff" : "#1d1d1f",
        borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
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

function RealtimeVoicePanel({
  calcState,
  onAction,
  onSwitchToText,
  skinTokens,
  PRIMARY,
  devMode,
  authHeader,
  voiceMode,
  realtimeModel,
  onPhase,
  appendTurn = null,
  conversationId = null,
  messages = [],
}) {
  const [voiceError, setVoiceError] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState(() => {
    try {
      return localStorage.getItem("bmc.voice.agentId") || "panelin";
    } catch {
      return "panelin";
    }
  });
  const [kernelOn, setKernelOn] = useState(true);
  const [kernelMode, setKernelMode] = useState("observe");
  const [provisionBusy, setProvisionBusy] = useState(false);
  const [agentMuted, setAgentMuted] = useState(false);
  const [kernelMuted, setKernelMuted] = useState(true);
  const [kernelHailing, setKernelHailing] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const transcriptEndRef = useRef(null);
  const transcriptPaneRef = useRef(null);
  const stickBottomRef = useRef(true);
  const assistantBufRef = useRef("");
  const lastWakeAtRef = useRef(0);
  const kernelFeedRef = useRef(null);
  const kernelSendRef = useRef(null);
  const agentUpdateRef = useRef(null);
  const agentIdRef = useRef(agentId);
  agentIdRef.current = agentId;

  const handleError = useCallback((msg) => setVoiceError(msg), []);

  const refreshAgents = useCallback(async () => {
    try {
      const data = await kernelFetch("/api/kernel/agents", { authHeader });
      setAgents(data.agents || []);
      if (data.mode) setKernelMode(data.mode);
      const ids = (data.agents || []).map((a) => a.agent_id);
      let saved = null;
      try {
        saved = localStorage.getItem("bmc.voice.agentId");
      } catch {
        saved = null;
      }
      if (saved && ids.includes(saved)) setAgentId(saved);
      else if (data.activeAgentId && ids.includes(data.activeAgentId)) setAgentId(data.activeAgentId);
    } catch {
      /* store may 401 in anonymous preview — keep defaults */
    }
  }, [authHeader]);

  useEffect(() => {
    refreshAgents();
  }, [refreshAgents]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await kernelFetch("/api/kernel/conversation?limit=40", { authHeader });
        if (cancelled) return;
        const mapped = (data.turns || []).map((t) => ({
          role:
            t.role === "kernel" || t.speaker === "kernel"
              ? "kernel"
              : t.role === "operator"
                ? "user"
                : "assistant",
          text: t.text,
          at: Date.parse(t.timestamp) || Date.now(),
        }));
        if (mapped.length) setTranscript(mapped);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHeader]);

  const onTranscriptDelta = useCallback((evt) => {
    if (evt?.role === "user" && evt.transcript) {
      const text = String(evt.transcript);
      if (isNoiseUtterance(text)) return;
      if (assistantBufRef.current) {
        const prior = assistantBufRef.current;
        ingestTurn({
          authHeader,
          speaker: `agent:${agentIdRef.current}`,
          role: "other_agent",
          text: prior,
          addressed_to: "room",
        });
        kernelSendRef.current?.({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: `[agent:${agentIdRef.current}] ${prior}` }],
          },
        });
      }
      assistantBufRef.current = "";
      if (KERNEL_WAKE_RE.test(text)) {
        lastWakeAtRef.current = Date.now();
        setKernelHailing(true);
      }
      setTranscript((prev) => coalesceUserTranscript(prev, text));
      appendTurn?.({ role: "user", content: text, source: "voice" });
      ingestTurn({
        authHeader,
        speaker: "operator",
        role: "operator",
        text,
        addressed_to: addressedToFromText(text),
      });
      return;
    }
    if (evt?.role === "assistant" && evt.delta) {
      assistantBufRef.current += evt.delta;
      const text = assistantBufRef.current;
      setTranscript((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          next[next.length - 1] = { ...last, text };
          return next;
        }
        next.push({ role: "assistant", text });
        return next;
      });
      appendTurn?.({ role: "assistant", content: text, source: "voice" });
    }
  }, [authHeader, appendTurn]);

  const onKernelTranscript = useCallback((evt) => {
    if (evt?.role === "assistant" && evt.delta) {
      setTranscript((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "kernel") {
          next[next.length - 1] = { ...last, text: (last.text || "") + evt.delta };
          return next;
        }
        next.push({ role: "kernel", text: evt.delta });
        return next;
      });
    }
  }, []);

  const reloadAgentPlaybook = useCallback(async (id) => {
    try {
      const data = await kernelFetch(`/api/kernel/reload/${id}`, {
        method: "POST",
        authHeader,
        body: { calcState: calcState || {} },
      });
      if (data.instructions) agentUpdateRef.current?.(data.instructions);
    } catch {
      /* ignore */
    }
  }, [authHeader, calcState]);

  const {
    status,
    isSpeaking,
    isListening,
    vuLevel,
    start,
    stop,
    updateInstructions,
  } = useVoiceSession({
    onAction,
    onTranscriptDelta,
    onError: handleError,
    onInputAudio: (b64) => kernelFeedRef.current?.(b64),
    devMode,
    authHeader,
    realtimeModel: realtimeModel || null,
    voiceProvider: "grok",
    aiProvider: "grok",
    agentId,
    kernelRole: "agent",
    playOutput: !agentMuted,
    micMuted,
    historyMessages: messages,
    conversationId,
  });

  agentUpdateRef.current = updateInstructions;

  const {
    status: kernelStatus,
    isSpeaking: kernelSpeaking,
    start: startKernel,
    stop: stopKernel,
    feedAudio: feedKernel,
    sendEvent: sendKernelEvent,
  } = useVoiceSession({
    onAction: undefined,
    onTranscriptDelta: onKernelTranscript,
    onError: handleError,
    onToolResult: (name, result) => {
      if (name === "set_mode" && result?.mode) setKernelMode(result.mode);
      if (name === "apply_playbook_patch" && result?.reload && result?.agent_id) {
        reloadAgentPlaybook(result.agent_id);
      }
    },
    devMode,
    authHeader,
    realtimeModel: realtimeModel || null,
    voiceProvider: "grok",
    aiProvider: "grok",
    agentId,
    kernelRole: "kernel",
    captureMic: false,
    playOutput: kernelOn && !kernelMuted,
    relayKind: "kernel",
    micMuted,
  });

  kernelFeedRef.current = feedKernel;
  kernelSendRef.current = sendKernelEvent;

  useEffect(() => {
    if (!stickBottomRef.current) return;
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    if (!voiceMode) {
      if (status !== "idle") stop();
      if (kernelStatus !== "idle") stopKernel();
    }
  }, [voiceMode, status, stop, kernelStatus, stopKernel]);

  useEffect(() => {
    if (!kernelHailing) return undefined;
    const t = setTimeout(() => setKernelHailing(false), 20_000);
    return () => clearTimeout(t);
  }, [kernelHailing]);

  const hearAgent = useCallback(() => {
    setAgentMuted(false);
    setKernelMuted(true);
    setKernelHailing(false);
  }, []);

  const hearKernel = useCallback(() => {
    setKernelMuted(false);
    setAgentMuted(true);
    setKernelHailing(false);
  }, []);

  const muteAgent = useCallback(() => setAgentMuted(true), []);
  const muteKernel = useCallback(() => setKernelMuted(true), []);

  const handleResetSession = useCallback(async () => {
    if (status === "active" || status === "connecting") {
      stop();
      stopKernel();
    }
    try {
      await kernelFetch("/api/kernel/reset", { method: "POST", authHeader });
    } catch (err) {
      setVoiceError(err.message || "No se pudo reiniciar la sesión");
      return;
    }
    setTranscript([]);
    setAgentId("panelin");
    setKernelMuted(true);
    setAgentMuted(false);
    setMicMuted(false);
    setKernelHailing(false);
    try {
      localStorage.setItem("bmc.voice.agentId", "panelin");
    } catch { /* ignore */ }
    refreshAgents();
  }, [authHeader, status, stop, stopKernel, refreshAgents]);

  useEffect(() => {
    const phase =
      status === "connecting" ? "Conectando cerebro Live…"
        : status === "active" && isSpeaking ? "Hablando…"
          : status === "active" && isListening ? "Escuchando…"
            : status === "active" ? "En vivo"
              : status === "error" ? "Error de voz"
                : "Toca para hablar";
    onPhase?.(phase);
  }, [status, isSpeaking, isListening, onPhase]);

  const handleMicButton = useCallback(() => {
    if (status === "idle" || status === "error") {
      setVoiceError(null);
      setMicMuted(false);
      assistantBufRef.current = "";
      postSnapshot({
        authHeader,
        snapshot: {
          route: typeof window !== "undefined" ? window.location.pathname : "",
          openView: "voice",
          kernelMode,
          agentId,
          calcState: calcState
            ? {
                scenario: calcState.scenario,
                listaPrecios: calcState.listaPrecios,
              }
            : null,
        },
      });
      start(calcState);
      if (kernelOn) startKernel(calcState);
    } else {
      stop();
      stopKernel();
    }
  }, [status, start, stop, calcState, kernelOn, startKernel, stopKernel, authHeader, kernelMode, agentId]);

  const handleNewAgent = useCallback(async () => {
    const name = typeof window !== "undefined"
      ? window.prompt("Nombre del nuevo agente:", "Calc Assistant")
      : "";
    if (!name) return;
    const role = typeof window !== "undefined"
      ? window.prompt("Rol (una frase):", "ayudar al operador a usar Calculadora")
      : "";
    if (!role) return;
    setProvisionBusy(true);
    try {
      const created = await kernelFetch("/api/kernel/agents", {
        method: "POST",
        authHeader,
        body: { name, role, language: "es" },
      });
      await refreshAgents();
      if (created.agent_id) {
        setAgentId(created.agent_id);
        try {
          localStorage.setItem("bmc.voice.agentId", created.agent_id);
        } catch { /* ignore */ }
      }
    } catch (err) {
      setVoiceError(err.message || "No se pudo crear el agente");
    } finally {
      setProvisionBusy(false);
    }
  }, [authHeader, refreshAgents]);

  const handleSelectAgent = useCallback(async (id) => {
    setAgentId(id);
    try {
      localStorage.setItem("bmc.voice.agentId", id);
    } catch { /* ignore */ }
    try {
      await kernelFetch(`/api/kernel/agents/${id}/select`, {
        method: "POST",
        authHeader,
      });
    } catch {
      /* ignore */
    }
  }, [authHeader]);

  const MIC_SIZE = 80;
  const isActive = status === "active";
  const isConnecting = status === "connecting";
  const micBg = isActive
    ? micMuted
      ? "#6b7280"
      : isSpeaking
        ? "#ef4444"
        : isListening
          ? PRIMARY
          : "#6b7280"
    : PRIMARY;
  const statusLabel =
    status === "connecting" ? "Conectando cerebro Live…"
      : status === "error" ? (voiceError || "Error de voz")
        : isActive
          ? (micMuted
            ? "Mic mute — no entra ruido"
            : isSpeaking ? "Hablando…" : isListening ? "Escuchando…" : "En vivo — hablá")
          : "Toca para hablar con Panelin";

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
      <div
        style={{
          flexShrink: 0,
          padding: "10px 12px 8px",
          borderBottom: "1px solid #e5e5ea",
          background: skinTokens?.drawerBg || "#fff",
        }}
      >
        <p
          style={{
            color: "#6e6e73",
            fontSize: 11,
            textAlign: "center",
            margin: "0 0 8px",
            lineHeight: 1.35,
          }}
        >
          Cerebro <strong>{agents.find((a) => a.agent_id === agentId)?.name || "Panelin BMC"}</strong>
          {" "}· Grok Live
          {kernelOn ? ` · Kernel ${kernelMode}` : ""}
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <select
            value={agentId}
            onChange={(e) => handleSelectAgent(e.target.value)}
            disabled={isActive || isConnecting}
            aria-label="Agente supervisado"
            style={{
              fontSize: 11,
              padding: "4px 6px",
              borderRadius: 6,
              border: "1px solid #e5e5ea",
              fontFamily: FONT,
              maxWidth: 160,
            }}
          >
            {(agents.length ? agents : [{ agent_id: "panelin", name: "Panelin BMC" }]).map((a) => (
              <option key={a.agent_id} value={a.agent_id}>
                {a.name || a.agent_id}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleNewAgent}
            disabled={provisionBusy || isActive}
            style={{
              fontSize: 11,
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid #e5e5ea",
              background: "#fff",
              cursor: provisionBusy ? "default" : "pointer",
              fontFamily: FONT,
            }}
          >
            {provisionBusy ? "Creando…" : "Nuevo agente"}
          </button>
          <button
            type="button"
            onClick={handleResetSession}
            disabled={provisionBusy}
            title="Borra el log de esta sesión y vuelve a Panelin"
            style={{
              fontSize: 11,
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid #e5e5ea",
              background: "#fff",
              cursor: "pointer",
              fontFamily: FONT,
            }}
          >
            Empezar de nuevo
          </button>
          <label
            style={{
              fontSize: 11,
              color: "#6e6e73",
              display: "flex",
              alignItems: "center",
              gap: 4,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={kernelOn}
              disabled={isActive}
              onChange={(e) => setKernelOn(e.target.checked)}
            />
            Kernel conectado
          </label>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <MuteChip
            label={agents.find((a) => a.agent_id === agentId)?.name || "Agente"}
            muted={agentMuted}
            speaking={isSpeaking && !agentMuted}
            onMute={muteAgent}
            onUnmute={hearAgent}
          />
          {kernelOn && (
            <MuteChip
              label="Kernel"
              muted={kernelMuted}
              speaking={kernelSpeaking && !kernelMuted}
              onMute={muteKernel}
              onUnmute={hearKernel}
            />
          )}
          {kernelHailing && kernelMuted && (
            <span style={{ fontSize: 11, color: "#b45309", fontWeight: 600 }}>
              Kernel pidió la palabra — tocá Kernel mute
            </span>
          )}
          <span
            style={{
              fontSize: 10,
              color: kernelStatus === "active" ? "#059669" : "#9ca3af",
            }}
          >
            {kernelOn
              ? (kernelStatus === "active"
                ? (kernelMuted ? "Kernel oye (mute)" : kernelSpeaking ? "Kernel habla" : "Kernel on")
                : kernelStatus === "connecting" ? "Kernel…" : "Kernel off")
              : ""}
          </span>
        </div>
      </div>
      <div
        ref={transcriptPaneRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 56;
        }}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minHeight: 0,
        }}
      >
        {transcript.length === 0 && (
          <p style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", marginTop: 16 }}>
            Sesión limpia. Hablá cuando quieras.
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
            aria-label={isActive ? "Detener voz" : "Iniciar voz Live"}
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
            {isActive || isConnecting ? <PhoneOff size={28} /> : <Mic size={28} />}
          </button>
        </div>
        {isActive && (
          <MuteChip
            label="Mic"
            kind="mic"
            muted={micMuted}
            speaking={false}
            onMute={() => setMicMuted(true)}
            onUnmute={() => setMicMuted(false)}
          />
        )}
        <button
          type="button"
          onClick={() => { stop(); stopKernel(); onSwitchToText?.(); }}
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

function HandsFreeEmbeddedPanel({
  calcState,
  onAction,
  onSwitchToText,
  skinTokens,
  PRIMARY,
  voiceMode,
  send,
  messages,
  aiProvider,
  aiModel,
  realtimeModel,
}) {
  const [voiceError, setVoiceError] = useState(null);
  const transcriptEndRef = useRef(null);
  const [storedPick, setStoredPick] = useState(() => loadPanelinAiSelection());
  useEffect(() => {
    const sync = () => setStoredPick(loadPanelinAiSelection());
    window.addEventListener(PANELIN_AI_EVENT, sync);
    window.addEventListener("storage", sync);
    sync();
    return () => {
      window.removeEventListener(PANELIN_AI_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const effective = resolveEffectiveAiPick(
    aiProvider && aiProvider !== "auto" ? aiProvider : storedPick.aiProvider,
    aiProvider && aiProvider !== "auto" ? aiModel : storedPick.aiModel,
  );
  const pick =
    aiProvider && aiProvider !== "auto"
      ? { aiProvider, aiModel: aiModel || "" }
      : effective;
  const chatModelLabel = formatAiChatModelLabel(pick.aiProvider, pick.aiModel);

  const handleError = useCallback((msg) => setVoiceError(msg), []);

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
        <p
          style={{
            color: "#6e6e73",
            fontSize: 11,
            textAlign: "center",
            margin: "0 0 8px",
            lineHeight: 1.35,
          }}
          title={realtimeModel || undefined}
        >
          Hablá con Panelin por acá (chat). Motor: <strong>{chatModelLabel}</strong>
          {pick.aiProvider === "auto"
            ? " · Elegí Grok (u otro) en el selector del header para fijar el motor"
            : " · Decí «Panelin» y pedí lo que necesités"}
        </p>
        {transcript.length === 0 && (
          <p style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", marginTop: 16 }}>
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

function UnsupportedVoicePanel({ onSwitchToText, PRIMARY }) {
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
  aiProvider = "auto",
  aiModel = "",
  realtimeModel = "",
  onPhase,
  appendTurn = null,
  conversationId = null,
}) {
  const PRIMARY = skinTokens?.primary || "#0071e3";
  if (isGrokRealtimeSupported()) {
    return (
      <RealtimeVoicePanel
        calcState={calcState}
        onAction={onAction}
        onSwitchToText={onSwitchToText}
        skinTokens={skinTokens}
        PRIMARY={PRIMARY}
        devMode={devMode}
        authHeader={authHeader}
        voiceMode={voiceMode}
        realtimeModel={realtimeModel}
        onPhase={onPhase}
        appendTurn={appendTurn}
        conversationId={conversationId}
        messages={messages}
      />
    );
  }
  if (canUseWhisperVoice()) {
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
  if (!isHandsFreeSupported()) {
    return <UnsupportedVoicePanel onSwitchToText={onSwitchToText} PRIMARY={PRIMARY} />;
  }
  return (
    <HandsFreeEmbeddedPanel
      calcState={calcState}
      onAction={onAction}
      onSwitchToText={onSwitchToText}
      skinTokens={skinTokens}
      PRIMARY={PRIMARY}
      voiceMode={voiceMode}
      send={send}
      messages={messages}
      aiProvider={aiProvider}
      aiModel={aiModel}
      realtimeModel={realtimeModel}
    />
  );
}
