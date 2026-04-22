// src/components/CalcLogicInspector.jsx
// Inspector visual completo de todas las lógicas de cálculo BMC.
// Cubre techo (paneles, autoportancia, fijaciones, perfilería, selladores)
// y pared (paneles, fijaciones, perfiles, esquineros, selladores).
// El módulo "Parámetros" edita todos los factores de fórmula y persiste en localStorage.

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  calcPanelesTecho,
  calcAutoportancia,
  calcFijacionesVarilla,
  calcFijacionesCaballete,
  calcPerfileriaTecho,
  calcSelladoresTecho,
  calcPanelesPared,
  calcFijacionesPared,
  calcPerfilesU,
  calcPerfilesParedExtra,
  calcEsquineros,
  calcSelladorPared,
} from '../utils/calculations.js';
import { getDimensioningItemsFlat, applyDimensioningImport } from '../utils/dimensioningFormulas.js';
import { getDimensioningOverrides, setDimensioningOverridesBulk, resetDimensioningOverrides } from '../utils/dimensioningFormulasOverrides.js';
import { getPricing } from '../data/pricing.js';
import { compareKingspanVsBMC, statusColor, statusLabel } from '../utils/kingspanComparison.js';

// ── Paleta ──────────────────────────────────────────────────────────────────
const BLUE   = '#0071E3';
const RED    = '#E44C4C';
const GREEN  = '#34C759';
const GOLD   = '#FF9F0A';
const PURPLE = '#AF52DE';
const TEAL   = '#00C7BE';
const GRAY   = '#6E6E73';

// ── Módulos ──────────────────────────────────────────────────────────────────
const MODULES = [
  // ── TECHO ──
  {
    id: 'paneles-techo', category: 'TECHO', label: 'Paneles Techo', sub: 'Cantidades + área',
    color: BLUE, panelKey: 'ISODEC_EPS', panelSide: 'techo',
    espesores: [80, 100, 150, 200, 250],
    defaultInputs: { largo: 6, ancho: 5, espesor: 100 },
    sliders: [
      { key: 'largo', label: 'Largo real (m)', min: 2, max: 15, step: 0.5, unit: ' m' },
      { key: 'ancho', label: 'Ancho cubierta (m)', min: 1, max: 15, step: 0.5, unit: ' m' },
    ],
  },
  {
    id: 'autoportancia', category: 'TECHO', label: 'Autoportancia', sub: 'Apoyos intermedios',
    color: GOLD, panelKey: 'ISODEC_EPS', panelSide: 'techo',
    espesores: [80, 100, 150, 200, 250],
    defaultInputs: { largo: 6, espesor: 100 },
    sliders: [
      { key: 'largo', label: 'Largo panel (m)', min: 2, max: 14, step: 0.5, unit: ' m' },
    ],
  },
  {
    id: 'fij-isodec', category: 'TECHO', label: 'Fijaciones ISODEC', sub: 'Varilla / Tuerca',
    color: BLUE, panelKey: 'ISODEC_EPS', panelSide: 'techo',
    espesores: [80, 100, 150, 200, 250],
    tipoEst: true,
    defaultInputs: { largo: 6, cantP: 4, espesor: 100, tipoEst: 'metal' },
    sliders: [
      { key: 'largo', label: 'Largo (m)', min: 2, max: 12, step: 0.5, unit: ' m' },
      { key: 'cantP', label: 'Paneles en ancho', min: 1, max: 12, step: 1, unit: ' und' },
    ],
  },
  {
    id: 'fij-isoroof', category: 'TECHO', label: 'Fijaciones ISOROOF', sub: 'Caballete / Tornillo',
    color: RED, panelKey: 'ISOROOF_3G', panelSide: 'techo',
    espesores: [30, 50, 80],
    tipoEst: true,
    defaultInputs: { largo: 5, cantP: 4, espesor: 30, tipoEst: 'metal' },
    sliders: [
      { key: 'largo', label: 'Largo (m)', min: 2, max: 12, step: 0.5, unit: ' m' },
      { key: 'cantP', label: 'Paneles en ancho', min: 1, max: 12, step: 1, unit: ' und' },
    ],
  },
  {
    id: 'perfileria-techo', category: 'TECHO', label: 'Perfilería Techo', sub: 'Bordes + canalón',
    color: TEAL, panelKey: 'ISODEC_EPS', panelSide: 'techo',
    espesores: [80, 100, 150, 200, 250],
    defaultInputs: { largo: 6, ancho: 5, espesor: 100, bordeFrente: 'gotero_frontal', bordeOtros: 'babeta_adosar' },
    sliders: [
      { key: 'largo', label: 'Largo (m)', min: 2, max: 15, step: 0.5, unit: ' m' },
      { key: 'ancho', label: 'Ancho (m)', min: 1, max: 15, step: 0.5, unit: ' m' },
    ],
  },
  {
    id: 'selladores-techo', category: 'TECHO', label: 'Selladores Techo', sub: 'Silicona + cinta + membrana',
    color: PURPLE, panelKey: 'ISODEC_EPS', panelSide: 'techo',
    espesores: [80, 100, 150, 200, 250],
    defaultInputs: { largo: 6, cantP: 5, espesor: 100 },
    sliders: [
      { key: 'largo', label: 'Largo real (m)', min: 2, max: 15, step: 0.5, unit: ' m' },
      { key: 'cantP', label: 'Paneles', min: 1, max: 20, step: 1, unit: ' und' },
    ],
  },
  // ── PARED ──
  {
    id: 'paneles-pared', category: 'PARED', label: 'Paneles Pared', sub: 'Cantidades + área',
    color: GREEN, panelKey: 'ISOWALL', panelSide: 'pared',
    espesores: [50, 75, 100],
    defaultInputs: { alto: 3, perimetro: 10, espesor: 50 },
    sliders: [
      { key: 'alto', label: 'Alto (m)', min: 1.5, max: 6, step: 0.25, unit: ' m' },
      { key: 'perimetro', label: 'Perímetro (m)', min: 2, max: 40, step: 0.5, unit: ' m' },
    ],
  },
  {
    id: 'fij-pared', category: 'PARED', label: 'Fijaciones Pared', sub: 'Anclaje H + T2 + Remache',
    color: GREEN, panelKey: 'ISOWALL', panelSide: 'pared',
    espesores: [50, 75, 100],
    tipoEst: true,
    defaultInputs: { alto: 3, cantP: 5, espesor: 50, tipoEst: 'metal' },
    sliders: [
      { key: 'alto', label: 'Alto (m)', min: 1.5, max: 6, step: 0.25, unit: ' m' },
      { key: 'cantP', label: 'Paneles', min: 1, max: 20, step: 1, unit: ' und' },
    ],
  },
  {
    id: 'perfiles-pared', category: 'PARED', label: 'Perfiles Pared', sub: 'Perfil U + K2 + G2',
    color: TEAL, panelKey: 'ISOWALL', panelSide: 'pared',
    espesores: [50, 75, 100],
    defaultInputs: { alto: 3, cantP: 5, espesor: 50, perimetro: 8 },
    sliders: [
      { key: 'alto', label: 'Alto (m)', min: 1.5, max: 6, step: 0.25, unit: ' m' },
      { key: 'cantP', label: 'Paneles', min: 1, max: 20, step: 1, unit: ' und' },
      { key: 'perimetro', label: 'Perímetro (m)', min: 2, max: 40, step: 0.5, unit: ' m' },
    ],
  },
  {
    id: 'esquineros', category: 'PARED', label: 'Esquineros', sub: 'Ext. e Int.',
    color: GOLD, panelKey: 'ISOWALL', panelSide: 'pared',
    espesores: [50, 75, 100],
    defaultInputs: { alto: 3, numExt: 2, numInt: 1 },
    sliders: [
      { key: 'alto', label: 'Alto (m)', min: 1.5, max: 6, step: 0.25, unit: ' m' },
      { key: 'numExt', label: 'Esquinas ext.', min: 0, max: 8, step: 1, unit: '' },
      { key: 'numInt', label: 'Esquinas int.', min: 0, max: 8, step: 1, unit: '' },
    ],
  },
  {
    id: 'selladores-pared', category: 'PARED', label: 'Selladores Pared', sub: 'Silicona + cinta + membrana',
    color: PURPLE, panelKey: 'ISOWALL', panelSide: 'pared',
    espesores: [50, 75, 100],
    defaultInputs: { alto: 3, cantP: 5, perimetro: 8 },
    sliders: [
      { key: 'alto', label: 'Alto (m)', min: 1.5, max: 6, step: 0.25, unit: ' m' },
      { key: 'cantP', label: 'Paneles', min: 1, max: 20, step: 1, unit: ' und' },
      { key: 'perimetro', label: 'Perímetro (m)', min: 2, max: 40, step: 0.5, unit: ' m' },
    ],
  },
];

const TIPOS_EST = [
  { value: 'metal', label: 'Metal' },
  { value: 'madera', label: 'Madera' },
  { value: 'hormigon', label: 'Hormigón' },
];

const CATEGORIES = ['TECHO', 'PARED'];

// Path prefixes that control each module's formula parameters
const MODULE_PARAM_PREFIXES = {
  'paneles-techo':    ['PANELS_TECHO.'],
  'autoportancia':    ['PANELS_TECHO.'],
  'fij-isodec':       ['FIJACIONES_VARILLA.'],
  'fij-isoroof':      ['FIJACIONES_CABALETE.'],
  'perfileria-techo': ['PERFILERIA.'],
  'selladores-techo': ['SELLADORES_TECHO.'],
  'paneles-pared':    ['PANELS_PARED.'],
  'fij-pared':        ['FIJACIONES_PARED.'],
  'perfiles-pared':   ['PERFILERIA.', 'PANELS_PARED.'],
  'esquineros':       [],
  'selladores-pared': ['SELLADORES_PARED.'],
};

// ── Config version utilities ─────────────────────────────────────────────────
const CONFIG_VERSIONS_KEY = 'bmc-inspector-config-versions';

