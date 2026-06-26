/**
 * EmailAgentPanel.jsx — right-side "Asistente de Correos BMC" chat panel.
 *
 * A second, specialized agent docked in the calculadora, separate from Panelin.
 * Talks to POST /api/email-agent/chat (SSE). Operator-only: the backend route is
 * gated by canales:write, so this panel is shown only behind VITE_FEATURE_EMAIL_AGENT
 * and for authenticated operators.
 *
 * Self-contained (does NOT reuse the Panelin useChat hook, which is hardwired to
 * /api/agent/chat) — keeps the canonical calculator component untouched.
 */

import { useState, useRef, useCallback } from "react";

const FEATURE_ON = import.meta.env.VITE_FEATURE_EMAIL_AGENT === "true";

function authHeaders() {
  const headers = { "Content-Type": "application/json" };
  try {
    const tok =
      (typeof localStorage !== "undefined" &&
        (localStorage.getItem("bmc.authToken") || localStorage.getItem("authToken"))) ||
      "";
    if (tok) headers.Authorization = `Bearer ${tok}`;
  } catch {
    /* no-op */
  }
  return headers;
}

export default function EmailAgentPanel({ apiBase = "" }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [toolLog, setToolLog] = useState([]);
  const abortRef = useRef(null);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setStreaming(true);
    setToolLog([]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let assistant = "";
    try {
      const res = await fetch(`${apiBase}/api/email-agent/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ messages: next }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        setMessages((m) => [...m, { role: "assistant", content: `Error ${res.status}: no se pudo conectar al asistente de correos.` }]);
        setStreaming(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() || "";
        for (const block of lines) {
          const line = block.replace(/^data: ?/, "").trim();
          if (!line || line === "[DONE]") continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === "text" && evt.text) {
              assistant += evt.text;
              setMessages((m) => {
                const copy = [...m];
                if (copy[copy.length - 1]?.role === "assistant") copy[copy.length - 1] = { role: "assistant", content: assistant };
                else copy.push({ role: "assistant", content: assistant });
                return copy;
              });
            } else if (evt.type === "tool_call") {
              setToolLog((t) => [...t, `→ ${evt.name}`]);
            } else if (evt.type === "tool_result") {
              setToolLog((t) => [...t, `  ${evt.ok ? "✓" : "✗"} ${evt.name}`]);
            } else if (evt.type === "warning") {
              setToolLog((t) => [...t, `⚠ ${evt.message || evt.warning}`]);
            } else if (evt.type === "error") {
              setMessages((m) => [...m, { role: "assistant", content: `⚠ ${evt.error}` }]);
            }
          } catch {
            /* ignore partial */
          }
        }
      }
    } catch (e) {
      if (e?.name !== "AbortError") {
        setMessages((m) => [...m, { role: "assistant", content: `Error: ${String(e?.message || e)}` }]);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming, messages, apiBase]);

  if (!FEATURE_ON) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir Asistente de Correos BMC"
          style={{
            position: "fixed", right: 16, bottom: 84, zIndex: 9998,
            background: "#1a1a2e", color: "#fff", border: "1px solid #3a3a5e",
            borderRadius: 999, padding: "10px 16px", cursor: "pointer", fontSize: 14,
          }}
        >
          ✉️ Correos BMC
        </button>
      )}
      {open && (
        <div
          role="dialog"
          aria-label="Asistente de Correos BMC"
          style={{
            position: "fixed", right: 0, top: 0, bottom: 0, width: "min(420px, 100vw)",
            background: "#0f0f1e", color: "#e8e8f0", zIndex: 9999,
            display: "flex", flexDirection: "column", borderLeft: "1px solid #2a2a4a",
            boxShadow: "-8px 0 24px rgba(0,0,0,0.4)",
          }}
        >
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #2a2a4a" }}>
            <strong>✉️ Asistente de Correos BMC</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" style={{ background: "none", border: "none", color: "#aaa", fontSize: 20, cursor: "pointer" }}>×</button>
          </header>

          <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.length === 0 && (
              <p style={{ color: "#888", fontSize: 14 }}>
                Gestioná el buzón compartido por chat: «reportá emails sin responder», «redactá respuesta al #123», «etiquetá como urgente», «extraé el lead». Nunca envío sin tu confirmación.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", background: m.role === "user" ? "#2a2a5a" : "#1a1a2e", borderRadius: 10, padding: "8px 12px", fontSize: 14, whiteSpace: "pre-wrap" }}>
                {m.content}
              </div>
            ))}
            {toolLog.length > 0 && (
              <pre style={{ color: "#7a7aa0", fontSize: 11, margin: 0 }}>{toolLog.join("\n")}</pre>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid #2a2a4a" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Pedile algo sobre los correos…"
              disabled={streaming}
              style={{ flex: 1, background: "#1a1a2e", color: "#fff", border: "1px solid #3a3a5e", borderRadius: 8, padding: "8px 12px", fontSize: 14 }}
            />
            <button type="button" onClick={send} disabled={streaming || !input.trim()} style={{ background: "#4a4af0", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>
              {streaming ? "…" : "Enviar"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
