import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import CockpitTokenPanel from "./CockpitTokenPanel.jsx";
import BmcFiscalCard from "./BmcFiscalCard.jsx";

const STORAGE_KEY = "bmc_cockpit_token";
const VIS_COLS_KEY = "bmc_admin_visible_cols";

const FF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif";

/**
 * Admin 2.0 sheet column indices (0-based, A=0).
 * These match the mapAdminSheetRow mapping in server/routes/wolfboard.js.
 */
const COL = {
  ID:        0,  // A
  FECHA:     1,  // B
  TELEFONO:  3,  // D
  CLIENTE:   4,  // E
  CANAL:     5,  // F — used for the canal pill display
  ZONA:      7,  // H
  CONSULTA:  8,  // I
  RESPUESTA: 9,  // J — highlighted if starts with ⚠
  LINK:      10, // K — rendered as a link
  ESTADO:    11, // L
  REPLAY:    12, // M
};

const wrap = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  background: "#f5f5f7",
};

const main = {
  flex: 1,
  padding: "24px 20px 48px",
  maxWidth: 1100,
  margin: "0 auto",
  width: "100%",
  boxSizing: "border-box",
};

const h1 = {
  margin: "0 0 8px",
  fontSize: 24,
  fontWeight: 700,
  color: "#1a3a5c",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif",
};

const sub = {
  margin: "0 0 20px",
  fontSize: 14,
  color: "#6e6e73",
  fontFamily: h1.fontFamily,
  lineHeight: 1.45,
};

const card = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e5e5ea",
  padding: 16,
  marginBottom: 16,
  fontFamily: h1.fontFamily,
};

const btnPrimary = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "none",
  background: "#0071e3",
  color: "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: h1.fontFamily,
};

const btnGhost = {
  ...btnPrimary,
  background: "#fff",
  color: "#1d1d1f",
  border: "1.5px solid #e5e5ea",
};

const btnGreen = { ...btnPrimary, background: "#2a7a2a" };
const btnOrange = { ...btnPrimary, background: "#c86000" };

const input = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1.5px solid #e5e5ea",
  fontSize: 13,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  boxSizing: "border-box",
};

const textarea = {
  ...input,
  fontFamily: h1.fontFamily,
  resize: "vertical",
  minHeight: 90,
};

const th = {
  textAlign: "left",
  padding: "8px 6px",
  borderBottom: "2px solid #e5e5ea",
  color: "#6e6e73",
  fontWeight: 600,
  whiteSpace: "nowrap",
  fontSize: 12,
  fontFamily: h1.fontFamily,
};

const td = {
  padding: "10px 6px",
  borderBottom: "1px solid #f0f0f2",
  verticalAlign: "top",
  fontSize: 12,
  fontFamily: h1.fontFamily,
  maxWidth: 200,
  wordBreak: "break-word",
};

const pill = (color = "#e5e5ea", text = "#1d1d1f") => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 20,
  background: color,
  color: text,
  fontSize: 11,
  fontWeight: 600,
  whiteSpace: "nowrap",
});

const CANAL_COLORS = {
  WA:     ["#dcfce7", "#16a34a"],
  EM:     ["#dbeafe", "#1d4ed8"],
  CL:     ["#fef9c3", "#854d0e"],
  LO:     ["#f3e8ff", "#7c3aed"],
  LL:     ["#ffe4e6", "#be123c"],
};

function getStoredToken() {
  try { return localStorage.getItem(STORAGE_KEY) || ""; } catch { return ""; }
}

