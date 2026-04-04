#!/usr/bin/env node
/**
 * Downloads ISODEC / ISOROOF gallery images from Shopify CDN URLs listed in
 * src/data/quoteVisorShopifyFamilies.json into PanelRendering/images/.
 *
 * Usage: node scripts/download-panel-rendering-assets.mjs [--dry-run]
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const JSON_PATH = path.join(REPO_ROOT, "src/data/quoteVisorShopifyFamilies.json");
const OUT_DIR = path.join(REPO_ROOT, "PanelRendering");
const IMG_DIR = path.join(OUT_DIR, "images");

const FAMILY_PREFIX = /^(ISODEC|ISOROOF)/i;
const DRY_RUN = process.argv.includes("--dry-run");

function basenameFromUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const seg = u.pathname.split("/").filter(Boolean);
    const last = seg[seg.length - 1] || "download";
    return decodeURIComponent(last).replace(/[^\w.\-()+]/g, "_") || "file.bin";
  } catch {
    return "file.bin";
  }
}

function collectForFamilies(data) {
  /** @type {Map<string, Set<string>>} */
  const urlToFamilies = new Map();

  const walk = (node, families) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((x) => walk(x, families));
      return;
    }
    if (typeof node.src === "string" && node.src.startsWith("http")) {
      if (!urlToFamilies.has(node.src)) urlToFamilies.set(node.src, new Set());
      families.forEach((f) => urlToFamilies.get(node.src).add(f));
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === "byFamily" && v && typeof v === "object" && !Array.isArray(v)) {
        for (const [famKey, famVal] of Object.entries(v)) {
          if (!FAMILY_PREFIX.test(famKey)) continue;
          walk(famVal, new Set([famKey]));
        }
        continue;
      }
      walk(v, families);
    }
  };

  walk(data, new Set());
  return urlToFamilies;
}

async function downloadOne(urlStr, destPath) {
  const res = await fetch(urlStr, {
    headers: {
      "User-Agent": "Calculadora-BMC-panel-rendering-sync/1.0 (+https://bmcuruguay.com.uy)",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(destPath, buf);
  return buf.length;
}

async function main() {
  const raw = await fs.promises.readFile(JSON_PATH, "utf8");
  const data = JSON.parse(raw);
  const urlToFamilies = collectForFamilies(data);
  const urls = [...urlToFamilies.keys()].sort();

  if (urls.length === 0) {
    console.error("No ISODEC/ISOROOF image URLs found in", JSON_PATH);
    process.exit(1);
  }

  if (!DRY_RUN) {
    await fs.promises.mkdir(IMG_DIR, { recursive: true });
  }

  /** @type {{ url: string; file: string; bytes?: number; families: string[] }[]} */
  const manifestFiles = [];
  const usedNames = new Map();

  for (const urlStr of urls) {
    let base = basenameFromUrl(urlStr);
    if (!/\.[a-z0-9]{2,5}$/i.test(base)) {
      const hint = urlStr.includes(".avif") ? ".avif" : ".bin";
      base += hint;
    }
    if (usedNames.has(base)) {
      const h = crypto.createHash("sha256").update(urlStr).digest("hex").slice(0, 8);
      const ext = path.extname(base) || "";
      const stem = path.basename(base, ext);
      base = `${stem}_${h}${ext}`;
    }
    usedNames.set(base, urlStr);

    const rel = path.join("images", base);
    const dest = path.join(OUT_DIR, rel);
    const families = [...urlToFamilies.get(urlStr)].sort();

    if (DRY_RUN) {
      console.log("[dry-run]", rel, "<-", urlStr.slice(0, 72) + "…");
      manifestFiles.push({ url: urlStr, file: rel, families });
      continue;
    }

    const bytes = await downloadOne(urlStr, dest);
    console.log("OK", rel, `(${bytes} bytes)`);
    manifestFiles.push({ url: urlStr, file: rel, bytes, families });
  }

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceJson: "src/data/quoteVisorShopifyFamilies.json",
    familiesIncluded: [
      ...new Set(manifestFiles.flatMap((f) => f.families)),
    ].sort(),
    files: manifestFiles,
  };

  if (!DRY_RUN) {
    await fs.promises.writeFile(
      path.join(OUT_DIR, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8"
    );
  }

  console.log(
    DRY_RUN ? `Dry run: ${urls.length} files (no writes).` : `Wrote ${urls.length} files under PanelRendering/images/`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
