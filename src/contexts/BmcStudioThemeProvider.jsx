import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DESIGN_PREVIEW_STORAGE_KEY } from "../lib/designPreviewMode.js";

// eslint-disable-next-line react-refresh/only-export-components -- shared studio catalog for preview bar
export const BMC_STUDIOS = [
  { id: "default", label: "Producción (actual)", short: "Prod" },
  { id: "tahoe", label: "Studio 1 — Tahoe", short: "Tahoe" },
  { id: "operativo", label: "Studio 2 — Operativo Dense", short: "Operativo" },
  { id: "warm", label: "Studio 3 — Warm Commerce", short: "Warm" },
  { id: "industrial", label: "Studio 4 — Field Industrial", short: "Industrial" },
  { id: "responsive", label: "Studio 5 — Responsive Lab", short: "Responsive" },
  { id: "bmc-glass", label: "Studio 6 — BMC Glass Premium", short: "Glass" },
];

const VALID = new Set(BMC_STUDIOS.map((s) => s.id));

function loadStudio() {
  try {
    const raw = localStorage.getItem(DESIGN_PREVIEW_STORAGE_KEY);
    if (raw && VALID.has(raw)) return raw;
  } catch { /* ignore */ }
  return "default";
}

function persistStudio(id) {
  try { localStorage.setItem(DESIGN_PREVIEW_STORAGE_KEY, id); } catch { /* ignore */ }
}

function applyDom(studioId) {
  if (typeof document === "undefined") return;
  if (studioId === "default") {
    delete document.documentElement.dataset.studio;
  } else {
    document.documentElement.dataset.studio = studioId;
  }
}

const StudioContext = createContext({
  studioId: "default",
  studio: BMC_STUDIOS[0],
  setStudioId: () => {},
  cycleStudio: () => {},
});

export function BmcStudioThemeProvider({ children }) {
  const [studioId, setStudioIdState] = useState(loadStudio);

  useEffect(() => {
    applyDom(studioId);
    persistStudio(studioId);
  }, [studioId]);

  const setStudioId = useCallback((next) => {
    if (VALID.has(next)) setStudioIdState(next);
  }, []);

  const cycleStudio = useCallback(() => {
    setStudioIdState((prev) => {
      const idx = BMC_STUDIOS.findIndex((s) => s.id === prev);
      const next = BMC_STUDIOS[(idx + 1) % BMC_STUDIOS.length];
      return next.id;
    });
  }, []);

  const studio = useMemo(
    () => BMC_STUDIOS.find((s) => s.id === studioId) ?? BMC_STUDIOS[0],
    [studioId]
  );

  const value = useMemo(
    () => ({ studioId, studio, setStudioId, cycleStudio }),
    [studioId, studio, setStudioId, cycleStudio]
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with provider
export function useBmcStudioTheme() {
  return useContext(StudioContext);
}
