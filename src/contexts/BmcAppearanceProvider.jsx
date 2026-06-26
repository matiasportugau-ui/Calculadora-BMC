import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "bmc_appearance_v1";
const MODES = new Set(["day", "night", "system"]);

function resolveAppearance(mode) {
  if (mode === "day" || mode === "night") return mode;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "night";
  }
  return "day";
}

function loadMode() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && MODES.has(raw)) return raw;
  } catch { /* ignore */ }
  return "system";
}

function persistMode(mode) {
  try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* ignore */ }
}

function applyDom(resolved) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.appearance = resolved;
  }
}

const AppearanceContext = createContext({
  mode: "system",
  appearance: "day",
  setMode: () => {},
  toggleDayNight: () => {},
});

export function BmcAppearanceProvider({ children }) {
  const [mode, setModeState] = useState(loadMode);
  const appearance = useMemo(() => resolveAppearance(mode), [mode]);

  useEffect(() => {
    applyDom(appearance);
    persistMode(mode);
  }, [mode, appearance]);

  useEffect(() => {
    if (mode !== "system") return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyDom(resolveAppearance("system"));
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  const setMode = useCallback((next) => {
    if (MODES.has(next)) setModeState(next);
  }, []);

  const toggleDayNight = useCallback(() => {
    setModeState((prev) => {
      const current = resolveAppearance(prev);
      return current === "day" ? "night" : "day";
    });
  }, []);

  const value = useMemo(
    () => ({ mode, appearance, setMode, toggleDayNight }),
    [mode, appearance, setMode, toggleDayNight]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with provider
export function useBmcAppearance() {
  return useContext(AppearanceContext);
}