function getConfigVersions() {
  try {
    const raw = localStorage.getItem(CONFIG_VERSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveConfigVersion(name) {
  const params = getDimensioningOverrides();
  const versions = getConfigVersions();
  const v = {
    id: `v_${Date.now()}`,
    name: name.trim() || `Versión ${new Date().toLocaleDateString('es-UY')}`,
    date: new Date().toISOString(),
    params,
    overrideCount: Object.keys(params).length,
  };
  versions.unshift(v);
  localStorage.setItem(CONFIG_VERSIONS_KEY, JSON.stringify(versions));
  return v;
}

function deleteConfigVersion(id) {
  const versions = getConfigVersions().filter(v => v.id !== id);
  localStorage.setItem(CONFIG_VERSIONS_KEY, JSON.stringify(versions));
}

// ═══════════════════════════════════════════════════════════════════════════
// SVG COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function PanelesTechoSVG({ cantP, largo, au = 1.12, color = BLUE }) {
  const W = 300; const H = 180; const PAD = 28;
  const vizCantP = Math.min(cantP, 8);
  const vizLargo = Math.min(largo, 8);
  const cellW = (W - PAD * 2) / vizCantP;
  const cellH = (H - PAD * 2 - 24);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
      <rect width={W} height={H} fill="#F0F4F8" rx={8} />
      {Array.from({ length: vizCantP }, (_, i) => (
        <rect key={i} x={PAD + i * cellW + 0.5} y={PAD} width={cellW - 1} height={cellH}
          fill={i % 2 === 0 ? '#E8F4FD' : '#F0F8FF'} stroke={color} strokeWidth={0.8} rx={1} />
      ))}
      {vizCantP < cantP && (
        <text x={W - PAD + 3} y={PAD + cellH / 2} fontSize={9} fill={color} opacity={0.5}>+{cantP - vizCantP}</text>
      )}
      <text x={W / 2} y={H - 8} fontSize={9} textAnchor="middle" fill={GRAY}>
        {cantP} panel{cantP !== 1 ? 'es' : ''} · {(cantP * au).toFixed(2)} m ancho · {largo} m largo
      </text>
      <text x={PAD - 4} y={PAD + cellH / 2} fontSize={8} textAnchor="end" fill={GRAY}
        transform={`rotate(-90, ${PAD - 12}, ${PAD + cellH / 2})`}>{vizLargo.toFixed(1)} m</text>
      <line x1={PAD} y1={PAD + cellH + 4} x2={PAD + vizCantP * cellW} y2={PAD + cellH + 4} stroke={color} strokeWidth={0.7} opacity={0.4} />
      <text x={PAD + vizCantP * cellW / 2} y={PAD + cellH + 14} fontSize={8} textAnchor="middle" fill={color}>
        {au.toFixed(3)} m/panel (au)
      </text>
    </svg>
  );
}

function AutoportanciaSVG({ largo, apoyos, maxSpan, ok, color = GOLD }) {
  const W = 300; const H = 150; const PAD = 24;
  const n = Math.max(apoyos ?? 2, 2);
  const pxW = W - PAD * 2;
  const roofY = 50; const roofH = 20;
  const structY = roofY + roofH + 18;
  const supportXs = Array.from({ length: n }, (_, i) => PAD + (n > 1 ? i / (n - 1) : 0.5) * pxW);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
      <rect width={W} height={H} fill="#F0F4F8" rx={8} />
      <rect x={PAD} y={roofY} width={pxW} height={roofH} fill="#E8F4FD" stroke={color} strokeWidth={1} rx={2} />
      <text x={W / 2} y={roofY + roofH / 2 + 4} fontSize={9} textAnchor="middle" fill="#4A5568">Panel {largo.toFixed(1)} m</text>
      <rect x={PAD} y={structY} width={pxW} height={8} fill="#718096" rx={1} />
      {supportXs.map((x, i) => (
        <g key={i}>
          <line x1={x} y1={roofY + roofH} x2={x} y2={structY} stroke={color} strokeWidth={i === 0 || i === n - 1 ? 2.5 : 1.5} strokeDasharray={i === 0 || i === n - 1 ? 'none' : '4,2'} />
          <polygon points={`${x},${roofY + roofH - 2} ${x - 5},${roofY + roofH + 8} ${x + 5},${roofY + roofH + 8}`} fill={color} opacity={0.8} />
          <text x={x} y={structY + 20} fontSize={7.5} textAnchor="middle" fill={GRAY}>
            {i === 0 ? 'Alero' : i === n - 1 ? 'Cumbre' : `A${i}`}
          </text>
        </g>
      ))}
      {n > 2 && supportXs.slice(0, -1).map((x, i) => {
        const span = supportXs[i + 1] - x;
        return (
          <g key={`sp-${i}`}>
            <line x1={x + 2} y1={roofY - 10} x2={supportXs[i + 1] - 2} y2={roofY - 10} stroke={color} strokeWidth={0.7} strokeDasharray="3,2" />
            <text x={(x + supportXs[i + 1]) / 2} y={roofY - 14} fontSize={7} textAnchor="middle" fill={color}>
              {maxSpan ? `≤${maxSpan}m` : `${(span / (W - PAD * 2) * largo).toFixed(1)}m`}
            </text>
          </g>
        );
      })}
      <rect x={W - 70} y={6} width={64} height={18} rx={4} fill={ok ? '#34C75920' : '#FF3B3020'} />
      <text x={W - 38} y={19} fontSize={9} textAnchor="middle" fontWeight={700} fill={ok ? GREEN : '#FF3B30'}>
        {ok ? 'Vano OK' : 'Vano exc.'}
      </text>
    </svg>
  );
}

function ISoDECPlanta({ largo, cantP, apoyos, au = 1.12, color = BLUE }) {
  const PX = 52; const PAD = 34;
  const vizLargo = Math.min(largo, 10);
  const svgW = Math.min(cantP * au * PX + PAD * 2, 380);
  const svgH = vizLargo * PX + PAD * 2;
  const n = Math.max(apoyos, 2);
  const vizCantP = Math.min(cantP, Math.floor((svgW - PAD * 2) / (au * PX)));
  const supportLines = Array.from({ length: n }, (_, a) => ({
    y: PAD + (n > 1 ? a / (n - 1) : 0) * vizLargo * PX,
    isEdge: a === 0 || a === n - 1,
    label: a === 0 ? 'Alero' : a === n - 1 ? 'Cumbre' : `A${a}`,
  }));
  const dots = [];
  for (let p = 0; p < vizCantP; p++) {
    const px0 = PAD + p * au * PX;
    const pw = au * PX;
    for (let a = 0; a < n; a++) {
      const isEdge = a === 0 || a === n - 1;
      const py = n > 1 ? PAD + (a / (n - 1)) * vizLargo * PX : PAD + vizLargo * PX / 2;
      if (isEdge) {
        dots.push({ x: px0 + pw * 0.28, y: py, edge: true });
        dots.push({ x: px0 + pw * 0.72, y: py, edge: true });
      } else {
        dots.push({ x: px0 + pw * 0.5, y: py, edge: false });
      }
    }
  }
  const pvCount = 2 * Math.max(0, Math.ceil(largo / 2.5) - 1);
  const pvPts = [];
  if (pvCount > 0) {
    const pvSpacing = vizLargo / (pvCount / 2 + 1);
    for (let i = 0; i < Math.floor(pvCount / 2); i++) {
      const y = PAD + pvSpacing * (i + 1) * PX;
      pvPts.push({ x: PAD - 6, y }, { x: PAD + vizCantP * au * PX + 6, y });
    }
  }
  return (
    <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{ maxWidth: svgW, display: 'block', margin: '0 auto' }}>
      <rect x={0} y={0} width={svgW} height={svgH} fill="#F0F4F8" rx={8} />
      {Array.from({ length: vizCantP }, (_, p) => (
        <rect key={p} x={PAD + p * au * PX + 0.5} y={PAD} width={au * PX - 1} height={vizLargo * PX}
          fill="white" stroke="#CBD5E0" strokeWidth={0.8} rx={1} />
      ))}
      {supportLines.map((sl, i) => (
        <g key={i}>
          <line x1={PAD} y1={sl.y} x2={PAD + vizCantP * au * PX} y2={sl.y}
            stroke={sl.isEdge ? '#1A3A5C' : color} strokeWidth={sl.isEdge ? 2 : 1.5}
            strokeDasharray={sl.isEdge ? 'none' : '5,3'} opacity={0.8} />
          <text x={PAD - 4} y={sl.y + 3} fontSize={7.5} fill={GRAY} textAnchor="end">{sl.label}</text>
        </g>
      ))}
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.edge ? 5.5 : 4.5}
          fill={d.edge ? color : '#5AC8FA'} stroke="white" strokeWidth={1.5} opacity={0.9} />
      ))}
      {pvPts.map((pt, i) => (
        <circle key={`pv-${i}`} cx={pt.x} cy={pt.y} r={4} fill={GOLD} stroke="white" strokeWidth={1.5} opacity={0.85} />
      ))}
    </svg>
  );
}

function ISoDECSeccion({ espesorMm, tipoEst, color = BLUE }) {
  const W = 320; const H = 200;
  const panelH = Math.min(Math.max(30, espesorMm * 0.36), 75);
  const panelX = 65; const panelW = 180; const panelY = 50;
  const labelX = panelX + panelW + 10;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
      <rect width={W} height={H} fill="#F0F4F8" rx={8} />
      <polygon points={`${W/2},${panelY-26} ${W/2-7},${panelY-18} ${W/2+7},${panelY-18}`} fill={color} opacity={0.9} />
      <text x={labelX} y={panelY - 20} fontSize={8} fill={color}>Tuerca 3/8&quot;</text>
      <rect x={W/2 - 14} y={panelY - 14} width={28} height={5} fill={color} rx={2} opacity={0.75} />
      <text x={labelX} y={panelY - 10} fontSize={8} fill={color}>Arand. carrocero</text>
      <ellipse cx={W/2} cy={panelY - 6} rx={18} ry={7} fill={PURPLE} opacity={0.8} />
      <text x={labelX} y={panelY - 3} fontSize={8} fill={PURPLE}>Tortuga PVC</text>
      <rect x={panelX} y={panelY} width={panelW} height={4} fill="#A0AEC0" rx={1} />
      <rect x={panelX} y={panelY + 4} width={panelW} height={panelH - 8} fill="#E8F4FD" stroke="#CBD5E0" strokeWidth={0.5} />
      <rect x={panelX} y={panelY + panelH - 4} width={panelW} height={4} fill="#A0AEC0" rx={1} />
      <text x={W/2} y={panelY + panelH / 2 + 4} fontSize={8.5} textAnchor="middle" fill="#4A5568">Panel {espesorMm}mm</text>
      {tipoEst !== 'hormigon' && (
        <>
          <rect x={W/2 - 13} y={panelY + panelH + 1} width={26} height={4} fill="#718096" rx={1} />
          <text x={labelX} y={panelY + panelH + 7} fontSize={8} fill="#718096">Arand. plana 3/8&quot;</text>
        </>
      )}
      {tipoEst === 'metal' && <rect x={panelX} y={panelY + panelH + 14} width={panelW} height={13} fill="#718096" rx={2} />}
      {tipoEst === 'madera' && <rect x={panelX} y={panelY + panelH + 14} width={panelW} height={15} fill="#B5835A" rx={2} />}
      {tipoEst === 'hormigon' && (
        <>
          <rect x={panelX} y={panelY + panelH + 8} width={panelW} height={22} fill="#6E6E73" rx={2} />
          <rect x={W/2 - 5} y={panelY + panelH + 8} width={10} height={16} fill={GOLD} rx={2} opacity={0.9} />
          <text x={labelX} y={panelY + panelH + 20} fontSize={8} fill={GOLD}>Taco expansivo 3/8&quot;</text>
        </>
      )}
      <text x={W/2} y={panelY + panelH + (tipoEst === 'hormigon' ? 24 : 22)} fontSize={7.5} textAnchor="middle" fill="white">
        {tipoEst === 'metal' ? 'Estructura Metálica' : tipoEst === 'madera' ? 'Estructura Madera' : 'Hormigón'}
      </text>
      {tipoEst !== 'hormigon' && (
        <>
          <polygon points={`${W/2},${panelY+panelH+30} ${W/2-7},${panelY+panelH+38} ${W/2+7},${panelY+panelH+38}`} fill={color} opacity={0.9} />
          <text x={labelX} y={panelY + panelH + 36} fontSize={8} fill={color}>Tuerca 3/8&quot; (inf.)</text>
        </>
      )}
      <line x1={W/2} y1={panelY - 26} x2={W/2} y2={panelY + panelH + (tipoEst === 'hormigon' ? 24 : 38)} stroke={color} strokeWidth={2} opacity={0.7} />
      <line x1={panelX - 6} y1={panelY} x2={panelX - 6} y2={panelY + panelH} stroke="#AEB8C4" strokeWidth={0.8} />
      <text x={panelX - 10} y={panelY + panelH / 2 + 3} fontSize={8} fill={GRAY} textAnchor="middle"
        transform={`rotate(-90, ${panelX - 14}, ${panelY + panelH / 2})`}>{espesorMm}mm</text>
    </svg>
  );
}

