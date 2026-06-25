import React, { useEffect, useRef, useState } from "react";
import { useOmniMessages, useOmniSuggestions } from "../../../../hooks/useOmniConversations.js";
import { channelMeta, clockTime, conversationTitle, messageDate, statusMeta } from "./omniFormat.js";
import { applyReply, matchSlashQuery } from "./cannedReplies.js";
import "./omniInbox.css";

const EMPTY_SLASH = { active: false, matches: [], tokenStart: 0 };

export default function OmniThreadPanel({ token, conversationId, onSent, onUpdateConversation }) {
  const {
    conversation,
    messages,
    loading,
    error,
    sendReply,
    markRead,
    reload: reloadThread,
  } = useOmniMessages(token, conversationId);
  const { suggestions, accept, reject } = useOmniSuggestions(token, conversationId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [slash, setSlash] = useState(EMPTY_SLASH);
  const [slashIdx, setSlashIdx] = useState(0);
  const taRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    if (conversationId) markRead().catch(() => {});
  }, [conversationId, markRead]);

  // Reset composer when switching conversations.
  useEffect(() => {
    setDraft("");
    setSlash(EMPTY_SLASH);
  }, [conversationId]);

  // Keep the thread scrolled to the newest message.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const recompute = (value, caret) => {
    const res = matchSlashQuery(value, caret);
    setSlash(
      res.active && res.matches.length
        ? { active: true, matches: res.matches, tokenStart: res.tokenStart }
        : EMPTY_SLASH,
    );
    setSlashIdx(0);
  };

  const onChange = (e) => {
    setDraft(e.target.value);
    recompute(e.target.value, e.target.selectionStart);
  };

  const chooseReply = (reply) => {
    const ta = taRef.current;
    const caret = ta ? ta.selectionStart : draft.length;
    setDraft(applyReply(draft, caret, slash.tokenStart, reply.body));
    setSlash(EMPTY_SLASH);
    requestAnimationFrame(() => ta?.focus());
  };

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

  const handleStatus = async (status) => {
    if (!onUpdateConversation || updating) return;
    setUpdating(true);
    try {
      await onUpdateConversation(conversationId, { status });
      await reloadThread(); // refresh this thread's own status badge
    } finally {
      setUpdating(false);
    }
  };

  const onKeyDown = (e) => {
    if (slash.active && slash.matches.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIdx((i) => (i + 1) % slash.matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIdx((i) => (i - 1 + slash.matches.length) % slash.matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        chooseReply(slash.matches[slashIdx]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlash(EMPTY_SLASH);
        return;
      }
    }
    // Chatwoot default: Enter sends, Shift+Enter inserts a newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversationId) {
    return (
      <div className="omniThread">
        <div className="omniThread__empty">Seleccioná una conversación del inbox</div>
      </div>
    );
  }
  if (loading && !messages.length) {
    return (
      <div className="omniThread">
        <div className="omniThread__empty">Cargando mensajes…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="omniThread">
        <div className="omniThread__empty">{error}</div>
      </div>
    );
  }

  const ch = channelMeta(conversation?.channel);
  const suggestion = suggestions[0];

  return (
    <div className="omniThread">
      <header className="omniThread__header">
        <h3 className="omniThread__title">{conversationTitle(conversation)}</h3>
        <span className="omniRow__chip" style={{ background: ch.color, color: ch.fg || "#fff" }}>
          {ch.short}
        </span>
        {conversation?.status && (
          <span className={`omniPill omniPill--${statusMeta(conversation.status).tone}`}>
            {statusMeta(conversation.status).label}
          </span>
        )}
        <span className="omniThread__headerSpacer" />
        <div className="omniThread__actions">
          {conversation?.status === "closed" ? (
            <button
              type="button"
              className="omniInbox__btn"
              disabled={updating}
              onClick={() => handleStatus("open")}
            >
              Reabrir
            </button>
          ) : (
            <>
              <button
                type="button"
                className="omniInbox__btn"
                disabled={updating || conversation?.status === "snoozed"}
                onClick={() => handleStatus("snoozed")}
              >
                Posponer
              </button>
              <button
                type="button"
                className="omniInbox__btn"
                disabled={updating}
                onClick={() => handleStatus("closed")}
              >
                Resolver
              </button>
            </>
          )}
        </div>
      </header>

      <div className="omniThread__messages">
        {messages.map((m) => {
          const out = m.sender === "agent" || m.sender === "bot";
          return (
            <div key={m.id} className={`omniMsg ${out ? "omniMsg--out" : "omniMsg--in"}`}>
              <div className="omniMsg__bubble">{m.body}</div>
              <div className="omniMsg__meta">
                <span>{m.sender}</span>
                <span>{clockTime(messageDate(m))}</span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {suggestion && (
        <div className="omniSuggest">
          <div className="omniSuggest__label">Sugerencia IA</div>
          <p className="omniSuggest__body">{suggestion.body}</p>
          <div className="omniSuggest__actions">
            <button type="button" className="omniInbox__btn" onClick={() => setDraft(suggestion.body)}>
              Usar
            </button>
            <button type="button" className="omniInbox__btn" onClick={() => accept(suggestion.id)}>
              Aceptar
            </button>
            <button type="button" className="omniInbox__btn" onClick={() => reject(suggestion.id)}>
              Rechazar
            </button>
          </div>
        </div>
      )}

      <div className="omniComposer">
        {slash.active && slash.matches.length > 0 && (
          <div className="omniSlash" role="listbox" aria-label="Respuestas rápidas">
            {slash.matches.map((r, i) => (
              <button
                key={r.shortcut}
                type="button"
                role="option"
                aria-selected={i === slashIdx}
                className="omniSlash__item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  chooseReply(r);
                }}
              >
                <span>
                  <span className="omniSlash__sc">/{r.shortcut}</span>
                  <span className="omniSlash__title">{r.title}</span>
                </span>
                <span className="omniSlash__body">{r.body}</span>
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={taRef}
          className="omniComposer__textarea"
          value={draft}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder="Escribí una respuesta…  (Enter envía · Shift+Enter salto · / respuestas rápidas)"
        />
        <div className="omniComposer__bar">
          <span className="omniComposer__hint">
            Enter envía · Shift+Enter salto · / respuestas rápidas
          </span>
          <button
            type="button"
            className="omniComposer__send"
            disabled={sending || !draft.trim()}
            onClick={handleSend}
          >
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
