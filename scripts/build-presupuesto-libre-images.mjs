#!/usr/bin/env node
/**
 * Genera el mapeo determinístico clave-de-catálogo → imagen de producto para
 * el panel Presupuesto Libre, leyendo productos públicos de Shopify.
 *
 * A diferencia de build-quote-visor-shopify-families.mjs (scoring difuso),
 * acá cada clave del catálogo apunta a un handle EXACTO de Shopify. Un handle
 * que no resuelve es error duro (exit 1) — sin fallback silencioso.
 *
 * Uso:
 *   node scripts/build-presupuesto-libre-images.mjs
 *   node scripts/build-presupuesto-libre-images.mjs --input=/tmp/products.json --out=src/data/presupuestoLibreImages.json
 *
 * (--input permite usar un products.json bajado con curl cuando fetch no
 *  atraviesa el proxy del entorno.)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const STORE = process.env.BMC_SHOPIFY_STORE_URL || "https://bmcuruguay.com.uy";
const BASE = `${STORE}/collections/all/products.json`;

function argStr(name, def) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  if (!a) return def;
  return a.split("=").slice(1).join("=");
}

const INPUT = argStr("input", null);
const OUT = path.resolve(ROOT, argStr("out", "src/data/presupuestoLibreImages.json"));

/**
 * Clave de catálogo → handle exacto de Shopify (byte-exact, incluye ® y º).
 * - Paneles: clave de PANELS_TECHO / PANELS_PARED.
 * - Perfilería: clave compuesta `${tipoKey}:${familiaKey}` (familiaKey puede ser "_all").
 * - Fijaciones / selladores / herramientas: clave del ítem.
 * Cuando un producto no tiene foto propia en Shopify se usa el handle del
 * producto más parecido (alias visual, decisión de dueño 2026-07).
 */