function ISORoofSeccion({ espesorMm, tipoEst, color = RED }) {
  const W = 320; const H = 200;
  const ribH = Math.min(Math.max(20, espesorMm * 0.45), 60);
  const valleyY = 108; const valleyH = 8; const ribW = 52; const slopeW = 16;
  const v1X = 26; const v2X = 26 + slopeW + ribW;
  const profilePts = [
    [v1X, valleyY], [v1X + slopeW, valleyY - ribH],
    [v1X + slopeW + ribW, valleyY - ribH], [v1X + slopeW + ribW + slopeW, valleyY],
    [v2X + slopeW, valleyY], [v2X + slopeW + slopeW, valleyY - ribH],
    [v2X + slopeW + slopeW + ribW, valleyY - ribH], [v2X + slopeW + slopeW + ribW + slopeW, valleyY],
    [W - 26, valleyY],
  ];
  const path = profilePts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const closedPath = `${path} L${W-26},${valleyY + valleyH} L${v1X},${valleyY + valleyH} Z`;
  const rib1CX = v1X + slopeW + ribW / 2;
  const cabTopY = valleyY - ribH - 12;
  const labelX = rib1CX + ribW / 2 + 24;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
      <rect width={W} height={H} fill="#F0F4F8" rx={8} />
      {tipoEst === 'metal' && <rect x={v1X} y={valleyY + valleyH} width={W - v1X * 2} height={12} fill="#718096" rx={1} />}
      {tipoEst === 'madera' && <rect x={v1X} y={valleyY + valleyH} width={W - v1X * 2} height={15} fill="#B5835A" rx={1} />}
      {tipoEst === 'hormigon' && <rect x={v1X} y={valleyY + valleyH} width={W - v1X * 2} height={20} fill="#6E6E73" rx={1} />}
      <text x={W / 2} y={valleyY + valleyH + (tipoEst === 'hormigon' ? 14 : 10)} fontSize={7.5} textAnchor="middle" fill="white">
        {tipoEst === 'metal' ? 'Metálica' : tipoEst === 'madera' ? 'Madera' : 'Hormigón'}
      </text>
      <path d={closedPath} fill="#E8F4FD" stroke="#A0B8D0" strokeWidth={1} />
      <text x={W / 2} y={valleyY - ribH / 2 + 4} fontSize={8} textAnchor="middle" fill="#4A5568">{espesorMm}mm</text>
      <polygon points={`${rib1CX - 17},${valleyY - ribH} ${rib1CX + 17},${valleyY - ribH} ${rib1CX + 11},${cabTopY + 2} ${rib1CX - 11},${cabTopY + 2}`} fill={color} opacity={0.85} />
      <text x={labelX} y={valleyY - ribH + 4} fontSize={8} fill={color}>Caballete</text>
      {tipoEst === 'metal' && (
        <>
          <line x1={rib1CX} y1={cabTopY - 8} x2={rib1CX} y2={valleyY + valleyH + 12} stroke="#1A3A5C" strokeWidth={2} />
          <polygon points={`${rib1CX},${cabTopY - 13} ${rib1CX - 5},${cabTopY - 7} ${rib1CX + 5},${cabTopY - 7}`} fill="#1A3A5C" />
          <text x={labelX} y={cabTopY - 6} fontSize={8} fill="#1A3A5C">Torn. mecha {espesorMm < 50 ? '4"' : '6"'}</text>
        </>
      )}
      {tipoEst === 'madera' && (
        <>
          <line x1={rib1CX} y1={cabTopY - 8} x2={rib1CX} y2={valleyY + valleyH + 15} stroke="#B5835A" strokeWidth={2} />
          <polygon points={`${rib1CX},${cabTopY - 13} ${rib1CX - 5},${cabTopY - 7} ${rib1CX + 5},${cabTopY - 7}`} fill="#B5835A" />
          <text x={labelX} y={cabTopY - 6} fontSize={8} fill="#B5835A">Torn. aguja {espesorMm < 50 ? '4"' : '6"'}</text>
        </>
      )}
      {tipoEst === 'hormigon' && (
        <>
          <line x1={rib1CX} y1={cabTopY - 4} x2={rib1CX} y2={valleyY + valleyH + 15} stroke={GOLD} strokeWidth={2} />
          <rect x={rib1CX - 5} y={valleyY + valleyH + 5} width={10} height={12} fill={GOLD} rx={2} opacity={0.9} />
          <text x={labelX} y={cabTopY - 2} fontSize={8} fill={GOLD}>Varilla 8mm + Taco</text>
        </>
      )}
    </svg>
  );
}

function PerfileriaTechoSVG({ ancho, largo, cantP, color = TEAL }) {
  const W = 300; const H = 170; const PAD = 30;
  const pxW = W - PAD * 2; const pxH = H - PAD * 2 - 24;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
      <rect width={W} height={H} fill="#F0F4F8" rx={8} />
      <rect x={PAD} y={PAD} width={pxW} height={pxH} fill="white" stroke="#CBD5E0" strokeWidth={0.8} rx={2} />
      {/* Gotero frontal (frente) */}
      <rect x={PAD} y={PAD + pxH - 6} width={pxW} height={6} fill={color} rx={1} opacity={0.8} />
      <text x={PAD + pxW / 2} y={PAD + pxH + 14} fontSize={8} textAnchor="middle" fill={color}>Gotero frontal</text>
      {/* Babeta fondo */}
      <rect x={PAD} y={PAD} width={pxW} height={5} fill={GOLD} rx={1} opacity={0.8} />
      <text x={PAD + pxW + 3} y={PAD + 6} fontSize={8} fill={GOLD}>Babeta</text>
      {/* Babeta laterales */}
      <rect x={PAD} y={PAD + 5} width={5} height={pxH - 11} fill={GOLD} rx={1} opacity={0.6} />
      <rect x={PAD + pxW - 5} y={PAD + 5} width={5} height={pxH - 11} fill={GOLD} rx={1} opacity={0.6} />
      {/* Panel juntas */}
      {Array.from({ length: Math.min(cantP - 1, 7) }, (_, i) => {
        const x = PAD + ((i + 1) / cantP) * pxW;
        return <line key={i} x1={x} y1={PAD + 5} x2={x} y2={PAD + pxH - 6} stroke="#CBD5E0" strokeWidth={0.8} strokeDasharray="4,2" />;
      })}
      <text x={W / 2} y={H - 6} fontSize={8} textAnchor="middle" fill={GRAY}>{cantP} paneles · {ancho.toFixed(1)} m × {largo.toFixed(1)} m</text>
    </svg>
  );
}

function SelladoresTechoSVG({ cantP, largo, color = PURPLE }) {
  const W = 300; const H = 160; const PAD = 28;
  const pxW = W - PAD * 2; const pxH = 80;
  const cellW = Math.min(pxW / Math.min(cantP, 6), 60);
  const vizCantP = Math.min(cantP, 6);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
      <rect width={W} height={H} fill="#F0F4F8" rx={8} />
      {Array.from({ length: vizCantP }, (_, i) => (
        <g key={i}>
          <rect x={PAD + i * cellW + 0.5} y={36} width={cellW - 1} height={pxH}
            fill="#E8F4FD" stroke="#CBD5E0" strokeWidth={0.8} rx={1} />
          {/* Cinta butilo en solape (arriba) */}
          <rect x={PAD + i * cellW} y={35} width={cellW} height={3} fill={GOLD} opacity={0.7} />
        </g>
      ))}
      {/* Silicona en juntas longitudinales */}
      {Array.from({ length: Math.min(vizCantP - 1, 5) }, (_, i) => (
        <line key={i}
          x1={PAD + (i + 1) * cellW} y1={36}
          x2={PAD + (i + 1) * cellW} y2={36 + pxH}
          stroke={color} strokeWidth={3} opacity={0.6}
        />
      ))}
      {/* Legend */}
      <rect x={PAD} y={H - 28} width={10} height={5} fill={GOLD} opacity={0.8} />
      <text x={PAD + 13} y={H - 23} fontSize={8} fill={GRAY}>Cinta butilo (solape)</text>
      <rect x={PAD + 120} y={H - 29} width={4} height={8} fill={color} opacity={0.7} />
      <text x={PAD + 127} y={H - 23} fontSize={8} fill={GRAY}>Silicona junta</text>
      <text x={W / 2} y={H - 6} fontSize={8} textAnchor="middle" fill={GRAY}>
        {cantP} paneles · {largo.toFixed(1)} m largo
      </text>
    </svg>
  );
}

function ParedFrontal({ cantP, alto, tipoEst, au = 1.14, color = GREEN }) {
  const maxW = 300; const maxH = 180; const PAD = 26;
  const totalW = cantP * au;
  const vizAlto = Math.min(alto, 5);
  const scaleX = (maxW - PAD * 2) / Math.max(totalW, 1);
  const scaleY = (maxH - PAD * 2 - 20) / Math.max(vizAlto, 1);
  const pxW = totalW * scaleX; const pxH = vizAlto * scaleY;
  const anclajeSpacing = 0.30;
  const numAnclajes = Math.min(Math.ceil(totalW / anclajeSpacing), 60);
  const t2Count = Math.ceil(totalW * vizAlto * 5.5);
  const cols = Math.max(2, Math.ceil(Math.sqrt(t2Count * (pxW / Math.max(pxH, 1)))));
  const rows = Math.max(1, Math.ceil(t2Count / cols));
  return (
    <svg width="100%" viewBox={`0 0 ${maxW} ${maxH}`} style={{ maxWidth: maxW, display: 'block', margin: '0 auto' }}>
      <rect width={maxW} height={maxH} fill="#F0F4F8" rx={8} />
      <rect x={PAD} y={PAD} width={pxW} height={5} fill="#718096" rx={1} />
      <rect x={PAD} y={PAD + pxH - 5} width={pxW} height={5} fill="#718096" rx={1} />
      {Array.from({ length: cantP }, (_, p) => (
        <rect key={p} x={PAD + p * au * scaleX + 0.5} y={PAD + 5} width={au * scaleX - 1} height={pxH - 10}
          fill="white" stroke="#CBD5E0" strokeWidth={0.8} />
      ))}
      {(tipoEst === 'metal' || tipoEst === 'madera') && Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const cx = PAD + ((c + 0.5) / cols) * pxW;
          const cy = PAD + 14 + ((r + 0.5) / rows) * (pxH - 24);
          return <circle key={`t2-${r}-${c}`} cx={cx} cy={cy} r={2.5} fill={color} opacity={0.5} />;
        })
      )}
      {Array.from({ length: numAnclajes }, (_, i) => {
        const cx = PAD + (i + 0.5) * anclajeSpacing * scaleX;
        if (cx > PAD + pxW - 2) return null;
        return (
          <g key={i}>
            <line x1={cx} y1={PAD + pxH - 14} x2={cx} y2={PAD + pxH - 5} stroke={GOLD} strokeWidth={1.5} />
            <circle cx={cx} cy={PAD + pxH - 17} r={3} fill={GOLD} />
          </g>
        );
      })}
      {Array.from({ length: cantP - 1 }, (_, p) => {
        const jx = PAD + (p + 1) * au * scaleX;
        return (
          <g key={p}>
            <circle cx={jx} cy={PAD + pxH * 0.32} r={3.5} fill="#5AC8FA" stroke="white" strokeWidth={1} />
            <circle cx={jx} cy={PAD + pxH * 0.68} r={3.5} fill="#5AC8FA" stroke="white" strokeWidth={1} />
          </g>
        );
      })}
      <text x={PAD + pxW / 2} y={maxH - 6} fontSize={8} textAnchor="middle" fill={GRAY}>{totalW.toFixed(1)} m ancho</text>
    </svg>
  );
}

function PerfilesParedSVG({ cantP, alto, color = TEAL }) {
  const W = 300; const H = 170; const PAD = 28;
  const pxW = W - PAD * 2; const pxH = H - PAD * 2 - 24;
  const cellW = pxW / Math.min(cantP, 6);
  const vizCantP = Math.min(cantP, 6);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
      <rect width={W} height={H} fill="#F0F4F8" rx={8} />
      {/* Perfil U base y coronación */}
      <rect x={PAD} y={PAD} width={pxW} height={5} fill={color} rx={1} opacity={0.85} />
      <rect x={PAD} y={PAD + pxH - 5} width={pxW} height={5} fill={color} rx={1} opacity={0.85} />
      <text x={PAD + pxW + 4} y={PAD + 5} fontSize={7.5} fill={color}>Perfil U</text>
      {/* Paneles */}
      {Array.from({ length: vizCantP }, (_, i) => (
        <rect key={i} x={PAD + i * cellW + 0.5} y={PAD + 5} width={cellW - 1} height={pxH - 10}
          fill="#E8F4FD" stroke="#CBD5E0" strokeWidth={0.8} />
      ))}
      {/* K2 en juntas */}
      {Array.from({ length: vizCantP - 1 }, (_, i) => {
        const x = PAD + (i + 1) * cellW;
        return (
          <g key={i}>
            <line x1={x} y1={PAD + 5} x2={x} y2={PAD + pxH - 5} stroke={GOLD} strokeWidth={3} opacity={0.7} />
          </g>
        );
      })}
      <text x={PAD + cellW * 0.5} y={PAD + pxH / 2 + 4} fontSize={7.5} textAnchor="middle" fill="#4A5568">Panel</text>
      {vizCantP > 1 && (
        <text x={PAD + cellW} y={PAD + pxH / 2 + 4} fontSize={7.5} textAnchor="middle" fill={GOLD}>K2</text>
      )}
      <text x={W / 2} y={H - 6} fontSize={8} textAnchor="middle" fill={GRAY}>{cantP} paneles · {alto.toFixed(1)} m alto</text>
    </svg>
  );
}

