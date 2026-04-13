import { useState, useRef, useEffect, useCallback } from "react";
import { X, RotateCcw, Send, Mic, Volume2, VolumeX, Square } from "lucide-react";
import PanelinDevPanel from "./PanelinDevPanel.jsx";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif";
const BRAND = "#1a3a5c";
const PRIMARY = "#0071e3";
const SURFACE = "#f5f5f7";
const BORDER = "#e5e5ea";
const TEXT = "#1d1d1f";
const SUBTEXT = "#6e6e73";
const VIDEO_SRC = `${typeof import.meta !== "undefined" ? import.meta.env?.BASE_URL ?? "/" : "/"}video/panelin-lista-loop.mp4`;

const ACTION_LABELS = {
  setScenario:   (p) => `Escenario → ${p}`,
  setLP:         (p) => `Lista → ${p === "web" ? "Precio web" : "Precio venta"}`,
  setTecho:      (p) => `Techo → ${Object.entries(p).filter(([,v]) => v != null && v !== "").map(([k,v]) => {
    if (k === "borders" && typeof v === "object" && !Array.isArray(v)) {
      const sides = Object.entries(v).filter(([,s]) => s && s !== "none").map(([side, style]) => `${side}:${style}`);
      return `bordes=[${sides.join(", ")}]`;
    }
    if (Array.isArray(v)) return `${k}=${v.map(z=>`${z.largo}×${z.ancho}m`).join(", ")}`;
    return `${k}=${v}`;
  }).join(", ")}`,
  setPared:      (p) => `Pared → ${Object.entries(p).filter(([,v]) => v != null && v !== "").map(([k,v]) => `${k}=${v}`).join(", ")}`,
  setCamara:     (p) => `Cámara → ${p.largo_int}×${p.ancho_int}×${p.alto_int}m`,
  setFlete:      (p) => `Flete → USD ${p}`,
  setProyecto:   (p) => `Proyecto → ${Object.entries(p).filter(([,v]) => v).map(([k,v]) => `${k}=${v}`).join(", ")}`,
  setWizardStep: (p) => `Paso → ${p}`,
  setTechoZonas: (p) => `Zonas techo → ${Array.isArray(p) ? p.map((z,i)=>`Zona ${i+1}: ${z.largo}×${z.ancho}m`).join(", ") : p}`,
  advanceWizard: ()  => `Avanzó al siguiente paso`,
};

// Inject dot-pulse keyframe once
if (typeof document !== "undefined" && !document.getElementById("panelin-chat-kf")) {
  const s = document.createElement("style");
  s.id = "panelin-chat-kf";
  s.textContent = `
    @keyframes panelin-pulse { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }
    .panelin-dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:${SUBTEXT}; margin:0 2px; animation:panelin-pulse 1.2s infinite ease-in-out; }
    .panelin-dot:nth-child(2){ animation-delay:0.2s; }
    .panelin-dot:nth-child(3){ animation-delay:0.4s; }
    @keyframes panelin-mic-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,59,48,0.4)} 50%{box-shadow:0 0 0 8px rgba(255,59,48,0)} }
  `;
  document.head.appendChild(s);
}

function Avatar({ size = 28 }) {
  return (
    <video
      src={VIDEO_SRC}
      autoPlay
      muted
      loop
      playsInline
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
        background: BRAND,
      }}
    />
  );
}

const PRIVACY_KEY = "panelin-chat-notice-seen";

/**
 * Panelin AI chat drawer.
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   messages: Array<{id:string, role:string, content:string, pending?:boolean}>,
 *   isStreaming: boolean,
 *   send: (text:string) => void,
 *   clear: () => void,
 *   error: string|null,
 *   devMode?: boolean,
 *   onToggleDevMode?: () => void,
 *   devMeta?: object,
 *   trainingEntries?: Array<object>,
 *   trainingStats?: object,
 *   promptPreview?: string,
 *   promptSections?: object,
 *   onSaveCorrection?: (payload: object) => Promise<void>,
 *   onReloadTrainingKB?: () => Promise<void>,
 *   onReloadPromptPreview?: () => Promise<void>,
 *   onReloadPromptSections?: () => Promise<void>,
 *   onSavePromptSection?: (payload: object) => Promise<void>,
 *   onVerifyCalculation?: (text: string) => Promise<void>,
 * }} props
 */
