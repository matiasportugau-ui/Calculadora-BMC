import shopifyFamiliesMap from "./quoteVisorShopifyFamilies.json" with { type: "json" };
import { ROOF_CATALOG_MAP_URL_BY_FAMILIA } from "./roofPanelCatalogMapUrls.js";

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

/** @typedef {{ src: string; title: string; subtitle?: string; description?: string; href?: string }} QuoteVisorSlide */

/** Paneles de cubierta (ISODEC EPS/PIR, ISOROOF, Hiansa) — colección paneles aislantes */
export const SLIDES_SOLO_TECHO = /** @type {QuoteVisorSlide[]} */ ([
  {
    src: ROOF_CATALOG_MAP_URL_BY_FAMILIA.ISODEC_EPS,
    title: "ISODEC EPS",
    subtitle: "Techos y cubiertas — 100 a 250 mm",
    description:
      "Panel aislante para cubiertas de alta resistencia. Núcleo EPS con terminación prepintada, pensado para obra rápida, buen comportamiento térmico y soluciones industriales o residenciales.",
  },
  {
    src: ROOF_CATALOG_MAP_URL_BY_FAMILIA.ISODEC_PIR,
    title: "ISODEC PIR",
    subtitle: "Techos y cubiertas — 50, 80, 120 mm",
    description:
      "Panel de cubierta con núcleo PIR para mayor eficiencia térmica. Opción premium para proyectos que priorizan aislación, rendimiento energético y control de temperatura interior.",
  },
  {
    src: ROOF_CATALOG_MAP_URL_BY_FAMILIA.ISOROOF_3G,
    title: "ISOROOF 3G",
    subtitle: "Techos livianos",
    description:
      "Sistema de cubierta liviana tipo Isoroof con estética moderna y rápida instalación. Recomendado para galpones, ampliaciones y soluciones de techo con buena performance térmica.",
  },
  {
    src: ROOF_CATALOG_MAP_URL_BY_FAMILIA.ISOROOF_PLUS,
    title: "ISOROOF PLUS 3G",
    subtitle: "Línea premium",
    description:
      "Versión premium de la línea Isoroof, orientada a proyectos que buscan mejor terminación y prestaciones superiores en techos livianos de panel aislante.",
  },
  {
    src: ROOF_CATALOG_MAP_URL_BY_FAMILIA.ISOROOF_FOIL,
    title: "ISOROOF FOIL 3G",
    subtitle: "Membrana foil",
    description:
      "Panel Isoroof con terminación foil para aplicaciones específicas de cubierta. Aporta aislación térmica y terminación interior técnica para distintos tipos de obra.",
  },
  {
    src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/HIANZA-PUR-5G-BECAM-GRIS.webp?v=1748592601",
    title: "Hiansa-Panel 5G",
    subtitle: "Trapezoidal BECAM",
    description:
      "Panel de perfil trapezoidal con enfoque arquitectónico/industrial, ideal para cubiertas con diseño contemporáneo y necesidad de terminación exterior destacada.",
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
    description:
      "Panel estilo teja colonial con interior blanco. Alternativa para cubiertas con imagen residencial tradicional y montaje en sistema de panel aislante.",
  },
};

const FAMILIA_TECHO_GALLERY = {
  ISODEC_EPS: [
    FAMILIA_TECHO_SLIDE.ISODEC_EPS,
    {
      src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/ISODEC_GRIS.png?v=1756747335",
      title: "ISODEC EPS · Gris",
      subtitle: "Vista de producto",
    },
    {
      src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/file.jpg?v=1752178338",
      title: "ISODEC EPS · Aplicación",
      subtitle: "Referencia de montaje",
    },
  ],
  ISODEC_PIR: [
    FAMILIA_TECHO_SLIDE.ISODEC_PIR,
    {
      src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/Isodec_PIR.png?v=1755503238",
      title: "ISODEC PIR · Vista principal",
      subtitle: "Alto rendimiento térmico",
    },
    {
      src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/isowall_jpg.webp?v=1756840865",
      title: "ISODEC PIR · Obra",
      subtitle: "Referencia de línea PIR",
    },
  ],
  ISOROOF_3G: [
    FAMILIA_TECHO_SLIDE.ISOROOF_3G,
    {
      src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/3D-GoteroSuperiordeCamaraIsoroof3G-Gris-WEB01.png?v=1752254989",
      title: "ISOROOF 3G · Detalle superior",
      subtitle: "Accesorio compatible",
    },
    {
      src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/Modelo3dG.LateralCamara-Gris-WEB01.png?v=1752240908",
      title: "ISOROOF 3G · Detalle lateral",
      subtitle: "Borde lateral",
    },
  ],
  ISOROOF_FOIL: [
    FAMILIA_TECHO_SLIDE.ISOROOF_FOIL,
    {
      src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/file.jpg?v=1752178338",
      title: "ISOROOF FOIL 3G · Vista técnica",
      subtitle: "Terminación foil",
    },
  ],
  ISOROOF_PLUS: [
    FAMILIA_TECHO_SLIDE.ISOROOF_PLUS,
    {
      src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/HIANZA-PUR-5G-BECAM-GRIS.webp?v=1748592601",
      title: "ISOROOF PLUS 3G · Referencia premium",
      subtitle: "Terminación de alta gama",
    },
  ],
  ISOROOF_COLONIAL: [
    FAMILIA_TECHO_SLIDE.ISOROOF_COLONIAL,
    {
      src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/file.jpg?v=1752178338",
      title: "Isoroof Colonial · Perfil",
      subtitle: "Línea estilo teja",
    },
  ],
};

const FAMILIA_COLOR_GALLERY = {
  ISODEC_EPS: {
    Blanco: [
      {
        src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/file.jpg?v=1752178338",
        title: "ISODEC EPS · Blanco",
        subtitle: "Selección de color",
      },
    ],
    Gris: [
      {
        src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/ISODEC_GRIS.png?v=1756747335",
        title: "ISODEC EPS · Gris",
        subtitle: "Selección de color",
      },
    ],
    Rojo: [
      {
        src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/Captura_de_pantalla_2025-07-25_113936.png?v=1753454404",
        title: "ISODEC EPS · Rojo",
        subtitle: "Selección de color",
      },
    ],
  },
  ISODEC_PIR: {
    Blanco: [
      {
        src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/Isodec_PIR.png?v=1755503238",
        title: "ISODEC PIR · Blanco",
        subtitle: "Selección de color",
      },
    ],
    Gris: [
      {
        src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/Isodec_PIR.png?v=1755503238",
        title: "ISODEC PIR · Gris",
        subtitle: "Selección de color",
      },
    ],
    Rojo: [
      {
        src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/Isodec_PIR.png?v=1755503238",
        title: "ISODEC PIR · Rojo",
        subtitle: "Selección de color",
      },
    ],
  },
  ISOROOF_3G: {
    Gris: [
      {
        src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/Modelo3dG.LateralCamara-Gris-WEB01.png?v=1752240908",
        title: "ISOROOF 3G · Gris",
        subtitle: "Selección de color",
      },
    ],
    Rojo: [
      {
        src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/Captura_de_pantalla_2025-07-25_113936.png?v=1753454404",
        title: "ISOROOF 3G · Rojo",
        subtitle: "Selección de color",
      },
    ],
    Blanco: [
      {
        src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/Captura_de_pantalla_2025-07-25_113729.png?v=1753454403",
        title: "ISOROOF 3G · Blanco",
        subtitle: "Selección de color",
      },
    ],
  },
  ISOROOF_PLUS: {
    Blanco: [
      {
        src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/HIANZA-PUR-5G-BECAM-GRIS.webp?v=1748592601",
        title: "ISOROOF PLUS 3G · Blanco",
        subtitle: "Selección de color",
      },
    ],
    Gris: [
      {
        src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/HIANZA-PUR-5G-BECAM-GRIS.webp?v=1748592601",
        title: "ISOROOF PLUS 3G · Gris",
        subtitle: "Selección de color",
      },
    ],
    Rojo: [
      {
        src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/Captura_de_pantalla_2025-07-25_113936.png?v=1753454404",
        title: "ISOROOF PLUS 3G · Rojo",
        subtitle: "Selección de color",
      },
    ],
  },
  ISOROOF_FOIL: {
    Gris: [
      {
        src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/file.jpg?v=1752178338",
        title: "ISOROOF FOIL 3G · Gris",
        subtitle: "Selección de color",
      },
    ],
    Rojo: [
      {
        src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/Captura_de_pantalla_2025-07-25_113936.png?v=1753454404",
        title: "ISOROOF FOIL 3G · Rojo",
        subtitle: "Selección de color",
      },
    ],
  },
  ISOROOF_COLONIAL: {
    "Simil teja / Blanco": [
      {
        src: "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/file.jpg?v=1752178338",
        title: "Isoroof Colonial · Simil teja / Blanco",
        subtitle: "Selección de color",
      },
    ],
  },
};

function normalizeFamilySlides(slides = []) {
  if (!Array.isArray(slides)) return [];
  return slides
    .map((s) => ({
      src: s?.src || "",
      title: s?.title || "Producto",
      subtitle: s?.subtitle || "Catálogo Shopify",
      href: s?.href || QUOTE_VISOR_SHOP_URLS.panelesAislantes,
    }))
    .filter((s) => Boolean(s.src));
}

function getGeneratedFamilyGallery(familyKey) {
  const generated = shopifyFamiliesMap?.byFamily?.[familyKey]?.gallery;
  return normalizeFamilySlides(generated);
}

export function getGeneratedColorGallery(familyKey, color) {
  const generated = shopifyFamiliesMap?.byFamily?.[familyKey]?.byColor?.[color];
  return normalizeFamilySlides(generated);
}

/**
 * @param {object} p
 * @param {string} p.scenarioId
 * @param {string | null} [p.stepId]
 * @param {string} [p.techoFamilia]
 * @param {string} [p.techoColor]
 * @returns {{ slides: QuoteVisorSlide[]; shopHref: string; heading: string }}
 */
export function getQuoteVisorContext({ scenarioId, stepId, techoFamilia, techoColor = "" }) {
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

  if (
    scenarioId === "solo_techo" &&
    (stepId === "familia" || stepId === "espesor" || stepId === "color") &&
    techoFamilia &&
    FAMILIA_TECHO_SLIDE[techoFamilia]
  ) {
    const one = FAMILIA_TECHO_SLIDE[techoFamilia];
    const generatedFamilyGallery = getGeneratedFamilyGallery(techoFamilia);
    const familyGallery =
      generatedFamilyGallery.length > 0 ? generatedFamilyGallery : FAMILIA_TECHO_GALLERY[techoFamilia] || [one];
    const generatedColorGallery = getGeneratedColorGallery(techoFamilia, techoColor);
    const colorGallery =
      generatedColorGallery.length > 0 ? generatedColorGallery : FAMILIA_COLOR_GALLERY?.[techoFamilia]?.[techoColor] || null;
    const gallery = stepId === "color" && Array.isArray(colorGallery) && colorGallery.length ? colorGallery : familyGallery;
    return {
      slides: gallery,
      shopHref: QUOTE_VISOR_SHOP_URLS.panelesAislantes,
      heading: one.title,
    };
  }

  return base;
}
