// FichasPreview.jsx — Vista previa del concepto de Fichas
// Muestra los 4 tipos de ficha con datos reales para aprobación de concepto.
// No tiene funcionalidad de edición aún — es un mockup navegable.

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getPricing } from '../data/pricing.js';
import { getDimensioningItemsFlat } from '../utils/dimensioningFormulas.js';
import {
  calcPanelesTecho, calcFijacionesVarilla, calcAutoportancia,
  calcSelladoresTecho, calcPerfileriaTecho,
} from '../utils/calculations.js';

// ── Paleta ───────────────────────────────────────────────────────────────────
const C = {
  navy:   '#1A3A5C',
  blue:   '#0071E3',
  gold:   '#FF9F0A',
  green:  '#34C759',
  red:    '#E44C4C',
  teal:   '#00C7BE',
  purple: '#AF52DE',
  gray:   '#6E6E73',
  bg:     '#F5F5F7',
  white:  '#FFFFFF',
  border: '#E5E5EA',
};

const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif";

// ── Micro components ─────────────────────────────────────────────────────────

function Badge({ label, color = C.blue }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}18`,
      padding: '2px 8px', borderRadius: 10, letterSpacing: 0.4 }}>
      {label}
    </span>
  );
}

function SectionDivider({ label, color = C.gray }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 10px' }}>
      <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 1.2, whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );
}

function ParamRow({ label, desc, value, unit, color = C.blue, modified = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
      borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F' }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: C.gray, marginTop: 1, lineHeight: 1.4 }}>{desc}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <div style={{
          padding: '4px 10px', borderRadius: 7, minWidth: 62, textAlign: 'right',
          border: `1.5px solid ${modified ? C.gold : C.border}`,
          background: modified ? '#FFFDF0' : '#F8FAFC',
          fontSize: 13, fontWeight: 700, color: modified ? C.gold : '#1D1D1F',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {value}
        </div>
        {unit && <span style={{ fontSize: 10, color: C.gray, minWidth: 26 }}>{unit}</span>}
      </div>
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
      boxShadow: '0 1px 3px rgba(0,0,0,.04), 0 4px 20px rgba(0,0,0,.06)',
      overflow: 'hidden', fontFamily: FONT, ...style,
    }}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title, subtitle, badges = [], color = C.navy }) {
  return (
    <div style={{ padding: '16px 20px', background: color, borderBottom: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: C.white }}>{title}</span>
          </div>
          {subtitle && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{subtitle}</div>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {badges.map((b, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 700, color: C.white, background: 'rgba(255,255,255,0.18)',
              padding: '3px 9px', borderRadius: 10 }}>{b}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CardBody({ children }) {
  return <div style={{ padding: '14px 20px 18px' }}>{children}</div>;
}

function TypeLabel({ num, title, desc, color }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color: C.white }}>
          {num}
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F' }}>{title}</span>
      </div>
      <div style={{ fontSize: 12, color: C.gray, paddingLeft: 38 }}>{desc}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TIPO 1 — FICHA DE PRODUCTO
// ═══════════════════════════════════════════════════════════════════════════
function FichaProducto({ panel, panelId, params }) {
  if (!panel) return null;
  const apParams = Object.entries(panel.esp ?? {})
    .filter(([, d]) => d?.ap != null)
    .sort(([a], [b]) => +a - +b);

  const paramsForPanel = params.filter(p => p.path.startsWith(`PANELS_TECHO.${panelId}`));
  const fijParams = params.filter(p => p.path.startsWith('FIJACIONES_VARILLA.') &&
    !p.path.includes('puntos_comercial') && !p.path.includes('varillas_por'));

  return (
    <Card>
      <CardHeader
        icon="🏗"
        title={panel.label}
        subtitle={panel.desc ?? 'Panel de techo con aislación'}
        badges={['TECHO', 'PIR']}
        color={C.navy}
      />
      <CardBody>
        <SectionDivider label="📐 Dimensiones" color={C.blue} />
        <ParamRow label="Ancho útil (au)" desc="Cobertura real por panel, descontando el solape de costillas"
          value={panel.au ?? 1.12} unit="m" />
        <ParamRow label="Largo mínimo" desc="Mínimo pedido a fábrica" value={panel.lmin ?? 2.3} unit="m" />
        <ParamRow label="Largo máximo" desc="Máxima longitud sin empalme" value={panel.lmax ?? 14} unit="m" />

        <SectionDivider label="⚖ Autoportancia — vano máximo entre apoyos" color={C.gold} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
          {apParams.map(([esp, data]) => (
            <div key={esp} style={{ textAlign: 'center', padding: '10px 8px', borderRadius: 9,
              background: '#FFF8E6', border: `1px solid ${C.gold}28` }}>
              <div style={{ fontSize: 10, color: C.gray, marginBottom: 3 }}>Espesor</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.gold }}>{esp}<span style={{ fontSize: 10, fontWeight: 400 }}>mm</span></div>
              <div style={{ fontSize: 10, color: C.gray, marginTop: 3 }}>máx</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1D1D1F' }}>{data.ap}<span style={{ fontSize: 10, fontWeight: 400 }}>m</span></div>
            </div>
          ))}
        </div>

        <SectionDivider label="🔩 Fijaciones — varilla roscada 3/8&quot;" color={C.blue} />
        {fijParams.map(p => (
          <ParamRow key={p.path} label={p.label} desc={p.formula} value={p.valor} unit={p.unidad}
            modified={p.valor !== p.default} />
        ))}

        <SectionDivider label="💰 Precios por espesor" color={C.green} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(panel.esp ?? {}).map(([esp, data]) => {
            if (!data?.pm2) return null;
            return (
              <div key={esp} style={{ padding: '7px 12px', borderRadius: 8, background: '#F0FFF4', border: `1px solid ${C.green}28`, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: C.gray }}>{esp}mm</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>${data.pm2}<span style={{ fontSize: 9, fontWeight: 400 }}>/m²</span></div>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TIPO 2 — FICHA DE SITUACIÓN
// ═══════════════════════════════════════════════════════════════════════════
function FichaSituacion({ params }) {
  const sitMap = {
    metal:    { color: C.blue,   icon: '🔩', label: 'Sobre Metal',    desc: 'Estructura de acero laminado. Tornillo mecha T14×5" autoperforante.', rosca: 0.10 },
    madera:   { color: '#A0522D', icon: '🌲', label: 'Sobre Madera',   desc: 'Viga o correa de madera. Tornillo aguja T14×5" para madera.', rosca: 0.05 },
    hormigon: { color: C.gray,   icon: '🏛', label: 'Sobre Hormigón', desc: 'Losa o viga de HA. Varilla roscada + taco expansivo Ø8mm.', rosca: 0.20 },
  };
  const roscaParams = {
    metal:    params.find(p => p.path === 'FIJACIONES_VARILLA.rosca_extra_metal_m'),
    madera:   params.find(p => p.path === 'FIJACIONES_VARILLA.rosca_extra_madera_m'),
    hormigon: params.find(p => p.path === 'FIJACIONES_VARILLA.rosca_extra_hormigon_m'),
  };

  return (
    <Card>
      <CardHeader icon="🏗" title="Situación: Tipo de Estructura"
        subtitle="Variables que cambian según el sustrato de apoyo de la cubierta"
        badges={['TECHO', 'FIJACIONES']} color={C.blue} />
      <CardBody>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {Object.entries(sitMap).map(([key, sit]) => {
            const param = roscaParams[key];
            const isModified = param && param.valor !== param.default;
            return (
              <div key={key} style={{ borderRadius: 11, border: `1.5px solid ${sit.color}30`,
                background: `${sit.color}06`, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: sit.color }}>
                  <div style={{ fontSize: 16 }}>{sit.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginTop: 3 }}>{sit.label}</div>
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.4, marginBottom: 12 }}>{sit.desc}</div>
                  <div style={{ fontSize: 11, color: C.gray, marginBottom: 4 }}>Rosca extra (penetración)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, padding: '5px 10px', borderRadius: 7, textAlign: 'center',
                      border: `1.5px solid ${isModified ? C.gold : sit.color}50`,
                      background: isModified ? '#FFFDF0' : C.white,
                      fontSize: 15, fontWeight: 800, color: isModified ? C.gold : sit.color,
                      fontVariantNumeric: 'tabular-nums' }}>
                      {param?.valor ?? sit.rosca}
                    </div>
                    <span style={{ fontSize: 11, color: C.gray }}>m</span>
                  </div>
                  {isModified && <div style={{ fontSize: 10, color: C.gold, fontWeight: 600, marginTop: 5 }}>
                    ● Modificado (default: {param.default}m)
                  </div>}
                  <div style={{ fontSize: 10, color: sit.color, marginTop: 8, fontWeight: 600 }}>
                    {key === 'metal' ? 'Tornillo mecha T14×5"' : key === 'madera' ? 'Tornillo aguja T14×5"' : 'Taco expansivo Ø8mm'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <SectionDivider label="⚙ Variable compartida — Espaciado de fijación" color={C.gray} />
        {(() => {
          const p = params.find(p2 => p2.path === 'FIJACIONES_VARILLA.espaciado_perimetro');
          return p ? <ParamRow label={p.label} desc={p.formula} value={p.valor} unit={p.unidad}
            modified={p.valor !== p.default} /> : null;
        })()}
      </CardBody>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TIPO 3 — FICHA DE ENCUENTRO
// ═══════════════════════════════════════════════════════════════════════════
function FichaEncuentro({ params }) {
  const perfParams = params.filter(p => p.path.startsWith('PERFILERIA.'));
  const sellParams = params.filter(p => p.path.startsWith('SELLADORES_TECHO.') &&
    !p.path.includes('comercial'));

  return (
    <Card>
      <CardHeader icon="🔗" title="Encuentro: Borde de Cubierta"
        subtitle="Perfilería, canalón y selladores — unión entre la cubierta y la estructura perimetral"
        badges={['TECHO', 'PERFILERÍA', 'SELLADORES']} color={C.teal} />
      <CardBody>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Perfilería */}
          <div>
            <SectionDivider label="📏 Perfilería" color={C.teal} />
            {perfParams.map(p => (
              <ParamRow key={p.path} label={p.label} desc={p.formula}
                value={p.valor} unit={p.unidad} color={C.teal} modified={p.valor !== p.default} />
            ))}

            <SectionDivider label="🗂 Tipos de perfil" color={C.teal} />
            {[
              { name: 'Gotero frontal',  desc: 'Alero — desvía agua al canalón',  icon: '💧' },
              { name: 'Babeta lateral',  desc: 'Bordes laterales — sello lateral', icon: '🔒' },
              { name: 'Babeta posterior', desc: 'Fondo del faldón — sello cumbrera', icon: '🔒' },
            ].map(t => (
              <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F' }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: C.gray }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Selladores */}
          <div>
            <SectionDivider label="🧴 Selladores" color={C.purple} />
            {sellParams.map(p => (
              <ParamRow key={p.path} label={p.label} desc={p.formula}
                value={p.valor} unit={p.unidad} color={C.purple} modified={p.valor !== p.default} />
            ))}

            <SectionDivider label="🧾 Productos de sellado" color={C.purple} />
            {[
              { name: 'Silicona Bromplast 600ml', desc: 'Juntas entre paneles y bordes', icon: '🟡' },
              { name: 'Cinta butilo',             desc: 'Solape longitudinal superior',   icon: '⬛' },
              { name: 'Membrana PVC',             desc: 'Perímetro de cubierta',          icon: '🟦' },
              { name: 'Espuma PU pistola',        desc: 'Extremos y huecos',              icon: '🟠' },
            ].map(t => (
              <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F' }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: C.gray }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TIPO 4 — FICHA DE SOLUCIÓN
// ═══════════════════════════════════════════════════════════════════════════
function FichaSolucion({ pricing }) {
  const panel = pricing?.PANELS_TECHO?.ISODEC_EPS;
  const largo = 6; const ancho = 5; const espesor = 100; const tipoEst = 'metal';

  const panResult = useMemo(() => panel ? calcPanelesTecho(panel, espesor, largo, ancho) : null, [panel]);
  const apResult  = useMemo(() => panel ? calcAutoportancia(panel, espesor, largo) : null, [panel]);
  const apoyos    = apResult?.apoyos ?? 3;
  const fijResult = useMemo(() => panel ? calcFijacionesVarilla(panel, espesor, largo, panResult?.cantPaneles ?? 5, apoyos, { tipoEst }) : null, [panel, panResult, apoyos]);
  const sellResult= useMemo(() => panel ? calcSelladoresTecho(panel, espesor, panResult?.cantPaneles ?? 5, largo) : null, [panel, panResult]);
  const perfResult= useMemo(() => {
    if (!panel) return null;
    const borders = { frente: 'gotero_frontal', fondo: 'babeta_adosar', lateral_izq: 'babeta_adosar', lateral_der: 'babeta_adosar' };
    return calcPerfileriaTecho(borders, panResult?.cantPaneles ?? 5, largo, (panResult?.cantPaneles ?? 5) * panel.au, 'ISODEC_EPS', espesor, {});
  }, [panel, panResult]);

  const allItems = [
    ...(panResult ? [{ label: `Panel ISODEC EPS ${espesor}mm`, cant: panResult.cantPaneles, unidad: 'm²', area: panResult.areaTotal?.toFixed(1), total: panResult.costoPaneles }] : []),
    ...(fijResult?.items ?? []).map(i => ({ ...i, label: i.label ?? i.sku })),
    ...(sellResult?.items ?? []).map(i => ({ ...i, label: i.label ?? i.sku })),
    ...(perfResult?.items ?? []).map(i => ({ ...i, label: i.label ?? i.sku })),
  ];
  const grandTotal = allItems.reduce((s, i) => s + (i.total ?? 0), 0);

  const specs = [
    { label: 'Producto',    value: 'ISODEC EPS 100mm',  icon: '🏗' },
    { label: 'Largo faldón', value: `${largo} m`,        icon: '↔' },
    { label: 'Ancho',       value: `${ancho} m`,         icon: '↕' },
    { label: 'Área total',  value: `${panResult?.areaTotal?.toFixed(1) ?? '?'} m²`, icon: '📐' },
    { label: 'Estructura',  value: 'Metal',              icon: '🔩' },
    { label: 'Apoyos',      value: `${apoyos}`,          icon: '⚖' },
  ];

  return (
    <Card>
      <CardHeader icon="✅" title="Solución: ISODEC EPS · Metal · 6×5m"
        subtitle="Cubierta completa — paneles + fijaciones + perfilería + selladores"
        badges={['ISODEC EPS', '100mm', 'METAL', '6×5m']} color={C.green} />
      <CardBody>
        {/* Specs row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {specs.map(s => (
            <div key={s.label} style={{ padding: '6px 12px', borderRadius: 8,
              background: `${C.green}08`, border: `1px solid ${C.green}28`, textAlign: 'center' }}>
              <div style={{ fontSize: 13 }}>{s.icon}</div>
              <div style={{ fontSize: 10, color: C.gray }}>{s.label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1D1D1F' }}>{s.value}</div>
            </div>
          ))}
        </div>

        <SectionDivider label="📋 BOM simulado — en vivo con parámetros actuales" color={C.green} />

        {/* BOM table */}
        <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px', padding: '6px 12px',
            background: C.bg, fontSize: 10, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 0.7 }}>
            <span>Ítem</span><span style={{ textAlign: 'center' }}>Cant.</span><span style={{ textAlign: 'right' }}>Total</span>
          </div>
          {allItems.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px',
              padding: '8px 12px', borderTop: `1px solid ${C.border}`,
              background: i % 2 === 0 ? C.white : '#FAFAFA' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F' }}>
                  {item.label}
                </div>
                {item.area && <div style={{ fontSize: 10, color: C.gray }}>{item.area} m²</div>}
              </div>
              <div style={{ textAlign: 'center', fontSize: 12, color: C.gray, alignSelf: 'center' }}>
                {item.cant ?? '—'} {item.unidad ?? ''}
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#1D1D1F', alignSelf: 'center', fontVariantNumeric: 'tabular-nums' }}>
                ${(item.total ?? 0).toFixed(2)}
              </div>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px', padding: '10px 12px',
            borderTop: `2px solid ${C.green}`, background: `${C.green}08` }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1D1D1F' }}>TOTAL SOLUCIÓN</span>
            <span style={{ textAlign: 'right', fontSize: 16, fontWeight: 800, color: C.green, fontVariantNumeric: 'tabular-nums' }}>
              ${grandTotal.toFixed(2)}
            </span>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: '8px 12px', background: '#F0FFF4', borderRadius: 8,
          border: `1px solid ${C.green}30`, fontSize: 11, color: C.gray }}>
          💡 Este BOM se recalcula en vivo al modificar cualquier parámetro en las fichas de producto o situación.
        </div>
      </CardBody>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN — FichasPreview
// ═══════════════════════════════════════════════════════════════════════════
export default function FichasPreview() {
  const pricing = useMemo(() => getPricing(), []);
  const params  = useMemo(() => getDimensioningItemsFlat(), []);

  const panelIsodecEps = pricing?.PANELS_TECHO?.ISODEC_EPS;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FONT }}>
      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
        background: C.white, borderBottom: `1px solid ${C.border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,.04)', position: 'sticky', top: 0, zIndex: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: C.navy, marginRight: 8 }}>BMC</span>
        <Link to="/hub" style={{ padding: '7px 13px', borderRadius: 9, textDecoration: 'none', fontSize: 13, fontWeight: 600, color: '#1D1D1F', border: '1.5px solid #E5E5EA' }}>Wolfboard</Link>
        <Link to="/inspector" style={{ padding: '7px 13px', borderRadius: 9, textDecoration: 'none', fontSize: 13, fontWeight: 600, color: '#1D1D1F', border: '1.5px solid #E5E5EA' }}>Inspector</Link>
        <span style={{ padding: '7px 13px', borderRadius: 9, fontSize: 13, fontWeight: 600, color: C.white, background: C.navy, border: 'none' }}>Fichas ✦ Preview</span>
      </nav>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 20px 60px', boxSizing: 'border-box' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ background: C.navy, color: C.white, fontSize: 10, fontWeight: 700,
              padding: '3px 10px', borderRadius: 10, letterSpacing: 1 }}>VISTA PREVIA DE CONCEPTO</div>
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, color: '#1D1D1F' }}>Fichas de Cálculo BMC</h1>
          <p style={{ margin: 0, fontSize: 14, color: C.gray, lineHeight: 1.5, maxWidth: 560 }}>
            En lugar de listas de parámetros por función matemática, cada ficha agrupa todo lo que define un <strong>producto</strong>, <strong>situación</strong>, <strong>encuentro</strong> o <strong>solución completa</strong>. Datos reales. Edición directa. BOM en vivo.
          </p>
        </div>

        {/* TIPO 1 */}
        <div style={{ marginBottom: 36 }}>
          <TypeLabel num="1" title="Ficha de Producto" color={C.navy}
            desc="Una ficha por familia de panel — dimensiones, autoportancia, fijaciones y precios en un solo lugar." />
          <FichaProducto panel={panelIsodecEps} panelId="ISODEC_EPS" params={params} />
        </div>

        {/* TIPO 2 */}
        <div style={{ marginBottom: 36 }}>
          <TypeLabel num="2" title="Ficha de Situación" color={C.blue}
            desc="Variables que cambian según el substrato de apoyo: metal, madera u hormigón." />
          <FichaSituacion params={params} />
        </div>

        {/* TIPO 3 */}
        <div style={{ marginBottom: 36 }}>
          <TypeLabel num="3" title="Ficha de Encuentro" color={C.teal}
            desc="Parámetros de una unión constructiva: bordes de cubierta, canalón, selladores y tipos de perfil." />
          <FichaEncuentro params={params} />
        </div>

        {/* TIPO 4 */}
        <div style={{ marginBottom: 36 }}>
          <TypeLabel num="4" title="Ficha de Solución" color={C.green}
            desc="Combinación producto + situación + geometría → BOM completo simulado en vivo con todos los parámetros actuales." />
          <FichaSolucion pricing={pricing} />
        </div>

        {/* Footer CTA */}
        <div style={{ padding: '20px 24px', background: C.white, borderRadius: 14,
          border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F', marginBottom: 3 }}>¿Aprobás el concepto?</div>
            <div style={{ fontSize: 12, color: C.gray }}>Si sí, implementamos la versión completa con edición en vivo y navegación por fichas.</div>
          </div>
          <Link to="/inspector" style={{ padding: '9px 18px', borderRadius: 9, background: C.navy,
            color: C.white, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
            ← Volver al Inspector
          </Link>
        </div>
      </div>
    </div>
  );
}
