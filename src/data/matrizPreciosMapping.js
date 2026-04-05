// ═══════════════════════════════════════════════════════════════════════════
// matrizPreciosMapping.js — Mapeo SKU MATRIZ → path calculadora
// MATRIZ de COSTOS y VENTAS 2026 — misma planilla para costos y precios de venta
//
// Operativo col D (evitar path duplicado en CSV):
// - Isoroof Colonial 40 mm (simil teja / int. blanco) → ISOCOL40 (aliases IAGRO40COL / IAGCOL40); no FOIL 3G.
// - Cumbrera colonial 2,2 m (misma familia) → CUMROOFCOL o CUMCOL22 → cumbrera.ISOROOF_COLONIAL (no CUMROOF3M).
// - Gotero sup. cámara 30 mm → GSDECAM30; 50 mm → GSDECAM50.
// - Gotero lateral 40 mm → GL40; 50 mm → GL50.
// - Pared “ISODEC EPS” lista Bromyros → ISDEC100P … ISDEC250P (ISOPANEL queda ISDxxxEPS).
// - Isowall 80 mm → SKU IW80 en col D (tres filas con mismo path = error de planilla).
//
// MATRIZ_TAB_COLUMNS.BROMYROS (ver MATRIZ-PRECIOS-CALCULADORA.md):
//   F, L, T = tal cual; M = consumidor c/IVA tal cual; **U** = venta web c/IVA tal cual (solo CSV `venta_web_iva_inc`, sin push).
// ═══════════════════════════════════════════════════════════════════════════

/** Normaliza SKU para match (uppercase, sin espacios, guiones opcionales) */
export function normalizeSku(sku) {
  return String(sku || "").trim().toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
}

/**
 * Mapeo: SKU en col D de MATRIZ → path base en calculadora.
 * Cada path puede recibir overrides: .costo, .venta, .web
 */
