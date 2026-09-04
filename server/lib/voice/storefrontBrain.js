/**
 * Public-safe slice of the shared IAlfred ↔ Panelin IA brain.
 * Same lessons.json as operator Panelin; Admin/Drive/wizard lessons stay out.
 */
import os from "node:os";
import path from "node:path";
import { config } from "../../config.js";
import {
  brainStatus,
  getBrainLessons,
  rankLessons,
  tryHydrateBrainFromLocalFiles,
} from "../brainKB.js";
import { isUnsafeStorefrontKnowledgeLine } from "../knowledgeLoader.js";

export const STOREFRONT_BRAIN_GUARD = `## CONOCIMIENTO ACUMULADO (recorte público)
Verified BMC product and quote lessons. Shoppers must never hear internal names (Admin, Drive, CRM, calculator SPA).
They do NOT override: lista web, never flete numbers, quote+PDF when the project is buyable (offer it).`;

export const STOREFRONT_BRAIN_DENY_IDS = Object.freeze([
  "admin-ao-edit-opendrive",
  "admin-m-pdf-receipt",
  "admin-icon-style-font18",
  "drive-upload-oauth-not-sa",
  "calc-load-unlock-wizard",
]);

const DENY_RE =
  /openDrive|openBmc|Wolfboard|GOOGLE_DRIVE|Admin col|lista venta|precio_venta|Service Account|maxReachedStep|fontSize\s*18|calculadora-bmc\.vercel\.app/i;

export function isPublicStorefrontLesson(lesson) {
  if (!lesson || lesson.status !== "active") return false;
  const id = String(lesson.id || "");
  if (STOREFRONT_BRAIN_DENY_IDS.includes(id)) return false;
  if (/^(admin|drive)-/i.test(id) || /^calc-load-/i.test(id)) return false;
  const blob = `${id}\n${lesson.trigger || ""}\n${lesson.rule || ""}`;
  if (DENY_RE.test(blob)) return false;
  if (isUnsafeStorefrontKnowledgeLine(lesson.rule)) return false;
  return true;
}

export function shopperTextForBrain(body = {}) {
  const msg = String(body.message || body.text || "").trim();
  if (msg) return msg.slice(0, 2000);
  const hist = Array.isArray(body.history) ? body.history : [];
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i]?.role === "user" && hist[i]?.content) {
      return String(hist[i].content).trim().slice(0, 2000);
    }
  }
  return "";
}

function localLessonPaths() {
  const home = os.homedir();
  return [
    config.brainLocalPath,
    path.join(home, ".ialfred/kb/bmc-brain-lessons.json"),
    path.join(home, "bmc-sheet-quote-pipeline/knowledge/lessons.json"),
  ].filter(Boolean);
}

let _hydrated = false;

export function ensureStorefrontBrainHydrated() {
  if (_hydrated) return;
  _hydrated = true;
  if (brainStatus().total > 0) return;
  tryHydrateBrainFromLocalFiles(localLessonPaths());
}

export function storefrontBrainBlock(query = "", n = config.brainInjectCap) {
  ensureStorefrontBrainHydrated();
  const publicLessons = getBrainLessons().filter(isPublicStorefrontLesson);
  const ranked = rankLessons(publicLessons, query, n);
  if (!ranked.length) return "";
  const lines = ranked.map(({ l }) => `- ${l.rule}`).join("\n");
  return `${STOREFRONT_BRAIN_GUARD}\n${lines}`;
}

export function storefrontBrainStatus() {
  ensureStorefrontBrainHydrated();
  const st = brainStatus();
  const publicActive = getBrainLessons().filter(isPublicStorefrontLesson).length;
  let source = "none";
  if (st.source === "gcs") source = "gcs";
  else if (st.source === "local" || st.source === "test") source = st.source;
  else if (st.total > 0) source = "other";
  return {
    shared: true,
    source,
    publicActive,
    total: st.total,
  };
}

/** Tests only. */
export function __resetStorefrontBrainHydratedForTests() {
  _hydrated = false;
}
