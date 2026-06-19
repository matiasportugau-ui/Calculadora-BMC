import React, { useCallback, useState } from "react";
import { useBmcAuth } from "../hooks/useBmcAuth.js";
import Radio from "./Radio.jsx";

export default function LandingPage() {
  const { isAuthenticated, login } = useBmcAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [devMode, setDevMode] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    try {
      return localStorage.getItem("bmc.devmode.bypass") === "1";
    } catch {
      return false;
    }
  });

  const handleLogin = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await login();
    } catch (e) {
      setError(e?.message || "auth_failed");
    } finally {
      setLoading(false);
    }
  }, [login]);

  const handleDevLogin = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "dev_login_failed");
      }
      window.location.reload();
    } catch (e) {
      setError(e?.message || "dev_login_failed");
      setLoading(false);
    }
  }, []);

  const toggleDevMode = useCallback(() => {
    if (typeof localStorage === "undefined") return;
    try {
      const newMode = !devMode;
      if (newMode) {
        localStorage.setItem("bmc.devmode.bypass", "1");
      } else {
        localStorage.removeItem("bmc.devmode.bypass");
      }
      setDevMode(newMode);
    } catch {
      /* ignore */
    }
  }, [devMode]);

  if (isAuthenticated || devMode) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflow: "hidden",
      }}
    >
      {/* Video background - full screen */}
      <video
        autoPlay
        muted
        loop
        playsInline
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 0,
        }}
      >
        <source src={`${import.meta.env.BASE_URL}videos/login.mp4`} type="video/mp4" />
      </video>

      {/* Dark overlay for readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.5)",
          zIndex: 1,
        }}
      />

      {/* Landing card - centered on top of video */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          background: "rgba(255, 255, 255, 0.20)",
          maxWidth: 500,
          width: "100%",
          borderRadius: 16,
          padding: 40,
          boxShadow: "0 20px 50px rgba(0,0,0,.15)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.3)",
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: "0 0 12px", fontSize: 28, fontWeight: 600, color: "#ffffff" }}>
          Plataforma BMC
        </h1>
        <p style={{ margin: "0 0 8px", color: "#f1f5f9", fontSize: 15, lineHeight: 1.6 }}>
          Sistema de Gestión y Presupuestación
        </p>
        <p style={{ margin: "0 0 28px", color: "#e2e8f0", fontSize: 13 }}>
          Cotizaciones en segundos, automatismos y Panelin  =)
        </p>

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            background: loading ? "#94a3b8" : "#0f172a",
            color: "#fff",
            border: "none",
            cursor: loading ? "wait" : "pointer",
            fontSize: 15,
            fontWeight: 500,
            marginBottom: 12,
          }}
        >
          {loading ? "Conectando…" : "Iniciar con Google"}
        </button>

        <button
          type="button"
          onClick={handleDevLogin}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            background: loading ? "#94a3b8" : "rgba(100, 116, 139, 0.3)",
            color: "#cbd5e1",
            border: "1px solid rgba(100, 116, 139, 0.3)",
            cursor: loading ? "wait" : "pointer",
            fontSize: 14,
            fontWeight: 500,
            marginBottom: 12,
          }}
        >
          {loading ? "Conectando…" : "🔧 Dev Login (Testing)"}
        </button>

        {error ? (
          <div style={{ marginTop: 12, color: "#b91c1c", fontSize: 13 }}>
            Error: {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={toggleDevMode}
          title={devMode ? "Dev mode: ON (click to disable)" : "Dev mode: OFF (click to enable for testing without Google OAuth)"}
          style={{
            marginTop: 12,
            padding: "4px 8px",
            fontSize: 11,
            background: devMode ? "rgba(34, 197, 94, 0.3)" : "rgba(100, 116, 139, 0.2)",
            color: devMode ? "#86efac" : "#cbd5e1",
            border: `1px solid ${devMode ? "rgba(34, 197, 94, 0.5)" : "rgba(100, 116, 139, 0.3)"}`,
            borderRadius: 4,
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          {devMode ? "🔧 Dev Mode: ON" : "Dev Mode: OFF"}
        </button>

        <p style={{ margin: "16px 0 0", color: "#cbd5e1", fontSize: 12 }}>
          Diseñada por y para BMC Uruguay
        </p>
      </div>

      {/* Radio component */}
      <Radio />
    </div>
  );
}
