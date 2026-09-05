// src/config/whitelabel.js
// Modo white-label: una marca socia corre su propia calculadora en un deploy
// paralelo, sin tocar la producción BMC.
//
// Se activa por env y NO existe en la prod normal:
//   frontend (Vite)  VITE_WHITELABEL=bc
//   API (Node)       WHITELABEL=bc
//
// Con el flag encendido, el selector de PDF ofrece un único layout (el de la
// marca) y ése es el default. Sin el flag, todo queda exactamente como está y
// los layouts white-label ni siquiera aparecen en la lista.
//
// Este módulo lo importan tanto el bundle de Vite como el server en Node, así
// que la lectura de env tiene que funcionar en los dos runtimes.

/* global process -- el server importa este archivo desde Node; el acceso va
   detrás de un guard `typeof process !== 'undefined'` para el bundle. */

// Vite reemplaza `import.meta.env.VITE_WHITELABEL` literalmente en build, por
// eso va en forma estática. En Node `import.meta.env` es undefined y el guard
// evita el acceso.
const VITE_WHITELABEL = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_WHITELABEL
  : undefined;

const NODE_WHITELABEL = (typeof process !== 'undefined' && process.env)
  ? process.env.WHITELABEL
  : undefined;

/** Identificador de marca activa, o null en la calculadora BMC normal. */
export const WHITELABEL = String(VITE_WHITELABEL ?? NODE_WHITELABEL ?? '')
  .trim()
  .toLowerCase() || null;

/**
 * Perfiles de marca. `marca` es el nombre comercial que se ve arriba; la razón
 * social y el RUT viven sólo en el pie legal del presupuesto.
 *
 * Estos valores son el default del deploy. Cuando el registro de branding por
 * usuario esté disponible (identity.users.branding), el modelo puede traer un
 * `branding` que pisa campo por campo — ver mergeBranding().
 */
export const WHITELABEL_BRANDS = {
  bc: {
    layout: 'bc',
    marca: 'BC',
    descriptor: 'Paneles aislantes\nTechos y fachadas',
    razonSocial: 'Jenerik Bentancor',
    rut: '150633750010',
    direccion: 'Florencio Sánchez y Ruta 5 vieja, Progreso',
    banco: 'BROU 001559594-00002 · ITAÚ 2166144',
    telefono: '',
    banks: [
      { banco: 'BROU', titular: 'Jenerik Bentancor', uyu: '001559594-00001', usd: '001559594-00002' },
      { banco: 'ITAÚ', titular: 'Jenerik Bentancor', uyu: '2166136', usd: '2166144' },
    ],
    logoDataUrl: null,
    site: 'https://calculadora-bc.vercel.app',
    ident: {
      style: 'gold-title',
      bg: '#0C0906',
      ink: '#F4E8C8',
      accent: '#C4A15A',
      accentSoft: '#8A6A32',
      sting: '/audio/ident/bc-gold-foil.wav',
    },
    agent: {
      name: 'JenIA',
      subtitle: 'Asistente BC',
      greeting: '¡Hola! Soy JenIA',
      emptyHint: 'Dale! Tirame un presupuesto que te lo saco!',
      wake: ['jenia', 'genia', 'jeni a', 'yeni a'],
      persona: 'Sos JenIA, cotizador de BC. Hablás como vendedor uruguayo de paneles para techos y fachadas: claro, cercano, sin jerga de fábrica ajena.',
      closing: 'Saludos, BC',
      whoMakes: 'Son paneles de la línea ISODEC / ISOROOF / ISOPANEL. Los comercializa BC.',
    },
  },
  paneleslam: {
    layout: 'paneleslam',
    marca: 'LAM',
    descriptor: 'Paneles aislantes',
    razonSocial: 'Paneles LAM',
    rut: '',
    direccion: '',
    banco: '',
    telefono: '',
    logoDataUrl: null,
    site: 'https://calculadora-paneleslam.vercel.app',
    web: 'https://paneleslam.com.uy',
    ident: {
      style: 'stack',
      bg: '#1A1410',
      ink: '#F3EDE6',
      accent: '#B85C42',
      accentSoft: '#A3988C',
      sting: '/audio/ident/lam-three-planks.wav',
    },
    agent: {
      name: 'MonkIA',
      subtitle: 'Asistente LAM',
      greeting: '¡Hola! Soy MonkIA',
      emptyHint: 'Dale! Tirame un presupuesto que te lo saco!',
      wake: ['monkia', 'monquia', 'monk ia', 'monki a'],
      persona: 'Sos MonkIA, cotizador de LAM (Paneles LAM). Hablás como vendedor uruguayo de paneles aislantes: directo y profesional.',
      closing: 'Saludos, LAM',
      whoMakes: 'Son paneles de la línea ISODEC / ISOROOF / ISOPANEL. Los comercializa LAM.',
    },
  },
  smartbuilding: {
    layout: 'smartbuilding',
    marca: 'SMARTBUILDING',
    codePrefix: 'SMART',
    descriptor: 'Paneles y sistemas constructivos',
    razonSocial: 'SmartBuilding',
    rut: '',
    direccion: '',
    banco: '',
    telefono: '',
    logoDataUrl: null,
    site: 'https://calculadora-smartbuilding.vercel.app',
    ident: {
      style: 'imax-void',
      bg: '#0B0B0C',
      ink: '#F4F5F7',
      accent: '#E4E7EB',
      accentSoft: '#9AA3AD',
      sting: '/audio/ident/smart-imax-air.wav',
    },
    theme: {
      headerBg: '#0B0B0C',
      headerInk: '#F4F5F7',
      accent: '#E4E7EB',
      accentSoft: '#9AA3AD',
      wash: '#EEF2F5',
      ink: '#101114',
      paper: '#FFFFFF',
      rule: '#C5CCD3',
    },
    agent: {
      name: 'Basuuuu IA',
      subtitle: 'Asistente SmartBuilding',
      greeting: '¡Hola! Soy Basuuuu IA',
      emptyHint: 'Dale! Tirame un presupuesto que te lo saco!',
      wake: ['basuuuu', 'basuu', 'basu', 'bazú', 'bazuu'],
      persona: 'Sos Basuuuu IA, cotizador de SmartBuilding. Hablás como asesor de sistemas constructivos con paneles: preciso, ordenado, tono técnico-comercial.',
      closing: 'Saludos, SmartBuilding',
      whoMakes: 'Son paneles de la línea ISODEC / ISOROOF / ISOPANEL. Los comercializa SmartBuilding.',
    },
  },
};