const KEY_TO_HANDLE = {
  // ── Paneles techo ──
  ISODEC_EPS: "isopanel-isodec-eps-cubiertas-bmc-reloaded",
  ISODEC_PIR: "isodec®-pir",
  ISOROOF_3G: "isoroof-3g-gris-rojo-blanco-bromyros",
  ISOROOF_FOIL: "iagro30",
  ISOROOF_PLUS: "iroof80-pls",
  // ISOROOF_COLONIAL: sin producto Shopify con fotos → LOCAL_OVERRIDES

  // ── Paneles pared ──
  ISOPANEL_EPS: "isopanel-eps-paredes-y-fachadas",
  ISOWALL_PIR: "isowall-®-pir",
  ISOFRIG_PIR: "isowall-®-pir", // alias: mismo panel PIR de fachada, sin foto propia

  // ── Perfilería techo ──
  "gotero_frontal:ISOROOF": "gotero-frontal-simple-isoroof",
  "gotero_frontal:ISODEC": "gotero-frontal-isodec",
  "gotero_frontal:ISODEC_PIR": "gotero-frontal-isodec",
  "gotero_frontal_greca:ISOROOF": "gotero-frontal-con-greca-isoroof",
  "gotero_lateral:ISOROOF": "gotero-lateral-isoroof",
  "gotero_lateral:ISODEC": "gotero-lateral-para-isodec-copia",
  "gotero_lateral:ISODEC_PIR": "gotero-lateral-para-isodec-copia",
  "gotero_lateral_camara:ISOROOF": "gotero-lateral-de-camara-isoroof",
  "gotero_lateral_camara:ISODEC": "gotero-lateral-de-camara-isodec",
  "gotero_lateral_camara:ISODEC_PIR": "gotero-lateral-de-camara-isodec",
  "gotero_superior:ISOROOF": "gotero-superior-3g-isoroof",
  "gotero_superior:ISODEC_PIR": "gotero-lateral-para-isodec-copia",
  "babeta_adosar:ISODEC": "babeta-isodec-adosar",
  "babeta_adosar:ISODEC_PIR": "babeta-isodec-adosar",
  "babeta_adosar:ISOROOF": "babeta-de-atornillar-lateral-isoroof",
  "babeta_empotrar:ISODEC": "babeta-de-empotrar-isodec",
  "babeta_empotrar:ISODEC_PIR": "babeta-de-empotrar-isodec",
  "babeta_empotrar:ISOROOF": "babeta-de-empotrar-lateral-isoroof",
  "cumbrera:ISODEC": "cumbrera-isodec",
  "cumbrera:ISODEC_PIR": "cumbrera-isodec",
  "cumbrera:ISOROOF": "cumbrera-isoroof-3g",
  // cumbrera:ISOROOF_COLONIAL → LOCAL_OVERRIDES
  "canalon:ISOROOF": "canalon-doble-isoroof-bandeja-tapas-agujero-bajada",
  "canalon:ISODEC": "canalon-isodec-kit-completo",
  "canalon:ISODEC_PIR": "canalon-isodec-kit-completo",
  "soporte_canalon:ISOROOF": "soporte-para-canalon-isoroof",
  "soporte_canalon:ISODEC": "soporte-de-canalon-isodec",
  "soporte_canalon:ISODEC_PIR": "soporte-de-canalon-isodec",
  "embudo:_all": "embudo-conector-de-bajada-pvc-para-canaleta-100mm",
  "vaina:ISODEC": "gotero-frontal-isodec", // alias: sin producto propio

  // ── Perfilería pared ──
  "perfil_u:ISOPANEL": "perfiles-u",
  "perfil_u:ISOWALL": "perfiles-u",
  "perfil_u:ISOFRIG": "perfiles-u",
  "perfil_g2:ISOPANEL": "angulo-plegado-g2-l-exterior",
  "perfil_k2:_all": "angulo-interior-perfil-k2",
  "esquinero_ext:_all": "angulo-plegado-g2-l-exterior",
  "esquinero_int:_all": "angulo-interior-perfil-k2",
  "perfil_5852:_all": "perfil-aluminizado-5852-anodizado-estructural-de-6-8-mts",

  // ── Fijaciones ──
  varilla_38: "varilla-roscada-bsw-3_8",
  tuerca_38: "tuerca-bsw-3-8-galvanizada",
  arandela_carrocero: "arandela-carrocero-3-8-galvanizada",
  arandela_plana: "arandela-plana-galv-3-8",
  arandela_pp: "arandela-polipropileno-tortuga",
  arandela_pp_gris: "arandela-polipropileno-tortuga",
  taco_expansivo: "taco-expansivo-3-8-para-hormigon",
  caballete: "arandela-trapezoidal-caballete-roof",
  anclaje_h: "kit-anclaje-a-h-tornillo-n-º-10-arandela-taco",
  tornillo_t1: "tornillo-t1-p-mecha-01",
  tornillo_t2: "tornillo-t1-p-mecha-01", // alias
  tornillo_aguja: "tornillos-punta-aguja-5-pulgadas",
  tornillo_hex_galv_4_mecha: "tornillos-punta-mecha-4-pulgadas",
  tornillo_hex_galv_6_mecha: "tornillos-punta-mecha-4-pulgadas",
  tornillo_hex_galv_4_aguja: "tornillos-punta-aguja-5-pulgadas",
  tornillo_hex_galv_6_aguja: "tornillos-punta-aguja-5-pulgadas",
  varilla_roscada_8mm: "varilla-roscada-bsw-5_16",
  taco_expansivo_8mm: "taco-expansivo-5-16-para-hormigon-drop-in",
  remache_pop: "remache-pop-5-32-x-1-2-zinc-blanco",
  remache_pop_316: "remache-pop-5-32-x-1-2-zinc-blanco",
  anclaje_isoroof_terracota: "arandela-trapezoidal-caballete-roof", // alias
  anclaje_isoroof_gris: "arandela-trapezoidal-caballete-roof", // alias
  anclaje_chapa_bc18: "kit-anclaje-a-h-tornillo-n-º-10-arandela-taco", // alias
  anclaje_chapa_bc35: "kit-anclaje-a-h-tornillo-n-º-10-arandela-taco", // alias
  anclaje_kit_u_platea: "kit-anclaje-a-h-tornillo-n-º-10-arandela-taco",
  tornillo_exagonal_12_34: "tornillo-t1-p-mecha-01", // alias
  tornillo_exagonal_12_1_pm: "tornillos-punta-mecha-4-pulgadas", // alias
  tornillo_exagonal_12_212_pm: "tornillos-punta-mecha-4-pulgadas", // alias
  tornillo_punta_aguja_12x2: "tornillos-punta-aguja-5-pulgadas", // alias
  tornillo_punta_aguja_12x3: "tornillos-punta-aguja-5-pulgadas", // alias
  tornillo_hex_pu_20mm_4in: "tornillos-punta-mecha-4-pulgadas", // alias

  // ── Selladores ──
  silicona: "bromplast-8-silicona-neutra",
  silicona_300_neutra: "silicona-neutra-pomo-premium",
  cinta_butilo: "cinta-butilo",
  membrana: "membrana-auto-adhesiva",
  espuma_pu: "espuma-poliuretano-expansiva",

  // ── Herramientas ──
  pistola_apl_dx03: "pistola-para-silicona-bromplast",
};

