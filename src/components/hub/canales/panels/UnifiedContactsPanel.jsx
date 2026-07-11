// ═══════════════════════════════════════════════════════════════════════════
// src/components/hub/canales/panels/UnifiedContactsPanel.jsx
// ───────────────────────────────────────────────────────────────────────────
// Contactos Unificados — searchable directory of unified contacts across every
// channel, backed by GET /api/omni/contacts (via useOmniContacts). One row per
// contact with the channels it was reached on, its conversation count and last
// activity. Deduplication/merge lives in the sibling "Duplicados" tab.
// Reuses omniFormat.js (channelMeta / avatarColor / initials / timeAgoOrDash).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import { useOmniContacts } from "../../../../hooks/useOmniConversations.js";
import { channelMeta, avatarColor, initials, timeAgoOrDash } from "./omniFormat.js";

// Best available display name (same fallback ladder as OmniDuplicateContactsPanel).
function contactLabel(c) {
  return c.name || c.email || c.wa_phone || c.phone || String(c.id || "").slice(0, 8);
}

// Channels the contact was reached on: prefer the backend-derived list, else
// infer from which identity fields are populated.
function contactChannels(c) {
  if (Array.isArray(c.channels) && c.channels.filter(Boolean).length) {
    return c.channels.filter(Boolean);
  }
  const derived = [];
  if (c.wa_phone) derived.push("wa");
  if (c.ml_user_id) derived.push("ml");
  if (c.email) derived.push("email");
  return derived;
}

function ChannelChip({ channel }) {
  const ch = channelMeta(channel);
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.1rem 0.4rem",
        borderRadius: 6,
        fontSize: "0.65rem",
        fontWeight: 700,
        background: ch.color,
        color: ch.fg || "#fff",
      }}
      title={ch.label}
    >
      {ch.short}
    </span>
  );
}

const muted = "var(--ac-text-secondary, #6b7280)";
const border = "1px solid var(--ac-border-primary, #e5e7eb)";

export default function UnifiedContactsPanel({ token }) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");

  // Debounce the input into the server-side search param (300ms).
  useEffect(() => {
    const id = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const { contacts, loading, error, reload } = useOmniContacts(token, { search });

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginBottom: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.875rem", color: muted }}>
          Directorio unificado de contactos a través de todos los canales (WhatsApp,
          MercadoLibre, Email). Para fusionar duplicados usá la pestaña «Duplicados».
        </p>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, email o teléfono…"
            style={{
              padding: "0.4rem 0.7rem",
              borderRadius: 8,
              border,
              background: "var(--ac-surface-1, #fff)",
              fontSize: "0.8125rem",
              minWidth: 240,
            }}
          />
          <button
            onClick={reload}
            disabled={loading}
            style={{
              padding: "0.4rem 0.85rem",
              borderRadius: 8,
              border,
              background: "var(--ac-surface-1, #fff)",
              cursor: loading ? "default" : "pointer",
              fontSize: "0.8125rem",
              fontWeight: 600,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Actualizando…" : "↻ Actualizar"}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: 8,
            background: "#fef2f2",
            color: "#991b1b",
            fontSize: "0.875rem",
            marginBottom: "1rem",
          }}
        >
          No se pudo cargar: {error}
        </div>
      )}

      {contacts.length === 0 ? (
        <div style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: muted }}>
          {loading
            ? "Cargando…"
            : search
              ? "Sin contactos que coincidan con la búsqueda."
              : "Sin contactos todavía."}
        </div>
      ) : (
        <div style={{ overflowX: "auto", border, borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
            <thead>
              <tr style={{ textAlign: "left", color: muted }}>
                <th style={th}>Contacto</th>
                <th style={th}>Canales</th>
                <th style={th}>Email</th>
                <th style={th}>Teléfono</th>
                <th style={{ ...th, textAlign: "right" }}>Conv.</th>
                <th style={{ ...th, textAlign: "right" }}>Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const label = contactLabel(c);
                return (
                  <tr key={c.id} style={{ borderTop: border }}>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 30,
                            height: 30,
                            borderRadius: "50%",
                            background: avatarColor(label),
                            color: "#fff",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {initials(label)}
                        </span>
                        <span style={{ fontWeight: 600 }}>{label}</span>
                      </div>
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                        {contactChannels(c).map((ch) => (
                          <ChannelChip key={ch} channel={ch} />
                        ))}
                      </div>
                    </td>
                    <td style={{ ...td, color: c.email ? undefined : muted }}>{c.email || "—"}</td>
                    <td style={{ ...td, color: c.phone || c.wa_phone ? undefined : muted }}>
                      {c.phone || c.wa_phone || "—"}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>{c.conversation_count ?? 0}</td>
                    <td style={{ ...td, textAlign: "right", color: muted }}>
                      {timeAgoOrDash(c.last_activity_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th = { padding: "0.55rem 0.8rem", fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" };
const td = { padding: "0.55rem 0.8rem", verticalAlign: "middle" };
