/**
 * Medios del visor de cotización — imágenes desde CDN Shopify (bmcuruguay.com.uy).
 * URLs alineadas a la colección Paneles Aislantes y productos vinculados en tienda.
 *
 * Tienda: https://bmcuruguay.com.uy/collections/paneles-aislantes
 *
 * --- Visor derecho: qué mostrar paso a paso (wizard solo_techo; otros escenarios análogos) ---
 * - escenario: carrusel contextual de cubierta / escenario.
 * - tipoAguas: una y dos aguas con fotos por defecto + subida (sessionStorage); carrusel pausado.
 * - lista: video en loop del personaje **Panelin** (`/video/panelin-lista-loop.mp4`), sin UI de reproductor; host 3D oculto en este paso.
 * - familia…color: slides según línea y contexto getQuoteVisorContext.
 * - dimensiones: host 3D (si hay zonas válidas) + cinta con L×W de zonas si el padre la envía; carrusel.
 * - bordes en adelante: 3D + slides de borde / encuentros cuando aplica.
 * Cabecera del visor (chevron): colapsar / expandir. Separador central del layout: arrastrar o doble clic para reset y maximizar área visual.
 */

export const QUOTE_VISOR_SHOP_URLS = {
  panelesAislantes: "https://bmcuruguay.com.uy/collections/paneles-aislantes",
  catalogoCompleto: "https://bmcuruguay.com.uy/collections/all",
  isopanelEps: "https://bmcuruguay.com.uy/products/isopanel-eps-paredes-y-fachadas",
};

/** @typedef {{ src: string; title: string; subtitle?: string }} QuoteVisorSlide */

/** Paneles de cubierta (ISODEC EPS/PIR, ISOROOF, Hiansa) — colección paneles aislantes */
export const SLIDES_SOLO_TECHO = /** @type {QuoteVisorSlide[]} */ ([
  {
    src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/ISODEC_GRIS.png?v=1756747335",
    title: "ISODEC EPS",
    subtitle: "Techos y cubiertas — 100 a 250 mm",
  },
  {
    src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/Isodec_PIR.png?v=1755503238",
    title: "ISODEC PIR",
    subtitle: "Techos y cubiertas — 50, 80, 120 mm",
  },
  {
    src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/file.jpg?v=1752178338",
    title: "ISOROOF 3G",
    subtitle: "Techos livianos",
  },
  {
    src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/file.jpg?v=1752178338",
    title: "ISOROOF PLUS 3G",
    subtitle: "Línea premium",
  },
  {
    src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/file.jpg?v=1752178338",
    title: "ISOROOF FOIL 3G",
    subtitle: "Membrana foil",
  },
  {
    src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/HIANZA-PUR-5G-BECAM-GRIS.webp?v=1748592601",
    title: "Hiansa-Panel 5G",
    subtitle: "Trapezoidal BECAM",
  },
]);

/** Fachada — ISOPANEL EPS (galería producto) */
export const SLIDES_SOLO_FACHADA = /** @type {QuoteVisorSlide[]} */ ([
  {
    src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/1e03a1_6071dc1dcd5743968a0bbe3e23fce220_mv2.png?v=1752607327",
    title: "ISOPANEL EPS",
    subtitle: "Paredes y fachadas",
  },
  {
    src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/Captura_de_pantalla_2025-07-25_113729.png?v=1753454403",
    title: "ISOPANEL EPS",
    subtitle: "Terminación exterior Gris",
  },
  {
    src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/Captura_de_pantalla_2025-07-25_113936.png?v=1753454404",
    title: "ISOPANEL EPS",
    subtitle: "Terminación exterior Rojo",
  },
]);

/** Proyecto techo + fachada: paneles cubierta + cerramiento + ISOWALL */
export const SLIDES_TECHO_FACHADA = /** @type {QuoteVisorSlide[]} */ ([
  ...SLIDES_SOLO_TECHO.slice(0, 4),
  ...SLIDES_SOLO_FACHADA,
  {
    src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/isowall_jpg.webp?v=1756840865",
    title: "ISOWALL PIR",
    subtitle: "Fachadas 50–100 mm",
  },
]);

