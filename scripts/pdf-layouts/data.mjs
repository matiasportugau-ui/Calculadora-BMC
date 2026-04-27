// Shared mock data and helpers for the 10 PDF layout variants.
// All layouts use the same content so we're comparing visual treatment,
// not different information.

export const mock = {
  company: {
    name: "BMC URUGUAY",
    legal: "Metalog SAS",
    rut: "120403430012",
    site: "bmcuruguay.com.uy",
    phone: "092 663 245",
    email: "ventas@bmcuruguay.com.uy",
    bank: "BROU · Cta. Dólares 110520638-00002",
  },
  client: {
    nombre: "Constructora Sol del Este S.A.",
    obra: "Galpón de almacenamiento — Maldonado",
    ref: "BMC-2026-0427-01",
    tel: "+598 92 555 010",
    dir: "Ruta 9 Km 110, Maldonado",
    fecha: "27/04/2026",
  },
  scenario: {
    label: "Techo + Fachada",
    panel: "ISODEC PIR 50mm",
    color: "Blanco",
    autoportante: "AU = 8.0 m",
  },
  geom: {
    largo: 12.0,    // m
    ancho: 8.0,     // m
    paneles: 12,
    panelW: 1.0,
    panelL: 8.0,
    pendiente: "8%",
    apoyos: 4,
    ptsFijacion: 96,
    area: 96.0,
  },
  bom: [
    {
      group: "Paneles ISODEC PIR 50mm",
      total: 3720,
      items: [
        { tag: "T-01..T-12", tagClass: "T",
          desc: "Panel ISODEC PIR 50mm · Blanco · 1.0 × 8.0 m",
          cant: 12, unit: "u", pu: 310.00, total: 3720.00 },
      ],
    },
    {
      group: "Bordes y cierres",
      total: 642,
      items: [
        { tag: "FONDO", tagClass: "FONDO",
          desc: "Cumbrera articulada · chapa galvanizada",
          cant: 12.0, unit: "m", pu: 18.50, total: 222.00 },
        { tag: "FRENTE", tagClass: "FRENTE",
          desc: "Canalón rectangular 200mm · chapa galvanizada",
          cant: 12.0, unit: "m", pu: 22.50, total: 270.00 },
        { tag: "LAT-IZQ", tagClass: "LATIZQ",
          desc: "Cierre lateral · chapa plegada",
          cant: 8.0, unit: "m", pu: 9.40, total: 75.00 },
        { tag: "LAT-DER", tagClass: "LATDER",
          desc: "Cierre lateral · chapa plegada",
          cant: 8.0, unit: "m", pu: 9.40, total: 75.00 },
      ],
    },
    {
      group: "Fijación y accesorios",
      total: 192,
      items: [
        { tag: "FIX", tagClass: "FIX",
          desc: "Tornillo autoperforante 6.3 × 80 c/arandela EPDM",
          cant: 96, unit: "u", pu: 1.20, total: 115.20 },
        { tag: "FIX", tagClass: "FIX",
          desc: "Sellador silicona neutra · cartucho 280 ml",
          cant: 8, unit: "u", pu: 9.60, total: 76.80 },
      ],
    },
  ],
  totals: {
    subtotal: 4554.00,
    iva: 1001.88,
    total: 5555.88,
  },
};

export const fmt = (n) => new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(n);

// All BOM rows flattened, used by some compact layouts.
export function flatRows() {
  const rows = [];
  for (const g of mock.bom) {
    rows.push({ kind: "group", title: g.group, total: g.total });
    for (const it of g.items) rows.push({ kind: "item", ...it });
  }
  return rows;
}

