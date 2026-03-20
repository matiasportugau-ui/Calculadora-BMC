// ═══════════════════════════════════════════════════════════════════════════
// FloorPlanEditor.jsx — Editor de plano para Techo + Fachada
// Dibuja el diseño como planta, asigna medidas a fachadas, techo se adapta
// ═══════════════════════════════════════════════════════════════════════════

import { Minus, Plus } from "lucide-react";
import { C, FONT, SHC, SHI, TR, TN } from "../data/constants.js";

function StepperInput({ label, value, onChange, min = 0, max = 9999, step = 1, unit = "", decimals = 2 }) {
  const bump = (dir) => {
    const next = parseFloat((value + dir * step).toFixed(decimals));
    if (next >= min && next <= max) onChange(next);
  };
  const btnS = (dis) => ({
    width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${C.border}`,
    background: C.surface, cursor: dis ? "not-allowed" : "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    opacity: dis ? 0.4 : 1, transition: TR, flexShrink: 0,
  });
  return (
    <div style={{ fontFamily: FONT }}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button style={btnS(value <= min)} onClick={() => bump(-1)} type="button">
          <Minus size={14} color={C.tp} />
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          onBlur={(e) => {
            const v = parseFloat(e.target.value);
            onChange(isNaN(v) ? min : Math.min(max, Math.max(min, v)));
          }}
          style={{
            width: 72, textAlign: "center", borderRadius: 10, border: `1.5px solid ${C.border}`,
            padding: "6px 8px", fontSize: 14, fontWeight: 500, background: C.surface, color: C.tp,
            outline: "none", boxShadow: SHI, transition: TR, fontFamily: FONT, ...TN,
          }}
        />
        <button style={btnS(value >= max)} onClick={() => bump(1)} type="button">
          <Plus size={14} color={C.tp} />
        </button>
        {unit && <span style={{ fontSize: 13, color: C.ts, marginLeft: 2 }}>{unit}</span>}
      </div>
    </div>
  );
}

/**
 * FloorPlanEditor — Plano de diseño para Techo + Fachada
 *
 * @param {object} value - { largo, ancho, alto }
 * @param {function} onChange - (value) => void
 * @param {string} labelS - Estilo para labels (opcional)
 */
export default function FloorPlanEditor({ value = {}, onChange, labelS }) {
  const largo = value.largo ?? 6;
  const ancho = value.ancho ?? 5;
  const alto = value.alto ?? 3.5;

  const update = (k, v) => {
    const next = { ...value, [k]: v };
    onChange(next);
  };

  const perimetro = 2 * (largo + ancho);
  const areaTecho = largo * ancho;
  const labelStyle = labelS || { fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" };

  // Vista planta: rectángulo con medidas en cada lado
  const scale = 80 / Math.max(largo, ancho, 1);
  const rectW = ancho * scale;
  const rectH = largo * scale;
  const svgW = rectW + 80;
  const svgH = rectH + 80;
  const cx = svgW / 2;
  const cy = svgH / 2;

  return (
    <div style={{ fontFamily: FONT, background: C.surface, borderRadius: 16, padding: 20, boxShadow: SHC, marginBottom: 16 }}>
      <div style={{ ...labelStyle, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>📐</span>
        DISEÑO POR PLANO — Vista planta
      </div>
      <div style={{ fontSize: 12, color: C.ts, marginBottom: 16, lineHeight: 1.5 }}>
        Dibujá el contorno del edificio. Las medidas de las fachadas definen el techo y el perímetro de pared.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
        {/* Inputs izquierda */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <StepperInput label="Largo (m)" value={largo} onChange={(v) => update("largo", v)} min={1} max={50} step={0.5} unit="m" />
          <StepperInput label="Ancho (m)" value={ancho} onChange={(v) => update("ancho", v)} min={1} max={50} step={0.5} unit="m" />
          <StepperInput label="Alto pared (m)" value={alto} onChange={(v) => update("alto", v)} min={1} max={14} step={0.5} unit="m" />
        </div>

        {/* Vista planta SVG */}
        <div style={{ padding: 16, background: C.surfaceAlt, borderRadius: 12, border: `1px solid ${C.border}` }}>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} width={180} height={180} style={{ display: "block" }}>
            {/* Fondo */}
            <rect x={cx - rectW / 2 - 2} y={cy - rectH / 2 - 2} width={rectW + 4} height={rectH + 4} rx={6} fill={C.brandLight} stroke={C.border} strokeWidth={1} />
            {/* Rectángulo interior */}
            <rect x={cx - rectW / 2} y={cy - rectH / 2} width={rectW} height={rectH} rx={4} fill={C.primary} fillOpacity={0.15} stroke={C.primary} strokeWidth={2} />
            {/* Labels */}
            <text x={cx} y={cy - rectH / 2 - 10} textAnchor="middle" fontSize={10} fontWeight={600} fill={C.primary} fontFamily={FONT}>{largo}m</text>
            <text x={cx} y={cy + rectH / 2 + 14} textAnchor="middle" fontSize={10} fontWeight={600} fill={C.primary} fontFamily={FONT}>{largo}m</text>
            <text x={cx - rectW / 2 - 12} y={cy} textAnchor="middle" fontSize={10} fontWeight={600} fill={C.primary} fontFamily={FONT} transform={`rotate(-90, ${cx - rectW / 2 - 12}, ${cy})`}>{ancho}m</text>
            <text x={cx + rectW / 2 + 12} y={cy} textAnchor="middle" fontSize={10} fontWeight={600} fill={C.primary} fontFamily={FONT} transform={`rotate(90, ${cx + rectW / 2 + 12}, ${cy})`}>{ancho}m</text>
            {/* Centro */}
            <text x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="central" fontSize={11} fill={C.tp} fontFamily={FONT}>{areaTecho.toFixed(1)} m²</text>
            <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="central" fontSize={9} fill={C.ts} fontFamily={FONT}>techo</text>
          </svg>
        </div>

        {/* Resumen derecha */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: 12, background: C.primarySoft, borderRadius: 10, border: `1px solid ${C.primary}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.primary, marginBottom: 4 }}>Se deriva automáticamente</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.tp, ...TN }}>{areaTecho.toFixed(1)} m²</div>
            <div style={{ fontSize: 12, color: C.ts }}>Área techo</div>
          </div>
          <div style={{ padding: 12, background: C.surfaceAlt, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 4 }}>Perímetro</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.tp, ...TN }}>{perimetro.toFixed(1)} m</div>
            <div style={{ fontSize: 12, color: C.ts }}>Fachadas</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 12, background: C.surfaceAlt, borderRadius: 10, fontSize: 11, color: C.ts, lineHeight: 1.5 }}>
        <strong style={{ color: C.tp }}>Próximas fases:</strong> L-shaped, polígono personalizado, dibujo libre de fachadas con medidas por segmento.
      </div>
    </div>
  );
}
