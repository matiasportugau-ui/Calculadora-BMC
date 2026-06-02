import React from "react";
import { getPanelConstruction } from "../../data/panelConstructionSpecs.js";

/**
 * PanelCrossSection — 2D technical cross-section drawing (CAD / TechDraw inspired).
 * Professional SVG for product visualization.
 * - Accurate layer stack from PANEL_CONSTRUCTIONS (chapa + núcleo + foil etc.)
 * - Hatching for materials (insulation, metal)
 * - Dimensions in mm, labels, total thickness
 * - Profile hint for Isoroof (simplified trapezoid wave on top)
 * - Ready for capture (data-bmc-capture)
 *
 * Usage:
 *   <PanelCrossSection familiaKey="ISODEC_PIR" espesorMm={80} width={420} />
 *
 * FreeCAD references (from shared evaluation videos):
 * - TechDraw quality: line weights, hatching, precise annotations, title/dim style
 * - BIM parametric objects: single data source drives geometry + properties
 * - Python automation spirit: this component is data-driven; future server Python/FreeCADCmd can generate richer DXF/SVG/PDF pages from same specs.
 */

const HATCH_PATTERNS = `
  <defs>
    <pattern id="metal-lines" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="#555" strokeWidth="0.6" />
    </pattern>
    <pattern id="dots-insulation" patternUnits="userSpaceOnUse" width="8" height="8">
      <circle cx="2" cy="2" r="0.9" fill="#8b5e3c" opacity="0.6"/>
      <circle cx="6" cy="6" r="0.9" fill="#8b5e3c" opacity="0.6"/>
    </pattern>
    <pattern id="cross-hatch-insulation" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
      <path d="M0 0 L10 10 M10 0 L0 10" stroke="#8b5e3c" strokeWidth="0.8" opacity="0.5" />
    </pattern>
  </defs>
`;

