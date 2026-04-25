import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import CockpitTokenPanel from "./CockpitTokenPanel.jsx";

const STORAGE_KEY = "bmc_cockpit_token";
const FF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "'Courier New', Courier, monospace";

// ── helpers ──────────────────────────────────────────────────────────────────
function getStoredToken() {
  try { return localStorage.getItem(STORAGE_KEY) || ""; } catch { return ""; }
}
function setStoredToken(t) {
  try { if (t) localStorage.setItem(STORAGE_KEY, t); else localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
}
async function cockpitFetch(token, path, options = {}) {
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
function isSi(v) { const s = String(v || "").trim().toLowerCase(); return s === "si" || s === "sí"; }

// ── per-row status ────────────────────────────────────────────────────────────
function rowStatus(parsed) {
  if (parsed?.enviadoEl)                     return { label: "Enviado",         color: "#00875a", bg: "#e3fcef", dot: "🟢" };
  if (isSi(parsed?.aprobadoEnviar))          return { label: "Aprobado",        color: "#974f0c", bg: "#fff3e0", dot: "🟠" };
  if (parsed?.respuestaSugerida?.trim())     return { label: "Con respuesta",   color: "#0055bb", bg: "#e8f0ff", dot: "🔵" };
  return                                            { label: "Sin respuesta",   color: "#cc0000", bg: "#fff0f0", dot: "🔴" };
}
function sourceBadge(questionId) {
  if (questionId) return { label: "ML",  color: "#a35900", bg: "#fff3cd", title: `Pregunta ML: ${questionId}` };
  return                 { label: "CRM", color: "#374151", bg: "#f3f4f6", title: "Cargado desde CRM" };
}

// ── shared styles ─────────────────────────────────────────────────────────────
const wrap  = { minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f5f5f7" };
const main  = { flex: 1, padding: "24px 20px 48px", maxWidth: 1180, margin: "0 auto", width: "100%", boxSizing: "border-box" };
const card  = { background: "#fff", borderRadius: 12, border: "1px solid #e5e5ea", padding: 16, marginBottom: 16, fontFamily: FF };
const badge = (color, bg) => ({ display: "inline-block", fontSize: 11, fontWeight: 700, color, background: bg, borderRadius: 5, padding: "1px 7px", letterSpacing: 0.3 });

const th = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #e5e5ea", color: "#6e6e73", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap", fontFamily: FF };
const td = { padding: "9px 10px", borderBottom: "1px solid #f0f0f2", verticalAlign: "top", fontSize: 12, fontFamily: FF };

// ── action button ─────────────────────────────────────────────────────────────
function ActionBtn({ label, icon, desc, color, textColor = "#fff", onClick, disabled, busy }) {
  const base = {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 4, padding: "10px 16px", borderRadius: 10, border: "none", cursor: disabled || busy ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1, fontFamily: FF, transition: "transform 0.08s, box-shadow 0.08s",
    minWidth: 100, flex: 1,
    background: color,
    boxShadow: `0 3px 0 0 ${color}88, 0 2px 8px ${color}44`,
  };
  return (
    <button
      type="button"
      style={base}
      onClick={onClick}
      disabled={disabled || busy}
      title={desc}
      onMouseDown={e => { if (!disabled && !busy) e.currentTarget.style.transform = "translateY(2px)"; }}
      onMouseUp={e => { e.currentTarget.style.transform = ""; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{busy ? "⏳" : icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: textColor, letterSpacing: 0.5 }}>{busy ? "…" : label}</span>
      <span style={{ fontSize: 9, color: `${textColor}bb`, textAlign: "center", lineHeight: 1.3 }}>{desc}</span>
    </button>
  );
}

// ── stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ value, label, color, sub }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "#fff", borderRadius: 10, border: `1.5px solid ${color}44`, padding: "10px 16px", minWidth: 80, flex: 1 }}>
      <span style={{ fontSize: 26, fontWeight: 800, color, fontFamily: FF, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginTop: 3, fontFamily: FF }}>{label}</span>
      {sub && <span style={{ fontSize: 10, color: "#9ca3af", marginTop: 1, fontFamily: FF }}>{sub}</span>}
    </div>
  );
}

// ── CRT log ───────────────────────────────────────────────────────────────────
function CrtLog({ lines, firing, token, queueLen }) {
  const screen = {
    background: "#050f07", border: "1.5px solid #1a3a1a", borderRadius: 6,
    padding: "10px 14px", fontFamily: MONO, fontSize: 12, lineHeight: 1.7, minHeight: 56,
    backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,0,0.03) 3px, rgba(0,255,0,0.03) 6px)",
    boxShadow: "inset 0 0 16px #00000066", overflowY: "auto", maxHeight: 120,
  };
  const idle = { color: "#00cc44", textShadow: "0 0 5px #00ff4455" };
  const yellow = { color: "#ffcc00", textShadow: "0 0 6px #ffcc0077" };
  const green = { color: "#00ff88", textShadow: "0 0 8px #00ff8855" };
  const red = { color: "#ff4444", textShadow: "0 0 6px #ff444455" };
  return (
    <div style={screen}>
      {lines.length === 0 ? (
        <span style={idle}>
          {token
            ? `> QUEUE: ${queueLen} ÍTEM(S) — USÁ LOS BOTONES PARA OPERAR`
            : "> INSERT COIN — CARGÁ EL TOKEN PARA ACTIVAR"}
        </span>
      ) : (
        lines.map((line, i) => {
          const style = line.startsWith("★") ? green
            : line.startsWith("✗") || line.startsWith("⚠") ? red
            : (i === lines.length - 1 && firing) ? yellow
            : idle;
          return <div key={i} style={style}>{line || " "}</div>;
        })
      )}
      {firing && <span style={{ ...yellow }}> █</span>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function BmcMlOperativoModule() {
  const [tokenInput, setTokenInput]       = useState("");
  const [token, setToken]                 = useState("");
  const [items, setItems]                 = useState([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [toast, setToast]                 = useState("");
  const [tokenLoadError, setTokenLoadError] = useState("");
  const [tokenAutoLoaded, setTokenAutoLoaded] = useState(false);
  const [cycleLog, setCycleLog]           = useState([]);
  const [firing, setFiring]               = useState(false);
  const [generating, setGenerating]       = useState(false);
  const [lastSync, setLastSync]           = useState(null);
  const [lastSyncCount, setLastSyncCount] = useState(null);
  const [expandedRow, setExpandedRow]     = useState(null);

  // ── stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const fromMl      = items.filter(i => i.questionId).length;
    const withResp    = items.filter(i => i.parsed?.respuestaSugerida?.trim()).length;
    const approved    = items.filter(i => isSi(i.parsed?.aprobadoEnviar)).length;
    const sent        = items.filter(i => i.parsed?.enviadoEl).length;
    const noResp      = items.filter(i => !i.parsed?.respuestaSugerida?.trim()).length;
    return { total: items.length, fromMl, withResp, approved, sent, noResp };
  }, [items]);

  // ── token bootstrap ────────────────────────────────────────────────────────
  useEffect(() => {
    const stored = getStoredToken();
    if (stored) { setTokenInput(stored); setToken(stored); setTokenAutoLoaded(true); return; }
    const base = getCalcApiBase();
    fetch(`${base.replace(/\/+$/, "")}/api/crm/cockpit-token`, { credentials: "omit" })
      .then(async r => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data?.ok) { setTokenLoadError(`No se pudo cargar el token del servidor. Pegá API_AUTH_TOKEN manualmente.`); return; }
        const t = String(data?.token || "").trim();
        if (t) { setStoredToken(t); setTokenInput(t); setToken(t); setTokenAutoLoaded(true); }
        else setTokenLoadError("El servidor no devolvió token. Pegá API_AUTH_TOKEN manualmente.");
      })
      .catch(() => setTokenLoadError("Error de red al pedir el token."));
  }, []);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  // ── PULL CRM — load queue from CRM ─────────────────────────────────────────
  const loadQueue = useCallback(async () => {
    if (!token) { setError("Guardá el API token para cargar la cola."); return; }
    setLoading(true); setError("");
    const { ok, status, data } = await cockpitFetch(token, "/api/crm/cockpit/ml-queue");
    setLoading(false);
    if (!ok) { setError(data?.error || `HTTP ${status}`); setItems([]); return; }
    setItems(Array.isArray(data.items) ? data.items : []);
  }, [token]);

  useEffect(() => { if (token) loadQueue(); else setItems([]); }, [token, loadQueue]);

  const saveToken = () => {
    const t = tokenInput.trim(); setStoredToken(t); setToken(t);
    if (t) setTokenAutoLoaded(true);
    showToast(t ? "Token guardado." : "Token borrado.");
  };

  // ── PULL ML — sync new questions from ML into CRM ──────────────────────────
  const runPullMl = async () => {
    if (!token || firing) return;
    setFiring(true); setCycleLog(["▶ PULL ML — sincronizando preguntas nuevas..."]); setError("");
    const { ok, status, data } = await cockpitFetch(token, "/api/crm/cockpit/sync-ml", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    if (!ok) {
      setCycleLog([`✗ PULL ML FAILED: ${data?.error || `HTTP ${status}`}`]);
      setFiring(false); return;
    }
    const n = data.synced ?? 0;
    setLastSync(new Date()); setLastSyncCount(n);
    setCycleLog([`✓ PULL ML OK — ${n} pregunta(s) nueva(s) agregada(s) al CRM`]);
    await loadQueue();
    setFiring(false);
  };

  // ── SYNC CRM — pull ML + reload ────────────────────────────────────────────
  const runSyncCrm = async () => {
    if (!token || firing) return;
    setFiring(true); setCycleLog(["▶ SYNC — pull ML + reload CRM..."]); setError("");
    const syncRes = await cockpitFetch(token, "/api/crm/cockpit/sync-ml", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    if (!syncRes.ok) {
      setCycleLog([`✗ SYNC FAILED: ${syncRes.data?.error || `HTTP ${syncRes.status}`}`]);
      setFiring(false); return;
    }
    const n = syncRes.data?.synced ?? 0;
    setLastSync(new Date()); setLastSyncCount(n);
    setCycleLog([`✓ ML → CRM: ${n} nueva(s)`, "▶ Recargando cola..."]);
    await loadQueue();
    setCycleLog(l => [...l, `✓ SYNC COMPLETO`]);
    setFiring(false);
    showToast(`Sync completo: ${n} nueva(s) desde ML.`);
  };

  // ── GENERATE RESPONSES — AI-generate responses for items without one ────────
  const runGenerate = async () => {
    if (!token || generating) return;
    const pending = items.filter(i => !i.parsed?.respuestaSugerida?.trim());
    if (!pending.length) { showToast("Todos los ítems ya tienen respuesta."); return; }
    setGenerating(true); setCycleLog([`▶ GENERAR — ${pending.length} ítem(s) sin respuesta...`]);
    let generated = 0;
    for (const item of pending) {
      const { row, parsed, questionId } = item;
      const consulta = parsed?.consulta?.trim();
      if (!consulta) { setCycleLog(l => [...l, `⚠ FILA ${row}: sin consulta — omitida`]); continue; }
      setCycleLog(l => [...l, `▶ FILA ${row}: generando respuesta IA...`]);
      const aiRes = await cockpitFetch(token, "/api/crm/suggest-response", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consulta, origen: questionId ? "ML" : "CRM", cliente: parsed?.cliente || "" }),
      });
      if (!aiRes.ok) { setCycleLog(l => [...l, `⚠ FILA ${row}: IA falló — ${aiRes.data?.error || "err"}`]); continue; }
      const text = aiRes.data?.text || aiRes.data?.respuesta || "";
      if (!text) { setCycleLog(l => [...l, `⚠ FILA ${row}: respuesta vacía`]); continue; }
      const saveRes = await cockpitFetch(token, "/api/crm/cockpit/save-response", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row, text }),
      });
      if (saveRes.ok) { generated++; setCycleLog(l => [...l, `★ FILA ${row}: respuesta guardada en CRM`]); }
      else setCycleLog(l => [...l, `⚠ FILA ${row}: no se pudo guardar — ${saveRes.data?.error || "err"}`]);
    }
    setCycleLog(l => [...l, ``, `✓ GENERADAS ${generated}/${pending.length} respuestas`]);
    setGenerating(false);
    showToast(`${generated} respuesta(s) generada(s).`);
    await loadQueue();
  };

  // ── SEND ALL — approve + send all items with a response ────────────────────
  const runSendAll = async () => {
    if (!token || firing) return;
    const ready = items.filter(i => i.parsed?.respuestaSugerida?.trim() && !i.parsed?.enviadoEl);
    if (!ready.length) { showToast("No hay ítems listos para enviar."); return; }
    setFiring(true); setCycleLog([`▶ ENVIAR TODO — ${ready.length} ítem(s) con respuesta...`]); setError("");
    let sent = 0;
    for (const item of ready) {
      const { row } = item;
      const apRes = await cockpitFetch(token, "/api/crm/cockpit/approval", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row, approved: true }),
      });
      if (!apRes.ok) { setCycleLog(l => [...l, `⚠ FILA ${row}: aprobar falló`]); continue; }
      const sendRes = await cockpitFetch(token, "/api/crm/cockpit/send-approved", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row }),
      });
      if (sendRes.ok) { sent++; setCycleLog(l => [...l, `★ FILA ${row}: ENVIADO (${sendRes.data?.channel || "ok"})`]); }
      else setCycleLog(l => [...l, `⚠ FILA ${row}: envío falló — ${sendRes.data?.error || "err"}`]);
    }
    setCycleLog(l => [...l, ``, `✓ ${sent}/${ready.length} ENVIADOS`]);
    setFiring(false);
    showToast(`${sent} respuesta(s) enviada(s) a ML.`);
    await loadQueue();
  };

  // ── per-row actions ────────────────────────────────────────────────────────
  const approveRow = async (row) => {
    const { ok, data } = await cockpitFetch(token, "/api/crm/cockpit/approval", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row, approved: true }),
    });
    if (!ok) { showToast(data?.error || "No se pudo aprobar"); return; }
    showToast(`Fila ${row}: aprobado.`); await loadQueue();
  };
  const sendRow = async (row) => {
    const { ok, data } = await cockpitFetch(token, "/api/crm/cockpit/send-approved", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ row }),
    });
    if (!ok) { showToast(data?.error || "No se pudo enviar"); return; }
    showToast(`Fila ${row}: enviado (${data.channel || "ok"}).`); await loadQueue();
  };
  const copyText = async (text, label) => {
    const t = String(text || "").trim();
    if (!t) { showToast("Nada para copiar"); return; }
    try { await navigator.clipboard.writeText(t); showToast(`${label} copiado`); }
    catch { showToast("No se pudo copiar"); }
  };

  const busy = firing || generating;

  return (
    <div style={wrap}>
      <div style={main}>

        {/* ── breadcrumb + title ── */}
        <p style={{ margin: "0 0 6px" }}>
          <Link to="/hub" style={{ fontSize: 13, color: "#0071e3", textDecoration: "none", fontFamily: FF, fontWeight: 600 }}>← Wolfboard</Link>
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#1a3a5c", fontFamily: FF }}>
            Mercado Libre · Operativo
          </h1>
          {lastSync && (
            <span style={{ fontSize: 11, color: "#6e6e73", fontFamily: FF }}>
              Último sync: {lastSync.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })}
              {lastSyncCount !== null && ` · ${lastSyncCount} nueva(s)`}
            </span>
          )}
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6e6e73", fontFamily: FF }}>
          Preguntas con <code>Q:id</code> en CRM_Operativo. Cargá desde ML o CRM, generá respuestas con IA y enviá directamente a MercadoLibre.
        </p>

        {/* ── stats bar ── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <StatPill value={stats.total}    label="En cola"         color="#374151" />
          <StatPill value={stats.fromMl}   label="Desde ML"        color="#a35900" sub="con Q:id" />
          <StatPill value={stats.noResp}   label="Sin respuesta"   color="#cc0000" />
          <StatPill value={stats.withResp} label="Con respuesta"   color="#0055bb" />
          <StatPill value={stats.approved} label="Aprobados"       color="#974f0c" />
          <StatPill value={stats.sent}     label="Enviados"        color="#00875a" />
        </div>

        {/* ── CRT log ── */}
        <div style={{ marginBottom: 12 }}>
          <CrtLog lines={cycleLog} firing={busy} token={token} queueLen={items.length} />
        </div>

        {/* ── action buttons ── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <ActionBtn
            label="PULL ML" icon="⬇" desc="Traer preguntas nuevas de ML al CRM"
            color="#f59e0b" textColor="#1a0a00"
            onClick={runPullMl} disabled={!token} busy={firing}
          />
          <ActionBtn
            label="PULL CRM" icon="📋" desc="Recargar cola desde el CRM"
            color="#3b82f6"
            onClick={loadQueue} disabled={!token} busy={loading}
          />
          <ActionBtn
            label="SYNC" icon="🔄" desc="Pull ML + Pull CRM en un paso"
            color="#10b981"
            onClick={runSyncCrm} disabled={!token} busy={firing}
          />
          <ActionBtn
            label="GENERAR" icon="✨" desc={`IA genera respuestas (${stats.noResp} pendientes)`}
            color="#7c3aed"
            onClick={runGenerate} disabled={!token || stats.noResp === 0} busy={generating}
          />
          <ActionBtn
            label="ENVIAR TODO" icon="🚀" desc={`Aprobar + enviar (${stats.withResp - stats.sent} listos)`}
            color="#dc2626"
            onClick={runSendAll} disabled={!token || stats.withResp === 0} busy={firing}
          />
        </div>

        {/* ── token panel ── */}
        <div style={card}>
          <CockpitTokenPanel
            tokenAutoLoaded={tokenAutoLoaded}
            tokenLoadError={tokenLoadError}
            tokenInput={tokenInput}
            setTokenInput={setTokenInput}
            onSave={saveToken}
            onClear={() => { setTokenAutoLoaded(false); setStoredToken(""); setToken(""); setTokenInput(""); }}
            inputStyle={{ width: "100%", maxWidth: 420, padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e5e5ea", fontSize: 13, fontFamily: MONO, boxSizing: "border-box" }}
            btnPrimaryStyle={{ padding: "8px 14px", borderRadius: 10, border: "none", background: "#0071e3", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FF }}
            btnGhostStyle={{ padding: "8px 14px", borderRadius: 10, border: "1.5px solid #e5e5ea", background: "#fff", color: "#1d1d1f", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FF }}
            actions={null}
          />
        </div>

        {/* ── error ── */}
        {error && (
          <div style={{ ...card, borderColor: "#ffccd0", background: "#fff5f5", color: "#8b0000", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* ── queue table ── */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600, fontFamily: FF }}>
              Cola ML ({items.length})
            </span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { dot: "🔴", label: "Sin respuesta" },
                { dot: "🔵", label: "Con respuesta" },
                { dot: "🟠", label: "Aprobado" },
                { dot: "🟢", label: "Enviado" },
              ].map(({ dot, label }) => (
                <span key={label} style={{ fontSize: 11, color: "#6e6e73", fontFamily: FF }}>{dot} {label}</span>
              ))}
            </div>
          </div>

          {items.length === 0 && !loading ? (
            <p style={{ margin: 0, fontSize: 13, color: "#6e6e73", fontFamily: FF }}>
              Sin ítems. Usá <strong>PULL ML</strong> para traer preguntas nuevas de MercadoLibre, o <strong>PULL CRM</strong> para recargar.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: FF }}>
                <thead>
                  <tr>
                    <th style={th}>Fila</th>
                    <th style={th}>Fuente</th>
                    <th style={th}>Estado</th>
                    <th style={th}>Cliente</th>
                    <th style={th}>Consulta</th>
                    <th style={th}>Respuesta sugerida</th>
                    <th style={th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ row, parsed, questionId }) => {
                    const st = rowStatus(parsed);
                    const src = sourceBadge(questionId);
                    const expanded = expandedRow === row;
                    return (
                      <tr key={row} style={{ background: expanded ? "#f8faff" : "transparent" }}>
                        <td style={{ ...td, color: "#6e6e73" }}>#{row}</td>
                        <td style={td}>
                          <span style={badge(src.color, src.bg)} title={src.title}>{src.label}</span>
                          {questionId && (
                            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{questionId}</div>
                          )}
                        </td>
                        <td style={td}>
                          <span style={badge(st.color, st.bg)}>{st.dot} {st.label}</span>
                          {parsed?.enviadoEl && (
                            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
                              {parsed.enviadoEl.slice(0, 16)}
                            </div>
                          )}
                        </td>
                        <td style={{ ...td, maxWidth: 120 }}>{parsed?.cliente || "—"}</td>
                        <td style={{ ...td, maxWidth: 240 }}>
                          <div
                            onClick={() => setExpandedRow(expanded ? null : row)}
                            style={{ cursor: "pointer" }}
                            title="Click para expandir"
                          >
                            {expanded
                              ? (parsed?.consulta || "—")
                              : (parsed?.consulta || "—").slice(0, 100) + (parsed?.consulta?.length > 100 ? "…" : "")}
                          </div>
                        </td>
                        <td style={{ ...td, maxWidth: 260 }}>
                          {parsed?.respuestaSugerida ? (
                            <div>
                              <div style={{ color: "#1d1d1f" }}>
                                {expanded
                                  ? parsed.respuestaSugerida
                                  : parsed.respuestaSugerida.slice(0, 100) + (parsed.respuestaSugerida.length > 100 ? "…" : "")}
                              </div>
                              <button
                                type="button"
                                onClick={() => copyText(parsed.respuestaSugerida, "Respuesta")}
                                style={{ marginTop: 4, fontSize: 10, padding: "2px 8px", borderRadius: 5, border: "1px solid #e5e5ea", background: "#f9f9f9", cursor: "pointer", color: "#374151" }}
                              >
                                Copiar
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Sin respuesta — usá GENERAR</span>
                          )}
                        </td>
                        <td style={{ ...td, maxWidth: 220 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {!isSi(parsed?.aprobadoEnviar) && parsed?.respuestaSugerida && (
                              <button type="button" onClick={() => approveRow(row)}
                                style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid #d97706", background: "#fffbeb", color: "#92400e", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                                Aprobar
                              </button>
                            )}
                            {!parsed?.enviadoEl && (isSi(parsed?.aprobadoEnviar) || parsed?.respuestaSugerida) && (
                              <button type="button" onClick={() => sendRow(row)}
                                style={{ padding: "4px 10px", borderRadius: 7, border: "none", background: "#0071e3", color: "#fff", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                                Enviar
                              </button>
                            )}
                            {parsed?.enviadoEl && (
                              <span style={{ fontSize: 11, color: "#00875a", fontWeight: 600 }}>✓ Enviado</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── toast ── */}
        {toast && (
          <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1d1d1f", color: "#fff", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontFamily: FF, zIndex: 50, maxWidth: "90vw", boxShadow: "0 4px 16px #0004" }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
