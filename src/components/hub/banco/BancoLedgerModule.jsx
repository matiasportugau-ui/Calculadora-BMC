// ═══════════════════════════════════════════════════════════════════════════
// Banco — libro de movimientos bancarios METALOG (/hub/banco).
// Import de extractos BROU (XLS "Saldos y Movimientos" o CSV), filtros,
// totales, clasificación inline (categoría + entidad BMC / Expreso Este /
// Personal / Mixta) y resumen mensual para conciliación DGI ↔ banco.
// API: /api/banco/* (server/routes/banco.js).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import { useBmcAuth } from "../../../hooks/useBmcAuth.js";

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

const PAGE_SIZE = 100;

const ui = {
  page: { padding: "24px", maxWidth: 1280, margin: "0 auto", fontFamily: "system-ui, sans-serif", color: "#0f172a" },
  h1: { fontSize: 22, fontWeight: 700, margin: "0 0 4px" },
  sub: { color: "#64748b", fontSize: 13, margin: "0 0 20px" },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 16 },
  row: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" },
  label: { display: "block", fontSize: 11, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 },
  input: { padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, background: "#fff" },
  btn: { padding: "8px 14px", borderRadius: 8, border: "1px solid #0f172a", background: "#0f172a", color: "#fff", fontSize: 13, cursor: "pointer" },
  btnGhost: { padding: "8px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", fontSize: 13, cursor: "pointer" },
  stat: { flex: "1 1 140px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px" },
  statLabel: { fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4 },
  statValue: { fontSize: 18, fontWeight: 700, marginTop: 2 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #e2e8f0", color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" },
  td: { padding: "7px 10px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" },
  num: { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  error: { background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12 },
  okMsg: { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12 },
};

function fmtMoney(v, currency) {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  const s = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return currency === "USD" ? `US$ ${s}` : `$ ${s}`;
}

export default function BancoLedgerModule() {
  const auth = useBmcAuth();
  const fileRef = useRef(null);
  const [accounts, setAccounts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [sums, setSums] = useState({ debito: 0, credito: 0 });
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [summary, setSummary] = useState([]);
  const [showSummary, setShowSummary] = useState(false);
  const [filters, setFilters] = useState({ account_id: "", from: "", to: "", q: "", tipo: "", entidad: "", sin_clasificar: false });
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState(null); // { kind: 'ok'|'error', text }

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
        throw new Error(detail);
      }
      return body;
    },
    [auth.accessToken],
  );

  const loadAccounts = useCallback(async () => {
    const r = await apiFetch("/api/banco/accounts");
    setAccounts(r.accounts || []);
  }, [apiFetch]);

  const buildQuery = useCallback(
    (extra = {}) => {
      const p = new URLSearchParams();
      if (filters.account_id) p.set("account_id", filters.account_id);
      if (filters.from) p.set("from", filters.from);
      if (filters.to) p.set("to", filters.to);
      if (filters.q) p.set("q", filters.q);
      if (filters.tipo) p.set("tipo", filters.tipo);
      if (filters.entidad) p.set("entidad", filters.entidad);
      if (filters.sin_clasificar) p.set("sin_clasificar", "1");
      for (const [k, v] of Object.entries(extra)) p.set(k, String(v));
      return p.toString();
    },
    [filters],
  );

  const loadMovements = useCallback(
    async (nextOffset = 0) => {
      setBusy(true);
      setMessage(null);
      try {
        const r = await apiFetch(`/api/banco/movements?${buildQuery({ limit: PAGE_SIZE, offset: nextOffset })}`);
        setMovements(r.movements || []);
        setSums(r.sums || { debito: 0, credito: 0 });
        setTotal(r.total || 0);
        setOffset(nextOffset);
      } catch (e) {
        setMessage({ kind: "error", text: `No se pudieron cargar movimientos: ${e.message}` });
      } finally {
        setBusy(false);
      }
    },
    [apiFetch, buildQuery],
  );

  const loadSummary = useCallback(async () => {
    try {
      const r = await apiFetch(`/api/banco/summary?${buildQuery({ group: "mes" })}`);
      setSummary(r.rows || []);
    } catch {
      setSummary([]);
    }
  }, [apiFetch, buildQuery]);

  useEffect(() => {
    if (!auth.accessToken) return;
    loadAccounts().catch((e) => setMessage({ kind: "error", text: `Cuentas: ${e.message}` }));
    loadMovements(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.accessToken]);

  useEffect(() => {
    if (showSummary) loadSummary();
  }, [showSummary, loadSummary]);

  async function handleImport(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setMessage(null);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
        reader.onerror = () => reject(reader.error || new Error("read_failed"));
        reader.readAsDataURL(file);
      });
      const r = await apiFetch("/api/banco/import", {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          file_base64: base64,
          ...(filters.account_id ? { account_id: filters.account_id } : {}),
        }),
      });
      const parts = [
        `${r.imported} importados`,
        `${r.duplicates} duplicados omitidos`,
        r.rules_applied ? `${r.rules_applied} clasificados por regla` : null,
        r.errors?.length ? `${r.errors.length} filas con error` : null,
      ].filter(Boolean);
      const warn = r.warnings?.length ? ` ⚠ ${r.warnings.join(" ")}` : "";
      setMessage({ kind: "ok", text: `Extracto "${file.name}" (${r.account?.name}): ${parts.join(" · ")}.${warn}` });
      await loadAccounts();
      await loadMovements(0);
    } catch (e) {
      setMessage({ kind: "error", text: `Import falló: ${e.message}` });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function patchMovement(id, patch) {
    try {
      const r = await apiFetch(`/api/banco/movements/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setMovements((prev) => prev.map((m) => (m.movement_id === id ? { ...m, ...r.movement } : m)));
    } catch (e) {
      setMessage({ kind: "error", text: `No se pudo clasificar: ${e.message}` });
    }
  }

  const currency = accounts.find((a) => a.account_id === filters.account_id)?.currency;
  const neto = (sums.credito || 0) - (sums.debito || 0);

  return (
    <div style={ui.page}>
      <h1 style={ui.h1}>Banco · Movimientos METALOG</h1>
      <p style={ui.sub}>
        Libro de movimientos bancarios (BROU). Importá el export XLS «Saldos y Movimientos» de e-BROU;
        los duplicados y rangos solapados se omiten solos. Clasificá por categoría y entidad para la
        conciliación DGI ↔ facturación ↔ banco.
      </p>

      {message && <div style={message.kind === "ok" ? ui.okMsg : ui.error}>{message.text}</div>}

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
                  {a.name} ({a.currency}) — {a.movement_count} mov.
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
          <div>
            <label style={ui.label}>Buscar</label>
            <input
              style={{ ...ui.input, minWidth: 180 }}
              placeholder="descripción / asunto / doc"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && loadMovements(0)}
            />
          </div>
          <div>
            <label style={ui.label}>Tipo</label>
            <select style={ui.input} value={filters.tipo} onChange={(e) => setFilters((f) => ({ ...f, tipo: e.target.value }))}>
              <option value="">Ambos</option>
              <option value="debito">Débitos</option>
              <option value="credito">Créditos</option>
            </select>
          </div>
          <div>
            <label style={ui.label}>Entidad</label>
            <select style={ui.input} value={filters.entidad} onChange={(e) => setFilters((f) => ({ ...f, entidad: e.target.value }))}>
              {ENTIDADES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, paddingBottom: 8 }}>
            <input
              type="checkbox"
              checked={filters.sin_clasificar}
              onChange={(e) => setFilters((f) => ({ ...f, sin_clasificar: e.target.checked }))}
            />
            Sin clasificar
          </label>
          <button style={ui.btn} disabled={busy} onClick={() => loadMovements(0)}>
            {busy ? "Cargando…" : "Filtrar"}
          </button>
          <button style={ui.btnGhost} onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? "Importando…" : "Importar extracto (XLS/CSV)"}
          </button>
          <input ref={fileRef} type="file" accept=".xls,.xlsx,.csv" style={{ display: "none" }} onChange={handleImport} />
        </div>
      </div>

      <div style={{ ...ui.row, marginBottom: 16 }}>
        <div style={ui.stat}>
          <div style={ui.statLabel}>Movimientos</div>
          <div style={ui.statValue}>{total.toLocaleString("es-UY")}</div>
        </div>
        <div style={ui.stat}>
          <div style={ui.statLabel}>Débitos</div>
          <div style={{ ...ui.statValue, color: "#b91c1c" }}>{fmtMoney(sums.debito, currency)}</div>
        </div>
        <div style={ui.stat}>
          <div style={ui.statLabel}>Créditos</div>
          <div style={{ ...ui.statValue, color: "#15803d" }}>{fmtMoney(sums.credito, currency)}</div>
        </div>
        <div style={ui.stat}>
          <div style={ui.statLabel}>Neto</div>
          <div style={{ ...ui.statValue, color: neto >= 0 ? "#15803d" : "#b91c1c" }}>{fmtMoney(neto, currency)}</div>
        </div>
      </div>

      <div style={ui.card}>
        <button style={{ ...ui.btnGhost, marginBottom: showSummary ? 12 : 0 }} onClick={() => setShowSummary((s) => !s)}>
          {showSummary ? "Ocultar resumen mensual" : "Resumen mensual"}
        </button>
        {showSummary && (
          <table style={ui.table}>
            <thead>
              <tr>
                <th style={ui.th}>Mes</th>
                <th style={{ ...ui.th, ...ui.num }}>Movimientos</th>
                <th style={{ ...ui.th, ...ui.num }}>Débitos</th>
                <th style={{ ...ui.th, ...ui.num }}>Créditos</th>
                <th style={{ ...ui.th, ...ui.num }}>Neto</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((r) => (
                <tr key={r.grupo}>
                  <td style={ui.td}>{r.grupo}</td>
                  <td style={{ ...ui.td, ...ui.num }}>{r.movimientos}</td>
                  <td style={{ ...ui.td, ...ui.num }}>{fmtMoney(r.debito, currency)}</td>
                  <td style={{ ...ui.td, ...ui.num }}>{fmtMoney(r.credito, currency)}</td>
                  <td style={{ ...ui.td, ...ui.num, color: r.neto >= 0 ? "#15803d" : "#b91c1c" }}>{fmtMoney(r.neto, currency)}</td>
                </tr>
              ))}
              {!summary.length && (
                <tr><td style={ui.td} colSpan={5}>Sin datos para el filtro actual.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div style={ui.card}>
        <table style={ui.table}>
          <thead>
            <tr>
              <th style={ui.th}>Fecha</th>
              <th style={ui.th}>Descripción</th>
              <th style={ui.th}>Asunto</th>
              <th style={ui.th}>Dependencia</th>
              <th style={{ ...ui.th, ...ui.num }}>Débito</th>
              <th style={{ ...ui.th, ...ui.num }}>Crédito</th>
              <th style={ui.th}>Categoría</th>
              <th style={ui.th}>Entidad</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.movement_id}>
                <td style={{ ...ui.td, whiteSpace: "nowrap" }}>{m.fecha?.slice(0, 10)}</td>
                <td style={ui.td}>{m.descripcion}</td>
                <td style={ui.td}>{m.asunto || ""}</td>
                <td style={ui.td}>{m.dependencia || ""}</td>
                <td style={{ ...ui.td, ...ui.num, color: "#b91c1c" }}>{fmtMoney(m.debito, m.account_currency)}</td>
                <td style={{ ...ui.td, ...ui.num, color: "#15803d" }}>{fmtMoney(m.credito, m.account_currency)}</td>
                <td style={ui.td}>
                  <input
                    style={{ ...ui.input, width: 130, padding: "4px 8px" }}
                    defaultValue={m.categoria || ""}
                    placeholder="—"
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== (m.categoria || null)) patchMovement(m.movement_id, { categoria: v });
                    }}
                  />
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
            {!movements.length && !busy && (
              <tr>
                <td style={ui.td} colSpan={8}>
                  Sin movimientos. Importá un extracto XLS de e-BROU («Saldos y Movimientos») para empezar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {total > PAGE_SIZE && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
            <button style={ui.btnGhost} disabled={offset === 0 || busy} onClick={() => loadMovements(Math.max(0, offset - PAGE_SIZE))}>
              ← Anteriores
            </button>
            <span style={{ fontSize: 13, color: "#64748b" }}>
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
            </span>
            <button style={ui.btnGhost} disabled={offset + PAGE_SIZE >= total || busy} onClick={() => loadMovements(offset + PAGE_SIZE)}>
              Siguientes →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
