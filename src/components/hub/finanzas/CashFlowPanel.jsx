import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useBmcAuth } from "../../../hooks/useBmcAuth.js";
import { categoryLabel, taxonomySelectOptions } from "./cashFlowTaxonomy.js";

const ApiBase = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/+$/, "");
  }
  return "";
})();

const ENTIDADES = [
  { value: "", label: "—" },
  { value: "bmc", label: "BMC" },
  { value: "expreso_este", label: "Expreso Este" },
  { value: "personal", label: "Personal" },
  { value: "mixta", label: "Mixta" },
];

const QUEUE_CAP = 50;

const ui = {
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 16 },
  row: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" },
  label: { display: "block", fontSize: 11, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 },
  input: { padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, background: "#fff" },
  btn: { padding: "8px 14px", borderRadius: 8, border: "1px solid #0f172a", background: "#0f172a", color: "#fff", fontSize: 13, cursor: "pointer" },
  stat: { flex: "1 1 140px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px" },
  statLabel: { fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4 },
  statValue: { fontSize: 18, fontWeight: 700, marginTop: 2 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #e2e8f0", color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" },
  td: { padding: "7px 10px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" },
  num: { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  error: { background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12 },
  hint: { fontSize: 12, color: "#64748b", marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: 700, margin: "0 0 12px", color: "#0f172a" },
};

function fmtMoney(v, currency) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  const s = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  if (currency === "MIXED") return s;
  return currency === "USD" ? `US$ ${s}` : `$ ${s}`;
}

