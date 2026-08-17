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
    // Sin datos bancarios cargados todavía: el template muestra "A completar"
    // en vez de inventarlos.
    banco: '',
    telefono: '',
    logoDataUrl: null, // null ⇒ el template usa su logo vectorial propio
  },
};

/** Perfil activo, o null si no hay white-label. */
export const WHITELABEL_BRAND = WHITELABEL ? (WHITELABEL_BRANDS[WHITELABEL] ?? null) : null;

/** Layout de PDF forzado por el white-label, o null. */
export const WHITELABEL_LAYOUT = WHITELABEL_BRAND?.layout ?? null;

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
