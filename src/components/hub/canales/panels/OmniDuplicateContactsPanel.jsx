// ═══════════════════════════════════════════════════════════════════════════
// OmniDuplicateContactsPanel.jsx — review duplicate-contact clusters and
// (admin-only) merge them.
// ───────────────────────────────────────────────────────────────────────────
// Detection (GET /api/omni/contacts/duplicates) is read-only and visible to
// anyone with canales:read. Merge (POST /api/omni/contacts/merge) requires
// canales:admin on the backend — this panel hides the action (not just
// disables it) for non-admins so it doesn't dangle a button that always 403s,
// and always asks for an explicit confirm before firing (same pattern as the
// destructive delete actions in TasksModule.jsx).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import { useOmniDuplicateContacts, mergeOmniContacts } from "../../../../hooks/useOmniConversations.js";
import { useModuleGrants } from "../../../../hooks/useBmcAuth.js";
import { timeAgo } from "./omniFormat.js";

function contactLabel(c) {
  return c.name || c.email || c.wa_phone || c.phone || c.id.slice(0, 8);
}

/** Default pick for "keep this one": most conversation history, then oldest (likely the original). */
function suggestWinner(contacts) {
  return [...contacts].sort((a, b) => {
    const ca = Number(a.conversation_count) || 0;
    const cb = Number(b.conversation_count) || 0;
    if (cb !== ca) return cb - ca;
    const ta = a.created_at ? new Date(a.created_at).getTime() : Infinity;
    const tb = b.created_at ? new Date(b.created_at).getTime() : Infinity;
    return ta - tb;
  })[0]?.id;
}

function ContactCard({ contact, isWinner, onPick, selectable }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.6rem",
        flex: "1 1 220px",
        minWidth: 220,
        padding: "0.65rem 0.8rem",
        borderRadius: 10,
        border: `1px solid ${isWinner ? "#10b981" : "var(--ac-border-primary, #e5e7eb)"}`,
        background: isWinner ? "#ecfdf5" : "var(--ac-surface-1, #fff)",
        cursor: selectable ? "pointer" : "default",
      }}
    >
      {selectable && (
        <input
          type="radio"
          checked={isWinner}
          onChange={() => onPick(contact.id)}
          style={{ marginTop: 3 }}
        />
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{contactLabel(contact)}</div>
        {contact.email && <div style={{ fontSize: "0.75rem", color: "var(--ac-text-secondary, #6b7280)" }}>{contact.email}</div>}
        {(contact.phone || contact.wa_phone) && (
          <div style={{ fontSize: "0.75rem", color: "var(--ac-text-secondary, #6b7280)" }}>{contact.phone || contact.wa_phone}</div>
        )}
        <div style={{ fontSize: "0.7rem", color: "var(--ac-text-secondary, #9ca3af)", marginTop: 2 }}>
          {contact.conversation_count ?? 0} conversación(es) · creado {timeAgo(contact.created_at)}
        </div>
      </div>
      {isWinner && (
        <span style={{ marginLeft: "auto", fontSize: "0.65rem", fontWeight: 700, color: "#065f46" }}>GANADOR</span>
      )}
    </label>
  );
}

