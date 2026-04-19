// ═══════════════════════════════════════════════════════════════════════════
// PanelFamilyShowcase — tarjetas de familia con textura catálogo y slot Sketchfab
// Sketchfab-ready: si VITE_SKETCHFAB_<FAMILIA> está configurado, muestra el embed;
// si no, muestra imagen de catálogo. Sin lógica de cotización.
// ═══════════════════════════════════════════════════════════════════════════

import { ROOF_PANEL_VISUAL_PROFILES } from "../data/roofPanelVisualProfiles.js";

const FAMILIES = Object.keys(ROOF_PANEL_VISUAL_PROFILES);

function sketchfabId(familiaKey) {
  return import.meta.env[`VITE_SKETCHFAB_${familiaKey}`] ?? null;
}

function FamilyLabel({ familiaKey }) {
  return familiaKey
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function PanelFamilyCard({ familiaKey, selected, onSelect, compact }) {
  const p = ROOF_PANEL_VISUAL_PROFILES[familiaKey];
  const sfId = sketchfabId(familiaKey);
  const imgH = compact ? 80 : 110;

  return (
    <button
      type="button"
      onClick={() => onSelect(familiaKey)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 8,
        borderRadius: 12,
        border: `2px solid ${selected ? "#3b82f6" : "#d1d5db"}`,
        background: selected ? "#eff6ff" : "#fff",
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color 0.15s, background 0.15s",
        boxShadow: selected ? "0 0 0 3px #dbeafe" : "0 1px 3px rgba(0,0,0,0.07)",
      }}
      aria-pressed={selected}
      aria-label={`Seleccionar familia ${familiaKey}`}
    >
      {sfId ? (
        <iframe
          title={familiaKey}
          src={`https://sketchfab.com/models/${sfId}/embed?autostart=0&ui_controls=0&ui_infos=0&ui_watermark=0`}
          allow="autoplay; fullscreen; xr-spatial-tracking"
          style={{ width: "100%", height: imgH, border: 0, borderRadius: 8, pointerEvents: "none" }}
          loading="lazy"
        />
      ) : p.mapUrl ? (
        <img
          src={p.mapUrl}
          alt={familiaKey}
          loading="lazy"
          style={{ width: "100%", height: imgH, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb" }}
        />
      ) : (
        <div style={{ width: "100%", height: imgH, borderRadius: 8, background: "#f3f4f6", border: "1px dashed #d1d5db" }} />
      )}
      <div style={{ fontSize: 12, fontWeight: 700, color: selected ? "#1d4ed8" : "#111827", lineHeight: 1.2 }}>
        <FamilyLabel familiaKey={familiaKey} />
      </div>
      <div style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.3 }}>
        {p.thicknessMm}mm · R{p.roughness} · M{p.metalness}
        {sfId && <span style={{ marginLeft: 4, color: "#3b82f6" }}>3D</span>}
      </div>
    </button>
  );
}

/**
 * @param {{
 *   familiaKey: string,
 *   onSelect: (key: string) => void,
 *   compact?: boolean,
 * }} props
 */
export function PanelFamilyShowcase({ familiaKey, onSelect, compact = false }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: compact ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
        gap: 8,
      }}
    >
      {FAMILIES.map((fk) => (
        <PanelFamilyCard
          key={fk}
          familiaKey={fk}
          selected={fk === familiaKey}
          onSelect={onSelect}
          compact={compact}
        />
      ))}
    </div>
  );
}
