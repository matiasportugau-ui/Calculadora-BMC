import React, { useEffect, useMemo, useState } from "react";
import { useOmniConversations, useOmniAccounts } from "../../../../hooks/useOmniConversations.js";
import OmniThreadPanel from "./OmniThreadPanel.jsx";
import OmniContactSidebar from "./OmniContactSidebar.jsx";
import {
  channelMeta,
  conversationTitle,
  conversationDate,
  initials,
  avatarColor,
  timeAgo,
  statusMeta,
} from "./omniFormat.js";
import "./omniInbox.css";

// Chatwoot-style status tabs. Empty key = no filter ("Todas"). The backend
// GET /api/omni/conversations already accepts ?status=, so these are free.
const TABS = [
  { key: "", label: "Todas" },
  { key: "open", label: "Abiertas" },
  { key: "pending", label: "Pendientes" },
  { key: "snoozed", label: "Pospuestas" },
  { key: "closed", label: "Resueltas" },
];

export default function OmniInboxPanel({ token, initialConversationId, onInitialConversationConsumed }) {
  const [selectedId, setSelectedId] = useState(null);
  const [channelFilter, setChannelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState(""); // "" | "me" | "unassigned"
  const [search, setSearch] = useState("");

  // Deep-link from another panel (e.g. the cockpit's urgent-actions queue): open
  // a specific thread on mount, then consume it so a later plain tab switch into
  // "omni" doesn't reopen the same conversation. Independent of the current
  // filters/pagination — the thread is fetched by id, not found in the list.
  useEffect(() => {
    if (!initialConversationId) return;
    setSelectedId(initialConversationId);
    onInitialConversationConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConversationId]);

  const accounts = useOmniAccounts(token);

  const { conversations, loading, error, reload, updateConversation } = useOmniConversations(token, {
    channel: channelFilter || undefined,
    status: statusFilter || undefined,
    accountId: accountFilter || undefined,
    assignedTo: assignedFilter || undefined,
  });

  // Client-side search over the loaded page (server-side search is a deferred feature).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      `${conversationTitle(c)} ${c.email || ""} ${c.wa_phone || ""} ${c.channel || ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [conversations, search]);

  const selected = conversations.find((c) => c.id === selectedId) || null;

  return (
    <div className="omniInbox">
      <div className="omniInbox__toolbar">
        <div className="omniInbox__tabs" role="tablist" aria-label="Estado de conversación">
          {TABS.map((t) => (
            <button
              key={t.key || "all"}
              type="button"
              role="tab"
              aria-selected={statusFilter === t.key}
              className="omniInbox__tab"
              onClick={() => setStatusFilter(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="omniInbox__spacer" />
        <input
          className="omniInbox__search"
          placeholder="Buscar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="omniInbox__select"
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
        >
          <option value="">Todos los canales</option>
          <option value="wa">WhatsApp</option>
          <option value="ml">MercadoLibre</option>
          <option value="email">Email</option>
        </select>
        {accounts.length > 0 && (
          <select
            className="omniInbox__select"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            aria-label="Casilla"
          >
            <option value="">Todas las casillas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label || a.email}
              </option>
            ))}
          </select>
        )}
        <select
          className="omniInbox__select"
          value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value)}
          aria-label="Asignación"
        >
          <option value="">Todas</option>
          <option value="me">Mías</option>
          <option value="unassigned">Sin asignar</option>
        </select>
        <button type="button" className="omniInbox__btn" onClick={reload}>
          Actualizar
        </button>
      </div>

      {error && <p className="omniInbox__error">{error}</p>}

      <div className="omniInbox__layout">
        <div className="omniInbox__list">
          {loading && <p className="omniInbox__muted">Cargando…</p>}
          {!loading && filtered.length === 0 && (
            <p className="omniInbox__muted">Sin conversaciones</p>
          )}
          {filtered.map((c) => {
            const ch = channelMeta(c.channel);
            const title = conversationTitle(c);
            const st = statusMeta(c.status);
            const unread = Number(c.unread_count || 0); // populated in Phase 2
            return (
              <button
                key={c.id}
                type="button"
                className="omniRow"
                aria-current={selectedId === c.id}
                onClick={() => setSelectedId(c.id)}
              >
                <span className="omniRow__avatar" style={{ background: avatarColor(title) }}>
                  {initials(title)}
                </span>
                <span className="omniRow__main">
                  <span className="omniRow__top">
                    <span className="omniRow__name">{title}</span>
                    <span className="omniRow__time">{timeAgo(conversationDate(c))}</span>
                  </span>
                  <span className="omniRow__sub">
                    <span
                      className="omniRow__chip"
                      style={{ background: ch.color, color: ch.fg || "#fff" }}
                    >
                      {ch.short}
                    </span>
                    {(c.account_label || c.account_email) && (
                      <span className="omniRow__account" title={c.account_email || ""}>
                        {c.account_label || c.account_email}
                      </span>
                    )}
                    {c.status && c.status !== "open" && (
                      <span className={`omniPill omniPill--${st.tone}`}>{st.label}</span>
                    )}
                    <span className="omniRow__count">{c.message_count ?? 0} msgs</span>
                  </span>
                </span>
                <span className="omniRow__right">
                  {unread > 0 && <span className="omniRow__unread">{unread}</span>}
                </span>
              </button>
            );
          })}
        </div>

        <OmniThreadPanel
          token={token}
          conversationId={selectedId}
          onSent={reload}
          onUpdateConversation={updateConversation}
        />
        <OmniContactSidebar
          conversation={selected}
          token={token}
          onUpdateConversation={updateConversation}
        />
      </div>
    </div>
  );
}
