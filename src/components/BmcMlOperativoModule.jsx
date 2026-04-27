import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
function parseMlObs(obs) {
  const m = String(obs || "").match(/Q:(\d+)\s*\|\s*([^|]+?)\s*\|\s*(\S+)\s+(.*?)(?:\s*\|.*)?$/);
  if (!m) return { dateTime: null, itemId: null, itemTitle: null };
  return { dateTime: m[2].trim(), itemId: m[3].trim(), itemTitle: m[4].trim() };
}

// ── per-row status ────────────────────────────────────────────────────────────
function rowStatus(parsed) {
  if (parsed?.enviadoEl)                 return { label: "Enviado",       color: "#00875a", bg: "#e3fcef", dot: "🟢" };
  if (isSi(parsed?.aprobadoEnviar))      return { label: "Aprobado",      color: "#974f0c", bg: "#fff3e0", dot: "🟠" };
  if (parsed?.respuestaSugerida?.trim()) return { label: "Con respuesta", color: "#0055bb", bg: "#e8f0ff", dot: "🔵" };
  return                                        { label: "Sin respuesta", color: "#cc0000", bg: "#fff0f0", dot: "🔴" };
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
  const idle   = { color: "#00cc44", textShadow: "0 0 5px #00ff4455" };
  const yellow = { color: "#ffcc00", textShadow: "0 0 6px #ffcc0077" };
  const green  = { color: "#00ff88", textShadow: "0 0 8px #00ff8855" };
  const red    = { color: "#ff4444", textShadow: "0 0 6px #ff444455" };
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
          return <div key={i} style={style}>{line || " "}</div>;
        })
      )}
      {firing && <span style={{ ...yellow }}> █</span>}
    </div>
  );
}

// ── aircraft switch ───────────────────────────────────────────────────────────
function AircraftSwitch({ label, on, onToggle, disabled }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => !disabled && onToggle()}
        style={{
          background: "#1c1c1e",
          border: `1.5px solid ${on ? "#2a4a2a" : "#3a3a3c"}`,
          borderRadius: 6, padding: "8px 10px",
          boxShadow: on
            ? "inset 0 1px 3px #00000088, 0 2px 4px #00000066, 0 0 10px #00ff6622"
            : "inset 0 1px 3px #00000088, 0 2px 4px #00000066",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.4 : 1,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          minWidth: 52, userSelect: "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
      >
        {/* LED indicator */}
        <div style={{
          width: 10, height: 10, borderRadius: "50%",
          background: on ? "#00ff66" : "#3a1a1a",
          boxShadow: on ? "0 0 8px #00ff66aa, 0 0 3px #00ff66" : "none",
          transition: "background 0.2s, box-shadow 0.2s",
        }} />
        {/* Toggle lever */}
        <div style={{
          width: 14, height: 28, borderRadius: 4,
          background: on ? "#aaaaaa" : "#555555",
          border: "1px solid #666",
          boxShadow: "0 2px 4px #00000077",
          transform: on ? "translateY(-4px)" : "translateY(4px)",
          transition: "transform 0.15s, background 0.15s",
        }} />
      </div>
      {label && (
        <span style={{
          fontSize: 9, fontFamily: MONO,
          color: on ? "#aaffaa" : "#9ca3af",
          textAlign: "center", letterSpacing: 0.5,
          textTransform: "uppercase", maxWidth: 72, lineHeight: 1.2,
          transition: "color 0.2s",
        }}>
          {label}
        </span>
      )}
    </div>
  );
}

