import React, { useCallback, useState } from "react";
import { useBmcAuth } from "../hooks/useBmcAuth.js";
import { requestAuthGate } from "./auth/AuthGateModal.jsx";

export default function LandingPage() {
  const { isAuthenticated, login } = useBmcAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  if (isAuthenticated) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1,
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
        <source src="/videos/login.mp4" type="video/mp4" />
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
          background: "rgba(255, 255, 255, 0.95)",
          maxWidth: 500,
          width: "100%",
          borderRadius: 16,
          padding: 40,
          boxShadow: "0 20px 50px rgba(0,0,0,.25)",
          backdropFilter: "blur(10px)",
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: "0 0 12px", fontSize: 28, fontWeight: 600, color: "#0f172a" }}>
          Calculadora BMC
        </h1>
        <p style={{ margin: "0 0 8px", color: "#475569", fontSize: 15, lineHeight: 1.6 }}>
          Sistema de presupuestación para paneles de aislación
        </p>
        <p style={{ margin: "0 0 28px", color: "#64748b", fontSize: 13 }}>
          Obtené cotizaciones precisas en segundos
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

        {error ? (
          <div style={{ marginTop: 12, color: "#b91c1c", fontSize: 13 }}>
            Error: {error}
          </div>
        ) : null}

        <p style={{ margin: "16px 0 0", color: "#94a3b8", fontSize: 12 }}>
          Plataforma de BMC Uruguay
        </p>
      </div>
    </div>
  );
}
