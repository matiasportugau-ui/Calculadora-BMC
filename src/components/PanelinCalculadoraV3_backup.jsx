// ═══════════════════════════════════════════════════════════════════════════
// src/components/PanelinCalculadoraV3.jsx — React UI component
// BMC Uruguay · Calculadora de Cotización (semver UI: ../appSemver.js)
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  ChevronDown, ChevronUp, Printer, Trash2, Copy, Check,
  AlertTriangle, CheckCircle, Info, Minus, Plus, FileText,
  RotateCcw, Edit3, X, RefreshCw, ClipboardList,
  Download, Save, Archive, Cloud, Settings,
  Table, LayoutTemplate, CircleDollarSign
} from "lucide-react";

import { PANELIN_VERSION_BADGE } from "../appSemver.js";
import CollapsibleHint from "./CollapsibleHint.jsx";
import {
  C, FONT, SHC, SHI, TR, TN, COLOR_HEX,
  setListaPrecios,
  PANELS_TECHO, PANELS_PARED, SERVICIOS,
  FIJACIONES, HERRAMIENTAS, SELLADORES,
  PERFIL_TECHO, PERFIL_PARED,
  SCENARIOS_DEF, OBRA_PRESETS, BORDER_OPTIONS,
  CATEGORIAS_BOM, CATEGORIA_TO_GROUPS,
  PENDIENTES_PRESET, TIPO_AGUAS,
  ROOF_2D_QUOTE_VISOR_STEP_IDS,
} from "../data/constants.js";
import { getPricing } from "../data/pricing.js";
import { flattenPerfilesLibre, computePresupuestoLibreCatalogo } from "../utils/presupuestoLibreCatalogo.js";
import {
  calcTotalesSinIVA,
  calcFactorPendiente, calcLargoRealFromModo, normalizarMedida,
  computeRoofEstructuraHintsByGi,
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
import { executeScenario } from "../utils/scenarioOrchestrator.js";
import { countPtsFromApoyoMateriales, buildDefaultApoyoMateriales, cycleCombinadaMaterial, COMBINADA_MATERIAL_ORDER } from "../utils/combinadaFijacionShared.js";
import { buildCostingReport } from "../utils/bomCosting.js";
import { capturePdfSnapshotTargets } from "../utils/captureDomToPng.js";
import {
  generateClientVisualHTML, generateCosteoHTML, openPrintWindow,
  buildPdfAppendixPayload,
} from "../utils/quotationViews.js";
import { buildGoogleSheetReportTsv } from "../utils/sheetExport.js";
import {
  getSharedSidesPerZona,
  layoutZonasEnPlanta,
  findEncounters,
  ROOF_PLAN_GAP_M,
} from "../utils/roofPlanGeometry.js";
import {
  formatZonaDisplayTitle,
  getLateralAnnexRootBodyGi,
  getRootZoneOrdinal,
  isLateralAnnexZona,
  LATERAL_ANNEX_SNAP_M,
  snapLateralAnnexPlanta,
  zonasToPlantRectsWithAutoGap,
} from "../utils/roofLateralAnnexLayout.js";
import { buildZoneLayoutsForRoof3d } from "../utils/roofZoneLayouts3d.js";
import {
  normalizeEncounter,
  resolveNeighborSharedSide,
  encounterEsContinuo,
  encounterBorderPerfil,
} from "../utils/roofEncounterModel.js";
import { nextRoofSlopeMark } from "../utils/roofSlopeMark.js";
import { Canvas, useThree } from "@react-three/fiber";
import { Line, OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import {
  initGoogleAuth, loadGsiScript, signIn as gdriveSignIn, signOut as gdriveSignOut,
  isAuthenticated as gdriveIsAuth, setAuthChangeCallback,
  saveQuotation, listQuotations, loadProjectFromFolder, deleteQuotation,
} from "../utils/googleDrive.js";
import GoogleDrivePanel from "./GoogleDrivePanel.jsx";
import InteractionLogPanel from "./InteractionLogPanel.jsx";
import ConfigPanel from "./ConfigPanel.jsx";
import FloorPlanEditor from "./FloorPlanEditor.jsx";
import RoofPreview, { RoofPreviewMetricsSidebar } from "./RoofPreview.jsx";

const RoofPanelRealisticScene = lazy(() => import("./RoofPanelRealisticScene.jsx"));
import QuoteVisualVisor from "./QuoteVisualVisor.jsx";
import { wrapSetter } from "../utils/interactionLogger.js";
import { getListaDefault, getFleteDefault } from "../utils/calculatorConfig.js";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import { useChat } from "../hooks/useChat.js";
import PanelinChatPanel from "./PanelinChatPanel.jsx";
import { SLIDES_SOLO_TECHO } from "../data/quoteVisorMedia.js";

// CSS extracted to src/styles/bmc-mobile.css (imported in main.jsx)

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

function CustomSelect({ label, value, options = [], onChange, showBadge, advanceOnChange = false }) {
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
        {options.map(opt => <div key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); if (advanceOnChange) window.setTimeout(() => { window.dispatchEvent(new CustomEvent("bmc-wizard-next")); }, 0); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", cursor: "pointer", fontSize: 14, background: opt.value === value ? C.primarySoft : "transparent", fontWeight: opt.value === value ? 500 : 400, color: C.tp, transition: TR }}>
          <span>{opt.label}</span>{opt.value === value && <Check size={14} color={C.primary} />}
        </div>)}
      </div>}
    </div>
  );
}

function parseNumInput(raw) {
  if (raw == null) return null;
  const t = String(raw).trim().replace(/\s/g, "").replace(",", ".");
  if (t === "" || t === "-" || t === "." || t === "-.") return null;
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : null;
}

function formatNumDisplay(n, decimals) {
  if (!Number.isFinite(n)) return "";
  if (decimals === 0) return String(Math.round(n));
  return n.toFixed(decimals).replace(".", ",");
}

/** ± en ancho (m): 0,1 m por clic. Largo usa `BUMP_STEP_LARGO_M`. */
const BUMP_STEP_METROS = 0.1;
/** ± en largo (m): 1 m por clic (cotización rápida). */
const BUMP_STEP_LARGO_M = 1;