// ── covered switch (protective guard for 100% AUTÓNOMO) ───────────────────────
function CoveredSwitch({ label, on, onToggle, coverOpen, onCoverToggle }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative", perspective: "200px" }}>
        <AircraftSwitch label="" on={on} onToggle={onToggle} disabled={!coverOpen} />
        {/* Guard cover — rotates on hinge when opened */}
        <div
          onClick={coverOpen ? undefined : onCoverToggle}
          title={coverOpen ? undefined : "Abrir cobertor primero"}
          style={{
            position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
            background: coverOpen ? "rgba(180,0,0,0.08)" : "rgba(180,0,0,0.60)",
            border: `1.5px solid ${coverOpen ? "rgba(220,38,38,0.15)" : "#dc2626"}`,
            borderRadius: 6,
            transformOrigin: "top center",
            transform: coverOpen ? "rotateX(-80deg)" : "rotateX(0deg)",
            transition: "transform 0.22s ease, background 0.2s, border-color 0.2s",
            backfaceVisibility: "hidden",
            cursor: coverOpen ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: coverOpen ? "none" : "auto",
          }}
        >
          {!coverOpen && (
            <span style={{ fontSize: 12, lineHeight: 1 }}>🔒</span>
          )}
        </div>
        {/* "ABIERTO" warning label, appears below when guard is open */}
        {coverOpen && (
          <div
            onClick={onCoverToggle}
            style={{
              position: "absolute", bottom: -14, left: "50%",
              transform: "translateX(-50%)",
              fontSize: 8, color: "#ff6666", fontFamily: MONO,
              cursor: "pointer", whiteSpace: "nowrap", letterSpacing: 0.4,
            }}
          >
            ⚠ ABIERTO
          </div>
        )}
      </div>
      <span style={{
        fontSize: 9, fontFamily: MONO,
        color: on ? "#ffaaaa" : "#9ca3af",
        textAlign: "center", letterSpacing: 0.5,
        textTransform: "uppercase", maxWidth: 72, lineHeight: 1.2,
        marginTop: coverOpen ? 10 : 0,
        transition: "color 0.2s, margin-top 0.2s",
      }}>
        {label}
      </span>
    </div>
  );
}

// ── eject button ──────────────────────────────────────────────────────────────
function EjectButton({ onEject }) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{
        padding: 7, borderRadius: 10,
        backgroundImage: "repeating-linear-gradient(45deg, #fbbf24 0px, #fbbf24 5px, #1c1c1e 5px, #1c1c1e 11px)",
        border: "2px solid #fbbf24",
        boxShadow: hovered ? "0 0 18px #fbbf2455" : "none",
        transition: "box-shadow 0.2s",
      }}>
        <button
          type="button"
          onMouseDown={() => setPressed(true)}
          onMouseUp={() => { setPressed(false); onEject(); }}
          onMouseLeave={() => { setPressed(false); setHovered(false); }}
          onMouseEnter={() => setHovered(true)}
          style={{
            width: 58, height: 58, borderRadius: "50%",
            background: pressed ? "#b91c1c" : hovered ? "#ef4444" : "#dc2626",
            border: `3px solid ${pressed ? "#450a0a" : "#7f1d1d"}`,
            cursor: "pointer",
            boxShadow: pressed
              ? "0 1px 0 #450a0a, inset 0 2px 4px #00000044"
              : hovered
              ? "0 4px 0 #7f1d1d, 0 0 20px #dc262677"
              : "0 4px 0 #7f1d1d, 0 2px 8px #dc262644",
            transform: pressed ? "translateY(3px)" : "translateY(0px)",
            transition: "transform 0.08s, box-shadow 0.08s, background 0.12s",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 1,
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>⏏</span>
          <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", fontFamily: MONO, letterSpacing: 1 }}>EJECT</span>
        </button>
      </div>
      <span style={{ fontSize: 9, fontFamily: MONO, color: "#ff9966", letterSpacing: 0.5, textTransform: "uppercase" }}>
        CORTAR TODO
      </span>
    </div>
  );
}

// ── automation defaults ────────────────────────────────────────────────────────
const DEFAULT_AUTO = { mlPull: false, crmPull: false, sync: false, generate: false, fullAuto: false };

