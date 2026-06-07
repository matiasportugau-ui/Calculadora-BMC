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
    </div>
  );
}
