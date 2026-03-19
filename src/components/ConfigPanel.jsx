// ═══════════════════════════════════════════════════════════════════════════
// ConfigPanel.jsx — Pestaña de configuración de variables de la calculadora
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { Settings, RotateCcw, DollarSign, Sliders } from "lucide-react";
import { getConfig, setConfig, resetConfig } from "../utils/calculatorConfig.js";
import PricingEditor from "./PricingEditor.jsx";
import { invalidatePricingCache } from "../data/pricing.js";

export default function ConfigPanel({ visible, onClose, onConfigChange }) {
  const [config, setConfigState] = useState(getConfig);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState("general"); // "general" | "precios"

  useEffect(() => {
    if (visible) setConfigState(getConfig());
  }, [visible]);

  const handleSave = () => {
    setConfig(config);
    setSaved(true);
    onConfigChange?.();
    setTimeout(() => setSaved(false), 1500);
  };

  const handleReset = () => {
    resetConfig();
    setConfigState(getConfig());
    onConfigChange?.();
  };

  const handlePricingSave = () => {
    invalidatePricingCache();
    onConfigChange?.();
  };

  if (!visible) return null;

  const inputS = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1.5px solid #E5E5EA",
    fontSize: 14,
    color: "#1D1D1F",
    outline: "none",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  };
  const labelS = {
    fontSize: 11,
    fontWeight: 600,
    color: "#6E6E73",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }}
      />
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: tab === "precios" ? 700 : 400,
          background: "#F5F5F7",
          boxShadow: "-4px 0 30px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            background: "#1A3A5C",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Settings size={20} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Configuración</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Variables de la calculadora</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              padding: 8,
              fontSize: 18,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 24, flex: 1 }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
            <button
              onClick={() => setTab("general")}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "none",
                background: tab === "general" ? "#1A3A5C" : "#E5E5EA",
                color: tab === "general" ? "#fff" : "#6E6E73",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Sliders size={14} />
              General
            </button>
            <button
              onClick={() => setTab("precios")}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "none",
                background: tab === "precios" ? "#1A3A5C" : "#E5E5EA",
                color: tab === "precios" ? "#fff" : "#6E6E73",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <DollarSign size={14} />
              Listado de precios
            </button>
          </div>

          {tab === "precios" ? (
            <PricingEditor onSave={handlePricingSave} />
          ) : (
            <>
          {/* IVA */}
          <div style={{ marginBottom: 20 }}>
            <div style={labelS}>IVA (%)</div>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={config.iva ? (config.iva * 100).toFixed(1) : "22"}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setConfigState((c) => ({ ...c, iva: isNaN(v) ? 0.22 : v / 100 }));
              }}
              style={inputS}
            />
            <div style={{ fontSize: 11, color: "#6E6E73", marginTop: 4 }}>
              Uruguay: 22%. Modificable para pruebas.
            </div>
          </div>

          {/* Lista por defecto */}
          <div style={{ marginBottom: 20 }}>
            <div style={labelS}>Lista de precios por defecto</div>
            <select
              value={config.listaDefault || "web"}
              onChange={(e) => setConfigState((c) => ({ ...c, listaDefault: e.target.value }))}
              style={inputS}
            >
              <option value="web">Precio Web</option>
              <option value="venta">Precio BMC (venta directa)</option>
            </select>
          </div>

          {/* Flete por defecto */}
          <div style={{ marginBottom: 24 }}>
            <div style={labelS}>Flete por defecto (USD s/IVA)</div>
            <input
              type="number"
              min="0"
              step="10"
              value={config.fleteDefault ?? 280}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setConfigState((c) => ({ ...c, fleteDefault: isNaN(v) ? 280 : v }));
              }}
              style={inputS}
            />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handleSave}
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: 10,
                border: "none",
                background: saved ? "#34C759" : "#0071E3",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {saved ? "Guardado" : "Guardar"}
            </button>
            <button
              onClick={handleReset}
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px solid #E5E5EA",
                background: "#fff",
                color: "#6E6E73",
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <RotateCcw size={14} />
              Restaurar
            </button>
          </div>

          <div style={{ marginTop: 20, fontSize: 11, color: "#6E6E73", lineHeight: 1.5 }}>
            Los valores se guardan en el navegador (localStorage). Al guardar, la calculadora se actualiza.
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