/** Cámara frigorífica: cerramientos térmicos y detalles tipo cámara (goteros, perfiles) */
export const SLIDES_CAMARA_FRIG = /** @type {QuoteVisorSlide[]} */ ([
  {
    src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/isowall_jpg.webp?v=1756840865",
    title: "ISOWALL PIR",
    subtitle: "Cerramientos para frío",
  },
  {
    src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/Isodec_PIR.png?v=1755503238",
    title: "ISODEC PIR",
    subtitle: "Cubierta térmica",
  },
  ...SLIDES_SOLO_FACHADA.slice(0, 2),
  {
    src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/3D-GoteroSuperiordeCamaraIsoroof3G-Gris-WEB01.png?v=1752254989",
    title: "Gotero superior cámara",
    subtitle: "ISOROOF",
  },
  {
    src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/Modelo3dG.LateralCamara-Gris-WEB01.png?v=1752240908",
    title: "Gotero lateral cámara",
    subtitle: "ISOROOF",
  },
  {
    src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/3D-GoteroLateraldeCamaraISODEC-Blanco-Renderizado-WEB01.png?v=1748581487",
    title: "Gotero lateral cámara",
    subtitle: "ISODEC EPS / PIR",
  },
]);

/** Presupuesto libre — mezcla paneles + ejemplo de catálogo accesorios */
export const SLIDES_PRESUPUESTO_LIBRE = /** @type {QuoteVisorSlide[]} */ ([
  ...SLIDES_SOLO_TECHO.slice(0, 3),
  {
    src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/BabetadeAtornillarIsodec.jpg?v=1755206215",
    title: "Accesorios y herrajes",
    subtitle: "Catálogo completo en tienda",
  },
  {
    src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/Anguloestructural-PerfilAluminioTipoK6_8m.jpg?v=1755192296",
    title: "Perfiles y complementos",
    subtitle: "bmcuruguay.com.uy — Productos",
  },
]);

/** Imágenes de referencia fijas para tipología de aguas */
export const DEFAULT_AGUA_REFERENCE_IMAGES = {
  una_agua: `${import.meta.env.BASE_URL}images/1-agua.png`,
  dos_aguas: `${import.meta.env.BASE_URL}images/2-aguas.png`,
};

const FAMILIA_TECHO_SLIDE = {
  ISODEC_EPS: SLIDES_SOLO_TECHO[0],
  ISODEC_PIR: SLIDES_SOLO_TECHO[1],
  ISOROOF_3G: SLIDES_SOLO_TECHO[2],
  ISOROOF_PLUS: SLIDES_SOLO_TECHO[3],
  ISOROOF_FOIL: SLIDES_SOLO_TECHO[4],
  /** Colonial: misma referencia visual que línea ISOROOF en tienda hasta asset dedicado */
  ISOROOF_COLONIAL: {
    src: SLIDES_SOLO_TECHO[2].src,
    title: "Isoroof Colonial",
    subtitle: "Teja exterior · interior blanco",
  },
};

/**
 * @param {object} p
 * @param {string} p.scenarioId
 * @param {string | null} [p.stepId]
 * @param {string} [p.techoFamilia]
 * @returns {{ slides: QuoteVisorSlide[]; shopHref: string; heading: string }}
 */
export function getQuoteVisorContext({ scenarioId, stepId, techoFamilia }) {
  const base = {
    slides: SLIDES_SOLO_TECHO,
    shopHref: QUOTE_VISOR_SHOP_URLS.panelesAislantes,
    heading: "Paneles para cubierta",
  };

  switch (scenarioId) {
    case "solo_fachada":
      return {
        slides: SLIDES_SOLO_FACHADA,
        shopHref: QUOTE_VISOR_SHOP_URLS.isopanelEps,
        heading: "Paneles de fachada",
      };
    case "techo_fachada":
      return {
        slides: SLIDES_TECHO_FACHADA,
        shopHref: QUOTE_VISOR_SHOP_URLS.catalogoCompleto,
        heading: "Proyecto techo y fachada",
      };
    case "camara_frig":
      return {
        slides: SLIDES_CAMARA_FRIG,
        shopHref: QUOTE_VISOR_SHOP_URLS.catalogoCompleto,
        heading: "Cámara frigorífica",
      };
    case "presupuesto_libre":
      return {
        slides: SLIDES_PRESUPUESTO_LIBRE,
        shopHref: QUOTE_VISOR_SHOP_URLS.catalogoCompleto,
        heading: "Catálogo y paneles",
      };
    case "solo_techo":
    default:
      break;
  }

  if (scenarioId === "solo_techo" && stepId === "familia" && techoFamilia && FAMILIA_TECHO_SLIDE[techoFamilia]) {
    const one = FAMILIA_TECHO_SLIDE[techoFamilia];
    return {
      slides: [one, ...SLIDES_SOLO_TECHO.filter((s) => s.src !== one.src)].slice(0, 6),
      shopHref: QUOTE_VISOR_SHOP_URLS.panelesAislantes,
      heading: one.title,
    };
  }

  return base;
}
