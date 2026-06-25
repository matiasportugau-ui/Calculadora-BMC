import React, { useState } from "react";
import { useOmniDeals } from "../../../../hooks/useOmniConversations.js";
import { channelMeta, conversationTitle } from "./omniFormat.js";
import "./omniInbox.css";

function Section({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="omniSection">
      <button
        type="button"
        className="omniSection__head"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{title}</span>
        <span className="omniSection__chev" data-open={open}>
          ▸
        </span>
      </button>
      {open && <div className="omniSection__body">{children}</div>}
    </div>
  );
}

export default function OmniContactSidebar({ conversation, token, onUpdateConversation }) {
  // Deals are filtered client-side by source_conversation_id (Phase 1: no new endpoint).
  const { deals } = useOmniDeals(token);
  const [newLabel, setNewLabel] = useState("");
  const [savingTag, setSavingTag] = useState(false);

  if (!conversation) {
    return (
      <aside className="omniSide">
        <p className="omniSide__empty">Seleccioná una conversación</p>
      </aside>
    );
  }

  const ch = channelMeta(conversation.channel);
  const crmRow = conversation.properties?.crm_row_id;
  const crmLink = crmRow ? `/hub/cotizaciones?row=${crmRow}` : null;
  const tags = Array.isArray(conversation.tags) ? conversation.tags : [];
  const linkedDeals = (deals || []).filter((d) => d.source_conversation_id === conversation.id);

  const setTags = async (next) => {
    if (!onUpdateConversation || savingTag) return;
    setSavingTag(true);
    try {
      await onUpdateConversation(conversation.id, { tags: next });
    } catch {
      // Best-effort: swallow errors so addLabel()/removeLabel() callers can't
      // produce an unhandled promise rejection.
    } finally {
      setSavingTag(false);
    }
  };
  const addLabel = () => {
    const t = newLabel.trim();
    setNewLabel("");
    if (!t || tags.includes(t)) return;
    setTags([...tags, t]);
  };
  const removeLabel = (t) => setTags(tags.filter((x) => x !== t));

  return (
    <aside className="omniSide" aria-label={`Contacto: ${conversationTitle(conversation)}`}>
      <Section title="Contacto">
        <dl className="omniSide__dl">
          <dt>Nombre</dt>
          <dd>{conversation.contact_name || "—"}</dd>
          <dt>Canal</dt>
          <dd>{ch.label}</dd>
          <dt>Email</dt>
          <dd>{conversation.email || "—"}</dd>
          <dt>WhatsApp</dt>
          <dd>{conversation.wa_phone || "—"}</dd>
          <dt>Estado</dt>
          <dd>{conversation.status || "open"}</dd>
        </dl>
      </Section>

      <Section title="Etiquetas">
        <div className="omniSide__chips">
          {tags.length === 0 && <span className="omniSide__dealStage">Sin etiquetas</span>}
          {tags.map((t) => (
            <span key={t} className="omniPill omniPill--accent">
              {t}
              {onUpdateConversation && (
                <button
                  type="button"
                  className="omniChip__x"
                  aria-label={`Quitar etiqueta ${t}`}
                  disabled={savingTag}
                  onClick={() => removeLabel(t)}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        {onUpdateConversation && (
          <form
            className="omniSide__addTag"
            onSubmit={(e) => {
              e.preventDefault();
              addLabel();
            }}
          >
            <input
              className="omniInbox__search"
              placeholder="Agregar etiqueta…"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              disabled={savingTag}
            />
          </form>
        )}
      </Section>

      {linkedDeals.length > 0 && (
        <Section title="Negocios">
          {linkedDeals.map((d) => (
            <div key={d.id} className="omniSide__deal">
              <span>{d.title}</span>
              <span className="omniSide__dealStage">
                {d.stage}
                {d.value_usd ? ` · USD ${d.value_usd}` : ""}
              </span>
            </div>
          ))}
        </Section>
      )}

      <Section title="Enlaces" defaultOpen={false}>
        <div className="omniSide__links">
          {conversation.channel === "wa" && (
            <a className="omniSide__link" href="/hub/wa">
              Abrir WA Cockpit
            </a>
          )}
          {conversation.channel === "ml" && (
            <a className="omniSide__link" href="/hub/ml">
              Abrir ML Manager
            </a>
          )}
          {crmLink && (
            <a className="omniSide__link" href={crmLink}>
              Fila CRM
            </a>
          )}
        </div>
      </Section>
    </aside>
  );
}
