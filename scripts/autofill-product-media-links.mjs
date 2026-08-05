#!/usr/bin/env node
/**
 * Autofill missing product-media-links from Shopify catalog + inheritance rules.
 * Never overwrites status:"linked" unless --force.
 *
 * Usage:
 *   node scripts/autofill-product-media-links.mjs
 *   node scripts/autofill-product-media-links.mjs --force
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FIJACIONES,
  HERRAMIENTAS,
  SELLADORES,
  PANELS_TECHO,
  PANELS_PARED,
} from "../src/data/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MEDIA = path.join(ROOT, "src/data/product-media");
const LINKS_PATH = path.join(MEDIA, "product-media-links.json");
const CATALOG_PATH = path.join(MEDIA, "product-media-catalog.json");
const REPORT_DIR = path.join(ROOT, "reports");
const FORCE = process.argv.includes("--force");

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
const links = JSON.parse(fs.readFileSync(LINKS_PATH, "utf8"));
const products = catalog.products || [];
const byHandle = Object.fromEntries(products.map((p) => [p.handle, p]));

function pick(pred) {
  return products.find(pred) || null;
}

function linkFromProduct(p, { status = "inherited", inheritedFrom = null, confidence = 0.6 } = {}) {
  if (!p) return null;
  return {
    handle: p.handle,
    imageSrc: p.primaryImage || p.images?.[0]?.src || null,
    title: p.title,
    status,
    ...(inheritedFrom ? { inheritedFrom } : {}),
    confidence,
  };
}

function linkFromHandle(handle, opts) {
  return linkFromProduct(byHandle[handle], opts);
}

function canWrite(existing) {
  if (!existing) return true;
  if (FORCE) return true;
  if (existing.status === "linked" && existing.imageSrc) return false;
  return true;
}

function setFij(key, link, changes) {
  if (!link?.imageSrc) return;
  const prev = links.fijaciones?.[key];
  if (!canWrite(prev)) return;
  if (!links.fijaciones) links.fijaciones = {};
  links.fijaciones[key] = link;
  changes.push(`fijaciones.${key} → ${link.title} (${link.status})`);
}

function setPanel(key, link, changes) {
  if (!link?.imageSrc) return;
  const prev = links.panels?.[key];
  if (!canWrite(prev) && prev?.status === "linked") return;
  // allow upgrading suggested → inherited/linked
  if (!links.panels) links.panels = {};
  links.panels[key] = link;
  changes.push(`panels.${key} → ${link.title} (${link.status})`);
}

// Shopify anchors
const mecha =
  pick((p) => /punta\s*mecha/i.test(p.title) && /tornillo/i.test(p.title)) ||
  pick((p) => /tornillo t1/i.test(p.title)) ||
  byHandle["tornillos-punta-mecha-4-pulgadas"] ||
  byHandle["tornillo-t1-p-mecha-01"];
const aguja =
  pick((p) => /punta\s*aguja/i.test(p.title) && /tornillo/i.test(p.title)) ||
  byHandle["tornillos-punta-aguja-5-pulgadas"];
const anclajeKit =
  pick((p) => /kit anclaje/i.test(p.title)) || byHandle["kit-anclaje-a-h-tornillo-n-º-10-arandela-taco"];
const taco38 = pick((p) => /taco/i.test(p.title) && /3\/8|3-8/i.test(p.title));
const taco516 = pick((p) => /taco/i.test(p.title) && /5\/16|5-16/i.test(p.title));
const varilla38 = pick((p) => /varilla/i.test(p.title) && /3\/8|3_8|3-8/i.test(p.title));
const varilla516 = pick((p) => /varilla/i.test(p.title) && /5\/16|5_16|5-16/i.test(p.title));
const pistola =
  pick((p) => /aplicador|pistola/i.test(p.title)) ||
  pick((p) => /espuma/i.test(p.title) && /aplic/i.test(p.title));
const caballete = pick((p) => /caballete/i.test(p.title));

const changes = [];
const fijAll = { ...FIJACIONES, ...(HERRAMIENTAS || {}) };

for (const key of Object.keys(fijAll)) {
  const existing = links.fijaciones?.[key];
  if (existing?.status === "linked" && existing.imageSrc && !FORCE) continue;

  let p = null;
  let meta = { status: "inherited", confidence: 0.55, inheritedFrom: null };

  if (/mecha|_pm$|exagonal_.*_pm|hex_galv_.*_mecha/i.test(key)) {
    p = mecha;
    meta = { status: "inherited", confidence: 0.65, inheritedFrom: "shopify:punta_mecha" };
  } else if (/aguja|hex_pu|hex_galv_.*_aguja|punta_aguja/i.test(key)) {
    p = aguja;
    meta = { status: "inherited", confidence: 0.65, inheritedFrom: "shopify:punta_aguja" };
  } else if (/anclaje/i.test(key)) {
    p = anclajeKit || caballete;
    meta = { status: "inherited", confidence: 0.5, inheritedFrom: "shopify:anclaje_kit" };
  } else if (/taco_expansivo_8mm/i.test(key)) {
    p = taco516 || taco38;
    meta = { status: "inherited", confidence: 0.6, inheritedFrom: "shopify:taco" };
  } else if (/varilla_roscada_8mm/i.test(key)) {
    p = varilla516 || varilla38;
    meta = { status: "inherited", confidence: 0.55, inheritedFrom: "shopify:varilla" };
  } else if (/pistola|apl_dx/i.test(key)) {
    p = pistola;
    meta = { status: "inherited", confidence: 0.7, inheritedFrom: "shopify:aplicador" };
  } else if (/exagonal|hexagonal|tornillo_exagonal/i.test(key)) {
    // generic hex screws → prefer mecha pack if label says mecha, else aguja/mecha
    const label = String(fijAll[key]?.label || "").toLowerCase();
    if (/mecha/.test(label)) {
      p = mecha;
      meta = { status: "inherited", confidence: 0.55, inheritedFrom: "shopify:punta_mecha" };
    } else if (/aguja/.test(label)) {
      p = aguja;
      meta = { status: "inherited", confidence: 0.55, inheritedFrom: "shopify:punta_aguja" };
    } else {
      p = mecha || aguja;
      meta = { status: "inherited", confidence: 0.45, inheritedFrom: "shopify:tornillo_hex_generic" };
    }
  } else if (!existing?.imageSrc) {
    // try label tokens from constants (exclude kit titles)
    const label = String(fijAll[key]?.label || key).toLowerCase();
    p = pick((prod) => {
      const t = prod.title.toLowerCase();
      if (/kit/.test(t)) return false;
      if (/tornillo/.test(label) && /tornillo/.test(t) && !/kit/.test(t)) return true;
      if (/arandela/.test(label) && /arandela/.test(t)) return true;
      return false;
    });
    meta = { status: "inherited", confidence: 0.4, inheritedFrom: "label_fuzzy" };
  }

  if (p) setFij(key, linkFromProduct(p, meta), changes);
}

// Panels colonial + isofrig
const isoroof3g =
  byHandle["isoroof-3g-gris-rojo-blanco-bromyros"] ||
  pick((p) => /isoroof/i.test(p.title) && /3g/i.test(p.title) && !/plus|foil|babeta|gotero/i.test(p.title));
const isowall = byHandle["isowall-®-pir"] || pick((p) => /isowall/i.test(p.title));
const colonialLocal = "/images/isoroof-colonial-texas-panel.png";
const colonialFile = path.join(ROOT, "public/images/isoroof-colonial-texas-panel.png");

if (fs.existsSync(colonialFile)) {
  setPanel(
    "ISOROOF_COLONIAL",
    {
      handle: null,
      imageSrc: colonialLocal,
      title: "Isoroof Colonial (local asset)",
      status: "linked",
      confidence: 0.95,
      inheritedFrom: "local:public/images/isoroof-colonial-texas-panel.png",
    },
    changes,
  );
} else if (isoroof3g) {
  setPanel(
    "ISOROOF_COLONIAL",
    linkFromProduct(isoroof3g, {
      status: "inherited",
      confidence: 0.5,
      inheritedFrom: "panel.ISOROOF_3G",
    }),
    changes,
  );
}

if (isowall) {
  setPanel(
    "ISOFRIG_PIR",
    linkFromProduct(isowall, {
      status: "inherited",
      confidence: 0.55,
      inheritedFrom: "panel.ISOWALL_PIR",
    }),
    changes,
  );
}

// Ensure every fij key has something
const stillMissing = Object.keys(fijAll).filter((k) => !links.fijaciones?.[k]?.imageSrc);
// last resort: first tornillo product
const anyTornillo = mecha || aguja || pick((p) => /tornillo/i.test(p.title));
for (const k of stillMissing) {
  if (anyTornillo) {
    setFij(
      k,
      linkFromProduct(anyTornillo, {
        status: "inherited",
        confidence: 0.3,
        inheritedFrom: "shopify:generic_tornillo",
      }),
      changes,
    );
  }
}

links.version = Math.max(3, Number(links.version) || 3) + 0; // keep 3+
links.updatedAt = new Date().toISOString();
links.note =
  "Autofill " +
  new Date().toISOString().slice(0, 10) +
  ": inherited rules for residual fij + colonial/isofrig. Do not treat inherited as exact SKU photos.";

fs.writeFileSync(LINKS_PATH, `${JSON.stringify(links, null, 2)}\n`);

fs.mkdirSync(REPORT_DIR, { recursive: true });
const date = new Date().toISOString().slice(0, 10);
const reportPath = path.join(REPORT_DIR, `product-media-autofill-${date}.md`);
const missAfter = Object.keys(fijAll).filter((k) => !links.fijaciones?.[k]?.imageSrc);
const panelsAll = { ...PANELS_TECHO, ...PANELS_PARED };
const missPanels = Object.keys(panelsAll).filter((k) => !links.panels?.[k]?.imageSrc);

const report = `# Product media autofill — ${date}

## Changes (${changes.length})
${changes.map((c) => `- ${c}`).join("\n") || "_none_"}

## Coverage
- Fijaciones keys: ${Object.keys(fijAll).length}
- Fij with image: ${Object.keys(fijAll).length - missAfter.length}
- Still missing fij: ${missAfter.length ? missAfter.join(", ") : "_none_"}
- Panels missing: ${missPanels.length ? missPanels.join(", ") : "_none_"}
- Selladores: ${Object.keys(SELLADORES || {}).length} keys, linked ${Object.keys(links.selladores || {}).length}

## Force
Run with \`--force\` to overwrite existing \`linked\` entries.
`;
fs.writeFileSync(reportPath, report);
console.log(report);
console.log("Wrote", path.relative(ROOT, LINKS_PATH));
console.log("Report", path.relative(ROOT, reportPath));
if (missAfter.length) process.exitCode = 1;
