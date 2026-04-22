// src/data/kingspanKB.js
// Knowledge base extracted from Kingspan Installation Guide (2025-08 edition).
// Source: KS1000 RW / FF / X-DEK / Wall TF/TL/NC/NF/AWP/AWP Flex — with AW Flex & RB/CSE.
// Read-only reference — does NOT modify any BMC calculation.

// ── Panel Families ────────────────────────────────────────────────────────────

export const KINGSPAN_PANELS_TECHO = {
  KS1000_RW: {
    label: 'KS1000 RW',
    description: 'Panel de techo trapezoidal de 3 costillas. El más común para cubiertas inclinadas.',
    profile: 'trapezoidal-3-rib',
    insulation: 'PIR',
    widthNominal_mm: 1000,
    // Kingspan publishes 1000mm as the effective cover width (the side-lap is internal to
    // the rib geometry, not deducted as a separate number the way BMC deducts from 1180mm).
    coverWidth_mm: 1000,
    lengths_mm: { min: 2000, max: 13600 },
    thicknesses_mm: [40, 60, 80, 100, 120, 150, 200],
    sideLapScrew: 'P03',
    sideLapSpacing_mm: 500,
  },
  KS1000_FF: {
    label: 'KS1000 FF',
    description: 'Panel de techo trapezoidal de 4 costillas asimétricas. Mayor rigidez en vanos cortos.',
    profile: 'trapezoidal-4-rib',
    insulation: 'PIR',
    widthNominal_mm: 1000,
    widthUseful_mm: 970,
    lengths_mm: { min: 2000, max: 10000 },
    thicknesses_mm: [40, 60, 80, 100, 120, 150],
    sideLapScrew: 'P03',
    sideLapSpacing_mm: 500,
  },
  KS1000_XDEK: {
    label: 'KS1000 X-DEK',
    description: 'Sistema de techo plano con impermeabilización integrada. Variantes XD/XM/XB/XG según capa exterior.',
    profile: 'flat',
    insulation: 'PIR',
    variants: {
      XD: 'Cara superior de acero, bajo sistema de impermeabilización',
      XM: 'Cara superior con membrana mineral adherida',
      XB: 'Cara superior con membrana de betún polímero',
      XG: 'Cara superior con membrana de fibra de vidrio',
    },
    lengths_mm: { min: 2000, max: 13600 },
    thicknesses_mm: [40, 60, 80, 100, 120, 150, 200],
    minSupportWidth_mm: {
      singleSpan: 50,
      continuousExtreme: 90,
      continuousExtremeNote: 'Solo aplica para vanos continuos con L<4m extremo',
    },
  },
};

export const KINGSPAN_PANELS_PARED = {
  TF: {
    label: 'KS1000 TF',
    description: 'Panel de pared, cara exterior con micro-rib trapecio amplio. Alta rigidez visible.',
    profile: 'micro-rib-trapecio',
    insulation: 'PIR',
    widthNominal_mm: 1000,
    lengths_mm: { min: 2000, max: 13600 },
    fixing: 'visible',
    cornerMaxDepth_mm: 120,
  },
  TL: {
    label: 'KS1000 TL',
    description: 'Panel de pared liner (interior), micro-rib trapecio. Usado como revestimiento interior.',
    profile: 'micro-rib-liner',
    insulation: 'PIR',
    widthNominal_mm: 1000,
    lengths_mm: { min: 2000, max: 13600 },
    fixing: 'visible',
  },
  NC: {
    label: 'KS1000 NC',
    description: 'Panel de pared, cara exterior con micro-rib fino (nervio angosto). Acabado moderno.',
    profile: 'micro-rib-fino',
    insulation: 'PIR',
    widthNominal_mm: 1000,
    lengths_mm: { min: 2000, max: 13600 },
    fixing: 'visible',
    cornerMaxDepth_mm: 120,
  },
  NF: {
    label: 'KS1000 NF',
    description: 'Panel de pared con cara exterior plana (flat). Aspecto liso y continuo.',
    profile: 'flat',
    insulation: 'PIR',
    widthNominal_mm: 1000,
    lengths_mm: { min: 2000, max: 13600 },
    fixing: 'visible',
    cornerMaxDepth_mm: 120,
  },
  AWP: {
    label: 'KS1000 AWP',
    description: 'Panel de pared de fijación oculta (arquitectónico). Junta sin tornillos visibles.',
    profile: 'micro-rib',
    insulation: 'PIR',
    widthNominal_mm: 1000,
    lengths_mm: { min: 2000, max: 13600 },
    fixing: 'secret',
    secretFixingComponent: 'Z15a',
    cornerMaxDepth_mm: 100,
  },
  AWP_Flex: {
    label: 'KS1000 AWP Flex',
    description: 'Variante flexible del AWP para fachadas con geometría curva.',
    profile: 'micro-rib-flex',
    insulation: 'PIR',
    widthNominal_mm: 1000,
    lengths_mm: { min: 2000, max: 13600 },
    fixing: 'secret',
    secretFixingComponent: 'Z15a',
  },
};