function ClusterCard({ cluster, canMerge, onMerge, merging }) {
  const [winnerId, setWinnerId] = useState(() => suggestWinner(cluster.contacts));
  // A reload (e.g. after a concurrent merge in another tab/session, or this
  // cluster shrinking after a pairwise merge) can return a fresh `cluster`
  // whose contacts no longer include the previously-picked winner — re-derive
  // rather than letting downstream lookups silently miss.
  const validWinnerId = cluster.contacts.some((c) => c.id === winnerId)
    ? winnerId
    : suggestWinner(cluster.contacts);

  const handleMerge = () => {
    const losers = cluster.contacts.filter((c) => c.id !== validWinnerId);
    if (losers.length !== 1) {
      // Clusters of 3+ are merged one pair at a time — keep the operator in control.
      return;
    }
    const winner = cluster.contacts.find((c) => c.id === validWinnerId);
    const loser = losers[0];
    const ok = window.confirm(
      `Fusionar "${contactLabel(loser)}" dentro de "${contactLabel(winner)}"?\n\n` +
        `Se repuntan ${loser.conversation_count ?? 0} conversación(es) al contacto ganador. ` +
        `El contacto perdedor NO se borra (queda archivado, reversible a mano).`,
    );
    if (!ok) return;
    onMerge(loser.id, winner.id);
  };

  const canMergeNow = canMerge && cluster.contacts.length === 2;

  return (
    <div style={{ border: "1px solid var(--ac-border-primary, #e5e7eb)", borderRadius: 12, padding: "0.85rem 1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ac-text-secondary, #6b7280)" }}>
          {cluster.reason} · {cluster.contacts.length} contactos
        </span>
        {canMerge && cluster.contacts.length > 2 && (
          <span style={{ fontSize: "0.7rem", color: "#92400e" }}>Fusionar de a pares — elegí el ganador y repetí</span>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        {cluster.contacts.map((c) => (
          <ContactCard
            key={c.id}
            contact={c}
            isWinner={c.id === validWinnerId}
            onPick={setWinnerId}
            selectable={canMerge}
          />
        ))}
      </div>
      {canMergeNow && (
        <button
          type="button"
          onClick={handleMerge}
          disabled={merging}
          style={{
            marginTop: "0.65rem",
            padding: "0.4rem 0.9rem",
            borderRadius: 8,
            border: "1px solid #10b981",
            background: merging ? "#a7f3d0" : "#10b981",
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.8125rem",
            cursor: merging ? "default" : "pointer",
          }}
        >
          {merging ? "Fusionando…" : "Fusionar"}
        </button>
      )}
    </div>
  );
}

export default function OmniDuplicateContactsPanel({ token }) {
  const { clusters, scanBounded, loading, error, reload } = useOmniDuplicateContacts(token);
  const { has } = useModuleGrants();
  const canMerge = has("canales", "admin");
  const [mergingKey, setMergingKey] = useState(null);
  const [mergeError, setMergeError] = useState(null);

  const handleMerge = async (clusterKey, fromId, intoId) => {
    setMergingKey(clusterKey);
    setMergeError(null);
    try {
      await mergeOmniContacts(token, fromId, intoId);
      await reload();
    } catch (e) {
      setMergeError(e.message);
    } finally {
      setMergingKey(null);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--ac-text-secondary, #6b7280)" }}>
          Contactos que probablemente son la misma persona (mismo email o teléfono, llegados por canales distintos).
          {!canMerge && " Solo lectura — fusionar requiere permiso admin."}
        </p>
        <button
          onClick={reload}
          disabled={loading}
          style={{
            padding: "0.4rem 0.85rem",
            borderRadius: 8,
            border: "1px solid var(--ac-border-primary, #e5e7eb)",
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

      {error && (
        <div style={{ padding: "0.75rem 1rem", borderRadius: 8, background: "#fef2f2", color: "#991b1b", fontSize: "0.875rem", marginBottom: "1rem" }}>
          No se pudo cargar: {error}
        </div>
      )}
      {mergeError && (
        <div style={{ padding: "0.75rem 1rem", borderRadius: 8, background: "#fef2f2", color: "#991b1b", fontSize: "0.875rem", marginBottom: "1rem" }}>
          No se pudo fusionar: {mergeError}
        </div>
      )}
      {scanBounded && (
        <div style={{ padding: "0.75rem 1rem", borderRadius: 8, background: "#fffbeb", color: "#92400e", fontSize: "0.875rem", marginBottom: "1rem" }}>
          Escaneo acotado a los 5000 contactos más recientes — puede haber duplicados entre contactos más antiguos sin actualizar que no aparecen acá.
        </div>
      )}

      {clusters.length === 0 ? (
        <div style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "var(--ac-text-secondary, #6b7280)" }}>
          {loading ? "Cargando…" : "Sin duplicados detectados. 🎉"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          {clusters.map((cluster) => (
            <ClusterCard
              key={cluster.key}
              cluster={cluster}
              canMerge={canMerge}
              merging={mergingKey === cluster.key}
              onMerge={(fromId, intoId) => handleMerge(cluster.key, fromId, intoId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
