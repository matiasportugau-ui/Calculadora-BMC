/**
 * Panel Construction Specs — data model for accurate 2D/3D product visualization.
 * Inspired by FreeCAD BIM objects + technical datasheets (fichas técnicas).
 * Single source of truth for layer stacks, materials, profiles.
 * Used by PanelCrossSection (SVG 2D CAD-style), enhanced 3D viewers, PDF, etc.
 *
 * Thicknesses in mm. Core thickness is variable per espesor chosen in quote.
 * au (ancho útil) matches PANELS_TECHO for consistency.
 *
 * References from evaluation:
 * - FreeCAD TechDraw for professional 2D plans (line weights, hatching, dims, annotations)
 * - FreeCAD BIM for parametric objects with properties (material, thickness, performance)
 * - FreeCAD Python API for data-driven generation (CSV/params -> geometry)
 * - BIM Library for reusable standard components
 */

export const PANEL_CONSTRUCTIONS = {
  ISODEC_EPS: {
    label: "ISODEC EPS",
    au: 1.12,
    profileType: "flat", // simple sandwich
    layers: [
      {
        id: "ext-sheet",
        name: "Chapa exterior",
        thicknessMm: 0.5,
        material: "Acero galvanizado prelacado",
        color: "#f8f9fa", // light for exterior
        hatch: "metal-lines",
        description: "0,5 mm"
      },
      {
        id: "core",
        name: "Núcleo EPS",
        thicknessMm: "variable", // filled at runtime from espesor
        material: "Poliestireno Expandido (EPS)",
        color: "#f5e8c7",
        hatch: "dots-insulation",
        description: "Aislante térmico autoextinguible"
      },
      {
        id: "int-sheet",
        name: "Chapa interior",
        thicknessMm: 0.5,
        material: "Acero galvanizado prelacado",
        color: "#e9ecef",
        hatch: "metal-lines",
        description: "0,5 mm"
      }
    ],
    notes: "Panel sándwich autoestructural. Ancho útil 1.120 mm. Colores estándar: Blanco, Gris, Rojo (consultar límites)."
  },

  ISODEC_PIR: {
    label: "ISODEC PIR",
    au: 1.12,
    profileType: "flat",
    layers: [
      {
        id: "ext-sheet",
        name: "Chapa exterior",
        thicknessMm: 0.5,
        material: "Acero galvanizado prelacado",
        color: "#f8f9fa",
        hatch: "metal-lines",
        description: "0,5 mm"
      },
      {
        id: "core",
        name: "Núcleo PIR",
        thicknessMm: "variable",
        material: "Poliisocianurato (PIR)",
        color: "#e8d5b7",
        hatch: "cross-hatch-insulation",
        description: "Alta eficiencia térmica, ignífugo"
      },
      {
        id: "int-sheet",
        name: "Chapa interior",
        thicknessMm: 0.5,
        material: "Acero galvanizado prelacado",
        color: "#e9ecef",
        hatch: "metal-lines",
        description: "0,5 mm"
      }
    ],
    notes: "Sistema de encastre/engrape. Espesores típicos 50/80/120 mm (50mm evitar en algunos usos). Ancho útil 1.120 mm."
  },

  ISOROOF_3G: {
    label: "ISOROOF 3G",
    au: 1.0,
    profileType: "profiled", // ribbed top sheet
    profileDims: {
      // From catalog profile drawing (example for similar Isoroof)
      moduleWidthMm: 1000,
      ribHeightMm: 49,
      ribSpacingMm: 72, // approx from example
      // In 3D/2D section we can approximate the wave with path or multiple planes
    },
    layers: [
      {
        id: "ext-profiled",
        name: "Chapa exterior perfilada",
        thicknessMm: 0.5,
        material: "Acero galvanizado prelacado",
        color: "#d1d5db",
        hatch: "metal-lines",
        description: "0,5 mm - Perfil trapezoidal"
      },
      {
        id: "core",
        name: "Núcleo",
        thicknessMm: "variable",
        material: "PIR / EPS según variante",
        color: "#f5e8c7",
        hatch: "dots-insulation",
        description: "Aislante"
      },
      {
        id: "int-liner",
        name: "Liner interior",
        thicknessMm: 0.5,
        material: "Acero galvanizado",
        color: "#e9ecef",
        hatch: "metal-lines",
        description: "0,5 mm"
      }
    ],
    notes: "Techos livianos. au 1.000 mm. Perfil exterior da rigidez."
  },

  ISOROOF_FOIL: {
    label: "ISOROOF FOIL",
    au: 1.0,
    profileType: "profiled",
    layers: [
      {
        id: "ext-profiled",
        name: "Chapa exterior perfilada",
        thicknessMm: 0.5,
        material: "Acero galvanizado prelacado",
        color: "#c0c0c0",
        hatch: "metal-lines",
        description: "0,5 mm"
      },
      {
        id: "core",
        name: "Núcleo",
        thicknessMm: "variable",
        material: "Aislante + barrera",
        color: "#e8e0d0",
        hatch: "cross-hatch-insulation",
        description: ""
      },
      {
        id: "foil",
        name: "Capa FOIL / reflectiva",
        thicknessMm: 0.05, // thin film
        material: "Aluminio / film reflectivo",
        color: "#a8b5c4",
        hatch: "none",
        description: "Alta reflectividad térmica"
      },
      {
        id: "int-liner",
        name: "Liner interior",
        thicknessMm: 0.4,
        material: "Acero",
        color: "#e9ecef",
        hatch: "metal-lines",
        description: ""
      }
    ],
    notes: "Variante con foil para mayor eficiencia. Ver ficha para detalles exactos."
  },

  ISOROOF_PLUS: {
    label: "ISOROOF PLUS",
    au: 1.0,
    profileType: "profiled",
    layers: [
      {
        id: "ext-profiled",
        name: "Chapa exterior perfilada premium",
        thicknessMm: 0.5,
        material: "Acero galvanizado prelacado alta calidad",
        color: "#b8c4d4",
        hatch: "metal-lines",
        description: "0,5 mm"
      },
      {
        id: "core",
        name: "Núcleo PIR premium",
        thicknessMm: "variable",
        material: "PIR alta densidad",
        color: "#d4c3a8",
        hatch: "cross-hatch-insulation",
        description: "Mejor desempeño térmico/estructural"
      },
      {
        id: "int-liner",
        name: "Liner interior",
        thicknessMm: 0.5,
        material: "Acero galvanizado",
        color: "#e9ecef",
        hatch: "metal-lines",
        description: "0,5 mm"
      }
    ],
    notes: "Línea premium. Mínimo 800 m²."
  },

  ISOROOF_COLONIAL: {
    label: "ISOROOF COLONIAL",
    au: 1.0,
    profileType: "tile-profiled", // special tile-like
    layers: [
      {
        id: "ext-tile",
        name: "Cubierta exterior simil teja",
        thicknessMm: 0.5,
        material: "Acero preformado color teja",
        color: "#8b4513", // brown tile
        hatch: "none",
        description: "Acabado estético teja"
      },
      {
        id: "core",
        name: "Núcleo",
        thicknessMm: "variable",
        material: "Aislante",
        color: "#f5e8c7",
        hatch: "dots-insulation",
        description: ""
      },
      {
        id: "int-white",
        name: "Interior blanco",
        thicknessMm: 0.5,
        material: "Acero prelacado blanco",
        color: "#f8f9fa",
        hatch: "metal-lines",
        description: ""
      }
    ],
    notes: "Estética colonial / teja. Interior blanco. Diferente a FOIL."
  }
};

/**
 * Returns construction for a family, with core thickness resolved from chosen espesor.
 * @param {string} familiaKey e.g. "ISODEC_PIR"
 * @param {number|string} [espesorMm]
 */
export function getPanelConstruction(familiaKey, espesorMm) {
  const base = PANEL_CONSTRUCTIONS[familiaKey] || PANEL_CONSTRUCTIONS.ISODEC_EPS;
  const esp = Number(espesorMm) || 50;

  const layers = base.layers.map(l => {
    if (l.thicknessMm === "variable") {
      return { ...l, thicknessMm: esp };
    }
    return l;
  });

  return {
    ...base,
    layers,
    effectiveEspesorMm: esp,
    totalThicknessMm: layers.reduce((sum, l) => sum + (typeof l.thicknessMm === 'number' ? l.thicknessMm : 0), 0)
  };
}

export const SUPPORTED_FAMILIES = Object.keys(PANEL_CONSTRUCTIONS);
