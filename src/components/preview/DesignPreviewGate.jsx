import { useEffect, useState } from "react";
import { isDesignPreviewEnabled } from "../../lib/designPreviewMode.js";
import { BmcAppearanceProvider } from "../../contexts/BmcAppearanceProvider.jsx";
import { BmcStudioThemeProvider } from "../../contexts/BmcStudioThemeProvider.jsx";
import DesignPreviewBar from "./DesignPreviewBar.jsx";
import GlassFilterSvg from "../glass/GlassFilterSvg.jsx";

/**
 * Wraps the SPA when design preview mode is on (Vercel Preview / env / ?designPreview=1).
 * Production calculadora-bmc.vercel.app stays unchanged.
 */
export default function DesignPreviewGate({ children }) {
  const enabled = isDesignPreviewEnabled();
  const [stylesReady, setStylesReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    Promise.all([
      import("../../styles/bmc-glass.css"),
      import("../../styles/bmc-studio-themes.css"),
    ]).then(() => {
      if (!cancelled) setStylesReady(true);
    });
    document.documentElement.dataset.designPreview = "1";
    return () => {
      cancelled = true;
      delete document.documentElement.dataset.designPreview;
      delete document.documentElement.dataset.studio;
    };
  }, [enabled]);

  if (!enabled) return children;
  if (!stylesReady) return children;

  return (
    <BmcAppearanceProvider>
      <BmcStudioThemeProvider>
        <GlassFilterSvg displace={24} />
        <div className="app-bg-layer" aria-hidden />
        <div className="bmc-preview-shell" style={{ paddingBottom: 72 }}>
          {children}
        </div>
        <DesignPreviewBar />
      </BmcStudioThemeProvider>
    </BmcAppearanceProvider>
  );
}