const BMC_AGENT = {
  name: 'Panelin',
  subtitle: 'Asistente BMC Uruguay',
  greeting: '¡Hola! Soy Panelin',
  emptyHint: 'Te ayudo a cotizar paneles para tu obra. Contame qué necesitás.',
  wake: ['panelin', 'panel in', 'panelina', 'panecillo'],
  persona: 'Sos Panelin, asistente experto de ventas de BMC Uruguay (METALOG SAS).',
  closing: 'Saludos, BMC Uruguay',
  whoMakes: 'BMC Uruguay fabrica y vende paneles de aislamiento térmico (ISODEC, ISOROOF, ISOPANEL).',
};

export const TENANT_FORBIDDEN_BRANDS = ['BMC Uruguay', 'BMC', 'Panelin', 'Metalog', 'METALOG', 'METALOG SAS'];

/**
 * Named calculator agent for a tenant slug, or Panelin when slug is empty/BMC.
 * @param {string|null|undefined} slug
 */
export function agentIdentity(slug) {
  const key = String(slug || '').trim().toLowerCase();
  const brand = key ? WHITELABEL_BRANDS[key] : null;
  const pack = brand?.agent;
  if (!pack) {
    return { slug: null, brandName: 'BMC Uruguay', ...BMC_AGENT };
  }
  return {
    slug: key,
    brandName: brand.marca || key,
    legalName: brand.razonSocial || brand.marca || key,
    name: pack.name,
    subtitle: pack.subtitle,
    greeting: pack.greeting,
    emptyHint: pack.emptyHint,
    wake: Array.isArray(pack.wake) ? pack.wake : BMC_AGENT.wake,
    persona: pack.persona || `Sos ${pack.name}, cotizador de ${brand.marca || key}.`,
    closing: pack.closing || `Saludos, ${brand.marca || key}`,
    whoMakes: pack.whoMakes || `Son paneles de la línea ISODEC / ISOROOF / ISOPANEL. Los comercializa ${brand.marca || key}.`,
    forbidden: TENANT_FORBIDDEN_BRANDS,
  };
}

/** Active deploy's agent (Vite/Node WHITELABEL), or Panelin on BMC. */
export const WHITELABEL_AGENT = agentIdentity(WHITELABEL);

/** Perfil activo, o null si no hay white-label. */
export const WHITELABEL_BRAND = WHITELABEL ? (WHITELABEL_BRANDS[WHITELABEL] ?? null) : null;

/** Layout de PDF forzado por el white-label, o null. */
export const WHITELABEL_LAYOUT = WHITELABEL_BRAND?.layout ?? null;

export function quoteCodePrefix() {
  if (!WHITELABEL_BRAND) return "BMC";
  return String(WHITELABEL_BRAND.codePrefix || WHITELABEL_BRAND.marca || "BC").toUpperCase();
}

export function brandTheme() {
  return WHITELABEL_BRAND?.theme || null;
}

/** Price-list toggle labels. Tenants never show the BMC name. */
export function priceListLabels() {
  if (WHITELABEL_BRAND) {
    return { venta: "Tu precio", web: "Precio lista" };
  }
  return { venta: "Precio BMC", web: "Precio Web" };
}

/** Display remap: BMC-2026-0012 → BC-2026-0012 in the socio deploy. */
export function formatQuoteCode(code) {
  if (code == null || code === "") return code;
  const s = String(code);
  if (WHITELABEL_BRAND && /^BMC-/i.test(s)) {
    return s.replace(/^BMC-/i, `${quoteCodePrefix()}-`);
  }
  return s;
}

/** Ids de layout que sólo existen dentro de un deploy white-label. */
export const WHITELABEL_LAYOUT_IDS = Object.values(WHITELABEL_BRANDS).map(b => b.layout);

/**
 * Combina el perfil del deploy con el branding que venga en el modelo
 * (por ejemplo el que carga el propio socio). Sólo pisan los campos con valor,
 * para que un branding parcial no borre los defaults.
 */
export function mergeBranding(base, override) {
  if (!override || typeof override !== 'object') return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v !== null && v !== undefined && v !== '') out[k] = v;
  }
  return out;
}
