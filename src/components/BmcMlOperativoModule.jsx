import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import CockpitTokenPanel from "./CockpitTokenPanel.jsx";

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

const rowActions = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
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

const input = {
  width: "100%",
  maxWidth: 420,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1.5px solid #e5e5ea",
  fontSize: 13,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  boxSizing: "border-box",
};

const tableWrap = { overflowX: "auto" };

const table = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
  fontFamily: h1.fontFamily,
};

const th = {
  textAlign: "left",
  padding: "8px 6px",
  borderBottom: "2px solid #e5e5ea",
  color: "#6e6e73",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const td = {
  padding: "10px 6px",
  borderBottom: "1px solid #f0f0f2",
  verticalAlign: "top",
  maxWidth: 220,
  wordBreak: "break-word",
};

function getStoredToken() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function setStoredToken(t) {
  try {
    if (t) localStorage.setItem(STORAGE_KEY, t);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

async function cockpitFetch(token, path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ── Arcade cabinet styles ────────────────────────────────────────────────────

const arcadeCabinet = {
  background: "linear-gradient(180deg, #12021f 0%, #0d0118 60%, #12021f 100%)",
  border: "3px solid #ffd700",
  borderRadius: 18,
  padding: "24px 20px 28px",
  marginBottom: 20,
  position: "relative",
  overflow: "hidden",
  boxShadow: "0 0 0 1px #8b6914, 0 8px 32px #0008, inset 0 1px 0 #ffd70033",
};

const arcadeTitle = {
  textAlign: "center",
  fontFamily: "'Courier New', Courier, monospace",
  fontSize: 11,
  letterSpacing: 4,
  color: "#ffd700",
  marginBottom: 14,
  textTransform: "uppercase",
  textShadow: "0 0 8px #ffd70099",
};

const crtScreen = {
  background: "#050f07",
  border: "2px solid #1a3a1a",
  borderRadius: 6,
  padding: "10px 14px",
  marginBottom: 20,
  fontFamily: "'Courier New', Courier, monospace",
  fontSize: 13,
  lineHeight: 1.7,
  minHeight: 72,
  backgroundImage:
    "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,0,0.03) 3px, rgba(0,255,0,0.03) 6px)",
  boxShadow: "inset 0 0 20px #00000088, 0 0 0 1px #0f2e0f",
};

const crtIdle = { color: "#00cc44", textShadow: "0 0 6px #00ff4488" };
const crtFiring = { color: "#ffcc00", textShadow: "0 0 8px #ffcc0099" };
const crtDone = { color: "#00ff88", textShadow: "0 0 10px #00ff8866" };
const crtError = { color: "#ff4444", textShadow: "0 0 8px #ff444488" };

const arcadeControls = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 32,
};

const bigBtnBase = {
  width: 112,
  height: 112,
  borderRadius: "50%",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  gap: 4,
  fontFamily: "'Courier New', Courier, monospace",
  fontWeight: 900,
  fontSize: 13,
  letterSpacing: 1,
  textTransform: "uppercase",
  transition: "transform 0.07s, box-shadow 0.07s",
  userSelect: "none",
  WebkitUserSelect: "none",
  position: "relative",
};

const bigBtnRed = {
  ...bigBtnBase,
  background: "radial-gradient(circle at 38% 32%, #ff9966, #e02200 55%, #7a0800)",
  color: "#fff",
  boxShadow:
    "0 0 0 5px #3a0800, 0 0 0 10px #880000, 0 9px 0 10px #220000, 0 0 40px #ff220055, inset 0 2px 4px #ff6644aa",
  textShadow: "0 1px 2px #00000088",
};

const bigBtnRedActive = {
  ...bigBtnRed,
  transform: "translateY(7px)",
  boxShadow:
    "0 0 0 5px #3a0800, 0 0 0 10px #880000, 0 2px 0 10px #220000, 0 0 60px #ff440099, inset 0 2px 4px #ff6644aa",
};

const bigBtnRedDisabled = {
  ...bigBtnRed,
  opacity: 0.45,
  cursor: "not-allowed",
};

const smallBtnArcade = {
  width: 52,
  height: 52,
  borderRadius: "50%",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  gap: 2,
  fontFamily: "'Courier New', Courier, monospace",
  fontWeight: 700,
  fontSize: 9,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  transition: "transform 0.07s, box-shadow 0.07s",
  userSelect: "none",
};

const smallBtnYellow = {
  ...smallBtnArcade,
  background: "radial-gradient(circle at 38% 32%, #ffe066, #ccaa00 55%, #7a6200)",
  color: "#1a0a00",
  boxShadow:
    "0 0 0 3px #3a2c00, 0 0 0 6px #665500, 0 5px 0 6px #221a00, 0 0 20px #ffcc0044",
  textShadow: "0 1px 0 #ffffff44",
};

const smallBtnBlue = {
  ...smallBtnArcade,
  background: "radial-gradient(circle at 38% 32%, #66aaff, #0055cc 55%, #003388)",
  color: "#fff",
  boxShadow:
    "0 0 0 3px #001a44, 0 0 0 6px #003388, 0 5px 0 6px #001122, 0 0 20px #0066ff44",
};

const scoreDisplay = {
  textAlign: "center",
  fontFamily: "'Courier New', Courier, monospace",
  color: "#ff6600",
  fontSize: 11,
  letterSpacing: 2,
  marginTop: 16,
  textShadow: "0 0 6px #ff660066",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function BmcMlOperativoModule() {
  const [tokenInput, setTokenInput] = useState("");
  const [token, setToken] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [tokenLoadError, setTokenLoadError] = useState("");
  const [tokenAutoLoaded, setTokenAutoLoaded] = useState(false);
  const [firing, setFiring] = useState(false);
  const [cycleLog, setCycleLog] = useState([]);
  const [cycleScore, setCycleScore] = useState(0);
  const [btnPressed, setBtnPressed] = useState(false);

  useEffect(() => {
    const stored = getStoredToken();
    if (stored) {
      setTokenInput(stored);
      setToken(stored);
      setTokenAutoLoaded(true);
      return;
    }
    const base = getCalcApiBase();
    const url = `${base.replace(/\/+$/, "")}/api/crm/cockpit-token`;
    fetch(url, { credentials: "omit" })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data?.ok) {
          setTokenLoadError(`No se pudo cargar el token del servidor (${data?.error || `HTTP ${r.status}`}). Pegá API_AUTH_TOKEN manualmente.`);
          return;
        }
        const t = String(data?.token || "").trim();
        if (t) {
          setStoredToken(t);
          setTokenInput(t);
          setToken(t);
          setTokenAutoLoaded(true);
          setTokenLoadError("");
        } else {
          setTokenLoadError("El servidor no devolvió token. Pegá API_AUTH_TOKEN manualmente.");
        }
      })
      .catch(() => {
        setTokenLoadError("Error de red al pedir el token. Pegá API_AUTH_TOKEN manualmente.");
      });
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  };

  const loadQueue = useCallback(async () => {
    if (!token) {
      setError("Guardá el API token para cargar la cola.");
      return;
    }
    setLoading(true);
    setError("");
    const { ok, status, data } = await cockpitFetch(token, "/api/crm/cockpit/ml-queue");
    setLoading(false);
    if (!ok) {
      setError(data?.error || `HTTP ${status}`);
      setItems([]);
      return;
    }
    setItems(Array.isArray(data.items) ? data.items : []);
  }, [token]);

  useEffect(() => {
    if (!token) {
      setItems([]);
      return;
    }
    loadQueue();
  }, [token, loadQueue]);

  const saveToken = () => {
    const t = tokenInput.trim();
    setStoredToken(t);
    setToken(t);
    if (t) setTokenAutoLoaded(true);
    showToast(t ? "Token guardado." : "Token borrado.");
  };

  const runSync = async () => {
    if (!token) {
      setError("Necesitás el API token.");
      return;
    }
    setSyncing(true);
    setError("");
    const { ok, status, data } = await cockpitFetch(token, "/api/crm/cockpit/sync-ml", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    setSyncing(false);
    if (!ok) {
      setError(data?.error || `Sync HTTP ${status}`);
      return;
    }
    showToast(`Sincronizado: ${data.synced ?? 0} pregunta(s) nueva(s).`);
    await loadQueue();
  };

  const approveRow = async (row) => {
    if (!token) return;
    const { ok, data } = await cockpitFetch(token, "/api/crm/cockpit/approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row, approved: true }),
    });
    if (!ok) {
      showToast(data?.error || "No se pudo aprobar");
      return;
    }
    showToast(`Fila ${row}: aprobado enviar.`);
    await loadQueue();
  };

  const sendRow = async (row) => {
    if (!token) return;
    const { ok, data } = await cockpitFetch(token, "/api/crm/cockpit/send-approved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row }),
    });
    if (!ok) {
      showToast(data?.error || "No se pudo enviar");
      return;
    }
    showToast(`Fila ${row}: enviado (${data.channel || "ok"}).`);
    await loadQueue();
  };

  const runFullCycle = async () => {
    if (!token || firing) return;
    setFiring(true);
    setBtnPressed(true);
    setCycleLog(["INICIANDO CICLO ML..."]);
    setError("");
    let sent = 0;

    // Phase 1: sync
    setCycleLog(["▶ SYNC ML → CRM..."]);
    const syncRes = await cockpitFetch(token, "/api/crm/cockpit/sync-ml", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!syncRes.ok) {
      setCycleLog(["✗ SYNC FAILED: " + (syncRes.data?.error || `HTTP ${syncRes.status}`)]);
      setFiring(false);
      setBtnPressed(false);
      return;
    }
    const newQ = syncRes.data?.synced ?? 0;
    setCycleLog([`✓ SYNC OK — ${newQ} nueva(s)`, "▶ CARGANDO COLA..."]);

    // Phase 2: load queue
    const qRes = await cockpitFetch(token, "/api/crm/cockpit/ml-queue");
    if (!qRes.ok) {
      setCycleLog((l) => [...l, "✗ QUEUE LOAD FAILED"]);
      setFiring(false);
      setBtnPressed(false);
      return;
    }
    const queue = Array.isArray(qRes.data?.items) ? qRes.data.items : [];
    setItems(queue);
    const pending = queue.filter((i) => i.parsed?.aprobadoEnviar !== "SI");
    setCycleLog((l) => [...l, `✓ COLA: ${queue.length} ítem(s), ${pending.length} pendiente(s)`, "▶ APROBANDO Y ENVIANDO..."]);

    setTimeout(() => setBtnPressed(false), 200);

    // Phase 3: approve + send each pending item
    for (const item of pending) {
      const row = item.row;
      if (!item.parsed?.respuestaSugerida) continue;

      const approveRes = await cockpitFetch(token, "/api/crm/cockpit/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row, approved: true }),
      });
      if (!approveRes.ok) {
        setCycleLog((l) => [...l, `⚠ FILA ${row}: no se pudo aprobar`]);
        continue;
      }

      const sendRes = await cockpitFetch(token, "/api/crm/cockpit/send-approved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row }),
      });
      if (sendRes.ok) {
        sent++;
        setCycleLog((l) => [...l, `★ FILA ${row}: ENVIADO (${sendRes.data?.channel || "ok"})`]);
      } else {
        setCycleLog((l) => [...l, `⚠ FILA ${row}: envío falló — ${sendRes.data?.error || "err"}`]);
      }
    }

    setCycleScore((s) => s + sent);
    setCycleLog((l) => [...l, ``, `GAME OVER — ${sent} ENVIADO(S). QUEUE ACTUALIZADA.`]);
    setFiring(false);
    showToast(`Ciclo ML completo: ${sent} respuesta(s) enviada(s).`);
    await loadQueue();
  };

  const copyText = async (text, label) => {
    const t = String(text || "").trim();
    if (!t) {
      showToast("Nada para copiar");
      return;
    }
    try {
      await navigator.clipboard.writeText(t);
      showToast(`${label} copiado`);
    } catch {
      showToast("No se pudo copiar (permiso del navegador)");
    }
  };

  return (
    <div style={wrap}>
      <div style={main}>
        <p style={{ margin: "0 0 8px" }}>
          <Link
            to="/hub"
            style={{
              fontSize: 13,
              color: "#0071e3",
              textDecoration: "none",
              fontFamily: h1.fontFamily,
              fontWeight: 600,
            }}
          >
            ← Wolfboard
          </Link>
        </p>
        <h1 style={h1}>Mercado Libre · Operativo</h1>
        <p style={sub}>
          Cola desde CRM_Operativo (preguntas con <code>Q:id</code> en Observaciones). El token se carga automáticamente desde el servidor. Aprobá (AI) y enviá a ML con el texto de AF.
        </p>

        {/* ══ ARCADE PANEL ══════════════════════════════════════════════════ */}
        <div style={arcadeCabinet}>
          {/* scanline overlay */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)", pointerEvents: "none", borderRadius: 16 }} />

          <div style={arcadeTitle}>◆ BMC ML RESPONDER v1.0 ◆</div>

          {/* CRT screen */}
          <div style={crtScreen}>
            {cycleLog.length === 0 ? (
              <span style={{ ...crtIdle, animation: "none" }}>
                {token ? `> QUEUE: ${items.length} ÍTEM(S) — PRESIONÁ FIRE PARA RESPONDER` : "> INSERT COIN — CARGÁ EL TOKEN PARA ACTIVAR"}
              </span>
            ) : (
              cycleLog.map((line, i) => (
                <div key={i} style={i === cycleLog.length - 1 && firing ? crtFiring : line.startsWith("★") ? crtDone : line.startsWith("✗") || line.startsWith("⚠") ? crtError : crtIdle}>
                  {line || " "}
                </div>
              ))
            )}
            {firing && <span style={{ ...crtFiring, animation: "none" }}> █</span>}
          </div>

          {/* Controls row */}
          <div style={arcadeControls}>
            {/* Left: SYNC joystick button */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                style={syncing || !token ? { ...smallBtnYellow, opacity: 0.5, cursor: "not-allowed" } : smallBtnYellow}
                onClick={runSync}
                disabled={syncing || !token}
                title="Sincronizar ML → CRM"
              >
                <span style={{ fontSize: 16 }}>⟳</span>
                <span style={{ fontSize: 8, letterSpacing: 1 }}>SYNC</span>
              </button>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#886600", letterSpacing: 1 }}>SYNC</span>
            </div>

            {/* Center: BIG FIRE button */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                style={!token ? bigBtnRedDisabled : btnPressed || firing ? bigBtnRedActive : bigBtnRed}
                onMouseDown={() => token && !firing && setBtnPressed(true)}
                onMouseUp={() => setBtnPressed(false)}
                onMouseLeave={() => setBtnPressed(false)}
                onClick={runFullCycle}
                disabled={!token || firing}
                title="Sincronizar + Aprobar + Enviar todo"
              >
                <span style={{ fontSize: 26, lineHeight: 1 }}>{firing ? "⚡" : "🔴"}</span>
                <span style={{ fontSize: 11, letterSpacing: 2 }}>{firing ? "FIRING" : "FIRE!"}</span>
              </button>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#880000", letterSpacing: 2, textShadow: "0 0 6px #ff000044" }}>RESPONDER</span>
            </div>

            {/* Right: REFRESH button */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                style={loading || !token ? { ...smallBtnBlue, opacity: 0.5, cursor: "not-allowed" } : smallBtnBlue}
                onClick={loadQueue}
                disabled={loading || !token}
                title="Actualizar cola"
              >
                <span style={{ fontSize: 16 }}>↺</span>
                <span style={{ fontSize: 8, letterSpacing: 1 }}>COLA</span>
              </button>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#003388", letterSpacing: 1 }}>RELOAD</span>
            </div>
          </div>

          {/* Score */}
          <div style={scoreDisplay}>
            1UP &nbsp;&nbsp; SCORE: {String(cycleScore).padStart(4, "0")} &nbsp;&nbsp; HI: {String(Math.max(cycleScore, 0)).padStart(4, "0")}
          </div>

          {/* ── Instruction card ── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
            marginTop: 18,
            padding: "12px 10px",
            background: "#0d0d0d",
            border: "1px solid #2a2a2a",
            borderRadius: 8,
          }}>
            {[
              {
                icon: "⟳",
                color: "#ccaa00",
                name: "SYNC",
                desc: "Trae las preguntas nuevas de MercadoLibre al CRM. Úsalo antes de FIRE! para asegurarte de tener todo al día.",
              },
              {
                icon: "🔴",
                color: "#ff4422",
                name: "FIRE!",
                desc: "Ciclo completo en 1 click: sincroniza ML → carga la cola → aprueba cada respuesta sugerida → envía a ML.",
              },
              {
                icon: "↺",
                color: "#4488ff",
                name: "COLA",
                desc: "Recarga la tabla de preguntas pendientes desde el CRM sin sincronizar con ML.",
              },
            ].map(({ icon, color, name, desc }) => (
              <div key={name} style={{ padding: "8px 10px", borderRadius: 6, border: `1px solid ${color}22`, background: `${color}08` }}>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>
                  {icon} {name}
                </div>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#888", lineHeight: 1.55 }}>
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* ══ END ARCADE PANEL ══════════════════════════════════════════════ */}

        <div style={card}>
          <CockpitTokenPanel
            tokenAutoLoaded={tokenAutoLoaded}
            tokenLoadError={tokenLoadError}
            tokenInput={tokenInput}
            setTokenInput={setTokenInput}
            onSave={saveToken}
            onClear={() => { setTokenAutoLoaded(false); setStoredToken(""); setToken(""); setTokenInput(""); }}
            inputStyle={input}
            btnPrimaryStyle={btnPrimary}
            btnGhostStyle={btnGhost}
            actions={
              <>
                <button type="button" style={btnGhost} onClick={loadQueue} disabled={loading || !token}>
                  {loading ? "Cargando…" : "Actualizar cola"}
                </button>
                <button type="button" style={btnGhost} onClick={runSync} disabled={syncing || !token}>
                  {syncing ? "Sincronizando…" : "Sincronizar ML → CRM"}
                </button>
              </>
            }
          />
        </div>

        {error ? (
          <div
            style={{
              ...card,
              borderColor: "#ffccd0",
              background: "#fff5f5",
              color: "#8b0000",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : null}

        {toast ? (
          <div
            style={{
              position: "fixed",
              bottom: 24,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#1d1d1f",
              color: "#fff",
              padding: "10px 16px",
              borderRadius: 10,
              fontSize: 13,
              fontFamily: h1.fontFamily,
              zIndex: 50,
              maxWidth: "90vw",
            }}
          >
            {toast}
          </div>
        ) : null}

        <div style={card}>
          <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 600 }}>Cola ML ({items.length})</div>
          {items.length === 0 && !loading ? (
            <p style={{ margin: 0, fontSize: 13, color: "#6e6e73" }}>
              No hay filas que coincidan o aún no cargaste el token.
            </p>
          ) : (
            <div style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Fila</th>
                    <th style={th}>Estado</th>
                    <th style={th}>Cliente</th>
                    <th style={th}>Q</th>
                    <th style={th}>Consulta</th>
                    <th style={th}>AF</th>
                    <th style={th}>AI</th>
                    <th style={th}>AJ</th>
                    <th style={th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ row, parsed, questionId }) => (
                    <tr key={row}>
                      <td style={td}>{row}</td>
                      <td style={td}>{parsed.estado || "—"}</td>
                      <td style={td}>{parsed.cliente || "—"}</td>
                      <td style={td}>{questionId || "—"}</td>
                      <td style={td}>{(parsed.consulta || "").slice(0, 180)}</td>
                      <td style={td}>{(parsed.respuestaSugerida || "").slice(0, 120)}</td>
                      <td style={td}>{parsed.aprobadoEnviar || "—"}</td>
                      <td style={{ ...td, maxWidth: 100 }}>{(parsed.enviadoEl || "").slice(0, 24)}</td>
                      <td style={{ ...td, maxWidth: 280 }}>
                        <div style={rowActions}>
                          <button
                            type="button"
                            style={btnGhost}
                            onClick={() => copyText(parsed.respuestaSugerida, "AF")}
                          >
                            Copiar AF
                          </button>
                          <button type="button" style={btnGhost} onClick={() => approveRow(row)}>
                            Aprobar
                          </button>
                          <button type="button" style={btnPrimary} onClick={() => sendRow(row)}>
                            Enviar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
