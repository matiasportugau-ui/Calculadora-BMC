import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCalcApiBase } from "../utils/calcApiBase.js";

const STORAGE_KEY = "bmc_cockpit_token";

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

function canalPill(origen) {
  if (!origen) return null;
  const [bg, fg] = CANAL_COLORS[origen.toUpperCase()] || ["#f0f0f2", "#6e6e73"];
  return <span style={pill(bg, fg)}>{origen}</span>;
}

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

  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [batching, setBatching] = useState(false);
  const [error, setError]       = useState("");
  const [toast, setToast]       = useState("");

  const [detail, setDetail]     = useState(null); // { row }
  const [dRespuesta, setDRespuesta] = useState("");
  const [dLink, setDLink]       = useState("");
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

  const loadPendientes = useCallback(async () => {
    if (!token) { setError("Guardá el token para cargar consultas."); return; }
    setLoading(true);
    setError("");
    const { ok, status, data } = await apiFetch(token, "/api/wolfboard/pendientes");
    setLoading(false);
    if (!ok) { setError(data?.error || `HTTP ${status}`); setRows([]); return; }
    setRows(Array.isArray(data.data) ? data.data : []);
  }, [token]);

  useEffect(() => {
    if (!token) { setRows([]); return; }
    loadPendientes();
  }, [token, loadPendientes]);

  const saveToken = () => {
    const t = tokenInput.trim();
    setStoredToken(t);
    setToken(t);
    if (t) setTokenAutoLoaded(true);
    showToast(t ? "Token guardado." : "Token borrado.");
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
  };

  const closeDetail = () => setDetail(null);

  const saveDetail = async () => {
    if (!detail || !token) return;
    setSaving(true);
    const { ok, data } = await apiFetch(token, "/api/wolfboard/row", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminRow: detail.rowNum, respuesta: dRespuesta, link: dLink }),
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
          Filas pendientes de Admin 2.0 ↔ CRM_Operativo. Generá respuestas IA en lote, editá por fila y cerrá a Enviados.
        </p>

        {/* Token */}
        <div style={card}>
          {tokenAutoLoaded ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "#2a7a2a", fontWeight: 600 }}>Token cargado</span>
              <button type="button" style={{ ...btnGhost, fontSize: 12, padding: "4px 10px" }}
                onClick={() => { setTokenAutoLoaded(false); setStoredToken(""); setToken(""); setTokenInput(""); }}>
                Cambiar token
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#1d1d1f" }}>API Token</label>
              {tokenLoadError && <p style={{ margin: 0, fontSize: 12, color: "#c00" }}>{tokenLoadError}</p>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveToken()}
                  placeholder="API_AUTH_TOKEN"
                  style={{ ...input, maxWidth: 360 }}
                />
                <button type="button" style={btnPrimary} onClick={saveToken}>Guardar</button>
              </div>
            </div>
          )}
        </div>

        {/* Actions toolbar */}
        {token && (
          <div style={{ ...card, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" style={btnGhost} onClick={runSync} disabled={syncing}>
              {syncing ? "Sincronizando…" : "↕ Sincronizar"}
            </button>
            <button type="button" style={btnGreen} onClick={() => runBatch(false)} disabled={batching}>
              {batching ? "Generando…" : "✦ Generar cotizaciones IA"}
            </button>
            <button type="button" style={{ ...btnOrange, fontSize: 12 }} onClick={() => runBatch(true)} disabled={batching}>
              {batching ? "…" : "Re-procesar errores (force)"}
            </button>
            <button type="button" style={{ ...btnGhost, fontSize: 12 }} onClick={loadPendientes} disabled={loading}>
              {loading ? "Cargando…" : "↺ Recargar"}
            </button>
            <a
              href={`${getCalcApiBase().replace(/\/+$/, "")}/api/wolfboard/export`}
              style={{ ...btnGhost, fontSize: 12, textDecoration: "none", display: "inline-block" }}
              target="_blank" rel="noopener noreferrer"
            >
              ↓ Export CSV
            </a>
            {rows.length > 0 && (
              <span style={{ fontSize: 12, color: "#6e6e73", marginLeft: "auto" }}>
                {rows.length} pendiente{rows.length !== 1 ? "s" : ""}
              </span>
            )}
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
                    {["#", "Canal", "Consulta (I)", "Respuesta IA (J)", "Link", "Acciones"].map((h) => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#6e6e73" }}>Cargando…</td></tr>
                  )}
                  {!loading && rows.length === 0 && (
                    <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#6e6e73" }}>Sin consultas pendientes.</td></tr>
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
                      <td style={{ ...td, width: 60 }}>{canalPill(row.origen)}</td>
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