export default function PanelinChatPanel({
  isOpen,
  onClose,
  messages,
  isStreaming,
  send,
  stop,
  retry,
  clear,
  error,
  devMode = false,
  onToggleDevMode,
  devMeta,
  trainingEntries,
  trainingStats,
  promptPreview,
  promptSections,
  onSaveCorrection,
  onReloadTrainingKB,
  onReloadPromptPreview,
  onReloadPromptSections,
  onSavePromptSection,
  onVerifyCalculation,
}) {
  const [input, setInput] = useState("");
  const [correctingMsgId, setCorrectingMsgId] = useState(null);
  const [correctionText, setCorrectionText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [privacyNoticeSeen, setPrivacyNoticeSeen] = useState(() => {
    try {
      return typeof localStorage !== "undefined" && !!localStorage.getItem(PRIVACY_KEY);
    } catch {
      return false;
    }
  });
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const openerRef = useRef(null);
  const recognitionRef = useRef(null);
  const prevMsgCountRef = useRef(0);

  // 2.5 — Smart auto-scroll: only scroll if near bottom
  useEffect(() => {
    if (isOpen && isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (isOpen && !isNearBottom) {
      setShowScrollBtn(true);
    }
  }, [messages, isOpen, isNearBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setIsNearBottom(nearBottom);
    if (nearBottom) setShowScrollBtn(false);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollBtn(false);
    setIsNearBottom(true);
  }, []);

  // Focus input when drawer opens; restore focus on close
  useEffect(() => {
    if (isOpen) {
      openerRef.current = document.activeElement;
      setTimeout(() => textareaRef.current?.focus(), 300);
    } else {
      openerRef.current?.focus();
    }
  }, [isOpen]);

  // 2.3 — Escape key closes drawer
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // 2.2 — Focus trap: keep Tab/Shift+Tab inside drawer
  const drawerRef = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    const el = drawerRef.current;
    if (!el) return;
    const handler = (e) => {
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        el.querySelectorAll('button:not([disabled]),textarea:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')
      ).filter((n) => n.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [isOpen]);

  // TTS: read new assistant messages aloud when enabled
  useEffect(() => {
    if (!ttsEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
    const count = messages.length;
    if (count > prevMsgCountRef.current) {
      const last = messages[count - 1];
      if (last && last.role === "assistant" && last.content && !last.pending) {
        const speak = () => {
          const utterance = new SpeechSynthesisUtterance(last.content);
          utterance.lang = "es-UY";
          utterance.rate = 1.0;
          // 4.4 — getVoices() may be empty on first call; resolve after voiceschanged
          const voices = window.speechSynthesis.getVoices();
          const esVoice = voices.find((v) => v.lang.startsWith("es"));
          if (esVoice) utterance.voice = esVoice;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
        };
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          speak();
        } else {
          window.speechSynthesis.addEventListener("voiceschanged", speak, { once: true });
        }
      }
    }
    prevMsgCountRef.current = count;
  }, [messages, ttsEnabled]);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  const speakMessage = useCallback((text) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const speak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "es-UY";
      utterance.rate = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const esVoice = voices.find((v) => v.lang.startsWith("es"));
      if (esVoice) utterance.voice = esVoice;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    };
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) speak();
    else window.speechSynthesis.addEventListener("voiceschanged", speak, { once: true });
  }, []);

  const toggleListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz. Usá Chrome o Edge.");
      return;
    }
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "es-UY";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    let finalTranscript = "";
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t;
        } else {
          interim += t;
        }
      }
      setInput(finalTranscript || interim);
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      if (finalTranscript) {
        setInput(finalTranscript);
      }
    };
    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    send(text);
  }, [input, isStreaming, send]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Auto-grow textarea
  const handleInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 299,
          background: "rgba(0,0,0,0.35)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 200ms ease",
        }}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-label="Panelin Asistente BMC"
        aria-modal="true"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100dvh",
          zIndex: 300,
          width: "100%",
          maxWidth: 380,
          background: "#fff",
          boxShadow: "-4px 0 32px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 280ms cubic-bezier(0.4,0,0.2,1)",
          fontFamily: FONT,
          willChange: "transform",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            background: BRAND,
            color: "#fff",
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <Avatar size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Panelin</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>
              Asistente BMC Uruguay{devMode ? " · Developer Mode" : ""}
            </div>
          </div>
          {devMode && onToggleDevMode && (
            <button
              onClick={onToggleDevMode}
              title="Developer mode"
              style={{
                ...ghostBtn,
                border: "1px solid rgba(255,255,255,0.35)",
                borderRadius: 999,
                padding: "4px 8px",
                fontSize: 11,
                color: "#fff",
                background: devMode ? "rgba(255,255,255,0.24)" : "transparent",
              }}
            >
              DEV
            </button>
          )}
          <button
            onClick={() => setTtsEnabled((v) => !v)}
            title={ttsEnabled ? "Desactivar lectura en voz alta" : "Activar lectura en voz alta"}
            style={{
              ...ghostBtn,
              background: ttsEnabled ? "rgba(255,255,255,0.24)" : "transparent",
            }}
            aria-label={ttsEnabled ? "Desactivar lectura en voz alta" : "Activar lectura en voz alta"}
          >
            {ttsEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          {isStreaming && stop && (
            <button
              type="button"
              onClick={() => stop()}
              title="Detener respuesta"
              style={{
                ...ghostBtn,
                background: "rgba(255,255,255,0.2)",
              }}
              aria-label="Detener respuesta"
            >
              <Square size={14} fill="currentColor" />
            </button>
          )}
          <button
            onClick={clear}
            title="Nueva conversación"
            style={ghostBtn}
            aria-label="Nueva conversación"
          >
            <RotateCcw size={15} />
          </button>
          <button
            onClick={onClose}
            title="Cerrar"
            style={ghostBtn}
            aria-label="Cerrar panel"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Messages ── */}
        <div
          ref={scrollContainerRef}
          role="log"
          aria-label="Conversación"
          aria-live="polite"
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            position: "relative",
          }}
        >
          {/* 3.2 — Privacy first-run notice */}
          {!privacyNoticeSeen && (
            <div
              style={{
                fontSize: 11,
                color: SUBTEXT,
                textAlign: "center",
                padding: "6px 12px",
                background: SURFACE,
                borderRadius: 8,
                lineHeight: 1.5,
              }}
            >
              Tu historial se guarda en este navegador. Podés borrarlo con{" "}
              <strong>Nueva conversación</strong>.{" "}
              <button
                onClick={() => {
                  setPrivacyNoticeSeen(true);
                  try { localStorage.setItem(PRIVACY_KEY, "1"); } catch { /* ignore */ }
                }}
                style={{ background: "none", border: "none", color: PRIMARY, cursor: "pointer", fontFamily: FONT, fontSize: 11, padding: 0 }}
              >
                Entendido
              </button>
            </div>
          )}

          {isEmpty && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                color: SUBTEXT,
                textAlign: "center",
                padding: "40px 20px",
              }}
            >
              <Avatar size={56} />
              <div style={{ fontWeight: 600, fontSize: 15, color: TEXT }}>
                ¡Hola! Soy Panelin
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                Te ayudo a cotizar paneles para tu obra. Contame qué necesitás.
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  justifyContent: "center",
                  marginTop: 4,
                }}
              >
                {[
                  "Quiero cotizar un techo",
                  "¿Qué panel me recomendás?",
                  "Necesito una fachada",
                ].map((hint) => (
                  <button
                    key={hint}
                    onClick={() => send(hint)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 20,
                      border: `1px solid ${BORDER}`,
                      background: SURFACE,
                      color: TEXT,
                      fontSize: 12,
                      cursor: "pointer",
                      fontFamily: FONT,
                    }}
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, msgIdx) => {
            const isUser = msg.role === "user";
            const prevUserMsg = !isUser
              ? [...messages].slice(0, msgIdx).reverse().find((m) => m.role === "user")
              : null;
            const prevQuestion = prevUserMsg?.content ?? "";
            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  flexDirection: isUser ? "row-reverse" : "row",
                  alignItems: "flex-end",
                  gap: 8,
                }}
              >
                {!isUser && <Avatar size={24} />}
                <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", gap: 4 }}>
                  <div
                    style={{
                      padding: "10px 13px",
                      borderRadius: isUser
                        ? "16px 16px 4px 16px"
                        : "16px 16px 16px 4px",
                      background: isUser ? PRIMARY : SURFACE,
                      color: isUser ? "#fff" : TEXT,
                      fontSize: 14,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {msg.pending && !msg.content ? (
                      <span>
                        <span className="panelin-dot" />
                        <span className="panelin-dot" />
                        <span className="panelin-dot" />
                      </span>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {/* Action feedback badges */}
                  {!isUser && msg.actions?.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 2 }}>
                      {msg.actions.map((a, i) => {
                        const labelFn = ACTION_LABELS[a.type];
                        const label = labelFn ? labelFn(a.payload) : a.type;
                        return (
                          <div key={i} style={{ fontSize: 11, color: "#34c759", display: "flex", alignItems: "center", gap: 3, fontFamily: FONT }}>
                            <span>✓</span><span>{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* TTS play button for assistant messages */}
                  {!isUser && msg.content && !msg.pending && (
                    <button
                      onClick={() => speakMessage(msg.content)}
                      title="Escuchar respuesta"
                      style={{
                        background: "none",
                        border: "none",
                        color: SUBTEXT,
                        cursor: "pointer",
                        padding: "2px 4px",
                        borderRadius: 4,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        fontSize: 11,
                        fontFamily: FONT,
                        alignSelf: "flex-start",
                      }}
                      aria-label="Escuchar respuesta"
                    >
                      <Volume2 size={12} /> Escuchar
                    </button>
                  )}
                  {/* Dev training buttons — only in devMode for assistant messages with content */}
                  {devMode && !isUser && msg.content && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 2 }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={() => {
                            onSaveCorrection?.({ category: "conversational", question: prevQuestion, goodAnswer: msg.content, context: "rated-good" });
                          }}
                          style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, border: `1px solid ${BORDER}`, background: SURFACE, color: "#34c759", cursor: "pointer", fontFamily: FONT }}
                        >
                          ✓ Good
                        </button>
                        <button
                          onClick={() => {
                            setCorrectingMsgId(msg.id);
                            setCorrectionText("");
                          }}
                          style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, border: `1px solid ${BORDER}`, background: SURFACE, color: SUBTEXT, cursor: "pointer", fontFamily: FONT }}
                        >
                          ✗ Correct
                        </button>
                      </div>
                      {correctingMsgId === msg.id && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <textarea
                            value={correctionText}
                            onChange={(e) => setCorrectionText(e.target.value)}
                            placeholder="Respuesta correcta…"
                            rows={3}
                            style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "#fff", color: TEXT, fontFamily: FONT, resize: "vertical" }}
                          />
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              onClick={() => {
                                if (!correctionText.trim()) return;
                                onSaveCorrection?.({ category: "conversational", question: prevQuestion, badAnswer: msg.content, goodAnswer: correctionText.trim(), context: "" });
                                setCorrectingMsgId(null);
                                setCorrectionText("");
                              }}
                              style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, border: "none", background: PRIMARY, color: "#fff", cursor: "pointer", fontFamily: FONT }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => { setCorrectingMsgId(null); setCorrectionText(""); }}
                              style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, border: `1px solid ${BORDER}`, background: SURFACE, color: SUBTEXT, cursor: "pointer", fontFamily: FONT }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Error */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                fontSize: 12,
                color: "#ff3b30",
                textAlign: "center",
                padding: "4px 0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{error}</span>
              {retry && (
                <button
                  type="button"
                  onClick={() => retry()}
                  style={{
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: `1px solid ${BORDER}`,
                    background: SURFACE,
                    color: PRIMARY,
                    cursor: "pointer",
                    fontFamily: FONT,
                  }}
                >
                  Reintentar
                </button>
              )}
            </div>
          )}

          {showScrollBtn && (
            <button
              type="button"
              onClick={scrollToBottom}
              style={{
                position: "sticky",
                bottom: 8,
                alignSelf: "center",
                fontSize: 11,
                padding: "6px 12px",
                borderRadius: 999,
                border: `1px solid ${BORDER}`,
                background: "#fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                color: PRIMARY,
                cursor: "pointer",
                fontFamily: FONT,
                zIndex: 2,
              }}
            >
              Ver últimos mensajes ↓
            </button>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input ── */}
        <div
          style={{
            borderTop: `1px solid ${BORDER}`,
            padding: "10px 12px",
            paddingBottom: "max(10px, env(safe-area-inset-bottom, 0px))",
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            background: "#fff",
            flexShrink: 0,
          }}
        >
          <button
            onClick={toggleListening}
            title={isListening ? "Escuchando..." : "Hablar"}
            style={{
              ...iconBtn,
              background: isListening ? "#ff3b30" : "transparent",
              color: isListening ? "#fff" : SUBTEXT,
              animation: isListening ? "panelin-mic-pulse 1.5s infinite" : "none",
            }}
            aria-label={isListening ? "Detener grabación" : "Hablar"}
          >
            <Mic size={18} />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Escribí tu consulta..."
            rows={1}
            disabled={isStreaming}
            aria-disabled={isStreaming}
            aria-label="Mensaje para Panelin"
            style={{
              flex: 1,
              resize: "none",
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              padding: "8px 12px",
              fontSize: 14,
              fontFamily: FONT,
              lineHeight: 1.4,
              outline: "none",
              background: SURFACE,
              color: TEXT,
              minHeight: 36,
              maxHeight: 100,
              overflowY: "auto",
            }}
          />
          {isStreaming ? (
            <button
              onClick={stop}
              style={{ ...iconBtn, background: "#ff3b30", color: "#fff" }}
              aria-label="Detener generación"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              aria-disabled={!input.trim()}
              style={{
                ...iconBtn,
                background: input.trim() ? PRIMARY : BORDER,
                color: input.trim() ? "#fff" : SUBTEXT,
                cursor: input.trim() ? "pointer" : "not-allowed",
              }}
              aria-label="Enviar mensaje"
            >
              <Send size={16} />
            </button>
          )}
        </div>

        {devMode && (
          <PanelinDevPanel
            messages={messages}
            trainingEntries={trainingEntries}
            trainingStats={trainingStats}
            devMeta={devMeta}
            promptPreview={promptPreview}
            promptSections={promptSections}
            onSaveCorrection={onSaveCorrection}
            onReloadTrainingKB={onReloadTrainingKB}
            onReloadPromptPreview={onReloadPromptPreview}
            onReloadPromptSections={onReloadPromptSections}
            onSavePromptSection={onSavePromptSection}
            onVerifyCalculation={onVerifyCalculation}
          />
        )}
      </div>
    </>
  );
}

const ghostBtn = {
  background: "none",
  border: "none",
  color: "rgba(255,255,255,0.8)",
  cursor: "pointer",
  padding: 6,
  borderRadius: 6,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const iconBtn = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
  transition: "background 150ms ease",
};
