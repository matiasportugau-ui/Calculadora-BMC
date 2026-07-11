/**
 * Visor 3D gate — dedicated feature flag for the roof "Visor 3D" (`Roof3DSection`).
 *
 * Additive to design-preview: the design-preview surface keeps showing the 3D,
 * and this adds an independent, production-capable switch. Enabled when ANY of:
 * - VITE_FEATURE_VISOR_3D === "true" | "1" in env (per-environment toggle), or
 * - ?visor3d=1 in the URL (any environment, including production), or
 * - design-preview is active (isDesignPreviewEnabled()).
 *
 * Default OFF: production shows the Visor 3D only via the env flag or ?visor3d=1
 * (design-preview itself is blocked on Vercel production — see designPreviewMode.js).
 *
 * NOTE: callers use this at module/render eval time, so ?visor3d=1 is honored on
 * initial load / hard refresh, not on in-SPA route changes that add the param
 * without a reload — matching how isDesignPreviewEnabled() is consumed.
 */
import { isDesignPreviewEnabled } from "./designPreviewMode.js";

export function isVisor3dEnabled() {
  const flag = import.meta.env.VITE_FEATURE_VISOR_3D;
  if (flag === "1" || flag === "true") return true;

  if (typeof window !== "undefined") {
    try {
      if (new URLSearchParams(window.location.search).get("visor3d") === "1") {
        return true;
      }
    } catch {
      // malformed query string — fall through to design-preview check
    }
  }

  return isDesignPreviewEnabled();
}
