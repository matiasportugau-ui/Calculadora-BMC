import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useBmcAuth } from "../../hooks/useBmcAuth.js";

const ApiBase = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/+$/, "");
  }
  return "";
})();

async function jget(token, path) {
  const r = await fetch(`${ApiBase}${path}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return r.json();
}

const THRESHOLD_ALARM = 15; // backlog that triggers alarm
const POLL_MS = 15000;

export default function EstadoConsultasLive() {
  const { token } = useBmcAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [muted, setMuted] = useState(() => {
    return localStorage.getItem("consultas_muted") === "true";
  });
  const [lastTotal, setLastTotal] = useState(0);
  const [recentNew, setRecentNew] = useState(0);
  const [alarmActive, setAlarmActive] = useState(false);
  const alarmIntervalRef = useRef(null);
  const prevCountsRef = useRef({});

  // Mute toggle
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem("consultas_muted", String(next));
    if (next && alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
  };

  // Simple Web Audio beep (no asset needed)
  const playBeep = (urgent = false) => {
    if (muted || typeof window === "undefined") return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = urgent ? "sawtooth" : "sine";
      osc.frequency.value = urgent ? 880 : 660;
      gain.gain.value = urgent ? 0.3 : 0.15;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = urgent ? 1200 : 800;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      setTimeout(() => {
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        setTimeout(() => {
          osc.stop();
          ctx.close().catch(() => {});
        }, 300);
      }, urgent ? 180 : 120);
    } catch (e) {
      // silent fail
    }
  };

  const playUrgentAlarm = () => {
    if (muted) return;
    playBeep(true);
    // short burst
    setTimeout(() => playBeep(true), 280);
  };

  // Speak via browser TTS (Panelin-style attention)
  const speakPanelinAttention = (message = "hey, dale bola a las consultas.... esas se están acumulando...") => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(message);
      utter.lang = "es-AR";
      utter.rate = 1.05;
      utter.pitch = 1.1;
      utter.volume = 0.9;
      window.speechSynthesis.speak(utter);
    } catch (e) {}
  };

  const triggerAttention = (isNew = false, isAlarm = false) => {
    const msg = isAlarm
      ? "hey, dale bola a las consultas.... esas se están acumulando..."
      : "Nueva consulta entrante. Revisá el estado.";

    // Visual notification banner
    setRecentNew((prev) => Math.min(prev + (isNew ? 1 : 0), 99));

    // Sound
    if (isAlarm) {
      playUrgentAlarm();
    } else {
      playBeep(false);
    }

    // Panelin-style call to attention (TTS)
    if (isAlarm) {
      speakPanelinAttention();
    }

    // Browser Notification (if permitted)
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Estado de consultas BMC", {
        body: msg,
        icon: "/favicon.svg",
      });
    } else if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  // Fetch live status (uses existing omni metrics)
  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      // Prefer the metrics endpoint we already have in backend
      const metrics = await jget(token, "/api/omni/metrics");
      const convs = metrics?.omni_conversations_by_channel || [];

      const counts = {};
      let total = 0;
      convs.forEach((c) => {
        counts[c.channel] = c.total || 0;
        total += c.total || 0;
      });

      // Fallback if metrics empty — try direct conversations count (light)
      if (total === 0) {
        try {
          const list = await jget(token, "/api/omni/conversations?limit=50");
          const items = list?.items || list || [];
          items.forEach((it) => {
            const ch = it.channel || "unknown";
            counts[ch] = (counts[ch] || 0) + 1;
            total++;
          });
        } catch {}
      }

      const newData = {
        total,
        byChannel: counts,
        updatedAt: new Date().toISOString(),
        ingest24h: metrics?.omni_ingest_total_24h || [],
      };

      // Detect new / accumulation
      const prev = prevCountsRef.current;
      const prevTotal = Object.values(prev).reduce((a, b) => a + b, 0) || lastTotal;
      const delta = total - prevTotal;

      if (delta > 0) {
        triggerAttention(true, false);
      }

      const isAlarm = total > THRESHOLD_ALARM || (delta > 2 && total > 8);
      if (isAlarm && !alarmActive) {
        setAlarmActive(true);
        triggerAttention(false, true);
        // repeating urgent buzz while alarm
        if (!muted && !alarmIntervalRef.current) {
          alarmIntervalRef.current = setInterval(() => {
            playUrgentAlarm();
          }, 4200);
        }
      } else if (!isAlarm && alarmActive) {
        setAlarmActive(false);
        if (alarmIntervalRef.current) {
          clearInterval(alarmIntervalRef.current);
          alarmIntervalRef.current = null;
        }
      }

      prevCountsRef.current = counts;
      setLastTotal(total);
      setData(newData);
    } catch (e) {
      setError(e.message || "Error cargando estado");
      // graceful fallback with zeros
      setData((prev) => prev || { total: 0, byChannel: {}, updatedAt: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, POLL_MS);
    return () => {
      clearInterval(id);
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    };
  }, [token]);

  // Request notification permission once
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      // lazy
    }
  }, []);

  const total = data?.total || 0;
  const channels = data?.byChannel || {};

  const channelOrder = ["wa", "ml", "email", "instagram", "facebook", "omnicrm"];

  return (
    <div
      style={{
        background: alarmActive ? "#fff1f0" : "#fff",
        border: alarmActive ? "2px solid #cf222e" : "1px solid #e5e5ea",
        borderRadius: 10,
        boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.05)",
        padding: "14px 16px",
        marginBottom: 16,
        transition: "all 0.2s ease",
      }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          marginBottom: expanded ? 10 : 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: alarmActive ? "#cf222e" : "#1d1d1f" }}>
            📥 Estado de consultas (Live)
          </div>
          {alarmActive && (
            <span style={{ background: "#cf222e", color: "#fff", fontSize: 10, padding: "1px 6px", borderRadius: 3, fontWeight: 700 }}>
              ¡ALERTA!
            </span>
          )}
          <span style={{ fontSize: 12, color: "#6e6e73" }}>
            Total: <strong>{total}</strong>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 6,
              border: "1px solid #ccc",
              background: muted ? "#f4f4f5" : "#fff",
              cursor: "pointer",
            }}
            title={muted ? "Activar sonido" : "Silenciar sonido"}
          >
            {muted ? "🔇" : "🔊"}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              fetchStatus();
            }}
            style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
            title="Actualizar ahora"
          >
            ↻
          </button>

          <span style={{ fontSize: 12, color: "#6e6e73" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Live table summary */}
      <div style={{ fontSize: 12, display: "flex", gap: 12, flexWrap: "wrap", marginBottom: expanded ? 8 : 0 }}>
        {channelOrder.map((ch) => {
          const val = channels[ch] || 0;
          if (val === 0 && ch !== "wa") return null; // hide zeros except wa (important gap)
          return (
            <div key={ch} style={{ background: "#f8f8fa", padding: "2px 8px", borderRadius: 6 }}>
              <strong>{ch.toUpperCase()}</strong>: {val}
            </div>
          );
        })}
        {Object.keys(channels).filter((k) => !channelOrder.includes(k)).map((ch) => (
          <div key={ch} style={{ background: "#f8f8fa", padding: "2px 8px", borderRadius: 6 }}>
            {ch}: {channels[ch]}
          </div>
        ))}
      </div>

      {recentNew > 0 && (
        <div style={{ marginTop: 6, fontSize: 11, color: "#0071e3", fontWeight: 600 }}>
          +{recentNew} nuevas desde última revisión
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #eee", fontSize: 12 }}>
          <div style={{ marginBottom: 6, color: "#6e6e73" }}>
            Actualizado: {data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : "—"}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <Link to="/hub/canales" style={{ fontSize: 12, color: "#0071e3", textDecoration: "none" }}>
              Abrir Inbox Unificado →
            </Link>
            <Link to="/hub/admin-ingreso" style={{ fontSize: 12, color: "#0071e3", textDecoration: "none" }}>
              Interpretar consultas →
            </Link>
            <Link to="/hub/ml-manager" style={{ fontSize: 12, color: "#0071e3", textDecoration: "none" }}>
              ML Manager →
            </Link>
          </div>

          <div style={{ fontSize: 11, color: "#666" }}>
            Datos de omni (unificado). WA puede estar aún en legacy Sheets o con migración dormida.
            <br />
            Umbral de alarma: {THRESHOLD_ALARM} pendientes.
          </div>

          {alarmActive && (
            <button
              onClick={() => speakPanelinAttention()}
              style={{
                marginTop: 8,
                background: "#cf222e",
                color: "#fff",
                border: "none",
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              🔊 Hacer que Panelin avise ahora
            </button>
          )}
        </div>
      )}

      {error && <div style={{ fontSize: 11, color: "#cf222e", marginTop: 4 }}>Error: {error}</div>}
      {loading && !data && <div style={{ fontSize: 11, color: "#888" }}>Cargando estado en vivo…</div>}
    </div>
  );
}