// ----------------------------------------------------------------------------
// 2D ROOF PLAN SVG (annotated). Configurable colors per layout.
// Returns inline SVG with panel labels T-01..T-12 and 4 border ribbons.
// ----------------------------------------------------------------------------
export function planSvg(opts = {}) {
  const o = {
    bg: "#F8FAFC",
    outline: "#003366",
    panelStroke: "#94A3B8",
    panelFill: "transparent",
    badgeFill: "#1E3A8A",
    badgeText: "#fff",
    fondoFill: "#FEF3C7", fondoStroke: "#854D0E", fondoText: "#854D0E",
    frenteFill: "#DCFCE7", frenteStroke: "#166534", frenteText: "#166534",
    latIzqFill: "#FCE7F3", latIzqStroke: "#9D174D", latIzqText: "#9D174D",
    latDerFill: "#E9D5FF", latDerStroke: "#6B21A8", latDerText: "#6B21A8",
    dimColor: "#DC2626",
    slopeColor: "#003366",
    showSlope: true,
    showSubcotas: true,
    fontFamily: "Helvetica, Arial, sans-serif",
    height: "235px",
    radiusBadge: 60,
    ...opts,
  };
  // 12 panels of 1000mm wide × 8000 long; viewBox in mm with padding.
  const panels = Array.from({ length: 12 }, (_, i) => i + 1);
  const panelLines = panels.slice(0, 11).map((i) =>
    `<line x1="${i * 1000}" y1="0" x2="${i * 1000}" y2="8000"/>`,
  ).join("");
  const badges = panels.map((n) => {
    const cx = (n - 1) * 1000 + 500;
    return `<g transform="translate(${cx},4000)">
      <rect x="-260" y="-160" width="520" height="320" rx="${o.radiusBadge}" fill="${o.badgeFill}"/>
      <text x="0" y="80" text-anchor="middle" font-size="240" fill="${o.badgeText}">T-${String(n).padStart(2, "0")}</text>
    </g>`;
  }).join("");

  const subcotaTicks = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000].map((x) =>
    `<line x1="${x}" y1="-580" x2="${x}" y2="-780" stroke-width="8"/>`,
  ).join("");

  return `<svg viewBox="-1700 -1500 16200 11400" preserveAspectRatio="xMidYMid meet" style="width:100%;height:${o.height};display:block">
    <defs>
      <marker id="arrowR" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="${o.dimColor}"/>
      </marker>
      <marker id="arrowRback" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M10,0 L0,5 L10,10 Z" fill="${o.dimColor}"/>
      </marker>
      <marker id="arrowSlope" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="${o.slopeColor}"/>
      </marker>
    </defs>
    <rect x="0" y="0" width="12000" height="8000" fill="${o.bg}" stroke="${o.outline}" stroke-width="35"/>
    <g stroke="${o.panelStroke}" stroke-width="14" stroke-dasharray="60 60" fill="${o.panelFill}">${panelLines}</g>
    ${o.showSlope ? `
      <g opacity="0.7">
        <line x1="11000" y1="900" x2="11000" y2="2900" stroke="${o.slopeColor}" stroke-width="22" marker-end="url(#arrowSlope)"/>
        <text x="10780" y="1900" font-size="220" fill="${o.slopeColor}" font-weight="700" font-family="${o.fontFamily}" text-anchor="end">pendiente</text>
        <text x="10780" y="2180" font-size="220" fill="${o.slopeColor}" font-weight="800" font-family="${o.fontFamily}" text-anchor="end">${mock.geom.pendiente}</text>
      </g>` : ""}
    <g font-family="${o.fontFamily}" font-weight="800">${badges}</g>

    <rect x="0" y="-380" width="12000" height="280" fill="${o.fondoFill}" stroke="${o.fondoStroke}" stroke-width="12"/>
    <text x="6000" y="-180" text-anchor="middle" font-size="220" fill="${o.fondoText}" font-weight="800" font-family="${o.fontFamily}">FONDO · cumbrera</text>
    <rect x="0" y="8100" width="12000" height="280" fill="${o.frenteFill}" stroke="${o.frenteStroke}" stroke-width="12"/>
    <text x="6000" y="8300" text-anchor="middle" font-size="220" fill="${o.frenteText}" font-weight="800" font-family="${o.fontFamily}">FRENTE · canalón</text>
    <rect x="-380" y="0" width="280" height="8000" fill="${o.latIzqFill}" stroke="${o.latIzqStroke}" stroke-width="12"/>
    <text x="-220" y="4000" text-anchor="middle" font-size="220" fill="${o.latIzqText}" font-weight="800" font-family="${o.fontFamily}" transform="rotate(-90,-220,4000)">LAT-IZQ</text>
    <rect x="12100" y="0" width="280" height="8000" fill="${o.latDerFill}" stroke="${o.latDerStroke}" stroke-width="12"/>
    <text x="12260" y="4000" text-anchor="middle" font-size="220" fill="${o.latDerText}" font-weight="800" font-family="${o.fontFamily}" transform="rotate(90,12260,4000)">LAT-DER</text>

    <g stroke="${o.dimColor}" stroke-width="14" font-family="${o.fontFamily}" fill="${o.dimColor}">
      <line x1="0" y1="9100" x2="12000" y2="9100" marker-start="url(#arrowRback)" marker-end="url(#arrowR)"/>
      <line x1="0" y1="9000" x2="0" y2="9300" stroke-width="10"/>
      <line x1="12000" y1="9000" x2="12000" y2="9300" stroke-width="10"/>
      <text x="6000" y="9520" text-anchor="middle" font-size="280" font-weight="800">12 000</text>
    </g>
    <g stroke="${o.dimColor}" stroke-width="14" font-family="${o.fontFamily}" fill="${o.dimColor}">
      <line x1="13100" y1="0" x2="13100" y2="8000" marker-start="url(#arrowRback)" marker-end="url(#arrowR)"/>
      <line x1="13000" y1="0" x2="13300" y2="0" stroke-width="10"/>
      <line x1="13000" y1="8000" x2="13300" y2="8000" stroke-width="10"/>
      <text x="13350" y="4000" text-anchor="middle" font-size="280" font-weight="800" transform="rotate(90,13350,4000)">8 000</text>
    </g>
    ${o.showSubcotas ? `
      <g stroke="${o.dimColor}" stroke-width="10" font-family="${o.fontFamily}" fill="${o.dimColor}" opacity="0.85">
        <line x1="0" y1="-680" x2="12000" y2="-680"/>
        ${subcotaTicks}
        <text x="6000" y="-820" text-anchor="middle" font-size="180" font-weight="700">12 × 1 000  (paneles T-01 a T-12)</text>
      </g>` : ""}
  </svg>`;
}
