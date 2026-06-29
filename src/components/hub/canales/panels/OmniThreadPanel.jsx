import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  useOmniMessages,
  useOmniSuggestions,
  useOmniAssignees,
} from "../../../../hooks/useOmniConversations.js";
import { channelMeta, clockTime, conversationTitle, messageDate, statusMeta } from "./omniFormat.js";
import { applyReply, getCannedReplies, matchSlashQuery } from "./cannedReplies.js";
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
  const assignees = useOmniAssignees(token);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [slash, setSlash] = useState(EMPTY_SLASH);
  const [slashIdx, setSlashIdx] = useState(0);
  const taRef = useRef(null);
  const endRef = useRef(null);

  // Cache canned replies once per mount so each keystroke avoids a localStorage
  // read + JSON.parse inside matchSlashQuery().
  const cannedReplies = useMemo(() => getCannedReplies(), []);

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
    const res = matchSlashQuery(value, caret, cannedReplies);
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
    } catch {
      // Keep the draft intact so the operator can retry; avoid an unhandled
      // rejection bubbling out of this fire-and-forget handler.
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
    } catch {
      // Best-effort: swallow errors so the onClick handler can't produce an
      // unhandled promise rejection.
    } finally {
      setUpdating(false);
    }
  };

  // Snooze: set status + a concrete reopen timestamp. The in-process snooze
  // worker (server/lib/omni/snoozeWorker.js) flips it back to 'open' once the
  // window passes. Without snoozed_until the conversation would be hidden forever.
  const handleSnooze = async (hours) => {
    if (!onUpdateConversation || updating || !hours) return;
    setUpdating(true);
    try {
      const until = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      await onUpdateConversation(conversationId, { status: "snoozed", snoozed_until: until });
      await reloadThread();
    } catch {
      // Best-effort: swallow so the onChange handler can't reject unhandled.
    } finally {
      setUpdating(false);
    }
  };

  const handleAssign = async (userId) => {
    if (!onUpdateConversation || updating) return;
    setUpdating(true);
    try {
      await onUpdateConversation(conversationId, { assigned_to_user_id: userId || null });
      await reloadThread(); // refresh this thread's assignment
    } catch {
      // Best-effort: swallow so the onChange handler can't reject unhandled.
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
        {assignees.length > 0 && (
          <select
            className="omniThread__assign"
            value={conversation?.assigned_to_user_id || ""}
            disabled={updating}
            onChange={(e) => handleAssign(e.target.value)}
            aria-label="Asignar conversación"
            title="Asignar a un operador"
          >
            <option value="">Sin asignar</option>
            {assignees.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
        )}
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
              <select
                className="omniInbox__btn omniThread__snooze"
                value=""
                disabled={updating}
                onChange={(e) => {
                  if (e.target.value) handleSnooze(Number(e.target.value));
                  e.target.value = "";
                }}
                aria-label="Posponer conversación"
                title="Posponer (reabre sola al vencer)"
              >
                <option value="">Posponer…</option>
                <option value="1">1 hora</option>
                <option value="4">4 horas</option>
                <option value="24">1 día</option>
                <option value="72">3 días</option>
              </select>
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
            <button
              type="button"
              className="omniInbox__btn"
              onClick={() => accept(suggestion.id).catch(() => {})}
            >
              Aceptar
            </button>
            <button
              type="button"
              className="omniInbox__btn"
              onClick={() => reject(suggestion.id).catch(() => {})}
            >
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
