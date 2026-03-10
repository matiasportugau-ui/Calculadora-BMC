// ═══════════════════════════════════════════════════════════════════════════
// src/components/PanelinCalculadoraV3.jsx — React UI component
// BMC Uruguay · Calculadora de Cotización v3.0
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  ChevronDown, ChevronUp, Printer, Trash2, Copy, Check,
  AlertTriangle, CheckCircle, Info, Minus, Plus, FileText,
  RotateCcw, Edit3, X, RefreshCw, ClipboardList,
  Download, Save, Archive
} from "lucide-react";

import {
  C, FONT, SHC, SHI, TR, TN, COLOR_HEX,
  setListaPrecios,
  PANELS_TECHO, PANELS_PARED, SERVICIOS,
  SCENARIOS_DEF, VIS, OBRA_PRESETS, BORDER_OPTIONS,
  CATEGORIAS_BOM, CATEGORIA_TO_GROUPS,
  PENDIENTES_PRESET, TIPO_AGUAS,
} from "../data/constants.js";
import {
  calcTechoCompleto, calcParedCompleto, calcTotalesSinIVA,
  calcFactorPendiente, mergeZonaResults,
} from "../utils/calculations.js";
import {
  applyOverrides, bomToGroups,
  fmtPrice, generatePrintHTML, generateInternalHTML, openPrintWindow, buildWhatsAppText,
} from "../utils/helpers.js";
import {
  saveBudget, getAllLogs, deleteBudget, clearAllLogs,
  exportLogsAsJSON, exportSingleBudget,
} from "../utils/budgetLog.js";

// ── CSS injection ────────────────────────────────────────────────────────────

if (typeof document !== "undefined" && !document.getElementById("bmc-kf")) {
  const s = document.createElement("style");
  s.id = "bmc-kf";
  s.textContent = `
    @keyframes bmc-fade{from{opacity:0}to{opacity:1}}
    @keyframes bmc-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
    @keyframes bmc-slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes bmc-slideInUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
    @media (max-width: 900px) {
      .bmc-main-grid { grid-template-columns: 1fr !important; height: auto !important; overflow: visible !important; }
      .bmc-left-panel, .bmc-right-panel { overflow: visible !important; padding: 0 !important; }
      .bmc-mobile-bar { display: flex !important; }
      .bmc-desktop-actions { display: none !important; }
    }
    @media (min-width: 901px) {
      .bmc-mobile-bar { display: none !important; }
    }
  `;
  document.head.appendChild(s);
}

// ── UI Components ─────────────────────────────────────────────────────────────

function AnimNum({ value, style }) {
  const [key, setKey] = useState(0);
  const prev = useRef(value);
  useEffect(() => { if (prev.current !== value) { prev.current = value; setKey(k => k + 1); } }, [value]);
  return <span key={key} style={{ display: "inline-block", animation: "bmc-fade 120ms ease-in-out", ...TN, ...style }}>{value}</span>;
}

