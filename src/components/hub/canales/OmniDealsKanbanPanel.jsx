import React, { useEffect, useMemo, useState } from "react";
import { useOmniDeals } from "../../../hooks/useOmniConversations.js";
import { useModuleGrants } from "../../../hooks/useBmcAuth.js";
import { channelMeta, timeAgoOrDash } from "./panels/omniFormat.js";

const DEAL_STAGES = [
  { id: "lead", label: "Lead" },
  { id: "qualified", label: "Calificado" },
  { id: "proposal", label: "Propuesta" },
  { id: "negotiation", label: "Negociación" },
  { id: "closed_won", label: "Ganado" },
  { id: "closed_lost", label: "Perdido" },
];

const TERMINAL_STAGES = new Set(["closed_won", "closed_lost"]);
const TRANSITIONS = {
  lead: new Set(["qualified", "closed_lost"]),
  qualified: new Set(["proposal", "closed_lost"]),
  proposal: new Set(["negotiation", "closed_lost"]),
  negotiation: new Set(["closed_won", "closed_lost"]),
  closed_won: new Set(),
  closed_lost: new Set(),
};

function canTransition(from, to) {
  if (!from || !to) return false;
  if (from === to) return true;
  return TRANSITIONS[from]?.has(to) ?? false;
}

function money(value) {
  if (value == null || value === "") return "Sin monto";
  const n = Number(value);
  if (!Number.isFinite(n)) return "Sin monto";
  return `USD ${n.toLocaleString("es-UY", { maximumFractionDigits: 0 })}`;
}

function dealTitle(deal) {
  return deal.contact_name || deal.contact_email || deal.wa_phone || deal.title || "Contacto sin nombre";
}

