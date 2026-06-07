// ═══════════════════════════════════════════════════════════════════════════
// src/components/hub/clientes/ClientesMVP.jsx — Panel de Clientes 360 MVP
// ───────────────────────────────────────────────────────────────────────────
// Mounted at /hub/clientes (RequireGrant module="clientes" minLevel="read").
//
// MVP scope (docs/clientes-360/MVP-1-PANTALLA.md §4):
//   - Table with 4 cols: Cliente, Último contacto, Último presupuesto, Acción
//   - 3 quick filters: todos | sin contacto >30d | con presupuesto pendiente
//   - Search box (name, phone, email)
//   - "Marcar contactado" button → POST /api/clientes/followups
//   - KPI strip (total / stale / pending followups)
//
// Pattern follows TasksModule.jsx (inline styles, no design system dep).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import { useCustomers, useCustomersSummary, useMarkContacted } from "./hooks/useClientes.js";

const STATUS_BADGE = {
  pending: { label: "⏳ pendiente", color: "#b45309", bg: "#fef3c7" },
  won: { label: "✓ cerrado", color: "#15803d", bg: "#dcfce7" },
  lost: { label: "✗ perdido", color: "#b91c1c", bg: "#fee2e2" },
  expired: { label: "○ expirado", color: "#6b7280", bg: "#f3f4f6" },
};

function formatRelativeDays(daysSince) {
  if (daysSince === null || daysSince === undefined) return "—";
  if (daysSince === 0) return "hoy";
  if (daysSince === 1) return "ayer";
  if (daysSince < 30) return `hace ${daysSince}d`;
  if (daysSince < 365) return `hace ${Math.round(daysSince / 30)}m`;
  return `hace ${Math.round(daysSince / 365)}a`;
}

function contactColor(daysSince) {
  if (daysSince === null || daysSince === undefined) return "#6b7280";
  if (daysSince <= 7) return "#15803d";
  if (daysSince <= 30) return "#b45309";
  return "#b91c1c";
}

function formatMoney(n, currency = "USD") {
  if (n === null || n === undefined) return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${currency === "USD" ? "USD" : currency} ${v.toLocaleString("es-UY", { maximumFractionDigits: 0 })}`;
}

// ─── KPI strip ────────────────────────────────────────────────────────────

function KpiStrip({ summary }) {
  const kpis = [
    { label: "Clientes totales", value: summary?.total_customers ?? "—" },
    { label: "Sin contacto >30d", value: summary?.stale_30d ?? "—", warn: true },
    { label: "Activos últimos 7d", value: summary?.active_7d ?? "—" },
    { label: "Presupuestos pendientes", value: summary?.customers_with_pending_quote ?? "—" },
    { label: "Follow-ups pendientes", value: summary?.pending_followups ?? "—" },
  ];
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
      gap: "0.75rem",
      marginBottom: "1.25rem",
    }}>
      {kpis.map((k) => (
        <div key={k.label} style={{
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: "0.5rem",
          padding: "0.75rem 1rem",
        }}>
          <div style={{ fontSize: "0.75rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {k.label}
          </div>
          <div style={{
            fontSize: "1.5rem", fontWeight: 600, marginTop: "0.25rem",
            color: k.warn && Number(k.value) > 0 ? "#b91c1c" : "#111827",
          }}>
            {k.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Filters bar ──────────────────────────────────────────────────────────

function FiltersBar({ filter, setFilter, search, setSearch }) {
  const tabs = [
    { id: "all", label: "Todos" },
    { id: "stale30", label: "Sin contacto >30d" },
    { id: "with_pending_quote", label: "Con presupuesto pendiente" },
  ];
  return (
    <div style={{
      display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap",
      marginBottom: "1rem",
    }}>
      {tabs.map((t) => (
        <button key={t.id} type="button" onClick={() => setFilter(t.id)}
          style={{
            padding: "0.4rem 0.85rem",
            borderRadius: "0.375rem",
            border: filter === t.id ? "1px solid #1d4ed8" : "1px solid #d1d5db",
            background: filter === t.id ? "#1d4ed8" : "#fff",
            color: filter === t.id ? "#fff" : "#374151",
            cursor: "pointer",
            fontSize: "0.875rem",
          }}>
          {t.label}
        </button>
      ))}
      <input type="search" placeholder="Buscar nombre, teléfono, email…"
        value={search} onChange={(e) => setSearch(e.target.value)}
        style={{
          marginLeft: "auto", padding: "0.4rem 0.75rem",
          border: "1px solid #d1d5db", borderRadius: "0.375rem",
          fontSize: "0.875rem", minWidth: "260px",
        }} />
    </div>
  );
}

// ─── Customer row ─────────────────────────────────────────────────────────

function CustomerRow({ customer, onMarkContacted, pendingId }) {
  const badge = customer.last_quote_status ? STATUS_BADGE[customer.last_quote_status] : null;
  const isPending = pendingId === customer.id;

  return (
    <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
      <td style={td}>
        <div style={{ fontWeight: 500 }}>{customer.display_name}</div>
        <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
          {customer.primary_phone_e164 && (
            <a href={`https://wa.me/${customer.primary_phone_e164}`} target="_blank" rel="noreferrer"
              style={{ color: "#15803d", textDecoration: "none", marginRight: "0.5rem" }}>
              📱 {customer.primary_phone_e164}
            </a>
          )}
          {customer.primary_email && (
            <a href={`mailto:${customer.primary_email}`} style={{ color: "#1d4ed8", textDecoration: "none" }}>
              ✉ {customer.primary_email}
            </a>
          )}
        </div>
        {customer.channels?.length > 0 && (
          <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: "0.15rem" }}>
            {customer.channels.join(" · ")}
          </div>
        )}
      </td>
      <td style={{ ...td, color: contactColor(customer.days_since_contact), fontWeight: 500 }}>
        {formatRelativeDays(customer.days_since_contact)}
      </td>
      <td style={td}>
        {customer.last_quote_total ? (
          <div>
            <div>{formatMoney(customer.last_quote_total, customer.last_quote_currency)}</div>
            {badge && (
              <span style={{
                display: "inline-block", marginTop: "0.2rem",
                padding: "0.1rem 0.5rem", borderRadius: "0.375rem",
                fontSize: "0.7rem", color: badge.color, background: badge.bg,
              }}>{badge.label}</span>
            )}
          </div>
        ) : <span style={{ color: "#9ca3af" }}>—</span>}
      </td>
      <td style={{ ...td, textAlign: "right" }}>
        <button type="button" onClick={() => onMarkContacted(customer.id)}
          disabled={isPending}
          style={{
            padding: "0.35rem 0.75rem",
            borderRadius: "0.375rem",
            border: "1px solid #1d4ed8",
            background: isPending ? "#dbeafe" : "#1d4ed8",
            color: isPending ? "#1d4ed8" : "#fff",
            cursor: isPending ? "wait" : "pointer",
            fontSize: "0.8rem",
          }}>
          {isPending ? "Guardando…" : "✓ Marcar contactado"}
        </button>
      </td>
    </tr>
  );
}