function setStoredToken(t) {
  try {
    if (t) localStorage.setItem(STORAGE_KEY, t);
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

async function apiFetch(token, path, options = {}) {
  const base = getCalcApiBase().replace(/\/+$/, "");
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  const res = await fetch(`${base}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export default function BmcAdminCotizacionesModule() {
  const [tokenInput, setTokenInput]     = useState("");
  const [token, setToken]               = useState("");
  const [tokenAutoLoaded, setTokenAutoLoaded] = useState(false);
  const [tokenLoadError, setTokenLoadError]   = useState("");

  const [listScope, setListScope] = useState("consulta"); // "consulta" | "admin"
  const [rows, setRows]         = useState([]);
  const [sheetRowCount, setSheetRowCount] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [batching, setBatching] = useState(false);
  const [error, setError]       = useState("");
  const [toast, setToast]       = useState("");

  // Column headers from sheet row 1
  const [headers, setHeaders]         = useState([]); // [{ index, col, name }]
  const [headersLoading, setHeadersLoading] = useState(false);
  const [colSelectorOpen, setColSelectorOpen] = useState(false);
  // Visible cols: Set of column letters. null = show all.
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const stored = localStorage.getItem(VIS_COLS_KEY);
      if (stored) return new Set(JSON.parse(stored));
    } catch { /* */ }
    return null; // null = show all
  });

  // Inline cell editing
  const [editCell, setEditCell]   = useState(null); // { rowNum, col, colIndex, value }
  const [savingCell, setSavingCell] = useState(false);
  const editInputRef = useRef(null);

  const [detail, setDetail]     = useState(null); // { row }
  const [dRespuesta, setDRespuesta] = useState("");
  const [dLink, setDLink]       = useState("");
  const [dReplay, setDReplay]   = useState("");
  const [saving, setSaving]     = useState(false);

  // Auto-load token
  useEffect(() => {
    const stored = getStoredToken();
    if (stored) {
      setTokenInput(stored);
      setToken(stored);
      setTokenAutoLoaded(true);
      return;
    }
    const base = getCalcApiBase().replace(/\/+$/, "");
    fetch(`${base}/api/crm/cockpit-token`, { credentials: "omit" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d?.ok) { setTokenLoadError(`No se pudo cargar el token (${d?.error || `HTTP ${r.status}`}). Pegalo manualmente.`); return; }
        const t = String(d?.token || "").trim();
        if (t) { setStoredToken(t); setTokenInput(t); setToken(t); setTokenAutoLoaded(true); }
        else { setTokenLoadError("El servidor no devolvió token. Pegalo manualmente."); }
      })
      .catch(() => setTokenLoadError("Error de red al pedir el token. Pegalo manualmente."));
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  // Load sheet headers
  const loadHeaders = useCallback(async () => {
    if (!token) return;
    setHeadersLoading(true);
    const { ok, data } = await apiFetch(token, "/api/wolfboard/sheet-headers");
    setHeadersLoading(false);
    if (!ok || !Array.isArray(data.headers)) return;
    setHeaders(data.headers);
    // visibleCols === null means "show all" — no action needed here
  }, [token]);

  const loadPendientes = useCallback(async () => {
    if (!token) { setError("Guardá el token para cargar consultas."); return; }
    setLoading(true);
    setError("");
    const q = listScope === "admin" ? "?scope=admin" : "?scope=consulta";
    const { ok, status, data } = await apiFetch(token, `/api/wolfboard/pendientes${q}`);
    setLoading(false);
    if (!ok) { setError(data?.error || `HTTP ${status}`); setRows([]); setSheetRowCount(null); return; }
    setRows(Array.isArray(data.data) ? data.data : []);
    setSheetRowCount(typeof data.sheetRowCount === "number" ? data.sheetRowCount : null);
  }, [token, listScope]);

  useEffect(() => {
    if (!token) { setRows([]); return; }
    loadHeaders();
    loadPendientes();
  }, [token, loadHeaders, loadPendientes]);

  const saveToken = () => {
    const t = tokenInput.trim();
    setStoredToken(t);
    setToken(t);
    if (t) setTokenAutoLoaded(true);
    showToast(t ? "Token guardado." : "Token borrado.");
  };

  // Persist visible cols whenever it changes
  useEffect(() => {
    try {
      if (visibleCols === null) {
        localStorage.removeItem(VIS_COLS_KEY);
      } else {
        localStorage.setItem(VIS_COLS_KEY, JSON.stringify([...visibleCols]));
      }
    } catch { /* */ }
  }, [visibleCols]);

  const toggleCol = (colLetter) => {
    setVisibleCols(prev => {
      // null = show all — when toggling we need to materialise
      const base = prev !== null ? new Set(prev) : new Set(headers.map(h => h.col));
      if (base.has(colLetter)) {
        base.delete(colLetter);
      } else {
        base.add(colLetter);
      }
      return base;
    });
  };

  const showAllCols  = () => setVisibleCols(null);
  const hideAllCols  = () => setVisibleCols(new Set());

  // Columns to render (ordered by index)
  const visibleHeaders = headers.filter(h =>
    visibleCols === null ? true : visibleCols.has(h.col)
  );

  // ── Inline cell edit ──────────────────────────────────────────────────────
  const startEdit = (rowNum, col, colIndex, currentValue) => {
    setEditCell({ rowNum, col, colIndex, value: currentValue });
    setTimeout(() => editInputRef.current?.focus(), 30);
  };

  const cancelEdit = () => setEditCell(null);

  const commitEdit = async () => {
    if (!editCell || !token) return;
    setSavingCell(true);
    try {
      const { ok, data } = await apiFetch(token, "/api/wolfboard/cell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminRow: editCell.rowNum, col: editCell.col, value: editCell.value }),
      });
      if (!ok) { showToast(data?.error || "Error al guardar celda"); return; }
      const dry = data.dryRun ? " [dry-run]" : "";
      showToast(`${editCell.col}${editCell.rowNum} guardado${dry}`);
      setEditCell(null);
      await loadPendientes();
    } catch {
      showToast("Error al guardar celda");
    } finally {
      setSavingCell(false);
    }
  };

  const handleCellKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); }
    if (e.key === "Escape") cancelEdit();
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const runSync = async () => {
    if (!token) return;
    setSyncing(true);
    setError("");
    const { ok, status, data } = await apiFetch(token, "/api/wolfboard/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction: "both" }),
    });
    setSyncing(false);
    if (!ok) { setError(data?.error || `Sync HTTP ${status}`); return; }
    const dry = data.dryRun ? " [dry-run]" : "";
    showToast(`Sync OK${dry} · Admin: ${data.updatedAdmin ?? 0} · CRM: ${data.updatedCrm ?? 0} · Omitidos: ${data.skipped ?? 0}`);
    await loadPendientes();
  };

  const runBatch = async (force = false) => {
    if (!token) return;
    setBatching(true);
    setError("");
    const { ok, status, data } = await apiFetch(token, "/api/wolfboard/quote-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force }),
    });
    setBatching(false);
    if (!ok) { setError(data?.error || `Batch HTTP ${status}`); return; }
    showToast(`IA batch: ${data.successful ?? 0} generadas · ${data.failed ?? 0} fallidas · ${data.skipped ?? 0} omitidas`);
    await loadPendientes();
  };

  const openDetail = (row) => {
    setDetail(row);
    setDRespuesta(row.respuesta || "");
    setDLink(row.link || "");
    setDReplay(row.replaySnapshotUrl || "");
  };

  const closeDetail = () => setDetail(null);

  const saveDetail = async () => {
    if (!detail || !token) return;
    setSaving(true);
    const { ok, data } = await apiFetch(token, "/api/wolfboard/row", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminRow: detail.rowNum,
        respuesta: dRespuesta,
        link: dLink,
        replaySnapshotUrl: dReplay,
      }),
    });
    setSaving(false);
    if (!ok) { showToast(data?.error || "Error al guardar"); return; }
    const dry = data.dryRun ? " [dry-run]" : "";
    showToast(`Guardado${dry} · Admin fila ${data.adminRow}${data.crmRow ? ` · CRM ${data.crmRow}` : ""}`);
    closeDetail();
    await loadPendientes();
  };

  const approveDetail = async () => {
    if (!detail || !token) return;
    setSaving(true);
    const { ok, data } = await apiFetch(token, "/api/wolfboard/row", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminRow: detail.rowNum, aprobado: true }),
    });
    setSaving(false);
    if (!ok) { showToast(data?.error || "Error al aprobar"); return; }
    showToast(`Aprobado${data.crmRow ? ` · CRM fila ${data.crmRow}` : ""}`);
    closeDetail();
    await loadPendientes();
  };

  const markEnviado = async (rowNum) => {
    if (!token) return;
    if (!window.confirm(`¿Mover fila ${rowNum} a Enviados? Se borra del Administrador. No se puede deshacer.`)) return;
    const { ok, data } = await apiFetch(token, "/api/wolfboard/enviados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminRow: rowNum, force: true }),
    });
    if (!ok) { showToast(data?.error || "Error al marcar enviado"); return; }
    showToast(`Fila ${rowNum} movida a Enviados${data.dryRun ? " [dry-run]" : ""}`);
    if (detail?.rowNum === rowNum) closeDetail();
    await loadPendientes();
  };

  // Canal pill colour helper
  const canalPill = (origen) => {
    if (!origen) return null;
    const CANAL_COLORS = {
      WA: ["#dcfce7", "#16a34a"], EM: ["#dbeafe", "#1d4ed8"],
      CL: ["#fef9c3", "#854d0e"], LO: ["#f3e8ff", "#7c3aed"], LL: ["#ffe4e6", "#be123c"],
    };
    const [bg, fg] = CANAL_COLORS[origen.toUpperCase()] || ["#f0f0f2", "#6e6e73"];
    return (
      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 20, background: bg, color: fg, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
        {origen}
      </span>
    );
  };

  return (
    <div style={wrap}>
      <div style={main}>
        {/* Back */}
        <p style={{ margin: "0 0 8px" }}>
          <Link to="/hub" style={{ fontSize: 13, color: "#0071e3", textDecoration: "none", fontFamily: FF, fontWeight: 600 }}>
            ← Wolfboard
          </Link>
        </p>

        <h1 style={h1}>Admin · Consultas y Cotizaciones</h1>
        <p style={sub}>
          Vista completa de la planilla <strong>Admin 2.0</strong>. Todas las columnas visibles y editables en vivo. Seleccioná qué columnas mostrar, hacé clic en cualquier celda para editarla y guardala directo en la planilla.
        </p>

        {/* Fiscal BPS/IRAE tracking card */}
        <BmcFiscalCard />

        {/* Token */}
        <div style={card}>
          <CockpitTokenPanel
            tokenAutoLoaded={tokenAutoLoaded}
            tokenLoadError={tokenLoadError}
            tokenInput={tokenInput}
            setTokenInput={setTokenInput}
            onSave={saveToken}
            onClear={() => { setTokenAutoLoaded(false); setStoredToken(""); setToken(""); setTokenInput(""); }}
            inputStyle={{ ...input, maxWidth: 360 }}
            btnPrimaryStyle={btnPrimary}
            btnGhostStyle={btnGhost}
          />
        </div>

        {/* Actions toolbar */}
        {token && (
          <div style={{ ...card, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginRight: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#6e6e73", fontFamily: FF }}>Vista</span>
              <button type="button" style={listScope === "consulta" ? btnPrimary : btnGhost} onClick={() => setListScope("consulta")}>
                Con consulta (I)
              </button>
              <button type="button" style={listScope === "admin" ? btnPrimary : btnGhost} onClick={() => setListScope("admin")}>
                Todas las filas
              </button>
            </div>
            <button type="button" style={btnGhost} onClick={runSync} disabled={syncing}>
              {syncing ? "Sincronizando…" : "↕ Sincronizar"}
            </button>
            <button type="button" style={btnGreen} onClick={() => runBatch(false)} disabled={batching}>
              {batching ? "Generando…" : "✦ Generar IA"}
            </button>
            <button type="button" style={{ ...btnOrange, fontSize: 12 }} onClick={() => runBatch(true)} disabled={batching}>
              {batching ? "…" : "Re-procesar errores"}
            </button>
            <button type="button" style={{ ...btnGhost, fontSize: 12 }} onClick={loadPendientes} disabled={loading}>
              {loading ? "Cargando…" : "↺ Recargar"}
            </button>
            <a
              href={`${getCalcApiBase().replace(/\/+$/, "")}/api/wolfboard/export?token=${encodeURIComponent(token)}&scope=${encodeURIComponent(listScope)}`}
              style={{ ...btnGhost, fontSize: 12, textDecoration: "none", display: "inline-block" }}
              target="_blank" rel="noopener noreferrer"
            >
              ↓ CSV
            </a>
            {(rows.length > 0 || sheetRowCount != null) && (
              <span style={{ fontSize: 12, color: "#6e6e73", marginLeft: "auto", fontFamily: FF }}>
                {rows.length} fila{rows.length !== 1 ? "s" : ""}{sheetRowCount != null ? ` · ${sheetRowCount} leídas` : ""}
              </span>
            )}
          </div>
        )}

        {/* ── Column selector ─────────────────────────────────────────────── */}
        {token && headers.length > 0 && (
          <div style={{ ...card, padding: "10px 14px" }}>
            <button
              type="button"
              style={{ ...btnGhost, fontSize: 12, padding: "4px 10px", display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => setColSelectorOpen(o => !o)}
            >
              <span>{colSelectorOpen ? "▲" : "▼"}</span>
              <span>Columnas ({visibleHeaders.length}/{headers.length} visibles)</span>
              {headersLoading && <span style={{ fontSize: 10, color: "#6e6e73" }}>cargando…</span>}
            </button>

            {colSelectorOpen && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <button type="button" style={{ ...btnGhost, fontSize: 11, padding: "3px 8px" }} onClick={showAllCols}>
                    Mostrar todas
                  </button>
                  <button type="button" style={{ ...btnGhost, fontSize: 11, padding: "3px 8px" }} onClick={hideAllCols}>
                    Ocultar todas
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {headers.map(h => {
                    const isVisible = visibleCols === null || visibleCols.has(h.col);
                    return (
                      <label
                        key={h.col}
                        style={{
                          display: "flex", alignItems: "center", gap: 4, cursor: "pointer",
                          padding: "4px 8px", borderRadius: 6,
                          background: isVisible ? "#e8f0ff" : "#f0f0f2",
                          border: `1px solid ${isVisible ? "#b0c8ff" : "#e5e5ea"}`,
                          fontSize: 11, fontFamily: FF, userSelect: "none",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => toggleCol(h.col)}
                          style={{ margin: 0 }}
                        />
                        <span style={{ fontWeight: 700, color: "#1a3a5c" }}>{h.col}</span>
                        <span style={{ color: "#374151" }}>{h.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p style={{ color: "#c00", fontSize: 13, margin: "0 0 12px", fontFamily: FF }}>{error}</p>}

        {/* ── Full-grid table ─────────────────────────────────────────────── */}
        {token && (
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: visibleHeaders.length * 100 }}>
                <thead>
                  <tr style={{ background: "#f5f7fa" }}>
                    {/* Fixed first col: row number + link */}
                    <th style={{ ...th, position: "sticky", left: 0, background: "#f5f7fa", zIndex: 2, width: 52, minWidth: 52 }}>#</th>
                    {visibleHeaders.map(h => (
                      <th key={h.col} style={{ ...th, minWidth: 80 }}>
                        <span style={{ color: "#1a3a5c", fontWeight: 800 }}>{h.col}</span>
                        <span style={{ color: "#6e6e73", fontWeight: 400, marginLeft: 3 }}>{h.name}</span>
                      </th>
                    ))}
                    <th style={{ ...th, width: 110, minWidth: 110 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={visibleHeaders.length + 2} style={{ ...td, textAlign: "center", color: "#6e6e73" }}>Cargando…</td></tr>
                  )}
                  {!loading && rows.length === 0 && (
                    <tr><td colSpan={visibleHeaders.length + 2} style={{ ...td, textAlign: "center", color: "#6e6e73" }}>
                      {listScope === "admin" ? "Sin filas con datos en el rango leído." : "Sin filas con consulta (columna I). Probá «Todas las filas»."}
                    </td></tr>
                  )}
                  {rows.map((row) => {
                    const isActiveDetail = detail?.rowNum === row.rowNum;
                    return (
                      <tr key={row.rowNum} style={{ background: isActiveDetail ? "#f0f7ff" : "transparent" }}>
                        {/* Row number + sheet link */}
                        <td style={{ ...td, width: 52, position: "sticky", left: 0, background: isActiveDetail ? "#f0f7ff" : "#fff", zIndex: 1, borderRight: "1px solid #e5e5ea" }}>
                          <a
                            href={row.sheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 11, color: "#0071e3", textDecoration: "none", fontWeight: 600 }}
                            title="Abrir en Sheets"
                          >
                            {row.rowNum} ↗
                          </a>
                        </td>

                        {/* Dynamic columns */}
                        {visibleHeaders.map(h => {
                          const cellValue = (row.rawCells || [])[h.index] ?? "";
                          const isEditing = editCell?.rowNum === row.rowNum && editCell?.col === h.col;

                          // Special display based on Admin 2.0 schema column roles
                          const isCanal = h.index === COL.CANAL;
                          const isResp  = h.index === COL.RESPUESTA;  // highlight ⚠ prefix
                          const isLink  = h.index === COL.LINK && cellValue.startsWith("http");

                          return (
                            <td
                              key={h.col}
                              style={{ ...td, maxWidth: 200 }}
                              title={`${h.col}${row.rowNum}: ${cellValue}`}
                            >
                              {isEditing ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  {cellValue.length > 60 || (editCell?.value || "").includes("\n") ? (
                                    <textarea
                                      ref={editInputRef}
                                      value={editCell.value}
                                      onChange={e => setEditCell(s => ({ ...s, value: e.target.value }))}
                                      onKeyDown={handleCellKeyDown}
                                      rows={4}
                                      style={{ ...textarea, minHeight: 60, width: "100%", fontSize: 11 }}
                                    />
                                  ) : (
                                    <input
                                      ref={editInputRef}
                                      type="text"
                                      value={editCell.value}
                                      onChange={e => setEditCell(s => ({ ...s, value: e.target.value }))}
                                      onKeyDown={handleCellKeyDown}
                                      style={{ ...input, fontSize: 11, padding: "4px 7px" }}
                                    />
                                  )}
                                  <div style={{ display: "flex", gap: 4 }}>
                                    <button
                                      type="button"
                                      onClick={commitEdit}
                                      disabled={savingCell}
                                      style={{ ...btnPrimary, fontSize: 10, padding: "3px 8px", flex: 1 }}
                                    >
                                      {savingCell ? "…" : "✓ Guardar"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEdit}
                                      style={{ ...btnGhost, fontSize: 10, padding: "3px 8px" }}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  onClick={() => startEdit(row.rowNum, h.col, h.index, cellValue)}
                                  style={{
                                    cursor: "text",
                                    minHeight: 20,
                                    borderRadius: 4,
                                    padding: "1px 3px",
                                    transition: "background 0.1s",
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = "#f0f4ff"; e.currentTarget.style.outline = "1px solid #b0c8ff"; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = ""; e.currentTarget.style.outline = ""; }}
                                  title={`Clic para editar ${h.col}${row.rowNum}`}
                                >
                                  {isCanal && cellValue ? canalPill(cellValue)
                                    : isLink ? (
                                      <a href={cellValue} target="_blank" rel="noopener noreferrer" style={{ color: "#0071e3", fontSize: 11 }} onClick={e => e.stopPropagation()}>Ver</a>
                                    ) : (
                                      <span style={{
                                        color: isResp && cellValue.startsWith("⚠") ? "#c86000" : cellValue ? "#1d1d1f" : "#bbb",
                                        fontStyle: cellValue ? "normal" : "italic",
                                      }}>
                                        {cellValue
                                          ? cellValue.length > 80 ? cellValue.slice(0, 78) + "…" : cellValue
                                          : "—"}
                                      </span>
                                    )
                                  }
                                </div>
                              )}
                            </td>
                          );
                        })}

                        {/* Actions */}
                        <td style={{ ...td, width: 110 }}>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            <button type="button" style={{ ...btnGhost, fontSize: 11, padding: "4px 8px" }}
                              onClick={() => openDetail(row)}>
                              Editar
                            </button>
                            <button type="button" style={{ ...btnGhost, fontSize: 11, padding: "4px 8px", color: "#c86000" }}
                              onClick={() => markEnviado(row.rowNum)}>
                              Enviado
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detail panel (bulk-edit J/K/M + approve) */}
        {detail && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 100,
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
            onClick={(e) => { if (e.target === e.currentTarget) closeDetail(); }}
          >
            <div style={{
              background: "#fff", borderRadius: "16px 16px 0 0", padding: "24px 20px 32px",
              width: "100%", maxWidth: 680, maxHeight: "85vh", overflowY: "auto",
              fontFamily: FF,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1a3a5c" }}>
                  Fila {detail.rowNum} {detail.origen && <span style={{ fontWeight: 400, fontSize: 13 }}>· {detail.origen}</span>}
                </h2>
                <button type="button" style={{ ...btnGhost, padding: "4px 10px", fontSize: 13 }} onClick={closeDetail}>✕</button>
              </div>

              <div style={{ marginBottom: 14 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#6e6e73", textTransform: "uppercase", fontFamily: FF }}>Consulta del cliente (I)</p>
                <p style={{ margin: 0, fontSize: 13, color: "#1d1d1f", background: "#f5f5f7", borderRadius: 8, padding: "10px 12px", lineHeight: 1.55, fontFamily: FF }}>
                  {detail.consulta || "(sin texto)"}
                </p>
              </div>

              <div style={{ marginBottom: 14 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#6e6e73", textTransform: "uppercase", fontFamily: FF }}>Respuesta IA (J) — editable</p>
                <textarea
                  value={dRespuesta}
                  onChange={(e) => setDRespuesta(e.target.value)}
                  style={textarea}
                  rows={5}
                  placeholder="Respuesta al cliente…"
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#6e6e73", textTransform: "uppercase", fontFamily: FF }}>Link presupuesto Drive (K)</p>
                <input
                  type="url"
                  value={dLink}
                  onChange={(e) => setDLink(e.target.value)}
                  style={{ ...input, maxWidth: "100%" }}
                  placeholder="https://drive.google.com/…"
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#6e6e73", textTransform: "uppercase", fontFamily: FF }}>Replay JSON (M) — GCS o URL pública</p>
                <input
                  type="url"
                  value={dReplay}
                  onChange={(e) => setDReplay(e.target.value)}
                  style={{ ...input, maxWidth: "100%" }}
                  placeholder="https://storage.googleapis.com/…/quotes/…json"
                />
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "#86868b", lineHeight: 1.4, fontFamily: FF }}>
                  Lo llena el batch IA (cotización por cálculo) si hay bucket GCS; podés pegar un export de la calculadora para comparar humano vs sistema.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" style={btnPrimary} onClick={saveDetail} disabled={saving}>
                  {saving ? "Guardando…" : "Guardar en CRM"}
                </button>
                <button type="button" style={btnGreen} onClick={approveDetail} disabled={saving}>
                  Aprobar respuesta
                </button>
                <button type="button" style={{ ...btnGhost, color: "#c86000" }} onClick={() => markEnviado(detail.rowNum)}>
                  Marcar enviado (→ Enviados)
                </button>
                <button type="button" style={btnGhost} onClick={closeDetail}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#1d1d1f", color: "#fff", borderRadius: 12,
          padding: "10px 18px", fontSize: 13, fontFamily: FF,
          zIndex: 200, boxShadow: "0 4px 20px rgba(0,0,0,.18)", whiteSpace: "nowrap",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
