import { useEffect, useMemo, useState } from "react";
import { tkApi } from "../shared/api.js";
import { card, colors, dot, formatHm } from "../shared/styles.js";

function range(kind) {
  const now = new Date();
  if (kind === "week") {
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    return { from: from.toISOString(), to: now.toISOString() };
  }
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return { from, to: now.toISOString() };
}

function Bar({ value, max, color }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div
      style={{
        height: 10,
        background: colors.bgSubtle,
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <div style={{ width: `${pct}%`, height: "100%", background: color || colors.accent }} />
    </div>
  );
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function HoursReport() {
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await tkApi.monthReport({ month });
      setReport(r.report || null);
      setPdfUrl(r.pdf_url || "");
    } catch (e) {
      setError(e.message || "load_failed");
    } finally {
      setLoading(false);
    }
  };

  const t = report?.totals;
  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>Reporte mensual de horas</strong>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={{
            marginLeft: "auto",
            padding: "6px 10px",
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            background: "transparent",
            color: colors.text,
          }}
        />
        <button
          onClick={generate}
          disabled={loading}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: `1px solid ${colors.accent}`,
            background: colors.accentSoft,
            color: colors.text,
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Generando…" : "Generar PDF"}
        </button>
      </div>

      {error ? <div style={{ color: colors.danger }}>{error}</div> : null}

      {t ? (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            ["Efectivo", t.effective_seconds],
            ["Coordinación", t.coordinacion_seconds],
            ["Pausa", t.pausa_seconds],
            ["Jornada", t.jornada_seconds],
          ].map(([label, secs]) => (
            <div
              key={label}
              style={{
                flex: "1 1 120px",
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                padding: "8px 12px",
              }}
            >
              <div style={{ fontSize: 11, color: colors.textMuted }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {formatHm(Number(secs || 0))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {report && !report.days?.length ? (
        <div style={{ color: colors.textMuted, fontSize: 13 }}>Sin registros en el mes.</div>
      ) : null}

      {pdfUrl ? (
        <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ color: colors.accent, fontSize: 13 }}>
          Descargar PDF →
        </a>
      ) : report ? (
        <div style={{ color: colors.textMuted, fontSize: 12 }}>
          PDF no disponible (renderizador no configurado en este entorno).
        </div>
      ) : null}
    </div>
  );
}

export default function ReportsView() {
  const [kind, setKind] = useState("week");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await tkApi.reportSummary({ ...range(kind), group_by: "project" });
        if (!cancelled) {
          setRows(r.rows || []);
          setError("");
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "load_failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const max = useMemo(() => rows.reduce((m, r) => Math.max(m, Number(r.seconds || 0)), 0), [rows]);
  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.seconds || 0), 0), [rows]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => setKind("week")}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: `1px solid ${kind === "week" ? colors.accent : colors.border}`,
            background: kind === "week" ? colors.accentSoft : "transparent",
            color: colors.text,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Semana
        </button>
        <button
          onClick={() => setKind("month")}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: `1px solid ${kind === "month" ? colors.accent : colors.border}`,
            background: kind === "month" ? colors.accentSoft : "transparent",
            color: colors.text,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Mes
        </button>
        <div style={{ marginLeft: "auto", color: colors.textMuted, fontSize: 13 }}>
          Total: <strong style={{ color: colors.text }}>{formatHm(total)}</strong>
        </div>
      </div>

      {error ? <div style={{ color: colors.danger }}>{error}</div> : null}

      <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.length === 0 ? (
          <div style={{ color: colors.textMuted, textAlign: "center", padding: 16 }}>
            Sin datos en el período.
          </div>
        ) : (
          rows.map((r) => (
            <div
              key={r.key}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: 12,
                alignItems: "center",
              }}
            >
              <span style={dot(r.color_hex)} />
              <div>
                <div style={{ fontSize: 14, marginBottom: 4 }}>{r.label}</div>
                <Bar value={Number(r.seconds || 0)} max={max} color={r.color_hex} />
              </div>
              <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 14, minWidth: 80, textAlign: "right" }}>
                {formatHm(Number(r.seconds || 0))}
              </div>
            </div>
          ))
        )}
      </div>

      <HoursReport />
    </div>
  );
}