export const MATRIZ_SKU_TO_PATH = {
  // Paneles techo ISOROOF
  IAGRO30: "PANELS_TECHO.ISOROOF_FOIL.esp.30",
  /** Isoroof Colonial 40 mm — SKU canónico en MATRIZ; aliases históricos IAGRO40COL / IAGCOL40 */
  ISOCOL40: "PANELS_TECHO.ISOROOF_COLONIAL.esp.40",
  ICR040: "PANELS_TECHO.ISOROOF_COLONIAL.esp.40",
  IAGRO40COL: "PANELS_TECHO.ISOROOF_COLONIAL.esp.40",
  IAGCOL40: "PANELS_TECHO.ISOROOF_COLONIAL.esp.40",
  IAGRO50: "PANELS_TECHO.ISOROOF_FOIL.esp.50",
  IROOF30: "PANELS_TECHO.ISOROOF_3G.esp.30",
  IROOF40: "PANELS_TECHO.ISOROOF_3G.esp.40",
  IROOF50: "PANELS_TECHO.ISOROOF_3G.esp.50",
  IROOF80: "PANELS_TECHO.ISOROOF_3G.esp.80",
  IROOF100: "PANELS_TECHO.ISOROOF_3G.esp.100",
  IROOF50PLS: "PANELS_TECHO.ISOROOF_PLUS.esp.50",
  IROOF80PLS: "PANELS_TECHO.ISOROOF_PLUS.esp.80",

  // Paneles techo ISODEC EPS
  ISDEC100: "PANELS_TECHO.ISODEC_EPS.esp.100",
  ISD100EPS: "PANELS_TECHO.ISODEC_EPS.esp.100",
  ISDEC150: "PANELS_TECHO.ISODEC_EPS.esp.150",
  ISD150EPS: "PANELS_TECHO.ISODEC_EPS.esp.150",
  ISDEC200: "PANELS_TECHO.ISODEC_EPS.esp.200",
  ISD200EPS: "PANELS_TECHO.ISODEC_EPS.esp.200",
  ISDEC250: "PANELS_TECHO.ISODEC_EPS.esp.250",
  ISD250EPS: "PANELS_TECHO.ISODEC_EPS.esp.250",
  ISDPIR50: "PANELS_TECHO.ISODEC_PIR.esp.50",
  ISDPIR80: "PANELS_TECHO.ISODEC_PIR.esp.80",
  ISDPIR120: "PANELS_TECHO.ISODEC_PIR.esp.120",

  // Paneles pared — ISOPANEL EPS Fachada (SKUs renombrados 2026-03-28: ISPxxxEPSF)
  ISP50EPSF: "PANELS_PARED.ISOPANEL_EPS.esp.50",
  ISP100EPSF: "PANELS_PARED.ISOPANEL_EPS.esp.100",
  ISP150EPSF: "PANELS_PARED.ISOPANEL_EPS.esp.150",
  ISP200EPSF: "PANELS_PARED.ISOPANEL_EPS.esp.200",
  ISP250EPSF: "PANELS_PARED.ISOPANEL_EPS.esp.250",
  /** Pared ISODEC EPS (precio lista distinta a ISOPANEL) — usar col D en MATRIZ */
  ISDEC100P: "PANELS_PARED.ISODEC_EPS_PARED.esp.100",
  ISDEC150P: "PANELS_PARED.ISODEC_EPS_PARED.esp.150",
  ISDEC200P: "PANELS_PARED.ISODEC_EPS_PARED.esp.200",
  ISDEC250P: "PANELS_PARED.ISODEC_EPS_PARED.esp.250",
  IW50: "PANELS_PARED.ISOWALL_PIR.esp.50",
  IW80: "PANELS_PARED.ISOWALL_PIR.esp.80",
  IW100: "PANELS_PARED.ISOWALL_PIR.esp.100",

  // Goteros
  GFS30: "PERFIL_TECHO.gotero_frontal.ISOROOF.30",
  GFS50: "PERFIL_TECHO.gotero_frontal.ISOROOF.50",
  GFS80: "PERFIL_TECHO.gotero_frontal.ISOROOF.80",
  GFSUP30: "PERFIL_TECHO.gotero_superior.ISOROOF.30",
  GFSUP50: "PERFIL_TECHO.gotero_superior.ISOROOF.50",
  GFSUP80: "PERFIL_TECHO.gotero_superior.ISOROOF.80",
  GSDECAM30: "PERFIL_TECHO.gotero_superior.ISODEC_PIR.30",
  GSDECAM50: "PERFIL_TECHO.gotero_superior.ISODEC_PIR.50",
  GSDECAM80: "PERFIL_TECHO.gotero_superior.ISODEC_PIR.80",
  GL30: "PERFIL_TECHO.gotero_lateral.ISOROOF.30",
  GL40: "PERFIL_TECHO.gotero_lateral.ISOROOF.40",
  GL50: "PERFIL_TECHO.gotero_lateral.ISOROOF.50",
  GL80: "PERFIL_TECHO.gotero_lateral.ISOROOF.80",
  GLDCAM50: "PERFIL_TECHO.gotero_lateral_camara.ISOROOF.50",
  GLDCAM80: "PERFIL_TECHO.gotero_lateral_camara.ISOROOF.80",
  GFCGR30: "PERFIL_TECHO.gotero_frontal_greca.ISOROOF.30",

  // Goteros / perfiles ISODEC EPS (códigos numéricos col D — ver MATRIZ-SKU-GAP-Y-PLAN.md)
  6838: "PERFIL_TECHO.gotero_frontal.ISODEC.100",
  6839: "PERFIL_TECHO.gotero_frontal.ISODEC.150",
  6840: "PERFIL_TECHO.gotero_frontal.ISODEC.200",
  6841: "PERFIL_TECHO.gotero_frontal.ISODEC.250",
  6842: "PERFIL_TECHO.gotero_lateral.ISODEC.100",
  6843: "PERFIL_TECHO.gotero_lateral.ISODEC.150",
  6844: "PERFIL_TECHO.gotero_lateral.ISODEC.200",
  6845: "PERFIL_TECHO.gotero_lateral.ISODEC.250",
  /** Lateral cámara Isodec / PIR — mismo precio hoy; import toca solo path ISODEC._all */
  GLDCAMDC: "PERFIL_TECHO.gotero_lateral_camara.ISODEC._all",

  // Babetas, cumbrera, canalón
  BBAS3G: "PERFIL_TECHO.babeta_adosar.ISOROOF._all",
  BBESUP: "PERFIL_TECHO.babeta_empotrar.ISOROOF._all",
  CUMROOF3M: "PERFIL_TECHO.cumbrera.ISOROOF._all",
  /** Cumbrera colonial 2,2 m — misma familia que panel Isoroof Colonial */
  CUMROOF3C: "PERFIL_TECHO.cumbrera.ISOROOF_COLONIAL._all",
  CUMROOFCOL: "PERFIL_TECHO.cumbrera.ISOROOF_COLONIAL._all",
  CUMCOL22: "PERFIL_TECHO.cumbrera.ISOROOF_COLONIAL._all",
  CD30: "PERFIL_TECHO.canalon.ISOROOF.30",
  CD50: "PERFIL_TECHO.canalon.ISOROOF.50",
  CD80: "PERFIL_TECHO.canalon.ISOROOF.80",
  SOPCAN3M: "PERFIL_TECHO.soporte_canalon.ISOROOF._all",
  /** Isodec EPS — canalón / soporte / babetas / cumbrera (PIR puede compartir precio; ver doc SKU gap) */
  6801: "PERFIL_TECHO.canalon.ISODEC.100",
  6802: "PERFIL_TECHO.canalon.ISODEC.150",
  6803: "PERFIL_TECHO.canalon.ISODEC.200",
  6804: "PERFIL_TECHO.canalon.ISODEC.250",
  6805: "PERFIL_TECHO.soporte_canalon.ISODEC._all",
  6828: "PERFIL_TECHO.babeta_adosar.ISODEC._all",
  6865: "PERFIL_TECHO.babeta_empotrar.ISODEC._all",
  6847: "PERFIL_TECHO.cumbrera.ISODEC._all",
  /** Canalón 120 mm — alias sin punto: CANISDC120 */
  CANISDC120: "PERFIL_TECHO.canalon.ISODEC.120",
  /** Misma ruta; col D con punto en planilla */
  "CAN.ISDC120": "PERFIL_TECHO.canalon.ISODEC.120",
  /** Recomendado si PIR 50/80 debe importar aparte de 6801 (Isodec 100) */
  CANPIR50: "PERFIL_TECHO.canalon.ISODEC_PIR.50",
  CANPIR80: "PERFIL_TECHO.canalon.ISODEC_PIR.80",

  // Selladores
  CBUT: "SELLADORES.cinta_butilo",
  BROMPLAST: "SELLADORES.silicona",
  SIL300N: "SELLADORES.silicona_300_neutra",
  MEMB3010: "SELLADORES.membrana",
  ESPPUGR: "SELLADORES.espuma_pu",

  // Fijaciones
  CABROJ: "FIJACIONES.caballete",
  /** Kit varilla/tuerca Isodec — col D BROMYROS ~161–166 (scripts sync si col D vacía) */
  VAR381ML: "FIJACIONES.varilla_38",
  TUE38BSW: "FIJACIONES.tuerca_38",
  ARDC38: "FIJACIONES.arandela_carrocero",
  TORTPPBC: "FIJACIONES.arandela_pp",
  TORTPPGR: "FIJACIONES.arandela_pp_gris",
  TACEX38: "FIJACIONES.taco_expansivo",
  /** Presupuesto libre / catálogo — SKU col.D: confirmar en MATRIZ 2026 si difiere */
  ANCISOTER: "FIJACIONES.anclaje_isoroof_terracota",
  ANCISOGR: "FIJACIONES.anclaje_isoroof_gris",
  ANCBC18: "FIJACIONES.anclaje_chapa_bc18",
  ANCBC35: "FIJACIONES.anclaje_chapa_bc35",
  ANCUPLAT: "FIJACIONES.anclaje_kit_u_platea",
  REMPOP532: "FIJACIONES.remache_pop",
  REMPOP316: "FIJACIONES.remache_pop_316",
  THEX1234: "FIJACIONES.tornillo_exagonal_12_34",
  THEX121PM: "FIJACIONES.tornillo_exagonal_12_1_pm",
  THEX12212: "FIJACIONES.tornillo_exagonal_12_212_pm",
  TAG12X2: "FIJACIONES.tornillo_punta_aguja_12x2",
  TAG12X3: "FIJACIONES.tornillo_punta_aguja_12x3",
  THEXPU204: "FIJACIONES.tornillo_hex_pu_20mm_4in",
  T1PERF: "FIJACIONES.tornillo_t1",
  T2FACH: "FIJACIONES.tornillo_t2",
  TAGU14X5: "FIJACIONES.tornillo_aguja",
  ANC100MM: "FIJACIONES.anclaje_h",
  /** Arandela plana 3/8" — fijación varilla pasante (lado inferior). Confirmar col D en MATRIZ si difiere. */
  ARPLA38: "FIJACIONES.arandela_plana",

  // Herramientas
  APLDX03: "HERRAMIENTAS.pistola_apl_dx03",

  // Servicios
  FLETEBRO: "SERVICIOS.flete",

  // ── Goteros ISODEC PIR (retrocompat + SKU disjuntos recomendados — ver MATRIZ-SKU-GAP-Y-PLAN.md)
  /** Solo actualiza frontal 50; lateral 50/80 comparten precio en constants — usar GLLPIR50/GLLPIR80 en col D para import completo */
  GF80DC: "PERFIL_TECHO.gotero_frontal.ISODEC_PIR.50",
  /** En constants también en frontal 80; usar GFFPIR80 para frontal 80 sin colisión */
  GF120DC: "PERFIL_TECHO.gotero_frontal.ISODEC_PIR.120",
  GFFPIR50: "PERFIL_TECHO.gotero_frontal.ISODEC_PIR.50",
  GFFPIR80: "PERFIL_TECHO.gotero_frontal.ISODEC_PIR.80",
  GFFPIR120: "PERFIL_TECHO.gotero_frontal.ISODEC_PIR.120",
  /** Retrocompat lateral; mismo SKU en 50 y 80 en constants — preferir GLLPIR50 / GLLPIR80 */
  GL80DC: "PERFIL_TECHO.gotero_lateral.ISODEC_PIR.50",
  GL120DC: "PERFIL_TECHO.gotero_lateral.ISODEC_PIR.120",
  GLLPIR50: "PERFIL_TECHO.gotero_lateral.ISODEC_PIR.50",
  GLLPIR80: "PERFIL_TECHO.gotero_lateral.ISODEC_PIR.80",
  GLLPIR120: "PERFIL_TECHO.gotero_lateral.ISODEC_PIR.120",

  // Perfiles pared (PERFIL_PARED)
  PU50MM: "PERFIL_PARED.perfil_u.ISOPANEL.50",
  PU100MM: "PERFIL_PARED.perfil_u.ISOPANEL.100",
  PU150MM: "PERFIL_PARED.perfil_u.ISOPANEL.150",
  PU200MM: "PERFIL_PARED.perfil_u.ISOPANEL.200",
  G2100: "PERFIL_PARED.perfil_g2.ISOPANEL.100",
  G2150: "PERFIL_PARED.perfil_g2.ISOPANEL.150",
  G2200: "PERFIL_PARED.perfil_g2.ISOPANEL.200",
  G2250: "PERFIL_PARED.perfil_g2.ISOPANEL.250",
  K2: "PERFIL_PARED.perfil_k2._all",
  ESQEXT: "PERFIL_PARED.esquinero_ext._all",
  ESQINT: "PERFIL_PARED.esquinero_int._all",
  PLECHU98: "PERFIL_PARED.perfil_5852._all",
};

/** Obtener path para un SKU de la MATRIZ (normalizado) */
export function getPathForMatrizSku(sku) {
  const n = normalizeSku(sku);
  return MATRIZ_SKU_TO_PATH[n] || MATRIZ_SKU_TO_PATH[sku];
}