// Claves cuya foto viene de un producto PARECIDO (no el ítem exacto): se
// emiten con `alias: true` para que los consumidores puedan suprimir el href
// (linkea a otro SKU) o marcar la imagen como referencial.
const ALIAS_KEYS = new Set([
  "ISOFRIG_PIR",
  "vaina:ISODEC",
  "esquinero_ext:_all",
  "esquinero_int:_all",
  "tornillo_t2",
  "tornillo_hex_galv_4_mecha",
  "tornillo_hex_galv_6_mecha",
  "tornillo_hex_galv_4_aguja",
  "tornillo_hex_galv_6_aguja",
  "remache_pop_316",
  "anclaje_isoroof_terracota",
  "anclaje_isoroof_gris",
  "anclaje_chapa_bc18",
  "anclaje_chapa_bc35",
  "tornillo_exagonal_12_34",
  "tornillo_exagonal_12_1_pm",
  "tornillo_exagonal_12_212_pm",
  "tornillo_punta_aguja_12x2",
  "tornillo_punta_aguja_12x3",
  "tornillo_hex_pu_20mm_4in",
  "pistola_apl_dx03",
]);

// Claves sin producto Shopify pero con asset local (Vite public dir).
const LOCAL_OVERRIDES = {
  ISOROOF_COLONIAL: { src: "/images/isoroof-colonial-texas-panel.png", href: null, handle: null, local: true },
  "cumbrera:ISOROOF_COLONIAL": { src: "/images/isoroof-colonial-texas-panel.png", href: null, handle: null, local: true },
};

// Claves conocidas sin imagen — quedan con placeholder en la UI, no fallan el build.
const KNOWN_UNMAPPED = ["flete"];

// Solo las claves de panel emiten byColor (los selectores de color viven en esas cartas).
const PANEL_KEYS = new Set([
  "ISODEC_EPS", "ISODEC_PIR", "ISOROOF_3G", "ISOROOF_FOIL", "ISOROOF_PLUS",
  "ISOPANEL_EPS", "ISOWALL_PIR", "ISOFRIG_PIR",
]);

const COLOR_TOKENS = {
  Blanco: ["blanco", "white"],
  Gris: ["gris", "gray", "grey"],
  Rojo: ["rojo", "red"],
};

function normalize(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

async function fetchAllProducts() {
  const products = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = `${BASE}?page=${page}&limit=250`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    const j = await res.json();
    const arr = j?.products;
    if (!Array.isArray(arr) || arr.length === 0) break;
    products.push(...arr);
  }
  return products;
}

function pickColorImages(product) {
  const images = Array.isArray(product?.images) ? product.images : [];
  const byColor = {};
  for (const [color, tokens] of Object.entries(COLOR_TOKENS)) {
    const hit = images.find((img) => {
      const hay = normalize(`${img?.src || ""} ${img?.alt || ""}`);
      return tokens.some((t) => hay.includes(t));
    });
    if (hit?.src) byColor[color] = hit.src;
  }
  return Object.keys(byColor).length ? byColor : null;
}

async function main() {
  let products;
  if (INPUT) {
    const raw = fs.readFileSync(path.resolve(INPUT), "utf8");
    products = JSON.parse(raw)?.products || [];
  } else {
    products = await fetchAllProducts();
  }

  if (!Array.isArray(products) || products.length === 0) {
    console.error("No Shopify products available; aborting write to avoid wiping existing mapping.");
    process.exit(1);
  }

  const byHandle = new Map(products.map((p) => [p?.handle, p]));

  const byKey = {};
  const misses = [];

  for (const [key, handle] of Object.entries(KEY_TO_HANDLE)) {
    const product = byHandle.get(handle);
    const src = product?.images?.[0]?.src || product?.image?.src || null;
    if (!product || !src) {
      misses.push(`${key} -> ${handle}${product ? " (sin imágenes)" : " (handle no existe)"}`);
      continue;
    }
    const entry = {
      src,
      href: `${STORE}/products/${encodeURI(handle)}`,
      handle,
    };
    if (ALIAS_KEYS.has(key)) entry.alias = true;
    if (PANEL_KEYS.has(key)) {
      const byColor = pickColorImages(product);
      if (byColor) entry.byColor = byColor;
    }
    byKey[key] = entry;
  }

  if (misses.length) {
    console.error(`FALLO: ${misses.length} clave(s) no resuelven a un producto con imagen:`);
    for (const m of misses) console.error(`  - ${m}`);
    process.exit(1);
  }

  Object.assign(byKey, LOCAL_OVERRIDES);

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: BASE,
    byKey,
    unmatched: KNOWN_UNMAPPED,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${OUT}`);
  console.log(`  ${Object.keys(byKey).length} claves mapeadas (${Object.keys(LOCAL_OVERRIDES).length} locales), ${KNOWN_UNMAPPED.length} sin imagen: ${KNOWN_UNMAPPED.join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
