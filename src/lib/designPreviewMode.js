/**
 * Design preview gate — NEVER active on Vercel production unless explicitly opted in.
 *
 * Enabled when:
 * - VERCEL_ENV === "preview" (branch deploys), or
 * - VITE_BMC_DESIGN_PREVIEW=1 in env, or
 * - ?designPreview=1 in URL (local / preview only — blocked on production)
 */

export const DESIGN_PREVIEW_STORAGE_KEY = "bmc_design_studio_v1";

export function isDesignPreviewEnabled() {
  const flag = import.meta.env.VITE_BMC_DESIGN_PREVIEW;
  if (flag === "1" || flag === "true") return true;

  const vercelEnv = import.meta.env.VERCEL_ENV;
  if (vercelEnv === "preview") return true;

  if (typeof window === "undefined") return false;
  if (vercelEnv === "production") return false;

  try {
    return new URLSearchParams(window.location.search).get("designPreview") === "1";
  } catch {
    return false;
  }
}

/** Human-readable banner label for the preview chrome. */
export function designPreviewBannerLabel() {
  const vercelEnv = import.meta.env.VERCEL_ENV;
  if (vercelEnv === "preview") return "Vercel Preview — no es producción";
  if (import.meta.env.DEV) return "Local design preview";
  return "Design preview — no es producción";
}
