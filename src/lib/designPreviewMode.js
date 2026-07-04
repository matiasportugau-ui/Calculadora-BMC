/**
 * Design preview gate — NEVER active on Vercel production unless explicitly opted in.
 *
 * Enabled when:
 * - VERCEL_ENV === "preview" (branch deploys), or
 * - VITE_BMC_DESIGN_PREVIEW=1 in env, or
 * - ?designPreview=1 in URL (local / preview only — blocked on production)
 */

export const DESIGN_PREVIEW_STORAGE_KEY = "bmc_design_studio_v1";

function viteEnv() {
  const env = import.meta.env || {};
  const definedVercelEnv = globalThis.__BMC_VERCEL_ENV__;
  return {
    VITE_BMC_DESIGN_PREVIEW: env.VITE_BMC_DESIGN_PREVIEW,
    VERCEL_ENV: typeof definedVercelEnv === "string" ? definedVercelEnv : env.VERCEL_ENV,
    DEV: Boolean(env.DEV),
  };
}

export function resolveDesignPreviewEnabled({ flag, vercelEnv, search } = {}) {
  if (flag === "1" || flag === "true") return true;

  if (vercelEnv === "preview") return true;
  if (vercelEnv === "production") return false;

  try {
    return new URLSearchParams(search || "").get("designPreview") === "1";
  } catch {
    return false;
  }
}

export function isDesignPreviewEnabled() {
  const env = viteEnv();
  if (typeof window === "undefined") {
    return resolveDesignPreviewEnabled({
      flag: env.VITE_BMC_DESIGN_PREVIEW,
      vercelEnv: env.VERCEL_ENV,
      search: "",
    });
  }

  return resolveDesignPreviewEnabled({
    flag: env.VITE_BMC_DESIGN_PREVIEW,
    vercelEnv: env.VERCEL_ENV,
    search: window.location.search,
  });
}

/** Human-readable banner label for the preview chrome. */
export function designPreviewBannerLabel() {
  const env = viteEnv();
  const vercelEnv = env.VERCEL_ENV;
  if (vercelEnv === "preview") return "Vercel Preview — no es producción";
  if (env.DEV) return "Local design preview";
  return "Design preview — no es producción";
}