function StepperInput({
  label,
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  bumpStep,
  unit = "",
  decimals = 2,
  chainFocus = false,
  /** Ref al `<input>` interno (p. ej. autofocus al entrar a un paso del asistente). */
  inputRef = null,
}) {
  const [draft, setDraft] = useState(null);
  const skipNextBlurCommitRef = useRef(false);
  const num = Number(value);
  const stepForBump = bumpStep ?? step;

  const commit = (raw) => {
    let p = parseNumInput(raw);
    if (p == null) p = min;
    let x = Math.min(max, Math.max(min, p));
    if (decimals === 0) x = Math.round(x);
    else x = parseFloat(x.toFixed(decimals));
    onChange(x);
  };

  const bump = (dir) => {
    setDraft(null);
    const base = Number.isFinite(num) ? num : min;
    const next = parseFloat((base + dir * stepForBump).toFixed(decimals));
    if (next < min || next > max) return;
    onChange(decimals === 0 ? Math.round(next) : parseFloat(next.toFixed(decimals)));
  };

  const focusNextInGroup = (el) => {
    if (!chainFocus || !el) return;
    const group = el.closest("[data-stepper-group]");
    if (!group) return;
    const inputs = [...group.querySelectorAll("input[data-stepper-chain='1']")];
    const idx = inputs.indexOf(el);
    if (idx < 0 || idx >= inputs.length - 1) return;
    requestAnimationFrame(() => {
      inputs[idx + 1]?.focus?.();
    });
  };

  const btnS = (dis) => ({ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.surface, cursor: dis ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: dis ? 0.4 : 1, transition: TR, flexShrink: 0 });
  const show = draft !== null ? draft : formatNumDisplay(num, decimals);
  const effective = Number.isFinite(num) ? num : min;

  return (
    <div style={{ fontFamily: FONT }}>
      {label && <div style={{ fontSize: 12, fontWeight: 600, color: C.tp, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", flexWrap: "nowrap" }}>
        <button type="button" style={btnS(effective <= min)} onClick={() => bump(-1)}><Minus size={16} color={C.tp} /></button>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          data-stepper-chain={chainFocus ? "1" : undefined}
          value={show}
          onFocus={() => setDraft(formatNumDisplay(num, decimals))}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const raw = draft !== null ? draft : formatNumDisplay(num, decimals);
            skipNextBlurCommitRef.current = true;
            setDraft(null);
            commit(raw);
            focusNextInGroup(e.currentTarget);
          }}
          onBlur={() => {
            if (skipNextBlurCommitRef.current) {
              skipNextBlurCommitRef.current = false;
              setDraft(null);
              return;
            }
            const d = draft;
            setDraft(null);
            commit(d);
          }}
          style={{ width: "100%", minWidth: 0, flex: 1, textAlign: "center", borderRadius: 10, border: `1.5px solid ${C.border}`, padding: "8px 10px", fontSize: 15, fontWeight: 600, background: C.surface, color: C.tp, outline: "none", boxShadow: SHI, transition: TR, fontFamily: FONT, ...TN }}
        />
        <button type="button" style={btnS(effective >= max)} onClick={() => bump(1)}><Plus size={16} color={C.tp} /></button>
        {unit && <span style={{ fontSize: 14, fontWeight: 600, color: C.tp, marginLeft: 4, minWidth: 24 }}>{unit}</span>}
      </div>
    </div>
  );
}

function SegmentedControl({ value, onChange, options = [], disabledIds = [], onOptionDoubleClick }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", background: C.border, borderRadius: 12, padding: 4, gap: 4, fontFamily: FONT, width: "100%" }}>
      {options.map(opt => {
        const isD = disabledIds.includes(opt.id), isA = value === opt.id;
        return <button key={opt.id} onClick={() => !isD && onChange(opt.id)} onDoubleClick={() => !isD && onOptionDoubleClick?.(opt.id)} style={{ flex: "1 1 140px", minWidth: 0, padding: "10px 16px", borderRadius: 10, border: "none", cursor: isD ? "not-allowed" : "pointer", background: isA ? C.surface : "transparent", boxShadow: isA ? "0 2px 6px rgba(0,0,0,0.1)" : "none", fontSize: 14, fontWeight: isA ? 600 : 500, color: isA ? C.tp : C.ts, opacity: isD ? 0.4 : 1, transition: TR, fontFamily: FONT, whiteSpace: "normal" }}>{opt.label}</button>;
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

function ColorChips({ colors = [], value, onChange, notes = {}, onColorDoubleClick, onHover = null }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontFamily: FONT }}>
      {colors.map(color => {
        const isS = value === color, hex = COLOR_HEX[color] || "#999";
        return (
          <button
            key={color}
            onClick={() => onChange(color)}
            onDoubleClick={() => onColorDoubleClick?.(color)}
            onMouseEnter={() => onHover?.(color)}
            onFocus={() => onHover?.(color)}
            onMouseLeave={() => onHover?.("")}
            onBlur={() => onHover?.("")}
            title={notes[color] || color}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 16px 8px 10px", borderRadius: 24,
              border: `2px solid ${isS ? C.primary : C.border}`,
              background: isS ? C.primarySoft : C.surface,
              cursor: "pointer", transition: TR,
              fontSize: 13, fontWeight: isS ? 700 : 500, color: C.tp,
            }}
          >
            <span style={{
              width: 24, height: 24, borderRadius: "50%",
              background: hex, flexShrink: 0,
              border: `2px solid ${isS ? C.primary : color === "Blanco" ? C.border : "transparent"}`,
              boxShadow: isS ? `0 0 0 2px ${C.primarySoft}` : "0 1px 3px rgba(0,0,0,0.12)",
              transition: TR,
            }} />
            {color}
          </button>
        );
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
      {!collapsed && <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: cols, minWidth: 860, background: C.brand, color: "#fff", padding: "10px 12px", boxShadow: "0 2px 4px rgba(0,0,0,0.06)" }}>
          {["Descripción", "Cant.", "Unid.", "P.Unit.", "Total", "Costo", "% Margen", "Ganancia", "Acciones"].map((h, i) => <div key={i} style={{ fontSize: 11, fontWeight: 700, padding: "2px 4px", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: i > 1 ? "right" : "left" }}>{h}</div>)}
        </div>
        {items.map((item, idx) => {
          const isEditing = editingCell && editingCell.lineId === item.lineId;
          const isHovered = hoveredIdx === idx;
          return <div key={idx} onMouseEnter={() => setHoveredIdx(idx)} onMouseLeave={() => setHoveredIdx(null)} style={{ display: "grid", gridTemplateColumns: cols, minWidth: 860, background: item.isOverridden ? C.warningSoft : isHovered ? C.surfaceAlt : idx % 2 === 0 ? C.surface : C.surfaceAlt, borderBottom: `1px solid ${C.border}`, alignItems: "center", transition: "background 120ms ease" }}>
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>TOTAL USD</div>
          <div style={{ fontSize: 24, fontWeight: 800, ...TN }}>${fmtPrice(total)}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={onWhatsApp} style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "#25D366", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>WA</button>
          <button onClick={onPrint} style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: C.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>PDF</button>
        </div>
      </div>
    </div>
  );
}

function PDFPreviewModal({ html, title, onClose }) {
  const [url, setUrl] = useState(null);
  const [isCompact, setIsCompact] = useState(() => typeof window !== "undefined" ? window.innerWidth < 760 : false);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 759px)");
    const handler = (e) => setIsCompact(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (!html || !url) return null;

  const handlePrint = () => {
    const iframe = document.getElementById("bmc-pdf-preview-frame");
    if (iframe?.contentWindow) {
      iframe.contentWindow.print();
    }
  };

  const handleShare = async () => {
    if (!navigator.share) return;
    try {
      const file = new File([html], "cotizacion-bmc.html", { type: "text/html" });
      const shareData = { title: title || "Cotización BMC" };
      if (navigator.canShare?.({ files: [file] })) {
        shareData.files = [file];
      } else {
        shareData.text = title || "Cotización BMC";
      }
      await navigator.share(shareData);
    } catch { /* user cancelled */ }
  };

  return (
    <div
      className={isCompact ? "bmc-pdf-modal-compact" : undefined}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", background: "rgba(0,0,0,0.6)", animation: "bmc-fade 150ms ease-in-out" }}
    >
      <div style={{ display: "flex", alignItems: isCompact ? "stretch" : "center", flexDirection: isCompact ? "column" : "row", justifyContent: "space-between", gap: 10, padding: isCompact ? "12px 14px" : "10px 20px", background: C.dark, color: "#fff", flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{title || "Vista previa de cotización"}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={handlePrint} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: C.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flex: isCompact ? "1 1 160px" : "0 0 auto" }}>
            <Printer size={14} />Imprimir / PDF
          </button>
          {isCompact && navigator.share && (
            <button onClick={handleShare} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#25D366", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flex: "1 1 120px" }}>
              Compartir
            </button>
          )}
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flex: isCompact ? "1 1 120px" : "0 0 auto" }}>
            <X size={14} />Cerrar
          </button>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: isCompact ? 8 : 20, overflow: "auto" }}>
        <iframe
          id="bmc-pdf-preview-frame"
          src={url}
          style={{
            width: isCompact ? "100%" : "210mm",
            maxWidth: "100%",
            height: "100%",
            border: "none",
            borderRadius: isCompact ? 0 : 8,
            boxShadow: isCompact ? "none" : "0 8px 40px rgba(0,0,0,0.4)",
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

function TipoAguasSelector({ value, onChange, onOptionDoubleClick }) {
  return (
    <div style={{ display: "flex", gap: 10, fontFamily: FONT, flexWrap: "wrap" }}>
      {TIPO_AGUAS.map(tipo => {
        const isS = value === tipo.id;
        const isDisabled = !tipo.enabled;
        const SvgComp = AGUA_SVGS[tipo.id];
        return (
          <button
            key={tipo.id}
            onClick={() => !isDisabled && onChange(tipo.id)}
            onDoubleClick={() => !isDisabled && onOptionDoubleClick?.(tipo.id)}
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

/** Plano horizontal para arrastre en planta (m). */
const ROOF3D_DRAG_PLANE_Y = 0.22;

/**
 * Discos violetas: afinan preview.x / preview.y (misma convención que RoofPreview: +y = hacia FRENTE).
 * delta mundo: dx → +x planta, dz → -y planta (coherente con RoofPreview: +y hacia frente).
 */
function RoofPlanDragHandles({
  zoneLayouts,
  onZonaPreviewChange,
  orbitRef,
  clampBounds,
  cosT,
  zonasRef,
  tipoAguasStr,
}) {
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const plane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -ROOF3D_DRAG_PLANE_Y),
    [],
  );
  const dragRef = useRef(null);

  const pick = useCallback(
    (clientX, clientY) => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const out = new THREE.Vector3();
      return raycaster.ray.intersectPlane(plane, out) ? out : null;
    },
    [camera, gl, ndc, plane, raycaster],
  );

  useEffect(() => {
    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const pt = pick(ev.clientX, ev.clientY);
      if (!pt) return;
      const dx = pt.x - d.px;
      const dz = pt.z - d.pz;
      const zs = zonasRef?.current;
      const z = d.z ?? zs?.[d.gi];
      if (z && isLateralAnnexZona(z)) {
        const parentGi = Number(z.preview?.attachParentGi);
        const parentLayout = zoneLayouts.find((l) => l.gi === parentGi);
        if (!parentLayout) return;
        let nx = d.x0 + dx;
        const ny = parentLayout.plY;
        if (clampBounds) {
          nx = Math.min(Math.max(nx, clampBounds.minX), clampBounds.maxX - d.w);
        }
        const mid = parentLayout.plX + parentLayout.wPl / 2;
        const lateralSide = nx + d.w / 2 < mid ? "izq" : "der";
        onZonaPreviewChange(d.gi, { x: nx, y: ny, lateralSide, lateralManual: true });
        return;
      }
      let nx = d.x0 + dx;
      let ny = d.y0 - dz;
      if (clampBounds) {
        nx = Math.min(Math.max(nx, clampBounds.minX), clampBounds.maxX - d.w);
        ny = Math.min(Math.max(ny, clampBounds.minY), clampBounds.maxY - d.h);
      }
      onZonaPreviewChange(d.gi, { x: nx, y: ny });
    };
    const onUp = () => {
      const d = dragRef.current;
      if (d && d.z && isLateralAnnexZona(d.z) && zonasRef?.current && onZonaPreviewChange && tipoAguasStr) {
        const zs = zonasRef.current;
        const rects = zonasToPlantRectsWithAutoGap(zs, tipoAguasStr);
        const entryLike = rects.map((r) => ({ gi: r.gi, x: r.x, y: r.y, w: r.w, h: r.h }));
        const rawX = Number(zs[d.gi]?.preview?.x) ?? d.x0;
        const snapped = snapLateralAnnexPlanta(zs, tipoAguasStr, d.gi, rawX, entryLike, LATERAL_ANNEX_SNAP_M);
        if (snapped) onZonaPreviewChange(d.gi, snapped);
      }
      if (typeof document !== "undefined") document.body.style.cursor = "";
      if (dragRef.current && orbitRef?.current) orbitRef.current.enabled = true;
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { capture: true });
    window.addEventListener("pointercancel", onUp, { capture: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp, { capture: true });
      window.removeEventListener("pointercancel", onUp, { capture: true });
    };
  }, [pick, onZonaPreviewChange, clampBounds, orbitRef, zoneLayouts, zonasRef, tipoAguasStr]);

  if (!onZonaPreviewChange || !zoneLayouts?.length) return null;

  return zoneLayouts
    .map(({ z, gi, ox, oz, ancho, largo, plX, plY, wPl, hPl }) => {
    const cx = ox + ancho / 2;
    const czMid = oz - largo * cosT / 2;
    return (
      <mesh
        key={`dh-${gi}`}
        position={[cx, ROOF3D_DRAG_PLANE_Y, czMid]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={20}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (orbitRef?.current) orbitRef.current.enabled = false;
          const pt = pick(e.clientX, e.clientY);
          if (!pt) return;
          dragRef.current = {
            gi,
            z,
            px: pt.x,
            pz: pt.z,
            x0: plX,
            y0: plY,
            w: wPl,
            h: hPl,
          };
        }}
        onPointerOver={() => { if (typeof document !== "undefined") document.body.style.cursor = "grab"; }}
        onPointerOut={() => { if (typeof document !== "undefined" && !dragRef.current) document.body.style.cursor = ""; }}
      >
        <circleGeometry args={[0.36, 28]} />
        <meshStandardMaterial
          color="#7c3aed"
          roughness={0.45}
          metalness={0.2}
          transparent
          opacity={0.92}
          depthTest
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </mesh>
    );
  });
}

// ── React Three Fiber roof components ───────────────────────────────────────

/**
 * Splits a side of `totalLen` meters into contiguous segments based on shared intervals.
 * Returns [{startM, endM, shared: bool}] covering [0, totalLen].
 */
function computeSideSegments(totalLen, intervals) {
  if (!intervals.length) return [{ startM: 0, endM: totalLen, shared: false }];
  const sorted = [...intervals].sort((a, b) => a.startM - b.startM);
  const segs = [];
  let cursor = 0;
  for (const { startM, endM } of sorted) {
    const s0 = Math.max(0, startM), s1 = Math.min(totalLen, endM);
    if (s0 > cursor + 1e-4) segs.push({ startM: cursor, endM: s0, shared: false });
    segs.push({ startM: s0, endM: s1, shared: true });
    cursor = s1;
  }
  if (cursor < totalLen - 1e-4) segs.push({ startM: cursor, endM: totalLen, shared: false });
  return segs;
}

/**
 * One roof zone rendered as a sloped PlaneGeometry with interactive edge strips.
 * Shared segments:
 *   tipo "continuo" (default) → invisible (opacity 0), hover shows ghost → opens encounter picker
 *   tipo "perfil"             → amber, visible → opens encounter picker
 * Free segments → blue → opens border accessory picker
 */
function RoofZoneMesh({ ancho, largo, theta, offsetX, offsetY = 0, offsetZ = 0, gi, multiZona, borders, zonasBorders,
  sharedSidesMap, openSide, openEncounterSide, disabledSides,
  onEdgeClick, onEncounterClick, panelAu, zonaEncounters, slopeMark, onZonaPreviewChange }) {
  /** along_largo_neg (flecha hacia fondo en SVG) = invertir caída en 3D respecto al default. */
  const invertSlope = slopeMark === "along_largo_neg";
  const thetaEff = invertSlope ? -theta : theta;
  const sinT = Math.sin(thetaEff), cosT = Math.cos(thetaEff);
  const STRIP = Math.min(0.28, ancho * 0.22, largo * 0.18);
  const FH = 0.18;
  const EPS = 0.003;
  const gi_eff = multiZona ? gi : null;
  const sideMap = sharedSidesMap.get(gi);
  const encMap  = zonaEncounters?.[gi] ?? {};
  const [hoveredKey, setHoveredKey] = useState(null);

  const rot = useMemo(() => [-Math.PI / 2 + thetaEff, 0, 0], [thetaEff]);
  const ny = EPS * cosT, nz = EPS * sinT;
  const cy = largo * sinT / 2, cz = -largo * cosT / 2;

  function freeStripColor(side) {
    if (!multiZona && (disabledSides || []).includes(side)) return '#c8cdd8';
    const val = multiZona ? (zonasBorders[gi]?.[side] ?? '') : borders[side];
    const active = val && val !== 'none';
    const isOpen = openSide?.side === side && openSide?.gi === gi_eff;
    if (isOpen) return '#3b82f6';
    if (active) return '#60a5fa';
    return '#93c5fd';
  }

  function sharedStripColor(side) {
    const enc = encMap[side];
    if (!enc || encounterEsContinuo(enc)) return '#f59e0b'; // only shown on hover (opacity 0 → 0.30)
    const isOpen = openEncounterSide?.side === side && openEncounterSide?.gi === gi_eff;
    if (isOpen) return '#b45309';
    return enc.perfil && enc.perfil !== 'none' ? '#f59e0b' : '#fcd34d';
  }

  function sharedStripOpacity(side, key) {
    const enc = encMap[side];
    if (!enc || encounterEsContinuo(enc)) return hoveredKey === key ? 0.30 : 0.0;
    return 0.72;
  }

  function freeClickable(side) {
    return !(!multiZona && (disabledSides || []).includes(side));
  }

  const stripMeshes = useMemo(() => {
    const meshes = [];
    const addSide = (side, totalLen, getPos) => {
      const intervals = sideMap?.get(side)?.intervals ?? [];
      computeSideSegments(totalLen, intervals).forEach((seg, si) => {
        const mid = (seg.startM + seg.endM) / 2;
        const segLen = seg.endM - seg.startM;
        meshes.push({ key: `${side}-${si}`, side, shared: seg.shared, ...getPos(mid, segLen) });
      });
    };
    // Planta = misma convención que RoofPreview: eje X = ancho (entre laterales) = frente↔fondo; pendiente corre en “largo” (= z.largo en rect).
    // Laterales: longitud ~ largo (largo del panel). Frente/fondo: longitud ~ ancho (cantidad de paneles × au).
    // Juntas verticales en 2D = paralelas al largo; en 3D = líneas a v=0→largo con u fijo (no al revés).
    addSide('latIzq', largo, (mid, segLen) => ({
      pos: [STRIP/2,       mid*sinT+ny, -mid*cosT+nz], w: STRIP,  h: segLen }));
    addSide('latDer', largo, (mid, segLen) => ({
      pos: [ancho-STRIP/2, mid*sinT+ny, -mid*cosT+nz], w: STRIP,  h: segLen }));
    // SVG: frente = borde inferior del rect (y + h) — pie de cubierta anclado ahí → banda frente en v≈largo; fondo en v≈0.
    addSide('frente', ancho, (mid, segLen) => ({
      pos: [mid, (largo - STRIP / 2) * sinT + ny, -(largo - STRIP / 2) * cosT + nz], w: segLen, h: STRIP }));
    addSide('fondo', ancho, (mid, segLen) => ({
      pos: [mid, (STRIP / 2) * sinT + ny, -(STRIP / 2) * cosT + nz], w: segLen, h: STRIP }));
    return meshes;
  }, [ancho, largo, sinT, cosT, ny, nz, STRIP, sideMap]);

  const gridPts = useMemo(() => {
    const pts = [];
    for (let u = panelAu; u < ancho - 0.01; u += panelAu) {
      pts.push([
        [u, ny, nz],
        [u, largo * sinT + ny, -largo * cosT + nz],
      ]);
    }
    return pts;
  }, [ancho, largo, sinT, cosT, ny, nz, panelAu]);

  return (
    <group position={[offsetX, offsetY, offsetZ]}>
      {/* Front fascia */}
      <mesh position={[ancho/2, -FH/2, 0.002]} renderOrder={0}>
        <planeGeometry args={[ancho, FH]} />
        <meshStandardMaterial color="#aab4c4" roughness={0.9} side={2} />
      </mesh>

      {/* Main sloped roof surface — doble clic: ciclo sentido pendiente (coherente con RoofPreview). */}
      <mesh
        position={[ancho/2, cy, cz]}
        rotation={rot}
        renderOrder={1}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!onZonaPreviewChange) return;
          onZonaPreviewChange(gi, { slopeMark: nextRoofSlopeMark(slopeMark) });
        }}
        onPointerOver={(e) => {
          if (!onZonaPreviewChange) return;
          e.stopPropagation();
          if (typeof document !== "undefined") document.body.style.cursor = "alias";
        }}
        onPointerOut={() => {
          if (typeof document !== "undefined") document.body.style.cursor = "";
        }}
      >
        <planeGeometry args={[ancho, largo]} />
        <meshStandardMaterial color="#dbeafe" roughness={0.72} metalness={0.05} side={2} />
      </mesh>

      {/* Edge strips — blue=free border / amber=encounter perfil / ghost=encounter continuo */}
      {stripMeshes.map(({ key, side, shared, pos, w, h }) => {
        const isClick = shared ? true : freeClickable(side);
        const color   = shared ? sharedStripColor(side)        : freeStripColor(side);
        const opacity = shared ? sharedStripOpacity(side, key) : 0.88;
        const onClick = shared
          ? (e) => { e.stopPropagation(); onEncounterClick(side, gi_eff, { x: e.clientX, y: e.clientY }); }
          : (e) => { e.stopPropagation(); onEdgeClick(side, gi_eff, { x: e.clientX, y: e.clientY }); };
        return (
          <mesh key={key} position={pos} rotation={rot} renderOrder={2}
            onClick={isClick ? onClick : undefined}
            onPointerOver={isClick ? (e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; if (shared) setHoveredKey(key); } : undefined}
            onPointerOut={isClick  ? () => { document.body.style.cursor = ''; if (shared) setHoveredKey(null); } : undefined}>
            <planeGeometry args={[w, h]} />
            <meshStandardMaterial color={color} roughness={0.6} opacity={opacity}
              transparent side={2} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
          </mesh>
        );
      })}

      {/* Panel grid lines */}
      {gridPts.map(([p0, p1], i) => (
        <Line key={i} points={[p0, p1]} color="#7aa8cc" lineWidth={0.6} />
      ))}
    </group>
  );
}

function RoofBorderCameraFitter({ camPos, camTarget, spanW, spanZ, maxH, orbitRef }) {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.set(camPos[0], camPos[1], camPos[2]);
    camera.lookAt(camTarget[0], camTarget[1], camTarget[2]);
    const aspect = size.width / (size.height || 1);
    const dx = spanW / 2, dy = maxH / 2, dz = spanZ / 2;
    const radius = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const effectiveFov = Math.min(vFov, hFov);
    const minDist = (radius * 1.4) / Math.sin(effectiveFov / 2);
    const tgt = new THREE.Vector3(camTarget[0], camTarget[1], camTarget[2]);
    const currentDist = camera.position.distanceTo(tgt);
    if (currentDist < minDist) {
      const dir = camera.position.clone().sub(tgt).normalize();
      camera.position.copy(tgt.clone().add(dir.multiplyScalar(minDist)));
    }
    camera.updateProjectionMatrix();
    const oc = orbitRef.current;
    if (oc) { oc.target.copy(tgt); oc.update(); }
  }, [camera, camPos, camTarget, spanW, spanZ, maxH, size, orbitRef]);
  return null;
}

/** WebGL canvas that renders all zones in 3D with orbit controls */
function RoofBorderCanvas({ validZonas, is2A, theta, panelAu, borders, zonasBorders,
  multiZona, sharedSidesMap, openSide, openEncounterSide, onEdgeClick, onEncounterClick,
  disabledSides, totalArea, zonaEncounters, onZonaPreviewChange, fillContainer = false,
  suppressFrenteCompass = false }) {
  const sinT = Math.sin(theta), cosT = Math.cos(theta);
  const tipoAguasStr = is2A ? "dos_aguas" : "una_agua";
  const orbitRef = useRef(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const validZonasRef = useRef(validZonas);
  validZonasRef.current = validZonas;

  /**
   * Misma lógica que RoofPreview: con posiciones en planta (preview) se usa gap entre autos;
   * sin ningún preview, gap 0 para coincidir con getSharedSidesPerZona / BOM.
   */
  const plantRects = useMemo(() => {
    try {
      return zonasToPlantRectsWithAutoGap(validZonas, tipoAguasStr);
    } catch {
      return [];
    }
  }, [validZonas, tipoAguasStr]);

  const dragClampBounds = useMemo(() => {
    if (!plantRects.length) return null;
    const pad = 2.8;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of plantRects) {
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
    }
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }, [plantRects]);

  const plantEncounters = useMemo(() => {
    try {
      return findEncounters(plantRects);
    } catch {
      return [];
    }
  }, [plantRects]);

  /**
   * Modelo de componentes conectadas por contacto en planta.
   * Unión por:
   * - encuentros geométricos (findEncounters)
   * - relación anexo lateral -> raíz
   */
  const frontComponentModel = useMemo(() => {
    if (!plantRects.length) {
      return {
        byGi: new Map(),
        components: new Map(),
        maxFrontByRoot: new Map(),
        minFrontByRoot: new Map(),
      };
    }
    const gis = plantRects.map((r) => r.gi);
    const parent = new Map(gis.map((gi) => [gi, gi]));

    const find = (x) => {
      let cur = x;
      while (parent.get(cur) !== cur) {
        cur = parent.get(cur);
      }
      let node = x;
      while (parent.get(node) !== node) {
        const next = parent.get(node);
        parent.set(node, cur);
        node = next;
      }
      return cur;
    };

    const union = (a, b) => {
      if (!parent.has(a) || !parent.has(b)) return;
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(rb, ra);
    };

    for (const enc of plantEncounters) {
      const [a, b] = enc.zoneIndices || [];
      if (Number.isFinite(a) && Number.isFinite(b)) union(a, b);
    }

    for (const r of plantRects) {
      if (!isLateralAnnexZona(r.z)) continue;
      const rootGi = getLateralAnnexRootBodyGi(validZonas, r.gi);
      if (Number.isFinite(rootGi)) union(r.gi, rootGi);
    }

    const maxFrontByRoot = new Map();
    const minFrontByRoot = new Map();
    for (const r of plantRects) {
      const root = find(r.gi);
      const front = r.y + r.h;
      const prevMax = maxFrontByRoot.get(root);
      const prevMin = minFrontByRoot.get(root);
      if (!Number.isFinite(prevMax) || front > prevMax) maxFrontByRoot.set(root, front);
      if (!Number.isFinite(prevMin) || front < prevMin) minFrontByRoot.set(root, front);
    }

    const byGi = new Map();
    const components = new Map();
    for (const r of plantRects) {
      const root = find(r.gi);
      byGi.set(r.gi, maxFrontByRoot.get(root) ?? (r.y + r.h));
      if (!components.has(root)) components.set(root, []);
      components.get(root).push(r.gi);
    }

    return {
      byGi,
      components,
      maxFrontByRoot,
      minFrontByRoot,
    };
  }, [plantRects, plantEncounters, validZonas]);

  /**
   * Misma regla que RoofPanelRealisticScene / roofZoneLayouts3d.js: plano inclinado global desde planta
   * (py → Y,Z con θ; sin anclar ejes ni usar el cuerpo raíz para posición). No solapamiento: layout 2D.
   * `frontComponentModel` sigue usándose solo para el panel de debug (componentes conectados en planta).
   */
  const zoneLayouts = useMemo(() => {
    let base;
    try {
      base = buildZoneLayoutsForRoof3d(validZonas, tipoAguasStr, theta);
    } catch {
      base = [];
    }
    const prByGi = new Map(plantRects.map((r) => [r.gi, r]));
    return base.map((l) => {
      const pr = prByGi.get(l.gi);
      return {
        ...l,
        plX: pr?.x ?? l.ox,
        plY: pr?.y ?? 0,
        wPl: pr?.w ?? l.ancho,
        hPl: pr?.h ?? l.largo,
      };
    });
  }, [validZonas, tipoAguasStr, theta, plantRects]);

  const debugStats = useMemo(() => {
    const logicalShared = getSharedSidesPerZona(validZonas, tipoAguasStr);
    const encounterLen = plantEncounters.reduce((s, e) => s + (e.length || 0), 0);
    let logicalSharedLen = 0;
    for (const sides of logicalShared.values()) {
      for (const sideInfo of sides.values()) {
        for (const iv of sideInfo.intervals || []) {
          logicalSharedLen += Math.max(0, (iv.endM || 0) - (iv.startM || 0));
        }
      }
    }
    logicalSharedLen /= 2; // cada tramo compartido aparece en ambas zonas

    const encounterByGi = new Map();
    for (const r of plantRects) encounterByGi.set(r.gi, 0);
    for (const enc of plantEncounters) {
      const [a, b] = enc.zoneIndices || [];
      if (encounterByGi.has(a)) encounterByGi.set(a, encounterByGi.get(a) + (enc.length || 0));
      if (encounterByGi.has(b)) encounterByGi.set(b, encounterByGi.get(b) + (enc.length || 0));
    }

    const cosDbg = Math.cos(theta);
    const zoneRows = zoneLayouts.map((zl) => {
      const rawFront = zl.plY + zl.hPl;
      const zFondo3d = zl.oz - zl.largo * cosDbg;
      // Plano global Z ≈ py*cos(theta): en el fondo del rect, py = plY → zFondo3d ≈ plY*cos(theta)
      const fondoAlignResidual = zFondo3d - zl.plY * cosDbg;
      const logicalSides = logicalShared.get(zl.gi);
      const sharedIntervals = (logicalSides?.get("frente")?.intervals?.length || 0)
        + (logicalSides?.get("fondo")?.intervals?.length || 0)
        + (logicalSides?.get("latIzq")?.intervals?.length || 0)
        + (logicalSides?.get("latDer")?.intervals?.length || 0);
      return {
        gi: zl.gi,
        rawFront,
        anchorFront: rawFront,
        frontDelta: fondoAlignResidual,
        area: zl.z.largo * zl.z.ancho,
        encounterLen: encounterByGi.get(zl.gi) || 0,
        sharedIntervals,
      };
    });

    const components = [];
    if (frontComponentModel?.components) {
      for (const [root, gis] of frontComponentModel.components.entries()) {
        const maxFront = frontComponentModel.maxFrontByRoot.get(root) ?? null;
        const minFront = frontComponentModel.minFrontByRoot.get(root) ?? null;
        components.push({
          root,
          gis: [...gis].sort((a, b) => a - b),
          maxFront,
          minFront,
          frontSpread: Number.isFinite(maxFront) && Number.isFinite(minFront) ? maxFront - minFront : 0,
        });
      }
      components.sort((a, b) => a.root - b.root);
    }

    let maxAbsFrontDelta = 0;
    let maxAbsFrontDeltaGi = null;
    for (const z of zoneRows) {
      const a = Math.abs(z.frontDelta);
      if (a > maxAbsFrontDelta) {
        maxAbsFrontDelta = a;
        maxAbsFrontDeltaGi = z.gi;
      }
    }
    const zoneRowsByAbsFrontDelta = [...zoneRows].sort(
      (a, b) => Math.abs(b.frontDelta) - Math.abs(a.frontDelta),
    );

    return {
      encounterLen,
      logicalSharedLen,
      diffLen: Math.abs(encounterLen - logicalSharedLen),
      zoneRows,
      zoneRowsByAbsFrontDelta,
      maxAbsFrontDelta,
      maxAbsFrontDeltaGi,
      components,
    };
  }, [frontComponentModel, plantEncounters, plantRects, tipoAguasStr, validZonas, zoneLayouts]);

  const exportDebugCsv = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const esc = (v) => {
      const s = String(v ?? "");
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const rows = [];
    const push = (arr) => rows.push(arr.map(esc).join(","));
    const now = new Date();
    const stamp = now.toISOString().replace(/[:]/g, "-");

    push(["section", "Roof Debug Snapshot"]);
    push(["generated_at_iso", now.toISOString()]);
    push(["tipo_aguas", tipoAguasStr]);
    push(["theta_rad", theta.toFixed(6)]);
    push(["zonas_count", zoneLayouts.length]);
    push(["encounters_count", plantEncounters.length]);
    push(["contact_len_geom_m", debugStats.encounterLen.toFixed(4)]);
    push(["contact_len_logical_m", debugStats.logicalSharedLen.toFixed(4)]);
    push(["contact_len_delta_m", debugStats.diffLen.toFixed(4)]);
    push([]);

    push(["section", "Delta summary (fondo 3D vs plY·cos θ)"]);
    push([
      "note",
      "zone_gi is 0-based. fondo_align_residual_m = z_fondo_3d - plY*cos(theta); expect ~0 (coplanar plant → 3D).",
    ]);
    push(["front_delta_max_abs_m", debugStats.maxAbsFrontDelta.toFixed(4)]);
    push(["front_delta_max_abs_zone_gi", debugStats.maxAbsFrontDeltaGi ?? ""]);
    push([
      "zones_sorted_by_abs_front_delta_desc",
      debugStats.zoneRowsByAbsFrontDelta.map((z) => `${z.gi}:${z.frontDelta.toFixed(4)}`).join("|") || "",
    ]);
    push([]);

    push(["section", "Connected Components"]);
    push(["component_root_gi", "component_label", "zone_gis", "zone_labels", "front_min_m", "front_max_m", "front_spread_m"]);
    for (const c of debugStats.components) {
      push([
        c.root,
        `C${c.root + 1}`,
        c.gis.join("|"),
        c.gis.map((gi) => `Z${gi + 1}`).join("|"),
        Number.isFinite(c.minFront) ? c.minFront.toFixed(4) : "",
        Number.isFinite(c.maxFront) ? c.maxFront.toFixed(4) : "",
        c.frontSpread.toFixed(4),
      ]);
    }
    push([]);

    push(["section", "Zones"]);
    push([
      "zone_gi",
      "zone_label",
      "area_m2",
      "front_planta_m",
      "front_anchor_legacy_m",
      "fondo_align_residual_m",
      "encounter_len_m",
      "shared_intervals_count",
    ]);
    for (const z of debugStats.zoneRows) {
      push([
        z.gi,
        `Z${z.gi + 1}`,
        z.area.toFixed(4),
        z.rawFront.toFixed(4),
        z.anchorFront.toFixed(4),
        z.frontDelta.toFixed(4),
        z.encounterLen.toFixed(4),
        z.sharedIntervals,
      ]);
    }

    const csv = `${rows.join("\n")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `roof-debug-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(href);
  }, [debugStats, plantEncounters.length, theta, tipoAguasStr, zoneLayouts.length]);

  const { totalWidth, maxLargo, minX, maxX, minZ, maxZ } = useMemo(() => {
    if (!zoneLayouts.length) {
      return { totalWidth: 10, maxLargo: 6, minX: 0, maxX: 10, minZ: -6, maxZ: 0 };
    }
    let mix = Infinity, mxx = -Infinity, miz = Infinity, maz = -Infinity;
    for (const r of zoneLayouts) {
      mix = Math.min(mix, r.ox);
      mxx = Math.max(mxx, r.ox + r.ancho);
      const zFrente = r.oz;
      const zFondo = r.oz - r.largo * cosT;
      miz = Math.min(miz, zFrente, zFondo);
      maz = Math.max(maz, zFrente, zFondo);
    }
    const tw = Math.max(0.1, mxx - mix);
    const ml = Math.max(...zoneLayouts.map((e) => e.largo));
    return { totalWidth: tw, maxLargo: ml, minX: mix, maxX: mxx, minZ: miz, maxZ: maz };
  }, [zoneLayouts, cosT]);

  const maxH =
    zoneLayouts.length === 0
      ? maxLargo * sinT
      : Math.max(...zoneLayouts.map((r) => (r.oy ?? 0) + r.largo * sinT));
  const maxD = maxLargo * cosT;
  const spanZ = Math.max(0.1, maxZ - minZ);
  const spanW = Math.max(0.1, maxX - minX);
  const sceneSize = Math.max(spanW, spanZ, totalWidth * 0.5 + spanZ * 0.5);

  const camTarget = useMemo(() => [
    (minX + maxX) / 2,
    maxH / 2,
    (minZ + maxZ) / 2,
  ], [minX, maxX, minZ, maxZ, maxH]);
  const camPos = useMemo(() => {
    const cx = (minX + maxX) / 2;
    const cy = maxH / 2;
    const cz = (minZ + maxZ) / 2;
    const dx = spanW / 2;
    const dy = maxH / 2;
    const dz = spanZ / 2;
    const radius = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const fovRad = (36 * Math.PI) / 180;
    const dist = (radius * 1.4) / Math.sin(fovRad / 2);
    const elevAngle = 0.55;
    const azimAngle = 0.15;
    return [
      cx + dist * Math.sin(azimAngle) * Math.cos(elevAngle),
      cy + dist * Math.sin(elevAngle),
      cz + dist * Math.cos(azimAngle) * Math.cos(elevAngle),
    ];
  }, [minX, maxX, minZ, maxZ, maxH, spanW, spanZ]);

  const shellStyle = fillContainer
    ? {
        position: "relative",
        width: "100%",
        flex: "1 1 auto",
        minHeight: 0,
        alignSelf: "stretch",
        borderRadius: 10,
        overflow: "hidden",
        background: "#eef2f9",
      }
    : { position: "relative", width: "100%", height: 224, borderRadius: 10, overflow: "hidden", background: "#eef2f9" };

  return (
    <div style={shellStyle}>
      <Canvas camera={{ position: camPos, fov: 36, near: 0.01, far: 300 }} shadows gl={{ antialias: true }}
        style={{ width: "100%", height: "100%", display: "block" }} dpr={[1, 2]}>
        <RoofBorderCameraFitter camPos={camPos} camTarget={camTarget} spanW={spanW} spanZ={spanZ} maxH={maxH} orbitRef={orbitRef} />
        <ambientLight intensity={0.62} />
        <directionalLight position={[sceneSize * 1.5 + 3, maxH * 2 + 5, maxD + 4]} intensity={0.55} castShadow />
        <directionalLight position={[-2, 4, 3]} intensity={0.22} />

        {zoneLayouts.map(({ z, gi, ancho, ox, oy, oz, slopeMark }) => (
          <RoofZoneMesh key={gi} gi={gi} ancho={ancho} largo={z.largo} theta={theta}
            offsetX={ox} offsetY={oy ?? 0} offsetZ={oz} slopeMark={slopeMark} multiZona={multiZona} borders={borders} zonasBorders={zonasBorders}
            sharedSidesMap={sharedSidesMap} openSide={openSide} openEncounterSide={openEncounterSide}
            disabledSides={disabledSides} onEdgeClick={onEdgeClick} onEncounterClick={onEncounterClick}
            panelAu={panelAu} zonaEncounters={zonaEncounters} onZonaPreviewChange={onZonaPreviewChange} />
        ))}

        {onZonaPreviewChange && (
          <RoofPlanDragHandles
            zoneLayouts={zoneLayouts}
            onZonaPreviewChange={onZonaPreviewChange}
            orbitRef={orbitRef}
            clampBounds={dragClampBounds}
            cosT={cosT}
            zonasRef={validZonasRef}
            tipoAguasStr={tipoAguasStr}
          />
        )}

        {/* Encounter indicators — desde findEncounters(plantRects), alineado a la planta real */}
        {multiZona && plantEncounters.filter((e) => e.orientation === "vertical").map((enc) => {
          const [g0, g1] = enc.zoneIndices;
          const r0 = plantRects.find((r) => r.gi === g0);
          const r1 = plantRects.find((r) => r.gi === g1);
          if (!r0 || !r1) return null;
          const xLine = enc.x1;
          let gi;
          let rectL;
          if (Math.abs(r0.x + r0.w - xLine) < 0.004 && Math.abs(r1.x - xLine) < 0.004) {
            gi = r0.gi;
            rectL = r0;
          } else if (Math.abs(r1.x + r1.w - xLine) < 0.004 && Math.abs(r0.x - xLine) < 0.004) {
            gi = r1.gi;
            rectL = r1;
          } else return null;
          const nx = sharedSidesMap.get(gi)?.get("latDer")?.intervals;
          const intervals = (nx && nx.length)
            ? nx
            : [{ startM: Math.max(0, enc.y1 - rectL.y), endM: Math.min(rectL.h, enc.y2 - rectL.y) }];
          const EPSp = 0.003;
          const ny = EPSp * cosT;
          const nz = EPSp * sinT;
          const xw = xLine;
          const pyAt = (m) => rectL.y + m;
          const yAt = (m) => pyAt(m) * sinT + ny;
          const zAt = (m) => pyAt(m) * cosT + nz;
          return intervals.map(({ startM, endM }, ii) => {
            if (endM - startM < 0.02) return null;
            const encDer = zonaEncounters?.[gi]?.latDer;
            const hasPerfil = Boolean(encDer && !encounterEsContinuo(encDer) && (
              (encDer.perfil && encDer.perfil !== "none") ||
              (encDer.perfilVecino && encDer.perfilVecino !== "none") ||
              (encDer.desnivel && (encDer.desnivel.perfilBajo || encDer.desnivel.perfilAlto))
            ));
            const midM = (startM + endM) / 2;
            const midY = yAt(midM);
            const midZ = zAt(midM);
            const bp = encDer ? encounterBorderPerfil(encDer) : "none";
            const pillLabel = hasPerfil
              ? (bp !== "none" ? String(bp).replace(/_/g, " ") : "Perfil")
              : "Seleccionar perfil";
            return (
              <group key={`enc-${enc.id}-${ii}`}>
                {hasPerfil && (
                  <Line
                    points={[
                      [xw, yAt(startM), zAt(startM)],
                      [xw, yAt(endM), zAt(endM)],
                    ]}
                    color="#f59e0b"
                    lineWidth={1.5}
                  />
                )}
                <Html position={[xw, midY, midZ]} center distanceFactor={7} zIndexRange={[20, 0]}>
                  <div
                    onClick={(e) => { e.stopPropagation(); onEncounterClick("latDer", gi, { x: e.clientX, y: e.clientY }); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 3,
                      padding: "2px 7px",
                      borderRadius: 20,
                      fontSize: 9, fontWeight: 700, fontFamily: FONT,
                      whiteSpace: "nowrap", cursor: "pointer",
                      userSelect: "none", letterSpacing: "0.02em",
                      transition: "all 120ms ease",
                      background: hasPerfil ? "rgba(245,158,11,0.92)" : "rgba(255,255,255,0.88)",
                      color: hasPerfil ? "#fff" : "#92400e",
                      border: hasPerfil ? "1px solid rgba(217,119,6,0.4)" : "1px solid rgba(245,158,11,0.55)",
                      boxShadow: "0 1px 5px rgba(0,0,0,0.16)",
                    }}
                  >
                    <span style={{ fontSize: 8, lineHeight: 1 }}>⟷</span>
                    <span>{pillLabel}</span>
                  </div>
                </Html>
              </group>
            );
          });
        })}

        {/* Zone dimension labels */}
        {multiZona && zoneLayouts.map(({ z, gi, ancho, ox, oy, oz }) => (
          <Html key={gi} position={[ox + ancho / 2, (oy ?? 0) + z.largo * sinT / 2, oz - z.largo * cosT / 2]} center distanceFactor={7}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#1e3a8a', fontFamily: FONT,
              whiteSpace: 'nowrap', pointerEvents: 'none',
              background: 'rgba(255,255,255,0.65)', padding: '1px 5px', borderRadius: 4 }}>
              {z.largo}×{z.ancho}m
            </div>
          </Html>
        ))}

        <OrbitControls ref={orbitRef} makeDefault target={camTarget} enablePan={false}
          enableZoom zoomSpeed={0.6} minDistance={1} maxDistance={sceneSize * 4 + 8}
          minPolarAngle={Math.PI/10} maxPolarAngle={Math.PI/2.1}
          minAzimuthAngle={-Math.PI/3} maxAzimuthAngle={Math.PI/3} />
      </Canvas>

      {/* Compass: Frente lo pinta QuoteVisualVisor (chiquito) cuando hay portal al visor */}
      {!suppressFrenteCompass && (
        <div style={{ position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)', fontSize:9, color:'#475569', fontWeight:700, fontFamily:FONT, pointerEvents:'none' }}>FRENTE</div>
      )}
      <div style={{ position:'absolute', top:6,   left:'50%', transform:'translateX(-50%)', fontSize:9, color:'#475569', fontWeight:700, fontFamily:FONT, pointerEvents:'none' }}>FONDO</div>
      <div style={{ position:'absolute', bottom:22, left:8,   fontSize:9, color:'#475569', fontWeight:700, fontFamily:FONT, pointerEvents:'none' }}>IZQ</div>
      <div style={{ position:'absolute', bottom:22, right:8,  fontSize:9, color:'#475569', fontWeight:700, fontFamily:FONT, pointerEvents:'none' }}>DER</div>
      {totalArea > 0 && (
        <div style={{ position:'absolute', bottom:6, right:8, fontSize:10, color:'#475569', fontWeight:600, fontFamily:FONT, pointerEvents:'none' }}>{totalArea.toFixed(1)} m²</div>
      )}
      {/* Professional debug overlay for geometry/contact validation */}
      <button
        type="button"
        onClick={() => setDebugOpen((v) => !v)}
        style={{
          position: "absolute",
          top: 6,
          right: 8,
          borderRadius: 8,
          border: "1px solid rgba(15,23,42,0.25)",
          background: "rgba(255,255,255,0.92)",
          color: "#0f172a",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.04em",
          padding: "4px 8px",
          cursor: "pointer",
          zIndex: 30,
        }}
      >
        {debugOpen ? "DEBUG ON" : "DEBUG OFF"}
      </button>
      {debugOpen && (
        <div
          style={{
            position: "absolute",
            top: 34,
            right: 8,
            width: "min(420px, 55vw)",
            maxHeight: "62%",
            overflow: "auto",
            borderRadius: 10,
            border: "1px solid rgba(15,23,42,0.25)",
            background: "rgba(248,250,252,0.95)",
            boxShadow: "0 8px 24px rgba(2,6,23,0.18)",
            padding: 10,
            zIndex: 30,
            fontFamily: FONT,
            fontSize: 10,
            color: "#0f172a",
            lineHeight: 1.35,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ fontWeight: 800, letterSpacing: "0.05em" }}>ROOF DEBUG PANEL</div>
            <button
              type="button"
              onClick={exportDebugCsv}
              style={{
                borderRadius: 7,
                border: "1px solid rgba(15,23,42,0.28)",
                background: "rgba(255,255,255,0.9)",
                color: "#0f172a",
                fontSize: 10,
                fontWeight: 700,
                padding: "3px 8px",
                cursor: "pointer",
              }}
            >
              Export CSV
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
            <div><strong>Zonas</strong>: {zoneLayouts.length}</div>
            <div><strong>Encuentros</strong>: {plantEncounters.length}</div>
            <div><strong>Len contacto (geom)</strong>: {debugStats.encounterLen.toFixed(3)} m</div>
            <div><strong>Len contacto (lógico)</strong>: {debugStats.logicalSharedLen.toFixed(3)} m</div>
            <div style={{ gridColumn: "1 / -1", color: debugStats.diffLen <= 0.05 ? "#166534" : "#b91c1c", fontWeight: 700 }}>
              Delta geom vs lógico: {debugStats.diffLen.toFixed(3)} m {debugStats.diffLen <= 0.05 ? "(OK)" : "(CHECK)"}
            </div>
            <div style={{ gridColumn: "1 / -1", fontSize: 9, color: "#475569" }}>
              <strong>Residual fondo (3D vs plY·cos θ):</strong> máx{" "}
              <strong style={{ color: "#0f172a" }}>{debugStats.maxAbsFrontDelta.toFixed(3)} m</strong>
              {debugStats.maxAbsFrontDeltaGi != null ? (
                <>
                  {" "}
                  en <strong style={{ color: "#0f172a" }}>gi {debugStats.maxAbsFrontDeltaGi}</strong> (etiq. Z
                  {debugStats.maxAbsFrontDeltaGi + 1})
                </>
              ) : null}
              . CSV: <code style={{ fontSize: 9 }}>front_delta_m</code> = ese residual (≈0 si fondo alineado).
            </div>
          </div>

          <div style={{ fontWeight: 700, marginBottom: 4 }}>Componentes conectadas</div>
          {debugStats.components.length === 0 ? (
            <div style={{ color: "#475569", marginBottom: 8 }}>Sin componentes.</div>
          ) : (
            <div style={{ marginBottom: 8 }}>
              {debugStats.components.map((c) => (
                <div key={`cmp-${c.root}`} style={{ marginBottom: 4, padding: "4px 6px", background: "rgba(255,255,255,0.7)", borderRadius: 6 }}>
                  C{c.root + 1} · zonas [{c.gis.map((gi) => gi + 1).join(", ")}] · front {c.minFront?.toFixed(2)}..{c.maxFront?.toFixed(2)} m · spread {c.frontSpread.toFixed(3)} m
                </div>
              ))}
            </div>
          )}

          <div style={{ fontWeight: 700, marginBottom: 2 }}>Zonas (orden por |residual fondo|, mayor primero)</div>
          <div style={{ fontSize: 9, color: "#64748b", marginBottom: 4 }}>
            gi = índice 0-based (coincide con <strong>ZONA 0</strong>… en el lienzo si usás esa convención).
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            {debugStats.zoneRowsByAbsFrontDelta.map((z) => {
              const strongDelta = Math.abs(z.frontDelta) >= 0.05;
              return (
                <div
                  key={`zdbg-${z.gi}`}
                  style={{
                    padding: "4px 6px",
                    background: strongDelta ? "rgba(254,243,199,0.95)" : "rgba(255,255,255,0.7)",
                    borderRadius: 6,
                    border: strongDelta ? "1px solid rgba(245,158,11,0.45)" : "1px solid transparent",
                  }}
                >
                  <strong>gi {z.gi}</strong> (Z{z.gi + 1}) · A {z.area.toFixed(2)} m² · frente planta {z.rawFront.toFixed(2)} m ·{" "}
                  <strong>resid. fondo {z.frontDelta.toFixed(3)} m</strong> · contacto {z.encounterLen.toFixed(3)} m · iv {z.sharedIntervals}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RoofBorderSelector({
  borders = {},
  onChange,
  panelFamilia = "",
  disabledSides = [],
  zonas = [],
  tipoAguas = "una_agua",
  zonasBorders = [],
  onZonaBorderChange,
  pendiente = 15,
  panelAu = 1.12,
  zonaEncounters = [],
  onZonaEncounterChange,
  onZonaPreviewChange,
  canvasPortalTargetRef = null,
  minimalChrome = false,
}) {
  // openSide: null | { side: string, gi: number|null, screenPos? }  (gi=null → global edge)
  const [openSide, setOpenSide] = useState(null);
  // openEncounterSide: null | { side: string, gi: number, screenPos }
  const [openEncounterSide, setOpenEncounterSide] = useState(null);
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const popoverRef = useRef(null);
  const [popoverStyle, setPopoverStyle] = useState(null);
  const encounterPopoverRef = useRef(null);
  const [encounterPopoverStyle, setEncounterPopoverStyle] = useState(null);
  const panelFam = PANELS_TECHO[panelFamilia]?.fam || "";

  const validZonas = useMemo(() => (zonas || []).filter(z => z?.largo > 0 && z?.ancho > 0), [zonas]);
  const is2A = tipoAguas === "dos_aguas";
  const hasZonas = validZonas.length > 0;
  const multiZona = validZonas.length > 1;

  // Misma planta que RoofPreview: conservar preview.x/y para encuentros y canvas 3D.
  const sharedSidesMap = useMemo(() => {
    if (!multiZona) return new Map();
    try {
      return getSharedSidesPerZona(validZonas, tipoAguas);
    } catch { return new Map(); }
  }, [validZonas, tipoAguas, multiZona]);

  /** Misma planta que RoofBorderCanvas / RoofPreview para resolver vecino en encuentros. */
  const plantRectsForEnc = useMemo(() => {
    try {
      return zonasToPlantRectsWithAutoGap(validZonas, is2A ? "dos_aguas" : "una_agua");
    } catch {
      return [];
    }
  }, [validZonas, is2A]);

  const margin = 18;
  const edge = 10;    // thickness of global edge strips (flat/no-zones mode)
  const pad = 24;

  // Flat mode (no zones) SVG layout — static values
  const { innerX, innerY, innerW, innerH, vbX, vbY, vbW, vbH } = useMemo(() => {
    const svgW = 280, svgH = 180;
    return {
      innerX: margin + pad, innerY: margin + edge,
      innerW: svgW - pad * 2, innerH: svgH - edge * 2,
      vbX: 0, vbY: 0, vbW: svgW + margin * 2, vbH: svgH + margin * 2,
    };
  }, []);
  const totalArea = useMemo(() => validZonas.reduce((s, z) => s + z.largo * z.ancho, 0), [validZonas]);

  // Global edge strip definitions — flat/no-zones mode only
  const edgeDefs = {
    fondo:  { x: innerX, y: innerY - edge, w: innerW, h: edge },
    frente: { x: innerX, y: innerY + innerH, w: innerW, h: edge },
    latIzq: { x: innerX - edge, y: innerY, w: edge, h: innerH },
    latDer: { x: innerX + innerW, y: innerY, w: edge, h: innerH },
  };

  // Close both popovers on outside click (incl. 3D canvas portaled to visor derecho)
  useEffect(() => {
    const handler = (e) => {
      const inMain = containerRef.current?.contains(e.target);
      const inBorder = popoverRef.current?.contains(e.target);
      const inEnc = encounterPopoverRef.current?.contains(e.target);
      const inPortal = canvasPortalTargetRef?.current?.contains(e.target);
      if (!inMain && !inBorder && !inEnc && !inPortal) {
        setOpenSide(null); setPopoverStyle(null);
        setOpenEncounterSide(null); setEncounterPopoverStyle(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [canvasPortalTargetRef]);

  const getOpts = (side) => (BORDER_OPTIONS[side] || []).filter(o => !o.familias || o.familias.includes(panelFam));

  const getLabel = (side, gi = null) => {
    const val = gi !== null ? (zonasBorders[gi]?.[side] ?? borders[side]) : borders[side];
    if (!val || val === "none") return "—";
    const opts = BORDER_OPTIONS[side] || [];
    const opt = opts.find(o => o.id === val && (!o.familias || o.familias.includes(panelFam))) || opts.find(o => o.id === val);
    return opt ? opt.label : val;
  };

  const handleEdgeClick = (side, gi = null, screenPos = null) => {
    if (gi === null && disabledSides.includes(side)) return;
    if (gi !== null && sharedSidesMap.get(gi)?.get(side)?.fullySide) return;
    setEncounterPopoverStyle(null); setOpenEncounterSide(null);
    setPopoverStyle(null);
    const isSame = openSide?.side === side && openSide?.gi === gi;
    setOpenSide(isSame ? null : { side, gi, screenPos });
  };

  const handleEncounterClick = (side, gi, screenPos) => {
    setPopoverStyle(null); setOpenSide(null);
    setEncounterPopoverStyle(null);
    const isSame = openEncounterSide?.side === side && openEncounterSide?.gi === gi;
    setOpenEncounterSide(isSame ? null : { side, gi, screenPos });
  };

  const positionEncounterPopover = useCallback(() => {
    const popEl = encounterPopoverRef.current;
    if (!openEncounterSide || !popEl) return;
    const popRect = popEl.getBoundingClientRect();
    if (popRect.width === 0 || popRect.height === 0) return;
    const vpPad = 10, gap = 10;
    const vw = window.innerWidth, vh = window.innerHeight;
    const { x: ax, y: ay } = openEncounterSide.screenPos;
    const { side } = openEncounterSide;
    const canBottom = ay + gap + popRect.height + vpPad <= vh;
    const canTop    = ay - gap - popRect.height - vpPad >= 0;
    let top = (side === 'fondo')
      ? ((canTop || !canBottom) ? ay - gap - popRect.height : ay + gap)
      : (side === 'frente')
        ? ((canBottom || !canTop) ? ay + gap : ay - gap - popRect.height)
        : ay - popRect.height / 2;
    let left = ax - popRect.width / 2;
    left = Math.min(Math.max(vpPad, left), vw - popRect.width  - vpPad);
    top  = Math.min(Math.max(vpPad, top),  vh - popRect.height - vpPad);
    setEncounterPopoverStyle({ top, left, opacity: 1 });
  }, [openEncounterSide]);

  useLayoutEffect(() => { if (openEncounterSide) positionEncounterPopover(); }, [openEncounterSide, positionEncounterPopover]);
  useEffect(() => {
    if (!openEncounterSide) return;
    window.addEventListener("resize", positionEncounterPopover);
    window.addEventListener("scroll", positionEncounterPopover, true);
    return () => { window.removeEventListener("resize", positionEncounterPopover); window.removeEventListener("scroll", positionEncounterPopover, true); };
  }, [openEncounterSide, positionEncounterPopover]);

  const positionPopover = useCallback(() => {
    const popEl = popoverRef.current;
    if (!openSide || !popEl) return;
    const popRect = popEl.getBoundingClientRect();
    if (popRect.width === 0 || popRect.height === 0) return;
    const vpPad = 10, gap = 10;
    const vw = window.innerWidth, vh = window.innerHeight;

    if (hasZonas && openSide.screenPos) {
      // 3D canvas mode: position popover near the click point received from R3F
      const { x: ax, y: ay } = openSide.screenPos;
      const { side } = openSide;
      const canBottom = ay + gap + popRect.height + vpPad <= vh;
      const canTop    = ay - gap - popRect.height - vpPad >= 0;
      let top = (side === 'fondo')
        ? ((canTop || !canBottom) ? ay - gap - popRect.height : ay + gap)
        : (side === 'frente')
          ? ((canBottom || !canTop) ? ay + gap : ay - gap - popRect.height)
          : ay - popRect.height / 2;
      let left = ax - popRect.width / 2;
      left = Math.min(Math.max(vpPad, left), vw - popRect.width  - vpPad);
      top  = Math.min(Math.max(vpPad, top),  vh - popRect.height - vpPad);
      setPopoverStyle({ top, left, opacity: 1 });
      return;
    }

    // Flat global mode — anchor to SVG element edges
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svgRect = svgEl.getBoundingClientRect();
    const { side } = openSide;
    const anchor = {
      fondo:  { x: svgRect.left + svgRect.width / 2,  y: svgRect.top },
      frente: { x: svgRect.left + svgRect.width / 2,  y: svgRect.bottom },
      latIzq: { x: svgRect.left,                      y: svgRect.top + svgRect.height / 2 },
      latDer: { x: svgRect.right,                     y: svgRect.top + svgRect.height / 2 },
    }[side];
    if (!anchor) return;
    const canTop    = anchor.y - gap - popRect.height - vpPad >= 0;
    const canBottom = anchor.y + gap + popRect.height + vpPad <= vh;
    const canLeft   = anchor.x - gap - popRect.width  - vpPad >= 0;
    const canRight  = anchor.x + gap + popRect.width  + vpPad <= vw;
    let top = 0, left = 0;
    if (side === "fondo")        { top = (canTop||!canBottom) ? anchor.y-gap-popRect.height : anchor.y+gap; left = anchor.x-popRect.width/2; }
    else if (side === "frente")  { top = (canBottom||!canTop) ? anchor.y+gap : anchor.y-gap-popRect.height; left = anchor.x-popRect.width/2; }
    else if (side === "latIzq")  { top = anchor.y-popRect.height/2; left = (canLeft||!canRight) ? anchor.x-gap-popRect.width : anchor.x+gap; }
    else                          { top = anchor.y-popRect.height/2; left = (canRight||!canLeft) ? anchor.x+gap : anchor.x-gap-popRect.width; }
    left = Math.min(Math.max(vpPad, left), vw - popRect.width  - vpPad);
    top  = Math.min(Math.max(vpPad, top),  vh - popRect.height - vpPad);
    setPopoverStyle({ top, left, opacity: 1 });
  }, [openSide, hasZonas]);

  useLayoutEffect(() => { if (openSide) positionPopover(); }, [openSide, positionPopover]);
  useEffect(() => {
    if (!openSide) return;
    window.addEventListener("resize", positionPopover);
    window.addEventListener("scroll", positionPopover, true);
    return () => { window.removeEventListener("resize", positionPopover); window.removeEventListener("scroll", positionPopover, true); };
  }, [openSide, positionPopover]);

  const portalEl = canvasPortalTargetRef?.current ?? null;
  /** Evita createPortal a un nodo desconectado (p. ej. acordeón del visor cerró en el mismo commit) → React minified #200 */
  const portalReady =
    portalEl != null &&
    typeof Element !== "undefined" &&
    portalEl instanceof Element &&
    portalEl.isConnected;
  const canvasEl = hasZonas ? (
    <RoofBorderCanvas
      validZonas={validZonas}
      is2A={is2A}
      theta={Math.max(0.05, (pendiente || 15) * Math.PI / 180)}
      panelAu={panelAu}
      borders={borders}
      zonasBorders={zonasBorders}
      multiZona={multiZona}
      sharedSidesMap={sharedSidesMap}
      openSide={openSide}
      openEncounterSide={openEncounterSide}
      onEdgeClick={handleEdgeClick}
      onEncounterClick={handleEncounterClick}
      disabledSides={disabledSides}
      totalArea={totalArea}
      zonaEncounters={zonaEncounters}
      onZonaPreviewChange={onZonaPreviewChange}
      fillContainer={Boolean(portalReady)}
      suppressFrenteCompass={Boolean(portalReady)}
    />
  ) : null;

  return (
    <div ref={containerRef} style={{ position: "relative", fontFamily: FONT }}>
      {!minimalChrome && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Vista previa del techo</div>
          <div style={{ fontSize: 12, color: C.ts, marginBottom: 10, lineHeight: 1.45 }}>
            {multiZona
              ? "Clic en cada lado de cada zona para elegir el accesorio. Disco violeta: afinar posición en planta (sincroniza con la vista 2D)."
              : "Clic en cada tramo para elegir el accesorio."}
            {onZonaPreviewChange && hasZonas && (
              <span style={{ display: "block", marginTop: 4, fontSize: 11, color: C.ts }}>
                3D alineado a planta (FRENTE = borde inferior del rectángulo en 2D). Doble clic en la cubierta azul (3D) o en la vista 2D de dimensiones: sentido de pendiente (afecta 3D y encuentros/cumbrera percibidos).
              </span>
            )}
          </div>
        </>
      )}
      {minimalChrome && hasZonas && portalReady && (
        <div style={{ fontSize: 11, color: C.ts, marginBottom: 8, lineHeight: 1.45 }}>
          Configurá bordes y encuentros en la <strong style={{ color: C.tp }}>vista 3D</strong> del panel derecho.
        </div>
      )}
      {/* ══ 3D WebGL MODE (zones defined) — inline o portal al visor derecho ══ */}
      {hasZonas && portalReady && typeof document !== "undefined" && createPortal(
        <div style={{ width: "100%", height: "100%", minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
          {canvasEl}
        </div>,
        portalEl,
      )}
      {hasZonas && !portalReady && canvasEl}

      {/* ══ FLAT GLOBAL MODE (no zones defined) ══ */}
      {!hasZonas && (
      <svg ref={svgRef} viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} width="100%"
        style={{ display: "block", maxWidth: 440, margin: "0 auto" }}>
        <>
          <rect x={innerX} y={innerY} width={innerW} height={innerH} rx={6} fill={C.brandLight} stroke={C.border} strokeWidth={1} />

          {["fondo", "frente", "latIzq", "latDer"].map(side => {
            const d = edgeDefs[side];
            const val = borders[side];
            const active = val && val !== "none";
            const isOpen = openSide?.side === side && openSide?.gi === null;
            const isDisabled = disabledSides.includes(side);
            const lp = {
              fondo:  { x: innerX + innerW / 2, y: innerY - edge / 2 + 1, anchor: "middle" },
              frente: { x: innerX + innerW / 2, y: innerY + innerH + edge / 2 + 1, anchor: "middle" },
              latIzq: { x: innerX - edge / 2, y: innerY + innerH / 2, anchor: "middle", rotate: -90 },
              latDer: { x: innerX + innerW + edge / 2, y: innerY + innerH / 2, anchor: "middle", rotate: 90 },
            }[side];
            const abbr = isDisabled && side === "fondo" ? "Cumbrera" : getLabel(side);
            const isVert = side === "latIzq" || side === "latDer";
            const hitPad = 8;
            return (
              <g key={side} role="button" tabIndex={isDisabled ? -1 : 0}
                aria-label={`${SIDE_LABELS[side]}: ${abbr}`}
                onClick={() => handleEdgeClick(side, null)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleEdgeClick(side, null); } }}
                style={{ cursor: isDisabled ? "not-allowed" : "pointer" }}>
                <rect x={isVert ? d.x - hitPad : d.x} y={isVert ? d.y : d.y - hitPad}
                  width={isVert ? d.w + hitPad * 2 : d.w} height={isVert ? d.h : d.h + hitPad * 2} fill="transparent" />
                <rect x={d.x} y={d.y} width={d.w} height={d.h} rx={isVert ? 4 : 6}
                  fill={isDisabled ? C.surfaceAlt : active ? C.primarySoft : C.surface}
                  stroke={isOpen ? C.primary : active ? C.primary : C.border}
                  strokeWidth={isOpen ? 2 : 1.5}
                  strokeDasharray={active || isOpen ? "none" : "4 3"}
                  opacity={isDisabled ? 0.4 : 1}
                />
                {isOpen && <rect x={d.x - 2} y={d.y - 2} width={d.w + 4} height={d.h + 4} rx={isVert ? 6 : 8} fill="none" stroke={C.primary} strokeWidth={1} opacity={0.3} />}
                <text x={lp.x} y={lp.y} textAnchor={lp.anchor} dominantBaseline="central"
                  fill={isDisabled ? C.tt : active ? C.primary : C.ts}
                  fontSize={8} fontWeight={600} fontFamily={FONT}
                  transform={lp.rotate ? `rotate(${lp.rotate},${lp.x},${lp.y})` : undefined}
                >{abbr.length > 12 ? abbr.slice(0, 10) + "…" : abbr}</text>
              </g>
            );
          })}
          <text x={innerX + innerW / 2} y={innerY + innerH + 28} textAnchor="middle" fill={C.ts} fontSize={9} fontWeight={600} fontFamily={FONT} letterSpacing="0.05em">FRENTE INF</text>
          <text x={innerX + innerW / 2} y={innerY - 8}           textAnchor="middle" fill={C.ts} fontSize={9} fontWeight={600} fontFamily={FONT} letterSpacing="0.05em">FRENTE SUP</text>
          <text x={innerX - edge - 6} y={innerY + innerH / 2} textAnchor="middle" dominantBaseline="central" fill={C.ts} fontSize={9} fontWeight={600} fontFamily={FONT} letterSpacing="0.05em" transform={`rotate(-90,${innerX - edge - 6},${innerY + innerH / 2})`}>IZQ</text>
          <text x={innerX + innerW + edge + 6} y={innerY + innerH / 2} textAnchor="middle" dominantBaseline="central" fill={C.ts} fontSize={9} fontWeight={600} fontFamily={FONT} letterSpacing="0.05em" transform={`rotate(90,${innerX + innerW + edge + 6},${innerY + innerH / 2})`}>DER</text>
          <text x={innerX + innerW / 2} y={innerY + innerH / 2 + 1} textAnchor="middle" dominantBaseline="central"
            fill={C.brand} fontSize={13} fontWeight={700} fontFamily={FONT}>PANELES</text>
        </>
      </svg>
      )}

      {/* Popover */}
      {openSide && typeof document !== "undefined" && createPortal((() => {
        const { side, gi } = openSide;
        const opts = getOpts(side);
        const curVal = gi !== null ? (zonasBorders[gi]?.[side] ?? borders[side]) : borders[side];
        const title = gi !== null
          ? `Zona ${gi + 1} — ${SIDE_LABELS[side]}`
          : SIDE_LABELS[side];
        return (
          <div ref={popoverRef} style={{
            position: "fixed", zIndex: 9999,
            top: popoverStyle?.top ?? -9999, left: popoverStyle?.left ?? -9999,
            opacity: popoverStyle?.opacity ?? 0, transition: "opacity 80ms ease",
            fontFamily: FONT, background: C.surface, borderRadius: 10,
            boxShadow: "0 4px 24px rgba(0,0,0,0.15)", minWidth: 220, maxWidth: 320, maxHeight: 320,
            display: "flex", flexDirection: "column", animation: "bmc-fade 100ms ease-in-out",
          }}>
            <div style={{ padding: "6px 12px", fontSize: 10, fontWeight: 700, color: C.ts, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt, borderRadius: "10px 10px 0 0", flexShrink: 0 }}>{title}</div>
            <div style={{ overflowY: "auto", borderRadius: "0 0 10px 10px" }}>
              {opts.map(opt => {
                const isSel = curVal === opt.id;
                return (
                  <div key={opt.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (gi !== null) onZonaBorderChange?.(gi, side, opt.id);
                      else onChange(side, opt.id);
                      setPopoverStyle(null); setOpenSide(null);
                    }}
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

      {/* ══ ENCOUNTER TYPE POPOVER (4 modos: continuo / pretil / cumbrera / desnivel) ══ */}
      {openEncounterSide && typeof document !== "undefined" && createPortal((() => {
        const { side, gi } = openEncounterSide;
        const rawEnc = zonaEncounters?.[gi]?.[side];
        const n = normalizeEncounter(rawEnc);
        const opts = getOpts(side);
        const defId = opts[0]?.id ?? "none";
        const closeEnc = () => { setEncounterPopoverStyle(null); setOpenEncounterSide(null); };
        const { neighborGi, neighborSide } = resolveNeighborSharedSide(gi, side, plantRectsForEnc);

        const setEnc = (val) => { onZonaEncounterChange?.(gi, side, val); };
        const syncNeighbor = (encNeighbor) => {
          if (neighborGi != null && neighborSide && encNeighbor) {
            onZonaEncounterChange?.(neighborGi, neighborSide, encNeighbor);
          }
        };

        const applyContinuo = () => {
          const payload = { tipo: "continuo", modo: "continuo", perfil: null, perfilVecino: null, cumbreraUnida: false };
          setEnc(payload);
          closeEnc();
        };

        const selectModo = (modo) => {
          if (modo === "continuo") { applyContinuo(); return; }
          if (modo === "pretil") {
            const payload = {
              tipo: "perfil", modo: "pretil",
              perfil: n.perfil ?? defId,
              perfilVecino: n.perfilVecino ?? defId,
            };
            setEnc(payload);
            syncNeighbor({
              tipo: "perfil", modo: "pretil",
              perfil: payload.perfilVecino,
              perfilVecino: payload.perfil,
            });
            return;
          }
          if (modo === "cumbrera") {
            const pid = n.perfil ?? defId;
            const payload = { tipo: "perfil", modo: "cumbrera", perfil: pid, cumbreraUnida: true };
            setEnc(payload);
            syncNeighbor({ ...payload });
            return;
          }
          if (modo === "desnivel") {
            const b = n.desnivel?.perfilBajo ?? n.perfil ?? defId;
            const a = n.desnivel?.perfilAlto ?? n.perfil ?? defId;
            setEnc({
              tipo: "perfil", modo: "desnivel",
              perfil: b || a,
              desnivel: { perfilBajo: b, perfilAlto: a },
            });
          }
        };

        const applyPretilPerfil = (perfilSelf) => {
          const pVec = n.perfilVecino ?? defId;
          const selfObj = { tipo: "perfil", modo: "pretil", perfil: perfilSelf, perfilVecino: pVec };
          setEnc(selfObj);
          syncNeighbor({ tipo: "perfil", modo: "pretil", perfil: pVec, perfilVecino: perfilSelf });
        };
        const applyPretilVecino = (perfilVecino) => {
          const pSelf = n.perfil ?? defId;
          const selfObj = { tipo: "perfil", modo: "pretil", perfil: pSelf, perfilVecino };
          setEnc(selfObj);
          syncNeighbor({ tipo: "perfil", modo: "pretil", perfil: perfilVecino, perfilVecino: pSelf });
        };

        const applyCumbreraPerfil = (pid) => {
          const payload = { tipo: "perfil", modo: "cumbrera", perfil: pid, cumbreraUnida: true };
          setEnc(payload);
          syncNeighbor({ ...payload });
          closeEnc();
        };

        const applyDesnivel = (patch) => {
          const d0 = n.desnivel || {};
          const nextD = { perfilBajo: d0.perfilBajo ?? n.perfil ?? defId, perfilAlto: d0.perfilAlto ?? n.perfil ?? defId, ...patch };
          const bom = nextD.perfilBajo || nextD.perfilAlto || defId;
          setEnc({ tipo: "perfil", modo: "desnivel", perfil: bom, desnivel: nextD });
        };

        const modoChips = [
          { id: "continuo", label: "Continuo", sub: "Mismo plano" },
          { id: "pretil", label: "Pretil", sub: "Por zona" },
          { id: "cumbrera", label: "Cumbrera", sub: "Un perfil" },
          { id: "desnivel", label: "Desnivel", sub: "Dos techos" },
        ];

        const renderOptRow = (opt, isSel, onPick) => (
          <div key={opt.id}
            onClick={(e) => { e.stopPropagation(); onPick(opt.id); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "6px 10px", cursor: "pointer", fontSize: 11, transition: TR,
              background: isSel ? "#fef3c7" : "transparent", color: isSel ? "#92400e" : C.tp,
            }}>
            <span style={{ fontWeight: isSel ? 600 : 400 }}>{opt.label}</span>
            {isSel && <Check size={12} color="#d97706" style={{ flexShrink: 0 }} />}
          </div>
        );

        return (
          <div ref={encounterPopoverRef} style={{
            position: "fixed", zIndex: 9999,
            top: encounterPopoverStyle?.top ?? -9999, left: encounterPopoverStyle?.left ?? -9999,
            opacity: encounterPopoverStyle?.opacity ?? 0, transition: "opacity 80ms ease",
            fontFamily: FONT, background: C.surface, borderRadius: 12,
            boxShadow: "0 6px 28px rgba(0,0,0,0.13)", minWidth: 240, maxWidth: 340,
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: "7px 12px", display: "flex", alignItems: "center", gap: 6,
              borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt,
              borderRadius: "12px 12px 0 0", flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: C.ts }}>⟷</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.ts, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {SIDE_LABELS[side]} · Z{gi + 1}
              </span>
            </div>

            <div style={{ padding: "8px 10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {modoChips.map(({ id, label, sub }) => {
                const active = n.modo === id;
                return (
                  <button key={id} type="button"
                    onClick={(e) => { e.stopPropagation(); selectModo(id); }}
                    style={{
                      padding: "6px 8px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: active ? 600 : 500,
                      fontFamily: FONT, textAlign: "left", border: `1.5px solid ${active ? (id === "continuo" ? C.primary : "#f59e0b") : C.border}`,
                      background: active ? (id === "continuo" ? C.primarySoft : "#fffbeb") : C.surfaceAlt,
                      color: active ? (id === "continuo" ? C.primary : "#92400e") : C.tp,
                    }}>
                    <div>{label}</div>
                    <div style={{ fontSize: 9, color: C.ts, fontWeight: 400, marginTop: 2 }}>{sub}</div>
                  </button>
                );
              })}
            </div>

            {n.modo === "continuo" && (
              <div style={{ padding: "0 12px 12px", fontSize: 11, color: C.ts, lineHeight: 1.45 }}>
                Sin accesorio en el tramo compartido: misma cubierta sin perfil en la unión.
                <div style={{ marginTop: 8 }}>
                  <button type="button" onClick={(e) => { e.stopPropagation(); applyContinuo(); }}
                    style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", fontSize: 11, fontFamily: FONT }}>
                    Cerrar
                  </button>
                </div>
              </div>
            )}

            {n.modo === "pretil" && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: "8px 10px 10px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.ts, marginBottom: 4 }}>Perfil · esta zona (Z{gi + 1})</div>
                <div style={{ maxHeight: 100, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 8 }}>
                  {opts.map((opt) => renderOptRow(opt, n.perfil === opt.id, applyPretilPerfil))}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.ts, marginBottom: 4 }}>
                  Perfil · zona vecina{neighborGi != null ? ` (Z${neighborGi + 1})` : ""}
                </div>
                {!neighborGi && (
                  <div style={{ fontSize: 10, color: C.ts, marginBottom: 6, lineHeight: 1.35 }}>
                    Alineá las zonas en planta para vincular el borde opuesto automáticamente.
                  </div>
                )}
                <div style={{ maxHeight: 100, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
                  {opts.map((opt) => renderOptRow(opt, n.perfilVecino === opt.id, applyPretilVecino))}
                </div>
              </div>
            )}

            {n.modo === "cumbrera" && (
              <div style={{ borderTop: `1px solid ${C.border}`, overflowY: "auto", maxHeight: 200, borderRadius: "0 0 12px 12px" }}>
                {opts.map((opt) => renderOptRow(opt, n.perfil === opt.id, applyCumbreraPerfil))}
              </div>
            )}

            {n.modo === "desnivel" && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: "8px 10px 12px", borderRadius: "0 0 12px 12px" }}>
                <div style={{ fontSize: 10, color: C.ts, lineHeight: 1.4, marginBottom: 8 }}>
                  Dos cotas o techos distintos: definí accesorio por tramo (BOM MVP usa primero el inferior).
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.ts, marginBottom: 4 }}>Tramo inferior / cierre</div>
                <div style={{ maxHeight: 88, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 8 }}>
                  {opts.map((opt) => renderOptRow(opt, (n.desnivel?.perfilBajo ?? "") === opt.id, (id) => applyDesnivel({ perfilBajo: id })))}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.ts, marginBottom: 4 }}>Tramo superior / libre</div>
                <div style={{ maxHeight: 88, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
                  {opts.map((opt) => renderOptRow(opt, (n.desnivel?.perfilAlto ?? "") === opt.id, (id) => applyDesnivel({ perfilAlto: id })))}
                </div>
              </div>
            )}
          </div>
        );
      })(), document.body)}
    </div>
  );
}

// ── Wizard steps — derived from SCENARIOS_DEF (single source of truth) ─────
// Adding a new scenario only requires adding it to SCENARIOS_DEF in constants.js.
const SOLO_TECHO_STEPS = SCENARIOS_DEF.find(s => s.id === "solo_techo")?.wizardSteps ?? [];

/** Paso "Pendiente" (solo_techo): con varios cuerpos de techo se configura pendiente por zona en Dimensiones — saltar este paso. */
const SOLO_TECHO_DIM_STEP_INDEX = SOLO_TECHO_STEPS.findIndex((s) => s.id === "dimensiones");
const SOLO_TECHO_PENDIENTE_STEP_INDEX = SOLO_TECHO_STEPS.findIndex((s) => s.id === "pendiente");
const SOLO_TECHO_ESTRUCTURA_STEP_INDEX = SOLO_TECHO_STEPS.findIndex((s) => s.id === "estructura");

function soloTechoSkipPendienteStep(zonasCount) {
  return zonasCount > 1 && SOLO_TECHO_PENDIENTE_STEP_INDEX >= 0 && SOLO_TECHO_ESTRUCTURA_STEP_INDEX >= 0 && SOLO_TECHO_DIM_STEP_INDEX >= 0;
}

/** Default roof color by panel line: ISODEC → Blanco, ISOROOF* → Gris when available (transcript preset / Enter-through wizard). */
function defaultTechoColorForPanelFamilia(fam) {
  const pd = PANELS_TECHO[fam];
  if (!pd?.col?.length) return "";
  if (String(fam).startsWith("ISOROOF")) {
    if (pd.col.includes("Gris")) return "Gris";
    return pd.col[0];
  }
  if (pd.col.includes("Blanco")) return "Blanco";
  return pd.col[0];
}

const FIRST_ISODEC_EPS_ESP = Number(Object.keys(PANELS_TECHO.ISODEC_EPS.esp)[0]);

const TECHO_INITIAL_VENDEDOR = {
  familia: "ISODEC_EPS",
  espesor: FIRST_ISODEC_EPS_ESP,
  color: "Blanco",
  zonas: [{ largo: 0, ancho: 0 }],
  pendiente: 0, pendienteModo: "incluye_pendiente", alturaDif: 0,
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
  const navigate = useNavigate();
  const isDetachedChatWindow = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("panelinDetached") === "1";
  }, []);
  // ── State ──
  const [modoVendedor, setModoVendedor] = useState(true);
  const [wizardStep, setWizardStep] = useState(0);
  /** Zona seleccionada en planta 2D: sincroniza SVG (visor) y métricas en columna izquierda (paso Estructura). */
  const [estructuraMetricsSelectedGi, setEstructuraMetricsSelectedGi] = useState(0);
  const [listaPrecios, _setLP] = useState(() => (typeof window !== "undefined" ? getListaDefault() : ""));
  const [scenario, _setScenario] = useState("solo_techo");
  const [proyecto, _setProyecto] = useState({ tipoCliente: "empresa", nombre: "", rut: "", telefono: "", direccion: "", descripcion: "", refInterna: "", fecha: new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" }) });
  const [techo, _setTecho] = useState(() => ({ ...TECHO_INITIAL_VENDEDOR }));
  const [pared, _setPared] = useState({ familia: "", espesor: "", color: "Blanco", alto: 3.5, perimetro: 40, numEsqExt: 4, numEsqInt: 0, aberturas: [], tipoEst: "metal", inclSell: true, incl5852: false });
  const [techoAnchoModo, _setTechoAnchoModo] = useState("paneles"); // "metros" | "paneles"
  const [camara, _setCamara] = useState({ largo_int: 6, ancho_int: 4, alto_int: 3 });
  const [flete, _setFlete] = useState(() => getFleteDefault());
  /** Costo interno del flete (USD s/IVA); opcional — afecta margen y hoja Costeo. */
  const [fleteCosto, setFleteCosto] = useState("");
  const [configVersion, setConfigVersion] = useState(0);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [chatOpen, setChatOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("chat") === "1" || params.get("panelinDetached") === "1";
  });
  const [devMode, setDevMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("panelin-dev-mode") === "1";
  });
  const [devAuthToken, setDevAuthToken] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("panelin-dev-token") || "";
  });
  const [hoveredDotIdx, setHoveredDotIdx] = useState(null);
  const [scenarioHoverId, setScenarioHoverId] = useState(null);
  const [hoverTechoFamilia, setHoverTechoFamilia] = useState("");
  const [hoverTechoColor, setHoverTechoColor] = useState("");
  const [hoverParedColor, setHoverParedColor] = useState("");
  const [aguasVisorHighlight, setAguasVisorHighlight] = useState(false);
  /** Vista 3D referencial con textura de catálogo (paralela al RoofPreview 2D). */
  const [roofRealistic3dOn, setRoofRealistic3dOn] = useState(false);
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
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1280));

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

  // ── Panelin AI agent ──
  const calcState = useMemo(
    () => ({ scenario, listaPrecios, techo, pared, camara, flete, proyecto, wizardStep }),
    [scenario, listaPrecios, techo, pared, camara, flete, proyecto, wizardStep]
  );

  const handleChatAction = useCallback(
    (action) => {
      if (!action?.type) return;
      switch (action.type) {
        case "setScenario":   setScenario(action.payload); break;
        case "setLP":         setLP(action.payload); break;
        case "setTecho": {
          const p = { ...action.payload };
          // Coerce numeric fields so calculations don't break
          if (p.pendiente != null) p.pendiente = Number(p.pendiente) || 0;
          if (p.alturaDif != null) p.alturaDif = Number(p.alturaDif) || 0;
          if (p.ptsHorm != null) p.ptsHorm = Number(p.ptsHorm) || 0;
          if (p.ptsMetal != null) p.ptsMetal = Number(p.ptsMetal) || 0;
          if (p.ptsMadera != null) p.ptsMadera = Number(p.ptsMadera) || 0;
          if (Array.isArray(p.zonas)) {
            p.zonas = p.zonas.map((z) => ({ ...z, largo: Number(z.largo) || 0, ancho: Number(z.ancho) || 0 }));
          }
          setTecho((prev) => ({ ...prev, ...p }));
          break;
        }
        case "setPared": {
          const p = { ...action.payload };
          if (p.alto != null) p.alto = Number(p.alto) || 0;
          if (p.perimetro != null) p.perimetro = Number(p.perimetro) || 0;
          if (p.numEsqExt != null) p.numEsqExt = Number(p.numEsqExt) || 0;
          if (p.numEsqInt != null) p.numEsqInt = Number(p.numEsqInt) || 0;
          setPared((prev) => ({ ...prev, ...p }));
          break;
        }
        case "setCamara": {
          const p = { ...action.payload };
          if (p.largo_int != null) p.largo_int = Number(p.largo_int) || 0;
          if (p.ancho_int != null) p.ancho_int = Number(p.ancho_int) || 0;
          if (p.alto_int != null) p.alto_int = Number(p.alto_int) || 0;
          setCamara((prev) => ({ ...prev, ...p }));
          break;
        }
        case "setFlete":      setFlete(Number(action.payload)); break;
        case "setProyecto":   setProyecto((prev) => ({ ...prev, ...action.payload })); break;
        case "setWizardStep": setWizardStep(Number(action.payload)); break;
        case "setTechoZonas": {
          const zonas = Array.isArray(action.payload)
            ? action.payload.map((z) => ({ largo: Number(z.largo) || 0, ancho: Number(z.ancho) || 0 }))
            : [];
          if (zonas.length > 0) setTecho((prev) => ({ ...prev, zonas }));
          break;
        }
        case "advanceWizard": window.dispatchEvent(new CustomEvent("bmc-wizard-next")); break;
        default: break;
      }
    },
    [setScenario, setLP, setTecho, setPared, setCamara, setFlete, setProyecto, setWizardStep]
  );

  const chat = useChat({
    calcState,
    onAction: handleChatAction,
    devMode,
    devAuthToken,
    persistHistory: false,
  });

  const toggleDevMode = useCallback(() => {
    if (devMode) {
      setDevMode(false);
      if (typeof window !== "undefined") sessionStorage.setItem("panelin-dev-mode", "0");
      return;
    }
    let token = devAuthToken;
    if (!token && typeof window !== "undefined") {
      token = window.prompt("API_AUTH_TOKEN para activar Developer Mode:") || "";
    }
    if (!token) return;
    setDevAuthToken(token);
    setDevMode(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("panelin-dev-token", token);
      sessionStorage.setItem("panelin-dev-mode", "1");
    }
  }, [devMode, devAuthToken]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && String(e.key).toLowerCase() === "d") {
        e.preventDefault();
        toggleDevMode();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleDevMode]);

  useEffect(() => {
    if (!devMode) return;
    chat.reloadTrainingKB?.().catch(() => {});
    chat.reloadPromptSections?.().catch(() => {});
    chat.reloadPromptPreview?.().catch(() => {});
  }, [devMode, chat.reloadTrainingKB, chat.reloadPromptSections, chat.reloadPromptPreview]);

  useEffect(() => {
    if (isDetachedChatWindow) setChatOpen(true);
  }, [isDetachedChatWindow]);

  const openDetachedChatWindow = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("chat", "1");
    url.searchParams.set("panelinDetached", "1");
    window.open(
      url.toString(),
      "panelin-chat-detached",
      "popup=yes,width=1280,height=900,resizable=yes,scrollbars=yes"
    );
  }, []);

  // Section refs for auto-scroll
  const panelRef = useRef(null);
  const dimensionesRef = useRef(null);
  /** Primer campo Largo (m) del paso dimensiones — autofocus paso 7/13 Solo techo. */
  const dimensionesLargoInputRef = useRef(null);
  const bordesRef = useRef(null);
  const opcionesRef = useRef(null);
  /** Ref al host DOM de la **Visualización 3D** en `QuoteVisualVisor` (`[data-bmc-view="visualizacion-3d"]`) para portal de `RoofBorderCanvas`. */
  const roof3dHostRef = useRef(null);
  const mainPanelGroupRef = useRef(null);
  const [, setRoofHostMountGen] = useState(0);

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

  /** Siguiente paso (solo_techo): con >1 zona de techo se omite el paso global "Pendiente" (pendiente por zona en Dimensiones). */
  const advanceWizardStep = useCallback(() => {
    setWizardStep((s) => {
      if (s >= SOLO_TECHO_STEPS.length - 1) return s;
      let next = s + 1;
      if (soloTechoSkipPendienteStep(techo.zonas?.length ?? 0) && next === SOLO_TECHO_PENDIENTE_STEP_INDEX) {
        next = SOLO_TECHO_ESTRUCTURA_STEP_INDEX;
      }
      return next;
    });
  }, [techo.zonas?.length]);

  const goPrevWizardSoloTecho = useCallback(() => {
    setWizardStep((s) => {
      if (s <= 0) return s;
      let prev = s - 1;
      if (soloTechoSkipPendienteStep(techo.zonas?.length ?? 0) && prev === SOLO_TECHO_PENDIENTE_STEP_INDEX) {
        prev = SOLO_TECHO_DIM_STEP_INDEX;
      }
      return prev;
    });
  }, [techo.zonas?.length]);

  useEffect(() => {
    const handler = () => advanceWizardStep();
    window.addEventListener("bmc-wizard-next", handler);
    return () => window.removeEventListener("bmc-wizard-next", handler);
  }, [advanceWizardStep]);

  /** Si quedó en paso Pendiente con varios cuerpos (p. ej. clic en el indicador), saltar a Estructura. */
  useEffect(() => {
    if (!modoVendedor || scenario !== "solo_techo") return;
    if (!soloTechoSkipPendienteStep(techo.zonas?.length ?? 0)) return;
    if (wizardStep !== SOLO_TECHO_PENDIENTE_STEP_INDEX) return;
    setWizardStep(SOLO_TECHO_ESTRUCTURA_STEP_INDEX);
  }, [modoVendedor, scenario, wizardStep, techo.zonas?.length]);

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

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let rafId = 0;
    const onResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => setViewportWidth(window.innerWidth));
    };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); cancelAnimationFrame(rafId); };
  }, []);

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

  // Enter / ArrowRight → Siguiente | ArrowLeft → Anterior (all wizard scenarios)
  useEffect(() => {
    if (!modoVendedor) return;
    const steps = SCENARIOS_DEF.find(s => s.id === scenario)?.wizardSteps ?? [];
    if (!steps.length) return;
    const stepId = steps[wizardStep]?.id;
    const isValid = stepId ? isWizardStepValid(stepId) : false;
    const canNext = wizardStep < steps.length - 1;
    const canPrev = wizardStep > 0;
    const handler = (e) => {
      const tag = e.target?.tagName;
      const editable = e.target?.isContentEditable;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT" || editable) return;
      if ((e.key === "ArrowRight" || e.key === "Enter") && canNext && isValid) {
        e.preventDefault();
        if (scenario === "solo_techo") advanceWizardStep();
        else setWizardStep((s) => s + 1);
      }
      if (e.key === "ArrowLeft" && canPrev) {
        e.preventDefault();
        if (scenario === "solo_techo") goPrevWizardSoloTecho();
        else setWizardStep((s) => s - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modoVendedor, scenario, wizardStep, isWizardStepValid, advanceWizardStep, goPrevWizardSoloTecho]);

  const vis = SCENARIOS_DEF.find(s => s.id === scenario)?.visibility ?? SCENARIOS_DEF[0].visibility;
  const scenarioDef = SCENARIOS_DEF.find(s => s.id === scenario);
  const activeWizardStepId =
    modoVendedor && scenario === "solo_techo"
      ? SOLO_TECHO_STEPS[wizardStep]?.id ?? null
      : null;

  useEffect(() => {
    if (activeWizardStepId !== "tipoAguas") {
      setAguasVisorHighlight(false);
    }
  }, [activeWizardStepId]);

  /** Al entrar a Dimensiones (paso 7/13 Solo techo), foco en Largo de la zona principal para escribir sin clic. */
  useEffect(() => {
    if (activeWizardStepId !== "dimensiones") return;
    let raf = 0;
    let t = 0;
    raf = requestAnimationFrame(() => {
      t = window.setTimeout(() => {
        const el = dimensionesLargoInputRef.current;
        if (!el || typeof el.focus !== "function") return;
        try {
          el.focus({ preventScroll: false });
        } catch {
          el.focus();
        }
        if (typeof el.select === "function") {
          try {
            el.select();
          } catch {
            /* ignore */
          }
        }
      }, 0);
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [activeWizardStepId, wizardStep]);

  const quoteVisorDimensionSummary = useMemo(() => {
    if (activeWizardStepId !== "dimensiones" || !scenarioDef?.hasTecho) return null;
    const zs = techo.zonas || [];
    if (!zs.length) return null;
    return zs
      .map((z, i) => {
        const l = Number(z.largo) || 0;
        const w = Number(z.ancho) || 0;
        return `Z${i + 1}: ${l}×${w} m`;
      })
      .join(" · ");
  }, [activeWizardStepId, scenarioDef?.hasTecho, techo.zonas]);

  const isPhone = viewportWidth < 640;
  const isTablet = viewportWidth >= 640 && viewportWidth < 1024;
  const isCompactLayout = viewportWidth < 1024;
  const twoCol = isPhone ? "1fr" : "1fr 1fr";
  const threeCol = isPhone ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr";
  const fourCol = isPhone ? "1fr" : "1fr 1fr";
  const scenarioGridCols = isPhone ? "1fr" : "1fr 1fr";
  const compactSectionPadding = isPhone ? 16 : isTablet ? 20 : 24;

  // ── Available families for current scenario (separate techo/pared) ──
  const techoFamilyOptions = useMemo(() => {
    if (!scenarioDef?.hasTecho) return [];
    return Object.entries(PANELS_TECHO).map(([fk, pd]) => ({ value: fk, label: pd.label, sublabel: pd.sub }));
  }, [scenarioDef]);

  const techoFamilyCardMedia = useMemo(
    () => ({
      ISODEC_EPS: SLIDES_SOLO_TECHO[0],
      ISODEC_PIR: SLIDES_SOLO_TECHO[1],
      ISOROOF_3G: SLIDES_SOLO_TECHO[2],
      ISOROOF_PLUS: SLIDES_SOLO_TECHO[3],
      /* FOIL: miniatura del carrusel Shopify a veces “fea”; usar referencia 3G limpia en la tarjeta (copy FOIL intacta). */
      ISOROOF_FOIL: {
        ...SLIDES_SOLO_TECHO[2],
        title: SLIDES_SOLO_TECHO[4].title,
        subtitle: SLIDES_SOLO_TECHO[4].subtitle,
        description: SLIDES_SOLO_TECHO[4].description,
      },
      ISOROOF_COLONIAL: {
        src: `${import.meta.env.BASE_URL}images/isoroof-colonial-texas-panel.png`,
        title: "Isoroof Colonial",
        subtitle: "Teja exterior · interior blanco",
        description:
          "Panel estilo teja colonial con interior blanco. Alternativa para cubiertas con imagen residencial tradicional y montaje en sistema de panel aislante.",
      },
    }),
    [],
  );

  const techoFamilyCards = useMemo(
    () =>
      techoFamilyOptions.map((opt) => ({
        ...opt,
        media: techoFamilyCardMedia[opt.value] || null,
      })),
    [techoFamilyOptions, techoFamilyCardMedia],
  );

  const paredFamilyOptions = useMemo(() => {
    if (!scenarioDef?.hasPared) return [];
    return Object.entries(PANELS_PARED).map(([fk, pd]) => ({ value: fk, label: pd.label, sublabel: pd.sub }));
  }, [scenarioDef]);

  // ── Panel data for techo ──
  const techoPanelData = useMemo(() => PANELS_TECHO[techo.familia] || null, [techo.familia]);

  const validRoofZonasFor3D = useMemo(
    () => (techo.zonas || []).filter((z) => z?.largo > 0 && z?.ancho > 0),
    [techo.zonas],
  );
  const showRoof3DHost = Boolean(scenarioDef?.hasTecho && validRoofZonasFor3D.length > 0 && !isPhone);
  const showRoof2dInQuoteVisor = Boolean(
    showRoof3DHost && activeWizardStepId && ROOF_2D_QUOTE_VISOR_STEP_IDS.has(activeWizardStepId),
  );

  useEffect(() => {
    const n = techo.zonas?.length ?? 0;
    if (n <= 0) return;
    setEstructuraMetricsSelectedGi((g) => {
      const cur = typeof g === "number" && Number.isFinite(g) ? g : 0;
      return Math.max(0, Math.min(cur, n - 1));
    });
  }, [techo.zonas?.length]);

  /** Overlay 2D apoyos + puntos fijación (mismo criterio que `calcTechoCompleto`), solo paso Estructura wizard solo techo. */
  const roofEstructuraHintsByGi = useMemo(() => {
    if (activeWizardStepId !== "estructura") return null;
    if (!scenarioDef?.hasTecho || !techoPanelData || !techo.espesor) return null;
    const hints = computeRoofEstructuraHintsByGi(techo, techoPanelData);
    return Object.keys(hints).length ? hints : null;
  }, [activeWizardStepId, scenarioDef?.hasTecho, techoPanelData, techo]);

  const useDockedRoofBorderSelector = Boolean(
    modoVendedor
    && scenario === "solo_techo"
    && showRoof3DHost
    && SOLO_TECHO_DIM_STEP_INDEX >= 0
    && wizardStep >= SOLO_TECHO_DIM_STEP_INDEX,
  );

  const bumpRoof3dHostReady = useCallback((el) => {
    roof3dHostRef.current = el;
    if (el) setRoofHostMountGen((g) => g + 1);
  }, []);

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
  const buildDefaultZona = useCallback((t) => {
    const defaultLargo = 6.0;
    const defaultAnchoM = 5.0;
    const wantPaneles = techoAnchoModo === "paneles" && techoPanelData;
    const ancho = wantPaneles
      ? normalizeTechoAnchoToPaneles(defaultAnchoM, techoPanelData, t.tipoAguas)
      : defaultAnchoM;
    return { largo: defaultLargo, ancho };
  }, [techoAnchoModo, techoPanelData, normalizeTechoAnchoToPaneles]);

  const addZona = () => setTecho(t => ({ ...t, zonas: [...t.zonas, buildDefaultZona(t)] }));

  /** Anexo lateral: otras medidas en el mismo cuerpo (preview.attachParentGi + lateralSide + lateralRank). */
  const addLateralAnnexForParent = useCallback(
    (parentGi) => {
      setTecho((t) => {
        const zs = t.zonas || [];
        if (!Number.isFinite(Number(parentGi)) || parentGi < 0 || parentGi >= zs.length) return t;
        const side = "der";
        let maxR = -1;
        for (const z of zs) {
          if (!isLateralAnnexZona(z)) continue;
          if (Number(z.preview?.attachParentGi) !== parentGi) continue;
          const ls = z.preview?.lateralSide === "izq" ? "izq" : "der";
          if (ls !== side) continue;
          maxR = Math.max(maxR, Number(z.preview?.lateralRank) || 0);
        }
        const lateralRank = maxR + 1;
        const newZona = {
          ...buildDefaultZona(t),
          preview: {
            attachParentGi: parentGi,
            lateralSide: side,
            lateralRank,
          },
        };
        return { ...t, zonas: [...zs, newZona] };
      });
    },
    [buildDefaultZona],
  );

  const onRoofEncounterPairChange = useCallback((pairKey, enc) => {
    setTecho((t) => {
      const parts = String(pairKey).split("-").map(Number);
      if (parts.length !== 2 || !parts.every((n) => Number.isFinite(n))) return t;
      const low = Math.min(parts[0], parts[1]);
      const z = t.zonas[low];
      if (!z) return t;
      const prev = z.preview?.encounterByPair;
      const base = prev && typeof prev === "object" ? { ...prev } : {};
      if (enc == null) delete base[pairKey];
      else base[pairKey] = enc;
      return {
        ...t,
        zonas: t.zonas.map((zz, i) =>
          i === low ? { ...zz, preview: { ...zz.preview, encounterByPair: base } } : zz,
        ),
      };
    });
  }, [setTecho]);

  const onRoofZonaDimensionPatch = useCallback((gi, patch) => {
    setTecho((t) => ({
      ...t,
      zonas: t.zonas.map((z, i) => {
        if (i !== gi) return z;
        const next = { ...z };
        if (patch.largo != null) next.largo = patch.largo;
        if (patch.ancho != null) next.ancho = patch.ancho;
        return next;
      }),
    }));
  }, [setTecho]);

  const swapAnnexRank = useCallback((gi, dir) => {
    if (dir !== -1 && dir !== 1) return;
    setTecho((t) => {
      const z = t.zonas[gi];
      if (!isLateralAnnexZona(z)) return t;
      const pGi = Number(z.preview.attachParentGi);
      const side = z.preview.lateralSide === "izq" ? "izq" : "der";
      const myR = Number(z.preview.lateralRank) || 0;
      const targetR = myR + dir;
      const siblings = t.zonas
        .map((zz, idx) => ({ zz, idx }))
        .filter(
          ({ zz, idx }) =>
            idx !== gi &&
            isLateralAnnexZona(zz) &&
            Number(zz.preview.attachParentGi) === pGi &&
            (zz.preview.lateralSide === "izq" ? "izq" : "der") === side,
        );
      const neighbor = siblings.find(({ zz }) => (Number(zz.preview.lateralRank) || 0) === targetR);
      if (!neighbor) return t;
      const nr = Number(neighbor.zz.preview.lateralRank) || 0;
      return {
        ...t,
        zonas: t.zonas.map((zz, idx) => {
          if (idx === gi) return { ...zz, preview: { ...zz.preview, lateralRank: nr } };
          if (idx === neighbor.idx) return { ...zz, preview: { ...neighbor.zz.preview, lateralRank: myR } };
          return zz;
        }),
      };
    });
  }, []);

  const removeZona = (idx) => setTecho((t) => {
    if (t.zonas.length <= 1) return t;
    const newZonas = t.zonas
      .filter((_, i) => i !== idx)
      .map((z) => {
        const p = z.preview;
        if (!p || typeof p.attachParentGi !== "number") return z;
        let ap = p.attachParentGi;
        if (ap === idx) {
          const { attachParentGi: _a, lateralSide: _s, lateralRank: _r, x: _x, y: _y, ...rest } = p;
          if (Object.keys(rest).length) return { ...z, preview: rest };
          const o = { ...z };
          delete o.preview;
          return o;
        }
        if (ap > idx) return { ...z, preview: { ...p, attachParentGi: ap - 1 } };
        return z;
      });
    let zp = t.zonaPrincipalGi;
    if (zp === idx) zp = undefined;
    else if (typeof zp === "number" && zp > idx) zp = zp - 1;
    return { ...t, zonas: newZonas, zonaPrincipalGi: zp };
  });
  const updateZona = (idx, key, val) => setTecho(t => ({ ...t, zonas: t.zonas.map((z, i) => i === idx ? { ...z, [key]: val } : z) }));
  const updateZonaPreview = useCallback((idx, patch) => {
    setTecho(t => ({
      ...t,
      zonas: t.zonas.map((z, i) => (i === idx ? { ...z, preview: { ...z.preview, ...patch } } : z)),
    }));
  }, [setTecho]);

  const roofBorderDockProps = useMemo(() => ({
    borders: techo.borders,
    onChange: (side, val) => setTecho((t) => ({ ...t, borders: { ...t.borders, [side]: val } })),
    panelFamilia: techo.familia,
    disabledSides: techo.tipoAguas === "dos_aguas" ? ["fondo"] : [],
    zonas: techo.zonas,
    tipoAguas: techo.tipoAguas,
    zonasBorders: techo.zonas?.map((z) => z.preview?.borders ?? {}),
    onZonaBorderChange: (gi, side, val) => updateZonaPreview(gi, { borders: { ...techo.zonas[gi]?.preview?.borders, [side]: val } }),
    zonaEncounters: techo.zonas?.map((z) => z.preview?.encounters ?? {}),
    onZonaEncounterChange: (gi, side, enc) => updateZonaPreview(gi, { encounters: { ...techo.zonas[gi]?.preview?.encounters, [side]: enc } }),
    onZonaPreviewChange: updateZonaPreview,
    pendiente: techo.pendiente,
    panelAu: techoPanelData?.au ?? 1.12,
    canvasPortalTargetRef: roof3dHostRef,
    minimalChrome: true,
  }), [
    techo.borders,
    techo.familia,
    techo.tipoAguas,
    techo.zonas,
    techo.pendiente,
    techoPanelData?.au,
    updateZonaPreview,
    setTecho,
  ]);

  const resetMainSplitLayout = useCallback(() => {
    try {
      mainPanelGroupRef.current?.setLayout?.([28, 72]);
    } catch {
      /* optional API */
    }
  }, []);

  const resetRoofPreviewLayout = useCallback(() => {
    setTecho(t => ({
      ...t,
      zonas: t.zonas.map((z) => {
        const p = z.preview || {};
        const sm = p.slopeMark;
        if (isLateralAnnexZona(z)) {
          const { x, y, lateralManual, ...keep } = p;
          if (Object.keys(keep).length) return { ...z, preview: keep };
          const o = { ...z };
          delete o.preview;
          return o;
        }
        if (sm && sm !== "off") return { ...z, preview: { slopeMark: sm } };
        const out = { ...z };
        delete out.preview;
        return out;
      }),
    }));
  }, [setTecho]);

  /** Índice de zona “techo principal” (presupuesto): manual `techo.zonaPrincipalGi`; si no, siempre la primera (no roba atención un tramo nuevo aunque tenga más m²). */
  const effectivePrincipalZonaGi = useMemo(() => {
    const z = techo.zonas || [];
    if (!z.length) return 0;
    const m = techo.zonaPrincipalGi;
    if (typeof m === "number" && m >= 0 && m < z.length) return m;
    return 0;
  }, [techo.zonas, techo.zonaPrincipalGi]);

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
    setListaPrecios(listaPrecios || "web"); // sync global LISTA_ACTIVA before any p() call
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
      return executeScenario(sc, { techo, pared, camara });
    } catch (e) { return { error: e.message }; }
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

  /** Líneas de selladores para el paso wizard (cantidades/precios); si el presupuesto aún no los incluye, vista previa con hipótesis inclSell=true. */
  const selladoresWizardRows = useMemo(() => {
    if (scenario === "presupuesto_libre") return { items: [], fromHypothesis: false, subtotal: 0 };
    if (!results || results.error) return { items: [], fromHypothesis: false, subtotal: 0 };

    const extractSell = (r) => {
      const g = applyOverrides(bomToGroups(r), overrides);
      const sg = g.find((x) => x.title === "SELLADORES");
      return sg?.items ?? [];
    };

    let items = extractSell(results);
    let fromHypothesis = false;
    if (items.length === 0) {
      try {
        const tHyp = scenarioDef?.hasTecho
          ? {
              ...techo,
              opciones: {
                ...(techo.opciones || {}),
                inclSell: techo.opciones?.inclSell === false ? true : techo.opciones?.inclSell !== false,
              },
            }
          : techo;
        const pHyp = scenarioDef?.hasPared
          ? {
              ...pared,
              inclSell: pared.inclSell === false ? true : pared.inclSell !== false,
            }
          : pared;
        const rHyp = executeScenario(scenario, { techo: tHyp, pared: pHyp, camara });
        if (rHyp && !rHyp.error) {
          const hItems = extractSell(rHyp);
          if (hItems.length > 0) {
            items = hItems.map((i) => ({ ...i }));
            fromHypothesis = true;
          }
        }
      } catch {
        /* ignore */
      }
    }
    items = items.map((i) => ({ ...i }));
    const subtotal = items.reduce((s, i) => s + (Number(i.total) || 0), 0);
    return { items, fromHypothesis, subtotal: +subtotal.toFixed(2) };
  }, [scenario, scenarioDef, results, overrides, techo, pared, camara, listaPrecios]);

  /** Mapeo estable sku+label → lineId del BOM actual (solo cuando selladores ya entran al cálculo). */
  const selladoresLineIdByKey = useMemo(() => {
    if (!results || results.error) return new Map();
    const g = applyOverrides(bomToGroups(results), overrides);
    const sell = g.find((x) => x.title === "SELLADORES");
    const m = new Map();
    (sell?.items || []).forEach((it) => {
      m.set(`${String(it.sku)}||${String(it.label)}`, it.lineId);
    });
    return m;
  }, [results, overrides]);

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
    const report = buildCostingReport(groups, costingCtx);
    const listaLabel = listaPrecios === "venta" ? "BMC directo" : "Web";
    const html = generateCosteoHTML({ client: proyecto, project: proyecto, listaLabel, report });
    openPrintWindow(html);
  }, [groups, proyecto, listaPrecios, costingCtx]);

  const handleCopyTSV = useCallback(() => {
    if (!groups.length) return;
    const scenarioDef_ = SCENARIOS_DEF.find(s => s.id === scenario);
    const vis_ = SCENARIOS_DEF.find(s => s.id === scenario)?.visibility ?? SCENARIOS_DEF[0].visibility;
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
        roofPlanSvgEl: document.querySelector('[data-bmc-capture="roof-plan-2d"]'),
        roof3dCanvasEl: document.querySelector('[data-bmc-capture="roof-3d"] canvas'),
      });
      const vis_ = SCENARIOS_DEF.find(s => s.id === scenario)?.visibility ?? SCENARIOS_DEF[0].visibility;
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
    if (isCompactLayout && navigator.share) {
      navigator.share({ title: "Cotización BMC", text: txt }).catch(() => {});
    } else if (isCompactLayout) {
      window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
    } else {
      navigator.clipboard.writeText(txt).then(() => showToast("Copiado al portapapeles"));
    }
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
    setLP(getListaDefault());
    setProyecto({ tipoCliente: "empresa", nombre: "", rut: "", telefono: "", direccion: "", descripcion: "", refInterna: "", fecha: new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" }) });
    setTecho(modoVendedor ? { ...TECHO_INITIAL_VENDEDOR } : { familia: "", espesor: "", color: "Blanco", zonas: [{ largo: 6.0, ancho: 5.0 }], pendiente: 0, pendienteModo: "incluye_pendiente", alturaDif: 0, tipoAguas: "una_agua", tipoEst: "metal", ptsHorm: 0, borders: { frente: "gotero_frontal", fondo: "gotero_lateral", latIzq: "gotero_lateral", latDer: "gotero_lateral" }, opciones: { inclCanalon: false, inclGotSup: false, inclSell: true, bomComercial: false } });
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
  const patchTechoCombinadaPts = useCallback(
    (k, v) => {
      if (k !== "ptsHorm" && k !== "ptsMetal" && k !== "ptsMadera") return;
      setTecho((t) => ({
        ...t,
        [k]: v,
        zonas: (t.zonas || []).map((z) => {
          const { combinadaFijByKey: _drop, fijDotOverrides: _dropDots, ...rest } = z;
          return rest;
        }),
      }));
    },
    [setTecho],
  );
  const combinadaFijByGi = useMemo(() => {
    const arr = techo.zonas || [];
    const out = {};
    for (let i = 0; i < arr.length; i++) {
      const m = arr[i]?.combinadaFijByKey;
      if (m && typeof m === "object" && Object.keys(m).length) out[i] = m;
    }
    return Object.keys(out).length ? out : null;
  }, [techo.zonas]);
  const handleCombinadaFijacionSync = useCallback(
    ({ byGi, ptsHorm, ptsMetal, ptsMadera }) => {
      setTecho((t) => ({
        ...t,
        ptsHorm,
        ptsMetal,
        ptsMadera,
        zonas: (t.zonas || []).map((z, i) => {
          const patch = byGi[i];
          if (!patch) return z;
          return { ...z, combinadaFijByKey: { ...patch } };
        }),
      }));
    },
    [setTecho],
  );
  const combinadaRoof2dAssignActive = Boolean(
    scenarioDef?.hasTecho && techo.tipoEst === "combinada" && activeWizardStepId === "estructura",
  );

  // ── Per-apoyo material management for combinada ──
  const combinadaApoyoInfo = useMemo(() => {
    if (!roofEstructuraHintsByGi || techo.tipoEst !== "combinada") return null;
    // For now, single-zone only (gi=0)
    const h = roofEstructuraHintsByGi[0];
    if (!h) return null;
    return { apoyos: h.apoyos || 2, cantPaneles: h.cantPaneles || 1 };
  }, [roofEstructuraHintsByGi, techo.tipoEst]);

  const apoyoMateriales = useMemo(() => {
    if (!combinadaApoyoInfo) return null;
    const stored = techo.apoyoMateriales;
    if (Array.isArray(stored) && stored.length === combinadaApoyoInfo.apoyos) return stored;
    // Build default: all metal
    return buildDefaultApoyoMateriales(combinadaApoyoInfo.apoyos, "metal");
  }, [combinadaApoyoInfo, techo.apoyoMateriales]);

  const handleApoyoMaterialCycle = useCallback(
    (gi, rowIndex) => {
      if (!combinadaApoyoInfo || !apoyoMateriales) return;
      const next = [...apoyoMateriales];
      next[rowIndex] = cycleCombinadaMaterial(next[rowIndex] || "metal");
      const pts = countPtsFromApoyoMateriales(next, combinadaApoyoInfo.cantPaneles);
      setTecho((t) => ({
        ...t,
        apoyoMateriales: next,
        ptsHorm: pts.ptsHorm,
        ptsMetal: pts.ptsMetal,
        ptsMadera: pts.ptsMadera,
        zonas: (t.zonas || []).map((z) => {
          const { combinadaFijByKey: _drop, fijDotOverrides: _dropDots, ...rest } = z;
          return rest;
        }),
      }));
    },
    [combinadaApoyoInfo, apoyoMateriales, setTecho],
  );

  const handleApoyoMaterialDirect = useCallback(
    (rowIndex, mat) => {
      if (!combinadaApoyoInfo || !apoyoMateriales) return;
      const next = [...apoyoMateriales];
      next[rowIndex] = mat;
      const pts = countPtsFromApoyoMateriales(next, combinadaApoyoInfo.cantPaneles);
      setTecho((t) => ({
        ...t,
        apoyoMateriales: next,
        ptsHorm: pts.ptsHorm,
        ptsMetal: pts.ptsMetal,
        ptsMadera: pts.ptsMadera,
        zonas: (t.zonas || []).map((z) => {
          const { combinadaFijByKey: _drop, fijDotOverrides: _dropDots, ...rest } = z;
          return rest;
        }),
      }));
    },
    [combinadaApoyoInfo, apoyoMateriales, setTecho],
  );

  // Auto-sync techo.apoyoMateriales & pts when useMemo builds defaults
  useEffect(() => {
    if (!apoyoMateriales || !combinadaApoyoInfo) return;
    const stored = techo.apoyoMateriales;
    if (Array.isArray(stored) && stored.length === apoyoMateriales.length &&
        stored.every((m, i) => m === apoyoMateriales[i])) return; // already in sync
    const pts = countPtsFromApoyoMateriales(apoyoMateriales, combinadaApoyoInfo.cantPaneles);
    setTecho((t) => ({
      ...t,
      apoyoMateriales,
      ptsHorm: pts.ptsHorm,
      ptsMetal: pts.ptsMetal,
      ptsMadera: pts.ptsMadera,
    }));
  }, [apoyoMateriales, combinadaApoyoInfo, techo.apoyoMateriales, setTecho]);

  const bordesPlantaRoof2dAssignActive = Boolean(
    scenarioDef?.hasTecho && techo.inclAccesorios !== false && activeWizardStepId === "bordes",
  );

  const fijDotOverridesByGi = useMemo(() => {
    const arr = techo.zonas || [];
    const out = {};
    for (let i = 0; i < arr.length; i++) {
      const ov = arr[i]?.fijDotOverrides;
      if (ov && typeof ov === "object" && Object.keys(ov).length) out[i] = ov;
    }
    return Object.keys(out).length ? out : null;
  }, [techo.zonas]);

  const handleFijDotOverridesSync = useCallback(
    ({ gi, overrides, ptsHorm, ptsMetal, ptsMadera }) => {
      setTecho((t) => ({
        ...t,
        ptsHorm,
        ptsMetal,
        ptsMadera,
        zonas: (t.zonas || []).map((z, i) => {
          if (i !== gi) return z;
          return { ...z, fijDotOverrides: { ...overrides } };
        }),
      }));
    },
    [setTecho],
  );

  const roof2DPreviewForVisor = useMemo(() => {
    if (!showRoof2dInQuoteVisor) return null;
    const embedMetrics = activeWizardStepId !== "estructura";
    return (
      <RoofPreview
        zonas={techo.zonas || []}
        tipoAguas={techo.tipoAguas}
        pendiente={techo.pendiente}
        panelAu={techoPanelData?.au ?? 1.12}
        panelObj={techoPanelData ?? null}
        onZonaPreviewChange={updateZonaPreview}
        onResetLayout={resetRoofPreviewLayout}
        onAnnexRankSwap={swapAnnexRank}
        onAddZona={addZona}
        onRemoveZona={removeZona}
        onEncounterPairChange={onRoofEncounterPairChange}
        onZonaDimensionPatch={onRoofZonaDimensionPatch}
        pendienteModo={techo.pendienteModo || "incluye_pendiente"}
        globalAlturaDif={techo.alturaDif ?? 0}
        estructuraHintsByGi={roofEstructuraHintsByGi}
        showPlantaExteriorCotas={showRoof2dInQuoteVisor}
        embedMetricsSidebar={embedMetrics}
        selectedZonaGi={embedMetrics ? undefined : estructuraMetricsSelectedGi}
        onSelectedZonaGiChange={embedMetrics ? undefined : setEstructuraMetricsSelectedGi}
        denseChrome
        combinadaFijacionAssign={combinadaRoof2dAssignActive}
        combinadaFijByGi={combinadaFijByGi}
        onCombinadaFijacionSync={handleCombinadaFijacionSync}
        combinadaPtsH={techo.ptsHorm ?? 0}
        combinadaPtsMetal={techo.ptsMetal ?? 0}
        combinadaPtsMadera={techo.ptsMadera ?? 0}
        fijDotOverridesByGi={fijDotOverridesByGi}
        onFijDotOverridesSync={handleFijDotOverridesSync}
        apoyoMateriales={apoyoMateriales}
        onApoyoMaterialCycle={handleApoyoMaterialCycle}
        bordesPlantaAssign={bordesPlantaRoof2dAssignActive}
        bordesPanelFamiliaKey={techo.familia || ""}
        techoBorders={techo.borders}
        onTechoBorderChange={(side, val) =>
          setTecho((t) => ({ ...t, borders: { ...t.borders, [side]: val } }))
        }
        onZonaBorderChange={(gi, side, val) =>
          updateZonaPreview(gi, {
            borders: { ...techo.zonas[gi]?.preview?.borders, [side]: val },
          })
        }
      />
    );
  }, [
    showRoof2dInQuoteVisor,
    activeWizardStepId,
    estructuraMetricsSelectedGi,
    techo.zonas,
    techo.tipoAguas,
    techo.pendiente,
    techoPanelData?.au,
    updateZonaPreview,
    resetRoofPreviewLayout,
    swapAnnexRank,
    addZona,
    onRoofEncounterPairChange,
    onRoofZonaDimensionPatch,
    roofEstructuraHintsByGi,
    combinadaRoof2dAssignActive,
    combinadaFijByGi,
    handleCombinadaFijacionSync,
    techo.ptsHorm,
    techo.ptsMetal,
    techo.ptsMadera,
    fijDotOverridesByGi,
    handleFijDotOverridesSync,
    apoyoMateriales,
    handleApoyoMaterialCycle,
    bordesPlantaRoof2dAssignActive,
    techo.familia,
    techo.borders,
    techo.inclAccesorios,
    setTecho,
  ]);

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

  const activateSelladoresInBudget = useCallback(() => {
    setTecho((t) => ({ ...t, opciones: { ...(t.opciones || {}), inclSell: true } }));
    if (scenarioDef?.hasPared) setPared((pd) => ({ ...pd, inclSell: true }));
  }, [setTecho, setPared, scenarioDef]);

  const handleSelladoresWizardCardClick = useCallback(
    (it) => {
      const k = `${String(it.sku)}||${String(it.label)}`;
      const lineId = selladoresLineIdByKey.get(k);
      if (!lineId) {
        activateSelladoresInBudget();
        return;
      }
      if (excludedItems[lineId]) handleRestore(lineId);
      else handleExclude(lineId, it.label);
    },
    [selladoresLineIdByKey, excludedItems, activateSelladoresInBudget, handleRestore, handleExclude],
  );

  const handleRestoreAll = useCallback(() => {
    setExcludedItems({});
  }, []);

  const setTechoFamilia = (fam) => {
    const pd = PANELS_TECHO[fam];
    if (!pd) return;
    const firstEsp = Number(Object.keys(pd.esp)[0]);
    const newFam = pd.fam;

    // Clear incompatible borders when switching families
    const preferredColor = defaultTechoColorForPanelFamilia(fam);
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
      const nextColor = preferredColor && pd.col.includes(preferredColor)
        ? preferredColor
        : (pd.col.includes(t.color) ? t.color : (pd.col[0] || ""));
      return { ...t, familia: fam, espesor: firstEsp, borders: newBorders, color: nextColor };
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
    const timer = setTimeout(() => { loadGsiScript().then(() => { initGoogleAuth(); setDriveAuth(gdriveIsAuth()); }).catch(() => {}); }, 500);
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
  const sectionS = { background: C.surface, borderRadius: 16, padding: compactSectionPadding, marginBottom: 16, boxShadow: SHC, overflow: "visible", boxSizing: "border-box", border: `1px solid ${C.border}`, fontFamily: FONT };
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
      <div style={{ background: C.brand, color: "#fff", padding: isPhone ? "12px 14px" : "16px 24px", display: "flex", alignItems: isCompactLayout ? "stretch" : "center", flexDirection: isCompactLayout ? "column" : "row", justifyContent: "space-between", gap: isCompactLayout ? 10 : 16, position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: isPhone ? 18 : 20, fontWeight: 800, letterSpacing: "-0.5px" }}>BMC Uruguay</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{PANELIN_VERSION_BADGE}</div>
          {currentBudgetCode && (
            <div style={{ fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,0.15)", padding: "3px 10px", borderRadius: 6, letterSpacing: "0.04em", ...TN }}>{currentBudgetCode}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", width: isCompactLayout ? "100%" : "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "rgba(255,255,255,0.1)", borderRadius: 8 }}>
            <button onClick={() => { setModoVendedor(true); setTecho({ ...TECHO_INITIAL_VENDEDOR }); setWizardStep(0); setLP(getListaDefault()); }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: modoVendedor ? "rgba(255,255,255,0.25)" : "transparent", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: modoVendedor ? 600 : 400 }}>Vendedor</button>
            <button onClick={() => { setModoVendedor(false); if (!listaPrecios) setLP(getListaDefault()); }} style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: !modoVendedor ? "rgba(255,255,255,0.25)" : "transparent", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: !modoVendedor ? 600 : 400 }}>Cliente</button>
          </div>
          <button
            type="button"
            onClick={() => { navigate("/especificaciones"); }}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
            title="Simulacro de gestión de especificaciones y PDF de práctica"
          >
            <ClipboardList size={14} />Especificaciones
          </button>
          <button
            type="button"
            onClick={() => { navigate("/presentacion-licitacion"); }}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
            title="PDF presentación benchmark licitación (PIR 50 mm vs referencia)"
          >
            <FileText size={14} />Presentación
          </button>
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
          <button
            onClick={() => setChatOpen((o) => !o)}
            style={{ padding: "6px 12px", borderRadius: 8, border: chatOpen ? "none" : "1px solid rgba(255,255,255,0.3)", background: chatOpen ? "rgba(255,255,255,0.2)" : "transparent", color: "#fff", fontSize: 13, fontWeight: chatOpen ? 600 : 400, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
          >
            💬 Panelin
          </button>
          <button
            onClick={toggleDevMode}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.35)",
              background: devMode ? "rgba(255,255,255,0.22)" : "transparent",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
            title={devMode ? "Developer mode activo · Ctrl/Cmd + Shift + D" : "Activar Developer mode · Ctrl/Cmd + Shift + D"}
            aria-label={devMode ? "Developer mode activo" : "Activar Developer mode"}
          >
            DEV
          </button>
        </div>
      </div>


      <PanelGroup
        ref={mainPanelGroupRef}
        direction={isCompactLayout ? "vertical" : "horizontal"}
        autoSaveId={isCompactLayout ? undefined : "bmc-panelin-main-split"}
        className="bmc-main-grid"
        style={{
          display: "flex",
          flexDirection: isCompactLayout ? "column" : "row",
          gap: isPhone ? 16 : 24,
          padding: isPhone ? 12 : isTablet ? 16 : 24,
          maxWidth: 1600,
          margin: "0 auto",
          height: isCompactLayout ? "auto" : "calc(100vh - 100px)",
          overflow: isCompactLayout ? "visible" : "hidden",
          minHeight: 0,
        }}
      >
        <Panel defaultSize={isCompactLayout ? 55 : 28} minSize={isCompactLayout ? 24 : 20} maxSize={isCompactLayout ? 85 : 48} style={{ minWidth: 0, minHeight: 0, display: "flex" }}>
        {/* LEFT PANEL — Wizard (Modo Vendedor) o formulario completo (Modo Cliente) */}
        <div className="bmc-left-panel" style={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: isCompactLayout ? "visible" : "auto", paddingLeft: isPhone ? 0 : 12, paddingRight: isPhone ? 0 : 12 }}>
          {modoVendedor && scenario === "solo_techo" ? (
            /* ── WIZARD: una variable a la vez ── */
            (() => {
              const step = SOLO_TECHO_STEPS[wizardStep];
              const stepId = step?.id;
              const isValid = stepId && isWizardStepValid(stepId);
              const canPrev = wizardStep > 0;
              const canNext = wizardStep < SOLO_TECHO_STEPS.length - 1;
              const uT = (k, v) => setTecho(t => ({ ...t, [k]: v }));
              const uPr = (k, v) => setProyecto(p => ({ ...p, [k]: v }));
              return (
                <>
                <div style={sectionS}>
                  {/* Step indicators */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
                    {SOLO_TECHO_STEPS.map((s, i) => {
                      const isDone = i < wizardStep;
                      const isCurrent = i === wizardStep;
                      const isHovered = hoveredDotIdx === i;
                      return (
                        <div key={s.id} style={{ position: "relative", flexShrink: 0 }}
                          onMouseEnter={() => setHoveredDotIdx(i)}
                          onMouseLeave={() => setHoveredDotIdx(null)}
                          onClick={() => setWizardStep(i)}
                        >
                          {/* Tooltip */}
                          {isHovered && (
                            <div style={{
                              position: "absolute", bottom: "calc(100% + 7px)", left: "50%",
                              transform: "translateX(-50%)",
                              background: "#1e293b", color: "#fff",
                              borderRadius: 6, padding: "4px 9px",
                              fontSize: 11, fontWeight: 500, whiteSpace: "nowrap",
                              zIndex: 200, pointerEvents: "none",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.22)",
                            }}>
                              {s.label}
                              <div style={{
                                position: "absolute", top: "100%", left: "50%",
                                transform: "translateX(-50%)",
                                borderLeft: "4px solid transparent",
                                borderRight: "4px solid transparent",
                                borderTop: "4px solid #1e293b",
                              }} />
                            </div>
                          )}
                          {/* Dot */}
                          <div style={{
                            width: isCurrent ? 24 : 8, height: 8, borderRadius: 4,
                            background: isDone ? C.success : isCurrent ? C.primary : C.border,
                            opacity: isDone ? 1 : isCurrent ? 1 : 0.4,
                            cursor: "pointer",
                            transition: "all 150ms ease",
                            transform: isHovered ? "scaleY(1.35)" : "scaleY(1)",
                          }} />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Paso {wizardStep + 1} de {SOLO_TECHO_STEPS.length}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.tp, marginBottom: 20, overflow: "visible", minWidth: 0 }}>{step?.label}</div>
                  {stepId === "escenario" && (
                    <div
                      style={{ display: "grid", gridTemplateColumns: scenarioGridCols, gap: 12 }}
                      onMouseLeave={() => setScenarioHoverId(null)}
                    >
                      {SCENARIOS_DEF.map(sc => (
                        <div
                          key={sc.id}
                          onMouseEnter={() => setScenarioHoverId(sc.id)}
                          onClick={() => setScenario(sc.id)}
                          onDoubleClick={() => {
                            setScenario(sc.id);
                            advanceWizardStep();
                          }}
                          style={{ borderRadius: 16, padding: 16, cursor: "pointer", border: `2px solid ${scenario === sc.id ? C.primary : C.border}`, background: scenario === sc.id ? C.primarySoft : C.surface, transition: TR, boxShadow: scenario === sc.id ? `0 0 0 4px ${C.primarySoft}` : SHC }}
                        >
                          <ScenarioStepIcon scenarioId={sc.id} size={28} selected={scenario === sc.id} color={scenario === sc.id ? C.primary : C.tp} />
                          <div style={{ fontSize: 14, fontWeight: 600, color: scenario === sc.id ? C.primary : C.tp }}>{sc.label}</div>
                          <div style={{ fontSize: 11, color: C.ts, lineHeight: 1.4 }}>{sc.description}</div>
                          {sc.id !== "solo_techo" && <div style={{ fontSize: 10, color: C.tt, marginTop: 6 }}>→ Modo Cliente</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  {stepId === "tipoAguas" && (
                    <div onMouseEnter={() => setAguasVisorHighlight(true)} onMouseLeave={() => setAguasVisorHighlight(false)}>
                      <TipoAguasSelector value={techo.tipoAguas} onOptionDoubleClick={() => advanceWizardStep()} onChange={v => {
                        if (v === "dos_aguas") setTecho(t => ({ ...t, tipoAguas: v, borders: { ...t.borders, fondo: "cumbrera" } }));
                        else setTecho(t => ({ ...t, tipoAguas: v, borders: { ...t.borders, fondo: t.borders.fondo === "cumbrera" ? "gotero_lateral" : t.borders.fondo } }));
                      }} />
                    </div>
                  )}
                  {stepId === "lista" && (
                    <SegmentedControl value={listaPrecios || getListaDefault()} onChange={v => setLP(v)} onOptionDoubleClick={() => advanceWizardStep()} options={[{ id: "venta", label: "Precio BMC" }, { id: "web", label: "Precio Web" }]} />
                  )}
                  {stepId === "familia" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} onMouseLeave={() => setHoverTechoFamilia("")}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Familia panel
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: isPhone ? "1fr" : "1fr 1fr", gap: 10 }}>
                        {techoFamilyCards.map((opt) => {
                          const selected = techo.familia === opt.value;
                          return (
                            <button
                              type="button"
                              key={opt.value}
                              onMouseEnter={() => setHoverTechoFamilia(opt.value)}
                              onFocus={() => setHoverTechoFamilia(opt.value)}
                              onClick={(e) => {
                                setTechoFamilia(opt.value);
                                setHoverTechoFamilia("");
                                // Fallback for environments where onDoubleClick is flaky:
                                // second consecutive click still reports detail >= 2.
                                if ((e?.detail || 0) >= 2) {
                                  advanceWizardStep();
                                }
                              }}
                              onDoubleClick={() => {
                                setTechoFamilia(opt.value);
                                setHoverTechoFamilia("");
                                advanceWizardStep();
                              }}
                              style={{
                                borderRadius: 12,
                                border: `2px solid ${selected ? C.primary : C.border}`,
                                background: selected ? C.primarySoft : C.surface,
                                boxShadow: selected ? `0 0 0 3px ${C.primarySoft}` : SHI,
                                cursor: "pointer",
                                padding: 8,
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                                textAlign: "left",
                                transition: TR,
                              }}
                              aria-label={`Seleccionar ${opt.label}`}
                            >
                              <div style={{ fontSize: 12, fontWeight: 700, color: selected ? C.primary : C.tp, lineHeight: 1.2 }}>
                                {opt.label}
                              </div>
                              {opt.media?.src ? (
                                <img
                                  src={opt.media.src}
                                  alt={opt.label}
                                  loading="lazy"
                                  style={{
                                    width: "100%",
                                    height: isPhone ? 96 : 118,
                                    objectFit: "cover",
                                    borderRadius: 10,
                                    border: `1px solid ${C.border}`,
                                    background: "#fff",
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: "100%",
                                    height: isPhone ? 96 : 118,
                                    borderRadius: 10,
                                    border: `1px dashed ${C.border}`,
                                    background: C.surfaceAlt,
                                  }}
                                />
                              )}
                              <div style={{ fontSize: 11, color: C.ts, lineHeight: 1.3 }}>{opt.sublabel || opt.media?.subtitle || "Panel de cubierta"}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {stepId === "espesor" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Espesor
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: isPhone ? "1fr" : "1fr 1fr",
                          gap: 10,
                        }}
                      >
                        {techoEspesorOptions.map((opt) => {
                          const selected = Number(techo.espesor) === Number(opt.value);
                          return (
                            <button
                              type="button"
                              key={opt.value}
                              onClick={() => {
                                uT("espesor", opt.value);
                                window.setTimeout(() => {
                                  window.dispatchEvent(new CustomEvent("bmc-wizard-next"));
                                }, 0);
                              }}
                              style={{
                                borderRadius: 12,
                                border: `2px solid ${selected ? C.primary : C.border}`,
                                background: selected ? C.primarySoft : C.surface,
                                boxShadow: selected ? `0 0 0 3px ${C.primarySoft}` : SHI,
                                cursor: "pointer",
                                padding: "12px 14px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8,
                                textAlign: "left",
                                transition: TR,
                              }}
                              aria-label={`Seleccionar ${opt.label}`}
                            >
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ fontSize: 15, fontWeight: 800, color: selected ? C.primary : C.tp }}>
                                  {opt.label}
                                </span>
                                <span style={{ fontSize: 11, color: C.ts }}>
                                  {techoPanelData?.label || "Panel"}
                                </span>
                              </div>
                              {opt.badge && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: selected ? C.primary : C.tp,
                                    background: selected ? "#fff" : C.surfaceAlt,
                                    border: `1px solid ${selected ? C.primary : C.border}`,
                                    borderRadius: 999,
                                    padding: "4px 8px",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {opt.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {stepId === "color" && techoPanelData && (
                    <ColorChips colors={techoPanelData.col} value={techo.color} onChange={c => uT("color", c)} onColorDoubleClick={() => advanceWizardStep()} onHover={setHoverTechoColor} notes={techoPanelData.colNotes || {}} familia={techo.familia} />
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
                      {(techo.zonas?.length ? techo.zonas : [{ largo: 0, ancho: 0 }]).map((zona, idx) => (
                        <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 14, padding: 16, background: C.surfaceAlt, borderRadius: 12, border: `1.5px solid ${C.border}` }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: C.tp }}>{formatZonaDisplayTitle(techo.zonas || [], idx)}</span>
                              {idx === effectivePrincipalZonaGi && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    color: C.primary,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                    padding: "3px 8px",
                                    borderRadius: 6,
                                    background: C.primarySoft,
                                    border: `1px solid ${C.primary}`,
                                  }}
                                >
                                  Techo principal
                                </span>
                              )}
                              {(techo.zonas?.length || 0) > 1 && idx !== effectivePrincipalZonaGi && !isLateralAnnexZona(zona) && (
                                <span style={{ fontSize: 11, fontWeight: 500, color: C.ts }}>Otro cuerpo de techo · Podés marcarla como principal abajo</span>
                              )}
                            </div>
                            {(techo.zonas?.length || 1) > 1 && (
                              <button onClick={() => removeZona(idx)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: C.dangerSoft, color: C.danger, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><X size={14} />Quitar</button>
                            )}
                          </div>
                          <div data-stepper-group style={{ display: "flex", gap: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
                            <StepperInput label="Largo (m)" value={zona.largo ?? 0} onChange={v => updateZona(idx, "largo", v)} min={0} max={20} step={0.01} bumpStep={BUMP_STEP_LARGO_M} unit="m" decimals={2} chainFocus inputRef={idx === 0 ? dimensionesLargoInputRef : undefined} />
                            {techoAnchoModo === "paneles" && techoPanelData ? (
                              <StepperInput label="Paneles (ancho)" value={techoPanelesDesdeAnchoM(zona.ancho ?? 0, techoPanelData, techo.tipoAguas)} onChange={v => updateZona(idx, "ancho", techoAnchoMDesdePaneles(v, techoPanelData, techo.tipoAguas))} min={1} max={500} step={1} unit="pan." decimals={0} chainFocus />
                            ) : (
                              <StepperInput label="Ancho (m)" value={zona.ancho ?? 0} onChange={v => updateZona(idx, "ancho", v)} min={0} max={20} step={0.01} bumpStep={BUMP_STEP_METROS} unit="m" decimals={2} chainFocus />
                            )}
                          </div>
                          {(techo.zonas?.length || 0) > 1 && (() => {
                            const zPendienteModo = zona.pendienteModo ?? techo.pendienteModo ?? "incluye_pendiente";
                            const zPendiente = zona.pendiente ?? techo.pendiente ?? 0;
                            const zAlturaDif = zona.alturaDif ?? techo.alturaDif ?? 0;
                            const largoReal = calcLargoRealFromModo(zona.largo ?? 0, zPendienteModo, zPendiente, zAlturaDif);
                            const largoChanged = Math.abs(largoReal - (zona.largo ?? 0)) > 0.001;
                            return (
                              <div style={{ padding: 12, background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Pendiente — {formatZonaDisplayTitle(techo.zonas || [], idx)}</div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                                  {PENDIENTE_MODOS.map(m => (
                                    <button key={m.id} onClick={() => updateZona(idx, "pendienteModo", m.id)} style={{ padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${zPendienteModo === m.id ? C.primary : C.border}`, background: zPendienteModo === m.id ? C.primarySoft : C.surface, fontSize: 11, cursor: "pointer", color: zPendienteModo === m.id ? C.primary : C.tp, fontWeight: zPendienteModo === m.id ? 700 : 400 }}>{m.label}</button>
                                  ))}
                                </div>
                                {zPendienteModo === "calcular_pendiente" && (
                                  <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                                    <StepperInput label="Pendiente" value={zPendiente} onChange={v => updateZona(idx, "pendiente", v)} min={0} max={45} step={1} unit="°" decimals={0} />
                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", paddingBottom: 4 }}>
                                      {PENDIENTES_PRESET.map(pr => (
                                        <button key={pr.valor} onClick={() => updateZona(idx, "pendiente", pr.valor)} style={{ padding: "4px 8px", borderRadius: 16, border: `1.5px solid ${zPendiente === pr.valor ? C.primary : C.border}`, background: zPendiente === pr.valor ? C.primarySoft : C.surface, fontSize: 11, cursor: "pointer", color: C.tp }}>{pr.label}</button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {zPendienteModo === "calcular_altura" && (
                                  <StepperInput label="Diferencia de altura" value={zAlturaDif} onChange={v => updateZona(idx, "alturaDif", v)} min={0} max={10} step={0.1} unit="m" />
                                )}
                                {largoChanged && (
                                  <div style={{ marginTop: 8, fontSize: 12, color: C.primary, fontWeight: 600 }}>
                                    Largo real del panel: {largoReal.toFixed(3)} m <span style={{ fontWeight: 400, color: C.ts }}>(proyectado: {(zona.largo ?? 0).toFixed(2)} m)</span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {(techo.zonas?.length || 0) > 1 && idx !== effectivePrincipalZonaGi && (
                            <button
                              type="button"
                              onClick={() => uT("zonaPrincipalGi", idx)}
                              style={{
                                alignSelf: "flex-start",
                                padding: "6px 10px",
                                borderRadius: 8,
                                border: `1px solid ${C.border}`,
                                background: C.surfaceAlt,
                                fontSize: 11,
                                fontWeight: 500,
                                cursor: "pointer",
                                color: C.ts,
                              }}
                            >
                              Usar esta zona como techo principal
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => addLateralAnnexForParent(idx)}
                            style={{
                              alignSelf: "stretch",
                              padding: "8px 12px",
                              borderRadius: 10,
                              border: `1.5px solid rgba(99,102,241,0.45)`,
                              background: "rgba(99,102,241,0.08)",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              color: "#4f46e5",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                            }}
                            title="Otro tramo con distinto largo o ancho de panel, pegado al costado de esta zona (mismo cuerpo de techo)"
                          >
                            <Plus size={16} />
                            Otra medida (mismo cuerpo)
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addZona}
                        style={{ padding: "12px 20px", borderRadius: 12, border: `2px dashed ${C.border}`, background: C.surfaceAlt, color: C.tp, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: TR }}
                        title="Superficie independiente en planta (otro cuerpo de techo)"
                      >
                        <Plus size={18} />
                        Otro cuerpo de techo
                      </button>
                      {!showRoof2dInQuoteVisor ? (
                        <RoofPreview
                          zonas={techo.zonas || []}
                          tipoAguas={techo.tipoAguas}
                          pendiente={techo.pendiente}
                          panelAu={techoPanelData?.au ?? 1.12}
                          panelObj={techoPanelData ?? null}
                          showPlantaExteriorCotas
                          onZonaPreviewChange={updateZonaPreview}
                          onResetLayout={resetRoofPreviewLayout}
                          onAnnexRankSwap={swapAnnexRank}
                          onAddZona={addZona}
                          onRemoveZona={removeZona}
                          onEncounterPairChange={onRoofEncounterPairChange}
                          onZonaDimensionPatch={onRoofZonaDimensionPatch}
                          pendienteModo={techo.pendienteModo || "incluye_pendiente"}
                          globalAlturaDif={techo.alturaDif ?? 0}
                          estructuraHintsByGi={roofEstructuraHintsByGi}
                          combinadaFijacionAssign={combinadaRoof2dAssignActive}
                          combinadaFijByGi={combinadaFijByGi}
                          onCombinadaFijacionSync={handleCombinadaFijacionSync}
                          combinadaPtsH={techo.ptsHorm ?? 0}
                          combinadaPtsMetal={techo.ptsMetal ?? 0}
                          combinadaPtsMadera={techo.ptsMadera ?? 0}
                          fijDotOverridesByGi={fijDotOverridesByGi}
                          onFijDotOverridesSync={handleFijDotOverridesSync}
                          apoyoMateriales={apoyoMateriales}
                          onApoyoMaterialCycle={handleApoyoMaterialCycle}
                          bordesPlantaAssign={bordesPlantaRoof2dAssignActive}
                          bordesPanelFamiliaKey={techo.familia || ""}
                          techoBorders={techo.borders}
                          onTechoBorderChange={(side, val) =>
                            setTecho((t) => ({ ...t, borders: { ...t.borders, [side]: val } }))
                          }
                          onZonaBorderChange={(gi, side, val) =>
                            updateZonaPreview(gi, {
                              borders: { ...techo.zonas[gi]?.preview?.borders, [side]: val },
                            })
                          }
                        />
                      ) : null}
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => setRoofRealistic3dOn((v) => !v)}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 10,
                            border: `1.5px solid ${roofRealistic3dOn ? C.primary : C.border}`,
                            background: roofRealistic3dOn ? C.primarySoft : C.surface,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            color: roofRealistic3dOn ? C.primary : C.tp,
                          }}
                        >
                          {roofRealistic3dOn ? "Ocultar render 3D (textura)" : "Ver render 3D (textura catálogo)"}
                        </button>
                        <CollapsibleHint title="Vista 3D" style={{ flex: 1, minWidth: 200 }}>
                          Opcional: misma planta que la vista 2D, con imagen del panel elegido. Solo referencia visual.
                        </CollapsibleHint>
                      </div>
                      {roofRealistic3dOn && techoPanelData ? (
                        <div data-bmc-capture="roof-3d" style={{ marginBottom: 14 }}>
                          <Suspense
                            fallback={
                              <div
                                style={{
                                  padding: 40,
                                  textAlign: "center",
                                  color: C.ts,
                                  fontSize: 13,
                                  background: C.surfaceAlt,
                                  borderRadius: 10,
                                  border: `1px solid ${C.border}`,
                                }}
                              >
                                Cargando vista 3D…
                              </div>
                            }
                          >
                            <RoofPanelRealisticScene
                              validZonas={(techo.zonas || []).filter((z) => z?.largo > 0 && z?.ancho > 0)}
                              tipoAguas={techo.tipoAguas}
                              pendiente={techo.pendiente}
                              familiaKey={techo.familia}
                              espesorMm={techo.espesor}
                              panelAu={techoPanelData?.au ?? 1.12}
                              techoColor={techo.color || ""}
                            />
                          </Suspense>
                        </div>
                      ) : null}
                    </div>
                  )}
                  {stepId === "pendiente" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Modo de cálculo del largo</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {PENDIENTE_MODOS.map(m => (
                            <button key={m.id} onClick={() => uT("pendienteModo", m.id)} style={{ padding: 12, borderRadius: 12, border: `2px solid ${(techo.pendienteModo || "incluye_pendiente") === m.id ? C.primary : C.border}`, background: (techo.pendienteModo || "incluye_pendiente") === m.id ? C.primarySoft : C.surface, textAlign: "left", cursor: "pointer", transition: TR }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: (techo.pendienteModo || "incluye_pendiente") === m.id ? C.primary : C.tp }}>{m.label}</div>
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
                          <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Material por apoyo</div>
                          {apoyoMateriales && apoyoMateriales.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {apoyoMateriales.map((mat, ri) => {
                                const isPerim = ri === 0 || ri === apoyoMateriales.length - 1;
                                const label = isPerim
                                  ? `Apoyo ${ri + 1} (Perímetro)`
                                  : `Apoyo ${ri + 1} (Intermedio)`;
                                return (
                                  <div key={ri} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: C.tp }}>{label}</div>
                                    <div style={{ display: "flex", gap: 4 }}>
                                      {COMBINADA_MATERIAL_ORDER.map((m) => (
                                        <button
                                          key={m}
                                          onClick={() => handleApoyoMaterialDirect(ri, m)}
                                          style={{
                                            padding: "4px 10px",
                                            borderRadius: 8,
                                            border: `1.5px solid ${mat === m ? (m === "hormigon" ? "#0ea5e9" : m === "madera" ? "#b45309" : "#1e293b") : C.border}`,
                                            background: mat === m ? (m === "hormigon" ? "#e0f2fe" : m === "madera" ? "#fef3c7" : "#f1f5f9") : C.surface,
                                            fontSize: 11,
                                            fontWeight: mat === m ? 700 : 400,
                                            cursor: "pointer",
                                            color: mat === m ? (m === "hormigon" ? "#0369a1" : m === "madera" ? "#92400e" : "#1e293b") : C.ts,
                                            transition: "all 0.15s ease",
                                          }}
                                        >
                                          {m === "hormigon" ? "Hormigón" : m === "madera" ? "Madera" : "Metal"}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                              <div style={{ marginTop: 6, fontSize: 11, color: C.ts, lineHeight: 1.4 }}>
                                Fijaciones: <strong>{techo.ptsHorm ?? 0}</strong> hormigón, <strong>{techo.ptsMetal ?? 0}</strong> metal, <strong>{techo.ptsMadera ?? 0}</strong> madera
                                <span style={{ opacity: 0.6 }}> — total {(techo.ptsHorm ?? 0) + (techo.ptsMetal ?? 0) + (techo.ptsMadera ?? 0)}</span>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              <StepperInput label="Fijaciones en Hormigón" value={techo.ptsHorm ?? 0} onChange={v => patchTechoCombinadaPts("ptsHorm", v)} min={0} max={9999} step={1} unit="unid" decimals={0} />
                              <StepperInput label="Fijaciones a Metal" value={techo.ptsMetal ?? 0} onChange={v => patchTechoCombinadaPts("ptsMetal", v)} min={0} max={9999} step={1} unit="unid" decimals={0} />
                              <StepperInput label="Fijaciones a Madera" value={techo.ptsMadera ?? 0} onChange={v => patchTechoCombinadaPts("ptsMadera", v)} min={0} max={9999} step={1} unit="unid" decimals={0} />
                            </div>
                          )}
                        </div>
                      )}
                      {showRoof2dInQuoteVisor ? (
                        <RoofPreviewMetricsSidebar
                          compact
                          emphasize
                          zonas={techo.zonas || []}
                          tipoAguas={techo.tipoAguas}
                          pendiente={techo.pendiente}
                          pendienteModo={techo.pendienteModo || "incluye_pendiente"}
                          globalAlturaDif={techo.alturaDif ?? 0}
                          selectedGi={estructuraMetricsSelectedGi}
                          onZonaDimensionPatch={onRoofZonaDimensionPatch}
                          onRemoveZona={removeZona}
                        />
                      ) : null}
                    </div>
                  )}
                  {stepId === "bordes" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: C.tp }}>Accesorios perimetrales</span>
                        <Toggle label={techo.inclAccesorios !== false ? "Desactivar" : "Activar"} value={techo.inclAccesorios !== false} onChange={v => setTecho(t => ({ ...t, inclAccesorios: v }))} />
                      </div>
                      {techo.inclAccesorios !== false ? (
                        <>
                          <div style={{ fontSize: 12, color: C.ts, lineHeight: 1.5, padding: "12px 14px", background: C.surfaceAlt, borderRadius: 10, border: `1px solid ${C.border}` }}>
                            <strong style={{ color: C.tp }}>Vista 3D en el panel derecho:</strong> clic en cada borde de la cubierta para elegir goteros, babetas, canalón y perfiles. En multi-zona, usá las pastillas de encuentro (⟷) para continuo / pretil / cumbrera / desnivel.
                          </div>
                          {techo.tipoAguas === "dos_aguas" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", background: C.primarySoft, borderRadius: 10, marginBottom: 4, fontSize: 12, color: C.primary, fontWeight: 500 }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 16 }}>⌃</span> 2 Aguas — Cumbrera incluida automáticamente. Configurá los bordes exteriores de cada faldón en la vista 3D.</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ padding: 16, background: C.surfaceAlt, borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, color: C.ts }}>Sin accesorios perimetrales. Activar para configurar goteros, babetas, canalón, etc.</div>
                      )}
                    </div>
                  )}
                  {stepId === "selladores" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {scenarioDef?.hasTecho ? (
                        <Toggle
                          label="¿Consideramos selladores (techo)?"
                          value={techo.opciones?.inclSell !== false}
                          onChange={(v) => setTecho((t) => ({ ...t, opciones: { ...t.opciones, inclSell: v } }))}
                        />
                      ) : null}
                      {scenarioDef?.hasPared ? (
                        <Toggle
                          label={scenarioDef?.hasTecho ? "¿Consideramos selladores (fachada)?" : "¿Consideramos selladores?"}
                          value={pared.inclSell !== false}
                          onChange={(v) => uP("inclSell", v)}
                        />
                      ) : null}
                      <Toggle
                        label="BOM comercial ISODEC PIR (2 goteros + 6 babetas + kit selladores + 22 pts fijación)"
                        value={techo.opciones?.bomComercial === true}
                        onChange={v => setTecho(t => ({ ...t, opciones: { ...t.opciones, bomComercial: v } }))}
                        disabled={techo.familia !== "ISODEC_PIR" || techo.tipoAguas === "dos_aguas"}
                      />
                      {(techo.familia !== "ISODEC_PIR" || techo.tipoAguas === "dos_aguas") && (
                        <div style={{ fontSize: 11, color: C.ts, opacity: 0.85 }}>Solo familia ISODEC PIR y techo una agua. En dos aguas el kit se duplicaría por faldón.</div>
                      )}
                      {!categoriasActivas.SELLADORES && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: `1px solid ${C.warning}`,
                            background: C.warningSoft,
                            fontSize: 12,
                            color: C.tp,
                          }}
                        >
                          <span>La categoría <strong>Selladores</strong> está desactivada en el presupuesto: no verás estas líneas en la tabla hasta activarla.</span>
                          <button
                            type="button"
                            onClick={() => setCategoriasActivas((ca) => ({ ...ca, SELLADORES: true }))}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              border: `1px solid ${C.primary}`,
                              background: C.primarySoft,
                              fontSize: 12,
                              fontWeight: 600,
                              color: C.primary,
                              cursor: "pointer",
                            }}
                          >
                            Activar categoría Selladores
                          </button>
                        </div>
                      )}
                      {selladoresWizardRows.fromHypothesis && (
                        <div style={{ fontSize: 12, color: C.ts, lineHeight: 1.45, padding: "10px 12px", background: C.warningSoft, borderRadius: 10, border: `1px solid ${C.border}` }}>
                          <strong style={{ color: C.tp }}>Vista previa:</strong> cantidades calculadas como si los selladores estuvieran activos. Tocá una tarjeta o activá el interruptor superior para sumarlas al presupuesto.
                        </div>
                      )}
                      {selladoresWizardRows.items.length > 0 ? (
                        <div>
                          <div style={{ fontWeight: 600, color: C.tp, marginBottom: 8, fontSize: 13 }}>
                            Líneas al cotizador ({listaPrecios === "web" ? "lista web" : "lista BMC"})
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gap: 10,
                              gridTemplateColumns: "repeat(auto-fill, minmax(228px, 1fr))",
                            }}
                          >
                            {selladoresWizardRows.items.map((it, idx) => {
                              const rowKey = `${String(it.sku)}||${String(it.label)}||${idx}`;
                              const lineId = selladoresLineIdByKey.get(`${String(it.sku)}||${String(it.label)}`);
                              const excluded = Boolean(lineId && excludedItems[lineId]);
                              const inPlay = Boolean(lineId && !excluded);
                              const cantStr =
                                typeof it.cant === "number" && Math.abs(it.cant - Math.round(it.cant)) > 1e-6
                                  ? it.cant.toFixed(2)
                                  : String(it.cant ?? "—");
                              return (
                                <button
                                  key={rowKey}
                                  type="button"
                                  onClick={() => handleSelladoresWizardCardClick(it)}
                                  style={{
                                    textAlign: "left",
                                    padding: "12px 14px",
                                    borderRadius: 12,
                                    border: `2px solid ${inPlay ? C.primary : excluded ? C.danger : C.border}`,
                                    background: inPlay ? C.primarySoft : excluded ? C.dangerSoft : C.surface,
                                    cursor: "pointer",
                                    transition: TR,
                                    minHeight: 120,
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                  }}
                                >
                                  <div style={{ fontWeight: 700, fontSize: 13, color: C.tp, lineHeight: 1.35 }}>{it.label}</div>
                                  <div style={{ fontSize: 12, color: C.ts, marginTop: 8, lineHeight: 1.4 }}>
                                    Cant. <strong style={{ color: C.tp }}>{cantStr}</strong> {it.unidad || ""}
                                    <span style={{ display: "block", marginTop: 4 }}>
                                      P. unit. U$S <strong style={{ color: C.tp }}>{fmtPrice(Number(it.pu) || 0)}</strong>
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 15, fontWeight: 700, color: C.tp, marginTop: 10 }}>
                                    Total U$S {fmtPrice(Number(it.total) || 0)}
                                  </div>
                                  <div style={{ fontSize: 11, marginTop: 8, color: inPlay ? C.primary : excluded ? C.danger : C.ts, fontWeight: 600 }}>
                                    {!lineId
                                      ? "Clic: activar selladores y sumar al presupuesto"
                                      : excluded
                                        ? "Quitado del presupuesto — clic para restaurar"
                                        : "En presupuesto — clic para quitar"}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          <div
                            style={{
                              marginTop: 10,
                              fontSize: 12,
                              color: C.ts,
                              display: "flex",
                              justifyContent: "space-between",
                              flexWrap: "wrap",
                              gap: 8,
                            }}
                          >
                            <span>
                              Subtotal selladores (vista): <strong style={{ color: C.tp }}>U$S {fmtPrice(selladoresWizardRows.subtotal)}</strong> s/IVA
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: C.ts, padding: 12, background: C.surfaceAlt, borderRadius: 10, border: `1px solid ${C.border}` }}>
                          Sin líneas de selladores con la configuración actual. Completá panel y dimensiones, o activá selladores arriba.
                        </div>
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
                      <button type="button" onClick={() => goPrevWizardSoloTecho()} style={{ padding: "12px 24px", borderRadius: 12, border: `2px solid ${C.border}`, background: C.surface, fontSize: 15, fontWeight: 600, cursor: "pointer", color: C.tp }}>
                        Anterior
                      </button>
                    )}
                    <div style={{ flex: 1 }} />
                    {canNext ? (
                      <button type="button" onClick={() => isValid && advanceWizardStep()} disabled={!isValid} style={wizardPrimaryActionStyle(isValid)}>
                        Siguiente
                      </button>
                    ) : (
                      <span style={{ fontSize: 14, color: C.success, fontWeight: 700 }}>✓ Cotización lista</span>
                    )}
                  </div>
                </div>
                {stepId === "espesor" && (
                  <div
                    className="bmc-espesor-advisor-wrap"
                    style={{
                      marginTop: 14,
                      width: "100%",
                      minWidth: 0,
                      boxSizing: "border-box",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "flex-start",
                    }}
                  >
                    <img
                      src="/images/panelin-advisor-plan.png"
                      alt="Panelín asesor técnico con plano de cubierta"
                      loading="lazy"
                      decoding="async"
                      style={{
                        display: "block",
                        width: "100%",
                        maxWidth: "100%",
                        height: "auto",
                        objectFit: "contain",
                        borderRadius: 12,
                        border: `1px solid ${C.border}`,
                        background: "#fff",
                      }}
                    />
                  </div>
                )}
                </>
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
              <div
                style={{ display: "grid", gridTemplateColumns: scenarioGridCols, gap: 12 }}
                onMouseLeave={() => setScenarioHoverId(null)}
              >
                {SCENARIOS_DEF.map(sc => {
                  const isS = scenario === sc.id;
                  return <div key={sc.id} onMouseEnter={() => setScenarioHoverId(sc.id)} onClick={() => { setScenario(sc.id); setTimeout(() => scrollToSection("panel"), 100); }} style={{ borderRadius: 16, padding: 16, cursor: "pointer", border: `2px solid ${isS ? C.primary : C.border}`, background: isS ? C.primarySoft : C.surface, transition: TR, boxShadow: isS ? `0 0 0 4px ${C.primarySoft}` : SHC }}>
                    <ScenarioStepIcon scenarioId={sc.id} size={28} selected={isS} color={isS ? C.primary : C.tp} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: isS ? C.primary : C.tp, marginBottom: 2 }}>{sc.label}</div>
                    <div style={{ fontSize: 11, color: C.ts, lineHeight: 1.4 }}>{sc.description}</div>
                  </div>;
                })}
              </div>
            </div>
            {scenarioDef?.hasTecho && <div style={{ marginTop: 16 }} onMouseEnter={() => setAguasVisorHighlight(true)} onMouseLeave={() => setAguasVisorHighlight(false)}>
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
              <div style={{ display: "grid", gridTemplateColumns: twoCol, gap: 10 }}>
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
                        <ColorChips colors={pd.col} value={line.color} onChange={(c) => updateLibrePanelLine(idx, { color: c })} onHover={line.tipo === "techo" ? setHoverTechoColor : setHoverParedColor} notes={pd.colNotes || {}} familia={line.familia} />
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
              <div style={{ display: "grid", gridTemplateColumns: threeCol, gap: 10 }}>
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
              <ColorChips colors={techoPanelData.col} value={techo.color} onChange={c => uT("color", c)} onHover={setHoverTechoColor} notes={techoPanelData.colNotes || {}} familia={techo.familia} />
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
              <ColorChips colors={paredPanelData.col} value={pared.color} onChange={c => uP("color", c)} onHover={setHoverParedColor} notes={paredPanelData.colNotes || {}} familia={pared.familia} />
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
            const globalPm = techo.pendienteModo || "incluye_pendiente";
            const is2A = techo.tipoAguas === "dos_aguas";
            const baseArea = zonasTotales.area;
            const areaReal = techo.zonas?.reduce((s, z) => {
              const zPm = z.pendienteModo ?? globalPm;
              const zPend = z.pendiente ?? techo.pendiente ?? 0;
              const lr = calcLargoRealFromModo(z.largo, zPm, zPend, z.alturaDif ?? techo.alturaDif ?? 0);
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
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setRoofRealistic3dOn((v) => !v)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: `1.5px solid ${roofRealistic3dOn ? C.primary : C.border}`,
                  background: roofRealistic3dOn ? C.primarySoft : C.surface,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  color: roofRealistic3dOn ? C.primary : C.tp,
                }}
              >
                {roofRealistic3dOn ? "Ocultar render 3D (textura)" : "Ver render 3D (textura catálogo)"}
              </button>
              <span style={{ fontSize: 11, color: C.ts, lineHeight: 1.4, maxWidth: 420 }}>
                Misma geometría que el presupuesto; textura según familia de panel techo.
              </span>
            </div>
            {roofRealistic3dOn && techoPanelData ? (
              <div style={{ marginBottom: 14 }}>
                <Suspense
                  fallback={
                    <div
                      style={{
                        padding: 40,
                        textAlign: "center",
                        color: C.ts,
                        fontSize: 13,
                        background: C.surfaceAlt,
                        borderRadius: 10,
                        border: `1px solid ${C.border}`,
                      }}
                    >
                      Cargando vista 3D…
                    </div>
                  }
                >
                  <RoofPanelRealisticScene
                    validZonas={(techo.zonas || []).filter((z) => z?.largo > 0 && z?.ancho > 0)}
                    tipoAguas={techo.tipoAguas}
                    pendiente={techo.pendiente}
                    familiaKey={techo.familia}
                    espesorMm={techo.espesor}
                    panelAu={techoPanelData?.au ?? 1.12}
                    techoColor={techo.color || ""}
                  />
                </Suspense>
              </div>
            ) : null}
            {techo.zonas.map((zona, idx) => (
              <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10, padding: 12, borderRadius: 10, background: C.surfaceAlt }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  {idx === effectivePrincipalZonaGi && (
                    <span style={{ fontSize: 10, fontWeight: 800, color: C.primary, textTransform: "uppercase", letterSpacing: "0.05em", padding: "2px 6px", borderRadius: 6, background: C.primarySoft, border: `1px solid ${C.primary}` }}>Techo principal</span>
                  )}
                  {isLateralAnnexZona(zona) && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.04em", padding: "2px 6px", borderRadius: 6, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.35)" }}>Anexo lateral · Zona {idx + 1}</span>
                  )}
                  {techo.zonas.length > 1 && idx !== effectivePrincipalZonaGi && !isLateralAnnexZona(zona) && (
                    <span style={{ fontSize: 10, fontWeight: 500, color: C.ts }}>Zona independiente · Principal debajo</span>
                  )}
                </div>
                <div data-stepper-group style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: isPhone ? "wrap" : "nowrap" }}>
                <div style={{ flex: 1 }}>
                  <StepperInput label={`Largo ${techo.zonas.length > 1 ? idx + 1 : ""} (m)`} value={zona.largo} onChange={v => updateZona(idx, "largo", v)} min={1} max={20} step={0.01} bumpStep={BUMP_STEP_LARGO_M} unit="m" decimals={2} chainFocus />
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
                      chainFocus
                    />
                  ) : (
                    <StepperInput
                      label={`Ancho ${techo.zonas.length > 1 ? idx + 1 : ""} (m)`}
                      value={zona.ancho}
                      onChange={v => updateZona(idx, "ancho", v)}
                      min={1}
                      max={20}
                      step={0.01}
                      bumpStep={BUMP_STEP_METROS}
                      unit="m"
                      decimals={2}
                      chainFocus
                    />
                  )}
                </div>
                <div style={{ fontSize: 11, color: C.ts, minWidth: 50, textAlign: isPhone ? "left" : "right", paddingBottom: 8 }}>
                  {(zona.largo * zona.ancho).toFixed(1)}m²
                </div>
                {techo.zonas.length > 1 && (
                  <button onClick={() => removeZona(idx)} style={{ padding: 6, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: C.danger, marginBottom: 4 }}>
                    <Trash2 size={14} />
                  </button>
                )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                  {techo.zonas.length > 1 && idx !== effectivePrincipalZonaGi && (
                    <button type="button" onClick={() => uT("zonaPrincipalGi", idx)} style={{ alignSelf: "flex-start", padding: "4px 8px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surfaceAlt, fontSize: 10, fontWeight: 500, cursor: "pointer", color: C.ts }}>Usar esta zona como techo principal</button>
                  )}
                  <button
                    type="button"
                    onClick={() => addLateralAnnexForParent(idx)}
                    style={{
                      alignSelf: "stretch",
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1.5px solid rgba(99,102,241,0.45)",
                      background: "rgba(99,102,241,0.08)",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      color: "#4f46e5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                    }}
                    title="Otro tramo con distinto largo o ancho de panel, pegado al costado de esta zona (mismo cuerpo de techo)"
                  >
                    <Plus size={14} /> Otra medida (mismo cuerpo)
                  </button>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, color: C.ts, lineHeight: 1.4 }}>
                En cada zona: <strong style={{ color: C.tp }}>+ Otra medida</strong> suma un tramo lateral con otras dimensiones en el <strong>mismo cuerpo</strong>. Abajo: <strong style={{ color: C.tp }}>otro cuerpo de techo</strong> (zona independiente en planta).
              </div>
              <button type="button" onClick={addZona} title="Superficie independiente en planta (otro cuerpo de techo)" style={{ width: "100%", padding: "10px 16px", borderRadius: 10, border: `1.5px dashed ${C.border}`, background: C.surfaceAlt, fontSize: 13, cursor: "pointer", color: C.tp, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Plus size={14} /> Otro cuerpo de techo
              </button>
            </div>

            {/* Pendiente de techo */}
            <div style={{ marginTop: 16, padding: 12, background: C.surfaceAlt, borderRadius: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Modo de cálculo del largo</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                {PENDIENTE_MODOS.map(m => (
                  <button key={m.id} onClick={() => uT("pendienteModo", m.id)} style={{ padding: 10, borderRadius: 10, border: `2px solid ${(techo.pendienteModo || "incluye_pendiente") === m.id ? C.primary : C.border}`, background: (techo.pendienteModo || "incluye_pendiente") === m.id ? C.primarySoft : C.surface, textAlign: "left", cursor: "pointer", transition: TR }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: (techo.pendienteModo || "incluye_pendiente") === m.id ? C.primary : C.tp }}>{m.label}</span>
                    <span style={{ display: "block", fontSize: 10, color: C.ts, marginTop: 2 }}>{m.desc}</span>
                  </button>
                ))}
              </div>
              {(techo.pendienteModo || "incluye_pendiente") === "calcular_pendiente" && (
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
              {(techo.pendienteModo || "incluye_pendiente") === "calcular_altura" && (
                <div style={{ marginBottom: 8 }}>
                  <StepperInput label="Diferencia de altura (apoyo sup. − inf.)" value={techo.alturaDif ?? 0} onChange={v => uT("alturaDif", v)} min={0} max={10} step={0.1} unit="m" />
                </div>
              )}
              {((techo.pendienteModo || "incluye_pendiente") === "calcular_pendiente" && techo.pendiente > 0) || ((techo.pendienteModo || "incluye_pendiente") === "calcular_altura" && (techo.alturaDif ?? 0) > 0) ? (
                <div style={{ marginTop: 8, fontSize: 11, color: C.ts, display: "flex", gap: 16, flexWrap: "wrap", ...TN }}>
                  {(techo.pendienteModo || "incluye_pendiente") === "calcular_pendiente" && techo.pendiente > 0 && (
                    <>
                      <span>Factor: <b style={{ color: C.tp }}>×{fp.toFixed(4)}</b></span>
                      <span>Incremento: <b style={{ color: C.primary }}>+{((fp - 1) * 100).toFixed(1)}%</b></span>
                    </>
                  )}
                  {techo.zonas?.[0] && (
                    <span>Largo real zona 1: <b style={{ color: C.tp }}>{calcLargoRealFromModo(techo.zonas[0].largo, techo.zonas[0].pendienteModo ?? techo.pendienteModo ?? "incluye_pendiente", techo.zonas[0].pendiente ?? techo.pendiente ?? 0, techo.zonas[0].alturaDif ?? techo.alturaDif ?? 0).toFixed(2)}m</b> (de {techo.zonas[0].largo}m proy.)</span>
                  )}
                </div>
              ) : null}
            </div>

            {techoPanelData && techo.zonas?.some(z => {
              const zPm = z.pendienteModo ?? techo.pendienteModo ?? "incluye_pendiente";
              const zPend = z.pendiente ?? techo.pendiente ?? 0;
              const lr = calcLargoRealFromModo(z.largo, zPm, zPend, z.alturaDif ?? techo.alturaDif ?? 0);
              return lr < techoPanelData.lmin || lr > techoPanelData.lmax;
            }) && (
              <div style={{ marginTop: 8 }}>
                <AlertBanner
                  type="warning"
                  message={(techo.pendienteModo || "incluye_pendiente") === "calcular_pendiente" && techo.pendiente > 0
                    ? `Algún largo real (con pendiente ${techo.pendiente}°) está fuera del rango fabricable (${techoPanelData.lmin}m - ${techoPanelData.lmax}m)`
                    : (techo.pendienteModo || "incluye_pendiente") === "calcular_altura"
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
            <div style={{ display: "grid", gridTemplateColumns: twoCol, gap: 12 }}>
              <StepperInput label="Alto (m)" value={pared.alto} onChange={v => uP("alto", v)} min={1} max={14} step={0.5} unit="m" />
              <StepperInput label="Perímetro (m)" value={pared.perimetro} onChange={v => uP("perimetro", v)} min={4} max={500} step={1} unit="m" />
            </div>
            {vis.esquineros && <div style={{ display: "grid", gridTemplateColumns: twoCol, gap: 12, marginTop: 12 }}>
              <StepperInput label="Esquinas ext." value={pared.numEsqExt} onChange={v => uP("numEsqExt", v)} min={0} max={20} step={1} decimals={0} />
              <StepperInput label="Esquinas int." value={pared.numEsqInt} onChange={v => uP("numEsqInt", v)} min={0} max={20} step={1} decimals={0} />
            </div>}
          </div>}

          {/* Cámara frigorífica */}
          {vis.camara && <div style={sectionS}>
            <div style={labelS}>DIMENSIONES CÁMARA (internas)</div>
            <div style={{ display: "grid", gridTemplateColumns: threeCol, gap: 12 }}>
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
                zonasBorders={techo.zonas?.map(z => z.preview?.borders ?? {})}
                onZonaBorderChange={(gi, side, val) => updateZonaPreview(gi, { borders: { ...techo.zonas[gi]?.preview?.borders, [side]: val } })}
                zonaEncounters={techo.zonas?.map(z => z.preview?.encounters ?? {})}
                onZonaEncounterChange={(gi, side, enc) => updateZonaPreview(gi, { encounters: { ...techo.zonas[gi]?.preview?.encounters, [side]: enc } })}
                onZonaPreviewChange={updateZonaPreview}
                pendiente={techo.pendiente}
                panelAu={techoPanelData?.au ?? 1.12}
                canvasPortalTargetRef={showRoof3DHost ? roof3dHostRef : null}
                minimalChrome={Boolean(showRoof3DHost)}
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
                <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Material por apoyo (techo)</div>
                {apoyoMateriales && apoyoMateriales.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {apoyoMateriales.map((mat, ri) => {
                      const isPerim = ri === 0 || ri === apoyoMateriales.length - 1;
                      const label = isPerim ? `Apoyo ${ri + 1} (P)` : `Apoyo ${ri + 1} (I)`;
                      return (
                        <div key={ri} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ flex: 1, fontSize: 11, fontWeight: 500, color: C.tp }}>{label}</div>
                          <div style={{ display: "flex", gap: 3 }}>
                            {COMBINADA_MATERIAL_ORDER.map((m) => (
                              <button
                                key={m}
                                onClick={() => handleApoyoMaterialDirect(ri, m)}
                                style={{
                                  padding: "3px 7px",
                                  borderRadius: 6,
                                  border: `1.5px solid ${mat === m ? (m === "hormigon" ? "#0ea5e9" : m === "madera" ? "#b45309" : "#1e293b") : C.border}`,
                                  background: mat === m ? (m === "hormigon" ? "#e0f2fe" : m === "madera" ? "#fef3c7" : "#f1f5f9") : C.surface,
                                  fontSize: 10,
                                  fontWeight: mat === m ? 700 : 400,
                                  cursor: "pointer",
                                  color: mat === m ? (m === "hormigon" ? "#0369a1" : m === "madera" ? "#92400e" : "#1e293b") : C.ts,
                                }}
                              >
                                {m === "hormigon" ? "H" : m === "madera" ? "Mad" : "Met"}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ fontSize: 10, color: C.ts, marginTop: 4 }}>
                      {techo.ptsHorm ?? 0}H / {techo.ptsMetal ?? 0}Met / {techo.ptsMadera ?? 0}Mad = {(techo.ptsHorm ?? 0) + (techo.ptsMetal ?? 0) + (techo.ptsMadera ?? 0)} fij.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <StepperInput label="Fijaciones en Hormigón" value={techo.ptsHorm ?? 0} onChange={v => patchTechoCombinadaPts("ptsHorm", v)} min={0} max={9999} step={1} unit="unid" decimals={0} />
                    <StepperInput label="Fijaciones a Metal" value={techo.ptsMetal ?? 0} onChange={v => patchTechoCombinadaPts("ptsMetal", v)} min={0} max={9999} step={1} unit="unid" decimals={0} />
                    <StepperInput label="Fijaciones a Madera" value={techo.ptsMadera ?? 0} onChange={v => patchTechoCombinadaPts("ptsMadera", v)} min={0} max={9999} step={1} unit="unid" decimals={0} />
                  </div>
                )}
              </div>
            )}
            
            {/* Referencia estructural en la columna izquierda cuando corresponda (a partir del paso 5) */}
            {wizardStep >= 5 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.ts, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Referencia de montaje</div>
                <div style={{ borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden", background: C.surfaceAlt }}>
                  <img
                    src={`${import.meta.env.BASE_URL}images/estructura-referencia.png`}
                    alt="Referencia de estructura y montaje"
                    style={{ width: "100%", height: "auto", display: "block" }}
                    decoding="async"
                  />
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
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8, padding: 8, borderRadius: 8, background: C.surfaceAlt }}>
                <SegmentedControl value={ab.tipo} onChange={v => { const next = [...pared.aberturas]; next[i] = { ...next[i], tipo: v }; uP("aberturas", next); }} options={[{ id: "puerta", label: "Puerta" }, { id: "ventana", label: "Ventana" }]} />
                <input type="number" placeholder="Ancho" value={ab.ancho} onChange={e => { const next = [...pared.aberturas]; next[i] = { ...next[i], ancho: parseFloat(e.target.value) || 0 }; uP("aberturas", next); }} style={{ ...inputS, width: isPhone ? "100%" : 70, padding: "6px 8px" }} />
                <span style={{ color: C.ts, fontSize: 13 }}>×</span>
                <input type="number" placeholder="Alto" value={ab.alto} onChange={e => { const next = [...pared.aberturas]; next[i] = { ...next[i], alto: parseFloat(e.target.value) || 0 }; uP("aberturas", next); }} style={{ ...inputS, width: isPhone ? "100%" : 70, padding: "6px 8px" }} />
                <input type="number" placeholder="Cant" value={ab.cant} onChange={e => { const next = [...pared.aberturas]; next[i] = { ...next[i], cant: parseInt(e.target.value) || 1 }; uP("aberturas", next); }} style={{ ...inputS, width: isPhone ? "100%" : 50, padding: "6px 8px" }} />
                <button onClick={() => { const next = pared.aberturas.filter((_, j) => j !== i); uP("aberturas", next); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.danger }}><Trash2 size={14} /></button>
              </div>
            ))}
            <button onClick={() => uP("aberturas", [...pared.aberturas, { tipo: "puerta", ancho: 0.9, alto: 2.1, cant: 1 }])} style={{ padding: "8px 16px", borderRadius: 10, border: `1.5px dashed ${C.border}`, background: C.surface, fontSize: 13, cursor: "pointer", color: C.primary, fontWeight: 500 }}>+ Agregar abertura</button>
          </div>}
            </>
          )}
        </div>
        </Panel>
        <PanelResizeHandle
          className={`bmc-sash${isCompactLayout ? " bmc-sash--vertical" : ""}`}
          style={isCompactLayout ? { height: 10, flexShrink: 0 } : undefined}
          hitAreaMargins={isCompactLayout ? { top: 4, bottom: 4, left: 0, right: 0 } : { left: 4, right: 4, top: 0, bottom: 0 }}
          onDoubleClick={(e) => { e.preventDefault(); if (!isCompactLayout) resetMainSplitLayout(); }}
        />
        <Panel defaultSize={isCompactLayout ? 45 : 72} minSize={isCompactLayout ? 20 : 38} style={{ minWidth: 0, minHeight: 0, display: "flex" }}>
        {/* RIGHT PANEL */}
        <div className="bmc-right-panel" style={{ position: "relative", flex: 1, minHeight: 0, minWidth: 0, overflowY: isCompactLayout ? "visible" : "auto", overflowX: "hidden", paddingLeft: isCompactLayout ? 0 : 8, paddingBottom: groups.length > 0 && isCompactLayout ? 96 : 0 }}>
          {useDockedRoofBorderSelector && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0,0,0,0)",
                pointerEvents: "none",
              }}
            >
              <RoofBorderSelector {...roofBorderDockProps} />
            </div>
          )}
          <QuoteVisualVisor
            scenarioId={scenario}
            hoverScenarioId={scenarioHoverId}
            stepId={activeWizardStepId}
            tipoAguas={techo.tipoAguas || "una_agua"}
            techoFamilia={techo.familia || ""}
            hoverTechoFamilia={activeWizardStepId === "familia" ? hoverTechoFamilia : ""}
            techoColor={techo.color || ""}
            hoverTechoColor={activeWizardStepId === "color" || activeWizardStepId === "color_pared" ? hoverTechoColor || hoverParedColor : ""}
            aguasHighlight={aguasVisorHighlight}
            showRoof3DStage={showRoof3DHost}
            roofCanvasHostRef={roof3dHostRef}
            onRoofCanvasHostReady={bumpRoof3dHostReady}
            techoBorders={techo.borders}
            techoZonasBorders={techo.zonas?.map((z) => z.preview?.borders ?? {})}
            dimensionSummary={quoteVisorDimensionSummary}
            roof2DPreview={roof2DPreviewForVisor}
            onSelectAgua={activeWizardStepId === "tipoAguas" ? (v) => {
              if (v === "dos_aguas") setTecho(t => ({ ...t, tipoAguas: v, borders: { ...t.borders, fondo: "cumbrera" } }));
              else setTecho(t => ({ ...t, tipoAguas: v, borders: { ...t.borders, fondo: t.borders.fondo === "cumbrera" ? "gotero_lateral" : t.borders.fondo } }));
            } : null}
            onNext={activeWizardStepId === "tipoAguas" ? advanceWizardStep : null}
          />
          {/* KPI Row */}
          {results && !results.error && !scenarioDef?.isLibre && activeWizardStepId !== "estructura" && <div ref={pdfCaptureSummaryRef} style={{ display: "grid", gridTemplateColumns: fourCol, gap: 12, marginBottom: 16 }}>
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
        </Panel>
      </PanelGroup>

      <PanelinChatPanel
        isOpen={chatOpen}
        onClose={() => {
          if (isDetachedChatWindow && typeof window !== "undefined") {
            window.close();
            return;
          }
          setChatOpen(false);
        }}
        {...chat}
        devMode={devMode}
        onToggleDevMode={toggleDevMode}
        detachedMode={isDetachedChatWindow}
        onOpenDetachedWindow={openDetachedChatWindow}
        devMeta={chat.devMeta}
        trainingEntries={chat.trainingEntries}
        trainingStats={chat.trainingStats}
        promptPreview={chat.promptPreview}
        promptSections={chat.promptSections}
        onSaveCorrection={chat.saveCorrection}
        onReloadTrainingKB={chat.reloadTrainingKB}
        onReloadPromptPreview={chat.reloadPromptPreview}
        onReloadPromptSections={chat.reloadPromptSections}
        onSavePromptSection={chat.savePromptSection}
        onVerifyCalculation={chat.verifyCalculation}
      />

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
