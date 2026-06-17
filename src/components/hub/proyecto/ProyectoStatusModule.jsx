import React, { useState, useEffect, useCallback } from "react";
import { useBmcAuth } from "../../../hooks/useBmcAuth.js";

const SECTION_COLORS = {
  "TraKtiMe": { bg: "#eef4ff", accent: "#3b82f6", badge: "#dbeafe" },
  "Seguridad & GCP": { bg: "#fff7ed", accent: "#f97316", badge: "#ffedd5" },
  "Catálogo & Precios": { bg: "#f0fdf4", accent: "#22c55e", badge: "#dcfce7" },
  "Chat & AI": { bg: "#faf5ff", accent: "#a855f7", badge: "#f3e8ff" },
  "Infra & CI": { bg: "#fff1f2", accent: "#f43f5e", badge: "#ffe4e6" },
  "UX & Módulos": { bg: "#f0f9ff", accent: "#0ea5e9", badge: "#e0f2fe" },
};

const PRIORITY_COLORS = {
  p1: { color: "#b91c1c", bg: "#fee2e2", label: "P1 · Crítico" },
  p2: { color: "#b45309", bg: "#fef3c7", label: "P2 · Alto" },
  p3: { color: "#166534", bg: "#dcfce7", label: "P3 · Medio" },
  p4: { color: "#6b7280", bg: "#f3f4f6", label: "P4 · Bajo" },
};

function formatMinutes(min) {
  if (!min) return null;
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "justo ahora";
  if (secs < 3600) return `hace ${Math.floor(secs / 60)} min`;
  return `hace ${Math.floor(secs / 3600)}h`;
}

function ProgressBar({ value, total, color = "#0071e3", height = 6 }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ width: "100%", background: "#e5e7eb", borderRadius: 99, height, overflow: "hidden" }}>
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: color,
          borderRadius: 99,
          transition: "width 0.4s ease",
        }}
      />
    </div>
  );
}