const td = { padding: "0.75rem 1rem", verticalAlign: "top" };
const th = { ...td, fontSize: "0.75rem", fontWeight: 600, color: "#6b7280",
             textTransform: "uppercase", letterSpacing: "0.05em",
             borderBottom: "1px solid #e5e7eb", textAlign: "left", background: "#f9fafb" };

// ─── Main component ───────────────────────────────────────────────────────

export default function ClientesMVP() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState(null);
  const [toast, setToast] = useState(null);

  const { data, isLoading, isError, error } = useCustomers({ filter, search });
  const { data: summary } = useCustomersSummary();
  const mark = useMarkContacted();

  async function handleMarkContacted(customerId) {
    setPendingId(customerId);
    try {
      await mark.mutateAsync({ customerId, reason: "Marcado contactado desde panel" });
      setToast({ type: "ok", msg: "Cliente marcado como contactado." });
    } catch (e) {
      setToast({ type: "err", msg: e?.message || "Error al guardar." });
    } finally {
      setPendingId(null);
      setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1400px", margin: "0 auto" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600, color: "#111827" }}>
          Panel de Clientes 360
        </h1>
        <p style={{ margin: "0.25rem 0 0", color: "#6b7280", fontSize: "0.875rem" }}>
          Vista unificada de clientes con priorización por recencia de contacto.
          MVP — feedback a Matias / Sandra.
        </p>
      </header>

      <KpiStrip summary={summary?.summary} />

      <FiltersBar filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} />

      {toast && (
        <div role="alert" style={{
          padding: "0.6rem 1rem", marginBottom: "1rem",
          borderRadius: "0.375rem", fontSize: "0.875rem",
          background: toast.type === "ok" ? "#dcfce7" : "#fee2e2",
          color: toast.type === "ok" ? "#15803d" : "#b91c1c",
          border: `1px solid ${toast.type === "ok" ? "#86efac" : "#fca5a5"}`,
        }}>{toast.msg}</div>
      )}

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "0.5rem", overflow: "hidden" }}>
        {isLoading && <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>Cargando…</div>}
        {isError && (
          <div style={{ padding: "2rem", textAlign: "center", color: "#b91c1c" }}>
            Error: {error?.message || "no se pudo cargar"}
            {error?.status === 401 && <div style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>Iniciá sesión para ver el panel.</div>}
            {error?.status === 403 && <div style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>Pedile al admin el grant <code>clientes.read</code>.</div>}
          </div>
        )}
        {data?.items && (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr>
                  <th style={th}>Cliente</th>
                  <th style={th}>Último contacto</th>
                  <th style={th}>Último presupuesto</th>
                  <th style={{ ...th, textAlign: "right" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ ...td, textAlign: "center", color: "#6b7280", padding: "2rem" }}>
                      Sin clientes que coincidan con los filtros.
                    </td>
                  </tr>
                ) : (
                  data.items.map((c) => (
                    <CustomerRow key={c.id} customer={c}
                      onMarkContacted={handleMarkContacted} pendingId={pendingId} />
                  ))
                )}
              </tbody>
            </table>
            <div style={{ padding: "0.75rem 1rem", color: "#6b7280", fontSize: "0.75rem", borderTop: "1px solid #f3f4f6" }}>
              {data.total} cliente{data.total === 1 ? "" : "s"} · filtro: {filter}{search ? ` · buscando "${search}"` : ""}
            </div>
          </>
        )}
      </div>

      <footer style={{ marginTop: "2rem", fontSize: "0.75rem", color: "#9ca3af" }}>
        <a href="https://github.com/matiasportugau-ui/Calculadora-BMC/blob/main/docs/clientes-360/MVP-1-PANTALLA.md" target="_blank" rel="noreferrer" style={{ color: "#6b7280" }}>
          MVP spec
        </a> · Kill switch a 30 días post-deploy si métrica primaria no se mueve.
      </footer>
    </div>
  );
}
