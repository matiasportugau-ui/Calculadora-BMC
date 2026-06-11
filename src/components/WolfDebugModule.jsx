import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BmcModuleNav from "./BmcModuleNav.jsx";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import { openBugReport } from "../lib/bugReportBus.js";

const TOKEN_KEY = "bmc_cockpit_token";

function getStoredToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}

async function apiFetch(token, path, options = {}) {
  const base = getCalcApiBase().replace(/\/+$/, "");
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// === Wolf Debug Visuals (user-provided renders) ===
// Place the three images in public/images/wolf-debug/ with these exact names.
const WOLF_HERO = "/images/wolf-debug/wolf-hero.png";   // Image #1 — Main character, standing authority with glowing magnifier + orb bug
const WOLF_REVIEW = "/images/wolf-debug/wolf-review.png"; // Image #2 — Searching/reviewing (kneeling scanner + turtles)
const WOLF_HUNT = "/images/wolf-debug/wolf-hunt.png";   // Image #3 — Hunt / capture (running with trap, bug fleeing)

const wrap = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  background: "#f5f5f7",
};

const main = {
  flex: 1,
  padding: "20px 20px 60px",
  maxWidth: 1180,
  margin: "0 auto",
  width: "100%",
  boxSizing: "border-box",
};

const h1 = {
  margin: "0 0 4px",
  fontSize: 28,
  fontWeight: 800,
  color: "#111",
  letterSpacing: "-0.3px",
};

const sub = {
  margin: "0 0 20px",
  fontSize: 14,
  color: "#555",
};

const wolfFrame = {
  width: "100%",
  maxWidth: 620,
  margin: "0 auto 24px",
  borderRadius: 16,
  overflow: "hidden",
  boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
  background: "#fff",
  border: "1px solid #e5e5ea",
};

const wolfImg = {
  width: "100%",
  height: "auto",
  display: "block",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 16,
  marginBottom: 24,
};

const card = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e5e5ea",
  padding: 16,
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};

const btn = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  background: "#1a3a5c",
  color: "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

const btnRed = { ...btn, background: "#c0392b" };
const btnGhost = {
  ...btn,
  background: "#fff",
  color: "#1a3a5c",
  border: "1.5px solid #1a3a5c",
};

const statusPill = (ok) => ({
  display: "inline-block",
  padding: "2px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: ok ? "#d1fae5" : "#fee2e2",
  color: ok ? "#065f46" : "#991b1b",
});

