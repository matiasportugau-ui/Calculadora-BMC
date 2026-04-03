import { useState, useRef, useEffect, useCallback } from "react";
import { X, RotateCcw, Send, Mic } from "lucide-react";

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
  setTecho:      (p) => `Techo → ${Object.entries(p).filter(([,v]) => v != null && v !== "").map(([k,v]) => `${k}=${Array.isArray(v) ? v.map(z=>`${z.largo}×${z.ancho}m`).join(", ") : v}`).join(", ")}`,
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
    @keyframes panelin-action-fade { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(-8px)} }
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

function ActionToast({ text }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: "#34c759",
        fontFamily: FONT,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 0",
        animation: "panelin-action-fade 2s ease forwards",
      }}
    >
      ✓ {text}
    </div>
  );
}

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
 * }} props
 */
export default function PanelinChatPanel({
  isOpen,
  onClose,
  messages,
  isStreaming,
  send,
  clear,
  error,
}) {
  const [input, setInput] = useState("");
  const [actionToast] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [isOpen]);

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
        role="dialog"
        aria-label="Panelin Asistente BMC"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
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
            <div style={{ fontSize: 11, opacity: 0.7 }}>Asistente BMC Uruguay</div>
          </div>
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
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
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

          {messages.map((msg) => {
            const isUser = msg.role === "user";
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
                </div>
              </div>
            );
          })}

          {/* Action toast */}
          {actionToast && <ActionToast text={actionToast} />}

          {/* Error */}
          {error && (
            <div
              style={{
                fontSize: 12,
                color: "#ff3b30",
                textAlign: "center",
                padding: "4px 0",
              }}
            >
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input ── */}
        <div
          style={{
            borderTop: `1px solid ${BORDER}`,
            padding: "10px 12px",
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            background: "#fff",
            flexShrink: 0,
          }}
        >
          <button
            disabled
            title="Micrófono (próximamente)"
            style={{
              ...iconBtn,
              opacity: 0.3,
              cursor: "not-allowed",
            }}
            aria-label="Micrófono (próximamente)"
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
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            style={{
              ...iconBtn,
              background: input.trim() && !isStreaming ? PRIMARY : BORDER,
              color: input.trim() && !isStreaming ? "#fff" : SUBTEXT,
              cursor: input.trim() && !isStreaming ? "pointer" : "not-allowed",
            }}
            aria-label="Enviar mensaje"
          >
            <Send size={16} />
          </button>
        </div>
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