function DealCard({ deal, canWrite, draggingId, onDragStart, onDragEnd }) {
  const terminal = TERMINAL_STAGES.has(deal.stage);
  const draggable = canWrite && !terminal;
  const ch = channelMeta(deal.source_channel || deal.channel);

  return (
    <article
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", deal.id);
        onDragStart(deal.id);
      }}
      onDragEnd={onDragEnd}
      style={{
        padding: "0.75rem",
        borderRadius: 12,
        border: "1px solid var(--ac-border-primary, #e5e7eb)",
        background: "#fff",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
        opacity: draggingId === deal.id ? 0.55 : 1,
        cursor: draggable ? "grab" : "default",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", marginBottom: 8 }}>
        <strong style={{ fontSize: "0.875rem", lineHeight: 1.25 }}>{dealTitle(deal)}</strong>
        <span
          style={{
            flex: "0 0 auto",
            alignSelf: "flex-start",
            padding: "0.15rem 0.45rem",
            borderRadius: 999,
            background: ch.color,
            color: ch.fg || "#fff",
            fontSize: "0.65rem",
            fontWeight: 700,
          }}
          title={ch.label}
        >
          {ch.short}
        </span>
      </div>
      {deal.title && deal.title !== dealTitle(deal) && (
        <div style={{ marginBottom: 8, color: "var(--ac-text-secondary, #6b7280)", fontSize: "0.75rem" }}>
          {deal.title}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.75rem" }}>
        <span style={{ fontWeight: 700 }}>{money(deal.value_usd ?? deal.amount)}</span>
        <span style={{ color: "var(--ac-text-secondary, #6b7280)" }}>{timeAgoOrDash(deal.updated_at)}</span>
      </div>
      {terminal && (
        <div style={{ marginTop: 8, color: "var(--ac-text-secondary, #6b7280)", fontSize: "0.7rem" }}>
          Etapa final
        </div>
      )}
    </article>
  );
}

export default function OmniDealsKanbanPanel({ token }) {
  const { deals, loading, error, reload, moveDeal } = useOmniDeals(token, { limit: 300 });
  const { has } = useModuleGrants();
  const canWrite = has("canales", "write");
  const [localDeals, setLocalDeals] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const [movingId, setMovingId] = useState(null);
  const [moveError, setMoveError] = useState("");

  useEffect(() => {
    setLocalDeals(Array.isArray(deals) ? deals : []);
  }, [deals]);

  const byStage = useMemo(() => {
    const grouped = Object.fromEntries(DEAL_STAGES.map((stage) => [stage.id, []]));
    for (const deal of localDeals) {
      const key = grouped[deal.stage] ? deal.stage : "lead";
      grouped[key].push(deal);
    }
    return grouped;
  }, [localDeals]);

  const handleDrop = async (event, toStage) => {
    event.preventDefault();
    if (!canWrite) return;
    const dealId = event.dataTransfer.getData("text/plain") || draggingId;
    const deal = localDeals.find((item) => item.id === dealId);
    if (!deal || !canTransition(deal.stage, toStage) || TERMINAL_STAGES.has(deal.stage)) return;
    if (deal.stage === toStage) {
      setDraggingId(null);
      return;
    }

    const before = localDeals;
    setMoveError("");
    setMovingId(dealId);
    setLocalDeals((current) =>
      current.map((item) => (item.id === dealId ? { ...item, stage: toStage, updated_at: new Date().toISOString() } : item)),
    );
    try {
      await moveDeal(dealId, toStage);
    } catch (e) {
      setLocalDeals(before);
      const from = e.data?.from ? ` (${e.data.from} → ${e.data.to || toStage})` : "";
      setMoveError(e.status === 409 ? `Transición no permitida${from}` : e.message || "No se pudo mover el negocio");
    } finally {
      setMovingId(null);
      setDraggingId(null);
    }
  };

  const total = localDeals.length;

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div>
          <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.1rem" }}>Pipeline</h2>
          <p style={{ margin: 0, color: "var(--ac-text-secondary, #6b7280)", fontSize: "0.875rem" }}>
            Negocios de omni_deals por etapa. {!canWrite && "Modo solo lectura — mover requiere canales:write."}
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          style={{
            padding: "0.45rem 0.9rem",
            borderRadius: 9,
            border: "1px solid var(--ac-border-primary, #e5e7eb)",
            background: "#fff",
            cursor: loading ? "default" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Actualizando…" : "↻ Actualizar"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "0.75rem 1rem", borderRadius: 10, background: "#fef2f2", color: "#991b1b", marginBottom: "1rem" }}>
          No se pudo cargar el pipeline: {error}
        </div>
      )}
      {moveError && (
        <div style={{ padding: "0.75rem 1rem", borderRadius: 10, background: "#fffbeb", color: "#92400e", marginBottom: "1rem" }}>
          {moveError}
        </div>
      )}

      {error && total === 0 ? null : loading && total === 0 ? (
        <p style={{ color: "var(--ac-text-secondary, #6b7280)" }}>Cargando pipeline…</p>
      ) : !error && total === 0 ? (
        <div style={{ padding: "1rem", borderRadius: 12, background: "#fff", border: "1px solid var(--ac-border-primary, #e5e7eb)", color: "var(--ac-text-secondary, #6b7280)" }}>
          No hay negocios en omni_deals todavía.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(190px, 1fr))", gap: "0.75rem", overflowX: "auto", paddingBottom: "1rem" }}>
          {DEAL_STAGES.map((stage) => {
            const accepts = draggingId
              ? canWrite && canTransition(localDeals.find((d) => d.id === draggingId)?.stage, stage.id)
              : false;
            return (
              <div
                key={stage.id}
                onDragOver={(event) => {
                  if (accepts) event.preventDefault();
                }}
                onDrop={(event) => handleDrop(event, stage.id)}
                style={{
                  minWidth: 190,
                  borderRadius: 14,
                  border: `1px solid ${accepts ? "var(--ac-accent-primary, #2563eb)" : "var(--ac-border-primary, #e5e7eb)"}`,
                  background: accepts ? "#eff6ff" : "#f9fafb",
                  padding: "0.75rem",
                }}
              >
                <h3 style={{ display: "flex", justifyContent: "space-between", margin: "0 0 0.75rem", fontSize: "0.85rem" }}>
                  <span>{stage.label}</span>
                  <span style={{ color: "var(--ac-text-secondary, #6b7280)" }}>{byStage[stage.id].length}</span>
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", minHeight: 72 }}>
                  {byStage[stage.id].length === 0 ? (
                    <p style={{ margin: 0, color: "var(--ac-text-secondary, #9ca3af)", fontSize: "0.75rem" }}>Sin negocios</p>
                  ) : (
                    byStage[stage.id].map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        canWrite={canWrite && movingId !== deal.id}
                        draggingId={draggingId}
                        onDragStart={setDraggingId}
                        onDragEnd={() => setDraggingId(null)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
