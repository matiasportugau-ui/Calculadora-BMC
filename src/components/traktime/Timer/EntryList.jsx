import { useEffect, useMemo, useState } from "react";
import { tkApi } from "../shared/api.js";
import { colors, dot, formatHm } from "../shared/styles.js";

function groupByDay(entries) {
  const groups = new Map();
  for (const e of entries) {
    const d = new Date(e.started_at);
    const key = d.toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

export default function EntryList({ refreshKey }) {
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await tkApi.listEntries({ limit: 100 });
        if (!cancelled) {
          setEntries(r.entries || []);
          setError("");
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "load_failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const grouped = useMemo(() => groupByDay(entries), [entries]);

  if (error) return <div style={{ color: colors.danger }}>{error}</div>;
  if (!entries.length) {
    return (
      <div style={{ color: colors.textMuted, padding: 24, textAlign: "center" }}>
        No hay registros aún. Empezá el temporizador arriba.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {grouped.map(([day, rows]) => {
        const totalSec = rows.reduce((s, e) => s + (e.duration_seconds || 0), 0);
        return (
          <div key={day}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: `1px solid ${colors.border}`,
                fontSize: 13,
                color: colors.textMuted,
                fontWeight: 600,
              }}
            >
              <span>{day}</span>
              <span>{formatHm(totalSec)}</span>
            </div>
            {rows.map((e) => (
              <div
                key={e.entry_id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                <span style={dot(e.color_hex)} />
                <div>
                  <div style={{ fontSize: 14 }}>{e.description || "(sin descripción)"}</div>
                  <div style={{ fontSize: 12, color: colors.textMuted }}>
                    {e.client_name ? `${e.client_name} · ` : ""}
                    {e.project_name}
                  </div>
                </div>
                <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 14 }}>
                  {e.duration_seconds == null ? "…" : formatHm(e.duration_seconds)}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
