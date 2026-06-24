import React, { useState } from "react";
import { useOmniConversations } from "../../../../hooks/useOmniConversations.js";
import OmniThreadPanel from "./OmniThreadPanel.jsx";
import OmniContactSidebar from "./OmniContactSidebar.jsx";

export default function OmniInboxPanel({ token }) {
  const [selectedId, setSelectedId] = useState(null);
  const [channelFilter, setChannelFilter] = useState("");
  const { conversations, loading, error, reload } = useOmniConversations(token, {
    channel: channelFilter || undefined,
  });

  const selected = conversations.find((c) => c.id === selectedId) || null;

  return (
    <div>
      <div style={styles.toolbar}>
        <h2 style={{ margin: 0, fontSize: "1.125rem" }}>Omni Inbox</h2>
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          style={styles.select}
        >
          <option value="">Todos los canales</option>
          <option value="wa">WhatsApp</option>
          <option value="ml">MercadoLibre</option>
          <option value="email">Email</option>
        </select>
        <button type="button" onClick={reload}>
          Actualizar
        </button>
      </div>

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      <div style={styles.layout}>
        <div style={styles.list}>
          {loading && <p style={styles.muted}>Cargando…</p>}
          {!loading && conversations.length === 0 && (
            <p style={styles.muted}>Sin conversaciones omni</p>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              style={{
                ...styles.listItem,
                background: selectedId === c.id ? "#eff6ff" : "#fff",
              }}
            >
              <div style={styles.listTitle}>{c.contact_name || c.subject || c.channel_conversation_id}</div>
              <div style={styles.listMeta}>
                {c.channel} · {c.message_count ?? 0} msgs
              </div>
            </button>
          ))}
        </div>

        <OmniThreadPanel token={token} conversationId={selectedId} onSent={reload} />
        <OmniContactSidebar conversation={selected} />
      </div>
    </div>
  );
}

const styles = {
  toolbar: { display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" },
  select: { padding: "0.375rem 0.5rem", borderRadius: 6, border: "1px solid #d1d5db" },
  layout: { display: "flex", height: 560, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" },
  list: { width: 280, borderRight: "1px solid #e5e7eb", overflowY: "auto", background: "#fff" },
  listItem: {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "0.75rem",
    border: "none",
    borderBottom: "1px solid #f3f4f6",
    cursor: "pointer",
  },
  listTitle: { fontWeight: 600, fontSize: "0.875rem", marginBottom: 4 },
  listMeta: { fontSize: "0.75rem", color: "#6b7280" },
  muted: { padding: "1rem", color: "#6b7280", fontSize: "0.875rem" },
};