function EsquinerosSVG({ numExt, numInt, alto, color = GOLD }) {
  const W = 300; const H = 160;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
      <rect width={W} height={H} fill="#F0F4F8" rx={8} />
      {/* Exterior corner */}
      {numExt > 0 && (
        <g>
          <rect x={80} y={40} width={55} height={70} fill="#E8F4FD" stroke="#CBD5E0" strokeWidth={0.8} />
          <rect x={135} y={40} width={55} height={70} fill="#E8F4FD" stroke="#CBD5E0" strokeWidth={0.8} />
          <polygon points={`75,40 80,40 80,110 75,110`} fill={color} opacity={0.9} />
          <polygon points={`75,40 190,40 190,46 75,46`} fill={color} opacity={0.7} />
          <text x={116} y={130} fontSize={8} textAnchor="middle" fill={color}>Esq. exterior ({numExt})</text>
        </g>
      )}
      {/* Interior corner */}
      {numInt > 0 && (
        <g>
          <rect x={170} y={40} width={50} height={70} fill="#F0F8E8" stroke="#CBD5E0" strokeWidth={0.8} />
          <rect x={170} y={40} width={50} height={70} fill="#F0F8E8" stroke="#CBD5E0" strokeWidth={0.8} />
          <line x1={220} y1={40} x2={220} y2={110} stroke={GREEN} strokeWidth={4} opacity={0.8} />
          <line x1={170} y1={40} x2={240} y2={40} stroke={GREEN} strokeWidth={2} opacity={0.5} />
          <text x={205} y={130} fontSize={8} textAnchor="middle" fill={GREEN}>Esq. int. ({numInt})</text>
        </g>
      )}
      <text x={W / 2} y={H - 10} fontSize={8} textAnchor="middle" fill={GRAY}>
        {alto.toFixed(1)} m alto · {numExt + numInt} esquinas total
      </text>
    </svg>
  );
}

function SelladoresParedSVG({ cantP, alto, perimetro, color = PURPLE }) {
  const W = 300; const H = 160; const PAD = 28;
  const pxW = W - PAD * 2; const pxH = 90;
  const cellW = pxW / Math.min(cantP, 6);
  const vizCantP = Math.min(cantP, 6);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W, display: 'block', margin: '0 auto' }}>
      <rect width={W} height={H} fill="#F0F4F8" rx={8} />
      {Array.from({ length: vizCantP }, (_, i) => (
        <rect key={i} x={PAD + i * cellW + 0.5} y={30} width={cellW - 1} height={pxH}
          fill="#F0F8F0" stroke="#CBD5E0" strokeWidth={0.8} />
      ))}
      {/* Silicona en juntas verticales */}
      {Array.from({ length: vizCantP - 1 }, (_, i) => (
        <line key={i} x1={PAD + (i + 1) * cellW} y1={30} x2={PAD + (i + 1) * cellW} y2={30 + pxH} stroke={color} strokeWidth={3} opacity={0.6} />
      ))}
      {/* Membrana en base */}
      <rect x={PAD} y={30 + pxH - 6} width={pxW} height={6} fill={TEAL} opacity={0.6} rx={1} />
      <rect x={PAD - 5} y={30} width={5} height={pxH} fill={TEAL} opacity={0.4} />
      <rect x={PAD + pxW} y={30} width={5} height={pxH} fill={TEAL} opacity={0.4} />
      {/* Legend */}
      <rect x={PAD} y={H - 22} width={8} height={4} fill={color} opacity={0.7} />
      <text x={PAD + 11} y={H - 18} fontSize={7.5} fill={GRAY}>Silicona junta</text>
      <rect x={PAD + 100} y={H - 23} width={8} height={6} fill={TEAL} opacity={0.6} />
      <text x={PAD + 111} y={H - 18} fontSize={7.5} fill={GRAY}>Membrana base</text>
      <text x={W / 2} y={H - 6} fontSize={8} textAnchor="middle" fill={GRAY}>
        {cantP} paneles · {alto.toFixed(1)} m alto · perímetro {perimetro.toFixed(1)} m
      </text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BOM TABLE
