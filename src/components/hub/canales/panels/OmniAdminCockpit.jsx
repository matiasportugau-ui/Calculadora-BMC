// ═══════════════════════════════════════════════════════════════════════════
// OmniAdminCockpit.jsx — top-level email administrator cockpit
// ───────────────────────────────────────────────────────────────────────────
// A management rollup ON TOP of the Omni inbox: per-mailbox health + volume,
// per-operator load, the unassigned/overdue queues, and SLA/first-response time.
// Read-only; data from GET /api/omni/admin/overview (degrades gracefully).
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import { useOmniAdminOverview, useOmniUrgentActions } from "../../../../hooks/useOmniConversations.js";
import { channelMeta, timeAgoOrDash } from "./omniFormat.js";
import "./omniInbox.css";

// ── format helpers ──────────────────────────────────────────────────────────

function fmtMins(min) {
  if (min == null || Number.isNaN(min)) return "—";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function healthBadge(health, enabled) {
  if (!enabled) return { label: "off", color: "#6b7280", bg: "#f3f4f6" };
  const map = {
    ok: { label: "ok", color: "#065f46", bg: "#d1fae5" },
    auth_error: { label: "auth", color: "#991b1b", bg: "#fee2e2" },
    unknown: { label: "?", color: "#92400e", bg: "#fef3c7" },
  };
  return map[health] || map.unknown;
}

// ── small presentational bits ───────────────────────────────────────────────

function KpiCard({ label, value, tone }) {
  const tones = {
    danger: { color: "#991b1b", bg: "#fef2f2", border: "#fecaca" },
    warn: { color: "#92400e", bg: "#fffbeb", border: "#fde68a" },
    ok: { color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" },
    neutral: { color: "var(--ac-text-primary, #111827)", bg: "var(--ac-surface-2, #f9fafb)", border: "var(--ac-border-primary, #e5e7eb)" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <div
      style={{
        flex: "1 1 130px",
        minWidth: 130,
        padding: "0.875rem 1rem",
        borderRadius: 12,
        background: t.bg,
        border: `1px solid ${t.border}`,
      }}
    >
      <div style={{ fontSize: "1.75rem", fontWeight: 700, color: t.color, lineHeight: 1.1 }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--ac-text-secondary, #6b7280)", marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

const th = {
  textAlign: "left",
  padding: "0.5rem 0.75rem",
  fontSize: "0.7rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--ac-text-secondary, #6b7280)",
  borderBottom: "1px solid var(--ac-border-primary, #e5e7eb)",
  whiteSpace: "nowrap",
};
const td = {
  padding: "0.5rem 0.75rem",
  fontSize: "0.875rem",
  color: "var(--ac-text-primary, #111827)",
  borderBottom: "1px solid var(--ac-border-secondary, #f3f4f6)",
  whiteSpace: "nowrap",
};

function SectionTitle({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "1.5rem 0 0.5rem" }}>
      <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>{children}</h2>
      {right}
    </div>
  );
}

// ── main ────────────────────────────────────────────────────────────────────

export default function OmniAdminCockpit({ token, onSelectConversation }) {
  const { overview, loading, error, reload } = useOmniAdminOverview(token);
  const { actions: urgent, loading: urgentLoading, error: urgentError } = useOmniUrgentActions(token, { limit: 12 });

  const t = overview?.totals || {};
  const sla = overview?.sla || {};
  const accounts = overview?.accounts || [];
  const assignees = overview?.assignees || [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--ac-text-secondary, #6b7280)" }}>
          Vista de administración del correo — salud de casillas, carga por operador, colas y SLA.
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
          No se pudo cargar el panel: {error}
        </div>
      )}
      {overview?.degraded && (
        <div style={{ padding: "0.75rem 1rem", borderRadius: 8, background: "#fffbeb", color: "#92400e", fontSize: "0.875rem", marginBottom: "1rem" }}>
          Datos parciales ({overview.degraded}) — puede faltar una migración.
        </div>
      )}

      {/* KPI row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <KpiCard label="Abiertas" value={t.open_total} tone="neutral" />
        <KpiCard label="Sin asignar" value={t.unassigned_open} tone={t.unassigned_open > 0 ? "warn" : "ok"} />
        {t.unattributed_open > 0 && (
          <KpiCard label="Sin casilla" value={t.unattributed_open} tone="warn" />
        )}
        <KpiCard label={`Atrasadas (>${overview?.overdue_hours ?? 24}h)`} value={t.overdue_unanswered} tone={t.overdue_unanswered > 0 ? "danger" : "ok"} />
        <KpiCard label="Pospuestas" value={t.snoozed_total} tone="neutral" />
        <KpiCard label="Cerradas hoy" value={t.closed_today} tone="ok" />
        <KpiCard label="FRT mediana (30d)" value={fmtMins(sla.median_frt_min)} tone="neutral" />
        <KpiCard label="FRT prom (30d)" value={fmtMins(sla.avg_frt_min)} tone="neutral" />
      </div>

      {/* Reply-zero: ranked "act on THIS now" queue across all channels */}
      <SectionTitle right={urgent.length > 0 ? <span style={{ fontSize: "0.75rem", color: "var(--ac-text-secondary, #6b7280)" }}>{urgent.length} en cola · abrir en Bandeja</span> : null}>
        🔥 Para responder ahora
      </SectionTitle>
      <div style={{ border: "1px solid var(--ac-border-primary, #e5e7eb)", borderRadius: 12, overflow: "hidden" }}>
        {urgent.length === 0 ? (
          <div
            style={{
              padding: "0.75rem 1rem",
              fontSize: "0.875rem",
              color: urgentError ? "#991b1b" : "var(--ac-text-secondary, #6b7280)",
              background: urgentError ? "#fef2f2" : "transparent",
            }}
          >
            {urgentLoading
              ? "Cargando…"
              : urgentError
                ? `No se pudo cargar la cola: ${urgentError}`
                : "Nada urgente — bandeja al día. 🎉"}
          </div>
        ) : (
          urgent.map((a) => {
            const cm = channelMeta(a.channel);
            const breached = a.urgency?.sla_breached;
            const who = a.contact_name || a.contact_email || a.wa_phone || "—";
            return (
              <button
                key={a.id}
                type="button"
                className={`omniUrgentRow${onSelectConversation ? " omniUrgentRow--clickable" : ""}${breached ? " omniUrgentRow--breached" : ""}`}
                onClick={() => onSelectConversation?.(a.id)}
              >
                <span
                  title={cm.label}
                  style={{ flex: "0 0 auto", padding: "0.15rem 0.45rem", borderRadius: 6, fontSize: "0.7rem", fontWeight: 700, color: "#fff", background: cm.color }}
                >
                  {cm.short}
                </span>
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {who}
                    {a.subject && <span style={{ fontWeight: 400, color: "var(--ac-text-secondary, #6b7280)" }}> — {a.subject}</span>}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: 3 }}>
                    {(a.urgency?.reasons || []).map((r, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: "0.68rem",
                          padding: "0.05rem 0.4rem",
                          borderRadius: 99,
                          color: r.includes("SLA") ? "#991b1b" : "var(--ac-text-secondary, #6b7280)",
                          background: r.includes("SLA") ? "#fee2e2" : "var(--ac-surface-2, #f3f4f6)",
                        }}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <span style={{ flex: "0 0 auto", fontSize: "0.75rem", color: "var(--ac-text-secondary, #9ca3af)" }}>
                  {timeAgoOrDash(a.created_at)}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Per-mailbox */}
      <SectionTitle>Casillas ({accounts.length})</SectionTitle>
      <div style={{ overflowX: "auto", border: "1px solid var(--ac-border-primary, #e5e7eb)", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Casilla</th>
              <th style={th}>Salud</th>
              <th style={th}>Abiertas</th>
              <th style={th}>Sin asignar</th>
              <th style={th}>Esperando</th>
              <th style={th}>Pospuestas</th>
              <th style={th}>FRT prom</th>
              <th style={th}>Última actividad</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 && (
              <tr><td style={{ ...td, color: "var(--ac-text-secondary, #6b7280)" }} colSpan={8}>{loading ? "Cargando…" : "Sin casillas."}</td></tr>
            )}
            {accounts.map((a) => {
              const b = healthBadge(a.health, a.enabled);
              return (
                <tr key={a.id}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{a.label || a.email}</div>
                    {a.label && <div style={{ fontSize: "0.75rem", color: "var(--ac-text-secondary, #6b7280)" }}>{a.email}</div>}
                  </td>
                  <td style={td}>
                    <span style={{ padding: "0.15rem 0.5rem", borderRadius: 99, fontSize: "0.7rem", fontWeight: 700, color: b.color, background: b.bg }}>{b.label}</span>
                  </td>
                  <td style={td}>{a.open_count}</td>
                  <td style={{ ...td, color: a.unassigned_open > 0 ? "#92400e" : undefined, fontWeight: a.unassigned_open > 0 ? 700 : 400 }}>{a.unassigned_open}</td>
                  <td style={td}>{a.awaiting_reply}</td>
                  <td style={td}>{a.snoozed_count}</td>
                  <td style={td}>{fmtMins(a.avg_frt_min)}</td>
                  <td style={{ ...td, color: "var(--ac-text-secondary, #6b7280)" }}>{timeAgoOrDash(a.last_activity_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Per-operator */}
      <SectionTitle>Carga por operador ({assignees.length})</SectionTitle>
      <div style={{ overflowX: "auto", border: "1px solid var(--ac-border-primary, #e5e7eb)", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Operador</th>
              <th style={th}>Abiertas</th>
              <th style={th}>Pospuestas</th>
              <th style={th}>Asignada más antigua</th>
            </tr>
          </thead>
          <tbody>
            {assignees.length === 0 && (
              <tr><td style={{ ...td, color: "var(--ac-text-secondary, #6b7280)" }} colSpan={4}>{loading ? "Cargando…" : "Nada asignado."}</td></tr>
            )}
            {assignees.map((u) => (
              <tr key={u.user_id}>
                <td style={td}>{u.name || u.email || u.user_id?.slice(0, 8)}</td>
                <td style={{ ...td, fontWeight: 600 }}>{u.open_count}</td>
                <td style={td}>{u.snoozed_count}</td>
                <td style={{ ...td, color: "var(--ac-text-secondary, #6b7280)" }}>{timeAgoOrDash(u.oldest_assigned_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {overview?.generated_at && (
        <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--ac-text-secondary, #9ca3af)" }}>
          Generado {timeAgoOrDash(overview.generated_at)} · SLA sobre últimos 30 días · réplicas: {sla.replied_count ?? 0}
        </p>
      )}
    </div>
  );
}
