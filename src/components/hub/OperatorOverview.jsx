// ═══════════════════════════════════════════════════════════════════════════
// src/components/hub/OperatorOverview.jsx
// Aditivo puro para /hub (Wolfboard).
// Muestra resúmenes de:
//   • IA · Control Plane (estado, cooldowns, presupuesto)
//   • Finanzas (KPIs de /api/kpi-financiero + links)
// Todo vía links a los módulos oficiales. Reusa patrones existentes.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useBmcAuth } from "../../hooks/useBmcAuth.js";

const ApiBase = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/+$/, "");
  }
  return "";
})();

async function jget(token, path) {
  const r = await fetch(`${ApiBase}${path}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return r.json();
}

const cardStyle = {
  background: "#fff",
  borderRadius: 10,
  border: "1px solid #e5e5ea",
  boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.05)",
  padding: "14px 16px",
  marginBottom: 12,
};

const sectionTitle = {
  margin: "0 0 8px",
  fontSize: 13,
  fontWeight: 700,
  color: "#1d1d1f",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const linkStyle = {
  fontSize: 12,
  color: "#0071e3",
  textDecoration: "none",
  fontWeight: 600,
};

function StatusBadge({ status }) {
  const map = {
    live: { bg: "#dafbe1", color: "#1a7f37", label: "LIVE" },
    degraded: { bg: "#fff8c5", color: "#9a6700", label: "DEGRADED" },
    disabled: { bg: "#eaeef2", color: "#57606a", label: "OFF" },
    down: { bg: "#ffebe9", color: "#cf222e", label: "DOWN" },
  };
  const m = map[status] || map.down;
  return (
    <span
      style={{
        background: m.bg,
        color: m.color,
        fontSize: 10,
        fontWeight: 700,
        padding: "1px 6px",
        borderRadius: 4,
        letterSpacing: 0.3,
      }}
    >
      {m.label}
    </span>
  );
}

function IaControlSummary({ data, loading, error }) {
  const assistants = data?.assistants || [];
  const active = data?.active || [];
  const cooldowns = data?.assistants?.[0]?.providerCooldowns || {};

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={sectionTitle}>IA · Control Plane</div>
        <Link to="/hub/admin/assistants" style={linkStyle}>Ver plano completo →</Link>
      </div>

      {loading && <div style={{ fontSize: 12, color: "#6e6e73" }}>Cargando estado de asistentes…</div>}
      {error && (
        <div style={{ fontSize: 12, color: "#57606a" }}>
          Datos en vivo requieren acceso admin (rol o token).{" "}
          <Link to="/hub/admin/assistants" style={linkStyle}>Abrir plano completo</Link>
        </div>
      )}

      {!loading && !error && (
        <>
          <div style={{ fontSize: 12, marginBottom: 6 }}>
            Activos: <strong>{active.join(", ") || "—"}</strong>
            {" · "}Proveedores: {data?.providers?.available?.join(" → ") || "—"}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {assistants.slice(0, 5).map((a) => (
              <div
                key={a.key}
                style={{
                  fontSize: 11,
                  background: "#f5f5f7",
                  borderRadius: 6,
                  padding: "3px 8px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{a.label}</span>
                <StatusBadge status={a.status} />
              </div>
            ))}
            {assistants.length > 5 && <span style={{ fontSize: 11, color: "#6e6e73" }}>+{assistants.length - 5}</span>}
          </div>

          {Object.keys(cooldowns || {}).length > 0 && (
            <div style={{ fontSize: 11, color: "#9a6700", marginBottom: 4 }}>
              Algunos proveedores en cooldown (ver plano completo para tiempos)
            </div>
          )}

          <div style={{ fontSize: 11, color: "#57606a" }}>
            Presupuesto IA diario: gestionado en el worker. Ver estado completo para consumo por asistente.
          </div>
        </>
      )}
    </div>
  );
}

function FinanzasSummary({ data, loading, error }) {
  const byPeriod = data?.byPeriod || {};
  const pending = data?.pendingPayments || [];
  const metas = data?.metas || [];

  const fmt = (n) => (typeof n === "number" ? n.toLocaleString("es-UY") : "—");

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={sectionTitle}>Finanzas — Resumen</div>
        <Link to="/hub/cotizaciones" style={linkStyle}>Ir a Cotizaciones →</Link>
      </div>

      {loading && <div style={{ fontSize: 12, color: "#6e6e73" }}>Cargando KPIs financieros…</div>}
      {error && (
        <div style={{ fontSize: 12, color: "#57606a" }}>
          Datos en vivo desde planillas (acceso admin recomendado).{" "}
          <Link to="/hub/cotizaciones" style={linkStyle}>Ver cotizaciones</Link>
        </div>
      )}

      {!loading && !error && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: "#6e6e73" }}>Esta semana</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>${fmt(byPeriod.estaSemana)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#6e6e73" }}>Próxima semana</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>${fmt(byPeriod.proximaSemana)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#6e6e73" }}>Este mes</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>${fmt(byPeriod.esteMes)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#6e6e73" }}>Pendientes</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{pending.length}</div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: "#57606a", marginBottom: 6 }}>
            {metas.length > 0 ? `${metas.length} metas cargadas` : "Metas de ventas disponibles en planilla"}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link to="/hub/cotizaciones" style={linkStyle}>Ver cotizaciones</Link>
            <a href="https://docs.google.com/spreadsheets" target="_blank" rel="noreferrer" style={linkStyle}>
              Abrir planillas (Pagos / Ventas)
            </a>
            <Link to="/hub/admin" style={linkStyle}>Admin operativo</Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function OperatorOverview() {
  const auth = useBmcAuth();
  const token = auth?.accessToken;

  const [iaData, setIaData] = useState(null);
  const [iaLoading, setIaLoading] = useState(false);
  const [iaError, setIaError] = useState(null);

  const [finData, setFinData] = useState(null);
  const [finLoading, setFinLoading] = useState(false);
  const [finError, setFinError] = useState(null);

  const loadIA = useCallback(async () => {
    if (!token) {
      setIaError("sin-token");
      return;
    }
    setIaLoading(true);
    setIaError(null);
    try {
      const res = await jget(token, "/api/assistants/status");
      setIaData(res);
    } catch (e) {
      setIaError(e.message || "fetch");
    } finally {
      setIaLoading(false);
    }
  }, [token]);

  const loadFinanzas = useCallback(async () => {
    if (!token) {
      setFinError("sin-token");
      return;
    }
    setFinLoading(true);
    setFinError(null);
    try {
      const res = await jget(token, "/api/kpi-financiero");
      setFinData(res);
    } catch (e) {
      setFinError(e.message || "fetch");
    } finally {
      setFinLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // Intentamos cargar si hay token (el hub suele tener contexto auth)
    loadIA();
    loadFinanzas();
  }, [loadIA, loadFinanzas]);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#1a7f37",
          background: "#dafbe1",
          padding: "2px 7px",
          borderRadius: 4,
        }}>
          CONTROL OPERATIVO
        </span>
        <span style={{ fontSize: 11, color: "#6e6e73" }}>— resúmenes aditivos (datos reales + links oficiales)</span>
      </div>

      <IaControlSummary data={iaData} loading={iaLoading} error={iaError} />
      <FinanzasSummary data={finData} loading={finLoading} error={finError} />
    </div>
  );
}
