import React, { useEffect, useState } from "react";
import { useOmniMessages, useOmniSuggestions } from "../../../../hooks/useOmniConversations.js";

export default function OmniThreadPanel({ token, conversationId, onSent }) {
  const { conversation, messages, loading, error, sendReply, markRead } = useOmniMessages(
    token,
    conversationId,
  );
  const { suggestions, accept, reject } = useOmniSuggestions(token, conversationId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (conversationId) markRead().catch(() => {});
  }, [conversationId, markRead]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendReply(text);
      setDraft("");
      onSent?.();
    } finally {
      setSending(false);
    }
  };

  if (!conversationId) {
    return (
      <div style={styles.empty}>
        <p>Seleccioná una conversación del inbox</p>
      </div>
    );
  }

  if (loading && !messages.length) {
    return <div style={styles.empty}>Cargando mensajes…</div>;
  }

  if (error) {
    return <div style={styles.error}>{error}</div>;
  }

  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>
          {conversation?.contact_name || conversation?.subject || "Conversación"}
        </h3>
        <span style={styles.badge}>{conversation?.channel}</span>
      </header>

      <div style={styles.messages}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              ...styles.bubble,
              alignSelf: m.sender === "customer" ? "flex-start" : "flex-end",
              background: m.sender === "customer" ? "#f3f4f6" : "#dbeafe",
            }}
          >
            <div style={styles.sender}>{m.sender}</div>
            <div>{m.body}</div>
          </div>
        ))}
      </div>

      {suggestions[0] && (
        <div style={styles.suggestion}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: 4 }}>Sugerencia IA</div>
          <p style={{ margin: "0 0 8px", fontSize: "0.875rem" }}>{suggestions[0].body}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setDraft(suggestions[0].body)}>
              Usar
            </button>
            <button type="button" onClick={() => accept(suggestions[0].id)}>
              Aceptar
            </button>
            <button type="button" onClick={() => reject(suggestions[0].id)}>
              Rechazar
            </button>
          </div>
        </div>
      )}

      <div style={styles.composer}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Escribí una respuesta…"
          style={styles.textarea}
        />
        <button type="button" disabled={sending || !draft.trim()} onClick={handleSend}>
          {sending ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrap: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  empty: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" },
  error: { padding: "1rem", color: "#b91c1c" },
  header: { display: "flex", alignItems: "center", gap: 8, padding: "0.75rem 1rem", borderBottom: "1px solid #e5e7eb" },
  badge: { fontSize: "0.75rem", background: "#e5e7eb", padding: "2px 8px", borderRadius: 99 },
  messages: { flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: 8 },
  bubble: { maxWidth: "80%", padding: "0.5rem 0.75rem", borderRadius: 8, fontSize: "0.875rem" },
  sender: { fontSize: "0.6875rem", color: "#6b7280", marginBottom: 2, textTransform: "uppercase" },
  suggestion: { margin: "0 1rem", padding: "0.75rem", background: "#fef3c7", borderRadius: 8, border: "1px solid #fcd34d" },
  composer: { padding: "1rem", borderTop: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: 8 },
  textarea: { width: "100%", resize: "vertical", padding: "0.5rem", borderRadius: 6, border: "1px solid #d1d5db" },
};