// ── Fastener System ───────────────────────────────────────────────────────────

export const KINGSPAN_FASTENERS = {
  P01: {
    label: 'P01',
    description: 'Tornillo autoroscante para estructura metálica — vano simple (single span).',
    for: ['roof'],
    application: 'Fijación de panel a purlin metálico en cubiertas de vano único.',
  },
  P02: {
    label: 'P02',
    description: 'Tornillo autoroscante para estructura metálica — vano múltiple (multi-span / intermediate supports).',
    for: ['roof', 'wall'],
    application: 'Fijación de panel a purlin metálico en cubiertas con apoyos intermedios y en paredes.',
  },
  P02p: {
    label: 'P02p',
    description: 'Variante del P02 con arandela EPDM presellada para paneles de pared.',
    for: ['wall'],
    application: 'Fijación de paneles TF/TL/NC/NF a estructura metálica.',
    washer: 'EPDM presellada',
  },
  P03: {
    label: 'P03',
    description: 'Tornillo de costura de solape lateral (side-lap stitching screw).',
    for: ['roof'],
    spacing_mm: 500,
    application: 'Fijación del solape lateral entre paneles de techo contiguos. Espaciado 500mm a lo largo del solape.',
  },
  P04: {
    label: 'P04',
    description: 'Tornillo de fijación a estructura de madera (y para AWP de fijación oculta).',
    for: ['roof', 'wall', 'awp'],
    application: 'Fijación a correas de madera o para sistema AWP con spread washer Z15a.',
  },
  Z15a: {
    label: 'Z15a',
    description: 'Arandela de reparto tipo spread washer para sistema de fijación oculta AWP.',
    for: ['awp'],
    application: 'Distribuye la carga del tornillo P04 en el alma del panel AWP. Invisible desde el exterior.',
  },
  washer_16mm: {
    label: 'Arandela Ø16mm',
    description: 'Arandela estándar de acero Ø16mm para fijaciones de paneles de pared.',
    for: ['wall'],
    application: 'Acompaña tornillos P02/P02p en paneles TF/TL/NC/NF para distribución de carga.',
  },
};

// Filosofía de fijación de Kingspan — importante para la comparación
export const KINGSPAN_FASTENER_PHILOSOPHY = [
  'La cantidad de tornillos de fijación estructural (P01/P02/P04) a las correas NO tiene una fórmula fija en la guía Kingspan.',
  'El número se determina por el calculista estructural según: cargas de viento por zona, peso propio del panel, pendiente de cubierta y tipo de apoyo.',
  'Solo los tornillos de costura lateral (P03) tienen espaciado fijo: 500mm a lo largo del solape.',
];

// ── Sealant System ────────────────────────────────────────────────────────────

