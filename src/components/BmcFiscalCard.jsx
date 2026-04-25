/**
 * BmcFiscalCard — tarjeta de seguimiento BPS/IRAE para el dashboard admin.
 * Consume GET /api/fiscal/bps-irae y muestra semáforo de posición fiscal.
 *
 * Semáforo:
 *   verde   — resultado_neto >= 0 y no hay flag estimated
 *   naranja — estimated: true (datos parciales o sin Sheets Ventas)
 *   rojo    — error de red / 503
 */
import { useEffect, useState } from "react";
import { getCalcApiBase } from "../utils/calcApiBase.js";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif";

const styles = {
  card: {
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #e5e5ea",
    padding: "16px 20px",
    marginBottom: 16,
    fontFamily: FONT,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    color: "#1a3a5c",
    fontFamily: FONT,
  },
  badge: (color) => ({
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 20,
    background: color,
    fontSize: 11,
    fontWeight: 700,
    color: "#fff",
    fontFamily: FONT,
  }),
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: "10px 14px",
  },
  metaBox: {
    background: "#f5f5f7",
    borderRadius: 8,
    padding: "10px 12px",
  },
  metaLabel: {
    margin: "0 0 3px",
    fontSize: 10,
    fontWeight: 600,
    color: "#86868b",
    textTransform: "uppercase",
    fontFamily: FONT,
  },
  metaValue: {
    margin: 0,
    fontSize: 17,
    fontWeight: 700,
    color: "#1d1d1f",
    fontFamily: FONT,
  },
  disclaimer: {
    margin: "12px 0 0",
    fontSize: 10,
    color: "#aeaeb2",
    fontFamily: FONT,
    lineHeight: 1.45,
  },
  errorText: {
    margin: 0,
    fontSize: 13,
    color: "#c00",
    fontFamily: FONT,
  },
};

function fmtUsd(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return `$${Number(n).toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function TrafficLight({ status }) {
  const MAP = {
    green:  { bg: "#2a7a2a", label: "OK" },
    orange: { bg: "#c86000", label: "Estimado" },
    red:    { bg: "#c00",    label: "Sin datos" },
  };
  const { bg, label } = MAP[status] || MAP.orange;
  return <span style={styles.badge(bg)}>{label}</span>;
}

function MetaBox({ label, value }) {
  return (
    <div style={styles.metaBox}>
      <p style={styles.metaLabel}>{label}</p>
      <p style={styles.metaValue}>{value}</p>
    </div>
  );
}

export default function BmcFiscalCard() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchErr, setFetchErr] = useState("");

  useEffect(() => {
    const base = getCalcApiBase().replace(/\/+$/, "");
    fetch(`${base}/api/fiscal/bps-irae`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          setFetchErr(body?.error || `HTTP ${r.status}`);
        } else {
          setData(body);
        }
      })
      .catch((e) => setFetchErr(e.message || "Error de red"))
      .finally(() => setLoading(false));
  }, []);

  // Determine semaphore status
  let trafficStatus = "orange";
  if (fetchErr) {
    trafficStatus = "red";
  } else if (data && !data.estimated && data.resultado_neto >= 0) {
    trafficStatus = "green";
  } else if (data) {
    trafficStatus = "orange";
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          Fiscal — BPS / IRAE{data?.mes_label ? ` · ${data.mes_label}` : ""}
        </h2>
        {!loading && <TrafficLight status={trafficStatus} />}
      </div>

      {loading && (
        <p style={{ margin: 0, fontSize: 13, color: "#6e6e73", fontFamily: FONT }}>
          Cargando estimaciones fiscales…
        </p>
      )}

      {!loading && fetchErr && (
        <p style={styles.errorText}>No se pudo cargar: {fetchErr}</p>
      )}

      {!loading && data && (
        <>
          <div style={styles.grid}>
            <MetaBox label="IVA Ventas (débito)" value={fmtUsd(data.iva_ventas)} />
            <MetaBox label="IVA Compras (crédito)" value={fmtUsd(data.iva_compras)} />
            <MetaBox label="Posición neta IVA" value={fmtUsd(data.resultado_neto)} />
            <MetaBox label="IRAE estimado (25%)" value={fmtUsd(data.irae_estimado)} />
            <MetaBox
              label="BPS empleador (7.5%)"
              value={data.bps_empleador > 0 ? fmtUsd(data.bps_empleador) : "Sin nómina"}
            />
            <MetaBox
              label="Filas del mes"
              value={data.filas_mes != null ? String(data.filas_mes) : "—"}
            />
          </div>
          {data.fiscal_disclaimer && (
            <p style={styles.disclaimer}>{data.fiscal_disclaimer}</p>
          )}
        </>
      )}
    </div>
  );
}
