// ═══════════════════════════════════════════════════════════════════════════
// src/components/PanelinCalculadoraV3.jsx — React UI component
// BMC Uruguay · Calculadora de Cotización v3.0
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown, ChevronUp, Printer, Trash2, Copy, Check,
  AlertTriangle, CheckCircle, Info, Minus, Plus, FileText,
  RotateCcw, Edit3, X, RefreshCw, ClipboardList,
  Download, Save, Archive, Cloud, Settings,
  Table, LayoutTemplate, CircleDollarSign
} from "lucide-react";

import {
  C, FONT, SHC, SHI, TR, TN, COLOR_HEX,
  setListaPrecios,
  PANELS_TECHO, PANELS_PARED, SERVICIOS,
  FIJACIONES, HERRAMIENTAS, SELLADORES,
  PERFIL_TECHO, PERFIL_PARED,
  SCENARIOS_DEF, VIS, OBRA_PRESETS, BORDER_OPTIONS,
  CATEGORIAS_BOM, CATEGORIA_TO_GROUPS,
  PENDIENTES_PRESET, TIPO_AGUAS,
} from "../data/constants.js";
import { getPricing } from "../data/pricing.js";
import { flattenPerfilesLibre, computePresupuestoLibreCatalogo } from "../utils/presupuestoLibreCatalogo.js";
import {
  calcTechoCompleto, calcParedCompleto, calcTotalesSinIVA,
  calcFactorPendiente, calcLargoRealFromModo, mergeZonaResults, normalizarMedida,
} from "../utils/calculations.js";
import {
  applyOverrides, bomToGroups,
  fmtPrice, generatePrintHTML, generateInternalHTML, buildWhatsAppText,
  createPreviewUrl, revokePreviewUrl,
} from "../utils/helpers.js";
import {
  saveBudget, getAllLogs, deleteBudget, clearAllLogs,
  exportLogsAsJSON, exportSingleBudget,
} from "../utils/budgetLog.js";
import { serializeProject, deserializeProject, pdfFileName } from "../utils/projectFile.js";
import { htmlToPdfBlob, downloadPdf } from "../utils/pdfGenerator.js";
import { buildCostingReport } from "../utils/bomCosting.js";
import { capturePdfSnapshotTargets } from "../utils/captureDomToPng.js";
import {
  generateClientVisualHTML, generateCosteoHTML, openPrintWindow,
  buildPdfAppendixPayload,
} from "../utils/quotationViews.js";
import { buildGoogleSheetReportTsv } from "../utils/sheetExport.js";
import {
  initGoogleAuth, signIn as gdriveSignIn, signOut as gdriveSignOut,
  isAuthenticated as gdriveIsAuth, setAuthChangeCallback,
  saveQuotation, listQuotations, loadProjectFromFolder, deleteQuotation,
} from "../utils/googleDrive.js";
import GoogleDrivePanel from "./GoogleDrivePanel.jsx";
import InteractionLogPanel from "./InteractionLogPanel.jsx";
import ConfigPanel from "./ConfigPanel.jsx";
import FloorPlanEditor from "./FloorPlanEditor.jsx";
import RoofPreview from "./RoofPreview.jsx";
import { wrapSetter } from "../utils/interactionLogger.js";
import { getListaDefault, getFleteDefault } from "../utils/calculatorConfig.js";
import { getCalcApiBase } from "../utils/calcApiBase.js";

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
      .bmc-left-panel, .bmc-right-panel { overflow: visible !important; padding: 0 16px !important; }
      .bmc-mobile-bar { display: flex !important; }
      .bmc-desktop-actions { display: none !important; }
    }
    @media (min-width: 901px) {
      .bmc-mobile-bar { display: none !important; }
    }
  `;
  document.head.appendChild(s);
}

/**
 * Botón principal del footer del wizard (p. ej. **Siguiente**): alto contraste cuando está deshabilitado.
 * Al añadir otro wizard (techo+fachada, cámara, etc.), reutilizar este mismo estilo para consistencia.
 * @param {boolean} enabled — paso válido / puede avanzar
 */
function wizardPrimaryActionStyle(enabled) {
  return {
    padding: "12px 28px",
    borderRadius: 12,
    border: enabled ? "none" : `1.5px solid ${C.border}`,
    background: enabled ? C.primary : "#E8E8ED",
    color: enabled ? "#fff" : "#3A3A3C",
    fontSize: 15,
    fontWeight: 600,
    cursor: enabled ? "pointer" : "not-allowed",
    boxShadow: enabled ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
  };
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
  const btnS = (dis) => ({ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.surface, cursor: dis ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: dis ? 0.4 : 1, transition: TR, flexShrink: 0 });
  return (
    <div style={{ fontFamily: FONT }}>
      {label && <div style={{ fontSize: 12, fontWeight: 600, color: C.tp, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button style={btnS(value <= min)} onClick={() => bump(-1)}><Minus size={16} color={C.tp} /></button>
        <input type="number" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} onBlur={e => { const v = parseFloat(e.target.value); onChange(isNaN(v) ? min : Math.min(max, Math.max(min, v))); }}
          style={{ width: 88, textAlign: "center", borderRadius: 10, border: `1.5px solid ${C.border}`, padding: "8px 10px", fontSize: 15, fontWeight: 600, background: C.surface, color: C.tp, outline: "none", boxShadow: SHI, transition: TR, fontFamily: FONT, ...TN }} />
        <button style={btnS(value >= max)} onClick={() => bump(1)}><Plus size={16} color={C.tp} /></button>
        {unit && <span style={{ fontSize: 14, fontWeight: 600, color: C.tp, marginLeft: 4, minWidth: 24 }}>{unit}</span>}
      </div>
    </div>
  );
}

function SegmentedControl({ value, onChange, options = [], disabledIds = [] }) {
  return (
    <div style={{ display: "inline-flex", background: C.border, borderRadius: 12, padding: 4, gap: 4, fontFamily: FONT, width: "100%" }}>
      {options.map(opt => {
        const isD = disabledIds.includes(opt.id), isA = value === opt.id;
        return <button key={opt.id} onClick={() => !isD && onChange(opt.id)} style={{ flex: 1, padding: "10px 16px", borderRadius: 10, border: "none", cursor: isD ? "not-allowed" : "pointer", background: isA ? C.surface : "transparent", boxShadow: isA ? "0 2px 6px rgba(0,0,0,0.1)" : "none", fontSize: 14, fontWeight: isA ? 600 : 500, color: isA ? C.tp : C.ts, opacity: isD ? 0.4 : 1, transition: TR, fontFamily: FONT, whiteSpace: "nowrap" }}>{opt.label}</button>;
      })}
    </div>
  );
}

function Toggle({ label, value, onChange, disabled = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: FONT, opacity: disabled ? 0.5 : 1 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: C.tp }}>{label}</span>
      <button type="button" disabled={disabled} onClick={() => !disabled && onChange(!value)} style={{ width: 40, height: 24, borderRadius: 12, border: "none", cursor: disabled ? "not-allowed" : "pointer", background: value ? C.primary : C.border, position: "relative", transition: TR, flexShrink: 0 }}>
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

function LibreAccordionBar({ title, open, onToggle, children }) {
  return (
    <div style={{ marginBottom: 12, borderRadius: 16, border: `1.5px solid ${C.border}`, overflow: "hidden", background: C.surface, boxShadow: SHC }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "14px 18px",
          border: "none",
          background: C.surfaceAlt,
          cursor: "pointer",
          fontFamily: FONT,
          transition: TR,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: C.ts, letterSpacing: "0.1em", textTransform: "uppercase" }}>{title}</span>
        {open ? <ChevronUp size={18} color={C.ts} strokeWidth={2.2} /> : <ChevronDown size={18} color={C.ts} strokeWidth={2.2} />}
      </button>
      {open && (
        <div style={{ padding: 18, borderTop: `1px solid ${C.border}`, background: C.surface }}>
          {children}
        </div>
      )}
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
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const cols = "2fr 0.55fr 0.5fr 0.65fr 0.65fr 0.65fr 0.5fr 0.65fr 72px";

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
    <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: SHC, fontFamily: FONT, marginBottom: 12, border: `1px solid ${C.border}` }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: C.brandLight, cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14, color: C.brand }}>{collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}{title}</div>
        <span style={{ fontWeight: 700, fontSize: 14, color: C.brand, ...TN }}>${typeof subtotal === "number" ? subtotal.toFixed(2) : subtotal}</span>
      </div>
      {!collapsed && <div>
        <div style={{ display: "grid", gridTemplateColumns: cols, background: C.brand, color: "#fff", padding: "10px 12px", boxShadow: "0 2px 4px rgba(0,0,0,0.06)" }}>
          {["Descripción", "Cant.", "Unid.", "P.Unit.", "Total", "Costo", "% Margen", "Ganancia", "Acciones"].map((h, i) => <div key={i} style={{ fontSize: 11, fontWeight: 700, padding: "2px 4px", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: i > 1 ? "right" : "left" }}>{h}</div>)}
        </div>
        {items.map((item, idx) => {
          const isEditing = editingCell && editingCell.lineId === item.lineId;
          const isHovered = hoveredIdx === idx;
          return <div key={idx} onMouseEnter={() => setHoveredIdx(idx)} onMouseLeave={() => setHoveredIdx(null)} style={{ display: "grid", gridTemplateColumns: cols, background: item.isOverridden ? C.warningSoft : isHovered ? C.surfaceAlt : idx % 2 === 0 ? C.surface : C.surfaceAlt, borderBottom: `1px solid ${C.border}`, alignItems: "center", transition: "background 120ms ease" }}>
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
            <div style={{ padding: "8px 12px", fontSize: 13, textAlign: "right", color: C.ts, ...TN }}>${((item.cant ?? 0) * (item.costo ?? 0)).toFixed(2)}</div>
            <div style={{ padding: "8px 12px", fontSize: 13, textAlign: "right", color: C.ts, ...TN }}>{(() => { const t = item.total || 0; const ct = (item.cant ?? 0) * (item.costo ?? 0); return t > 0 ? ((t - ct) / t * 100).toFixed(1) + "%" : "—"; })()}</div>
            <div style={{ padding: "8px 12px", fontSize: 13, textAlign: "right", fontWeight: 500, color: C.success, ...TN }}>${((item.total || 0) - (item.cant ?? 0) * (item.costo ?? 0)).toFixed(2)}</div>
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

function PDFPreviewModal({ html, title, onClose }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!html) return;
    const u = createPreviewUrl(html);
    setUrl(u);
    return () => revokePreviewUrl(u);
  }, [html]);

  useEffect(() => {
    if (!html) return;
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [html, onClose]);

  if (!html || !url) return null;

  const handlePrint = () => {
    const iframe = document.getElementById("bmc-pdf-preview-frame");
    if (iframe?.contentWindow) {
      iframe.contentWindow.print();
    }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", background: "rgba(0,0,0,0.6)", animation: "bmc-fade 150ms ease-in-out" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", background: C.dark, color: "#fff", flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{title || "Vista previa de cotización"}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handlePrint} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: C.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Printer size={14} />Imprimir / PDF
          </button>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <X size={14} />Cerrar
          </button>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: 20, overflow: "auto" }}>
        <iframe
          id="bmc-pdf-preview-frame"
          src={url}
          style={{
            width: "210mm",
            maxWidth: "100%",
            height: "100%",
            border: "none",
            borderRadius: 8,
            boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
            background: "#fff",
          }}
          title="Vista previa PDF"
        />
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
      {TIPO_AGUAS.map(tipo => {
        const isS = value === tipo.id;
        const isDisabled = !tipo.enabled;
        const SvgComp = AGUA_SVGS[tipo.id];
        return (
          <button
            key={tipo.id}
            onClick={() => !isDisabled && onChange(tipo.id)}
            disabled={isDisabled}
            style={{
              flex: 1, padding: "12px 8px", borderRadius: 14, textAlign: "center",
              border: `2px solid ${isDisabled ? C.border : isS ? C.primary : C.border}`,
              background: isDisabled ? C.surfaceAlt : isS ? C.primarySoft : C.surface,
              cursor: isDisabled ? "not-allowed" : "pointer",
              opacity: isDisabled ? 0.7 : 1,
              transition: TR,
              boxShadow: isS && !isDisabled ? `0 0 0 3px ${C.primarySoft}` : "none",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            }}
          >
            {SvgComp && <SvgComp color={isDisabled ? C.tt : isS ? C.primary : C.ts} />}
            <div style={{ fontSize: 13, fontWeight: 600, color: isDisabled ? C.tt : isS ? C.primary : C.tp }}>{tipo.label}</div>
            <div style={{ fontSize: 10, color: isDisabled ? C.tt : C.ts, lineHeight: 1.3 }}>{tipo.description}</div>
          </button>
        );
      })}
    </div>
  );
}

const SIDE_LABELS = { frente: "Frente Inferior", fondo: "Frente Superior", latIzq: "Lateral Izq", latDer: "Lateral Der" };

function RoofBorderSelector({ borders = {}, onChange, panelFamilia = "", disabledSides = [], zonas = [], tipoAguas = "una_agua" }) {
  const [openSide, setOpenSide] = useState(null);
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const popoverRef = useRef(null);
  const [popoverStyle, setPopoverStyle] = useState(null);
  const panelFam = PANELS_TECHO[panelFamilia]?.fam || "";

  const validZonas = (zonas || []).filter(z => z?.largo > 0 && z?.ancho > 0);
  const is2A = tipoAguas === "dos_aguas";
  const hasZonas = validZonas.length > 0;

  const margin = 18;
  const edge = 10;
  const pad = 24;

  const { innerX, innerY, innerW, innerH, vbW, vbH, zoneRects, totalArea } = (() => {
    if (!hasZonas) {
      const svgW = 280, svgH = 180;
      const vbW0 = svgW + margin * 2, vbH0 = svgH + margin * 2;
      const ox = margin, oy = margin;
      const innerX0 = ox + pad, innerW0 = svgW - pad * 2, innerH0 = svgH - edge * 2;
      return {
        innerX: innerX0, innerY: oy + edge, innerW: innerW0, innerH: innerH0,
        vbW: vbW0, vbH: vbH0, zoneRects: [], totalArea: 0,
      };
    }
    const maxL = Math.max(...validZonas.map(z => z.largo), 1);
    const totalA = validZonas.reduce((s, z) => s + z.ancho, 0);
    const scale = 100 / Math.max(maxL, totalA / Math.max(validZonas.length, 1), 1);
    const contentW = Math.max(1, totalA * scale * (is2A ? 0.5 : 1) + (validZonas.length - 1) * 8);
    const contentH = Math.max(1, maxL * scale);
    const innerW = Math.max(120, contentW);
    const innerH = Math.max(80, contentH);
    const vbW = innerW + pad * 2 + edge * 2 + margin * 2;
    const vbH = innerH + edge * 2 + margin * 2;
    const ox = margin, oy = margin;
    const innerX = ox + pad;
    const innerY = oy + edge;
    const zoneScale = Math.min(innerW / contentW, innerH / contentH, 1);
    const zScale = scale * zoneScale;
    const zoneRects = validZonas.map((z, i) => {
      const l = z.largo * zScale;
      const a = (is2A ? z.ancho / 2 : z.ancho) * zScale;
      const x = innerX + validZonas.slice(0, i).reduce((s, prev) => s + (is2A ? prev.ancho / 2 : prev.ancho) * zScale + 6, 0);
      const y = innerY;
      return { x, y, w: a, h: l, label: `${z.largo}×${z.ancho}m` };
    });
    const totalArea = validZonas.reduce((s, z) => s + (z.largo * z.ancho), 0);
    return { innerX, innerY, innerW, innerH, vbW, vbH, zoneRects, totalArea };
  })();

  const edgeDefs = {
    fondo:  { x: innerX, y: innerY - edge, w: innerW, h: edge },
    frente: { x: innerX, y: innerY + innerH, w: innerW, h: edge },
    latIzq: { x: innerX - edge, y: innerY, w: edge, h: innerH },
    latDer: { x: innerX + innerW, y: innerY, w: edge, h: innerH },
  };

  useEffect(() => {
    const handler = (e) => {
      const t = e.target;
      if (containerRef.current && containerRef.current.contains(t)) return;
      if (popoverRef.current && popoverRef.current.contains(t)) return;
      setOpenSide(null);
      setPopoverStyle(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getOpts = (side) => (BORDER_OPTIONS[side] || []).filter(o => !o.familias || o.familias.includes(panelFam));
  const getLabel = (side) => {
    const val = borders[side];
    if (!val || val === "none") return "—";
    const opts = BORDER_OPTIONS[side] || [];
    const opt = opts.find(o => o.id === val && (!o.familias || o.familias.includes(panelFam)))
      || opts.find(o => o.id === val);
    return opt ? opt.label : val;
  };

  const handleEdgeClick = (side) => {
    if (disabledSides.includes(side)) return;
    setPopoverStyle(null);
    setOpenSide(prev => prev === side ? null : side);
  };

  const positionPopover = useCallback((side) => {
    const svgEl = svgRef.current;
    const popEl = popoverRef.current;
    if (!side || !svgEl || !popEl) return;

    const svgRect = svgEl.getBoundingClientRect();
    const popRect = popEl.getBoundingClientRect();
    if (popRect.width === 0 || popRect.height === 0) return;

    const vpPad = 10;
    const gap = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const anchor = (() => {
      switch (side) {
        case "fondo":  return { x: svgRect.left + svgRect.width / 2, y: svgRect.top };
        case "frente": return { x: svgRect.left + svgRect.width / 2, y: svgRect.bottom };
        case "latIzq": return { x: svgRect.left, y: svgRect.top + svgRect.height / 2 };
        case "latDer": return { x: svgRect.right, y: svgRect.top + svgRect.height / 2 };
        default: return null;
      }
    })();
    if (!anchor) return;

    const canTop = anchor.y - gap - popRect.height - vpPad >= 0;
    const canBottom = anchor.y + gap + popRect.height + vpPad <= vh;
    const canLeft = anchor.x - gap - popRect.width - vpPad >= 0;
    const canRight = anchor.x + gap + popRect.width + vpPad <= vw;

    let top = 0;
    let left = 0;

    if (side === "fondo") {
      if (canTop || !canBottom) { top = anchor.y - gap - popRect.height; left = anchor.x - popRect.width / 2; }
      else { top = anchor.y + gap; left = anchor.x - popRect.width / 2; }
    } else if (side === "frente") {
      if (canBottom || !canTop) { top = anchor.y + gap; left = anchor.x - popRect.width / 2; }
      else { top = anchor.y - gap - popRect.height; left = anchor.x - popRect.width / 2; }
    } else if (side === "latIzq") {
      if (canLeft || !canRight) { top = anchor.y - popRect.height / 2; left = anchor.x - gap - popRect.width; }
      else { top = anchor.y - popRect.height / 2; left = anchor.x + gap; }
    } else if (side === "latDer") {
      if (canRight || !canLeft) { top = anchor.y - popRect.height / 2; left = anchor.x + gap; }
      else { top = anchor.y - popRect.height / 2; left = anchor.x - gap - popRect.width; }
    }

    left = Math.min(Math.max(vpPad, left), vw - popRect.width - vpPad);
    top = Math.min(Math.max(vpPad, top), vh - popRect.height - vpPad);

    setPopoverStyle({ top, left, opacity: 1 });
  }, [setPopoverStyle]);

  useLayoutEffect(() => {
    if (!openSide) return;
    positionPopover(openSide);
  }, [openSide, positionPopover]);

  useEffect(() => {
    if (!openSide) return;
    const recalc = () => positionPopover(openSide);
    window.addEventListener("resize", recalc);
    // Capture scroll events from any scroll container (scroll doesn't bubble).
    window.addEventListener("scroll", recalc, true);
    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [openSide, positionPopover]);

  const labelPos = {
    fondo:  { x: innerX + innerW / 2, y: innerY - edge / 2 + 1, anchor: "middle" },
    frente: { x: innerX + innerW / 2, y: innerY + innerH + edge / 2 + 1, anchor: "middle" },
    latIzq: { x: innerX - edge / 2, y: innerY + innerH / 2, anchor: "middle", rotate: -90 },
    latDer: { x: innerX + innerW + edge / 2, y: innerY + innerH / 2, anchor: "middle", rotate: 90 },
  };

  return (
    <div ref={containerRef} style={{ position: "relative", fontFamily: FONT }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Vista previa del techo</div>
      <div style={{ fontSize: 12, color: C.ts, marginBottom: 10 }}>Clic en cada tramo para elegir el accesorio</div>
      <svg ref={svgRef} viewBox={`0 0 ${vbW} ${vbH}`} width="100%" style={{ display: "block", maxWidth: 400, margin: "0 auto" }}>
        {/* Panel area o zonas */}
        {hasZonas ? (
          <>
            {zoneRects.map((r, i) => (
              <g key={i}>
                <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={4} fill={C.brandLight} stroke={C.border} strokeWidth={1} />
                <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 1} textAnchor="middle" dominantBaseline="central" fill={C.brand} fontSize={9} fontWeight={600} fontFamily={FONT}>{r.label}</text>
              </g>
            ))}
            {totalArea > 0 && (
              <text x={innerX + innerW / 2} y={innerY + innerH + 12} textAnchor="middle" fill={C.ts} fontSize={10} fontFamily={FONT}>{totalArea.toFixed(1)} m²</text>
            )}
          </>
        ) : (
          <>
            <rect x={innerX} y={innerY} width={innerW} height={innerH} rx={6} fill={C.brandLight} stroke={C.border} strokeWidth={1} />
            <text x={innerX + innerW / 2} y={innerY + innerH / 2 + 1} textAnchor="middle" dominantBaseline="central" fill={C.brand} fontSize={13} fontWeight={700} fontFamily={FONT}>PANELES</text>
          </>
        )}

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
          const hitPad = 8;
          const hx = isVert ? d.x - hitPad : d.x;
          const hy = isVert ? d.y : d.y - hitPad;
          const hw = isVert ? d.w + hitPad * 2 : d.w;
          const hh = isVert ? d.h : d.h + hitPad * 2;
          return (
            <g key={side} role="button" tabIndex={isDisabled ? -1 : 0} aria-label={`${SIDE_LABELS[side] || side}: ${abbr}`} onClick={() => handleEdgeClick(side)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleEdgeClick(side); } }} style={{ cursor: isDisabled ? "not-allowed" : "pointer" }}>
              <rect x={hx} y={hy} width={hw} height={hh} fill="transparent" />
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
        <text x={innerX + innerW / 2} y={innerY + innerH + 28} textAnchor="middle" fill={C.ts} fontSize={9} fontWeight={600} fontFamily={FONT} letterSpacing="0.05em">▼ FRENTE INF</text>
        <text x={innerX + innerW / 2} y={innerY - 8} textAnchor="middle" fill={C.ts} fontSize={9} fontWeight={600} fontFamily={FONT} letterSpacing="0.05em">▲ FRENTE SUP</text>
        <text x={innerX - edge - 6} y={innerY + innerH / 2} textAnchor="middle" dominantBaseline="central" fill={C.ts} fontSize={9} fontWeight={600} fontFamily={FONT} letterSpacing="0.05em" transform={`rotate(-90, ${innerX - edge - 6}, ${innerY + innerH / 2})`}>◄ IZQ</text>
        <text x={innerX + innerW + edge + 6} y={innerY + innerH / 2} textAnchor="middle" dominantBaseline="central" fill={C.ts} fontSize={9} fontWeight={600} fontFamily={FONT} letterSpacing="0.05em" transform={`rotate(90, ${innerX + innerW + edge + 6}, ${innerY + innerH / 2})`}>DER ►</text>
      </svg>

      {/* Popover for the open side */}
      {openSide && typeof document !== "undefined" && createPortal((() => {
        const opts = getOpts(openSide);
        const baseS = { fontFamily: FONT, background: C.surface, borderRadius: 10, boxShadow: "0 4px 24px rgba(0,0,0,0.15)", minWidth: 220, maxWidth: 320, maxHeight: 320, display: "flex", flexDirection: "column", animation: "bmc-fade 100ms ease-in-out" };
        return (
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              zIndex: 9999,
              top: popoverStyle?.top ?? -9999,
              left: popoverStyle?.left ?? -9999,
              opacity: popoverStyle?.opacity ?? 0,
              transition: "opacity 80ms ease",
              ...baseS,
            }}
          >
            <div style={{ padding: "6px 12px", fontSize: 10, fontWeight: 700, color: C.ts, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt, borderRadius: "10px 10px 0 0", flexShrink: 0 }}>{SIDE_LABELS[openSide]}</div>
            <div style={{ overflowY: "auto", borderRadius: "0 0 10px 10px" }}>
              {opts.map(opt => {
                const isSel = borders[openSide] === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={(e) => { e.stopPropagation(); onChange(openSide, opt.id); setPopoverStyle(null); setOpenSide(null); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", cursor: "pointer", fontSize: 13, background: isSel ? C.primarySoft : "transparent", fontWeight: isSel ? 500 : 400, color: C.tp, transition: TR }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span>{opt.label}</span>
                      {opt.descripcion && <span style={{ fontSize: 10, color: C.ts, fontWeight: 400, lineHeight: 1.3 }}>{opt.descripcion}</span>}
                    </div>
                    {isSel && <Check size={14} color={C.primary} style={{ flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })(), document.body)}
    </div>
  );
}

// ── Wizard steps (Modo Vendedor — por escenario; excluye presupuesto_libre) ─────
// Footer: wizardPrimaryActionStyle(isValid) para Siguiente en todos los flujos.
const WIZARD_STEPS_SOLO_TECHO = [
  { id: "escenario", label: "Escenario de obra" },
  { id: "tipoAguas", label: "Caída del techo" },
  { id: "lista", label: "Lista de precios" },
  { id: "familia", label: "Familia panel techo" },
  { id: "espesor", label: "Espesor techo" },
  { id: "color", label: "Color techo" },
  { id: "dimensiones", label: "Dimensiones (metros o paneles)" },
  { id: "pendiente", label: "Pendiente" },
  { id: "estructura", label: "Estructura" },
  { id: "bordes", label: "Accesorios perimetrales" },
  { id: "selladores", label: "Selladores" },
  { id: "flete", label: "Flete" },
  { id: "proyecto", label: "Datos del proyecto" },
];

const WIZARD_STEPS_SOLO_FACHADA = [
  { id: "escenario", label: "Escenario de obra" },
  { id: "lista", label: "Lista de precios" },
  { id: "familia_pared", label: "Familia panel pared" },
  { id: "espesor_pared", label: "Espesor pared" },
  { id: "color_pared", label: "Color pared" },
  { id: "dimensiones_pared", label: "Dimensiones pared" },
  { id: "aberturas", label: "Aberturas (opcional)" },
  { id: "estructura", label: "Estructura" },
  { id: "selladores", label: "Selladores" },
  { id: "flete", label: "Flete" },
  { id: "proyecto", label: "Datos del proyecto" },
];

const WIZARD_STEPS_TECHO_FACHADA = [
  { id: "escenario", label: "Escenario de obra" },
  { id: "tipoAguas", label: "Caída del techo" },
  { id: "lista", label: "Lista de precios" },
  { id: "familia", label: "Familia panel techo" },
  { id: "espesor", label: "Espesor techo" },
  { id: "color", label: "Color techo" },
  { id: "dimensiones", label: "Dimensiones techo" },
  { id: "pendiente", label: "Pendiente" },
  { id: "estructura", label: "Estructura" },
  { id: "bordes", label: "Accesorios perimetrales" },
  { id: "selladores", label: "Selladores" },
  { id: "familia_pared", label: "Familia panel pared" },
  { id: "espesor_pared", label: "Espesor pared" },
  { id: "color_pared", label: "Color pared" },
  { id: "dimensiones_pared", label: "Dimensiones pared" },
  { id: "aberturas", label: "Aberturas (opcional)" },
  { id: "perfil_5852", label: "Perfil 5852 aluminio" },
  { id: "flete", label: "Flete" },
  { id: "proyecto", label: "Datos del proyecto" },
];

const WIZARD_STEPS_CAMARA_FRIG = [
  { id: "escenario", label: "Escenario de obra" },
  { id: "lista", label: "Lista de precios" },
  { id: "familia_pared", label: "Familia panel" },
  { id: "espesor_pared", label: "Espesor" },
  { id: "color_pared", label: "Color" },
  { id: "camara_dim", label: "Dimensiones cámara (interiores)" },
  { id: "aberturas", label: "Aberturas (opcional)" },
  { id: "estructura", label: "Estructura" },
  { id: "selladores", label: "Selladores" },
  { id: "flete", label: "Flete" },
  { id: "proyecto", label: "Datos del proyecto" },
];

/** Pasos del wizard modo vendedor. `presupuesto_libre` → [] (sin wizard). */
function getWizardStepsForScenario(scenarioId) {
  switch (scenarioId) {
    case "solo_techo": return WIZARD_STEPS_SOLO_TECHO;
    case "solo_fachada": return WIZARD_STEPS_SOLO_FACHADA;
    case "techo_fachada": return WIZARD_STEPS_TECHO_FACHADA;
    case "camara_frig": return WIZARD_STEPS_CAMARA_FRIG;
    case "presupuesto_libre":
    default:
      return [];
  }
}

const TECHO_INITIAL_VENDEDOR = {
  familia: "", espesor: "", color: "", zonas: [{ largo: 0, ancho: 0 }],
  pendiente: 0, pendienteModo: "calcular_pendiente", alturaDif: 0,
  tipoAguas: "", tipoEst: "", ptsHorm: 0, ptsMetal: 0, ptsMadera: 0,
  borders: { frente: "", fondo: "", latIzq: "", latDer: "" },
  inclAccesorios: true,
  opciones: { inclCanalon: false, inclGotSup: false, inclSell: true, bomComercial: false },
};

const ESTRUCTURA_OPTIONS = [
  { id: "metal", label: "Metal" },
  { id: "hormigon", label: "Hormigón" },
  { id: "madera", label: "Madera" },
  { id: "combinada", label: "Combinada" },
];

const PENDIENTE_MODOS = [
  { id: "incluye_pendiente", label: "Largo del panel considera pendiente", desc: "El largo ingresado ya es el real (incluye pendiente)" },
  { id: "calcular_pendiente", label: "Calcular largo según pendiente", desc: "Largo proyectado × factor de pendiente" },
  { id: "calcular_altura", label: "Calcular largo según diferencia de altura", desc: "√(largo² + altura²) entre apoyo sup. e inf." },
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function PanelinCalculadoraV3() {
  // ── State ──
  const [modoVendedor, setModoVendedor] = useState(true);
  const [wizardStep, setWizardStep] = useState(0);
  const [listaPrecios, _setLP] = useState("");
  const [scenario, _setScenario] = useState("solo_techo");
  const [proyecto, _setProyecto] = useState({ tipoCliente: "empresa", nombre: "", rut: "", telefono: "", direccion: "", descripcion: "", refInterna: "", fecha: new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" }) });
  const [techo, _setTecho] = useState(() => ({ ...TECHO_INITIAL_VENDEDOR }));
  const [pared, _setPared] = useState({ familia: "", espesor: "", color: "Blanco", alto: 3.5, perimetro: 40, numEsqExt: 4, numEsqInt: 0, aberturas: [], tipoEst: "metal", inclSell: true, incl5852: false });
  const [techoAnchoModo, _setTechoAnchoModo] = useState("metros"); // "metros" | "paneles"
  const [camara, _setCamara] = useState({ largo_int: 6, ancho_int: 4, alto_int: 3 });
  const [flete, _setFlete] = useState(() => getFleteDefault());
  /** Costo interno del flete (USD s/IVA); opcional — afecta margen y hoja Costeo. */
  const [fleteCosto, setFleteCosto] = useState("");
  const [configVersion, setConfigVersion] = useState(0);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [overrides, _setOverrides] = useState({});
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [toast, setToast] = useState(null);
  const [showTransp, setShowTransp] = useState(false);
  const [previewHTML, setPreviewHTML] = useState(null);
  const [previewTitle, setPreviewTitle] = useState("Vista previa de cotización");
  const [excludedItems, _setExcludedItems] = useState({}); // { lineId: label }
  const [usePlanoTechoFachada, setUsePlanoTechoFachada] = useState(false); // Diseño por plano (techo+fachada)
  const [categoriasActivas, _setCategoriasActivas] = useState(() => {
    const initial = {};
    Object.keys(CATEGORIAS_BOM).forEach(k => { initial[k] = CATEGORIAS_BOM[k].default; });
    return initial;
  });
  const [libreAcc, setLibreAcc] = useState({
    paneles: true, perfileria: false, tornilleria: false, selladores: false, servicios: false, extraordinarios: false,
  });
  const [librePanelLines, setLibrePanelLines] = useState([{ familia: "", espesor: "", color: "Blanco", m2: 0 }]);
  const [librePerfilQty, setLibrePerfilQty] = useState({});
  const [libreFijQty, setLibreFijQty] = useState({});
  const [libreSellQty, setLibreSellQty] = useState({});
  const [libreExtra, setLibreExtra] = useState({ texto: "", precio: "", unidades: "", cantidad: "" });
  const [librePerfilFilter, setLibrePerfilFilter] = useState("");

  // ── Setters envueltos con log de interacción (solo en dev) ──
  const setLP = useMemo(() => wrapSetter(_setLP, "listaPrecios"), [_setLP]);
  const setScenario = useMemo(() => wrapSetter(_setScenario, "scenario"), [_setScenario]);
  const setProyecto = useMemo(() => wrapSetter(_setProyecto, "proyecto"), [_setProyecto]);
  const setTecho = useMemo(() => wrapSetter(_setTecho, "techo"), [_setTecho]);
  const setPared = useMemo(() => wrapSetter(_setPared, "pared"), [_setPared]);
  const setTechoAnchoModo = useMemo(() => wrapSetter(_setTechoAnchoModo, "techoAnchoModo"), [_setTechoAnchoModo]);
  const setCamara = useMemo(() => wrapSetter(_setCamara, "camara"), [_setCamara]);
  const setFlete = useMemo(() => wrapSetter(_setFlete, "flete"), [_setFlete]);
  const setOverrides = useMemo(() => wrapSetter(_setOverrides, "overrides"), [_setOverrides]);
  const setExcludedItems = useMemo(() => wrapSetter(_setExcludedItems, "excludedItems"), [_setExcludedItems]);
  const setCategoriasActivas = useMemo(() => wrapSetter(_setCategoriasActivas, "categoriasActivas"), [_setCategoriasActivas]);

  // Section refs for auto-scroll
  const panelRef = useRef(null);
  const dimensionesRef = useRef(null);
  const bordesRef = useRef(null);
  const opcionesRef = useRef(null);

  // PDF snapshot capture refs
  const pdfCaptureSummaryRef = useRef(null);
  const pdfCaptureTotalsRef = useRef(null);

  const scrollToSection = useCallback((sectionKey) => {
    const refs = { panel: panelRef, dimensiones: dimensionesRef, bordes: bordesRef, opciones: opcionesRef };
    const ref = refs[sectionKey];
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Sync LISTA_ACTIVA (solo cuando hay valor)
  useEffect(() => { if (listaPrecios) setListaPrecios(listaPrecios); }, [listaPrecios]);

  // Reset wizard al cambiar escenario o al activar modo vendedor
  useEffect(() => {
    if (modoVendedor && scenario !== "solo_techo") setWizardStep(0);
  }, [scenario, modoVendedor]);

  // Reset modo plano al salir de techo_fachada
  useEffect(() => {
    if (scenario !== "techo_fachada") setUsePlanoTechoFachada(false);
  }, [scenario]);

  // ── Wizard step validation (Modo Vendedor) ──
  const isWizardStepValid = useCallback((stepId) => {
    switch (stepId) {
      case "escenario": return !!scenario;
      case "lista": return !!listaPrecios;
      case "tipoAguas": return !!techo.tipoAguas;
      case "familia": return !!techo.familia;
      case "espesor": return !!techo.espesor;
      case "color": return !!techo.color;
      case "dimensiones": return techo.zonas?.length > 0 && techo.zonas.every(z => z.largo > 0 && z.ancho > 0);
      case "pendiente": return typeof techo.pendiente === "number" && techo.pendiente >= 0;
      case "estructura": {
        if (!techo.tipoEst) return false;
        if (techo.tipoEst === "combinada") {
          const total = (techo.ptsHorm ?? 0) + (techo.ptsMetal ?? 0) + (techo.ptsMadera ?? 0);
          return total > 0;
        }
        return true;
      }
      case "bordes": {
        if (techo.inclAccesorios === false) return true;
        const sides = ["frente", "fondo", "latIzq", "latDer"];
        const disabled = techo.tipoAguas === "dos_aguas" ? ["fondo"] : [];
        return sides.every(s => disabled.includes(s) || !!(techo.borders?.[s]));
      }
      case "selladores": return true;
      case "flete": return typeof flete === "number";
      case "proyecto": return !!(proyecto.nombre?.trim() && proyecto.telefono?.trim());
      default: return false;
    }
  }, [scenario, listaPrecios, techo, flete, proyecto]);

  // Enter → Siguiente en wizard (modo vendedor, solo techo)
  useEffect(() => {
    if (!modoVendedor || scenario !== "solo_techo") return;
    const step = WIZARD_STEPS_SOLO_TECHO[wizardStep];
    const stepId = step?.id;
    const isValid = stepId && isWizardStepValid(stepId);
    const canNext = wizardStep < WIZARD_STEPS_SOLO_TECHO.length - 1;
    const handler = (e) => {
      if (e.key !== "Enter" || e.target?.tagName === "TEXTAREA") return;
      if (canNext && isValid) {
        e.preventDefault();
        setWizardStep(s => s + 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modoVendedor, scenario, wizardStep, isWizardStepValid]);

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

  // ── Presupuesto libre: catálogo (pricing con overrides) ──
  const libreCatalog = useMemo(() => {
    try {
      const p = getPricing();
      return {
        PANELS_TECHO: p.PANELS_TECHO,
        PANELS_PARED: p.PANELS_PARED,
        PERFIL_TECHO: p.PERFIL_TECHO,
        PERFIL_PARED: p.PERFIL_PARED,
        FIJACIONES: p.FIJACIONES,
        HERRAMIENTAS: p.HERRAMIENTAS,
        SELLADORES: p.SELLADORES,
        SERVICIOS: p.SERVICIOS,
      };
    } catch {
      return null;
    }
  }, [configVersion]);

  const libreFamiliaOpts = useMemo(() => {
    const pt = libreCatalog?.PANELS_TECHO || PANELS_TECHO;
    const pp = libreCatalog?.PANELS_PARED || PANELS_PARED;
    const all = { ...pt, ...pp };
    return Object.keys(all).map((k) => ({ value: k, label: all[k].label, sublabel: all[k].sub }));
  }, [libreCatalog]);

  const librePerfilList = useMemo(() => {
    const pet = libreCatalog?.PERFIL_TECHO || PERFIL_TECHO;
    const pep = libreCatalog?.PERFIL_PARED || PERFIL_PARED;
    return flattenPerfilesLibre(pet, pep);
  }, [libreCatalog]);
  const librePerfilById = useMemo(() => new Map(librePerfilList.map((r) => [r.id, r])), [librePerfilList]);
  const librePerfilFiltered = useMemo(() => {
    const q = (librePerfilFilter || "").trim().toLowerCase();
    if (!q) return librePerfilList;
    return librePerfilList.filter((r) => r.label.toLowerCase().includes(q) || (r.sku && r.sku.toLowerCase().includes(q)));
  }, [librePerfilList, librePerfilFilter]);

  const libreTornilleriaKeys = useMemo(() => {
    const F = libreCatalog?.FIJACIONES || FIJACIONES;
    const H = libreCatalog?.HERRAMIENTAS || HERRAMIENTAS;
    return [...Object.keys(F), ...Object.keys(H || {})].sort();
  }, [libreCatalog]);

  const libreSelladorKeys = useMemo(() => Object.keys(libreCatalog?.SELLADORES || SELLADORES), [libreCatalog]);

  const toggleLibreAcc = (k) => setLibreAcc((a) => ({ ...a, [k]: !a[k] }));
  const updateLibrePanelLine = (idx, patch) => {
    setLibrePanelLines((lines) => lines.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };
  const addLibrePanelLine = () => setLibrePanelLines((l) => [...l, { familia: "", espesor: "", color: "Blanco", m2: 0 }]);
  const removeLibrePanelLine = (idx) => setLibrePanelLines((l) => (l.length <= 1 ? l : l.filter((_, i) => i !== idx)));

  // ── Helpers: Ancho techo en metros ↔ paneles ──
  const normalizeTechoAnchoToPaneles = useCallback((anchoM, panelData, tipoAguas) => {
    if (!panelData) return anchoM;
    const is2A = tipoAguas === "dos_aguas";
    const perSlope = is2A ? (anchoM / 2) : anchoM;
    const { cantPaneles } = normalizarMedida("metros", perSlope, panelData);
    const anchoPerSlope = cantPaneles * panelData.au;
    const anchoTotal = is2A ? (anchoPerSlope * 2) : anchoPerSlope;
    return +anchoTotal.toFixed(2);
  }, []);

  const techoPanelesDesdeAnchoM = useCallback((anchoM, panelData, tipoAguas) => {
    if (!panelData) return 0;
    const is2A = tipoAguas === "dos_aguas";
    const perSlope = is2A ? (anchoM / 2) : anchoM;
    return normalizarMedida("metros", perSlope, panelData).cantPaneles;
  }, []);

  const techoAnchoMDesdePaneles = useCallback((cantPaneles, panelData, tipoAguas) => {
    if (!panelData) return 0;
    const is2A = tipoAguas === "dos_aguas";
    const { ancho } = normalizarMedida("paneles", cantPaneles, panelData);
    const anchoTotal = is2A ? (ancho * 2) : ancho;
    return +anchoTotal.toFixed(2);
  }, []);

  // ── Zonas helpers ──
  const addZona = () => setTecho(t => {
    const defaultLargo = 6.0;
    const defaultAnchoM = 5.0;
    const wantPaneles = techoAnchoModo === "paneles" && techoPanelData;
    const ancho = wantPaneles
      ? normalizeTechoAnchoToPaneles(defaultAnchoM, techoPanelData, t.tipoAguas)
      : defaultAnchoM;
    return { ...t, zonas: [...t.zonas, { largo: defaultLargo, ancho }] };
  });
  const removeZona = (idx) => setTecho(t => ({ ...t, zonas: t.zonas.length > 1 ? t.zonas.filter((_, i) => i !== idx) : t.zonas }));
  const updateZona = (idx, key, val) => setTecho(t => ({ ...t, zonas: t.zonas.map((z, i) => i === idx ? { ...z, [key]: val } : z) }));
  const updateZonaPreview = useCallback((idx, patch) => {
    setTecho(t => ({
      ...t,
      zonas: t.zonas.map((z, i) => (i === idx ? { ...z, preview: { ...z.preview, ...patch } } : z)),
    }));
  }, [setTecho]);
  const resetRoofPreviewLayout = useCallback(() => {
    setTecho(t => ({
      ...t,
      zonas: t.zonas.map((z) => {
        const sm = z.preview?.slopeMark;
        if (sm && sm !== "off") return { ...z, preview: { slopeMark: sm } };
        const out = { ...z };
        delete out.preview;
        return out;
      }),
    }));
  }, [setTecho]);

  // Mantener el ancho “alineado” a paneles cuando el modo está activo
  useEffect(() => {
    if (techoAnchoModo !== "paneles") return;
    if (!techoPanelData) return;
    setTecho(prev => {
      const nextZonas = prev.zonas.map(z => {
        const nextAncho = normalizeTechoAnchoToPaneles(z.ancho, techoPanelData, prev.tipoAguas);
        return nextAncho === z.ancho ? z : { ...z, ancho: nextAncho };
      });
      const changed = nextZonas.some((z, i) => z !== prev.zonas[i]);
      return changed ? { ...prev, zonas: nextZonas } : prev;
    });
  }, [techoAnchoModo, techoPanelData, techo.tipoAguas, normalizeTechoAnchoToPaneles]);

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
      if (sc === "presupuesto_libre") {
        const listaEff = listaPrecios || "web";
        return computePresupuestoLibreCatalogo({
          listaPrecios: listaEff,
          librePanelLines,
          librePerfilQty,
          perfilCatalogById: librePerfilById,
          libreFijQty,
          libreSellQty,
          flete,
          libreExtra,
          catalog: libreCatalog || undefined,
        });
      }
      if (sc === "solo_techo") {
        if (!techo.familia || !techo.espesor) return null;
        // For 2 aguas: each zona generates 2 faldones (half ancho each)
        // Agua 1 keeps frente+latIzq+latDer borders, fondo=cumbrera
        // Agua 2 keeps fondo(original)+latIzq+latDer borders, frente=cumbrera (shared, not double-counted)
        const is2Aguas = techo.tipoAguas === "dos_aguas";
        const emptyBorders = { frente: "none", fondo: "none", latIzq: "none", latDer: "none" };
        const zonaResults = techo.zonas.flatMap(zona => {
          const inputs = { ...techo, largo: zona.largo, ancho: zona.ancho, pendienteModo: techo.pendienteModo || "calcular_pendiente", alturaDif: zona.alturaDif ?? techo.alturaDif ?? 0 };
          const borders = techo.inclAccesorios === false ? emptyBorders : techo.borders;
          if (is2Aguas) {
            const halfAncho = +(zona.ancho / 2).toFixed(2);
            const agua1 = calcTechoCompleto({ ...inputs, ancho: halfAncho, borders: { ...borders, fondo: "cumbrera" } });
            const agua2 = calcTechoCompleto({ ...inputs, ancho: halfAncho, borders: { frente: borders.fondo === "cumbrera" ? "cumbrera" : borders.fondo, fondo: "none", latIzq: borders.latIzq, latDer: borders.latDer } });
            return [agua1, agua2];
          }
          return [calcTechoCompleto({ ...inputs, borders })];
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
          const emptyBorders = { frente: "none", fondo: "none", latIzq: "none", latDer: "none" };
          const zonaResults = techo.zonas.flatMap(zona => {
            const inputs = { ...techo, largo: zona.largo, ancho: zona.ancho, pendienteModo: techo.pendienteModo || "calcular_pendiente", alturaDif: zona.alturaDif ?? techo.alturaDif ?? 0 };
            const borders = techo.inclAccesorios === false ? emptyBorders : techo.borders;
            if (is2A) {
              const ha = +(zona.ancho / 2).toFixed(2);
              const a1 = calcTechoCompleto({ ...inputs, ancho: ha, borders: { ...borders, fondo: "cumbrera" } });
              const a2 = calcTechoCompleto({ ...inputs, ancho: ha, borders: { frente: borders.fondo === "cumbrera" ? "cumbrera" : borders.fondo, fondo: "none", latIzq: borders.latIzq, latDer: borders.latDer } });
              return [a1, a2];
            }
            return [calcTechoCompleto({ ...inputs, borders })];
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
        const techoFam = pared.familia in PANELS_TECHO ? pared.familia : "ISODEC_EPS";
        const techoPanel = PANELS_TECHO[techoFam];
        const extraW = [];
        let techoEsp = pared.espesor;
        if (!techoPanel.esp[techoEsp]) {
          const available = Object.keys(techoPanel.esp).map(Number).sort((a, b) => a - b);
          techoEsp = available.find(e => e >= techoEsp) || available[available.length - 1];
          extraW.push(`Techo cámara: espesor ${pared.espesor}mm no disponible en ${techoFam}, se usó ${techoEsp}mm.`);
        }
        const rT = calcTechoCompleto({ familia: techoFam, espesor: techoEsp, largo: camara.largo_int, ancho: camara.ancho_int, tipoEst: "metal", borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" }, opciones: { inclCanalon: false, inclGotSup: false, inclSell: true }, color: pared.color });
        if (rT?.error) extraW.push(`Techo cámara: ${rT.error}`);
        const techoItems = rT?.error ? [] : (rT?.allItems || []);
        const allItems = [...(rP?.allItems || []), ...techoItems];
        const totales = calcTotalesSinIVA(allItems);
        return { ...rP, techoResult: rT?.error ? null : rT, allItems, totales, warnings: [...(rP?.warnings || []), ...(rT?.warnings || []), ...extraW] };
      }
    } catch (e) { return { error: e.message }; }
    return null;
  }, [scenario, techo, pared, camara, configVersion, listaPrecios, librePanelLines, librePerfilQty, librePerfilById, libreFijQty, libreSellQty, flete, libreExtra, libreCatalog]);

  // ── Build BOM groups ──
  const groups = useMemo(() => {
    if (!results || results.error) return [];
    let g;
    if (results.presupuestoLibre) {
      g = results.libreGroups?.length ? results.libreGroups : bomToGroups(results);
    } else {
      g = bomToGroups(results);
      // Add flete — uses the user-supplied value from the stepper (pre-VAT)
      if (flete > 0) {
        const fleteLabel = proyecto.direccion
          ? `${SERVICIOS.flete.label} — ${proyecto.direccion}`
          : SERVICIOS.flete.label;
        g.push({ title: "SERVICIOS", items: [{ label: fleteLabel, sku: "FLETE", cant: 1, unidad: "servicio", pu: flete, total: flete }] });
      }
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
  }, [results, overrides, flete, excludedItems, categoriasActivas, proyecto.direccion]);

  // ── Grand totals (with overrides applied) ──
  const grandTotal = useMemo(() => {
    const allItems = [];
    groups.forEach(g => g.items.forEach(i => allItems.push(i)));
    return calcTotalesSinIVA(allItems);
  }, [groups]);

  // Build panel info for output (supports combined scenarios) — must be before handlers that reference it (TDZ)
  const panelInfo = useMemo(() => {
    if (isCombined) {
      const parts = [];
      if (techoPanelData && techo.espesor) parts.push(`Techo: ${techoPanelData.label} ${techo.espesor}mm ${techo.color}`);
      if (paredPanelData && pared.espesor) parts.push(`Pared: ${paredPanelData.label} ${pared.espesor}mm ${pared.color}`);
      return { label: parts.join(" + "), espesor: "", color: "", au: techoPanelData?.au || null };
    }
    if (scenarioDef?.hasTecho) return { label: techoPanelData?.label || "", espesor: techo.espesor, color: techo.color, au: techoPanelData?.au || null };
    return { label: paredPanelData?.label || "", espesor: pared.espesor, color: pared.color, au: paredPanelData?.au || null };
  }, [isCombined, scenarioDef, techoPanelData, paredPanelData, techo, pared]);

  // ── Helpers ──
  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); }, []);

  const fleteCostoNum = useMemo(() => {
    const t = String(fleteCosto ?? "").trim().replace(",", ".");
    const n = parseFloat(t);
    return isFinite(n) && n >= 0 ? n : null;
  }, [fleteCosto]);

  const costingCtx = useMemo(() => ({
    lista: listaPrecios,
    fletePrecioVenta: flete > 0 ? flete : null,
    fleteCostUsd: fleteCostoNum,
  }), [listaPrecios, flete, fleteCostoNum]);

  const handleClienteVisual = useCallback(() => {
    if (!groups.length) return;
    const html = generateClientVisualHTML({
      client: proyecto, project: proyecto, scenario,
      panel: panelInfo,
      groups: groups.map(g => ({ title: g.title, items: g.items })),
      totals: grandTotal,
      appendix: null,
      snapshotImages: {},
    });
    openPrintWindow(html);
  }, [groups, proyecto, scenario, panelInfo, grandTotal]);

  const handleCosteo = useCallback(() => {
    if (!groups.length) return;
    const allItems = groups.flatMap(g => g.items);
    const report = buildCostingReport(allItems, costingCtx);
    const listaLabel = listaPrecios === "venta" ? "BMC directo" : "Web";
    const html = generateCosteoHTML({ client: proyecto, project: proyecto, listaLabel, report });
    openPrintWindow(html);
  }, [groups, proyecto, listaPrecios, costingCtx]);

  const handleCopyTSV = useCallback(() => {
    if (!groups.length) return;
    const scenarioDef_ = SCENARIOS_DEF.find(s => s.id === scenario);
    const vis_ = VIS[scenario] || VIS.solo_techo;
    const kpiPaneles = results?.paneles?.cantPaneles ?? results?.paredResult?.paneles?.cantPaneles ?? null;
    const kpiArea = results?.paneles?.areaTotal ?? results?.paneles?.areaNeta ?? null;
    const kpiApoyos = results?.autoportancia?.apoyos ?? results?.paneles?.numEsqExt ?? null;
    const kpiFij = results?.fijaciones?.puntosFijacion ?? null;
    const panelLine = `${panelInfo.label}${panelInfo.espesor ? " " + panelInfo.espesor + "mm" : ""}${panelInfo.color ? " · " + panelInfo.color : ""}`;
    const tsv = buildGoogleSheetReportTsv({
      proyecto, scenario, scenarioLabel: scenarioDef_?.label || scenario,
      vis: vis_, techo, pared, camara,
      kpiArea, kpiPaneles, kpiApoyos, kpiFij,
      results, panelLine, grandTotal,
      presupuestoLibre: scenarioDef_?.isLibre || false,
    });
    navigator.clipboard.writeText(tsv).then(() => showToast("TSV copiado — pegá en Google Sheets"));
  }, [groups, scenario, results, panelInfo, proyecto, techo, pared, camara, grandTotal, showToast]);

  const handlePdfEnriquecido = useCallback(async () => {
    if (!groups.length) return;
    showToast("Generando PDF…");
    try {
      const snapshotImages = await capturePdfSnapshotTargets({
        summaryEl: pdfCaptureSummaryRef.current,
        totalsEl: pdfCaptureTotalsRef.current,
        bordersEl: bordesRef.current,
      });
      const vis_ = VIS[scenario] || VIS.solo_techo;
      const scenarioDef_ = SCENARIOS_DEF.find(s => s.id === scenario);
      const kpiPaneles = results?.paneles?.cantPaneles ?? results?.paredResult?.paneles?.cantPaneles ?? null;
      const kpiArea = results?.paneles?.areaTotal ?? results?.paneles?.areaNeta ?? null;
      const kpiApoyos = results?.autoportancia?.apoyos ?? results?.paneles?.numEsqExt ?? null;
      const kpiFij = results?.fijaciones?.puntosFijacion ?? null;
      const appendix = buildPdfAppendixPayload({
        scenario, scenarioDef: scenarioDef_, vis: vis_,
        techo, pared, camara, results, grandTotal,
        kpiArea, kpiPaneles, kpiApoyos, kpiFij,
        PANELS_TECHO, PANELS_PARED,
      });
      const html = generateClientVisualHTML({
        client: proyecto, project: proyecto, scenario,
        panel: panelInfo,
        groups: groups.map(g => ({ title: g.title, items: g.items })),
        totals: grandTotal,
        appendix,
        snapshotImages,
      });
      const pdfBlob = await htmlToPdfBlob(html);
      const fname = pdfFileName({ proyecto, scenario, listaPrecios });
      downloadPdf(pdfBlob, fname);
      showToast("PDF descargado");
    } catch (err) {
      showToast("Error al generar PDF: " + (err?.message || err));
    }
  }, [groups, scenario, results, panelInfo, proyecto, techo, pared, camara, grandTotal, listaPrecios, showToast]);

  const handleCopyWA = () => {
    const txt = buildWhatsAppText({
      client: proyecto, project: proyecto, scenario,
      panel: panelInfo,
      totals: grandTotal,
      listaLabel: listaPrecios === "venta" ? "BMC directo" : "Web",
    });
    navigator.clipboard.writeText(txt).then(() => showToast("Copiado al portapapeles"));
  };

  const buildPrintDimensions = useCallback(() => {
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
    return dimensions;
  }, [scenarioDef?.hasTecho, scenarioDef?.hasPared, techo.zonas, zonasTotales.area, results?.paneles?.areaTotal, results?.paneles?.areaNeta, results?.paneles?.cantPaneles, pared.alto, pared.perimetro]);

  const handlePrint = () => {
    const dimensions = buildPrintDimensions();
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
      quotationId: currentBudgetCode || undefined,
      showSKU: false,
      showUnitPrices: true,
    });
    setPreviewTitle("Vista previa de cotización");
    setPreviewHTML(html);
  };

  const handleInternalReport = () => {
    const dimensions = buildPrintDimensions();
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
    setPreviewTitle("Informe interno BMC");
    setPreviewHTML(html);
  };

  const handleReset = () => {
    setScenario("solo_techo");
    setLP(modoVendedor ? "" : getListaDefault());
    setProyecto({ tipoCliente: "empresa", nombre: "", rut: "", telefono: "", direccion: "", descripcion: "", refInterna: "", fecha: new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" }) });
    setTecho(modoVendedor ? { ...TECHO_INITIAL_VENDEDOR } : { familia: "", espesor: "", color: "Blanco", zonas: [{ largo: 6.0, ancho: 5.0 }], pendiente: 0, pendienteModo: "calcular_pendiente", alturaDif: 0, tipoAguas: "una_agua", tipoEst: "metal", ptsHorm: 0, borders: { frente: "gotero_frontal", fondo: "gotero_lateral", latIzq: "gotero_lateral", latDer: "gotero_lateral" }, opciones: { inclCanalon: false, inclGotSup: false, inclSell: true, bomComercial: false } });
    setPared({ familia: "", espesor: "", color: "Blanco", alto: 3.5, perimetro: 40, numEsqExt: 4, numEsqInt: 0, aberturas: [], tipoEst: "metal", inclSell: true, incl5852: false });
    setTechoAnchoModo("metros");
    setCamara({ largo_int: 6, ancho_int: 4, alto_int: 3 });
    setFlete(getFleteDefault());
    setOverrides({});
    setExcludedItems({});
    if (modoVendedor) setWizardStep(0);
    setCategoriasActivas(() => {
      const initial = {};
      Object.keys(CATEGORIAS_BOM).forEach(k => { initial[k] = CATEGORIAS_BOM[k].default; });
      return initial;
    });
    setLibreAcc({ paneles: true, perfileria: false, tornilleria: false, selladores: false, servicios: false, extraordinarios: false });
    setLibrePanelLines([{ familia: "", espesor: "", color: "Blanco", m2: 0 }]);
    setLibrePerfilQty({});
    setLibreFijQty({});
    setLibreSellQty({});
    setLibreExtra({ texto: "", precio: "", unidades: "", cantidad: "" });
    setLibrePerfilFilter("");
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

  // ── GPT quotation registry state ──
  const [gptQuotations, setGptQuotations] = useState([]);
  const [gptLoading, setGptLoading] = useState(false);

  const fetchGptQuotations = useCallback(async () => {
    const apiUrl = getCalcApiBase();
    setGptLoading(true);
    try {
      const resp = await fetch(`${apiUrl}/calc/cotizaciones`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.ok) setGptQuotations(data.cotizaciones || []);
    } catch { /* silent — API may be unavailable */ }
    finally { setGptLoading(false); }
  }, []);

  const scenarioLabels = useRef({ solo_techo: "Techo", solo_fachada: "Fachada", techo_fachada: "Techo+Fachada", camara_frig: "Cámara Frig.", presupuesto_libre: "Presupuesto libre" });

  // ── Google Drive state ──
  const [showDrivePanel, setShowDrivePanel] = useState(false);
  const [driveAuth, setDriveAuth] = useState(false);
  const [driveQuotations, setDriveQuotations] = useState([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveSaving, setDriveSaving] = useState(false);
  const [driveError, setDriveError] = useState(null);
  const [driveLastSave, setDriveLastSave] = useState(null);

  useEffect(() => {
    setAuthChangeCallback(setDriveAuth);
    const timer = setTimeout(() => { initGoogleAuth(); setDriveAuth(gdriveIsAuth()); }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleDriveRefresh = useCallback(async () => {
    setDriveLoading(true);
    setDriveError(null);
    try {
      const folders = await listQuotations();
      setDriveQuotations(folders);
    } catch (err) {
      setDriveError(err.message || "Error al cargar cotizaciones");
    } finally {
      setDriveLoading(false);
    }
  }, []);

  const handleDriveSignIn = useCallback(async () => {
    try {
      await gdriveSignIn();
      setDriveAuth(true);
      handleDriveRefresh();
    } catch (err) {
      setDriveError(err.message || "Error al iniciar sesión");
    }
  }, [handleDriveRefresh]);

  const handleDriveSignOut = useCallback(() => {
    gdriveSignOut();
    setDriveAuth(false);
    setDriveQuotations([]);
  }, []);

  const handleDriveSave = useCallback(async () => {
    if (!groups.length) return;
    setDriveSaving(true);
    setDriveError(null);
    setDriveLastSave(null);
    try {
      const dimensions = buildPrintDimensions();
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
        quotationId: currentBudgetCode || undefined,
        showSKU: false,
        showUnitPrices: true,
      });
      const pdfBlob = await htmlToPdfBlob(html);
      const projectData = serializeProject({
        scenario, listaPrecios, proyecto, techo, pared, camara, flete,
        overrides, excludedItems, categoriasActivas, techoAnchoModo,
        quotationCode: currentBudgetCode,
        libreAcc, librePanelLines, librePerfilQty, libreFijQty, libreSellQty, libreExtra, librePerfilFilter,
      });
      const code = currentBudgetCode || `BMC-${new Date().getFullYear()}-TEMP`;
      const result = await saveQuotation({
        quotationCode: code,
        clientName: proyecto.nombre,
        pdfBlob,
        projectData,
      });
      setDriveLastSave(result);
      showToast("Guardado en Google Drive");
      handleDriveRefresh();
    } catch (err) {
      setDriveError(err.message || "Error al guardar en Drive");
    } finally {
      setDriveSaving(false);
    }
  }, [groups, proyecto, scenario, panelInfo, results, grandTotal, listaPrecios, currentBudgetCode, techo, pared, camara, flete, overrides, excludedItems, categoriasActivas, techoAnchoModo, libreAcc, librePanelLines, librePerfilQty, libreFijQty, libreSellQty, libreExtra, librePerfilFilter, showToast, handleDriveRefresh, buildPrintDimensions]);

  const handleDriveLoad = useCallback(async (folderId) => {
    setDriveLoading(true);
    setDriveError(null);
    try {
      const data = await loadProjectFromFolder(folderId);
      if (!data) { setDriveError("No se encontró archivo de proyecto (.bmc.json)"); return; }
      const state = deserializeProject(data);
      setScenario(state.scenario);
      setLP(state.listaPrecios);
      setProyecto(state.proyecto);
      setTecho(state.techo);
      setPared(state.pared);
      setCamara(state.camara);
      setFlete(state.flete);
      setOverrides(state.overrides);
      setExcludedItems(state.excludedItems);
      if (state.categoriasActivas && Object.keys(state.categoriasActivas).length) setCategoriasActivas(state.categoriasActivas);
      if (state.libreAcc) setLibreAcc(state.libreAcc);
      if (state.librePanelLines) setLibrePanelLines(state.librePanelLines);
      if (state.librePerfilQty) setLibrePerfilQty(state.librePerfilQty);
      if (state.libreFijQty) setLibreFijQty(state.libreFijQty);
      if (state.libreSellQty) setLibreSellQty(state.libreSellQty);
      if (state.libreExtra) setLibreExtra(state.libreExtra);
      if (state.librePerfilFilter != null) setLibrePerfilFilter(state.librePerfilFilter);
      if (state.techoAnchoModo) setTechoAnchoModo(state.techoAnchoModo);
      if (state._meta?.quotationCode) setCurrentBudgetCode(state._meta.quotationCode);
      setShowDrivePanel(false);
      showToast("Cotización cargada desde Drive");
    } catch (err) {
      setDriveError(err.message || "Error al cargar cotización");
    } finally {
      setDriveLoading(false);
    }
  }, [showToast]);

  const handleDriveDelete = useCallback(async (folderId) => {
    if (!confirm("¿Eliminar esta cotización de Google Drive?")) return;
    try {
      await deleteQuotation(folderId);
      handleDriveRefresh();
    } catch (err) {
      setDriveError(err.message || "Error al eliminar");
    }
  }, [handleDriveRefresh]);

  // ── Section style (card styling) ──
  const sectionS = { background: C.surface, borderRadius: 16, padding: 24, marginBottom: 16, boxShadow: SHC, overflow: "visible", boxSizing: "border-box", border: `1px solid ${C.border}`, fontFamily: FONT };
  const labelS = { fontSize: 12, fontWeight: 600, color: C.tp, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" };
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
      const snapshot = {
        scenario, listaPrecios, proyecto, techo, pared, camara, flete, overrides, excludedItems, categoriasActivas,
        libreAcc, librePanelLines, librePerfilQty, libreFijQty, libreSellQty, libreExtra, librePerfilFilter,
      };
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
  }, [groups, grandTotal, scenario, listaPrecios, proyecto, panelInfo, techo, pared, camara, flete, overrides, excludedItems, categoriasActivas, libreAcc, librePanelLines, librePerfilQty, libreFijQty, libreSellQty, libreExtra, librePerfilFilter]);

  // ── Manual save ──
  const handleManualSave = useCallback(() => {
    if (!groups.length) return;
    const productoStr = panelInfo.espesor ? `${panelInfo.label} ${panelInfo.espesor}mm` : panelInfo.label;
    const snapshot = {
      scenario, listaPrecios, proyecto, techo, pared, camara, flete, overrides, excludedItems, categoriasActivas,
      libreAcc, librePanelLines, librePerfilQty, libreFijQty, libreSellQty, libreExtra, librePerfilFilter,
    };
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
  }, [groups, grandTotal, scenario, listaPrecios, proyecto, panelInfo, techo, pared, camara, flete, overrides, excludedItems, categoriasActivas, libreAcc, librePanelLines, librePerfilQty, libreFijQty, libreSellQty, libreExtra, librePerfilFilter, showToast]);

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
    if (s.libreAcc) setLibreAcc(s.libreAcc);
    if (s.librePanelLines) setLibrePanelLines(s.librePanelLines);
    if (s.librePerfilQty) setLibrePerfilQty(s.librePerfilQty);
    if (s.libreFijQty) setLibreFijQty(s.libreFijQty);
    if (s.libreSellQty) setLibreSellQty(s.libreSellQty);
    if (s.libreExtra) setLibreExtra(s.libreExtra);
    if (s.librePerfilFilter != null) setLibrePerfilFilter(s.librePerfilFilter);
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
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "rgba(255,255,255,0.1)", borderRadius: 8 }}>
            <button onClick={() => { setModoVendedor(true); setTecho(TECHO_INITIAL_VENDEDOR); setWizardStep(0); setLP(""); }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: modoVendedor ? "rgba(255,255,255,0.25)" : "transparent", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: modoVendedor ? 600 : 400 }}>Vendedor</button>
            <button onClick={() => { setModoVendedor(false); if (!listaPrecios) setLP(getListaDefault()); }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: !modoVendedor ? "rgba(255,255,255,0.25)" : "transparent", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: !modoVendedor ? 600 : 400 }}>Cliente</button>
          </div>
          <button onClick={() => setShowConfigPanel(true)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <Settings size={14} />Config
          </button>
          <button onClick={() => { setShowDrivePanel(true); if (driveAuth) handleDriveRefresh(); }} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: driveAuth ? "rgba(66,133,244,0.25)" : "transparent", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: TR }}>
            <Cloud size={14} />Drive
          </button>
          <button onClick={() => { setShowLogPanel(true); fetchGptQuotations(); }} style={{ position: "relative", padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <Archive size={14} />Presupuestos
            {(logEntries.length + gptQuotations.length) > 0 && (
              <span style={{ position: "absolute", top: -6, right: -6, background: C.primary, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 10, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", ...TN }}>{logEntries.length + gptQuotations.length}</span>
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
        {/* LEFT PANEL — Wizard (Modo Vendedor) o formulario completo (Modo Cliente) */}
        <div className="bmc-left-panel" style={{ overflowY: "auto", paddingLeft: 12, paddingRight: 12 }}>
          {modoVendedor && scenario === "solo_techo" ? (
            /* ── WIZARD: una variable a la vez ── */
            (() => {
              const step = WIZARD_STEPS_SOLO_TECHO[wizardStep];
              const stepId = step?.id;
              const isValid = stepId && isWizardStepValid(stepId);
              const canPrev = wizardStep > 0;
              const canNext = wizardStep < WIZARD_STEPS_SOLO_TECHO.length - 1;
              const uT = (k, v) => setTecho(t => ({ ...t, [k]: v }));
              const uPr = (k, v) => setProyecto(p => ({ ...p, [k]: v }));
              return (
                <div style={sectionS}>
                  {/* Step indicators */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
                    {WIZARD_STEPS_SOLO_TECHO.map((s, i) => {
                      const isDone = i < wizardStep;
                      const isCurrent = i === wizardStep;
                      return (
                        <div
                          key={s.id}
                          style={{
                            width: isCurrent ? 24 : 8,
                            height: 8,
                            borderRadius: 4,
                            background: isDone ? C.success : isCurrent ? C.primary : C.border,
                            opacity: isDone ? 1 : isCurrent ? 1 : 0.4,
                            transition: "all 150ms ease",
                          }}
                          title={s.label}
                        />
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Paso {wizardStep + 1} de {WIZARD_STEPS_SOLO_TECHO.length}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.tp, marginBottom: 20, overflow: "visible", minWidth: 0 }}>{step?.label}</div>
                  {stepId === "escenario" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {SCENARIOS_DEF.map(sc => (
                        <div key={sc.id} onClick={() => setScenario(sc.id)} style={{ borderRadius: 16, padding: 16, cursor: "pointer", border: `2px solid ${scenario === sc.id ? C.primary : C.border}`, background: scenario === sc.id ? C.primarySoft : C.surface, transition: TR, boxShadow: scenario === sc.id ? `0 0 0 4px ${C.primarySoft}` : SHC }}>
                          <span style={{ fontSize: 28, display: "block", marginBottom: 6 }}>{sc.icon}</span>
                          <div style={{ fontSize: 14, fontWeight: 600, color: scenario === sc.id ? C.primary : C.tp }}>{sc.label}</div>
                          <div style={{ fontSize: 11, color: C.ts, lineHeight: 1.4 }}>{sc.description}</div>
                          {sc.id !== "solo_techo" && <div style={{ fontSize: 10, color: C.tt, marginTop: 6 }}>→ Modo Cliente</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  {stepId === "tipoAguas" && (
                    <TipoAguasSelector value={techo.tipoAguas} onChange={v => {
                      if (v === "dos_aguas") setTecho(t => ({ ...t, tipoAguas: v, borders: { ...t.borders, fondo: "cumbrera" } }));
                      else setTecho(t => ({ ...t, tipoAguas: v, borders: { ...t.borders, fondo: t.borders.fondo === "cumbrera" ? "gotero_lateral" : t.borders.fondo } }));
                    }} />
                  )}
                  {stepId === "lista" && (
                    <SegmentedControl value={listaPrecios} onChange={v => setLP(v)} options={[{ id: "venta", label: "Precio BMC" }, { id: "web", label: "Precio Web" }]} />
                  )}
                  {stepId === "familia" && (
                    <CustomSelect label="Familia panel" value={techo.familia} options={techoFamilyOptions} onChange={setTechoFamilia} />
                  )}
                  {stepId === "espesor" && (
                    <CustomSelect label="Espesor" value={techo.espesor} options={techoEspesorOptions} onChange={v => uT("espesor", v)} showBadge />
                  )}
                  {stepId === "color" && techoPanelData && (
                    <ColorChips colors={techoPanelData.col} value={techo.color} onChange={c => uT("color", c)} notes={techoPanelData.colNotes || {}} />
                  )}
                  {stepId === "dimensiones" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.tp, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Unidad de medida</div>
                        <SegmentedControl value={techoAnchoModo || "metros"} onChange={v => setTechoAnchoModo(v)} options={[{ id: "metros", label: "Metros (largo × ancho)" }, { id: "paneles", label: "Paneles (cantidad)" }]} />
                      </div>
                      {techoAnchoModo === "paneles" && techoPanelData && (
                        <div
                          style={{
                            fontSize: 12,
                            color: C.ts,
                            lineHeight: 1.5,
                            padding: "12px 14px",
                            background: C.surface,
                            borderRadius: 10,
                            border: `1px solid ${C.border}`,
                          }}
                        >
                          <span style={{ fontWeight: 700, color: C.tp }}>Paneles (ancho):</span>{" "}
                          el ancho en planta se calcula como{" "}
                          <strong style={{ color: C.primary }}>cantidad × {Number(techoPanelData.au ?? 1.12).toFixed(2)} m</strong>{" "}
                          (ancho útil del panel según familia/espesor).
                          {techo.tipoAguas === "dos_aguas" ? (
                            <> En <strong>dos aguas</strong>, el ancho total de zona reparte el techo en dos faldones en la vista previa.</>
                          ) : null}
                        </div>
                      )}
                      <RoofPreview
                        zonas={techo.zonas || []}
                        tipoAguas={techo.tipoAguas}
                        pendiente={techo.pendiente}
                        panelAu={techoPanelData?.au ?? 1.12}
                        onZonaPreviewChange={updateZonaPreview}
                        onResetLayout={resetRoofPreviewLayout}
                      />
                      {(techo.zonas?.length ? techo.zonas : [{ largo: 0, ancho: 0 }]).map((zona, idx) => (
                        <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 14, padding: 16, background: C.surfaceAlt, borderRadius: 12, border: `1.5px solid ${C.border}` }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: C.tp }}>Zona {idx + 1}</span>
                            {(techo.zonas?.length || 1) > 1 && (
                              <button onClick={() => removeZona(idx)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: C.dangerSoft, color: C.danger, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><X size={14} />Quitar</button>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
                            <StepperInput label="Largo (m)" value={zona.largo ?? 0} onChange={v => updateZona(idx, "largo", v)} min={0} max={20} step={0.5} unit="m" />
                            {techoAnchoModo === "paneles" && techoPanelData ? (
                              <StepperInput label="Paneles (ancho)" value={techoPanelesDesdeAnchoM(zona.ancho ?? 0, techoPanelData, techo.tipoAguas)} onChange={v => updateZona(idx, "ancho", techoAnchoMDesdePaneles(v, techoPanelData, techo.tipoAguas))} min={1} max={99} step={1} unit="pan." decimals={0} />
                            ) : (
                              <StepperInput label="Ancho (m)" value={zona.ancho ?? 0} onChange={v => updateZona(idx, "ancho", v)} min={0} max={20} step={0.5} unit="m" />
                            )}
                          </div>
                        </div>
                      ))}
                      <button onClick={addZona} style={{ padding: "12px 20px", borderRadius: 12, border: `2px dashed ${C.border}`, background: C.surface, color: C.primary, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: TR }}><Plus size={18} />Agregar zona</button>
                    </div>
                  )}
                  {stepId === "pendiente" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Modo de cálculo del largo</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {PENDIENTE_MODOS.map(m => (
                            <button key={m.id} onClick={() => uT("pendienteModo", m.id)} style={{ padding: 12, borderRadius: 12, border: `2px solid ${techo.pendienteModo === m.id ? C.primary : C.border}`, background: techo.pendienteModo === m.id ? C.primarySoft : C.surface, textAlign: "left", cursor: "pointer", transition: TR }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: techo.pendienteModo === m.id ? C.primary : C.tp }}>{m.label}</div>
                              <div style={{ fontSize: 11, color: C.ts, marginTop: 2 }}>{m.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                      {techo.pendienteModo === "calcular_pendiente" && (
                        <>
                          <StepperInput label="Pendiente" value={techo.pendiente} onChange={v => uT("pendiente", v)} min={0} max={45} step={1} unit="°" decimals={0} />
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {PENDIENTES_PRESET.map(pr => (
                              <button key={pr.valor} onClick={() => uT("pendiente", pr.valor)} style={{ padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${techo.pendiente === pr.valor ? C.primary : C.border}`, background: techo.pendiente === pr.valor ? C.primarySoft : C.surface, fontSize: 12, cursor: "pointer", color: C.tp }}>{pr.label}</button>
                            ))}
                          </div>
                        </>
                      )}
                      {techo.pendienteModo === "calcular_altura" && (
                        <StepperInput label="Diferencia de altura (apoyo sup. − inf.)" value={techo.alturaDif ?? 0} onChange={v => uT("alturaDif", v)} min={0} max={10} step={0.1} unit="m" />
                      )}
                    </div>
                  )}
                  {stepId === "estructura" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <SegmentedControl value={techo.tipoEst} onChange={v => uT("tipoEst", v)} options={ESTRUCTURA_OPTIONS} />
                      {techo.tipoEst === "combinada" && (
                        <div style={{ padding: 12, background: C.surfaceAlt, borderRadius: 10, border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Cantidad de fijaciones por tipo</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <StepperInput label="Fijaciones en Hormigón" value={techo.ptsHorm ?? 0} onChange={v => uT("ptsHorm", v)} min={0} max={9999} step={1} unit="unid" decimals={0} />
                            <StepperInput label="Fijaciones a Metal" value={techo.ptsMetal ?? 0} onChange={v => uT("ptsMetal", v)} min={0} max={9999} step={1} unit="unid" decimals={0} />
                            <StepperInput label="Fijaciones a Madera" value={techo.ptsMadera ?? 0} onChange={v => uT("ptsMadera", v)} min={0} max={9999} step={1} unit="unid" decimals={0} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {stepId === "bordes" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: C.tp }}>Accesorios perimetrales</span>
                        <Toggle label={techo.inclAccesorios !== false ? "Desactivar" : "Activar"} value={techo.inclAccesorios !== false} onChange={v => setTecho(t => ({ ...t, inclAccesorios: v }))} />
                      </div>
                      {techo.inclAccesorios !== false ? (
                        <RoofBorderSelector
                          borders={techo.borders}
                          onChange={(side, val) => setTecho(t => ({ ...t, borders: { ...t.borders, [side]: val } }))}
                          panelFamilia={techo.familia}
                          disabledSides={techo.tipoAguas === "dos_aguas" ? ["fondo"] : []}
                          zonas={techo.zonas}
                          tipoAguas={techo.tipoAguas}
                        />
                      ) : (
                        <div style={{ padding: 16, background: C.surfaceAlt, borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, color: C.ts }}>Sin accesorios perimetrales. Activar para configurar goteros, babetas, canalón, etc.</div>
                      )}
                    </div>
                  )}
                  {stepId === "selladores" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <Toggle label="¿Consideramos selladores?" value={techo.opciones?.inclSell !== false} onChange={v => setTecho(t => ({ ...t, opciones: { ...t.opciones, inclSell: v } }))} />
                      <Toggle
                        label="BOM comercial ISODEC PIR (2 goteros + 6 babetas + kit selladores + 22 pts fijación)"
                        value={techo.opciones?.bomComercial === true}
                        onChange={v => setTecho(t => ({ ...t, opciones: { ...t.opciones, bomComercial: v } }))}
                        disabled={techo.familia !== "ISODEC_PIR" || techo.tipoAguas === "dos_aguas"}
                      />
                      {(techo.familia !== "ISODEC_PIR" || techo.tipoAguas === "dos_aguas") && (
                        <div style={{ fontSize: 11, color: C.ts, opacity: 0.85 }}>Solo familia ISODEC PIR y techo una agua. En dos aguas el kit se duplicaría por faldón.</div>
                      )}
                      <div style={{ fontSize: 12, color: C.ts, lineHeight: 1.5, padding: 12, background: C.surfaceAlt, borderRadius: 10, border: `1px solid ${C.border}` }}>
                        <div style={{ fontWeight: 600, color: C.tp, marginBottom: 6 }}>Uso de selladores</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          <li>Barrera de condensación entre juntas longitudinales de paneles</li>
                          <li>Solapes: 2 cordones de silicona × ancho útil × paneles solapados</li>
                          <li>Encuentros con muros (babetas): ml de encuentro × 2 (panel–babeta y babeta–muro)</li>
                          <li>Canalones: 2 cordones entre empalmes (~60 cm por extensión)</li>
                        </ul>
                      </div>
                    </div>
                  )}
                  {stepId === "flete" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <StepperInput label="Flete (USD)" value={flete} onChange={v => setFlete(v)} min={0} max={2000} step={50} unit="USD" decimals={0} />
                      <div>
                        <div style={labelS}>Costo interno flete (USD s/IVA, opcional)</div>
                        <input style={inputS} value={fleteCosto} onChange={e => setFleteCosto(e.target.value)} placeholder="—" inputMode="decimal" />
                      </div>
                    </div>
                  )}
                  {stepId === "proyecto" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div><div style={labelS}>Nombre</div><input style={inputS} value={proyecto.nombre} onChange={e => uPr("nombre", e.target.value)} placeholder="Obligatorio" /></div>
                      <div><div style={labelS}>Teléfono</div><input style={inputS} value={proyecto.telefono} onChange={e => uPr("telefono", e.target.value)} placeholder="Obligatorio" /></div>
                      <div><div style={labelS}>Dirección</div><input style={inputS} value={proyecto.direccion} onChange={e => uPr("direccion", e.target.value)} /></div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 12, marginTop: 28, paddingTop: 20, borderTop: `1.5px solid ${C.border}` }}>
                    {canPrev && (
                      <button type="button" onClick={() => setWizardStep(s => s - 1)} style={{ padding: "12px 24px", borderRadius: 12, border: `2px solid ${C.border}`, background: C.surface, fontSize: 15, fontWeight: 600, cursor: "pointer", color: C.tp }}>
                        Anterior
                      </button>
                    )}
                    <div style={{ flex: 1 }} />
                    {canNext ? (
                      <button type="button" onClick={() => isValid && setWizardStep(s => s + 1)} disabled={!isValid} style={wizardPrimaryActionStyle(isValid)}>
                        Siguiente
                      </button>
                    ) : (
                      <span style={{ fontSize: 14, color: C.success, fontWeight: 700 }}>✓ Cotización lista</span>
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            <>
          {/* Lista precios + Escenario (Modo Cliente) */}
          <div style={sectionS}>
            <div style={labelS}>LISTA DE PRECIOS</div>
            <SegmentedControl value={listaPrecios || "web"} onChange={v => setLP(v)} options={[{ id: "venta", label: "Precio BMC" }, { id: "web", label: "Precio Web" }]} />
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
              <TipoAguasSelector value={techo.tipoAguas || "una_agua"} onChange={v => {
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

          {scenarioDef?.isLibre && (
          <div style={sectionS}>
            <div style={labelS}>PRESUPUESTO LIBRE — CATÁLOGO POR CATEGORÍA</div>
            <div style={{ fontSize: 12, color: C.ts, marginBottom: 14, lineHeight: 1.5 }}>Desplegá cada categoría y cargá cantidades. Precio, unidades y cantidad en <b>Extraordinarios</b> son opcionales.</div>

            <LibreAccordionBar title="Paneles" open={libreAcc.paneles} onToggle={() => toggleLibreAcc("paneles")}>
              {librePanelLines.map((line, idx) => {
                const pt = libreCatalog?.PANELS_TECHO || PANELS_TECHO;
                const pp = libreCatalog?.PANELS_PARED || PANELS_PARED;
                const all = { ...pt, ...pp };
                const pd = line.familia ? all[line.familia] : null;
                const espOpts = pd ? Object.keys(pd.esp).map((e) => ({ value: Number(e), label: `${e} mm`, badge: pd.esp[e].ap ? `AP ${pd.esp[e].ap}m` : undefined })) : [];
                return (
                  <div key={idx} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: idx < librePanelLines.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <CustomSelect label="Familia" value={line.familia} options={libreFamiliaOpts} onChange={(v) => {
                      const pan = all[v];
                      const fe = pan ? Number(Object.keys(pan.esp)[0]) : "";
                      const col0 = pan?.col?.[0] || "Blanco";
                      updateLibrePanelLine(idx, { familia: v, espesor: fe, color: col0 });
                    }} />
                    {pd && <>
                      <div style={{ marginTop: 12 }}>
                        <CustomSelect label="Espesor" value={line.espesor} options={espOpts} onChange={(ev) => updateLibrePanelLine(idx, { espesor: ev })} showBadge />
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <div style={labelS}>Color</div>
                        <ColorChips colors={pd.col} value={line.color} onChange={(c) => updateLibrePanelLine(idx, { color: c })} notes={pd.colNotes || {}} />
                      </div>
                    </>}
                    <div style={{ marginTop: 12 }}>
                      <StepperInput label="M² a cotizar" value={line.m2} onChange={(v) => updateLibrePanelLine(idx, { m2: v })} min={0} max={999999} step={1} unit="m²" />
                    </div>
                    {librePanelLines.length > 1 && (
                      <button type="button" onClick={() => removeLibrePanelLine(idx)} style={{ marginTop: 10, padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surfaceAlt, fontSize: 12, cursor: "pointer", color: C.danger }}>Quitar línea</button>
                    )}
                  </div>
                );
              })}
              <button type="button" onClick={addLibrePanelLine} style={{ marginTop: 4, padding: "8px 16px", borderRadius: 10, border: `1.5px dashed ${C.border}`, background: C.surface, fontSize: 13, cursor: "pointer", color: C.primary, fontWeight: 500 }}>+ Agregar panel</button>
            </LibreAccordionBar>

            <LibreAccordionBar title="Perfilería" open={libreAcc.perfileria} onToggle={() => toggleLibreAcc("perfileria")}>
              <input style={{ ...inputS, marginBottom: 12 }} value={librePerfilFilter} onChange={(e) => setLibrePerfilFilter(e.target.value)} placeholder="Filtrar por nombre o SKU…" />
              <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                {librePerfilFiltered.map((row) => (
                  <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: 8, borderRadius: 10, background: C.surfaceAlt }}>
                    <span style={{ flex: "1 1 200px", fontSize: 12, color: C.tp }}>{row.label}</span>
                    <StepperInput label="Cant. barras" value={librePerfilQty[row.id] || 0} onChange={(v) => setLibrePerfilQty((q) => ({ ...q, [row.id]: v }))} min={0} max={9999} step={1} decimals={0} />
                  </div>
                ))}
              </div>
            </LibreAccordionBar>

            <LibreAccordionBar title="Tornillería y herrajes" open={libreAcc.tornilleria} onToggle={() => toggleLibreAcc("tornilleria")}>
              <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                {libreTornilleriaKeys.map((key) => {
                  const F = libreCatalog?.FIJACIONES || FIJACIONES;
                  const H = libreCatalog?.HERRAMIENTAS || HERRAMIENTAS;
                  const row = F[key] || H[key];
                  if (!row) return null;
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: 8, borderRadius: 10, background: C.surfaceAlt }}>
                      <span style={{ flex: "1 1 180px", fontSize: 12, color: C.tp }}>{row.label}</span>
                      <span style={{ fontSize: 11, color: C.tt }}>{row.unidad || "unid"}</span>
                      <StepperInput label="Cant." value={libreFijQty[key] || 0} onChange={(v) => setLibreFijQty((q) => ({ ...q, [key]: v }))} min={0} max={999999} step={1} decimals={0} />
                    </div>
                  );
                })}
              </div>
            </LibreAccordionBar>

            <LibreAccordionBar title="Selladores" open={libreAcc.selladores} onToggle={() => toggleLibreAcc("selladores")}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {libreSelladorKeys.map((key) => {
                  const S = libreCatalog?.SELLADORES || SELLADORES;
                  const s = S[key];
                  if (!s) return null;
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: 8, borderRadius: 10, background: C.surfaceAlt }}>
                      <span style={{ flex: "1 1 180px", fontSize: 12, color: C.tp }}>{s.label}</span>
                      <span style={{ fontSize: 11, color: C.tt }}>{s.unidad || "unid"}</span>
                      <StepperInput label="Cant." value={libreSellQty[key] || 0} onChange={(v) => setLibreSellQty((q) => ({ ...q, [key]: v }))} min={0} max={999999} step={1} decimals={0} />
                    </div>
                  );
                })}
              </div>
            </LibreAccordionBar>

            <LibreAccordionBar title="Servicios" open={libreAcc.servicios} onToggle={() => toggleLibreAcc("servicios")}>
              <StepperInput label="Flete (USD s/IVA)" value={flete} onChange={setFlete} min={0} max={2000} step={10} unit="USD" decimals={0} />
              <div style={{ fontSize: 12, color: C.ts, marginTop: 8 }}>Se suma al presupuesto como servicio con el importe indicado.</div>
              <div style={{ marginTop: 8 }}>
                <div style={labelS}>Costo interno flete (USD s/IVA, opcional)</div>
                <input style={inputS} value={fleteCosto} onChange={e => setFleteCosto(e.target.value)} placeholder="—" inputMode="decimal" />
              </div>
            </LibreAccordionBar>

            <LibreAccordionBar title="Extraordinarios" open={libreAcc.extraordinarios} onToggle={() => toggleLibreAcc("extraordinarios")}>
              <div style={{ marginBottom: 10 }}><div style={labelS}>Descripción / texto libre</div>
                <textarea value={libreExtra.texto} onChange={(e) => setLibreExtra((x) => ({ ...x, texto: e.target.value }))} rows={4} placeholder="Escribí la partida…" style={{ ...inputS, resize: "vertical", minHeight: 88 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div><div style={labelS}>Precio (USD s/IVA, opcional)</div><input style={inputS} value={libreExtra.precio} onChange={(e) => setLibreExtra((x) => ({ ...x, precio: e.target.value }))} placeholder="—" inputMode="decimal" /></div>
                <div><div style={labelS}>Unidades (opcional)</div><input style={inputS} value={libreExtra.unidades} onChange={(e) => setLibreExtra((x) => ({ ...x, unidades: e.target.value }))} placeholder="ej. unid, m²" /></div>
                <div><div style={labelS}>Cantidad (opcional)</div><input style={inputS} value={libreExtra.cantidad} onChange={(e) => setLibreExtra((x) => ({ ...x, cantidad: e.target.value }))} placeholder="—" inputMode="decimal" /></div>
              </div>
            </LibreAccordionBar>
          </div>
          )}

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

          {/* Diseño por plano (solo Techo + Fachada) */}
          {scenario === "techo_fachada" && (
            <div style={sectionS}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={labelS}>MODO DE DIMENSIONES</div>
                <button
                  onClick={() => setUsePlanoTechoFachada((v) => !v)}
                  style={{
                    padding: "6px 14px", borderRadius: 10, border: `1.5px solid ${usePlanoTechoFachada ? C.primary : C.border}`,
                    background: usePlanoTechoFachada ? C.primarySoft : C.surface, color: usePlanoTechoFachada ? C.primary : C.tp,
                    fontSize: 13, fontWeight: 600, cursor: "pointer", transition: TR,
                  }}
                >
                  {usePlanoTechoFachada ? "📐 Plano activo" : "📐 Usar diseño por plano"}
                </button>
              </div>
              {usePlanoTechoFachada && (
                <FloorPlanEditor
                  value={{
                    largo: techo.zonas?.[0]?.largo ?? 6,
                    ancho: techo.zonas?.[0]?.ancho ?? 5,
                    alto: pared.alto ?? 3.5,
                  }}
                  onChange={(plano) => {
                    const l = plano.largo ?? 6;
                    const a = plano.ancho ?? 5;
                    const h = plano.alto ?? 3.5;
                    setTecho((t) => ({ ...t, zonas: [{ largo: l, ancho: a }] }));
                    setPared((p) => ({ ...p, perimetro: 2 * (l + a), alto: h }));
                  }}
                  labelS={labelS}
                />
              )}
            </div>
          )}

          {/* Dimensiones Techo — Zonas múltiples */}
          {vis.largoAncho && !(scenario === "techo_fachada" && usePlanoTechoFachada) && (() => {
            const fp = calcFactorPendiente(techo.pendiente);
            const pm = techo.pendienteModo || "calcular_pendiente";
            const is2A = techo.tipoAguas === "dos_aguas";
            const baseArea = zonasTotales.area;
            const areaReal = techo.zonas?.reduce((s, z) => {
              const lr = calcLargoRealFromModo(z.largo, pm, techo.pendiente, z.alturaDif ?? techo.alturaDif ?? 0);
              return s + (lr * (is2A ? z.ancho / 2 : z.ancho));
            }, 0);
            const areaRealDisplay = areaReal != null && areaReal !== baseArea ? +areaReal.toFixed(1) : null;
            return <div ref={dimensionesRef} style={sectionS}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12, minWidth: 0 }}>
              <div style={{ ...labelS, flexShrink: 0, minWidth: 0 }}>DIMENSIONES TECHO {is2A && <span style={{ fontWeight: 400, textTransform: "none" }}>· 2 faldones</span>}</div>
              <div style={{ fontSize: 12, color: C.ts, fontWeight: 500, ...TN }}>
                {areaRealDisplay != null
                  ? <>{baseArea}m² proy. <span style={{ color: C.primary, fontWeight: 600 }}>→ {areaRealDisplay}m² real</span></>
                  : <>{baseArea}m² total</>
                }
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.ts, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                COTIZAR ANCHO EN{" "}
                {techoPanelData?.au && (
                  <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
                    · AU {techoPanelData.au}m{is2A ? " · paneles por faldón" : ""}
                  </span>
                )}
              </div>
              <SegmentedControl
                value={techoAnchoModo}
                onChange={(modo) => {
                  if (modo === "paneles" && !techoPanelData) return;
                  setTechoAnchoModo(modo);
                  if (modo === "paneles" && techoPanelData) {
                    setTecho(prev => ({
                      ...prev,
                      zonas: prev.zonas.map(z => ({ ...z, ancho: normalizeTechoAnchoToPaneles(z.ancho, techoPanelData, prev.tipoAguas) })),
                    }));
                  }
                }}
                options={[
                  { id: "metros", label: "Metros" },
                  { id: "paneles", label: "Paneles" },
                ]}
                disabledIds={!techoPanelData ? ["paneles"] : []}
              />
            </div>
            {techo.zonas.map((zona, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 10, padding: 12, borderRadius: 10, background: C.surfaceAlt }}>
                <div style={{ flex: 1 }}>
                  <StepperInput label={`Largo ${techo.zonas.length > 1 ? idx + 1 : ""} (m)`} value={zona.largo} onChange={v => updateZona(idx, "largo", v)} min={1} max={20} step={0.5} unit="m" />
                </div>
                <div style={{ flex: 1 }}>
                  {techoAnchoModo === "paneles" && techoPanelData ? (
                    <StepperInput
                      label={`Ancho ${techo.zonas.length > 1 ? idx + 1 : ""} (${is2A ? "paneles/faldón" : "paneles"})`}
                      value={techoPanelesDesdeAnchoM(zona.ancho, techoPanelData, techo.tipoAguas)}
                      onChange={v => updateZona(idx, "ancho", techoAnchoMDesdePaneles(v, techoPanelData, techo.tipoAguas))}
                      min={1}
                      max={500}
                      step={1}
                      unit={is2A ? "pzas/faldón" : "pzas"}
                      decimals={0}
                    />
                  ) : (
                    <StepperInput
                      label={`Ancho ${techo.zonas.length > 1 ? idx + 1 : ""} (m)`}
                      value={zona.ancho}
                      onChange={v => updateZona(idx, "ancho", v)}
                      min={1}
                      max={20}
                      step={0.5}
                      unit="m"
                    />
                  )}
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
              <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Modo de cálculo del largo</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                {PENDIENTE_MODOS.map(m => (
                  <button key={m.id} onClick={() => uT("pendienteModo", m.id)} style={{ padding: 10, borderRadius: 10, border: `2px solid ${(techo.pendienteModo || "calcular_pendiente") === m.id ? C.primary : C.border}`, background: (techo.pendienteModo || "calcular_pendiente") === m.id ? C.primarySoft : C.surface, textAlign: "left", cursor: "pointer", transition: TR }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: (techo.pendienteModo || "calcular_pendiente") === m.id ? C.primary : C.tp }}>{m.label}</span>
                    <span style={{ display: "block", fontSize: 10, color: C.ts, marginTop: 2 }}>{m.desc}</span>
                  </button>
                ))}
              </div>
              {(techo.pendienteModo || "calcular_pendiente") === "calcular_pendiente" && (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 8 }}>
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
              )}
              {(techo.pendienteModo || "calcular_pendiente") === "calcular_altura" && (
                <div style={{ marginBottom: 8 }}>
                  <StepperInput label="Diferencia de altura (apoyo sup. − inf.)" value={techo.alturaDif ?? 0} onChange={v => uT("alturaDif", v)} min={0} max={10} step={0.1} unit="m" />
                </div>
              )}
              {((techo.pendienteModo || "calcular_pendiente") === "calcular_pendiente" && techo.pendiente > 0) || ((techo.pendienteModo || "calcular_pendiente") === "calcular_altura" && (techo.alturaDif ?? 0) > 0) ? (
                <div style={{ marginTop: 8, fontSize: 11, color: C.ts, display: "flex", gap: 16, flexWrap: "wrap", ...TN }}>
                  {(techo.pendienteModo || "calcular_pendiente") === "calcular_pendiente" && techo.pendiente > 0 && (
                    <>
                      <span>Factor: <b style={{ color: C.tp }}>×{fp.toFixed(4)}</b></span>
                      <span>Incremento: <b style={{ color: C.primary }}>+{((fp - 1) * 100).toFixed(1)}%</b></span>
                    </>
                  )}
                  {techo.zonas?.[0] && (
                    <span>Largo real zona 1: <b style={{ color: C.tp }}>{calcLargoRealFromModo(techo.zonas[0].largo, techo.pendienteModo || "calcular_pendiente", techo.pendiente, techo.zonas[0].alturaDif ?? techo.alturaDif ?? 0).toFixed(2)}m</b> (de {techo.zonas[0].largo}m proy.)</span>
                  )}
                </div>
              ) : null}
            </div>

            {techoPanelData && techo.zonas?.some(z => {
              const pm = techo.pendienteModo || "calcular_pendiente";
              const lr = calcLargoRealFromModo(z.largo, pm, techo.pendiente, z.alturaDif ?? techo.alturaDif ?? 0);
              return lr < techoPanelData.lmin || lr > techoPanelData.lmax;
            }) && (
              <div style={{ marginTop: 8 }}>
                <AlertBanner
                  type="warning"
                  message={(techo.pendienteModo || "calcular_pendiente") === "calcular_pendiente" && techo.pendiente > 0
                    ? `Algún largo real (con pendiente ${techo.pendiente}°) está fuera del rango fabricable (${techoPanelData.lmin}m - ${techoPanelData.lmax}m)`
                    : (techo.pendienteModo || "calcular_pendiente") === "calcular_altura"
                    ? `Algún largo real (según altura) está fuera del rango fabricable (${techoPanelData.lmin}m - ${techoPanelData.lmax}m)`
                    : `Algún largo está fuera del rango fabricable (${techoPanelData.lmin}m - ${techoPanelData.lmax}m)`}
                />
              </div>
            )}
          </div>;
          })()}

          {/* Dimensiones Pared */}
          {vis.altoPerim && !(scenario === "techo_fachada" && usePlanoTechoFachada) && <div ref={!vis.largoAncho ? dimensionesRef : null} style={sectionS}>
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

          {/* Accesorios perimetrales / terminaciones */}
          {vis.borders && <div ref={bordesRef} style={sectionS}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={labelS}>ACCESORIOS PERIMETRALES / TERMINACIONES</div>
              <Toggle label={techo.inclAccesorios !== false ? "Desactivar" : "Activar"} value={techo.inclAccesorios !== false} onChange={v => setTecho(t => ({ ...t, inclAccesorios: v }))} />
            </div>
            {techo.inclAccesorios !== false && techo.tipoAguas === "dos_aguas" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", background: C.primarySoft, borderRadius: 10, marginBottom: 12, fontSize: 12, color: C.primary, fontWeight: 500 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 16 }}>⌃</span> 2 Aguas — Cumbrera incluida automáticamente. Configurá los bordes exteriores de cada faldón.</span>
                <span style={{ fontSize: 11, fontWeight: 400, color: C.ts }}>¿La otra agua ya existe o también tenemos que calcularla? En este flujo se calculan ambas aguas del techo.</span>
              </div>
            )}
            {techo.inclAccesorios !== false ? (
              <RoofBorderSelector
                borders={techo.borders}
                onChange={(side, val) => setTecho(t => ({ ...t, borders: { ...t.borders, [side]: val } }))}
                panelFamilia={techo.familia}
                disabledSides={techo.tipoAguas === "dos_aguas" ? ["fondo"] : []}
                zonas={techo.zonas}
                tipoAguas={techo.tipoAguas}
              />
            ) : (
              <div style={{ padding: 16, background: C.surfaceAlt, borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, color: C.ts }}>Sin accesorios perimetrales. Activar para configurar goteros, babetas, canalón, etc.</div>
            )}
          </div>}

          {!scenarioDef?.isLibre && (
          <>
          {/* Estructura */}
          <div style={sectionS}>
            <div style={labelS}>ESTRUCTURA</div>
            <SegmentedControl value={scenarioDef?.hasTecho && !scenarioDef?.hasPared ? techo.tipoEst : pared.tipoEst} onChange={v => { uT("tipoEst", v); uP("tipoEst", v); }} options={ESTRUCTURA_OPTIONS} />
            {scenarioDef?.hasTecho && techo.tipoEst === "combinada" && (
              <div style={{ marginTop: 12, padding: 12, background: C.surfaceAlt, borderRadius: 10, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Cantidad de fijaciones por tipo (techo)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <StepperInput label="Fijaciones en Hormigón" value={techo.ptsHorm ?? 0} onChange={v => uT("ptsHorm", v)} min={0} max={9999} step={1} unit="unid" decimals={0} />
                  <StepperInput label="Fijaciones a Metal" value={techo.ptsMetal ?? 0} onChange={v => uT("ptsMetal", v)} min={0} max={9999} step={1} unit="unid" decimals={0} />
                  <StepperInput label="Fijaciones a Madera" value={techo.ptsMadera ?? 0} onChange={v => uT("ptsMadera", v)} min={0} max={9999} step={1} unit="unid" decimals={0} />
                </div>
              </div>
            )}
          </div>

          {/* Opciones */}
          <div ref={opcionesRef} style={sectionS}>
            <div style={labelS}>OPCIONES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {vis.canalGot && <Toggle label="Gotero superior" value={techo.opciones.inclGotSup} onChange={v => setTecho(t => ({ ...t, opciones: { ...t.opciones, inclGotSup: v } }))} />}
              <Toggle label="Selladores" value={scenarioDef?.hasTecho && !scenarioDef?.hasPared ? techo.opciones.inclSell : pared.inclSell} onChange={v => { setTecho(t => ({ ...t, opciones: { ...t.opciones, inclSell: v } })); uP("inclSell", v); }} />
              {vis.p5852 && <Toggle label="Perfil 5852 aluminio" value={pared.incl5852} onChange={v => uP("incl5852", v)} />}
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                <StepperInput label="Flete (USD s/IVA)" value={flete} onChange={setFlete} min={0} max={2000} step={10} unit="USD" decimals={0} />
                <div>
                  <div style={labelS}>Costo interno flete (USD s/IVA, opcional)</div>
                  <input style={inputS} value={fleteCosto} onChange={e => setFleteCosto(e.target.value)} placeholder="—" inputMode="decimal" />
                </div>
              </div>
            </div>
          </div>
          </>
          )}

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
            </>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="bmc-right-panel" style={{ overflowY: "auto", paddingLeft: 8 }}>
          {/* KPI Row */}
          {results && !results.error && !scenarioDef?.isLibre && <div ref={pdfCaptureSummaryRef} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
            <KPICard label="Área" value={`${kpiArea.toFixed(1)}m²`} borderColor={C.primary} />
            <KPICard label="Paneles" value={kpiPaneles} borderColor={C.success} />
            <KPICard label={vis.autoportancia ? "Apoyos" : "Esquinas"} value={kpiApoyos || "—"} borderColor={C.warning} />
            <KPICard label="Pts fijación" value={kpiFij || "—"} borderColor={C.brand} />
          </div>}

          {/* Descarte informativo */}
          {!scenarioDef?.isLibre && results?.paneles?.descarte && results.paneles.descarte.anchoM > 0 && (
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
          {!results && !scenarioDef?.isLibre && <div style={{ ...sectionS, textAlign: "center", padding: 60 }}>
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
          {groups.length > 0 && <div ref={pdfCaptureTotalsRef} style={{ background: C.dark, borderRadius: 16, padding: 24, color: "#fff", marginBottom: 16 }}>
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
            <div>Fabricación y entrega: 10 a 45 días (depende producción). Seña 60% al confirmar; saldo 40% previo a retiro de fábrica. Validez: 10 días. Precios en USD.</div>
            <div style={{ marginTop: 12, fontWeight: 700, color: C.tp }}>Datos bancarios:</div>
            <div>Metalog SAS · RUT: 120403430012 · BROU Cta. Dólares: 110520638-00002</div>
          </div>}

          {/* Action buttons — desktop only */}
          {groups.length > 0 && <div className="bmc-desktop-actions" style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <button onClick={handleCopyWA} style={{ flex: 1, minWidth: 120, padding: "12px 16px", borderRadius: 12, border: "none", background: "#25D366", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Copy size={16} />WhatsApp</button>
            <button onClick={handlePrint} style={{ flex: 1, minWidth: 100, padding: "12px 16px", borderRadius: 12, border: "none", background: C.primary, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><FileText size={16} />PDF</button>
            <button onClick={handleInternalReport} style={{ flex: 1, minWidth: 100, padding: "12px 16px", borderRadius: 12, border: `1.5px solid ${C.brand}`, background: C.surface, color: C.brand, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><ClipboardList size={16} />Interno</button>
            <button onClick={() => { setShowDrivePanel(true); if (driveAuth) handleDriveRefresh(); }} style={{ flex: 1, minWidth: 100, padding: "12px 16px", borderRadius: 12, border: "none", background: "#4285F4", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Cloud size={16} />Drive</button>
            <button onClick={handleClienteVisual} style={{ flex: 1, minWidth: 120, padding: "12px 16px", borderRadius: 12, border: "none", background: "#0ea5e9", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><LayoutTemplate size={16} />Hoja Cliente</button>
            <button onClick={handleCosteo} style={{ flex: 1, minWidth: 100, padding: "12px 16px", borderRadius: 12, border: "none", background: "#7c3aed", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><CircleDollarSign size={16} />Costeo</button>
            <button onClick={handleCopyTSV} style={{ flex: 1, minWidth: 110, padding: "12px 16px", borderRadius: 12, border: `1.5px solid ${C.border}`, background: C.surface, color: C.tp, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Table size={16} />TSV Sheets</button>
            <button onClick={handlePdfEnriquecido} style={{ flex: 1, minWidth: 100, padding: "12px 16px", borderRadius: 12, border: `1.5px solid ${C.border}`, background: C.surface, color: C.tp, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Download size={16} />PDF+</button>
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
      <InteractionLogPanel
        getSnapshot={() => ({
          scenario,
          listaPrecios,
          proyecto,
          techo,
          pared,
          camara,
          flete,
          overrides,
          excludedItems,
          categoriasActivas,
          techoAnchoModo,
          groupsCount: groups.length,
          grandTotal: grandTotal?.totalFinal,
        })}
      />

      {/* Mobile bottom bar with sticky total */}
      {groups.length > 0 && (
        <MobileBottomBar
          total={grandTotal.totalFinal}
          onPrint={handlePrint}
          onWhatsApp={handleCopyWA}
        />
      )}

      {/* ── PDF Preview Modal ── */}
      {previewHTML && (
        <PDFPreviewModal
          html={previewHTML}
          title={previewTitle}
          onClose={() => setPreviewHTML(null)}
        />
      )}

      {/* ── Google Drive Panel ── */}
      <ConfigPanel
        visible={showConfigPanel}
        onClose={() => setShowConfigPanel(false)}
        onConfigChange={() => setConfigVersion(v => v + 1)}
      />
      <GoogleDrivePanel
        visible={showDrivePanel}
        onClose={() => setShowDrivePanel(false)}
        onSave={handleDriveSave}
        onLoad={handleDriveLoad}
        onDelete={handleDriveDelete}
        isAuthenticated={driveAuth}
        onSignIn={handleDriveSignIn}
        onSignOut={handleDriveSignOut}
        quotations={driveQuotations}
        loading={driveLoading}
        saving={driveSaving}
        error={driveError}
        onRefresh={handleDriveRefresh}
        currentQuotationCode={currentBudgetCode}
        lastSaveResult={driveLastSave}
      />

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

            {/* GPT-generated quotations */}
            {(gptQuotations.length > 0 || gptLoading) && (
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, display: "flex", alignItems: "center", gap: 6 }}>
                    <FileText size={14} />Cotizaciones GPT
                    <span style={{ fontSize: 10, fontWeight: 500, padding: "1px 6px", borderRadius: 8, background: C.primarySoft, color: C.primary }}>{gptQuotations.length}</span>
                  </div>
                  <button onClick={fetchGptQuotations} disabled={gptLoading} style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.ts, fontSize: 10, cursor: gptLoading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                    <RefreshCw size={10} style={gptLoading ? { animation: "spin 1s linear infinite" } : {}} />Actualizar
                  </button>
                </div>
                {gptQuotations.map((q) => (
                  <div key={q.id} style={{ background: C.surface, borderRadius: 10, padding: 12, marginBottom: 8, borderLeft: `4px solid ${C.primary}`, boxShadow: SHC }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.brand, ...TN }}>{q.code || q.id.slice(0, 8)}</div>
                        <div style={{ fontSize: 11, color: C.ts }}>{q.client}</div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: C.tp, ...TN }}>${fmtPrice(q.total)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: C.primarySoft, color: C.primary, fontWeight: 500 }}>{q.scenario}</span>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: C.surfaceAlt, color: C.ts }}>{q.lista === "venta" ? "BMC" : "Web"}</span>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: C.surfaceAlt, color: C.tt }}>{new Date(q.timestamp).toLocaleString("es-UY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <a href={q.pdfUrl} target="_blank" rel="noopener noreferrer" style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      width: "100%", padding: "7px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: "none", background: C.primary, color: "#fff", cursor: "pointer", textDecoration: "none",
                    }}>
                      <FileText size={13} />Ver PDF
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* Log entries list */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {logEntries.length === 0 && gptQuotations.length === 0 && (
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