export default function CashFlowPanel() {
  const auth = useBmcAuth();
  const [accounts, setAccounts] = useState([]);
  const [filters, setFilters] = useState({ account_id: "", from: "", to: "" });
  const [cashFlow, setCashFlow] = useState(null);
  const [queue, setQueue] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [accountRequired, setAccountRequired] = useState(false);

  const apiFetch = useCallback(
    async (path, opts = {}) => {
      const r = await fetch(`${ApiBase}${path}`, {
        ...opts,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
          ...(opts.headers || {}),
        },
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        const detail = body?.error || `http_${r.status}`;
        const err = new Error(detail);
        err.body = body;
        throw err;
      }
      return body;
    },
    [auth.accessToken],
  );

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams();
    if (filters.account_id) p.set("account_id", filters.account_id);
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    return p.toString();
  }, [filters]);

  const loadAccounts = useCallback(async () => {
    const r = await apiFetch("/api/banco/accounts");
    setAccounts(r.accounts || []);
  }, [apiFetch]);

  const loadData = useCallback(async () => {
    setBusy(true);
    setError(null);
    setAccountRequired(false);
    try {
      const qs = buildQuery();
      const cf = await apiFetch(`/api/banco/cash-flow?${qs}`);
      setCashFlow(cf);
      const q = await apiFetch(`/api/banco/movements?${qs}&sin_clasificar=1&limit=${QUEUE_CAP}&offset=0`);
      setQueue(q.movements || []);
    } catch (e) {
      if (e.message === "account_id_required") {
        setAccountRequired(true);
        setCashFlow(null);
        setQueue([]);
      } else {
        setError(e.message || "load_failed");
      }
    } finally {
      setBusy(false);
    }
  }, [apiFetch, buildQuery]);

  useEffect(() => {
    if (!auth.accessToken) return;
    loadAccounts().catch((e) => setError(e.message));
  }, [auth.accessToken, loadAccounts]);

  useEffect(() => {
    if (!auth.accessToken) return;
    loadData();
  }, [auth.accessToken, loadData]);

  async function patchMovement(id, patch) {
    try {
      const r = await apiFetch(`/api/banco/movements/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setQueue((prev) => prev.filter((m) => m.movement_id !== id));
      if (cashFlow) {
        await loadData();
      } else {
        setQueue((prev) => prev.map((m) => (m.movement_id === id ? { ...m, ...r.movement } : m)));
      }
    } catch (e) {
      setError(`No se pudo clasificar: ${e.message}`);
    }
  }

  const currency = cashFlow?.currency || accounts.find((a) => a.account_id === filters.account_id)?.currency;
  const totals = cashFlow?.totals || { inflow: 0, outflow: 0, net: 0 };
  const catOptions = taxonomySelectOptions();

  return (
    <div>
      <p style={ui.hint}>
        Clasificación managerial para entender flujo de caja — no reemplaza registros contables ni DGI.
        Sin conversión FX: cada cuenta en su moneda nativa.
      </p>

      {error && <div style={ui.error}>{error}</div>}
      {accountRequired && (
        <div style={ui.error}>
          Hay cuentas en distintas monedas. Elegí una cuenta para ver agregados de Cash Flow.
        </div>
      )}

      <div style={ui.card}>
        <div style={ui.row}>
          <div>
            <label style={ui.label}>Cuenta</label>
            <select
              style={ui.input}
              value={filters.account_id}
              onChange={(e) => setFilters((f) => ({ ...f, account_id: e.target.value }))}
            >
              <option value="">Todas</option>
              {accounts.map((a) => (
                <option key={a.account_id} value={a.account_id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={ui.label}>Desde</label>
            <input type="date" style={ui.input} value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          </div>
          <div>
            <label style={ui.label}>Hasta</label>
            <input type="date" style={ui.input} value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          </div>
          <button style={ui.btn} disabled={busy} onClick={loadData}>
            {busy ? "Cargando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {cashFlow && (
        <>
          <div style={{ ...ui.row, marginBottom: 16 }}>
            <div style={ui.stat}>
              <div style={ui.statLabel}>Ingresos</div>
              <div style={{ ...ui.statValue, color: "#15803d" }}>{fmtMoney(totals.inflow, currency)}</div>
            </div>
            <div style={ui.stat}>
              <div style={ui.statLabel}>Egresos</div>
              <div style={{ ...ui.statValue, color: "#b91c1c" }}>{fmtMoney(totals.outflow, currency)}</div>
            </div>
            <div style={ui.stat}>
              <div style={ui.statLabel}>Neto</div>
              <div style={{ ...ui.statValue, color: totals.net >= 0 ? "#15803d" : "#b91c1c" }}>{fmtMoney(totals.net, currency)}</div>
            </div>
            <div style={ui.stat}>
              <div style={ui.statLabel}>Sin clasificar</div>
              <div style={ui.statValue}>{cashFlow.unclassified_count ?? 0}</div>
            </div>
          </div>

          <div style={ui.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h2 style={ui.sectionTitle}>Cola de clasificación</h2>
              <Link to="/hub/finanzas/banco?sin_clasificar=1" style={{ fontSize: 12, color: "#0071e3" }}>
                Ver todos en Banco →
              </Link>
            </div>
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>Fecha</th>
                  <th style={ui.th}>Descripción</th>
                  <th style={{ ...ui.th, ...ui.num }}>Débito</th>
                  <th style={{ ...ui.th, ...ui.num }}>Crédito</th>
                  <th style={ui.th}>Categoría</th>
                  <th style={ui.th}>Entidad</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((m) => (
                  <tr key={m.movement_id}>
                    <td style={{ ...ui.td, whiteSpace: "nowrap" }}>{m.fecha?.slice(0, 10)}</td>
                    <td style={ui.td}>{m.descripcion}</td>
                    <td style={{ ...ui.td, ...ui.num, color: "#b91c1c" }}>{fmtMoney(m.debito, m.account_currency)}</td>
                    <td style={{ ...ui.td, ...ui.num, color: "#15803d" }}>{fmtMoney(m.credito, m.account_currency)}</td>
                    <td style={ui.td}>
                      <select
                        style={{ ...ui.input, padding: "4px 8px", minWidth: 150 }}
                        value={m.categoria || ""}
                        onChange={(e) => patchMovement(m.movement_id, { categoria: e.target.value || null })}
                      >
                        {catOptions.map((o) => (
                          <option key={o.value || "_empty"} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td style={ui.td}>
                      <select
                        style={{ ...ui.input, padding: "4px 8px" }}
                        value={m.entidad || ""}
                        onChange={(e) => patchMovement(m.movement_id, { entidad: e.target.value || null })}
                      >
                        {ENTIDADES.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {!queue.length && !busy && (
                  <tr>
                    <td style={ui.td} colSpan={6}>
                      {cashFlow.unclassified_count > QUEUE_CAP
                        ? `Sin filas en cola (mostrando hasta ${QUEUE_CAP}; hay ${cashFlow.unclassified_count} sin clasificar).`
                        : "No hay movimientos sin clasificar en este filtro."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={ui.card}>
            <h2 style={ui.sectionTitle}>Por mes</h2>
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>Mes</th>
                  <th style={{ ...ui.th, ...ui.num }}>Ingresos</th>
                  <th style={{ ...ui.th, ...ui.num }}>Egresos</th>
                  <th style={{ ...ui.th, ...ui.num }}>Neto</th>
                  <th style={{ ...ui.th, ...ui.num }}>Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {(cashFlow.monthly || []).map((r) => (
                  <tr key={r.month}>
                    <td style={ui.td}>{r.month}</td>
                    <td style={{ ...ui.td, ...ui.num, color: "#15803d" }}>{fmtMoney(r.inflow, currency)}</td>
                    <td style={{ ...ui.td, ...ui.num, color: "#b91c1c" }}>{fmtMoney(r.outflow, currency)}</td>
                    <td style={{ ...ui.td, ...ui.num, color: r.net >= 0 ? "#15803d" : "#b91c1c" }}>{fmtMoney(r.net, currency)}</td>
                    <td style={{ ...ui.td, ...ui.num }}>{fmtMoney(r.cumulative, currency)}</td>
                  </tr>
                ))}
                {!cashFlow.monthly?.length && (
                  <tr><td style={ui.td} colSpan={5}>Sin datos para el filtro actual.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={ui.card}>
            <h2 style={ui.sectionTitle}>Por categoría</h2>
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>Categoría</th>
                  <th style={ui.th}>Tipo</th>
                  <th style={{ ...ui.th, ...ui.num }}>Total (créd − déb)</th>
                </tr>
              </thead>
              <tbody>
                {(cashFlow.by_category || []).map((r) => (
                  <tr key={r.category || "_null"}>
                    <td style={ui.td}>{r.label || categoryLabel(r.category)}</td>
                    <td style={ui.td}>{r.kind || "—"}</td>
                    <td style={{ ...ui.td, ...ui.num, color: r.total >= 0 ? "#15803d" : "#b91c1c" }}>
                      {fmtMoney(r.total, currency)}
                    </td>
                  </tr>
                ))}
                {!cashFlow.by_category?.length && (
                  <tr><td style={ui.td} colSpan={3}>Sin categorías con movimientos.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