export const KINGSPAN_SEALANTS = {
  PE_tape: {
    label: 'Cinta PE 20×5mm',
    description: 'Cinta compresiva de polietileno expandido (20mm ancho × 5mm espesor).',
    function: 'Sello de polvo, aire y agua. Se comprime entre las caras del panel al instalar.',
    application: 'Junta longitudinal en costilla de solape de paneles de techo y pared.',
    bmc_equivalent: 'Cinta butilo (función parcialmente similar)',
    uvResistant: false,
    vaporBarrier: false,
  },
  PVC_tape: {
    label: 'Cinta PVC adhesiva',
    description: 'Cinta autoadhesiva de PVC con excelente resistencia UV.',
    function: 'Sellado de juntas expuestas a radiación solar. Resistente a intemperie.',
    application: 'Juntas en coronaciones, bordes expuestos al sol.',
    bmc_equivalent: null,
    uvResistant: true,
    vaporBarrier: false,
  },
  PU_expanding: {
    label: 'Cinta PU expansiva',
    description: 'Cinta impregnada de espuma PU que se expande de 50% a 30% de su espesor original al instalar.',
    function: 'Sello estanco al agua en juntas de solape. La expansión rellena irregularidades.',
    application: 'Solapes de costilla en paneles de techo, junta superior de paneles de pared.',
    bmc_equivalent: 'Espuma PU pistola (función similar, diferente formato)',
    uvResistant: false,
    vaporBarrier: false,
    expansionRatio: '50% → 30%',
  },
  Butyl_tape: {
    label: 'Cinta butilo',
    description: 'Cinta de butilo autoadhesiva, impermeable al vapor.',
    function: 'Barrera de vapor en juntas críticas. Alta resistencia a difusión de humedad.',
    application: 'Juntas de vapor en cubierta y pared donde se requiere barrera de vapor.',
    bmc_equivalent: 'Cinta butilo BMC (mismo material)',
    uvResistant: false,
    vaporBarrier: true,
  },
  Neutral_silicon: {
    label: 'Silicona neutra exterior',
    description: 'Sellador elastomérico neutro, resistente a UV, −40°C a +150°C.',
    function: 'Sellado definitivo de juntas exteriores expuestas. Flexible y duradero.',
    application: 'Juntas entre paneles de pared, esquinas, encuentro con carpintería.',
    bmc_equivalent: 'Silicona Bromplast 600ml neutra (concepto idéntico)',
    uvResistant: true,
    vaporBarrier: false,
    tempRange: '-40°C a +150°C',
  },
  PU_foam: {
    label: 'Espuma PU (pistola)',
    description: 'Espuma de poliuretano en pistola, expansiva. Para gaps >5cm: aplicar en capas.',
    function: 'Relleno y aislación de huecos, bordes y penetraciones.',
    application: 'Extremos de paneles, huecos en ventanas/puertas, bordes en encuentros.',
    bmc_equivalent: 'Espuma PU pistola (idéntico producto)',
    note: 'Para huecos >5cm: aplicar en capas sucesivas dejando curar entre capas.',
    uvResistant: false,
    vaporBarrier: false,
  },
};

// ── Accessories ───────────────────────────────────────────────────────────────

export const KINGSPAN_ACCESSORIES = {
  gutter_highline: {
    label: 'Canalón Highline',
    description: 'Sistema de canalón modular. Secciones de 3000mm de longitud.',
    sectionLength_mm: 3000,
    materials: ['aluminum', 'galvanized_steel'],
    railSpacing_mm: 666,
  },
  snow_guard_Z14: {
    label: 'Guardanieves Z14',
    description: 'Guardanieves de aluminio con 6 perforaciones Ø7mm. Espaciado 333.3mm.',
    material: 'aluminum',
    holes: 6,
    holeDiameter_mm: 7,
    typicalSpacing_mm: 333.3,
  },
  corner_panels: {
    label: 'Paneles de esquina',
    description: 'Accesorios de esquina prefabricados.',
    maxDepth_TF_TL_NC_NF_mm: 120,
    maxDepth_AWP_mm: 100,
    note: 'Profundidad máxima D del esquinero según familia de panel.',
  },
};

// ── Quick reference: BMC ↔ Kingspan panel family mapping ─────────────────────

export const PANEL_FAMILY_MAPPING = [
  { bmc: 'ISODEC PIR (techo)', kingspan: 'KS1000 RW o KS1000 FF', notes: 'Techo inclinado, PIR, costillas' },
  { bmc: 'ISODEC EPS (techo)', kingspan: 'No equivalente directo', notes: 'Kingspan no usa EPS en línea de producto documentada' },
  { bmc: 'ISOROOF (techo metálico)', kingspan: 'KS1000 FF (similar geometría de costilla)', notes: 'ISOROOF es perfil más bajo; FF tiene 4 costillas' },
  { bmc: 'ISOWALL (pared)', kingspan: 'KS1000 TF/TL/NC/NF (visible) o AWP (oculto)', notes: 'Mismo ancho nominal 1000mm; Kingspan tiene más subfamilias' },
];