// ═══════════════════════════════════════════════════════════════════════════
function BOMTable({ items = [], color = BLUE }) {
  if (!items.length) return <p style={{ color: GRAY, fontSize: 13 }}>Sin ítems calculados.</p>;
  const total = items.reduce((s, i) => s + (i.total ?? 0), 0);
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ borderBottom: '1.5px solid #E5E5EA', color: GRAY, fontSize: 11 }}>
          <th style={{ textAlign: 'left', paddingBottom: 6 }}>Ítem</th>
          <th style={{ textAlign: 'right', paddingBottom: 6 }}>Cant.</th>
          <th style={{ textAlign: 'right', paddingBottom: 6 }}>P.U.</th>
          <th style={{ textAlign: 'right', paddingBottom: 6 }}>Total</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i} style={{ borderBottom: '1px solid #F0F0F0' }}>
            <td style={{ padding: '5px 0', color: '#1D1D1F', fontSize: 12 }}>{item.label}</td>
            <td style={{ textAlign: 'right', padding: '5px 0', fontVariantNumeric: 'tabular-nums' }}>{item.cant}</td>
            <td style={{ textAlign: 'right', padding: '5px 0', color: GRAY, fontVariantNumeric: 'tabular-nums' }}>
              ${(item.pu ?? 0).toFixed(3)}
            </td>
            <td style={{ textAlign: 'right', padding: '5px 0', color, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
              ${(item.total ?? 0).toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={3} style={{ paddingTop: 10, fontWeight: 600, color: '#1D1D1F', fontSize: 13 }}>Total</td>
          <td style={{ textAlign: 'right', paddingTop: 10, fontWeight: 700, color, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
            ${total.toFixed(2)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPLANATIONS — Texto humano por módulo
// ═══════════════════════════════════════════════════════════════════════════
const EXPLANATIONS = {
  'paneles-techo': {
    titulo: 'Cómo se calculan los Paneles de Techo',
    que: 'Determina cuántos paneles ISODEC (PIR o EPS) necesita una cubierta y el costo total de paneles, según el largo del faldón y el ancho a cubrir.',
    como: [
      '① Contar paneles: cantP = ⌈ancho / au⌉ — se divide el ancho de cubierta por el ancho útil del panel y se redondea hacia arriba.',
      '② Ancho útil (au): cada panel cubre au = 1.12m de ancho real. Este valor ya descuenta el solape de costillas — el ancho nominal del panel de fábrica es mayor, pero no se usa directamente en el cálculo.',
      '③ Área total = cantP × au × largo (incluye el descarte por solape).',
      '④ Costo = área total × precio/m² del espesor elegido.',
    ],
    porque: 'Se usa ⌈⌉ (redondear arriba) porque siempre se necesita el panel completo aunque el ancho exacto no sea múltiplo de au. El descarte es el ancho sobrante del último panel.',
    terminologia: [
      { termino: 'au (ancho útil)', def: 'Ancho real de cobertura por panel, descontando el solape de costillas.' },
      { termino: 'Descarte', def: 'Porción del último panel que no cubre área útil (sobra de ancho).' },
      { termino: 'Área neta', def: 'Área real cubierta = cantP × au × largo.' },
    ],
  },
  'autoportancia': {
    titulo: 'Cómo se calcula la Autoportancia',
    que: 'Determina si el panel ISODEC necesita apoyos intermedios (correas o vigas) para no flexar entre alero y cumbre, y si los necesita, cuántos.',
    como: [
      '① Cada espesor de panel tiene un vano máximo (ap) — la distancia máxima que puede salvar sin deformarse.',
      '② Si largo ≤ ap: el panel se apoya solo en alero y cumbre (2 apoyos). No hay correas intermedias.',
      '③ Si largo > ap: apoyos = ⌈largo / ap⌉ + 1. El +1 incluye los apoyos de los extremos.',
      '④ Ejemplo: panel 100mm EPS con ap = 4.5m. Largo de 9m → ⌈9/4.5⌉+1 = 3 apoyos.',
    ],
    porque: 'La flexión del panel bajo su propio peso y carga de nieve/viento tiene un límite físico por espesor de núcleo. Más espesor → mayor rigidez → vano más largo sin apoyo.',
    terminologia: [
      { termino: 'ap (autoportancia)', def: 'Vano máximo que el panel puede salvar sin apoyo intermedio.' },
      { termino: 'Apoyo (correa)', def: 'Viga o perfil sobre el que descansa el panel a lo largo del faldón.' },
      { termino: 'Alero', def: 'Borde inferior del faldón (primer apoyo).' },
      { termino: 'Cumbre', def: 'Borde superior del faldón (último apoyo).' },
    ],
  },
  'fij-isodec': {
    titulo: 'Cómo se calculan las Fijaciones ISODEC (Varilla 3/8")',
    que: 'Determina la cantidad de varillas roscadas 3/8", tuercas, arandelas y tacos (para hormigón) necesarios para fijar los paneles ISODEC a la estructura.',
    como: [
      '① Grilla base: cantP × (apoyos + 2) puntos. Las líneas de perímetro (alero y cumbre) llevan 2 puntos por panel; los apoyos intermedios llevan 1 punto por panel.',
      '② Puntos perimetrales: 2 × max(0, ⌈largo/2.5⌉ − 1) — puntos adicionales en los bordes laterales de la cubierta cada 2.5m.',
      '③ Total puntos = grilla + perimetrales.',
      '④ Largo de varilla: espesor_panel_m + rosca_extra según estructura (metal=0.10m, madera=0.05m, hormigón=0.20m).',
      '⑤ Varillas = ceil(puntos / floor(1m / largo_varilla)) — cuántos tramos de 1m se necesitan.',
    ],
    porque: 'La varilla atraviesa todo el espesor del panel para anclarlo a la estructura. En hormigón se necesita más longitud de rosca para el taco expansivo (20cm extra). La grilla garantiza que cada panel esté fijo en cada apoyo.',
    terminologia: [
      { termino: 'Punto de fijación', def: 'Lugar donde una varilla atraviesa el panel y llega a la estructura.' },
      { termino: 'Grilla', def: 'Puntos fijos en la intersección panel × apoyo.' },
      { termino: 'Rosca extra', def: 'Longitud adicional de varilla que penetra en la estructura para el anclaje.' },
      { termino: 'Tortuga PVC', def: 'Tapa de PVC que cubre la tuerca en la cara del panel para sellado y estética.' },
    ],
  },
  'fij-isoroof': {
    titulo: 'Cómo se calculan las Fijaciones ISOROOF (Caballete)',
    que: 'Determina la cantidad de caballetes metálicos para fijar los paneles ISOROOF a correas o madera. El caballete abraza la costilla del panel y se atornilla a la estructura.',
    como: [
      '① Caballetes interiores: cantP × 3 × (largo / factor_largo + 1). Por cada vano entre apoyos se instalan 3 caballetes (uno por costilla) más los de los extremos.',
      '② Caballetes perimetrales: ⌈(largo × 2) / factor_ancho⌉ — para los bordes laterales cada 30cm, resistiendo el viento.',
      '③ Total = interiores + perimetrales.',
      '④ Tornillos: para metal → tornillo mecha; para madera → tornillo aguja.',
    ],
    porque: 'ISOROOF tiene costillas de acero que permiten el agarre físico del caballete. La mayor densidad en bordes laterales previene el levantamiento por viento. El factor_largo (default 2.9m) es configurable en Parámetros.',
    terminologia: [
      { termino: 'Caballete', def: 'Pieza metálica en U invertida que abraza la costilla del panel.' },
      { termino: 'Tornillo mecha', def: 'Tornillo autoroscante para estructura metálica (perfora el acero).' },
      { termino: 'Tornillo aguja', def: 'Tornillo de madera con punta fina para penetrar sin pre-taladro.' },
      { termino: 'Costilla', def: 'Relieve trapezoidal del panel ISOROOF que le da rigidez y permite el caballete.' },
    ],
  },
  'perfileria-techo': {
    titulo: 'Cómo se calcula la Perfilería de Techo',
    que: 'Determina los metros lineales y piezas de perfiles metálicos para terminar los bordes de la cubierta: gotero frontal, babetas, canalón y soportes.',
    como: [
      '① Por cada borde (frente, fondo, laterales) se calcula el ML del perfil correspondiente.',
      '② El gotero frontal va en el borde de alero (frente). Las babetas van en los demás bordes.',
      '③ Canalón: ML = ancho cubierta. Soportes de canalón = (cantP + 1) × 0.30m por apoyo.',
      '④ Piezas = ⌈ML / largo_barra⌉ donde largo_barra es el largo comercial del perfil.',
    ],
    porque: 'Los perfiles de borde evitan que el agua de lluvia ingrese por los extremos del panel. El gotero desvía el agua hacia el canalón. Las babetas sellan los bordes laterales contra el viento y la lluvia.',
    terminologia: [
      { termino: 'Gotero frontal', def: 'Perfil en el frente del techo que forma el canal de desagüe y desvía la lluvia.' },
      { termino: 'Babeta', def: 'Perfil lateral/posterior que cubre y sella el borde del panel.' },
      { termino: 'Canalón', def: 'Canal de recolección de agua pluvial al pie del faldón.' },
      { termino: 'ML', def: 'Metros lineales — medida de longitud de perfiles.' },
    ],
  },
  'selladores-techo': {
    titulo: 'Cómo se calculan los Selladores de Techo',
    que: 'Determina la cantidad de silicona, cinta butilo y membrana PVC para sellar todas las juntas de la cubierta y evitar filtraciones de agua y aire.',
    como: [
      '① ML de juntas longitudinales = (cantP − 1) × largo. Son las juntas entre paneles adyacentes.',
      '② ML de solapes = 2 × au × cantP. El borde de cada panel que solapa con el vecino.',
      '③ Siliconas 600ml = ⌈mlTotal / 10.27⌉ — cada tubo alcanza ~10.27ml de junta.',
      '④ Cinta butilo: 1 rollo por cada 10 paneles (cinta de solape en cara superior).',
      '⑤ Membrana: según ML perimetral de la cubierta.',
    ],
    porque: 'Las juntas entre paneles son los puntos más vulnerables a la infiltración. La silicona en juntas + cinta en solapes + membrana perimetral conforman tres barreras que combinan elasticidad, adherencia y resistencia al agua.',
    terminologia: [
      { termino: 'Junta longitudinal', def: 'Línea de unión entre dos paneles contiguos a lo largo del faldón.' },
      { termino: 'Solape', def: 'Zona donde el borde de un panel se superpone sobre el siguiente.' },
      { termino: 'Bromplast 600ml', def: 'Silicona neutra en cartucho de 600ml, producto Bromplast.' },
      { termino: 'Membrana PVC', def: 'Lámina impermeable de PVC para el perímetro de la cubierta.' },
    ],
  },
  'paneles-pared': {
    titulo: 'Cómo se calculan los Paneles de Pared',
    que: 'Determina cuántos paneles ISOWALL se necesitan para cubrir el perímetro del edificio, descontando aberturas (puertas, ventanas), y el costo por m² de área neta.',
    como: [
      '① cantP = ⌈perímetro / au⌉ — paneles para dar la vuelta completa a la pared.',
      '② Área bruta = cantP × au × alto.',
      '③ Área neta = bruta − área de aberturas.',
      '④ Costo = área neta × precio/m².',
    ],
    porque: 'Los paneles de pared se colocan verticalmente, de piso a techo. El perímetro determina cuántos paneles se necesitan en el ancho. El área neta excluye aberturas ya que esas zonas se rellenan con carpintería, no con panel.',
    terminologia: [
      { termino: 'Perímetro', def: 'Suma de todos los lados del edificio que se van a revestir con panel.' },
      { termino: 'au (ancho útil pared)', def: 'Ancho de cobertura real por panel ISOWALL (típicamente 1.14m).' },
      { termino: 'Abertura', def: 'Hueco de puerta o ventana que se descuenta del área de panel.' },
    ],
  },
  'fij-pared': {
    titulo: 'Cómo se calculan las Fijaciones de Pared',
    que: 'Determina la cantidad de anclajes de base, tornillos T2 y remaches POP necesarios para fijar los paneles ISOWALL a la estructura.',
    como: [
      '① Anclajes H (base): ⌈(cantP × au) / 0.30⌉ — 1 anclaje cada 30cm a lo largo del perfil U de base.',
      '② Tornillos T2 (Tek #14): ⌈área × 5.5⌉ — 5.5 tornillos por m² de pared (solo metal/madera).',
      '③ Remaches POP: cantP × 2 — 2 remaches por panel para fijar la junta vertical.',
    ],
    porque: 'Los anclajes H sujetan el perfil U base que recibe el pie del panel. Los T2 fijan el panel a la estructura a través de la chapa exterior. Los remaches cosen los paneles entre sí para rigidizar la junta vertical.',
    terminologia: [
      { termino: 'Anclaje H', def: 'Anclaje mecánico de acero que fija el perfil U al suelo o viga de base.' },
      { termino: 'Tornillo T2 (Tek)', def: 'Tornillo autoperforante tipo Tek #14 para fijación de panel a estructura.' },
      { termino: 'Remache POP', def: 'Remache de tracción (pop rivet) para unir chapas en la junta entre paneles.' },
    ],
  },
  'perfiles-pared': {
    titulo: 'Cómo se calcula la Perfilería de Pared',
    que: 'Determina los metros lineales de perfil U (base y coronación), perfil K2 (juntas verticales) y perfil G2 (esquinas) del sistema de pared.',
    como: [
      '① Perfil U: 2 × ⌈perímetro / largo_barra⌉ piezas (una línea en base y otra en coronación).',
      '② Perfil K2 (junta): (cantP − 1) juntas × ⌈alto / largo_barra⌉ piezas — va en cada unión entre paneles.',
      '③ Perfil G2 (esquina): por número de esquinas × alto.',
    ],
    porque: 'El perfil U recibe el panel en la base y lo contiene en la coronación. El K2 cubre la junta entre paneles con acabado limpio y sella el filo de la chapa. El G2 protege las esquinas del edificio.',
    terminologia: [
      { termino: 'Perfil U', def: 'Perfil en forma de U que recibe el borde del panel (base y coronación).' },
      { termino: 'Perfil K2', def: 'Perfil de junta entre paneles adyacentes, cubre el filo de la chapa.' },
      { termino: 'Perfil G2', def: 'Perfil angular de esquina, cubre el encuentro de paneles en 90°.' },
    ],
  },
  'esquineros': {
    titulo: 'Cómo se calculan los Esquineros',
    que: 'Determina las piezas y metros lineales de esquineros exteriores e interiores según la cantidad de esquinas del edificio y la altura de la pared.',
    como: [
      '① Por cada esquina exterior: ⌈alto / largo_barra⌉ piezas de esquinero ext.',
      '② Por cada esquina interior: ⌈alto / largo_barra⌉ piezas de esquinero int.',
      '③ Las piezas se cuentan separadas ya que tienen diferente perfil y precio.',
    ],
    porque: 'Los esquineros protegen los bordes cortados de los paneles en las esquinas, dan acabado estético y evitan que el agua ingrese por el filo de chapa. La diferencia exterior/interior es de geometría: 90° convexo vs 90° cóncavo.',
    terminologia: [
      { termino: 'Esquina exterior', def: 'Esquina convexas del edificio (las caras se ven desde fuera).' },
      { termino: 'Esquina interior', def: 'Esquina cóncava del edificio (las caras van hacia adentro).' },
    ],
  },
  'selladores-pared': {
    titulo: 'Cómo se calculan los Selladores de Pared',
    que: 'Determina la cantidad de silicona, cinta, membrana y espuma PU para sellar juntas verticales, horizontales y perimetrales de la pared.',
    como: [
      '① ML de juntas verticales = (cantP − 1) × alto — una junta por cada unión entre paneles.',
      '② ML perimetral de base/techo = perímetro × 2.',
      '③ Siliconas = ⌈mlJuntas / 8⌉ (cada tubo cubre 8ml de junta de pared).',
      '④ Cinta autoadhesiva = ⌈mlJuntas / largo_rollo⌉ rollos.',
      '⑤ Membrana = ⌈perímetro / 10⌉ rollos. Espuma PU = rollosMembrana × 2.',
    ],
    porque: 'En pared el principal punto de ingreso de humedad son las juntas verticales entre paneles y los perímetros de base. La silicona en juntas garantiza estanqueidad. La membrana en la base protege de la humedad capilar del suelo.',
    terminologia: [
      { termino: 'Junta vertical', def: 'Línea de unión entre dos paneles de pared adyacentes.' },
      { termino: 'Membrana de base', def: 'Lámina impermeable en el zócalo que corta la humedad capilar del suelo.' },
      { termino: 'Espuma PU', def: 'Espuma de poliuretano en pistola para rellenar huecos en bordes y esquinas.' },
    ],
  },
};

// ── Explicación panel ─────────────────────────────────────────────────────────
function ExplicacionPanel({ moduleId, color }) {
  const exp = EXPLANATIONS[moduleId];
  if (!exp) return <p style={{ color: GRAY, fontSize: 13 }}>Sin explicación disponible para este módulo.</p>;
  return (
    <div style={{ fontSize: 13, lineHeight: 1.6 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#1D1D1F', marginBottom: 10 }}>{exp.titulo}</div>
      <div style={{ padding: '10px 14px', background: `${color}0D`, borderRadius: 8, marginBottom: 14, border: `1px solid ${color}28` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Qué calcula</div>
        <div style={{ color: '#1D1D1F' }}>{exp.que}</div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Cómo funciona</div>
        {exp.como.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, padding: '6px 10px', background: 'white', borderRadius: 7, border: '1px solid #E5E5EA' }}>
            <div style={{ color, fontWeight: 600, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{step.slice(0, 1)}</div>
            <div style={{ color: '#4A5568' }}>{step.slice(2)}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 14px', background: '#F8FAFB', borderRadius: 8, marginBottom: 14, border: '1px solid #E5E5EA' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Por qué esta lógica</div>
        <div style={{ color: '#4A5568' }}>{exp.porque}</div>
      </div>
      {exp.terminologia?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Glosario</div>
          {exp.terminologia.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: 12 }}>
              <span style={{ fontWeight: 600, color, flexShrink: 0, minWidth: 140 }}>{t.termino}</span>
              <span style={{ color: '#4A5568' }}>{t.def}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Kingspan comparison panel ─────────────────────────────────────────────────
function KingspanComparePanel({ moduleId, color }) {
  const data = compareKingspanVsBMC(moduleId);
  if (!data) return <p style={{ color: GRAY, fontSize: 13 }}>Sin comparación disponible para este módulo.</p>;
  return (
    <div style={{ fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 5, height: 20, background: PURPLE, borderRadius: 3 }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F' }}>{data.title}</div>
      </div>
      {data.subtitle && (
        <div style={{ padding: '8px 12px', background: '#F8FAFB', borderRadius: 8, marginBottom: 12, fontSize: 11, color: GRAY, border: '1px solid #E5E5EA', lineHeight: 1.5 }}>
          {data.subtitle}
        </div>
      )}
      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        {[['match', 'Equivalente'], ['partial', 'Parcial'], ['differs', 'Diferente'], ['bmc_only', 'Solo BMC'], ['ks_only', 'Solo KS']].map(([s, l]) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: statusColor(s) }} />
            <span style={{ color: GRAY }}>{l}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.rows.map((row, i) => (
          <div key={i} style={{ background: 'white', borderRadius: 9, border: `1px solid ${statusColor(row.status)}28`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: `${statusColor(row.status)}10`, borderBottom: `1px solid ${statusColor(row.status)}20` }}>
              <span style={{ fontWeight: 700, color: '#1D1D1F', fontSize: 12 }}>{row.concepto}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: statusColor(row.status), background: `${statusColor(row.status)}20`, padding: '2px 8px', borderRadius: 10 }}>
                {statusLabel(row.status)}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              <div style={{ padding: '8px 12px', borderRight: '1px solid #F0F0F0' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 3 }}>BMC</div>
                <div style={{ color: '#4A5568', lineHeight: 1.4 }}>{row.bmc}</div>
              </div>
              <div style={{ padding: '8px 12px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: PURPLE, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 3 }}>KINGSPAN</div>
                <div style={{ color: '#4A5568', lineHeight: 1.4 }}>{row.kingspan}</div>
              </div>
            </div>
            {row.nota && (
              <div style={{ padding: '5px 12px 7px', background: '#F8FAFB', borderTop: '1px solid #F0F0F0', fontSize: 10, color: GRAY, lineHeight: 1.4 }}>
                {row.nota}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG VERSIONS — save / load named snapshots of all param overrides
// ═══════════════════════════════════════════════════════════════════════════
function ConfigVersions({ onVersionLoaded }) {
  const [versions, setVersions] = useState(() => getConfigVersions());
  const [newName, setNewName] = useState('');
  const [showSave, setShowSave] = useState(false);
  const [loadedId, setLoadedId] = useState(null);

  const handleSave = () => {
    saveConfigVersion(newName);
    setVersions(getConfigVersions());
    setNewName('');
    setShowSave(false);
  };

  const handleLoad = (v) => {
    setDimensioningOverridesBulk(v.params);
    setLoadedId(v.id);
    if (onVersionLoaded) onVersionLoaded();
  };

  const handleDelete = (id) => {
    deleteConfigVersion(id);
    setVersions(getConfigVersions());
    if (loadedId === id) setLoadedId(null);
  };

  const handleReset = () => {
    resetDimensioningOverrides();
    setLoadedId(null);
    if (onVersionLoaded) onVersionLoaded();
  };

  return (
    <div style={{ marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid #E5E5EA' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F' }}>Configuraciones guardadas</div>
          <div style={{ fontSize: 11, color: GRAY, marginTop: 2 }}>Guardá snapshots de todos los parámetros para comparar y recuperar versiones.</div>
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <button onClick={handleReset} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '1px solid #E5E5EA', background: 'white', color: GRAY, cursor: 'pointer' }}>
            ↺ Defaults
          </button>
          <button onClick={() => setShowSave(!showSave)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: 'none', background: GOLD, color: 'white', fontWeight: 700, cursor: 'pointer' }}>
            + Guardar versión
          </button>
        </div>
      </div>

      {showSave && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, padding: 12, background: '#FFFBF0', borderRadius: 9, border: '1px solid #FFD60A30' }}>
          <input
            type="text"
            placeholder="Nombre de esta configuración…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setShowSave(false); }}
            autoFocus
            style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1.5px solid #CBD5E0', fontSize: 13 }}
          />
          <button onClick={handleSave} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: GOLD, color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Guardar
          </button>
          <button onClick={() => setShowSave(false)} style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #E5E5EA', background: 'white', color: GRAY, cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      )}

      {versions.length === 0 && !showSave && (
        <div style={{ color: GRAY, fontSize: 12, padding: '8px 0', fontStyle: 'italic' }}>
          Aún no hay versiones guardadas. Modificá parámetros y guardá una versión para poder recuperarla.
        </div>
      )}

      {versions.map(v => {
        const isActive = loadedId === v.id;
        const overrideCount = v.overrideCount ?? Object.keys(v.params ?? {}).length;
        return (
          <div key={v.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
            borderRadius: 9, marginBottom: 7,
            background: isActive ? '#F0FFF4' : 'white',
            border: `1px solid ${isActive ? '#34C75940' : '#E5E5EA'}`,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {v.name}
              </div>
              <div style={{ fontSize: 10, color: GRAY, marginTop: 2 }}>
                {new Date(v.date).toLocaleString('es-UY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {overrideCount > 0 ? ` · ${overrideCount} param${overrideCount !== 1 ? 's' : ''} modificado${overrideCount !== 1 ? 's' : ''}` : ' · solo defaults'}
              </div>
            </div>
            <button
              onClick={() => handleLoad(v)}
              style={{ padding: '5px 12px', borderRadius: 7, border: `1.5px solid ${isActive ? GREEN : '#CBD5E0'}`, background: isActive ? GREEN : 'white', color: isActive ? 'white' : '#1D1D1F', fontWeight: 600, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
            >
              {isActive ? '✓ Activa' : 'Cargar'}
            </button>
            <button
              onClick={() => handleDelete(v.id)}
              title="Eliminar versión"
              style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid #FFE5E5', background: '#FFF5F5', color: '#FF3B30', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE PARAMS TAB — per-module formula parameters with live preview
// ═══════════════════════════════════════════════════════════════════════════
function ModuleParamsTab({ moduleId, color, result, onSaved }) {
  const prefixes = MODULE_PARAM_PREFIXES[moduleId] ?? [];

  const items = useMemo(() =>
    getDimensioningItemsFlat().filter(item => prefixes.some(p => item.path.startsWith(p))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [moduleId],
  );

  const [localValues, setLocalValues] = useState(() =>
    Object.fromEntries(items.map(i => [i.path, String(i.valor)])),
  );
  const [isModifiedMap, setIsModifiedMap] = useState(() =>
    Object.fromEntries(items.map(i => [i.path, i.valor !== i.default])),
  );

  const applyParam = (path, rawVal) => {
    const val = parseFloat(String(rawVal).replace(',', '.'));
    if (isNaN(val) || val < 0) return;
    applyDimensioningImport({ [path]: val });
    const item = items.find(i => i.path === path);
    setIsModifiedMap(prev => ({ ...prev, [path]: val !== (item?.default ?? val) }));
    if (onSaved) onSaved();
  };

  const handleChange = (path, rawVal) => {
    setLocalValues(prev => ({ ...prev, [path]: rawVal }));
    applyParam(path, rawVal);
  };

  const handleReset = (path, defaultVal) => {
    applyDimensioningImport({ [path]: defaultVal });
    setLocalValues(prev => ({ ...prev, [path]: String(defaultVal) }));
    setIsModifiedMap(prev => ({ ...prev, [path]: false }));
    if (onSaved) onSaved();
  };

  if (prefixes.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: GRAY, fontSize: 13 }}>
        Este módulo no tiene parámetros de fórmula configurables.
      </div>
    );
  }

  const total = result?.items?.reduce((s, i) => s + (i.total ?? 0), 0) ?? 0;
  const modifiedCount = Object.values(isModifiedMap).filter(Boolean).length;

  const handleResetAll = () => {
    items.forEach(item => {
      if (isModifiedMap[item.path]) handleReset(item.path, item.default);
    });
  };

  return (
    <div>
      {/* Live result preview bar */}
      {result && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: `${color}08`, borderRadius: 10, border: `1px solid ${color}20`, marginBottom: 16 }}>
          <div style={{ width: 5, height: 34, background: color, borderRadius: 3, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 9, color: GRAY, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 1 }}>Resultado en vivo</div>
            <div style={{ fontSize: 20, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>${total.toFixed(2)}</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            {modifiedCount > 0
              ? <span style={{ fontSize: 12, color: GOLD, fontWeight: 700 }}>{modifiedCount} param{modifiedCount !== 1 ? 's' : ''} modificado{modifiedCount !== 1 ? 's' : ''}</span>
              : <span style={{ fontSize: 12, color: GRAY }}>Valores por defecto</span>
            }
            {modifiedCount > 0 && (
              <div>
                <button onClick={handleResetAll} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, border: '1px solid #E5E5EA', background: 'white', color: GRAY, cursor: 'pointer', marginTop: 3 }}>
                  ↺ Resetear todos
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Parameter cards */}
      {items.map(item => {
        const isModified = isModifiedMap[item.path] ?? false;
        const rawVal = localValues[item.path] ?? String(item.valor);
        return (
          <div key={item.path} style={{
            marginBottom: 10, padding: '12px 14px', borderRadius: 10,
            background: isModified ? '#FFF8E6' : '#FAFAFA',
            border: `1px solid ${isModified ? '#FFD60A50' : '#E5E5EA'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 10, color: '#8A95A5', fontFamily: 'monospace', background: '#F0F4F8', padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginBottom: 5 }}>
                  {item.path}
                </div>
                <div style={{ fontSize: 11, color: GRAY, lineHeight: 1.5 }}>{item.formula}</div>
                {isModified && (
                  <div style={{ fontSize: 10, color: GOLD, fontWeight: 700, marginTop: 5 }}>
                    ● Modificado — default: {item.default} {item.unidad}
                  </div>
                )}
                {!isModified && (
                  <div style={{ fontSize: 10, color: GRAY, marginTop: 5 }}>Default: {item.default} {item.unidad}</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <input
                    type="number"
                    value={rawVal}
                    step="any"
                    onChange={e => handleChange(item.path, e.target.value)}
                    style={{
                      width: 90, padding: '6px 8px', fontSize: 14, fontWeight: 700,
                      borderRadius: 7, border: `1.5px solid ${isModified ? GOLD : '#CBD5E0'}`,
                      background: isModified ? '#FFFDF0' : 'white',
                      color: '#1D1D1F', textAlign: 'right', outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: 11, color: GRAY, minWidth: 28 }}>{item.unidad}</span>
                </div>
                {isModified && (
                  <button
                    onClick={() => handleReset(item.path, item.default)}
                    style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, border: '1px solid #E5E5EA', background: 'white', color: GRAY, cursor: 'pointer' }}
                  >
                    ↺ {item.default}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PARAMS EDITOR — lee getDimensioningItemsFlat(), guarda en localStorage
// ═══════════════════════════════════════════════════════════════════════════
function ParamsEditor({ onSaved, onVersionLoaded }) {
  const [items, setItems] = useState(() => getDimensioningItemsFlat());
  const [edits, setEdits] = useState({});
  const [saved, setSaved] = useState({});

  useEffect(() => { setItems(getDimensioningItemsFlat()); }, []);

  const categories = useMemo(() => {
    const cats = {};
    for (const item of items) {
      if (!cats[item.categoria]) cats[item.categoria] = [];
      cats[item.categoria].push(item);
    }
    return cats;
  }, [items]);

  const handleChange = (path, val) => {
    setEdits(prev => ({ ...prev, [path]: val }));
  };

  const handleSave = (path) => {
    const val = parseFloat(String(edits[path] ?? '').replace(',', '.'));
    if (isNaN(val) || val < 0) return;
    const result = applyDimensioningImport({ [path]: val });
    if (result[path] !== undefined) {
      setSaved(prev => ({ ...prev, [path]: true }));
      setItems(getDimensioningItemsFlat());
      if (onSaved) onSaved();
      setTimeout(() => setSaved(prev => ({ ...prev, [path]: false })), 1500);
    }
  };

  const handleReset = (path, defaultValue) => {
    applyDimensioningImport({ [path]: defaultValue });
    setEdits(prev => { const n = { ...prev }; delete n[path]; return n; });
    setItems(getDimensioningItemsFlat());
    if (onSaved) onSaved();
  };

  const catColors = {
    'Fijaciones Techo': BLUE, 'Paneles Techo': BLUE,
    'Perfilería': TEAL, 'Selladores Techo': PURPLE,
    'Fijaciones Pared': GREEN, 'Selladores Pared': PURPLE,
    'Paneles Pared': GREEN,
  };

  return (
    <div>
      <ConfigVersions onVersionLoaded={() => {
        setItems(getDimensioningItemsFlat());
        if (onVersionLoaded) onVersionLoaded();
      }} />

      <div style={{ fontSize: 12, color: GRAY, marginBottom: 16, lineHeight: 1.5 }}>
        Edita cualquier factor y presiona <strong>Guardar</strong>. Los valores se persisten en el navegador (localStorage)
        y son usados por todos los cálculos. <strong>Reset</strong> vuelve al default del código.
      </div>

      {Object.entries(categories).map(([cat, catItems]) => (
        <div key={cat} style={{ marginBottom: 22 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: catColors[cat] ?? GRAY,
            textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10,
            paddingBottom: 5, borderBottom: `2px solid ${catColors[cat] ?? '#E5E5EA'}20`,
          }}>
            {cat}
          </div>

          {catItems.map(item => {
            const isOverridden = item.valor !== item.default;
            const currentEdit = edits[item.path] ?? String(item.valor);
            const isSavedNow = saved[item.path];
            return (
              <div key={item.path} style={{
                marginBottom: 10, padding: '10px 12px', borderRadius: 8,
                background: isOverridden ? '#FFF8E6' : 'white',
                border: `1px solid ${isOverridden ? '#FFD60A40' : '#E5E5EA'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F', marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: GRAY, fontFamily: 'monospace' }}>{item.path}</div>
                    <div style={{ fontSize: 10, color: GRAY, marginTop: 3, lineHeight: 1.4 }}>{item.formula}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input
                        type="number"
                        value={currentEdit}
                        step="any"
                        onChange={e => handleChange(item.path, e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSave(item.path)}
                        style={{
                          width: 80, padding: '4px 8px', fontSize: 13, fontWeight: 600,
                          borderRadius: 6, border: `1.5px solid ${isOverridden ? GOLD : '#CBD5E0'}`,
                          background: isOverridden ? '#FFFDF0' : 'white',
                          color: '#1D1D1F', textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                      <span style={{ fontSize: 10, color: GRAY }}>{item.unidad}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => handleSave(item.path)}
                        style={{
                          padding: '3px 10px', fontSize: 11, borderRadius: 5, cursor: 'pointer',
                          border: 'none',
                          background: isSavedNow ? GREEN : catColors[cat] ?? BLUE,
                          color: 'white', fontWeight: 600,
                        }}
                      >
                        {isSavedNow ? '✓ OK' : 'Guardar'}
                      </button>
                      {isOverridden && (
                        <button
                          onClick={() => handleReset(item.path, item.default)}
                          title={`Reset a default: ${item.default}`}
                          style={{
                            padding: '3px 8px', fontSize: 11, borderRadius: 5, cursor: 'pointer',
                            border: `1px solid #E5E5EA`, background: 'white', color: GRAY,
                          }}
                        >
                          ↺ {item.default}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Slider ───────────────────────────────────────────────────────────────────
function Slider({ label, value, min, max, step, unit, onChange, accentColor }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
        <span style={{ color: '#1D1D1F' }}>{label}</span>
        <span style={{ fontWeight: 600, color: accentColor, fontVariantNumeric: 'tabular-nums' }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: '100%', accentColor }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function CalcLogicInspector() {
  const [selModule, setSelModule] = useState('paneles-techo');
  const [tab, setTab] = useState('planta');
  const [calcRefreshKey, setCalcRefreshKey] = useState(0);
  const [inputRefreshKey, setInputRefreshKey] = useState(0);
  const [inputs, setInputs] = useState(() =>
    Object.fromEntries(MODULES.map(m => [m.id, { ...m.defaultInputs }]))
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pricing = useMemo(() => getPricing(), [calcRefreshKey]);
  const mod = MODULES.find(m => m.id === selModule);
  const inp = inputs[selModule] ?? mod?.defaultInputs ?? {};
  const setInp = useCallback((key, val) =>
    setInputs(prev => ({ ...prev, [selModule]: { ...prev[selModule], [key]: val } })),
    [selModule]
  );
  const handleParamSaved = useCallback(() => setCalcRefreshKey(k => k + 1), []);
  const handleVersionLoaded = useCallback(() => {
    setCalcRefreshKey(k => k + 1);
    setInputRefreshKey(k => k + 1);
  }, []);

  // Resolve panel object
  const panel = useMemo(() => {
    if (!mod) return null;
    if (mod.panelSide === 'pared') return pricing.PANELS_PARED?.[mod.panelKey];
    return pricing.PANELS_TECHO?.[mod.panelKey];
  }, [mod, pricing]);

  const au = panel?.au ?? (mod?.panelSide === 'pared' ? 1.14 : 1.12);

  // Autoportancia for modules that need it
  const autoportancia = useMemo(() => {
    if (!panel || !inp.largo) return { apoyos: 2, ok: true, maxSpan: null };
    return calcAutoportancia(panel, inp.espesor ?? mod?.espesores?.[0], inp.largo);
  }, [panel, inp.largo, inp.espesor, mod?.espesores]);

  const apoyos = autoportancia.apoyos ?? 2;

  // ── Calculation ──────────────────────────────────────────────────────────
  const result = useMemo(() => {
    if (!mod) return null;
    try {
      const espesor = inp.espesor ?? mod.espesores?.[0];
      switch (selModule) {
        case 'paneles-techo': {
          if (!panel) return null;
          const r = calcPanelesTecho(panel, espesor, inp.largo ?? 6, inp.ancho ?? 5);
          if (!r) return null;
          return {
            items: [
              { label: `Panel ${panel.label} ${espesor}mm`, sku: 'panel', cant: r.cantPaneles, unidad: 'm²', pu: r.precioM2, total: r.costoPaneles },
            ],
            total: r.costoPaneles,
            meta: r,
          };
        }
        case 'autoportancia': {
          if (!panel) return null;
          const r = calcAutoportancia(panel, espesor, inp.largo ?? 6);
          return { items: [], total: 0, meta: r };
        }
        case 'fij-isodec':
          return calcFijacionesVarilla(inp.cantP ?? 4, apoyos, inp.largo ?? 6, inp.tipoEst ?? 'metal', 0, 0, 0, { espesorMm: espesor });
        case 'fij-isoroof':
          return calcFijacionesCaballete(inp.cantP ?? 4, inp.largo ?? 5, inp.tipoEst ?? 'metal', espesor);
        case 'perfileria-techo': {
          if (!panel) return null;
          const cantP = Math.ceil((inp.ancho ?? 5) / au);
          const anchoTotal = cantP * au;
          const borders = { frente: 'gotero_frontal', fondo: 'babeta_adosar', latIzq: 'babeta_adosar', latDer: 'babeta_adosar' };
          return calcPerfileriaTecho(borders, cantP, inp.largo ?? 6, anchoTotal, mod.panelKey, espesor, {});
        }
        case 'selladores-techo': {
          if (!panel) return null;
          const anchoTotal = (inp.cantP ?? 5) * au;
          return calcSelladoresTecho(inp.cantP ?? 5, {
            panel, anchoTotal, largoReal: inp.largo ?? 6,
            familiaP: mod.panelKey, espesor,
            borders: { frente: 'gotero_frontal' },
          });
        }
        case 'paneles-pared': {
          if (!panel) return null;
          const r = calcPanelesPared(panel, espesor, inp.alto ?? 3, inp.perimetro ?? 10, []);
          if (!r) return null;
          return {
            items: [
              { label: `Panel ${panel.label} ${espesor}mm`, sku: 'panel', cant: r.cantPaneles, unidad: 'm²', pu: r.precioM2, total: r.costoPaneles },
            ],
            total: r.costoPaneles,
            meta: r,
          };
        }
        case 'fij-pared': {
          if (!panel) return null;
          return calcFijacionesPared(panel, espesor, inp.cantP ?? 5, inp.alto ?? 3, (inp.cantP ?? 5) * au, inp.tipoEst ?? 'metal');
        }
        case 'perfiles-pared': {
          if (!panel) return null;
          const r1 = calcPerfilesU(panel, espesor, inp.perimetro ?? 8);
          const r2 = calcPerfilesParedExtra(panel, espesor, inp.cantP ?? 5, inp.alto ?? 3, {});
          const allItems = [...(r1.items ?? []), ...(r2.items ?? [])];
          return { items: allItems, total: +(allItems.reduce((s, i) => s + i.total, 0)).toFixed(2) };
        }
        case 'esquineros':
          return calcEsquineros(inp.alto ?? 3, inp.numExt ?? 2, inp.numInt ?? 1);
        case 'selladores-pared':
          return calcSelladorPared(inp.perimetro ?? 8, inp.cantP ?? 5, inp.alto ?? 3, { inclCintaButilo: true });
        default:
          return null;
      }
    } catch { return null; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selModule, inp, apoyos, panel, au, mod?.panelKey, mod?.espesores, calcRefreshKey]);

  // ── Formula strip ─────────────────────────────────────────────────────────
  const formulaLines = useMemo(() => {
    if (!mod) return [];
    const espesor = inp.espesor ?? mod.espesores?.[0];
    switch (selModule) {
      case 'paneles-techo': {
        const cantP = result?.meta?.cantPaneles ?? '—';
        return [
          `cantP = ⌈ancho / au⌉ = ⌈${inp.ancho} / ${au.toFixed(3)}⌉ = ${cantP}`,
          `área = ${cantP} × ${inp.largo} × ${au.toFixed(3)} = ${result?.meta?.areaTotal ?? '—'} m²`,
          `descarte ancho: ${result?.meta?.descarte?.anchoM ?? '—'} m (${result?.meta?.descarte?.porcentaje ?? '—'}%)`,
        ];
      }
      case 'autoportancia': {
        const maxSpan = autoportancia.maxSpan;
        return [
          `vano máx (esp ${espesor}mm): ap = ${maxSpan ?? 'N/D'} m`,
          `apoyos = ⌈largo / ap⌉ + 1 = ⌈${inp.largo} / ${maxSpan ?? '?'}⌉ + 1 = ${apoyos}`,
          autoportancia.ok ? 'Estado: vano OK (largo ≤ ap)' : `Estado: VANO EXCEDIDO (${inp.largo} > ${maxSpan})`,
        ];
      }
      case 'fij-isodec': {
        const grilla = (inp.cantP ?? 4) * (apoyos + 2);
        const pv = 2 * Math.max(0, Math.ceil((inp.largo ?? 6) / 2.5) - 1);
        return [
          `grilla: ${inp.cantP} × (${apoyos}+2) = ${grilla} pts`,
          `perim. vert.: 2 × max(0, ⌈${inp.largo}/2.5⌉−1) = ${pv} pts`,
          `total: ${grilla + pv} puntos · ${result?.items?.find(i => i.sku === 'varilla_38')?.cant ?? '—'} varillas`,
        ];
      }
      case 'fij-isoroof': {
        const interior = Math.ceil((inp.cantP ?? 4) * 3 * ((inp.largo ?? 5) / 2.9 + 1));
        const perim = Math.ceil(((inp.largo ?? 5) * 2) / 0.3);
        return [
          `interior: ⌈${inp.cantP} × 3 × (${inp.largo}/2.9+1)⌉ = ${interior} cab.`,
          `perim. lat.: ⌈(${inp.largo}×2)/0.3⌉ = ${perim} cab.`,
          `total: ${interior + perim} caballetes`,
        ];
      }
      case 'perfileria-techo': {
        const cantP = Math.ceil((inp.ancho ?? 5) / au);
        return [
          `cantP = ⌈${inp.ancho} / ${au.toFixed(3)}⌉ = ${cantP}`,
          `perfiles = ⌈ML / largo_barra⌉ por borde`,
          `${result?.items?.length ?? 0} líneas · ${result?.items?.reduce((s, i) => s + (i.ml ?? 0), 0).toFixed(1) ?? 0} ML total`,
        ];
      }
      case 'selladores-techo': {
        const mlJuntas = ((inp.cantP ?? 5) - 1) * (inp.largo ?? 6);
        const mlSolapes = 2 * au * (inp.cantP ?? 5);
        return [
          `juntas longitudinales: ${(inp.cantP ?? 5) - 1} × ${inp.largo} = ${mlJuntas.toFixed(1)} ml`,
          `solapes: 2 × ${au.toFixed(3)} × ${inp.cantP} = ${mlSolapes.toFixed(1)} ml`,
          `siliconas 600ml: ⌈${(mlJuntas + mlSolapes).toFixed(1)} / 10.27⌉ = ${result?.items?.[0]?.cant ?? '—'} unid.`,
        ];
      }
      case 'paneles-pared': {
        const cantP = result?.meta?.cantPaneles ?? '—';
        return [
          `cantP = ⌈perímetro / au⌉ = ⌈${inp.perimetro} / ${au.toFixed(3)}⌉ = ${cantP}`,
          `área bruta = ${cantP} × ${inp.alto} × ${au.toFixed(3)} = ${result?.meta?.areaBruta ?? '—'} m²`,
          `costo = ${result?.meta?.areaNeta ?? '—'} m² × $${result?.meta?.precioM2 ?? '—'}/m²`,
        ];
      }
      case 'fij-pared': {
        const anchoT = ((inp.cantP ?? 5) * au).toFixed(2);
        const anclajes = Math.ceil((inp.cantP ?? 5) * au / 0.30);
        return [
          `anclajes H: ⌈${anchoT}/0.30⌉ = ${anclajes} unid.`,
          `tornillos T2: ⌈${anchoT}×${inp.alto}×5.5⌉ = ${Math.ceil((inp.cantP ?? 5) * au * (inp.alto ?? 3) * 5.5)} unid. (solo metal/madera)`,
          `remaches POP: ${inp.cantP}×2 = ${(inp.cantP ?? 5) * 2} unid.`,
        ];
      }
      case 'perfiles-pared': {
        const juntasK2 = (inp.cantP ?? 5) - 1;
        return [
          `Perfil U: 2 × ⌈perímetro / L_barra⌉ pzas (base + coronación)`,
          `K2 juntas: ${juntasK2} juntas × ⌈${inp.alto}/L_barra⌉ pzas`,
          `${result?.items?.length ?? 0} líneas de BOM`,
        ];
      }
      case 'esquineros':
        return [
          `Esquinero ext: ${inp.numExt ?? 2} × ⌈${inp.alto}/L_barra⌉ pzas`,
          `Esquinero int: ${inp.numInt ?? 1} × ⌈${inp.alto}/L_barra⌉ pzas`,
          `${result?.items?.length ?? 0} líneas de BOM`,
        ];
      case 'selladores-pared': {
        const juntasV = (inp.cantP ?? 5) - 1;
        const mlJuntas = juntasV * (inp.alto ?? 3) + (inp.perimetro ?? 8) * 2;
        return [
          `ml juntas: ${juntasV}×${inp.alto} + ${inp.perimetro}×2 = ${mlJuntas.toFixed(1)} ml`,
          `siliconas: ⌈${mlJuntas.toFixed(1)}/8⌉ = ${Math.ceil(mlJuntas / 8)} unid.`,
          `membrana: ⌈perímetro/10⌉ = ${Math.ceil((inp.perimetro ?? 8) / 10)} rollos`,
        ];
      }
      default: return [];
    }
  }, [selModule, inp, result, apoyos, au, autoportancia, mod?.espesores]);

  // ── Sidebar metric ────────────────────────────────────────────────────────
  const sidebarMetric = useMemo(() => {
    if (!result) return null;
    const total = result.total ?? 0;
    let main = '—';
    let sub = '';
    switch (selModule) {
      case 'paneles-techo': main = `${result.meta?.cantPaneles ?? '—'} pnl`; sub = `${result.meta?.areaTotal ?? '—'} m²`; break;
      case 'autoportancia': main = `${apoyos} apoyos`; sub = autoportancia.ok ? 'vano OK' : 'excedido'; break;
      case 'fij-isodec': main = `${result.puntosFijacion ?? '—'} pts`; sub = `${result.items?.find(i => i.sku === 'varilla_38')?.cant ?? '—'} varillas`; break;
      case 'fij-isoroof': main = `${result.puntosFijacion ?? '—'} cab.`; break;
      case 'perfileria-techo': main = `${result.items?.length ?? '—'} ítems`; sub = `${result.items?.reduce((s, i) => s + (i.ml ?? 0), 0).toFixed(1) ?? '—'} ML`; break;
      case 'selladores-techo': main = `${result.items?.[0]?.cant ?? '—'} sil.`; break;
      case 'paneles-pared': main = `${result.meta?.cantPaneles ?? '—'} pnl`; sub = `${result.meta?.areaNeta ?? '—'} m²`; break;
      case 'fij-pared': main = `${result.items?.[0]?.cant ?? '—'} anc.`; break;
      case 'perfiles-pared': main = `${result.items?.length ?? '—'} ítems`; break;
      case 'esquineros': main = `${result.items?.length ?? '—'} ítems`; break;
      case 'selladores-pared': main = `${result.items?.[0]?.cant ?? '—'} sil.`; break;
      default: break;
    }
    return { main, sub, total };
  }, [result, selModule, apoyos, autoportancia]);

  // ── SVG for current tab ───────────────────────────────────────────────────
  const renderDiagram = (which) => {
    if (!mod) return null;
    const espesor = inp.espesor ?? mod.espesores?.[0];
    switch (selModule) {
      case 'paneles-techo':
        return <PanelesTechoSVG cantP={result?.meta?.cantPaneles ?? Math.ceil((inp.ancho ?? 5) / au)} largo={inp.largo ?? 6} ancho={inp.ancho ?? 5} au={au} color={mod.color} />;
      case 'autoportancia':
        return <AutoportanciaSVG largo={inp.largo ?? 6} apoyos={apoyos} maxSpan={autoportancia.maxSpan} ok={autoportancia.ok} color={mod.color} />;
      case 'fij-isodec':
        return which === 'seccion'
          ? <ISoDECSeccion espesorMm={espesor} tipoEst={inp.tipoEst ?? 'metal'} color={mod.color} />
          : <ISoDECPlanta largo={inp.largo ?? 6} cantP={inp.cantP ?? 4} apoyos={apoyos} au={au} color={mod.color} />;
      case 'fij-isoroof':
        return <ISORoofSeccion espesorMm={espesor} tipoEst={inp.tipoEst ?? 'metal'} color={mod.color} />;
      case 'perfileria-techo':
        return <PerfileriaTechoSVG ancho={inp.ancho ?? 5} largo={inp.largo ?? 6} cantP={Math.ceil((inp.ancho ?? 5) / au)} color={mod.color} />;
      case 'selladores-techo':
        return <SelladoresTechoSVG cantP={inp.cantP ?? 5} largo={inp.largo ?? 6} color={mod.color} />;
      case 'paneles-pared':
      case 'fij-pared':
        return which === 'seccion'
          ? <ISoDECSeccion espesorMm={espesor} tipoEst={inp.tipoEst ?? 'metal'} color={mod.color} />
          : <ParedFrontal cantP={inp.cantP ?? 5} alto={inp.alto ?? 3} tipoEst={inp.tipoEst ?? 'metal'} au={au} color={mod.color} />;
      case 'perfiles-pared':
        return <PerfilesParedSVG cantP={inp.cantP ?? 5} alto={inp.alto ?? 3} color={mod.color} />;
      case 'esquineros':
        return <EsquinerosSVG numExt={inp.numExt ?? 2} numInt={inp.numInt ?? 1} alto={inp.alto ?? 3} color={mod.color} />;
      case 'selladores-pared':
        return <SelladoresParedSVG cantP={inp.cantP ?? 5} alto={inp.alto ?? 3} perimetro={inp.perimetro ?? 8} color={mod.color} />;
      default:
        return null;
    }
  };

  const tabs = ['planta', 'seccion', 'bom', 'explicacion', 'kingspan', 'params'];
  const tabLabels = { planta: 'Vista 2D', seccion: 'Sección', bom: 'BOM', explicacion: 'Explicación', kingspan: 'Kingspan', params: 'Parámetros' };
  const isParamsMode = selModule === '__params__';

  return (
    <div style={{
      display: 'flex', height: '100%', minHeight: 600,
      fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif",
      background: '#F5F5F7', borderRadius: 16, overflow: 'hidden',
    }}>
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <div style={{ width: 200, background: '#1A3A5C', flexShrink: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '18px 14px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 2 }}>Inspector</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>Cálculos BMC</div>
        </div>

        {CATEGORIES.map(cat => (
          <div key={cat}>
            <div style={{ padding: '8px 14px 4px', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5 }}>
              {cat}
            </div>
            {MODULES.filter(m => m.category === cat).map(m => (
              <button key={m.id} onClick={() => { setSelModule(m.id); setTab('planta'); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px',
                  border: 'none',
                  background: selModule === m.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                  borderLeft: `3px solid ${selModule === m.id ? m.color : 'transparent'}`,
                  cursor: 'pointer',
                }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: selModule === m.id ? 'white' : 'rgba(255,255,255,0.6)' }}>{m.label}</div>
                <div style={{ fontSize: 10, color: selModule === m.id ? m.color : 'rgba(255,255,255,0.3)', marginTop: 1 }}>{m.sub}</div>
              </button>
            ))}
          </div>
        ))}

        {/* Params separator */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 6 }}>
          <button onClick={() => { setSelModule('__params__'); setTab('planta'); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
              border: 'none',
              background: isParamsMode ? 'rgba(255,255,255,0.1)' : 'transparent',
              borderLeft: `3px solid ${isParamsMode ? GOLD : 'transparent'}`,
              cursor: 'pointer',
            }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isParamsMode ? 'white' : 'rgba(255,255,255,0.6)' }}>Parametros</div>
            <div style={{ fontSize: 10, color: isParamsMode ? GOLD : 'rgba(255,255,255,0.3)', marginTop: 1 }}>Editar y persistir</div>
          </button>
        </div>

        {/* Sidebar metric */}
        {!isParamsMode && sidebarMetric && (
          <div style={{ margin: '10px 10px 14px', background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 10, color: mod?.color ?? BLUE, fontWeight: 600, marginBottom: 3 }}>Resultado</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'white', fontVariantNumeric: 'tabular-nums' }}>
              {sidebarMetric.main}
            </div>
            {sidebarMetric.sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>{sidebarMetric.sub}</div>}
            <div style={{ fontSize: 13, fontWeight: 700, color: mod?.color ?? BLUE, marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>
              ${sidebarMetric.total.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>

        {/* Header */}
        {!isParamsMode && mod && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 7, height: 26, background: mod.color, borderRadius: 4 }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F' }}>{mod.label}</div>
              <div style={{ fontSize: 11, color: GRAY }}>{mod.sub} · {mod.panelSide} · {inp.espesor ?? mod.espesores[0]}mm</div>
            </div>
          </div>
        )}
        {isParamsMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 7, height: 26, background: GOLD, borderRadius: 4 }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F' }}>Parámetros de Fórmulas</div>
              <div style={{ fontSize: 11, color: GRAY }}>Todos los factores editables · persistidos en localStorage</div>
            </div>
          </div>
        )}

        {/* Params mode */}
        {isParamsMode && <ParamsEditor onSaved={handleParamSaved} onVersionLoaded={handleVersionLoaded} />}

        {/* Module mode */}
        {!isParamsMode && mod && (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, background: '#E5E5EA', padding: 3, borderRadius: 10, marginBottom: 16, width: 'fit-content' }}>
              {tabs.map(t => (
                <button key={t} onClick={() => setTab(t)}
                  style={{
                    padding: '5px 14px', borderRadius: 8, border: 'none',
                    background: tab === t ? 'white' : 'transparent',
                    color: tab === t ? '#1D1D1F' : GRAY,
                    fontWeight: tab === t ? 600 : 400, fontSize: 12, cursor: 'pointer',
                    boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}>
                  {tabLabels[t]}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 14 }}>
              {/* Diagram / BOM */}
              <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                {tab === 'bom' && <BOMTable items={result?.items ?? []} color={mod.color} />}
                {tab === 'explicacion' && <ExplicacionPanel moduleId={selModule} color={mod.color} />}
                {tab === 'kingspan' && <KingspanComparePanel moduleId={selModule} color={mod.color} />}
                {tab === 'params' && (
                  <ModuleParamsTab
                    key={`${selModule}-${inputRefreshKey}`}
                    moduleId={selModule}
                    color={mod.color}
                    result={result}
                    onSaved={handleParamSaved}
                  />
                )}
                {tab !== 'bom' && tab !== 'explicacion' && tab !== 'kingspan' && tab !== 'params' && renderDiagram(tab)}

                {tab !== 'bom' && tab !== 'explicacion' && tab !== 'kingspan' && tab !== 'params' && formulaLines.length > 0 && (
                  <div style={{ marginTop: 12, padding: '10px 12px', background: '#F8FAFB', borderRadius: 8, border: '1px solid #E5E5EA' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#1A3A5C', marginBottom: 5 }}>Fórmula aplicada</div>
                    {formulaLines.map((line, i) => (
                      <div key={i} style={{
                        fontSize: 11, color: i === formulaLines.length - 1 ? mod.color : '#4A5568',
                        fontWeight: i === formulaLines.length - 1 ? 700 : 400,
                        marginTop: i > 0 ? 3 : 0, fontVariantNumeric: 'tabular-nums',
                      }}>
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Parameters panel */}
              <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', marginBottom: 12 }}>Parámetros</div>

                {/* Sliders */}
                {mod.sliders?.map(sl => (
                  <Slider key={sl.key} label={sl.label} value={inp[sl.key] ?? sl.min}
                    min={sl.min} max={sl.max} step={sl.step} unit={sl.unit}
                    accentColor={mod.color} onChange={v => setInp(sl.key, v)} />
                ))}

                {/* Espesor pills */}
                {mod.espesores && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: '#1D1D1F', marginBottom: 6 }}>Espesor</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {mod.espesores.map(e => (
                        <button key={e} onClick={() => setInp('espesor', e)}
                          style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                            border: `1.5px solid ${inp.espesor === e ? mod.color : '#E5E5EA'}`,
                            background: inp.espesor === e ? mod.color : 'white',
                            color: inp.espesor === e ? 'white' : '#1D1D1F',
                            fontWeight: inp.espesor === e ? 600 : 400,
                          }}>
                          {e}mm
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tipo estructura */}
                {mod.tipoEst && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: '#1D1D1F', marginBottom: 6 }}>Estructura</div>
                    {TIPOS_EST.map(t => (
                      <button key={t.value} onClick={() => setInp('tipoEst', t.value)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '6px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                          marginBottom: 4,
                          border: `1.5px solid ${inp.tipoEst === t.value ? mod.color : '#E5E5EA'}`,
                          background: inp.tipoEst === t.value ? `${mod.color}12` : 'white',
                          color: inp.tipoEst === t.value ? mod.color : GRAY,
                          fontWeight: inp.tipoEst === t.value ? 600 : 400,
                        }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Result chip */}
                {result && sidebarMetric && (
                  <div style={{
                    padding: 11, borderRadius: 9, marginTop: 4,
                    background: `${mod.color}10`, border: `1px solid ${mod.color}28`, textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 10, color: GRAY, marginBottom: 3 }}>TOTAL</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: mod.color, fontVariantNumeric: 'tabular-nums' }}>
                      ${sidebarMetric.total.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 11, color: GRAY, marginTop: 2 }}>
                      {result.items?.length ?? 0} líneas de ítem
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