// ══════════════════════════════════════════════════════════════════════════════
export default function BmcMlOperativoModule() {
  const [tokenInput, setTokenInput]           = useState("");
  const [token, setToken]                     = useState("");
  const [items, setItems]                     = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState("");
  const [toast, setToast]                     = useState("");
  const [tokenLoadError, setTokenLoadError]   = useState("");
  const [tokenAutoLoaded, setTokenAutoLoaded] = useState(false);
  const [cycleLog, setCycleLog]               = useState([]);
  const [firing, setFiring]                   = useState(false);
  const [generating, setGenerating]           = useState(false);
  const [lastSync, setLastSync]               = useState(null);
  const [lastSyncCount, setLastSyncCount]     = useState(null);
  const [expandedRow, setExpandedRow]         = useState(null);

  // ── automation state ───────────────────────────────────────────────────────
  const [auto, setAuto] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bmc-auto-cfg") || "null") || DEFAULT_AUTO; }
    catch { return DEFAULT_AUTO; }
  });
  const [coverOpen, setCoverOpen] = useState(false);
  const [editState, setEditState] = useState({});

  // ── refs for stale-closure safety in intervals ─────────────────────────────
  const autoRef         = useRef(auto);
  const itemsRef        = useRef(items);
  const firingRef       = useRef(firing);
  const generatingRef   = useRef(generating);
  const mlPullTimerRef  = useRef(null);
  const crmPullTimerRef = useRef(null);
  const syncTimerRef    = useRef(null);

  useEffect(() => { autoRef.current = auto; },           [auto]);
  useEffect(() => { itemsRef.current = items; },         [items]);
  useEffect(() => { firingRef.current = firing; },       [firing]);
  useEffect(() => { generatingRef.current = generating; }, [generating]);

  // ── stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const fromMl   = items.filter(i => i.questionId).length;
    const withResp = items.filter(i => i.parsed?.respuestaSugerida?.trim()).length;
    const approved = items.filter(i => isSi(i.parsed?.aprobadoEnviar)).length;
    const sent     = items.filter(i => i.parsed?.enviadoEl).length;
    const noResp   = items.filter(i => !i.parsed?.respuestaSugerida?.trim()).length;
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
        if (!r.ok || !data?.ok) { setTokenLoadError("No se pudo cargar el token del servidor. Pegá API_AUTH_TOKEN manualmente."); return; }
        const t = String(data?.token || "").trim();
        if (t) { setStoredToken(t); setTokenInput(t); setToken(t); setTokenAutoLoaded(true); }
        else setTokenLoadError("El servidor no devolvió token. Pegá API_AUTH_TOKEN manualmente.");
      })
      .catch(() => setTokenLoadError("Error de red al pedir el token."));
  }, []);

  // ── persist automation config ──────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem("bmc-auto-cfg", JSON.stringify(auto));
  }, [auto]);

  // ── sync fullAuto with server autoMode on token load ───────────────────────
  useEffect(() => {
    if (!token) return;
    cockpitFetch(token, "/api/ml/auto-mode")
      .then(({ ok, data }) => {
        if (!ok || data?.autoMode?.fullAuto === undefined) return;
        const serverOn = data.autoMode.fullAuto;
        setAuto(prev => {
          if (serverOn === prev.fullAuto) return prev;
          const next = { ...prev, fullAuto: serverOn };
          if (serverOn) Object.assign(next, { mlPull: true, crmPull: true, sync: true, generate: true });
          return next;
        });
        if (serverOn) setCycleLog(l => [...l, "● SERVIDOR: 100% AUTÓNOMO activo — webhook ML conectado"]);
      })
      .catch(() => {}); // server may not have endpoint yet
  }, [token]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  // ── PULL CRM — load queue ──────────────────────────────────────────────────
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

  // ── PULL ML ────────────────────────────────────────────────────────────────
  const runPullMl = useCallback(async () => {
    if (!token || firingRef.current) return;
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
  }, [token, loadQueue]);

  // ── SYNC CRM ───────────────────────────────────────────────────────────────
  const runSyncCrm = useCallback(async () => {
    if (!token || firingRef.current) return;
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
    setCycleLog(l => [...l, "✓ SYNC COMPLETO"]);
    setFiring(false);
    showToast(`Sync completo: ${n} nueva(s) desde ML.`);
  }, [token, loadQueue]);

  // ── GENERATE RESPONSES ─────────────────────────────────────────────────────
  const runGenerate = useCallback(async () => {
    if (!token || generatingRef.current) return;
    const pending = itemsRef.current.filter(i => !i.parsed?.respuestaSugerida?.trim());
    if (!pending.length) { showToast("Todos los ítems ya tienen respuesta."); return; }
    setGenerating(true); setCycleLog([`▶ GENERAR — ${pending.length} ítem(s) sin respuesta...`]);
    let generated = 0;
    for (const item of pending) {
      const { row, parsed, questionId } = item;
      const consulta = parsed?.consulta?.trim();
      if (!consulta) { setCycleLog(l => [...l, `⚠ FILA ${row}: sin consulta — omitida`]); continue; }
      setCycleLog(l => [...l, `▶ FILA ${row}: generando respuesta IA...`]);
      const { itemId, itemTitle } = parseMlObs(parsed?.observaciones);
      const aiRes = await cockpitFetch(token, "/api/crm/suggest-response", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consulta,
          origen: questionId ? "ML" : "CRM",
          cliente: parsed?.cliente || "",
          producto: itemTitle || "",
          observaciones: parsed?.observaciones || "",
          itemId: itemId || "",
        }),
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
    setCycleLog(l => [...l, "", `✓ GENERADAS ${generated}/${pending.length} respuestas`]);
    setGenerating(false);
    showToast(`${generated} respuesta(s) generada(s).`);
    await loadQueue();
  }, [token, loadQueue]);

  // ── SEND ALL ───────────────────────────────────────────────────────────────
  const runSendAll = useCallback(async () => {
    if (!token || firingRef.current) return;
    const ready = itemsRef.current.filter(i => i.parsed?.respuestaSugerida?.trim() && !i.parsed?.enviadoEl);
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
    setCycleLog(l => [...l, "", `✓ ${sent}/${ready.length} ENVIADOS`]);
    setFiring(false);
    showToast(`${sent} respuesta(s) enviada(s) a ML.`);
    await loadQueue();
  }, [token, loadQueue]);

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
  const saveEdit = async (row, item) => {
    const editText = editState[row]?.text?.trim();
    if (!editText) { showToast("Respuesta vacía"); return; }
    const original = editState[row]?.original || "";
    const { ok, data } = await cockpitFetch(token, "/api/crm/cockpit/save-response", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        row,
        text: editText,
        original,
        question: item.parsed?.consulta || "",
        questionId: item.questionId || "",
      }),
    });
    if (!ok) { showToast(data?.error || "No se pudo guardar"); return; }
    const saved = data.trainingEntry ? " (training guardado)" : "";
    showToast(`Fila ${row}: respuesta guardada${saved}.`);
    setEditState(s => { const n = { ...s }; delete n[row]; return n; });
    await loadQueue();
  };

  // ── AUTOMATISMOS — toggle + eject ──────────────────────────────────────────
  const toggleAuto = useCallback((key) => {
    setAuto(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (key === "fullAuto" && !prev.fullAuto)
        Object.assign(next, { mlPull: true, crmPull: true, sync: true, generate: true });
      // Sync fullAuto toggle to server (fire-and-forget)
      if (key === "fullAuto" && token) {
        cockpitFetch(token, "/api/ml/auto-mode", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !prev.fullAuto }),
        }).catch(() => {});
        const enabling = !prev.fullAuto;
        setCycleLog(l => [...l, enabling
          ? "● SERVIDOR: 100% AUTÓNOMO ON — webhook ML armado"
          : "○ SERVIDOR: 100% AUTÓNOMO OFF — webhook ML desconectado"
        ]);
      }
      return next;
    });
  }, [token]);

  const handleEject = useCallback(() => {
    clearInterval(mlPullTimerRef.current);
    clearInterval(crmPullTimerRef.current);
    clearInterval(syncTimerRef.current);
    mlPullTimerRef.current = null;
    crmPullTimerRef.current = null;
    syncTimerRef.current = null;
    setAuto(DEFAULT_AUTO);
    setCoverOpen(false);
    setCycleLog(l => [...l, "[EJECT] Todos los automatismos desactivados"]);
    // Notify server
    if (token) {
      cockpitFetch(token, "/api/ml/auto-mode", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      }).catch(() => {});
    }
  }, [token]);

  // ── interval setup/teardown ────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(mlPullTimerRef.current);
    clearInterval(crmPullTimerRef.current);
    clearInterval(syncTimerRef.current);
    if (!token) return;

    if (auto.mlPull)
      mlPullTimerRef.current = setInterval(() => runPullMl(), 300_000);   // 5 min

    if (auto.crmPull)
      crmPullTimerRef.current = setInterval(async () => {
        await loadQueue();
        const noResp = itemsRef.current.filter(i => !i.parsed?.respuestaSugerida?.trim()).length;
        if (autoRef.current.generate && noResp > 0) await runGenerate();
        if (autoRef.current.fullAuto) await runSendAll();
      }, 120_000);   // 2 min

    if (auto.sync)
      syncTimerRef.current = setInterval(() => runSyncCrm(), 600_000);    // 10 min

    return () => {
      clearInterval(mlPullTimerRef.current);
      clearInterval(crmPullTimerRef.current);
      clearInterval(syncTimerRef.current);
    };
  }, [auto, token, loadQueue, runPullMl, runSyncCrm, runGenerate, runSendAll]);

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
          <StatPill value={stats.total}    label="En cola"       color="#374151" />
          <StatPill value={stats.fromMl}   label="Desde ML"      color="#a35900" sub="con Q:id" />
          <StatPill value={stats.noResp}   label="Sin respuesta" color="#cc0000" />
          <StatPill value={stats.withResp} label="Con respuesta" color="#0055bb" />
          <StatPill value={stats.approved} label="Aprobados"     color="#974f0c" />
          <StatPill value={stats.sent}     label="Enviados"      color="#00875a" />
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

        {/* ── AUTOMATISMOS panel ── */}
        <div style={{
          background: "#0f0f1a",
          border: "1.5px solid #2a2a3e",
          borderRadius: 12,
          padding: "14px 18px 18px",
          marginBottom: 16,
          boxShadow: "inset 0 0 24px #00000077, 0 2px 10px #00000044",
          backgroundImage: "radial-gradient(ellipse at 50% 0%, #1a1a2e 0%, #0f0f1a 70%)",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#fbbf24", fontFamily: MONO, letterSpacing: 2, textTransform: "uppercase" }}>
                ⚠ AUTOMATISMOS
              </span>
              {Object.values(auto).some(Boolean) && (
                <span style={{
                  fontSize: 9, fontFamily: MONO, color: "#00ff66",
                  background: "#002200", padding: "1px 7px", borderRadius: 10,
                  boxShadow: "0 0 6px #00ff6633", letterSpacing: 0.5,
                }}>
                  ● ACTIVO
                </span>
              )}
              {auto.fullAuto && (
                <span style={{
                  fontSize: 9, fontFamily: MONO, color: "#ff9944",
                  background: "#1a0d00", border: "1px solid #ff994422",
                  padding: "1px 7px", borderRadius: 10, letterSpacing: 0.5,
                }}>
                  🔗 WEBHOOK ML
                </span>
              )}
            </div>
            <span style={{ fontSize: 9, fontFamily: MONO, color: "#4a4a5a" }}>
              TRIGGER: questions topic
            </span>
          </div>
          <p style={{
            margin: "0 0 16px", fontSize: 10, fontStyle: "italic",
            color: "#d97706", fontFamily: MONO, letterSpacing: 0.3,
          }}>
            USE CON PRECAUCIÓN — exceso de automatismos puede generar mucho tiempo libre
          </p>

          {/* Switch grid */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end" }}>
            <AircraftSwitch
              label="ML-AUTO-PULL"
              on={auto.mlPull}
              onToggle={() => toggleAuto("mlPull")}
              disabled={!token}
            />
            <AircraftSwitch
              label="CRM-AUTO-PULL"
              on={auto.crmPull}
              onToggle={() => toggleAuto("crmPull")}
              disabled={!token}
            />
            <AircraftSwitch
              label="AUTO-SYNC"
              on={auto.sync}
              onToggle={() => toggleAuto("sync")}
              disabled={!token}
            />
            <AircraftSwitch
              label={<span style={{ fontSize: 8 }}>AI-RESPONSE<br/>AUTO-GEN</span>}
              on={auto.generate}
              onToggle={() => toggleAuto("generate")}
              disabled={!token}
            />
            <CoveredSwitch
              label="100% AUTÓNOMO"
              on={auto.fullAuto}
              onToggle={() => { toggleAuto("fullAuto"); if (auto.fullAuto) setCoverOpen(false); }}
              coverOpen={coverOpen}
              onCoverToggle={() => setCoverOpen(v => !v)}
            />
            <EjectButton onEject={handleEject} />
          </div>
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
            <span style={{ fontSize: 14, fontWeight: 600, fontFamily: FF }}>Cola ML ({items.length})</span>
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
                    <th style={th}>Fecha / Producto</th>
                    <th style={th}>Consulta</th>
                    <th style={th}>Respuesta sugerida</th>
                    <th style={th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const { row, parsed, questionId } = item;
                    const st = rowStatus(parsed);
                    const src = sourceBadge(questionId);
                    const expanded = expandedRow === row;
                    const { dateTime, itemId, itemTitle } = parseMlObs(parsed?.observaciones);
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
                            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{parsed.enviadoEl.slice(0, 16)}</div>
                          )}
                        </td>
                        <td style={{ ...td, maxWidth: 120 }}>{parsed?.cliente || "—"}</td>
                        <td style={{ ...td, maxWidth: 160 }}>
                          {dateTime && <div style={{ fontSize: 11, color: "#374151", fontWeight: 600 }}>{dateTime}</div>}
                          {itemTitle && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }} title={itemId}>{itemTitle.slice(0, 60)}{itemTitle.length > 60 ? "…" : ""}</div>}
                          {!dateTime && !itemTitle && <span style={{ color: "#9ca3af" }}>—</span>}
                        </td>
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
                          {editState[row] ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <textarea
                                value={editState[row].text}
                                onChange={e => setEditState(s => ({ ...s, [row]: { ...s[row], text: e.target.value } }))}
                                rows={5}
                                style={{ width: "100%", fontSize: 12, fontFamily: FF, padding: 6, borderRadius: 6, border: "1px solid #0071e3", resize: "vertical", boxSizing: "border-box" }}
                              />
                              <div style={{ display: "flex", gap: 4 }}>
                                <button type="button" onClick={() => saveEdit(row, item)}
                                  style={{ flex: 1, padding: "4px 0", borderRadius: 6, border: "none", background: "#0071e3", color: "#fff", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                                  Guardar
                                </button>
                                <button type="button" onClick={() => setEditState(s => { const n = { ...s }; delete n[row]; return n; })}
                                  style={{ flex: 1, padding: "4px 0", borderRadius: 6, border: "1px solid #e5e5ea", background: "#f9f9f9", color: "#374151", fontSize: 11, cursor: "pointer" }}>
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : parsed?.respuestaSugerida ? (
                            <div>
                              <div style={{ color: "#1d1d1f" }}>
                                {expanded
                                  ? parsed.respuestaSugerida
                                  : parsed.respuestaSugerida.slice(0, 100) + (parsed.respuestaSugerida.length > 100 ? "…" : "")}
                              </div>
                              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                                <button type="button" onClick={() => copyText(parsed.respuestaSugerida, "Respuesta")}
                                  style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, border: "1px solid #e5e5ea", background: "#f9f9f9", cursor: "pointer", color: "#374151" }}>
                                  Copiar
                                </button>
                                <button type="button" onClick={() => setEditState(s => ({ ...s, [row]: { text: parsed.respuestaSugerida, original: parsed.respuestaSugerida } }))}
                                  style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, border: "1px solid #d97706", background: "#fffbeb", cursor: "pointer", color: "#92400e" }}>
                                  Editar
                                </button>
                              </div>
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