export function PanelCrossSection({
  familiaKey = "ISODEC_PIR",
  espesorMm,
  width = 380,
  showTitle = true,
  compact = false
}) {
  const construction = getPanelConstruction(familiaKey, espesorMm);
  const { layers, effectiveEspesorMm, totalThicknessMm, label, au, profileType } = construction;

  // Visual scale: 1 mm ~ 1.6 px for reasonable height on screen (capped)
  const mmToPx = 1.8;
  const layerHeights = layers.map(l => Math.max(3, (l.thicknessMm || 0) * mmToPx));
  const totalHeight = layerHeights.reduce((a, b) => a + b, 0);

  const sectionWidth = Math.min(width * 0.92, 340);
  const x0 = (width - sectionWidth) / 2;

  // Simple profiled top for Isoroof types (trapezoid ribs approximation)
  const isProfiled = profileType === "profiled" || profileType === "tile-profiled";
  const ribH = isProfiled ? 18 : 0;

  // Build layer Y positions from top (immutable accumulation to satisfy react-hooks/immutability)
  const layerRects = layers.reduce((acc, layer, idx) => {
    const h = layerHeights[idx];
    const prevY = acc.length ? acc[acc.length - 1].y + acc[acc.length - 1].h : (30 + ribH);
    acc.push({
      y: prevY,
      h,
      fill: layer.color || "#e5e7eb",
      hatch: layer.hatch || "none",
      name: layer.name,
      desc: layer.description
    });
    return acc;
  }, []);

  const bottomY = 30 + ribH + totalHeight;

  return (
    <div style={{ width, fontFamily: "system-ui, sans-serif" }}>
      {showTitle && (
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#1f2937" }}>
          Sección constructiva — {label} {effectiveEspesorMm} mm
        </div>
      )}

      <svg
        width={width}
        height={compact ? 140 : 195}
        viewBox={`0 0 ${width} ${compact ? 140 : 195}`}
        style={{ border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff" }}
        data-bmc-capture={`panel-section-2d-${familiaKey}`}
        data-bmc-layer="product-section"
      >
        {/* defs for hatches */}
        <g dangerouslySetInnerHTML={{ __html: HATCH_PATTERNS }} />

        {/* Title block style header */}
        {!compact && (
          <g>
            <rect x="8" y="4" width={width - 16} height="18" fill="#1e3a5f" rx="2" />
            <text x={width / 2} y="16" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="600">
              BMC / PANELIN — CORTE TRANSVERSAL REFERENCIAL (mm)
            </text>
          </g>
        )}

        {/* Profiled top cap (Isoroof style) */}
        {isProfiled && (
          <g>
            {/* Simplified trapezoidal ribs */}
            <path
              d={`M${x0} ${30} 
                  L${x0 + sectionWidth * 0.08} ${30 + ribH} 
                  L${x0 + sectionWidth * 0.18} ${30} 
                  L${x0 + sectionWidth * 0.28} ${30 + ribH} 
                  L${x0 + sectionWidth * 0.38} ${30} 
                  L${x0 + sectionWidth * 0.48} ${30 + ribH} 
                  L${x0 + sectionWidth * 0.58} ${30} 
                  L${x0 + sectionWidth * 0.68} ${30 + ribH} 
                  L${x0 + sectionWidth * 0.78} ${30} 
                  L${x0 + sectionWidth * 0.88} ${30 + ribH} 
                  L${x0 + sectionWidth} ${30}`}
              fill="none"
              stroke="#374151"
              strokeWidth="1.5"
            />
            {/* Top surface fill hint */}
            <rect
              x={x0}
              y={30}
              width={sectionWidth}
              height={ribH}
              fill="#9ca3af"
              opacity="0.3"
            />
          </g>
        )}

        {/* Layers */}
        {layerRects.map((r, i) => (
          <g key={i}>
            <rect
              x={x0}
              y={r.y}
              width={sectionWidth}
              height={r.h}
              fill={r.fill}
              stroke="#374151"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            {/* Hatch overlay */}
            {r.hatch !== "none" && (
              <rect
                x={x0}
                y={r.y}
                width={sectionWidth}
                height={r.h}
                fill={`url(#${r.hatch})`}
                opacity="0.65"
              />
            )}
            {/* Layer label */}
            <text
              x={x0 + 8}
              y={r.y + Math.min(r.h / 2 + 3, 9)}
              fill="#111827"
              fontSize={r.h > 18 ? "9" : "7.5"}
              fontWeight="500"
            >
              {r.name} {r.desc ? `(${r.desc})` : ""}
            </text>
          </g>
        ))}

        {/* Left dimension (total thickness) */}
        <g>
          <line
            x1={x0 - 18}
            y1={30 + ribH}
            x2={x0 - 18}
            y2={bottomY}
            stroke="#1e40af"
            strokeWidth="1.5"
          />
          {/* ticks */}
          <line x1={x0 - 22} y1={30 + ribH} x2={x0 - 14} y2={30 + ribH} stroke="#1e40af" strokeWidth="1" />
          <line x1={x0 - 22} y1={bottomY} x2={x0 - 14} y2={bottomY} stroke="#1e40af" strokeWidth="1" />
          {/* value */}
          <text
            x={x0 - 28}
            y={(30 + ribH + bottomY) / 2 + 3}
            fill="#1e40af"
            fontSize="9"
            fontWeight="600"
            textAnchor="end"
          >
            {Math.round(totalThicknessMm)} mm
          </text>
          <text
            x={x0 - 28}
            y={(30 + ribH + bottomY) / 2 + 14}
            fill="#64748b"
            fontSize="7"
            textAnchor="end"
          >
            espesor total
          </text>
        </g>

        {/* Bottom width / au annotation */}
        <g>
          <line
            x1={x0}
            y1={bottomY + 12}
            x2={x0 + sectionWidth}
            y2={bottomY + 12}
            stroke="#1e40af"
            strokeWidth="1"
          />
          <text
            x={x0 + sectionWidth / 2}
            y={bottomY + 24}
            fill="#1e40af"
            fontSize="8"
            textAnchor="middle"
          >
            Ancho útil {au.toFixed(2)} m ({(au * 1000).toFixed(0)} mm)
          </text>
        </g>

        {/* Footer note */}
        <text x={width / 2} y={compact ? 132 : 185} textAnchor="middle" fill="#6b7280" fontSize="6.5">
          Sección referencial • Datos de fichas técnicas BMC • No sustituye planos de fabricación
        </text>
      </svg>

      {!compact && (
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, lineHeight: 1.3 }}>
          Núcleo: {effectiveEspesorMm} mm • {layers.length} capas • Perfil: {profileType}
        </div>
      )}
    </div>
  );
}

export default PanelCrossSection;
