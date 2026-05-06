// Top-right user avatar + dropdown. Shown globally; degrades to a "Iniciar
// sesión" CTA when anonymous. Minimal styling — meant to drop into existing
// shell layouts without theme conflicts.

import React, { useCallback, useState } from "react";
import { useBmcAuth } from "../../hooks/useBmcAuth.js";
import { requestAuthGate } from "./AuthGateModal.jsx";

const PRESET_AVATAR = {
  comercial: "🏢",
  residencial: "🏡",
  constructor: "👷",
  barraca: "🏗️",
};

function avatarFor(user) {
  if (user?.picture) return user.picture;
  return null;
}

export default function AuthHeader() {
  const { user, role, plan_tier, status, logout } = useBmcAuth();
  const [open, setOpen] = useState(false);

  const onLogin = useCallback(() => {
    requestAuthGate("header");
  }, []);

  if (status === "loading") {
    return (
      <div style={{ width: 32, height: 32, borderRadius: 16, background: "#e2e8f0" }} aria-hidden />
    );
  }

  if (status !== "authenticated") {
    return (
      <button
        type="button"
        onClick={onLogin}
        style={{
          padding: "6px 12px",
          borderRadius: 999,
          border: "1px solid #cbd5e1",
          background: "#fff",
          color: "#0f172a",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Iniciar sesión
      </button>
    );
  }

  const pic = avatarFor(user);
  const presetIcon = !pic && user?.avatar_preset ? PRESET_AVATAR[user.avatar_preset] : null;
  const initials = (user?.name || user?.email || "?")
    .split(/[\s@]/)
    .filter(Boolean)
    .map((s) => s[0]?.toUpperCase() || "")
    .slice(0, 2)
    .join("");

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          background: pic ? `url(${pic}) center/cover` : "#0f172a",
          color: "#fff",
          border: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          cursor: "pointer",
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user?.email || ""}
      >
        {!pic && (presetIcon || initials)}
      </button>
      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: 44,
            minWidth: 220,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,.12)",
            padding: 12,
            zIndex: 1000,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
            {user?.name || user?.email}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
            {user?.email}
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 999, background: "#f1f5f9", color: "#475569" }}>
              {role || "comprador"}
            </span>
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 999,
                background: plan_tier === "plus" ? "#fde68a" : "#e2e8f0",
                color: plan_tier === "plus" ? "#92400e" : "#475569",
              }}
            >
              plan {plan_tier || "base"}
            </span>
          </div>
          <a
            href="/mi-espacio"
            style={{ display: "block", padding: "6px 4px", fontSize: 13, color: "#0f172a", textDecoration: "none" }}
          >
            Mi espacio
          </a>
          <a
            href="/mi-espacio?tab=cotizaciones"
            style={{ display: "block", padding: "6px 4px", fontSize: 13, color: "#0f172a", textDecoration: "none" }}
          >
            Mis cotizaciones
          </a>
          <a
            href="/mi-espacio?tab=bandeja"
            style={{ display: "block", padding: "6px 4px", fontSize: 13, color: "#0f172a", textDecoration: "none" }}
          >
            Bandeja
          </a>
          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await logout();
            }}
            style={{
              marginTop: 6,
              width: "100%",
              padding: "8px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#fff",
              color: "#0f172a",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  );
}