function CustomSelect({ label, value, options = [], onChange, showBadge }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  const selected = options.find(o => o.value === value);
  return (
    <div ref={ref} style={{ position: "relative", fontFamily: FONT }}>
      {label && <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>}
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${open ? C.primary : C.border}`, background: C.surface, cursor: "pointer", fontSize: 14, color: C.tp, boxShadow: open ? `0 0 0 3px ${C.primarySoft}` : SHI, transition: TR, fontFamily: FONT }}>
        <span style={{ flex: 1, textAlign: "left" }}>{selected ? selected.label : <span style={{ color: C.tt }}>Seleccionar…</span>}{selected?.sublabel && <span style={{ fontSize: 11, color: C.ts, marginLeft: 6 }}>{selected.sublabel}</span>}</span>
        {showBadge && selected?.badge && <span style={{ fontSize: 11, fontWeight: 600, color: C.primary, background: C.primarySoft, borderRadius: 20, padding: "2px 8px", marginRight: 8, ...TN }}>{selected.badge}</span>}
        {open ? <ChevronUp size={16} color={C.primary} /> : <ChevronDown size={16} color={C.ts} />}
      </button>
      {open && <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50, background: C.surface, borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.15)", overflow: "hidden", maxHeight: 280, overflowY: "auto" }}>
        {options.map(opt => <div key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", cursor: "pointer", fontSize: 14, background: opt.value === value ? C.primarySoft : "transparent", fontWeight: opt.value === value ? 500 : 400, color: C.tp, transition: TR }}>
          <span>{opt.label}</span>{opt.value === value && <Check size={14} color={C.primary} />}
        </div>)}
      </div>}
    </div>
  );
}

function StepperInput({ label, value, onChange, min = 0, max = 9999, step = 1, unit = "", decimals = 2 }) {
  const bump = (dir) => { const next = parseFloat((value + dir * step).toFixed(decimals)); if (next >= min && next <= max) onChange(next); };
  const btnS = (dis) => ({ width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.surface, cursor: dis ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: dis ? 0.4 : 1, transition: TR, flexShrink: 0 });
  return (
    <div style={{ fontFamily: FONT }}>
      {label && <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button style={btnS(value <= min)} onClick={() => bump(-1)}><Minus size={14} color={C.tp} /></button>
        <input type="number" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} onBlur={e => { const v = parseFloat(e.target.value); onChange(isNaN(v) ? min : Math.min(max, Math.max(min, v))); }}
          style={{ width: 80, textAlign: "center", borderRadius: 10, border: `1.5px solid ${C.border}`, padding: "6px 8px", fontSize: 14, fontWeight: 500, background: C.surface, color: C.tp, outline: "none", boxShadow: SHI, transition: TR, fontFamily: FONT, ...TN }} />
        <button style={btnS(value >= max)} onClick={() => bump(1)}><Plus size={14} color={C.tp} /></button>
        {unit && <span style={{ fontSize: 13, color: C.ts, marginLeft: 2 }}>{unit}</span>}
      </div>
    </div>
  );
}

function SegmentedControl({ value, onChange, options = [], disabledIds = [] }) {
  return (
    <div style={{ display: "inline-flex", background: C.border, borderRadius: 12, padding: 3, gap: 2, fontFamily: FONT }}>
      {options.map(opt => {
        const isD = disabledIds.includes(opt.id), isA = value === opt.id;
        return <button key={opt.id} onClick={() => !isD && onChange(opt.id)} style={{ padding: "7px 16px", borderRadius: 10, border: "none", cursor: isD ? "not-allowed" : "pointer", background: isA ? C.surface : "transparent", boxShadow: isA ? "0 1px 3px rgba(0,0,0,0.08)" : "none", fontSize: 13, fontWeight: isA ? 500 : 400, color: isA ? C.tp : C.ts, opacity: isD ? 0.4 : 1, transition: TR, fontFamily: FONT, whiteSpace: "nowrap" }}>{opt.label}</button>;
      })}
    </div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: FONT }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: C.tp }}>{label}</span>
      <button onClick={() => onChange(!value)} style={{ width: 40, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: value ? C.primary : C.border, position: "relative", transition: TR, flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 20, height: 20, borderRadius: "50%", background: C.surface, boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: TR }} />
      </button>
    </div>
  );
}

function KPICard({ label, value, borderColor = C.primary }) {
  return (
    <div style={{ borderRadius: 12, padding: 16, background: C.surface, boxShadow: SHC, borderLeft: `4px solid ${borderColor}`, fontFamily: FONT }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: C.ts, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: C.tp, lineHeight: 1, ...TN }}><AnimNum value={value} /></div>
    </div>
  );
}

function ColorChips({ colors = [], value, onChange, notes = {} }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontFamily: FONT }}>
      {colors.map(color => {
        const isS = value === color, hex = COLOR_HEX[color] || "#999";
        return <button key={color} onClick={() => onChange(color)} title={notes[color] || color} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px 5px 6px", borderRadius: 20, border: `2px solid ${isS ? C.primary : C.border}`, background: isS ? C.primarySoft : C.surface, cursor: "pointer", transition: TR, fontSize: 12, fontWeight: isS ? 600 : 400, color: C.tp }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%", background: hex, flexShrink: 0, border: `1px solid ${color === "Blanco" ? C.border : "transparent"}`, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
          {color}
        </button>;
      })}
    </div>
  );
}

function AlertBanner({ type = "warning", message }) {
  const cfg = { success: { bg: C.successSoft, color: "#1B7A2E", Icon: CheckCircle }, warning: { bg: C.warningSoft, color: "#8A6200", Icon: Info }, danger: { bg: C.dangerSoft, color: C.danger, Icon: AlertTriangle } };
  const { bg, color, Icon } = cfg[type] || cfg.warning;
  return <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, background: bg, fontFamily: FONT }}><Icon size={16} color={color} style={{ flexShrink: 0 }} /><span style={{ fontSize: 13, color, fontWeight: 500 }}>{message}</span></div>;
}

function Toast({ message, visible }) {
  if (!visible) return null;
  return <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 50, background: C.success, color: "#fff", borderRadius: 12, padding: "12px 20px", fontSize: 14, fontWeight: 500, fontFamily: FONT, boxShadow: "0 4px 24px rgba(52,199,89,0.35)", animation: "bmc-slideUp 220ms", display: "flex", alignItems: "center", gap: 8 }}><CheckCircle size={16} color="#fff" />{message}</div>;
}

function TableGroup({ title, items = [], subtotal, collapsed = false, onToggle, onOverride, onRevert, onExclude }) {
  const [editingCell, setEditingCell] = useState(null); // { lineId, field }
  const [editValue, setEditValue] = useState("");
  const cols = "2fr 0.6fr 0.6fr 0.8fr 0.8fr 72px";

  const startEdit = (lineId, field, currentVal) => {
    setEditingCell({ lineId, field });
    setEditValue(String(currentVal));
  };

  const commitEdit = (lineId, field) => {
    const num = parseFloat(editValue);
    if (!isNaN(num) && num >= 0 && onOverride) onOverride(lineId, field, num);
    setEditingCell(null);
  };

  const handleKeyDown = (e, lineId, field) => {
    if (e.key === "Enter") commitEdit(lineId, field);
    if (e.key === "Escape") setEditingCell(null);
  };

  const editInputS = { width: "100%", padding: "2px 4px", borderRadius: 6, border: `1.5px solid ${C.primary}`, fontSize: 12, textAlign: "right", outline: "none", fontFamily: FONT, boxShadow: SHI, ...TN };

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: SHC, fontFamily: FONT, marginBottom: 12 }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", background: C.brandLight, cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14, color: C.brand }}>{collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}{title}</div>
        <span style={{ fontWeight: 700, fontSize: 14, color: C.brand, ...TN }}>${typeof subtotal === "number" ? subtotal.toFixed(2) : subtotal}</span>
      </div>
      {!collapsed && <div>
        <div style={{ display: "grid", gridTemplateColumns: cols, background: C.surfaceAlt, borderBottom: `1px solid ${C.border}` }}>
          {["Descripción", "Cant.", "Unid.", "P.Unit.", "Total", "Acciones"].map((h, i) => <div key={i} style={{ fontSize: 11, fontWeight: 600, color: C.ts, padding: "4px 12px", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: i > 1 ? "right" : "left" }}>{h}</div>)}
        </div>
        {items.map((item, idx) => {
          const isEditing = editingCell && editingCell.lineId === item.lineId;
          return <div key={idx} style={{ display: "grid", gridTemplateColumns: cols, background: item.isOverridden ? C.warningSoft : idx % 2 === 0 ? C.surface : C.surfaceAlt, borderBottom: `1px solid ${C.border}`, alignItems: "center" }}>
            <div style={{ padding: "8px 12px", fontSize: 13, color: item.isOverridden ? C.warning : C.tp, fontWeight: item.isOverridden ? 600 : 400 }}>{item.label}</div>
            <div style={{ padding: "4px 8px", fontSize: 13, textAlign: "right", color: C.ts, ...TN }}>
              {isEditing && editingCell.field === "cant"
                ? <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={() => commitEdit(item.lineId, "cant")} onKeyDown={e => handleKeyDown(e, item.lineId, "cant")} autoFocus style={editInputS} />
                : <span onClick={() => onOverride && startEdit(item.lineId, "cant", item.cant)} style={{ cursor: onOverride ? "text" : "default" }}>{typeof item.cant === "number" ? (item.cant % 1 === 0 ? item.cant : item.cant.toFixed(2)) : item.cant}</span>}
            </div>
            <div style={{ padding: "8px 12px", fontSize: 13, textAlign: "right", color: C.tt }}>{item.unidad}</div>
            <div style={{ padding: "4px 8px", fontSize: 13, textAlign: "right", color: C.ts, ...TN }}>
              {isEditing && editingCell.field === "pu"
                ? <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={() => commitEdit(item.lineId, "pu")} onKeyDown={e => handleKeyDown(e, item.lineId, "pu")} autoFocus style={editInputS} />
                : <span onClick={() => onOverride && startEdit(item.lineId, "pu", item.pu)} style={{ cursor: onOverride ? "text" : "default" }}>{typeof item.pu === "number" ? item.pu.toFixed(2) : item.pu}</span>}
            </div>
            <div style={{ padding: "8px 12px", fontSize: 13, textAlign: "right", fontWeight: 600, color: C.tp, ...TN }}>${typeof item.total === "number" ? item.total.toFixed(2) : item.total}</div>
            <div style={{ padding: "4px 8px", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
              {onOverride && <button title="Editar" aria-label="Editar fila" onClick={() => isEditing ? setEditingCell(null) : startEdit(item.lineId, "cant", item.cant)} style={{ background: "none", border: "none", cursor: "pointer", color: isEditing ? C.primary : C.tt, padding: 2, borderRadius: 4, display: "flex", alignItems: "center" }}><Edit3 size={13} /></button>}
              {onRevert && item.isOverridden && <button title="Revertir" aria-label="Revertir cambios" onClick={() => onRevert(item.lineId)} style={{ background: "none", border: "none", cursor: "pointer", color: C.warning, padding: 2, borderRadius: 4, display: "flex", alignItems: "center" }}><RotateCcw size={13} /></button>}
              {onExclude && <button title="Quitar del presupuesto" aria-label="Quitar item" onClick={() => onExclude(item.lineId, item.label)} style={{ background: "none", border: "none", cursor: "pointer", color: C.danger, padding: 2, borderRadius: 4, display: "flex", alignItems: "center" }}><X size={13} /></button>}
            </div>
          </div>;
        })}
      </div>}
    </div>
  );
}

function MobileBottomBar({ total, onPrint, onWhatsApp }) {
  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      background: C.dark,
      color: "#fff",
      padding: "12px 16px",
      display: "none",
      zIndex: 100,
      boxShadow: "0 -4px 20px rgba(0,0,0,0.2)",
      fontFamily: FONT,
    }} className="bmc-mobile-bar">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>TOTAL USD</div>
          <div style={{ fontSize: 24, fontWeight: 800, ...TN }}>${fmtPrice(total)}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onWhatsApp} style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "#25D366", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>WA</button>
          <button onClick={onPrint} style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: C.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>PDF</button>
        </div>
      </div>
    </div>
  );
}

function AguaSvg1({ color = "#0071E3" }) {
  return <svg viewBox="0 0 80 48" width="80" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="36" width="72" height="8" rx="2" fill="#E5E5EA" />
    <path d="M8 36 L8 18 L72 10 L72 36" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    <line x1="72" y1="10" x2="72" y2="36" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" />
    <circle cx="8" cy="18" r="2" fill={color} />
    <circle cx="72" cy="10" r="2" fill={color} />
  </svg>;
}

function AguaSvg2({ color = "#0071E3" }) {
  return <svg viewBox="0 0 80 48" width="80" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="36" width="72" height="8" rx="2" fill="#E5E5EA" />
    <path d="M8 36 L8 22 L40 8 L72 22 L72 36" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    <line x1="40" y1="8" x2="40" y2="36" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" />
    <circle cx="40" cy="8" r="2.5" fill={color} />
    <circle cx="8" cy="22" r="2" fill={color} />
    <circle cx="72" cy="22" r="2" fill={color} />
  </svg>;
}

function AguaSvg4({ color = "#AEAEB2" }) {
  return <svg viewBox="0 0 80 48" width="80" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="36" width="72" height="8" rx="2" fill="#E5E5EA" />
    <path d="M8 36 L8 22 L28 10 L52 10 L72 22 L72 36" fill={color} fillOpacity="0.08" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="4 2" />
    <line x1="28" y1="10" x2="28" y2="36" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
    <line x1="52" y1="10" x2="52" y2="36" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
  </svg>;
}

const AGUA_SVGS = { una_agua: AguaSvg1, dos_aguas: AguaSvg2, cuatro_aguas: AguaSvg4 };

function TipoAguasSelector({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 10, fontFamily: FONT }}>
      {TIPO_AGUAS.filter(t => t.enabled).map(tipo => {
        const isS = value === tipo.id;
        const SvgComp = AGUA_SVGS[tipo.id];
        return (
          <button
            key={tipo.id}
            onClick={() => onChange(tipo.id)}
            style={{
              flex: 1, padding: "12px 8px", borderRadius: 14, textAlign: "center",
              border: `2px solid ${isS ? C.primary : C.border}`,
              background: isS ? C.primarySoft : C.surface,
              cursor: "pointer",
              transition: TR,
              boxShadow: isS ? `0 0 0 3px ${C.primarySoft}` : "none",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            }}
          >
            <SvgComp color={isS ? C.primary : C.ts} />
            <div style={{ fontSize: 13, fontWeight: 600, color: isS ? C.primary : C.tp }}>{tipo.label}</div>
            <div style={{ fontSize: 10, color: C.ts, lineHeight: 1.3 }}>{tipo.description}</div>
          </button>
        );
      })}
    </div>
  );
}

const SIDE_LABELS = { frente: "FRENTE INF", fondo: "FRENTE SUP", latIzq: "LAT IZQ", latDer: "LAT DER" };

function RoofBorderSelector({ borders = {}, onChange, panelFamilia = "", disabledSides = [] }) {
  const [openSide, setOpenSide] = useState(null);
  const containerRef = useRef(null);
  const panelFam = PANELS_TECHO[panelFamilia]?.fam || "";

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpenSide(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getOpts = (side) => (BORDER_OPTIONS[side] || []).filter(o => !o.familias || o.familias.includes(panelFam));
  const getLabel = (side) => {
    const val = borders[side];
    if (!val || val === "none") return "—";
    const opt = (BORDER_OPTIONS[side] || []).find(o => o.id === val);
    return opt ? opt.label : val;
  };

  const handleEdgeClick = (side) => {
    if (disabledSides.includes(side)) return;
    setOpenSide(prev => prev === side ? null : side);
  };

  const margin = 18;
  const svgW = 280, svgH = 180;
  const vbW = svgW + margin * 2, vbH = svgH + margin * 2;
  const ox = margin, oy = margin;
  const edge = 10, pad = 30;
  const innerX = ox + pad, innerW = svgW - pad * 2, innerH = svgH - edge * 2;

  const edgeDefs = {
    fondo:  { x: innerX, y: oy, w: innerW, h: edge },
    frente: { x: innerX, y: oy + svgH - edge, w: innerW, h: edge },
    latIzq: { x: innerX - edge, y: oy + edge, w: edge, h: innerH },
    latDer: { x: innerX + innerW, y: oy + edge, w: edge, h: innerH },
  };

  const popoverPos = {
    fondo:  { top: 0, left: "50%", transform: "translateX(-50%) translateY(-100%)" },
    frente: { bottom: 0, left: "50%", transform: "translateX(-50%) translateY(100%)" },
    latIzq: { top: "50%", left: 0, transform: "translateX(-100%) translateY(-50%)" },
    latDer: { top: "50%", right: 0, transform: "translateX(100%) translateY(-50%)" },
  };

  const labelPos = {
    fondo:  { x: ox + svgW / 2, y: oy + edge / 2 + 1, anchor: "middle" },
    frente: { x: ox + svgW / 2, y: oy + svgH - edge / 2 + 1, anchor: "middle" },
    latIzq: { x: innerX - edge / 2, y: oy + svgH / 2, anchor: "middle", rotate: -90 },
    latDer: { x: innerX + innerW + edge / 2, y: oy + svgH / 2, anchor: "middle", rotate: 90 },
  };

  return (
    <div ref={containerRef} style={{ position: "relative", fontFamily: FONT }}>
      <svg viewBox={`0 0 ${vbW} ${vbH}`} width="100%" style={{ display: "block", maxWidth: 380, margin: "0 auto" }}>
        {/* Center panel area */}
        <rect x={innerX} y={oy + edge} width={innerW} height={innerH} rx={6} fill={C.brandLight} stroke={C.border} strokeWidth={1} />
        <text x={ox + svgW / 2} y={oy + svgH / 2 + 1} textAnchor="middle" dominantBaseline="central" fill={C.brand} fontSize={13} fontWeight={700} fontFamily={FONT}>PANELES</text>

        {/* Edge rects */}
        {["fondo", "frente", "latIzq", "latDer"].map(side => {
          const d = edgeDefs[side];
          const val = borders[side];
          const active = val && val !== "none";
          const isOpen = openSide === side;
          const isDisabled = disabledSides.includes(side);
          const lp = labelPos[side];
          const abbr = isDisabled && side === "fondo" ? "Cumbrera" : getLabel(side);
          const isVert = side === "latIzq" || side === "latDer";
          const rx = isVert ? 4 : 6;
          return (
            <g key={side} onClick={() => handleEdgeClick(side)} style={{ cursor: isDisabled ? "not-allowed" : "pointer" }}>
              <rect
                x={d.x} y={d.y} width={d.w} height={d.h} rx={rx}
                fill={isDisabled ? C.surfaceAlt : active ? C.primarySoft : C.surface}
                stroke={isOpen ? C.primary : active ? C.primary : C.border}
                strokeWidth={isOpen ? 2 : 1.5}
                strokeDasharray={active || isOpen ? "none" : "4 3"}
                opacity={isDisabled ? 0.4 : 1}
              />
              {isOpen && <rect x={d.x - 2} y={d.y - 2} width={d.w + 4} height={d.h + 4} rx={rx + 2} fill="none" stroke={C.primary} strokeWidth={1} opacity={0.3} />}
              <text
                x={lp.x} y={lp.y} textAnchor={lp.anchor} dominantBaseline="central"
                fill={isDisabled ? C.tt : active ? C.primary : C.ts}
                fontSize={8} fontWeight={600} fontFamily={FONT}
                transform={lp.rotate ? `rotate(${lp.rotate}, ${lp.x}, ${lp.y})` : undefined}
              >{abbr.length > 12 ? abbr.slice(0, 10) + "…" : abbr}</text>
            </g>
          );
        })}

        {/* Side name labels outside the diagram */}
        <text x={ox + svgW / 2} y={oy + svgH + 14} textAnchor="middle" fill={C.ts} fontSize={9} fontWeight={600} fontFamily={FONT} letterSpacing="0.05em">▼ FRENTE INF</text>
        <text x={ox + svgW / 2} y={oy - 6} textAnchor="middle" fill={C.ts} fontSize={9} fontWeight={600} fontFamily={FONT} letterSpacing="0.05em">▲ FRENTE SUP</text>
        <text x={innerX - edge - 6} y={oy + svgH / 2} textAnchor="middle" dominantBaseline="central" fill={C.ts} fontSize={9} fontWeight={600} fontFamily={FONT} letterSpacing="0.05em" transform={`rotate(-90, ${innerX - edge - 6}, ${oy + svgH / 2})`}>◄ IZQ</text>
        <text x={innerX + innerW + edge + 6} y={oy + svgH / 2} textAnchor="middle" dominantBaseline="central" fill={C.ts} fontSize={9} fontWeight={600} fontFamily={FONT} letterSpacing="0.05em" transform={`rotate(90, ${innerX + innerW + edge + 6}, ${oy + svgH / 2})`}>DER ►</text>
      </svg>

      {/* Popover for the open side */}
      {openSide && (() => {
        const opts = getOpts(openSide);
        const pos = popoverPos[openSide];
        return (
          <div style={{ position: "absolute", ...pos, zIndex: 30, background: C.surface, borderRadius: 10, boxShadow: "0 4px 24px rgba(0,0,0,0.15)", minWidth: 160, maxHeight: 200, display: "flex", flexDirection: "column", animation: "bmc-fade 100ms ease-in-out" }}>
            <div style={{ padding: "6px 12px", fontSize: 10, fontWeight: 700, color: C.ts, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt, borderRadius: "10px 10px 0 0", flexShrink: 0 }}>{SIDE_LABELS[openSide]}</div>
            <div style={{ overflowY: "auto", borderRadius: "0 0 10px 10px" }}>
            {opts.map(opt => {
              const isSel = borders[openSide] === opt.id;
              return (
                <div key={opt.id} onClick={(e) => { e.stopPropagation(); onChange(openSide, opt.id); setOpenSide(null); }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", cursor: "pointer", fontSize: 13, background: isSel ? C.primarySoft : "transparent", fontWeight: isSel ? 500 : 400, color: C.tp, transition: TR }}>
                  <span>{opt.label}</span>
                  {isSel && <Check size={14} color={C.primary} />}
                </div>
              );
            })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PanelinCalculadoraV3() {
  // ── State ──
  const [listaPrecios, setLP] = useState("web");
  const [scenario, setScenario] = useState("solo_techo");
  const [proyecto, setProyecto] = useState({ tipoCliente: "empresa", nombre: "", rut: "", telefono: "", direccion: "", descripcion: "", refInterna: "", fecha: new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" }) });
  const [techo, setTecho] = useState({ familia: "", espesor: "", color: "Blanco", zonas: [{ largo: 6.0, ancho: 5.0 }], pendiente: 0, tipoAguas: "una_agua", tipoEst: "metal", ptsHorm: 0, borders: { frente: "gotero_frontal", fondo: "gotero_lateral", latIzq: "gotero_lateral", latDer: "gotero_lateral" }, opciones: { inclCanalon: false, inclGotSup: false, inclSell: true } });
  const [pared, setPared] = useState({ familia: "", espesor: "", color: "Blanco", alto: 3.5, perimetro: 40, numEsqExt: 4, numEsqInt: 0, aberturas: [], tipoEst: "metal", inclSell: true, incl5852: false });
  const [camara, setCamara] = useState({ largo_int: 6, ancho_int: 4, alto_int: 3 });
  const [flete, setFlete] = useState(280);
  const [overrides, setOverrides] = useState({});
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [toast, setToast] = useState(null);
  const [showTransp, setShowTransp] = useState(false);
  const [excludedItems, setExcludedItems] = useState({}); // { lineId: label }
  const [categoriasActivas, setCategoriasActivas] = useState(() => {
    const initial = {};
    Object.keys(CATEGORIAS_BOM).forEach(k => { initial[k] = CATEGORIAS_BOM[k].default; });
    return initial;
  });
  // Section refs for auto-scroll
  const panelRef = useRef(null);
  const dimensionesRef = useRef(null);
  const bordesRef = useRef(null);
  const opcionesRef = useRef(null);

  const scrollToSection = useCallback((sectionKey) => {
    const refs = { panel: panelRef, dimensiones: dimensionesRef, bordes: bordesRef, opciones: opcionesRef };
    const ref = refs[sectionKey];
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Sync LISTA_ACTIVA
  useEffect(() => { setListaPrecios(listaPrecios); }, [listaPrecios]);

  const vis = VIS[scenario] || VIS.solo_techo;
  const scenarioDef = SCENARIOS_DEF.find(s => s.id === scenario);

  // ── Available families for current scenario (separate techo/pared) ──
  const techoFamilyOptions = useMemo(() => {
    if (!scenarioDef?.hasTecho) return [];
    return Object.entries(PANELS_TECHO).map(([fk, pd]) => ({ value: fk, label: pd.label, sublabel: pd.sub }));
  }, [scenarioDef]);

  const paredFamilyOptions = useMemo(() => {
    if (!scenarioDef?.hasPared) return [];
    return Object.entries(PANELS_PARED).map(([fk, pd]) => ({ value: fk, label: pd.label, sublabel: pd.sub }));
  }, [scenarioDef]);

  // ── Panel data for techo ──
  const techoPanelData = useMemo(() => PANELS_TECHO[techo.familia] || null, [techo.familia]);
  const techoEspesorOptions = useMemo(() => {
    if (!techoPanelData) return [];
    return Object.keys(techoPanelData.esp).map(e => ({ value: Number(e), label: `${e} mm`, badge: techoPanelData.esp[e].ap ? `AP ${techoPanelData.esp[e].ap}m` : undefined }));
  }, [techoPanelData]);

  // ── Panel data for pared ──
  const paredPanelData = useMemo(() => PANELS_PARED[pared.familia] || null, [pared.familia]);
  const paredEspesorOptions = useMemo(() => {
    if (!paredPanelData) return [];
    return Object.keys(paredPanelData.esp).map(e => ({ value: Number(e), label: `${e} mm` }));
  }, [paredPanelData]);

  // ── Combined scenario flag ──
  const isCombined = scenarioDef?.hasTecho && scenarioDef?.hasPared;

  // ── Zonas helpers ──
  const addZona = () => setTecho(t => ({ ...t, zonas: [...t.zonas, { largo: 6.0, ancho: 5.0 }] }));
  const removeZona = (idx) => setTecho(t => ({ ...t, zonas: t.zonas.length > 1 ? t.zonas.filter((_, i) => i !== idx) : t.zonas }));
  const updateZona = (idx, key, val) => setTecho(t => ({ ...t, zonas: t.zonas.map((z, i) => i === idx ? { ...z, [key]: val } : z) }));

  // ── Totals from all zones (for display and calculations) ──
  const zonasTotales = useMemo(() => {
    if (!techo.zonas?.length) return { largo: 6, ancho: 5, area: 30 };
    const totalArea = techo.zonas.reduce((sum, z) => sum + (z.largo * z.ancho), 0);
    const maxLargo = Math.max(...techo.zonas.map(z => z.largo));
    const totalAncho = techo.zonas.reduce((sum, z) => sum + z.ancho, 0);
    return { largo: maxLargo, ancho: totalAncho, area: +totalArea.toFixed(2) };
  }, [techo.zonas]);

  // ── Calculate results ──
  const results = useMemo(() => {
    const sc = scenario;
    try {
      if (sc === "solo_techo") {
        if (!techo.familia || !techo.espesor) return null;
        // For 2 aguas: each zona generates 2 faldones (half ancho each)
        // Agua 1 keeps frente+latIzq+latDer borders, fondo=cumbrera
        // Agua 2 keeps fondo(original)+latIzq+latDer borders, frente=cumbrera (shared, not double-counted)
        const is2Aguas = techo.tipoAguas === "dos_aguas";
        const zonaResults = techo.zonas.flatMap(zona => {
          if (is2Aguas) {
            const halfAncho = +(zona.ancho / 2).toFixed(2);
            const agua1 = calcTechoCompleto({
              ...techo, largo: zona.largo, ancho: halfAncho,
              borders: { ...techo.borders, fondo: "cumbrera" },
            });
            const agua2 = calcTechoCompleto({
              ...techo, largo: zona.largo, ancho: halfAncho,
              borders: { frente: techo.borders.fondo === "cumbrera" ? "cumbrera" : techo.borders.fondo, fondo: "none", latIzq: techo.borders.latIzq, latDer: techo.borders.latDer },
            });
            return [agua1, agua2];
          }
          return [calcTechoCompleto({ ...techo, largo: zona.largo, ancho: zona.ancho })];
        });
        return mergeZonaResults(zonaResults);
      }
      if (sc === "solo_fachada") {
        if (!pared.familia || !pared.espesor) return null;
        return calcParedCompleto(pared);
      }
      if (sc === "techo_fachada") {
        let rT = null;
        if (techo.familia && techo.espesor) {
          const is2A = techo.tipoAguas === "dos_aguas";
          const zonaResults = techo.zonas.flatMap(zona => {
            if (is2A) {
              const ha = +(zona.ancho / 2).toFixed(2);
              const a1 = calcTechoCompleto({ ...techo, largo: zona.largo, ancho: ha, borders: { ...techo.borders, fondo: "cumbrera" } });
              const a2 = calcTechoCompleto({ ...techo, largo: zona.largo, ancho: ha, borders: { frente: techo.borders.fondo === "cumbrera" ? "cumbrera" : techo.borders.fondo, fondo: "none", latIzq: techo.borders.latIzq, latDer: techo.borders.latDer } });
              return [a1, a2];
            }
            return [calcTechoCompleto({ ...techo, largo: zona.largo, ancho: zona.ancho })];
          });
          rT = mergeZonaResults(zonaResults);
        }
        const rP = pared.familia && pared.espesor ? calcParedCompleto(pared) : null;
        if (!rT && !rP) return null;
        const allItems = [...(rT?.allItems || []), ...(rP?.allItems || [])];
        const totales = calcTotalesSinIVA(allItems);
        return { ...rT, paredResult: rP, allItems, totales, warnings: [...(rT?.warnings || []), ...(rP?.warnings || [])] };
      }
      if (sc === "camara_frig") {
        if (!pared.familia || !pared.espesor) return null;
        const perim = 2 * (camara.largo_int + camara.ancho_int);
        const rP = calcParedCompleto({ ...pared, perimetro: perim, alto: camara.alto_int, numEsqExt: 4, numEsqInt: 0 });
        const rT = calcTechoCompleto({ familia: pared.familia in PANELS_TECHO ? pared.familia : "ISODEC_EPS", espesor: pared.espesor, largo: camara.largo_int, ancho: camara.ancho_int, tipoEst: "metal", borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" }, opciones: { inclCanalon: false, inclGotSup: false, inclSell: true }, color: pared.color });
        const allItems = [...(rP?.allItems || []), ...(rT?.allItems || [])];
        const totales = calcTotalesSinIVA(allItems);
        return { ...rP, techoResult: rT, allItems, totales, warnings: [...(rP?.warnings || []), ...(rT?.warnings || [])] };
      }
    } catch (e) { return { error: e.message }; }
    return null;
  }, [scenario, techo, pared, camara]);

  // ── Build BOM groups ──
  const groups = useMemo(() => {
    if (!results || results.error) return [];
    let g = bomToGroups(results);
    // Add flete — uses the user-supplied value from the stepper (pre-VAT)
    if (flete > 0) {
      g.push({ title: "SERVICIOS", items: [{ label: SERVICIOS.flete.label, sku: "FLETE", cant: 1, unidad: "servicio", pu: flete, total: flete }] });
    }
    const withOverrides = applyOverrides(g, overrides);

    // Filter by active categories
    const allowedGroups = new Set();
    Object.entries(categoriasActivas).forEach(([cat, active]) => {
      if (active && CATEGORIA_TO_GROUPS[cat]) {
        CATEGORIA_TO_GROUPS[cat].forEach(grp => allowedGroups.add(grp));
      }
    });
    const filteredByCategory = withOverrides.filter(group => allowedGroups.has(group.title));

    // Filter out excluded items
    return filteredByCategory.map(group => ({
      ...group,
      items: group.items.filter(item => !excludedItems[item.lineId])
    })).filter(group => group.items.length > 0);
  }, [results, overrides, flete, excludedItems, categoriasActivas]);

  // ── Grand totals (with overrides applied) ──
  const grandTotal = useMemo(() => {
    const allItems = [];
    groups.forEach(g => g.items.forEach(i => allItems.push(i)));
    return calcTotalesSinIVA(allItems);
  }, [groups]);

  // ── Helpers ──
  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); }, []);

  // Build panel info for output (supports combined scenarios)
  const panelInfo = useMemo(() => {
    if (isCombined) {
      const parts = [];
      if (techoPanelData && techo.espesor) parts.push(`Techo: ${techoPanelData.label} ${techo.espesor}mm ${techo.color}`);
      if (paredPanelData && pared.espesor) parts.push(`Pared: ${paredPanelData.label} ${pared.espesor}mm ${pared.color}`);
      return { label: parts.join(" + "), espesor: "", color: "" };
    }
    if (scenarioDef?.hasTecho) return { label: techoPanelData?.label || "", espesor: techo.espesor, color: techo.color };
    return { label: paredPanelData?.label || "", espesor: pared.espesor, color: pared.color };
  }, [isCombined, scenarioDef, techoPanelData, paredPanelData, techo, pared]);

  const handleCopyWA = () => {
    const txt = buildWhatsAppText({
      client: proyecto, project: proyecto, scenario,
      panel: panelInfo,
      totals: grandTotal,
      listaLabel: listaPrecios === "venta" ? "BMC directo" : "Web",
    });
    navigator.clipboard.writeText(txt).then(() => showToast("Copiado al portapapeles"));
  };

  const handlePrint = () => {
    const dimensions = {};
    if (scenarioDef?.hasTecho) {
      dimensions.zonas = techo.zonas;
      dimensions.area = zonasTotales.area;
      if (results?.paneles?.areaTotal) dimensions.area = results.paneles.areaTotal;
      if (results?.paneles?.cantPaneles) dimensions.cantPaneles = results.paneles.cantPaneles;
    }
    if (scenarioDef?.hasPared) {
      dimensions.alto = pared.alto;
      dimensions.perimetro = pared.perimetro;
      if (results?.paneles?.areaNeta) dimensions.area = results.paneles.areaNeta;
      if (results?.paneles?.cantPaneles) dimensions.cantPaneles = results.paneles.cantPaneles;
    }
    const html = generatePrintHTML({
      client: proyecto, project: proyecto, scenario,
      panel: panelInfo,
      autoportancia: results?.autoportancia || results?.techoResult?.autoportancia,
      groups: groups.map(g => ({ title: g.title, items: g.items, subtotal: g.items.reduce((s, i) => s + (i.total || 0), 0) })),
      totals: grandTotal,
      warnings: results?.warnings || [],
      dimensions,
      descarte: results?.paneles?.descarte,
      listaPrecios,
    });
    openPrintWindow(html);
  };

  const handleInternalReport = () => {
    const dimensions = {};
    if (scenarioDef?.hasTecho) {
      dimensions.zonas = techo.zonas;
      dimensions.area = zonasTotales.area;
      if (results?.paneles?.areaTotal) dimensions.area = results.paneles.areaTotal;
      if (results?.paneles?.cantPaneles) dimensions.cantPaneles = results.paneles.cantPaneles;
    }
    if (scenarioDef?.hasPared) {
      dimensions.alto = pared.alto;
      dimensions.perimetro = pared.perimetro;
      if (results?.paneles?.areaNeta) dimensions.area = results.paneles.areaNeta;
      if (results?.paneles?.cantPaneles) dimensions.cantPaneles = results.paneles.cantPaneles;
    }
    const formulas = [];
    if (scenarioDef?.hasTecho && results?.paneles && techoPanelData) {
      techo.zonas.forEach((z, i) => {
        formulas.push(`Zona ${i + 1}: ${z.largo}m × ${z.ancho}m = ${(z.largo * z.ancho).toFixed(2)}m²`);
      });
      formulas.push(`cantPaneles total = ${results.paneles.cantPaneles}`);
      formulas.push(`areaTotal = ${results.paneles.areaTotal}m²`);
      formulas.push(`costoPaneles = ${results.paneles.areaTotal} × $${results.paneles.precioM2} = $${results.paneles.costoPaneles}`);
      if (results?.autoportancia?.apoyos) {
        formulas.push(`apoyos = ${results.autoportancia.apoyos} (basado en largo mayor: ${zonasTotales.largo}m)`);
      }
    }
    if (scenarioDef?.hasPared && !scenarioDef?.hasTecho && results?.paneles) {
      const paredPanelData = PANELS_PARED[pared.familia];
      if (paredPanelData) {
        formulas.push(`cantPaneles = ceil(${pared.perimetro} / ${paredPanelData.au}) = ${results.paneles.cantPaneles}`);
        formulas.push(`areaBruta = ${results.paneles.cantPaneles} × ${pared.alto} × ${paredPanelData.au} = ${results.paneles.areaBruta}m²`);
        if (results.paneles.areaAberturas > 0) {
          formulas.push(`areaAberturas = ${results.paneles.areaAberturas}m²`);
        }
        formulas.push(`areaNeta = ${results.paneles.areaBruta} - ${results.paneles.areaAberturas} = ${results.paneles.areaNeta}m²`);
        formulas.push(`costoPaneles = ${results.paneles.areaNeta} × $${results.paneles.precioM2} = $${results.paneles.costoPaneles}`);
      }
    }
    const categoriasDesactivadas = Object.entries(categoriasActivas)
      .filter(([, activa]) => !activa)
      .map(([cat]) => CATEGORIAS_BOM[cat]?.label || cat);
    const html = generateInternalHTML({
      client: proyecto, project: proyecto, scenario,
      panel: panelInfo,
      autoportancia: results?.autoportancia || results?.techoResult?.autoportancia,
      groups: groups.map(g => ({ title: g.title, items: g.items })),
      totals: grandTotal,
      warnings: results?.warnings || [],
      dimensions,
      descarte: results?.paneles?.descarte,
      listaPrecios,
      excludedItems,
      categoriasDesactivadas,
      formulas,
    });
    openPrintWindow(html);
  };

  const handleReset = () => {
    setScenario("solo_techo");
    setLP("web");
    setProyecto({ tipoCliente: "empresa", nombre: "", rut: "", telefono: "", direccion: "", descripcion: "", refInterna: "", fecha: new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" }) });
    setTecho({ familia: "", espesor: "", color: "Blanco", zonas: [{ largo: 6.0, ancho: 5.0 }], pendiente: 0, tipoAguas: "una_agua", tipoEst: "metal", ptsHorm: 0, borders: { frente: "gotero_frontal", fondo: "gotero_lateral", latIzq: "gotero_lateral", latDer: "gotero_lateral" }, opciones: { inclCanalon: false, inclGotSup: false, inclSell: true } });
    setPared({ familia: "", espesor: "", color: "Blanco", alto: 3.5, perimetro: 40, numEsqExt: 4, numEsqInt: 0, aberturas: [], tipoEst: "metal", inclSell: true, incl5852: false });
    setCamara({ largo_int: 6, ancho_int: 4, alto_int: 3 });
    setOverrides({});
    setExcludedItems({});
    setCategoriasActivas(() => {
      const initial = {};
      Object.keys(CATEGORIAS_BOM).forEach(k => { initial[k] = CATEGORIAS_BOM[k].default; });
      return initial;
    });
  };

  // ── Input updaters ──
  const uT = (k, v) => setTecho(t => ({ ...t, [k]: v }));
  const uP = (k, v) => setPared(pd => ({ ...pd, [k]: v }));
  const uPr = (k, v) => setProyecto(pr => ({ ...pr, [k]: v }));

  const handleOverride = useCallback((lineId, field, value) => {
    setOverrides(prev => ({ ...prev, [lineId]: { field, value: +value } }));
  }, []);

  const handleRevert = useCallback((lineId) => {
    setOverrides(prev => { const next = { ...prev }; delete next[lineId]; return next; });
  }, []);

  const handleExclude = useCallback((lineId, label) => {
    setExcludedItems(prev => ({ ...prev, [lineId]: label }));
  }, []);

  const handleRestore = useCallback((lineId) => {
    setExcludedItems(prev => { const next = { ...prev }; delete next[lineId]; return next; });
  }, []);

  const handleRestoreAll = useCallback(() => {
    setExcludedItems({});
  }, []);

  const setTechoFamilia = (fam) => {
    const pd = PANELS_TECHO[fam];
    if (!pd) return;
    const firstEsp = Number(Object.keys(pd.esp)[0]);
    const newFam = pd.fam;

    // Clear incompatible borders when switching families
    setTecho(t => {
      const newBorders = { ...t.borders };
      Object.entries(BORDER_OPTIONS).forEach(([side, opts]) => {
        const currentVal = newBorders[side];
        const opt = opts.find(o => o.id === currentVal);
        // If current border has familias restriction and new family is not included, reset to first valid option
        if (opt?.familias && !opt.familias.includes(newFam)) {
          const firstValid = opts.find(o => !o.familias || o.familias.includes(newFam));
          newBorders[side] = firstValid?.id || "none";
        }
      });
      return { ...t, familia: fam, espesor: firstEsp, borders: newBorders };
    });
    // Auto-scroll to dimensiones after selecting family
    setTimeout(() => scrollToSection("dimensiones"), 100);
  };

  const setParedFamilia = (fam) => {
    const pd = PANELS_PARED[fam];
    if (!pd) return;
    const firstEsp = Number(Object.keys(pd.esp)[0]);
    setPared(pd2 => ({ ...pd2, familia: fam, espesor: firstEsp }));
  };

  // ── Budget log state ──
  const [showLogPanel, setShowLogPanel] = useState(false);
  const [logEntries, setLogEntries] = useState(() => getAllLogs());
  const [currentBudgetCode, setCurrentBudgetCode] = useState(null);
  const autoSaveTimer = useRef(null);
  const lastSavedHash = useRef("");

  const scenarioLabels = useRef({ solo_techo: "Techo", solo_fachada: "Fachada", techo_fachada: "Techo+Fachada", camara_frig: "Cámara Frig." });

  // ── Section style ──
  const sectionS = { background: C.surface, borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: SHC };
  const labelS = { fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" };
  const inputS = { width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, color: C.tp, outline: "none", fontFamily: FONT, boxShadow: SHI };

  // ── KPI values (aggregate for combined scenarios) ──
  const kpiArea = useMemo(() => {
    if (!results) return 0;
    let total = 0;
    if (results.paneles) total += results.paneles.areaTotal || results.paneles.areaNeta || 0;
    if (results.paredResult?.paneles) total += results.paredResult.paneles.areaNeta || 0;
    if (results.techoResult?.paneles) total += results.techoResult.paneles.areaTotal || 0;
    return total;
  }, [results]);
  
  const kpiPaneles = useMemo(() => {
    if (!results) return 0;
    let total = 0;
    if (results.paneles) total += results.paneles.cantPaneles || 0;
    if (results.paredResult?.paneles) total += results.paredResult.paneles.cantPaneles || 0;
    if (results.techoResult?.paneles) total += results.techoResult.paneles.cantPaneles || 0;
    return total;
  }, [results]);
  
  const kpiApoyos = useMemo(() => {
    if (!results) return 0;
    if (results.autoportancia?.apoyos) return results.autoportancia.apoyos;
    if (results.techoResult?.autoportancia?.apoyos) return results.techoResult.autoportancia.apoyos;
    return pared.numEsqExt + pared.numEsqInt;
  }, [results, pared.numEsqExt, pared.numEsqInt]);
  
  const kpiFij = useMemo(() => {
    if (!results) return 0;
    let total = 0;
    if (results.fijaciones?.puntosFijacion) total += results.fijaciones.puntosFijacion;
    if (results.paredResult?.fijaciones?.items) total += results.paredResult.fijaciones.items.reduce((s, i) => s + (i.cant || 0), 0);
    if (results.techoResult?.fijaciones?.puntosFijacion) total += results.techoResult.fijaciones.puntosFijacion;
    return total;
  }, [results]);

  // ── Auto-save: debounced, only when there are valid groups ──
  useEffect(() => {
    if (!groups.length || !grandTotal.totalFinal) return;
    const productoStr = panelInfo.espesor
      ? `${panelInfo.label} ${panelInfo.espesor}mm`
      : panelInfo.label;
    const hash = `${scenario}|${productoStr}|${proyecto.nombre}|${grandTotal.totalFinal.toFixed(2)}`;
    if (hash === lastSavedHash.current) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const snapshot = { scenario, listaPrecios, proyecto, techo, pared, camara, flete, overrides, excludedItems, categoriasActivas };
      const entry = saveBudget({
        cliente: proyecto.nombre,
        producto: productoStr,
        escenario: scenarioLabels.current[scenario] || scenario,
        listaPrecios,
        total: grandTotal.totalFinal,
        groups: groups.map(g => ({ title: g.title, items: g.items, subtotal: g.items.reduce((s, i) => s + (i.total || 0), 0) })),
        snapshot,
      });
      setCurrentBudgetCode(entry.id);
      setLogEntries(getAllLogs());
      lastSavedHash.current = hash;
    }, 2000);

    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [groups, grandTotal, scenario, listaPrecios, proyecto, panelInfo, techo, pared, camara, flete, overrides, excludedItems, categoriasActivas]);

  // ── Manual save ──
  const handleManualSave = useCallback(() => {
    if (!groups.length) return;
    const productoStr = panelInfo.espesor ? `${panelInfo.label} ${panelInfo.espesor}mm` : panelInfo.label;
    const snapshot = { scenario, listaPrecios, proyecto, techo, pared, camara, flete, overrides, excludedItems, categoriasActivas };
    const entry = saveBudget({
      cliente: proyecto.nombre,
      producto: productoStr,
      escenario: scenarioLabels.current[scenario] || scenario,
      listaPrecios,
      total: grandTotal.totalFinal,
      groups: groups.map(g => ({ title: g.title, items: g.items, subtotal: g.items.reduce((s, i) => s + (i.total || 0), 0) })),
      snapshot,
    });
    setCurrentBudgetCode(entry.id);
    setLogEntries(getAllLogs());
    lastSavedHash.current = `${scenario}|${productoStr}|${proyecto.nombre}|${grandTotal.totalFinal.toFixed(2)}`;
    showToast(`Guardado ${entry.id}`);
  }, [groups, grandTotal, scenario, listaPrecios, proyecto, panelInfo, techo, pared, camara, flete, overrides, excludedItems, categoriasActivas, showToast]);

  // ── Restore a saved budget ──
  const handleRestoreBudget = useCallback((entry) => {
    if (!entry.snapshot) return;
    const s = entry.snapshot;
    setScenario(s.scenario || "solo_techo");
    setLP(s.listaPrecios || "web");
    if (s.proyecto) setProyecto(s.proyecto);
    if (s.techo) setTecho(s.techo);
    if (s.pared) setPared(s.pared);
    if (s.camara) setCamara(s.camara);
    setFlete(s.flete ?? 280);
    setOverrides(s.overrides || {});
    setExcludedItems(s.excludedItems || {});
    if (s.categoriasActivas) setCategoriasActivas(s.categoriasActivas);
    setCurrentBudgetCode(entry.id);
    setShowLogPanel(false);
    showToast(`Restaurado ${entry.id}`);
  }, [showToast]);

  // ── Delete log entry ──
  const handleDeleteLog = useCallback((id) => {
    deleteBudget(id);
    setLogEntries(getAllLogs());
  }, []);

  // ── Clear all logs ──
  const handleClearLogs = useCallback(() => {
    clearAllLogs();
    setLogEntries([]);
    setCurrentBudgetCode(null);
  }, []);

  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: "100vh" }}>
      {/* HEADER */}
      <div style={{ background: C.brand, color: "#fff", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px" }}>BMC Uruguay</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>· Panelin v3.0</div>
          {currentBudgetCode && (
            <div style={{ fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,0.15)", padding: "3px 10px", borderRadius: 6, letterSpacing: "0.04em", ...TN }}>{currentBudgetCode}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setShowLogPanel(true)} style={{ position: "relative", padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <Archive size={14} />Presupuestos
            {logEntries.length > 0 && (
              <span style={{ position: "absolute", top: -6, right: -6, background: C.primary, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 10, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", ...TN }}>{logEntries.length}</span>
            )}
          </button>
          {groups.length > 0 && (
            <button onClick={handleManualSave} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Save size={14} />Guardar</button>
          )}
          <button onClick={handleReset} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Trash2 size={14} />Limpiar</button>
          <button onClick={handlePrint} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: C.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Printer size={14} />Imprimir</button>
        </div>
      </div>


      <div className="bmc-main-grid" style={{
        display: "grid",
        gridTemplateColumns: "minmax(360px, 520px) 1fr",
        gap: 24,
        padding: 24,
        maxWidth: 1400,
        margin: "0 auto",
        height: "calc(100vh - 100px)",
        overflow: "hidden",
      }}>
        {/* LEFT PANEL — All sections in scrollable view */}
        <div className="bmc-left-panel" style={{ overflowY: "auto", paddingRight: 8 }}>
          {/* Lista precios + Escenario */}
          <div style={sectionS}>
            <div style={labelS}>LISTA DE PRECIOS</div>
            <SegmentedControl value={listaPrecios} onChange={v => setLP(v)} options={[{ id: "venta", label: "Precio BMC" }, { id: "web", label: "Precio Web" }]} />
            <div style={{ marginTop: 16 }}>
              <div style={labelS}>ESCENARIO DE OBRA</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {SCENARIOS_DEF.map(sc => {
                  const isS = scenario === sc.id;
                  return <div key={sc.id} onClick={() => { setScenario(sc.id); setTimeout(() => scrollToSection("panel"), 100); }} style={{ borderRadius: 16, padding: 16, cursor: "pointer", border: `2px solid ${isS ? C.primary : C.border}`, background: isS ? C.primarySoft : C.surface, transition: TR, boxShadow: isS ? `0 0 0 4px ${C.primarySoft}` : SHC }}>
                    <span style={{ fontSize: 28, display: "block", marginBottom: 6 }}>{sc.icon}</span>
                    <div style={{ fontSize: 14, fontWeight: 600, color: isS ? C.primary : C.tp, marginBottom: 2 }}>{sc.label}</div>
                    <div style={{ fontSize: 11, color: C.ts, lineHeight: 1.4 }}>{sc.description}</div>
                  </div>;
                })}
              </div>
            </div>
            {scenarioDef?.hasTecho && <div style={{ marginTop: 16 }}>
              <div style={labelS}>CAÍDAS DEL TECHO</div>
              <TipoAguasSelector value={techo.tipoAguas} onChange={v => {
                if (v === "dos_aguas") {
                  setTecho(t => ({ ...t, tipoAguas: v, borders: { ...t.borders, fondo: "cumbrera" } }));
                } else {
                  setTecho(t => ({ ...t, tipoAguas: v, borders: { ...t.borders, fondo: t.borders.fondo === "cumbrera" ? "gotero_lateral" : t.borders.fondo } }));
                }
              }} />
            </div>}
          </div>

          {/* Datos proyecto (colapsable) */}
          <details style={{ ...sectionS, padding: 0 }}>
            <summary style={{ padding: "16px 20px", cursor: "pointer", fontWeight: 600, fontSize: 12, color: C.ts, textTransform: "uppercase", letterSpacing: "0.06em", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              DATOS DEL PROYECTO {proyecto.nombre && <span style={{ fontSize: 11, fontWeight: 400, color: C.tp }}>· {proyecto.nombre}</span>}
            </summary>
            <div style={{ padding: "0 20px 20px" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <SegmentedControl value={proyecto.tipoCliente} onChange={v => uPr("tipoCliente", v)} options={[{ id: "empresa", label: "Empresa" }, { id: "persona", label: "Persona" }]} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><div style={labelS}>Nombre</div><input style={inputS} value={proyecto.nombre} onChange={e => uPr("nombre", e.target.value)} /></div>
                {proyecto.tipoCliente === "empresa" && <div><div style={labelS}>RUT</div><input style={inputS} value={proyecto.rut} onChange={e => uPr("rut", e.target.value)} /></div>}
                <div><div style={labelS}>Teléfono</div><input style={inputS} value={proyecto.telefono} onChange={e => uPr("telefono", e.target.value)} /></div>
                <div><div style={labelS}>Dirección</div><input style={inputS} value={proyecto.direccion} onChange={e => uPr("direccion", e.target.value)} /></div>
                <div style={{ gridColumn: "1/-1" }}>
                  <div style={labelS}>Descripción obra</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                    {OBRA_PRESETS.slice(0, 6).map(pr => <button key={pr} onClick={() => uPr("descripcion", pr)} style={{ padding: "3px 10px", borderRadius: 20, border: `1px solid ${proyecto.descripcion === pr ? C.primary : C.border}`, background: proyecto.descripcion === pr ? C.primarySoft : C.surface, fontSize: 11, cursor: "pointer", color: C.tp }}>{pr}</button>)}
                  </div>
                  <input style={inputS} value={proyecto.descripcion} onChange={e => uPr("descripcion", e.target.value)} placeholder="Descripción libre..." />
                </div>
                <div><div style={labelS}>Ref. interna</div><input style={inputS} value={proyecto.refInterna} onChange={e => uPr("refInterna", e.target.value)} /></div>
                <div><div style={labelS}>Fecha</div><input style={inputS} value={proyecto.fecha} onChange={e => uPr("fecha", e.target.value)} /></div>
              </div>
            </div>
          </details>

          {/* Panel selector — TECHO */}
          {scenarioDef?.hasTecho && <div ref={panelRef} style={sectionS}>
            <div style={{ ...labelS, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>🏠</span> PANEL TECHO
            </div>
            <CustomSelect label="Familia" value={techo.familia} options={techoFamilyOptions} onChange={setTechoFamilia} />
            <div style={{ marginTop: 12 }}>
              <CustomSelect label="Espesor" value={techo.espesor} options={techoEspesorOptions} onChange={v => uT("espesor", v)} showBadge />
            </div>
            {techoPanelData && <div style={{ marginTop: 12 }}>
              <div style={labelS}>Color</div>
              <ColorChips colors={techoPanelData.col} value={techo.color} onChange={c => uT("color", c)} notes={techoPanelData.colNotes || {}} />
            </div>}
          </div>}

          {/* Panel selector — PARED */}
          {scenarioDef?.hasPared && <div ref={!scenarioDef?.hasTecho ? panelRef : null} style={sectionS}>
            <div style={{ ...labelS, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>🏢</span> PANEL PARED
            </div>
            <CustomSelect label="Familia" value={pared.familia} options={paredFamilyOptions} onChange={setParedFamilia} />
            <div style={{ marginTop: 12 }}>
              <CustomSelect label="Espesor" value={pared.espesor} options={paredEspesorOptions} onChange={v => uP("espesor", v)} showBadge />
            </div>
            {paredPanelData && <div style={{ marginTop: 12 }}>
              <div style={labelS}>Color</div>
              <ColorChips colors={paredPanelData.col} value={pared.color} onChange={c => uP("color", c)} notes={paredPanelData.colNotes || {}} />
            </div>}
          </div>}

          {/* Dimensiones Techo — Zonas múltiples */}
          {vis.largoAncho && (() => {
            const fp = calcFactorPendiente(techo.pendiente);
            const is2A = techo.tipoAguas === "dos_aguas";
            const baseArea = is2A ? zonasTotales.area : zonasTotales.area;
            const areaReal = techo.pendiente > 0 ? +(baseArea * fp).toFixed(1) : null;
            return <div ref={dimensionesRef} style={sectionS}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={labelS}>DIMENSIONES TECHO {is2A && <span style={{ fontWeight: 400, textTransform: "none" }}>· 2 faldones</span>}</div>
              <div style={{ fontSize: 12, color: C.ts, fontWeight: 500, ...TN }}>
                {areaReal
                  ? <>{baseArea}m² proy. <span style={{ color: C.primary, fontWeight: 600 }}>→ {areaReal}m² real</span></>
                  : <>{baseArea}m² total</>
                }
              </div>
            </div>
            {techo.zonas.map((zona, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 10, padding: 12, borderRadius: 10, background: C.surfaceAlt }}>
                <div style={{ flex: 1 }}>
                  <StepperInput label={`Largo ${techo.zonas.length > 1 ? idx + 1 : ""} (m)`} value={zona.largo} onChange={v => updateZona(idx, "largo", v)} min={1} max={20} step={0.5} unit="m" />
                </div>
                <div style={{ flex: 1 }}>
                  <StepperInput label={`Ancho ${techo.zonas.length > 1 ? idx + 1 : ""} (m)`} value={zona.ancho} onChange={v => updateZona(idx, "ancho", v)} min={1} max={20} step={0.5} unit="m" />
                </div>
                <div style={{ fontSize: 11, color: C.ts, minWidth: 50, textAlign: "right", paddingBottom: 8 }}>
                  {(zona.largo * zona.ancho).toFixed(1)}m²
                </div>
                {techo.zonas.length > 1 && (
                  <button onClick={() => removeZona(idx)} style={{ padding: 6, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: C.danger, marginBottom: 4 }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button onClick={addZona} style={{ width: "100%", padding: "10px 16px", borderRadius: 10, border: `1.5px dashed ${C.border}`, background: C.surface, fontSize: 13, cursor: "pointer", color: C.primary, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Plus size={14} /> Agregar zona
            </button>

            {/* Pendiente de techo */}
            <div style={{ marginTop: 16, padding: 12, background: C.surfaceAlt, borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
                <StepperInput label="Pendiente" value={techo.pendiente} onChange={v => uT("pendiente", v)} min={0} max={45} step={1} unit="°" decimals={0} />
                <div style={{ flex: 1, paddingBottom: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>PRESETS</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {PENDIENTES_PRESET.map(pr => (
                      <button key={pr.valor} onClick={() => uT("pendiente", pr.valor)} title={pr.descripcion} style={{
                        padding: "4px 10px", borderRadius: 20,
                        border: `1.5px solid ${techo.pendiente === pr.valor ? C.primary : C.border}`,
                        background: techo.pendiente === pr.valor ? C.primarySoft : C.surface,
                        fontSize: 11, fontWeight: techo.pendiente === pr.valor ? 600 : 400,
                        cursor: "pointer", color: techo.pendiente === pr.valor ? C.primary : C.ts,
                        transition: TR,
                      }}>
                        {pr.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {techo.pendiente > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: C.ts, display: "flex", gap: 16, flexWrap: "wrap", ...TN }}>
                  <span>Factor: <b style={{ color: C.tp }}>×{fp.toFixed(4)}</b></span>
                  <span>Incremento: <b style={{ color: C.primary }}>+{((fp - 1) * 100).toFixed(1)}%</b></span>
                  {techo.zonas[0] && (
                    <span>Largo real: <b style={{ color: C.tp }}>{(techo.zonas[0].largo * fp).toFixed(2)}m</b> (de {techo.zonas[0].largo}m proy.)</span>
                  )}
                </div>
              )}
            </div>

            {techoPanelData && techo.zonas.some(z => {
              const lr = +(z.largo * fp).toFixed(3);
              return lr < techoPanelData.lmin || lr > techoPanelData.lmax;
            }) && (
              <div style={{ marginTop: 8 }}>
                <AlertBanner
                  type="warning"
                  message={techo.pendiente > 0
                    ? `Algún largo real (con pendiente ${techo.pendiente}°) está fuera del rango fabricable (${techoPanelData.lmin}m - ${techoPanelData.lmax}m)`
                    : `Algún largo está fuera del rango fabricable (${techoPanelData.lmin}m - ${techoPanelData.lmax}m)`}
                />
              </div>
            )}
          </div>;
          })()}

          {/* Dimensiones Pared */}
          {vis.altoPerim && <div ref={!vis.largoAncho ? dimensionesRef : null} style={sectionS}>
            <div style={labelS}>DIMENSIONES PARED</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <StepperInput label="Alto (m)" value={pared.alto} onChange={v => uP("alto", v)} min={1} max={14} step={0.5} unit="m" />
              <StepperInput label="Perímetro (m)" value={pared.perimetro} onChange={v => uP("perimetro", v)} min={4} max={500} step={1} unit="m" />
            </div>
            {vis.esquineros && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <StepperInput label="Esquinas ext." value={pared.numEsqExt} onChange={v => uP("numEsqExt", v)} min={0} max={20} step={1} decimals={0} />
              <StepperInput label="Esquinas int." value={pared.numEsqInt} onChange={v => uP("numEsqInt", v)} min={0} max={20} step={1} decimals={0} />
            </div>}
          </div>}

          {/* Cámara frigorífica */}
          {vis.camara && <div style={sectionS}>
            <div style={labelS}>DIMENSIONES CÁMARA (internas)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <StepperInput label="Largo (m)" value={camara.largo_int} onChange={v => setCamara(c => ({ ...c, largo_int: v }))} min={1} max={30} step={0.5} unit="m" />
              <StepperInput label="Ancho (m)" value={camara.ancho_int} onChange={v => setCamara(c => ({ ...c, ancho_int: v }))} min={1} max={30} step={0.5} unit="m" />
              <StepperInput label="Alto (m)" value={camara.alto_int} onChange={v => setCamara(c => ({ ...c, alto_int: v }))} min={1} max={14} step={0.5} unit="m" />
            </div>
          </div>}

          {/* Bordes techo */}
          {vis.borders && <div ref={bordesRef} style={sectionS}>
            <div style={labelS}>BORDES Y PERFILERÍA</div>
            {techo.tipoAguas === "dos_aguas" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.primarySoft, borderRadius: 10, marginBottom: 12, fontSize: 12, color: C.primary, fontWeight: 500 }}>
                <span style={{ fontSize: 16 }}>⌃</span> 2 Aguas — cumbrera incluida automáticamente. Configurá los bordes exteriores de cada faldón.
              </div>
            )}
            <RoofBorderSelector
              borders={techo.borders}
              onChange={(side, val) => setTecho(t => ({ ...t, borders: { ...t.borders, [side]: val } }))}
              panelFamilia={techo.familia}
              disabledSides={techo.tipoAguas === "dos_aguas" ? ["fondo"] : []}
            />
          </div>}

          {/* Estructura */}
          <div style={sectionS}>
            <div style={labelS}>ESTRUCTURA</div>
            <SegmentedControl value={scenarioDef?.hasTecho && !scenarioDef?.hasPared ? techo.tipoEst : pared.tipoEst} onChange={v => { uT("tipoEst", v); uP("tipoEst", v); }} options={[{ id: "metal", label: "Metal" }, { id: "hormigon", label: "Hormigón" }, { id: "mixto", label: "Mixto" }, { id: "madera", label: "Madera" }]} />
          </div>

          {/* Opciones */}
          <div ref={opcionesRef} style={sectionS}>
            <div style={labelS}>OPCIONES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {vis.canalGot && <Toggle label="Gotero superior" value={techo.opciones.inclGotSup} onChange={v => setTecho(t => ({ ...t, opciones: { ...t.opciones, inclGotSup: v } }))} />}
              <Toggle label="Selladores" value={scenarioDef?.hasTecho && !scenarioDef?.hasPared ? techo.opciones.inclSell : pared.inclSell} onChange={v => { setTecho(t => ({ ...t, opciones: { ...t.opciones, inclSell: v } })); uP("inclSell", v); }} />
              {vis.p5852 && <Toggle label="Perfil 5852 aluminio" value={pared.incl5852} onChange={v => uP("incl5852", v)} />}
              <div style={{ marginTop: 8 }}>
                <StepperInput label="Flete (USD s/IVA)" value={flete} onChange={setFlete} min={0} max={2000} step={10} unit="USD" decimals={0} />
              </div>
            </div>
          </div>

          {/* Categorías BOM */}
          <div style={sectionS}>
            <div style={labelS}>CATEGORÍAS A INCLUIR</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.entries(CATEGORIAS_BOM).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setCategoriasActivas(prev => ({ ...prev, [key]: !prev[key] }))}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    border: `1.5px solid ${categoriasActivas[key] ? C.primary : C.border}`,
                    background: categoriasActivas[key] ? C.primarySoft : C.surface,
                    fontSize: 12,
                    fontWeight: categoriasActivas[key] ? 600 : 400,
                    color: categoriasActivas[key] ? C.primary : C.ts,
                    cursor: "pointer",
                    transition: TR,
                  }}
                >
                  {categoriasActivas[key] ? "✓ " : ""}{cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Aberturas */}
          {vis.aberturas && <div style={sectionS}>
            <div style={labelS}>ABERTURAS</div>
            {pared.aberturas.map((ab, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, padding: 8, borderRadius: 8, background: C.surfaceAlt }}>
                <SegmentedControl value={ab.tipo} onChange={v => { const next = [...pared.aberturas]; next[i] = { ...next[i], tipo: v }; uP("aberturas", next); }} options={[{ id: "puerta", label: "Puerta" }, { id: "ventana", label: "Ventana" }]} />
                <input type="number" placeholder="Ancho" value={ab.ancho} onChange={e => { const next = [...pared.aberturas]; next[i] = { ...next[i], ancho: parseFloat(e.target.value) || 0 }; uP("aberturas", next); }} style={{ ...inputS, width: 70, padding: "6px 8px" }} />
                <span style={{ color: C.ts, fontSize: 13 }}>×</span>
                <input type="number" placeholder="Alto" value={ab.alto} onChange={e => { const next = [...pared.aberturas]; next[i] = { ...next[i], alto: parseFloat(e.target.value) || 0 }; uP("aberturas", next); }} style={{ ...inputS, width: 70, padding: "6px 8px" }} />
                <input type="number" placeholder="Cant" value={ab.cant} onChange={e => { const next = [...pared.aberturas]; next[i] = { ...next[i], cant: parseInt(e.target.value) || 1 }; uP("aberturas", next); }} style={{ ...inputS, width: 50, padding: "6px 8px" }} />
                <button onClick={() => { const next = pared.aberturas.filter((_, j) => j !== i); uP("aberturas", next); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.danger }}><Trash2 size={14} /></button>
              </div>
            ))}
            <button onClick={() => uP("aberturas", [...pared.aberturas, { tipo: "puerta", ancho: 0.9, alto: 2.1, cant: 1 }])} style={{ padding: "8px 16px", borderRadius: 10, border: `1.5px dashed ${C.border}`, background: C.surface, fontSize: 13, cursor: "pointer", color: C.primary, fontWeight: 500 }}>+ Agregar abertura</button>
          </div>}
        </div>

        {/* RIGHT PANEL */}
        <div className="bmc-right-panel" style={{ overflowY: "auto", paddingLeft: 8 }}>
          {/* KPI Row */}
          {results && !results.error && <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
            <KPICard label="Área" value={`${kpiArea.toFixed(1)}m²`} borderColor={C.primary} />
            <KPICard label="Paneles" value={kpiPaneles} borderColor={C.success} />
            <KPICard label={vis.autoportancia ? "Apoyos" : "Esquinas"} value={kpiApoyos || "—"} borderColor={C.warning} />
            <KPICard label="Pts fijación" value={kpiFij || "—"} borderColor={C.brand} />
          </div>}

          {/* Descarte informativo */}
          {results?.paneles?.descarte && results.paneles.descarte.anchoM > 0 && (
            <div style={{ marginBottom: 16 }}>
              <AlertBanner
                type="warning"
                message={`Descarte: ${results.paneles.descarte.anchoM}m de ancho × ${zonasTotales.largo}m = ${results.paneles.descarte.areaM2}m² (${results.paneles.descarte.porcentaje}% del ancho solicitado)`}
              />
            </div>
          )}

          {/* Warnings */}
          {results?.warnings?.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {results.warnings.map((w, i) => <AlertBanner key={i} type={w.includes("excede") || w.includes("EXCEDE") || w.includes("solo") ? "danger" : "warning"} message={w} />)}
          </div>}

          {/* Autoportancia */}
          {vis.autoportancia && results?.autoportancia && <div style={{ marginBottom: 16 }}>
            <AlertBanner type={results.autoportancia.ok ? "success" : "danger"} message={results.autoportancia.ok ? `Autoportante ✓ · Vano máx: ${results.autoportancia.maxSpan}m · ${results.autoportancia.apoyos} apoyos` : `Largo excede autoportancia (${results.autoportancia.maxSpan}m). Requiere ${results.autoportancia.apoyos} apoyos intermedios.`} />
          </div>}

          {/* No data message */}
          {!results && <div style={{ ...sectionS, textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📐</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.tp, marginBottom: 4 }}>Seleccioná un panel y espesor</div>
            <div style={{ fontSize: 13, color: C.ts }}>Los resultados aparecerán aquí</div>
          </div>}

          {results?.error && <AlertBanner type="danger" message={results.error} />}

          {/* BOM Table */}
          {groups.length > 0 && <div style={{ marginBottom: 16 }}>
            {groups.map((g, gi) => <TableGroup key={gi} title={g.title} items={g.items} subtotal={g.items.reduce((s, i) => s + (i.total || 0), 0)} collapsed={!!collapsedGroups[g.title]} onToggle={() => setCollapsedGroups(cg => ({ ...cg, [g.title]: !cg[g.title] }))} onOverride={handleOverride} onRevert={handleRevert} onExclude={handleExclude} />)}
          </div>}
          {results && !results.error && groups.length === 0 && (
            <AlertBanner type="warning" message="Todas las categorías están desactivadas. Activá al menos una para ver el presupuesto." />
          )}

          {/* Excluded items panel */}
          {Object.keys(excludedItems).length > 0 && (
            <div style={{ ...sectionS, background: C.dangerSoft, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.danger, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Items excluidos ({Object.keys(excludedItems).length})
                </div>
                <button onClick={handleRestoreAll} style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${C.danger}`, background: C.surface, fontSize: 11, fontWeight: 500, color: C.danger, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <RefreshCw size={12} />Restaurar todos
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(excludedItems).map(([lineId, label]) => (
                  <div key={lineId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: C.surface, borderRadius: 8, fontSize: 12 }}>
                    <span style={{ color: C.ts }}>{label}</span>
                    <button onClick={() => handleRestore(lineId)} style={{ padding: "2px 8px", borderRadius: 6, border: "none", background: C.primary, color: "#fff", fontSize: 10, fontWeight: 500, cursor: "pointer" }}>Restaurar</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals */}
          {groups.length > 0 && <div style={{ background: C.dark, borderRadius: 16, padding: 24, color: "#fff", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 14, opacity: 0.7 }}>Subtotal s/IVA</span>
              <span style={{ fontSize: 16, fontWeight: 600, ...TN }}>USD {fmtPrice(grandTotal.subtotalSinIVA)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 14, opacity: 0.7 }}>IVA 22%</span>
              <span style={{ fontSize: 16, fontWeight: 600, ...TN }}>USD {fmtPrice(grandTotal.iva)}</span>
            </div>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 12, marginTop: 8, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 20, fontWeight: 800 }}>TOTAL</span>
              <span style={{ fontSize: 28, fontWeight: 800, ...TN }}>USD {fmtPrice(grandTotal.totalFinal)}</span>
            </div>
          </div>}

          {/* Condiciones */}
          {groups.length > 0 && <div style={{ ...sectionS, fontSize: 12, color: C.ts, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: C.tp }}>Condiciones comerciales:</div>
            <div>Entrega: 10 a 15 días hábiles. Seña: 60%, saldo contra entrega. Validez: 10 días. Precios en USD.</div>
            <div style={{ marginTop: 12, fontWeight: 700, color: C.tp }}>Datos bancarios:</div>
            <div>Metalog SAS · RUT: 120403630012 · BROU Cta. Dólares: 110520638-00002</div>
          </div>}

          {/* Action buttons — desktop only */}
          {groups.length > 0 && <div className="bmc-desktop-actions" style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <button onClick={handleCopyWA} style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: "none", background: "#25D366", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Copy size={16} />WhatsApp</button>
            <button onClick={handlePrint} style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: "none", background: C.primary, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><FileText size={16} />PDF</button>
            <button onClick={handleInternalReport} style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: `1.5px solid ${C.brand}`, background: C.surface, color: C.brand, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><ClipboardList size={16} />Interno</button>
          </div>}

          {/* Transparency Panel */}
          {results && !results.error && <div style={{ ...sectionS, padding: 0, overflow: "hidden" }}>
            <div onClick={() => setShowTransp(!showTransp)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", cursor: "pointer", background: C.surfaceAlt }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 13, color: C.ts }}><Info size={14} />Transparencia — valores y reglas</div>
              {showTransp ? <ChevronUp size={16} color={C.ts} /> : <ChevronDown size={16} color={C.ts} />}
            </div>
            {showTransp && <div style={{ padding: 20, fontSize: 12, color: C.ts, lineHeight: 1.8, fontFamily: "monospace" }}>
              <div>LISTA_ACTIVA: {listaPrecios}</div>
              <div>Escenario: {scenario}</div>
              {scenarioDef?.hasTecho && results.paneles && <>
                <div style={{ fontWeight: 600, marginTop: 8, color: C.tp }}>— TECHO —</div>
                <div>Paneles: {results.paneles.cantPaneles} × AU={techoPanelData?.au}m = {results.paneles.anchoTotal || "—"}m</div>
                <div>Área: {results.paneles.areaTotal || results.paneles.areaNeta} m²</div>
                <div>Precio/m²: ${results.paneles.precioM2} (SIN IVA)</div>
              </>}
              {results.paredResult?.paneles && <>
                <div style={{ fontWeight: 600, marginTop: 8, color: C.tp }}>— PARED —</div>
                <div>Paneles: {results.paredResult.paneles.cantPaneles} × AU={paredPanelData?.au}m</div>
                <div>Área neta: {results.paredResult.paneles.areaNeta} m²</div>
                <div>Precio/m²: ${results.paredResult.paneles.precioM2} (SIN IVA)</div>
              </>}
              {results.techoResult?.paneles && <>
                <div style={{ fontWeight: 600, marginTop: 8, color: C.tp }}>— TECHO (cámara) —</div>
                <div>Área: {results.techoResult.paneles.areaTotal} m²</div>
              </>}
              {(results.autoportancia?.maxSpan || results.techoResult?.autoportancia?.maxSpan) && <div>Autoportancia: {(results.autoportancia ?? results.techoResult?.autoportancia)?.ok ? "OK" : "EXCEDE"} · max={(results.autoportancia ?? results.techoResult?.autoportancia)?.maxSpan}m</div>}
              <div style={{ marginTop: 8, fontWeight: 700 }}>Todos los precios en USD SIN IVA. IVA 22% aplicado al total.</div>
            </div>}
          </div>}
        </div>
      </div>

      <Toast message={toast} visible={!!toast} />

      {/* Mobile bottom bar with sticky total */}
      {groups.length > 0 && (
        <MobileBottomBar
          total={grandTotal.totalFinal}
          onPrint={handlePrint}
          onWhatsApp={handleCopyWA}
        />
      )}

      {/* ── Budget Log Panel (slide-over drawer) ── */}
      {showLogPanel && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", justifyContent: "flex-end" }}>
          <div onClick={() => setShowLogPanel(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", width: "100%", maxWidth: 480, background: C.bg, boxShadow: "-4px 0 30px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", animation: "bmc-fade 150ms ease-in-out", overflowY: "auto" }}>
            {/* Drawer header */}
            <div style={{ padding: "20px 24px", background: C.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>Presupuestos guardados</div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{logEntries.length} registros</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {logEntries.length > 0 && (
                  <button onClick={() => exportLogsAsJSON()} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Download size={12} />JSON</button>
                )}
                {logEntries.length > 0 && (
                  <button onClick={handleClearLogs} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid rgba(255,100,100,0.5)", background: "transparent", color: "#ffaaaa", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Trash2 size={12} />Borrar todo</button>
                )}
                <button onClick={() => setShowLogPanel(false)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 4 }}><X size={20} /></button>
              </div>
            </div>

            {/* Log entries list */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {logEntries.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: C.ts }}>
                  <Archive size={40} color={C.border} style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.tp, marginBottom: 4 }}>Sin presupuestos guardados</div>
                  <div style={{ fontSize: 12 }}>Se guardan automáticamente al calcular</div>
                </div>
              )}
              {logEntries.map((entry) => (
                <div key={entry.id} style={{ background: C.surface, borderRadius: 12, padding: 16, marginBottom: 10, boxShadow: SHC, borderLeft: `4px solid ${entry.id === currentBudgetCode ? C.primary : C.border}` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.brand, ...TN, marginBottom: 2 }}>{entry.id}</div>
                      <div style={{ fontSize: 11, color: C.ts }}>{entry.fecha}</div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.tp, ...TN }}>
                      ${fmtPrice(entry.total)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    {entry.cliente && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: C.primarySoft, color: C.primary, fontWeight: 500 }}>{entry.cliente}</span>}
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: C.brandLight, color: C.brand, fontWeight: 500 }}>{entry.escenario}</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: C.surfaceAlt, color: C.ts }}>{entry.producto}</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: C.surfaceAlt, color: C.tt }}>{entry.listaPrecios === "venta" ? "BMC" : "Web"}</span>
                  </div>
                  <div style={{ fontSize: 10, color: C.tt, marginBottom: 10, fontFamily: "monospace", wordBreak: "break-all" }}>{entry.nombre}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {entry.snapshot && (
                      <button onClick={() => handleRestoreBudget(entry)} style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "none", background: C.primary, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><RotateCcw size={12} />Restaurar</button>
                    )}
                    <button onClick={() => exportSingleBudget(entry)} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.ts, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Download size={12} /></button>
                    <button onClick={() => handleDeleteLog(entry.id)} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.dangerSoft}`, background: C.surface, color: C.danger, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
