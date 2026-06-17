import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { tkApi } from "../shared/api.js";
import { colors, card, button, input, formatHm } from "../shared/styles.js";

// Month string "YYYY-MM" → [fromISO, toISO) covering that calendar month.
function monthRange(month) {
  const [y, m] = month.split("-").map(Number);
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function OperariosPanel({ canSync = false }) {
  const [month, setMonth] = useState(currentMonth());
  const [operators, setOperators] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [entries, setEntries] = useState([]);

  const range = useMemo(() => monthRange(month), [month]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await tkApi.operators({ from: range.from, to: range.to });
      setOperators(r.operators || []);
      setError("");
    } catch (e) {
      setError(e.message || "load_failed");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    load();
    setExpanded(null);
    setEntries([]);
  }, [load]);

  async function toggleRow(op) {
    if (expanded === op.clockify_user_id) {
      setExpanded(null);
      setEntries([]);
      return;
    }
    setExpanded(op.clockify_user_id);
    setEntries([]);
    try {
      const r = await tkApi.operatorEntries(op.clockify_user_id, {
        from: range.from,
        to: range.to,
      });
      setEntries(r.entries || []);
    } catch (e) {
      setError(e.message || "entries_failed");
    }
  }

  async function syncNow() {
    setSyncing(true);
    try {
      await tkApi.clockifySyncNow();
      await load();
      setError("");
    } catch (e) {
      setError(e.message || "sync_failed");
    } finally {
      setSyncing(false);
    }
  }

  const totalSeconds = operators.reduce((acc, o) => acc + (o.total_seconds || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error ? <div style={{ color: colors.danger }}>{error}</div> : null}

      <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong>Operarios</strong>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: colors.accent,
                background: colors.accentSoft,
                borderRadius: 999,
                padding: "2px 8px",
              }}
            >
              vía Clockify
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value || currentMonth())}
              style={input}
            />
            {canSync ? (
              <button
                onClick={syncNow}
                disabled={syncing}
                style={{ ...button("ghost"), padding: "8px 12px" }}
              >
                {syncing ? "Sincronizando…" : "Sincronizar ahora"}
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div style={{ color: colors.textMuted, padding: 16, textAlign: "center" }}>Cargando…</div>
        ) : operators.length === 0 ? (
          <div style={{ color: colors.textMuted, padding: 16, textAlign: "center" }}>
            Sin datos de Clockify para este mes. {canSync ? "Probá “Sincronizar ahora”." : ""}
          </div>
        ) : (
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: colors.textMuted, textAlign: "left" }}>
                <th>Operario</th>
                <th>Email</th>
                <th>BMC</th>
                <th style={{ textAlign: "right" }}>Entradas</th>
                <th style={{ textAlign: "right" }}>Horas</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((op) => (
                <Fragment key={op.clockify_user_id}>
                  <tr
                    onClick={() => toggleRow(op)}
                    style={{ borderTop: `1px solid ${colors.border}`, cursor: "pointer" }}
                  >
                    <td style={{ padding: "6px 0" }}>{op.name}</td>
                    <td style={{ color: colors.textMuted }}>{op.email || "—"}</td>
                    <td>{op.bmc_user_id ? "✓" : "—"}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {op.entries_count}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 600,
                      }}
                    >
                      {formatHm(op.total_seconds)}
                    </td>
                  </tr>
                  {expanded === op.clockify_user_id ? (
                    <tr>
                      <td colSpan={5} style={{ background: colors.bgSubtle, padding: 8 }}>
                        {entries.length === 0 ? (
                          <div style={{ color: colors.textMuted, fontSize: 12 }}>Sin entradas.</div>
                        ) : (
                          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                            <tbody>
                              {entries.map((e) => (
                                <tr key={e.clockify_entry_id}>
                                  <td style={{ color: colors.textMuted, whiteSpace: "nowrap" }}>
                                    {new Date(e.started_at).toLocaleString()}
                                  </td>
                                  <td>{e.project_name || "—"}</td>
                                  <td>{e.description || ""}</td>
                                  <td
                                    style={{
                                      textAlign: "right",
                                      fontVariantNumeric: "tabular-nums",
                                    }}
                                  >
                                    {formatHm(e.duration_seconds)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${colors.border}`, fontWeight: 700 }}>
                <td colSpan={4} style={{ padding: "6px 0" }}>
                  Total
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {formatHm(totalSeconds)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