function KpiCard({ value, label, sub, color = "#1a3a5c" }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e5ea",
        borderRadius: 10,
        padding: "12px 14px",
        flex: 1,
        minWidth: 100,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#6e6e73", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function SectionCard({ section }) {
  const theme = SECTION_COLORS[section.name] || { bg: "#f9fafb", accent: "#6b7280", badge: "#e5e7eb" };
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: theme.bg,
        border: `1px solid ${theme.accent}22`,
        borderRadius: 12,
        padding: "14px 16px",
        cursor: "pointer",
      }}
      onClick={() => setExpanded((e) => !e)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#1a3a5c" }}>{section.name}</div>
        <div
          style={{
            background: theme.badge,
            color: theme.accent,
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 99,
            padding: "2px 8px",
            whiteSpace: "nowrap",
          }}
        >
          {section.taskCount} tarea{section.taskCount !== 1 ? "s" : ""}
        </div>
      </div>

      {section.blockedCount > 0 && (
        <div style={{ fontSize: 11, color: "#b91c1c", marginTop: 4, fontWeight: 600 }}>
          ⚠ {section.blockedCount} bloqueada{section.blockedCount !== 1 ? "s" : ""}
        </div>
      )}

      {section.estimatedMinutes > 0 && (
        <div style={{ fontSize: 11, color: "#6e6e73", marginTop: 2 }}>
          ≈ {formatMinutes(section.estimatedMinutes)} estimadas
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        <ProgressBar
          value={section.highCount}
          total={section.taskCount || 1}
          color={theme.accent}
          height={4}
        />
        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>
          {section.highCount} de {section.taskCount} prioridad alta
        </div>
      </div>

      {expanded && section.tasks.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
          {section.tasks.map((t) => {
            const pc = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.p4;
            return (
              <div
                key={t.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e5ea",
                  borderRadius: 7,
                  padding: "6px 9px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 12, color: "#1d1d1f", flex: 1, lineHeight: 1.3 }}>
                  {t.content}
                </div>
                <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
                  {t.durationMin && (
                    <span style={{ fontSize: 10, color: "#6e6e73" }}>{formatMinutes(t.durationMin)}</span>
                  )}
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: pc.color,
                      background: pc.bg,
                      borderRadius: 4,
                      padding: "1px 5px",
                    }}
                  >
                    {t.priority.toUpperCase()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PriorityQueue({ tasks }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {tasks.map((t) => {
        const pc = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.p4;
        return (
          <div
            key={t.id}
            style={{
              background: "#fff",
              border: "1px solid #e5e5ea",
              borderRadius: 9,
              padding: "9px 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: pc.color,
                background: pc.bg,
                borderRadius: 5,
                padding: "2px 7px",
                flexShrink: 0,
              }}
            >
              {t.priority.toUpperCase()}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "#1d1d1f",
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {t.content}
              </div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{t.sectionName}</div>
            </div>
            {t.durationMin && (
              <span
                style={{
                  fontSize: 11,
                  color: "#6e6e73",
                  flexShrink: 0,
                  background: "#f3f4f6",
                  borderRadius: 5,
                  padding: "2px 7px",
                }}
              >
                {formatMinutes(t.durationMin)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ProyectoStatusModule() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncedAt, setSyncedAt] = useState(null);
  const { accessToken } = useBmcAuth();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proyecto/status", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json);
        return;
      }
      setData(json);
      setSyncedAt(json.syncedAt);
    } catch (e) {
      setError({ code: "network_error", message: e.message });
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const S = {
    page: {
      minHeight: "100vh",
      background: "#f5f5f7",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif",
      padding: "24px 20px 48px",
    },
    inner: { maxWidth: 1080, margin: "0 auto" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22, gap: 12 },
    title: { fontSize: 22, fontWeight: 700, color: "#1a3a5c", margin: 0 },
    subtitle: { fontSize: 13, color: "#6e6e73", marginTop: 3 },
    badge: { background: "#e0f2fe", color: "#0284c7", fontSize: 11, fontWeight: 600, borderRadius: 99, padding: "3px 10px" },
    syncBtn: {
      background: "#0071e3",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "7px 14px",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
    },
    card: {
      background: "#fff",
      border: "1px solid #e5e5ea",
      borderRadius: 12,
      padding: "18px 20px",
      boxShadow: "0 1px 3px rgba(0,0,0,.04)",
    },
    sectionTitle: { fontSize: 13, fontWeight: 700, color: "#1a3a5c", marginBottom: 12 },
  };

  if (loading && !data) {
    return (
      <div style={S.page}>
        <div style={S.inner}>
          <div style={{ textAlign: "center", padding: 60, color: "#6e6e73", fontSize: 14 }}>
            Cargando estado del proyecto…
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const isNotConfigured = error.code === "TODOIST_NOT_CONFIGURED";
    return (
      <div style={S.page}>
        <div style={S.inner}>
          <div style={{ ...S.card, maxWidth: 520, margin: "60px auto", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔧</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1a3a5c", marginBottom: 8 }}>
              {isNotConfigured ? "Todoist no configurado" : "Error al cargar"}
            </div>
            <div style={{ fontSize: 13, color: "#6e6e73", lineHeight: 1.5, marginBottom: 18 }}>
              {isNotConfigured
                ? "Agregá tu token personal de Todoist al .env como TODOIST_API_TOKEN y reiniciá la API."
                : error.message}
            </div>
            {isNotConfigured && (
              <div
                style={{
                  background: "#f5f5f7",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: "#374151",
                  textAlign: "left",
                  marginBottom: 16,
                }}
              >
                # .env{"\n"}TODOIST_API_TOKEN=tu_token_aqui{"\n"}TODOIST_BMC_PROJECT_ID=6grV9QhFpvPJ79hx
              </div>
            )}
            <button style={S.syncBtn} onClick={load}>Reintentar</button>
          </div>
        </div>
      </div>
    );
  }

  const { totals, sections, priorityQueue } = data;
  const completedPct = totals.total ? Math.round((totals.completed / totals.total) * 100) : 0;
  const totalHours = totals.estimatedMinutes ? (totals.estimatedMinutes / 60).toFixed(1) : "—";

  return (
    <div style={S.page}>
      <div style={S.inner}>
        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={S.title}>Estado del Proyecto BMC</h1>
              <span style={S.badge}>v3.1.5</span>
            </div>
            <div style={S.subtitle}>
              {syncedAt ? `Sincronizado ${relativeTime(syncedAt)}` : ""}
              {totals.blocked > 0 && (
                <span style={{ color: "#b91c1c", fontWeight: 600, marginLeft: 8 }}>
                  · {totals.blocked} bloqueada{totals.blocked !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          <button style={S.syncBtn} onClick={load} disabled={loading}>
            {loading ? "Actualizando…" : "↻ Actualizar"}
          </button>
        </div>

        {/* Overall progress */}
        <div style={{ ...S.card, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "baseline" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1a3a5c" }}>
              Progreso general
            </span>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#0071e3" }}>{completedPct}%</span>
          </div>
          <ProgressBar value={totals.completed} total={totals.total} height={8} />
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 5 }}>
            {totals.completed} completadas de {totals.total} tareas totales
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
          <KpiCard value={totals.active} label="Activas" sub="sin completar" />
          <KpiCard value={totals.completed} label="Completadas" sub={`${completedPct}% del total`} color="#15803d" />
          <KpiCard
            value={totals.blocked}
            label="Bloqueadas (P1)"
            sub="acción urgente"
            color={totals.blocked > 0 ? "#b91c1c" : "#15803d"}
          />
          <KpiCard value={`${totalHours}h`} label="Estimado restante" sub="activas con tiempo" color="#7c3aed" />
          <KpiCard value={sections.length} label="Áreas" sub="del proyecto" color="#0ea5e9" />
        </div>

        {/* Sections grid */}
        <div style={{ ...S.card, marginBottom: 18 }}>
          <div style={S.sectionTitle}>Áreas del proyecto</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {sections.map((s) => (
              <SectionCard key={s.id} section={s} />
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 10 }}>
            Hacé click en una sección para ver las tareas detalladas.
          </div>
        </div>

        {/* Priority queue */}
        <div style={S.card}>
          <div style={S.sectionTitle}>Cola de prioridad — próximas a atacar</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}>
            Ordenadas por prioridad y tiempo estimado (las más cortas y urgentes primero).
          </div>
          <PriorityQueue tasks={priorityQueue} />
        </div>
      </div>
    </div>
  );
}
