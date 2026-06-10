import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import CockpitTokenPanel from "./CockpitTokenPanel.jsx";
import BmcFiscalCard from "./BmcFiscalCard.jsx";
import { useCockpitOperatorAuth } from "../hooks/useCockpitOperatorAuth.js";
/** Persisted Wolfboard POST /quote-batch flags (matches server defaults when all true / force false). */
const STORAGE_BATCH_OPTS = "bmc_admin_quote_batch_opts";

function loadQuoteBatchOpts() {
  const defaults = {
    force: false,
    syncToCrm: true,
    createCrmRows: true,
    syncQuoteLink: true,
  };
  try {
    const raw = localStorage.getItem(STORAGE_BATCH_OPTS);
    if (!raw) return defaults;
    const o = JSON.parse(raw);
    return {
      force: Boolean(o.force),
      syncToCrm: o.syncToCrm !== false,
      createCrmRows: o.createCrmRows !== false,
      syncQuoteLink: o.syncQuoteLink !== false,
    };
  } catch {
    return defaults;
  }
}

function saveQuoteBatchOpts(opts) {
  try {
    localStorage.setItem(STORAGE_BATCH_OPTS, JSON.stringify(opts));
  } catch { /* ignore */ }
}

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

const toggleLabelStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  fontSize: 13,
  color: "#1d1d1f",
  cursor: "pointer",
  lineHeight: 1.45,
  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif",
};

const toggleHintStyle = {
  display: "block",
  fontSize: 11,
  color: "#86868b",
  fontWeight: 400,
  marginTop: 2,
};

const CANAL_COLORS = {
  WA:     ["#dcfce7", "#16a34a"],
  EM:     ["#dbeafe", "#1d4ed8"],
  CL:     ["#fef9c3", "#854d0e"],
  LO:     ["#f3e8ff", "#7c3aed"],
  LL:     ["#ffe4e6", "#be123c"],
};

function canalPill(origen) {
  if (!origen) return null;
  const [bg, fg] = CANAL_COLORS[origen.toUpperCase()] || ["#f0f0f2", "#6e6e73"];
  return <span style={pill(bg, fg)}>{origen}</span>;
}

