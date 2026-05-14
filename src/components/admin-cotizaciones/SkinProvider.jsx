import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "bmc_admin_cot_skin";
const DEFAULT_SKIN = "macos";

export const SKINS = [
  { id: "macos", label: "macOS Sequoia" },
  { id: "bmc", label: "BMC Default" },
  { id: "gnome", label: "Linux GNOME" },
  { id: "anthropic", label: "Anthropic Warm" },
  { id: "linear", label: "Linear" },
];

const VALID = new Set(SKINS.map((s) => s.id));

function loadSkin() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && VALID.has(raw)) return raw;
  } catch { /* ignore */ }
  return DEFAULT_SKIN;
}

function persistSkin(skin) {
  try { localStorage.setItem(STORAGE_KEY, skin); } catch { /* ignore */ }
}

const SkinContext = createContext({ skin: DEFAULT_SKIN, setSkin: () => {} });

export function SkinProvider({ children }) {
  const [skin, setSkinState] = useState(() => loadSkin());
  const setSkin = useCallback((next) => {
    if (!VALID.has(next)) return;
    setSkinState(next);
    persistSkin(next);
  }, []);
  useEffect(() => { persistSkin(skin); }, [skin]);
  const value = useMemo(() => ({ skin, setSkin }), [skin, setSkin]);
  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}

export function useSkin() {
  return useContext(SkinContext);
}