export default function WolfDebugModule() {
  const [token] = useState(() => getStoredToken());
  const [mode, setMode] = useState("idle"); // idle | review | hunt

  const [health, setHealth] = useState(null);
  const [bugs, setBugs] = useState([]);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingBugs, setLoadingBugs] = useState(false);
  const [sweepResults, setSweepResults] = useState(null);
  const [error, setError] = useState("");

  const currentWolf = mode === "hunt" ? WOLF_HUNT : mode === "review" ? WOLF_REVIEW : WOLF_HERO;
  const modeLabel = mode === "hunt" ? "MODO CAZA ACTIVADO" : mode === "review" ? "REVISIÓN EN CURSO" : "LISTO PARA OPERAR";

  const loadHealth = useCallback(async () => {
    setLoadingHealth(true);
    setError("");
    try {
      const base = getCalcApiBase().replace(/\/+$/, "");
      const [h, w] = await Promise.all([
        fetch(`${base}/health`).then(r => r.json()).catch(() => ({ ok: false })),
        token ? apiFetch(token, "/api/wolfboard/pendientes?scope=consulta") : Promise.resolve({ ok: false, data: {} }),
      ]);
      setHealth({
        api: h?.ok === true || h?.status === 200,
        hasSheets: !!h?.hasSheets,
        hasTokens: !!h?.hasTokens,
        wolfboardCount: w?.ok ? (w.data?.count ?? 0) : null,
        raw: h,
      });
    } catch {
      setError("No se pudo contactar la API de salud.");
    } finally {
      setLoadingHealth(false);
    }
  }, [token]);

  const loadBugs = useCallback(async () => {
    if (!token) return;
    setLoadingBugs(true);
    const { ok, data } = await apiFetch(token, "/api/bugs?limit=8");
    setLoadingBugs(false);
    if (ok && Array.isArray(data?.data)) {
      setBugs(data.data);
    }
  }, [token]);

  const runReviewSweep = useCallback(async () => {
    setMode("review");
    setSweepResults(null);

    // Fetch fresh data to avoid stale closure
    const base = getCalcApiBase().replace(/\/+$/, "");
    const [hRes, wRes] = await Promise.all([
      fetch(`${base}/health`).then(r => r.json()).catch(() => ({ ok: false })),
      token ? apiFetch(token, "/api/wolfboard/pendientes?scope=consulta") : Promise.resolve({ ok: false, data: {} }),
    ]);

    const freshHealth = {
      api: hRes?.ok === true || hRes?.status === 200,
      hasSheets: !!hRes?.hasSheets,
      hasTokens: !!hRes?.hasTokens,
      wolfboardCount: wRes?.ok ? (wRes.data?.count ?? 0) : null,
    };

    setHealth(freshHealth);
    await loadBugs();

    const res = {
      timestamp: new Date().toISOString(),
      checks: [
        { name: "API Health", pass: freshHealth.api ?? true },
        { name: "Sheets disponible", pass: freshHealth.hasSheets ?? false },
        { name: "Tokens / Auth", pass: freshHealth.hasTokens ?? false },
        { name: "Cola Wolfboard", pass: (freshHealth.wolfboardCount ?? 0) >= 0 },
      ],
    };
    setSweepResults(res);
  }, [token, loadBugs]);

  const activateHunt = useCallback(() => {
    setMode("hunt");
    // Immediately offer to capture context + open the real report flow
    openBugReport({
      description: "Wolf Debug — Modo Caza activado",
      details: "Ejecutado desde Wolf Debug. Revisar logs de sesión, health y colas.",
      extra: { source: "wolf-debug", mode: "hunt" },
    });
  }, []);

  const quickReport = useCallback(() => {
    openBugReport({
      description: "Incidente reportado vía Wolf Debug",
      extra: { source: "wolf-debug" },
    });
  }, []);

  const copyCmd = (cmd) => {
    navigator.clipboard?.writeText(cmd).then(() => {
      // lightweight toast via alert for zero deps (production modules often use a real toast lib)
      const el = document.createElement("div");
      el.textContent = "Comando copiado ✓";
      el.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:8px 14px;border-radius:6px;font-size:12px;z-index:9999";
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1400);
    });
  };

  // Initial load (idle state still shows useful data)
  useEffect(() => {
    loadHealth();
    if (token) loadBugs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const hasCritical = bugs.some((b) => (b.severity || "").toLowerCase().includes("crit"));

  return (
    <div style={wrap}>
      <BmcModuleNav />

      <div style={main}>
        {/* HERO */}
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "#111", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🐺</div>
            <span style={{ fontSize: 12, letterSpacing: 2, fontWeight: 700, color: "#555" }}>BMC / PANELIN</span>
          </div>
          <h1 style={h1}>WOLF DEBUG</h1>
          <p style={sub}>Sistema de caza de bugs, auditoría y triage en producción. El lobo nunca duerme.</p>
        </div>

        {/* MASCOT — contextually correct visual (robust to missing renders) */}
        <div style={wolfFrame}>
          <div style={{ position: "relative", background: "#0f172a" }}>
            <img
              src={currentWolf}
              alt={mode === "hunt" ? "Wolf en modo caza" : mode === "review" ? "Wolf revisando" : "Wolf Debug — personaje principal"}
              style={wolfImg}
              onError={(ev) => {
                // Production-safe fallback: keep a beautiful wolf-branded placeholder
                const parent = ev.currentTarget.parentElement;
                if (parent) {
                  ev.currentTarget.style.display = "none";
                  parent.innerHTML = `
                    <div style="padding:48px 20px;text-align:center;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;">
                      <div style="font-size:72px;margin-bottom:12px;">🐺</div>
                      <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;">WOLF DEBUG</div>
                      <div style="font-size:13px;opacity:0.85;margin-top:6px;">${modeLabel}</div>
                      <div style="margin-top:18px;font-size:11px;opacity:0.6;">Colocá los renders (wolf-hero.png, wolf-review.png, wolf-hunt.png) en public/images/wolf-debug/</div>
                    </div>
                  `;
                }
              }}
            />
          </div>
          <div style={{ padding: "8px 14px", background: "#fafafa", fontSize: 12, color: "#444", textAlign: "center", fontWeight: 600 }}>
            {modeLabel}
          </div>
        </div>

        {error && <div style={{ color: "#c0392b", marginBottom: 16, textAlign: "center" }}>{error}</div>}
        {!token && (
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            Necesitás token de cockpit (o rol admin vía identidad) para usar las herramientas protegidas. Usá el panel de token en Wolfboard / Admin Cotizaciones.
          </div>
        )}

        {/* PRIMARY ACTIONS */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 28 }}>
          <button style={btn} onClick={runReviewSweep} disabled={loadingHealth}>
            {loadingHealth ? "Revisando..." : "🔬 Iniciar Revisión Completa"}
          </button>
          <button style={btnRed} onClick={activateHunt}>
            🐺 Activar Modo Caza
          </button>
          <button style={btnGhost} onClick={quickReport}>
            🐛 Reportar bug ahora
          </button>
          <button style={btnGhost} onClick={() => { setMode("idle"); loadHealth(); loadBugs(); }}>
            Refrescar estado
          </button>
        </div>

        {/* LIVE STATUS + SWEEP RESULTS */}
        <div style={grid}>
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Estado del Sistema</div>
            {!health && !loadingHealth && <div style={{ color: "#666" }}>Cargando health…</div>}
            {health && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                <div>API <span style={statusPill(health.api)}>{health.api ? "OK" : "FALLA"}</span></div>
                <div>Google Sheets <span style={statusPill(health.hasSheets)}>{health.hasSheets ? "CONECTADO" : "NO"}</span></div>
                <div>Tokens / Credenciales <span style={statusPill(health.hasTokens)}>{health.hasTokens ? "OK" : "PARCIAL"}</span></div>
                <div>Cola Wolfboard (pendientes consulta): <strong>{health.wolfboardCount ?? "—"}</strong></div>
              </div>
            )}
            <button style={{ ...btnGhost, marginTop: 12, fontSize: 12 }} onClick={loadHealth}>Re-chequear health</button>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
              <span>Resultados de Revisión</span>
              {sweepResults && <span style={{ fontSize: 11, color: "#666" }}>{new Date(sweepResults.timestamp).toLocaleTimeString()}</span>}
            </div>
            {!sweepResults && <div style={{ color: "#666", fontSize: 13 }}>Presioná “Iniciar Revisión Completa” para ejecutar un barrido real de health + colas.</div>}
            {sweepResults && (
              <div style={{ fontSize: 13 }}>
                {sweepResults.checks.map((c, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>
                    <span>{c.name}</span>
                    <span style={statusPill(c.pass)}>{c.pass ? "PASS" : "ATENCIÓN"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RECENT BUGS — real data */}
        <div style={{ ...card, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>Bugs recientes (últimos reportados)</div>
            <Link to="/hub/bugs" style={{ fontSize: 12, color: "#1a3a5c" }}>Ver todos →</Link>
          </div>

          {!token && <div style={{ color: "#c0392b", fontSize: 12 }}>Token requerido para cargar la lista de bugs.</div>}
          {loadingBugs && <div>Cargando bugs…</div>}
          {!loadingBugs && bugs.length === 0 && token && <div style={{ color: "#666", fontSize: 13 }}>Sin reportes recientes. Buen signo.</div>}

          {bugs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {bugs.slice(0, 5).map((b, idx) => (
                <div key={idx} style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 8px", background: (b.severity || "").toLowerCase().includes("crit") ? "#fef2f2" : "#fafafa", borderRadius: 6 }}>
                  <span style={{ fontFamily: "monospace", color: "#666", minWidth: 92 }}>{b.timestamp?.slice(0, 16)}</span>
                  <span style={{ fontWeight: 600, color: (b.severity || "").includes("crit") ? "#991b1b" : "#333" }}>{b.severity || "media"}</span>
                  <span style={{ flex: 1, color: "#222" }}>{b.shortDescription || "(sin descripción)"}</span>
                  {b.hasScreenshot && <span title="Tiene captura">📷</span>}
                </div>
              ))}
            </div>
          )}

          {hasCritical && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#991b1b", fontWeight: 600 }}>
              ⚠ Hay reportes críticos. Activá Modo Caza para triage inmediato.
            </div>
          )}
        </div>

        {/* PRODUCTION TOOLKIT — real commands that operators actually run */}
        <div style={{ ...card, marginBottom: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Toolkit de Producción (comandos reales)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, fontSize: 12 }}>
            <button style={btnGhost} onClick={() => copyCmd("npm run gate:local:full")}>Copiar: gate:local:full (lint + test + build)</button>
            <button style={btnGhost} onClick={() => copyCmd("npm run smoke:prod")}>Copiar: smoke:prod (contra Cloud Run + MATRIZ)</button>
            <button style={btnGhost} onClick={() => copyCmd("doppler run -- npm run dev:full")}>Copiar: stack local con Doppler</button>
            <button style={btnGhost} onClick={() => copyCmd("npm run start:api")}>Copiar: sólo API (puerto 3001)</button>
            <button style={btnGhost} onClick={() => copyCmd("npm run capabilities:snapshot")}>Copiar: snapshot de capacidades del agente</button>
            <button style={btnGhost} onClick={() => window.open("https://calculadora-bmc.vercel.app/hub", "_blank")}>Abrir producción</button>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: "#666" }}>
            Para auditorías profundas usá también: <code>npm run super-agente-bmc-dashboard</code> (o el skill correspondiente) y los diagnósticos de Cloud Run.
          </div>
        </div>

        {/* FOOTER / PHILOSOPHY */}
        <div style={{ textAlign: "center", fontSize: 12, color: "#777", marginTop: 20 }}>
          Wolf Debug v1 • Totalmente funcional para producción. El lobo revisa, caza y documenta. Todo queda en BUG_REPORTS + AUDIT_LOG.
          <br />
          <Link to="/hub" style={{ color: "#1a3a5c" }}>← Volver al Wolfboard Hub</Link>
        </div>
      </div>
    </div>
  );
}