async function apiFetch(token, path, options = {}) {
  const base = getCalcApiBase().replace(/\/+$/, "");
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  const res = await fetch(`${base}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export default function BmcAdminCotizacionesModule() {
  const {
    token,
    tokenAutoLoaded,
    tokenLoadError,
    tokenInput,
    setTokenInput,
    saveToken,
    clearToken,
    isJwt,
    login,
    user,
  } = useCockpitOperatorAuth({ role: "admin" });

  const [listScope, setListScope] = useState("consulta"); // "consulta" | "admin"
  const [rows, setRows]         = useState([]);
  const [sheetRowCount, setSheetRowCount] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [batching, setBatching] = useState(false);
  const [error, setError]       = useState("");
  const [toast, setToast]       = useState("");

  const [batchOpts, setBatchOpts] = useState(() => loadQuoteBatchOpts());

  const [detail, setDetail]     = useState(null); // { row }
  const [dRespuesta, setDRespuesta] = useState("");
  const [dLink, setDLink]       = useState("");
  const [dReplay, setDReplay]   = useState("");
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    saveQuoteBatchOpts(batchOpts);
  }, [batchOpts]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  const setBatchOpt = (key, value) => {
    setBatchOpts((prev) => ({ ...prev, [key]: value }));
  };

  const resetBatchOptsDefaults = () => {
    setBatchOpts({
      force: false,
      syncToCrm: true,
      createCrmRows: true,
      syncQuoteLink: true,
    });
    showToast("Opciones del batch: valores por defecto del servidor.");
  };

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
    loadPendientes();
  }, [token, loadPendientes]);

  const downloadExportCsv = async () => {
    if (!token) return;
    const base = getCalcApiBase().replace(/\/+$/, "");
    const q = `?scope=${encodeURIComponent(listScope)}`;
    try {
      const res = await fetch(`${base}/api/wolfboard/export${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        showToast(d?.error || `Export falló (HTTP ${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wolfboard-pendientes-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast(e?.message || "Error al exportar");
    }
  };

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

  const runBatch = async () => {
    if (!token) return;
    setBatching(true);
    setError("");
    const body = {
      force: batchOpts.force,
      syncToCrm: batchOpts.syncToCrm,
      createCrmRows: batchOpts.createCrmRows,
      syncQuoteLink: batchOpts.syncQuoteLink,
    };
    const { ok, status, data } = await apiFetch(token, "/api/wolfboard/quote-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBatching(false);
    if (!ok) { setError(data?.error || `Batch HTTP ${status}`); return; }
    const flags = [
      body.force ? "force" : null,
      !body.syncToCrm ? "sin CRM" : null,
      !body.createCrmRows ? "sin filas nuevas" : null,
      !body.syncQuoteLink ? "sin link AH" : null,
    ].filter(Boolean);
    const flagHint = flags.length ? ` (${flags.join(", ")})` : "";
    showToast(`IA batch${flagHint}: ${data.successful ?? 0} generadas · ${data.failed ?? 0} fallidas · ${data.skipped ?? 0} omitidas`);
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

  return (
    <div style={wrap}>
      <div style={main}>
        {/* Back */}
        <p style={{ margin: "0 0 8px" }}>
          <Link to="/hub" style={{ fontSize: 13, color: "#0071e3", textDecoration: "none", fontFamily: h1.fontFamily, fontWeight: 600 }}>
            ← Wolfboard
          </Link>
        </p>

        <h1 style={h1}>Admin · Consultas y Cotizaciones</h1>
        <p style={sub}>
          Cotizaciones / consultas del tab <strong>Admin 2.0</strong> (planilla configurada en el servidor). Podés listar solo la cola con consulta (I) o
          <strong> todas las filas con datos</strong> en A–M. Generá respuestas IA en lote, editá por fila y cerrá a Enviados.
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
            onClear={clearToken}
            isJwt={isJwt}
            userEmail={user?.email || ""}
            onLogin={login}
            inputStyle={{ ...input, maxWidth: 360 }}
            btnPrimaryStyle={btnPrimary}
            btnGhostStyle={btnGhost}
          />
        </div>

        {/* Actions toolbar */}
        {token && (
          <div style={{ ...card, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginRight: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#6e6e73" }}>Vista</span>
              <button
                type="button"
                style={listScope === "consulta" ? btnPrimary : btnGhost}
                onClick={() => setListScope("consulta")}
              >
                Con consulta (I)
              </button>
              <button
                type="button"
                style={listScope === "admin" ? btnPrimary : btnGhost}
                onClick={() => setListScope("admin")}
              >
                Todas las filas (Admin)
              </button>
            </div>
            <button type="button" style={btnGhost} onClick={runSync} disabled={syncing}>
              {syncing ? "Sincronizando…" : "↕ Sincronizar"}
            </button>
            <button type="button" style={btnGreen} onClick={runBatch} disabled={batching}>
              {batching ? "Generando…" : "✦ Ejecutar batch IA"}
            </button>
            <button type="button" style={{ ...btnGhost, fontSize: 12 }} onClick={loadPendientes} disabled={loading}>
              {loading ? "Cargando…" : "↺ Recargar"}
            </button>
            <button
              type="button"
              style={{ ...btnGhost, fontSize: 12 }}
              onClick={downloadExportCsv}
            >
              ↓ Export CSV
            </button>
            {(rows.length > 0 || sheetRowCount != null) && (
              <span style={{ fontSize: 12, color: "#6e6e73", marginLeft: "auto" }}>
                {listScope === "consulta" ? (
                  <>
                    {rows.length} con consulta (I)
                    {sheetRowCount != null ? ` · ${sheetRowCount} filas leídas en Admin` : ""}
                  </>
                ) : (
                  <>
                    {rows.length} fila{rows.length !== 1 ? "s" : ""} con datos (A–M)
                    {sheetRowCount != null && sheetRowCount !== rows.length
                      ? ` · ${sheetRowCount} filas devueltas por Sheets`
                      : ""}
                  </>
                )}
              </span>
            )}
          </div>
        )}

        {token && (
          <div style={card}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1a3a5c" }}>
                Opciones del batch IA (<code style={{ fontSize: 12 }}>POST /api/wolfboard/quote-batch</code>)
              </p>
              <button type="button" style={{ ...btnGhost, fontSize: 12, padding: "6px 10px" }} onClick={resetBatchOptsDefaults}>
                Restaurar defaults del servidor
              </button>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 12, color: "#6e6e73", lineHeight: 1.45 }}>
              Activá o desactivá cada flag; se guardan en este navegador. Son las únicas opciones expuestas por el endpoint de batch (además del token).
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={toggleLabelStyle}>
                <input
                  type="checkbox"
                  checked={batchOpts.force}
                  onChange={(e) => setBatchOpt("force", e.target.checked)}
                  style={{ marginTop: 3, flexShrink: 0 }}
                />
                <span>
                  <strong>Forzar reprocesar</strong> filas que ya tienen respuesta en J marcada con ⚠ (error manual).
                  <span style={toggleHintStyle}>Si está desactivado, solo entran filas sin texto en J.</span>
                </span>
              </label>
              <label style={toggleLabelStyle}>
                <input
                  type="checkbox"
                  checked={batchOpts.syncToCrm}
                  onChange={(e) => setBatchOpt("syncToCrm", e.target.checked)}
                  style={{ marginTop: 3, flexShrink: 0 }}
                />
                <span>
                  <strong>Sincronizar con CRM</strong> — leer CRM, escribir AF (respuesta) y operaciones relacionadas.
                  <span style={toggleHintStyle}>Desactivá para solo actualizar columnas J/K/M del Admin.</span>
                </span>
              </label>
              <label style={{ ...toggleLabelStyle, opacity: batchOpts.syncToCrm ? 1 : 0.55 }}>
                <input
                  type="checkbox"
                  checked={batchOpts.createCrmRows}
                  onChange={(e) => setBatchOpt("createCrmRows", e.target.checked)}
                  disabled={!batchOpts.syncToCrm}
                  style={{ marginTop: 3, flexShrink: 0 }}
                />
                <span>
                  <strong>Crear fila nueva en CRM</strong> si no hay coincidencia por consulta (solo si el tab es CRM_Operativo).
                  <span style={toggleHintStyle}>Desactivá en re-ejecuciones para evitar duplicados cuando ya existe la fila.</span>
                </span>
              </label>
              <label style={{ ...toggleLabelStyle, opacity: batchOpts.syncToCrm ? 1 : 0.55 }}>
                <input
                  type="checkbox"
                  checked={batchOpts.syncQuoteLink}
                  onChange={(e) => setBatchOpt("syncQuoteLink", e.target.checked)}
                  disabled={!batchOpts.syncToCrm}
                  style={{ marginTop: 3, flexShrink: 0 }}
                />
                <span>
                  <strong>Escribir link de presupuesto en CRM</strong> (columna AH cuando hay link).
                  <span style={toggleHintStyle}>Desactivá si solo querés texto en AF sin tocar el link.</span>
                </span>
              </label>
            </div>
          </div>
        )}

        {error && <p style={{ color: "#c00", fontSize: 13, margin: "0 0 12px" }}>{error}</p>}

        {/* Table */}
        {token && (
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["#", "Fecha", "Cliente", "Canal", "Estado", "Consulta (I)", "Respuesta IA (J)", "Link", "Replay", "Acciones"].map((h) => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={10} style={{ ...td, textAlign: "center", color: "#6e6e73" }}>Cargando…</td></tr>
                  )}
                  {!loading && rows.length === 0 && (
                    <tr><td colSpan={10} style={{ ...td, textAlign: "center", color: "#6e6e73" }}>
                      {listScope === "admin" ? "Sin filas con datos en el rango leído." : "Sin filas con consulta (columna I). Probá «Todas las filas (Admin)»."}
                    </td></tr>
                  )}
                  {rows.map((row) => (
                    <tr key={row.rowNum} style={{ background: detail?.rowNum === row.rowNum ? "#f0f7ff" : undefined }}>
                      <td style={{ ...td, width: 48 }}>
                        <a
                          href={row.sheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 11, color: "#0071e3", textDecoration: "none", fontWeight: 600 }}
                        >
                          {row.rowNum} ↗
                        </a>
                      </td>
                      <td style={{ ...td, width: 88, fontSize: 11, color: "#6e6e73" }}>
                        {(row.fecha || "").slice(0, 10)}
                      </td>
                      <td style={{ ...td, maxWidth: 100, fontSize: 11 }}>
                        {(row.cliente || "").slice(0, 36)}{row.cliente?.length > 36 ? "…" : ""}
                      </td>
                      <td style={{ ...td, width: 60 }}>{canalPill(row.origen)}</td>
                      <td style={{ ...td, maxWidth: 72, fontSize: 11, color: "#6e6e73" }}>
                        {(row.estado || "—").slice(0, 14)}
                      </td>
                      <td style={{ ...td, maxWidth: 220 }}>
                        {(row.consulta || "").slice(0, 90)}{row.consulta?.length > 90 ? "…" : ""}
                      </td>
                      <td style={{ ...td, maxWidth: 200 }}>
                        {row.respuesta
                          ? <span style={{ color: row.respuesta.startsWith("⚠") ? "#c86000" : "#1d1d1f" }}>
                              {row.respuesta.slice(0, 70)}{row.respuesta.length > 70 ? "…" : ""}
                            </span>
                          : <span style={{ color: "#aaa" }}>—</span>
                        }
                      </td>
                      <td style={{ ...td, width: 60 }}>
                        {row.link
                          ? <a href={row.link} target="_blank" rel="noopener noreferrer" style={{ color: "#0071e3", fontSize: 11 }}>Ver</a>
                          : <span style={{ color: "#aaa" }}>—</span>
                        }
                      </td>
                      <td style={{ ...td, width: 52 }}>
                        {row.replaySnapshotUrl
                          ? <a href={row.replaySnapshotUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#0071e3", fontSize: 11 }} title="JSON replay">JSON</a>
                          : <span style={{ color: "#aaa" }}>—</span>
                        }
                      </td>
                      <td style={{ ...td, width: 120 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detail panel */}
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
              fontFamily: h1.fontFamily,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1a3a5c" }}>
                  Fila {detail.rowNum} {detail.origen && <span style={{ fontWeight: 400, fontSize: 13 }}>· {detail.origen}</span>}
                </h2>
                <button type="button" style={{ ...btnGhost, padding: "4px 10px", fontSize: 13 }} onClick={closeDetail}>✕</button>
              </div>

              <div style={{ marginBottom: 14 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#6e6e73", textTransform: "uppercase" }}>Consulta del cliente (I)</p>
                <p style={{ margin: 0, fontSize: 13, color: "#1d1d1f", background: "#f5f5f7", borderRadius: 8, padding: "10px 12px", lineHeight: 1.55 }}>
                  {detail.consulta || "(sin texto)"}
                </p>
              </div>

              <div style={{ marginBottom: 14 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#6e6e73", textTransform: "uppercase" }}>Respuesta IA (J) — editable</p>
                <textarea
                  value={dRespuesta}
                  onChange={(e) => setDRespuesta(e.target.value)}
                  style={textarea}
                  rows={5}
                  placeholder="Respuesta al cliente…"
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#6e6e73", textTransform: "uppercase" }}>Link presupuesto Drive (K)</p>
                <input
                  type="url"
                  value={dLink}
                  onChange={(e) => setDLink(e.target.value)}
                  style={{ ...input, maxWidth: "100%" }}
                  placeholder="https://drive.google.com/…"
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#6e6e73", textTransform: "uppercase" }}>Replay JSON (M) — GCS o URL pública</p>
                <input
                  type="url"
                  value={dReplay}
                  onChange={(e) => setDReplay(e.target.value)}
                  style={{ ...input, maxWidth: "100%" }}
                  placeholder="https://storage.googleapis.com/…/quotes/…json"
                />
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "#86868b", lineHeight: 1.4 }}>
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
          padding: "10px 18px", fontSize: 13, fontFamily: h1.fontFamily,
          zIndex: 200, boxShadow: "0 4px 20px rgba(0,0,0,.18)", whiteSpace: "nowrap",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
