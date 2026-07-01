import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Skin system for Admin Cot v2.
 *
 * Pattern: each skin sets `data-skin="<id>"` on the `.adminCot` wrapper, and
 * `styles.css` overrides a subset of `--ac-*` CSS custom properties per skin.
 * The token registry (with semantics for each variable) lives in the header
 * comment block of `admin-cotizaciones/styles.css`.
 *
 * To add a new skin, append it to SKINS below and add a matching CSS block.
 * See styles.css for the step-by-step contract.
 */

const STORAGE_KEY = "bmc_admin_cot_skin";
const DEFAULT_SKIN = "macos";

// eslint-disable-next-line react-refresh/only-export-components -- SKINS registry colocated with provider by design
export const SKINS = [
  { id: "macos", label: "macOS Sequoia" },
  { id: "bmc", label: "BMC Default" },
  { id: "gnome", label: "Linux GNOME" },
  { id: "anthropic", label: "Anthropic Warm" },
  { id: "linear", label: "Linear" },
  { id: "intel-dark", label: "Intel Dark" },
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

// eslint-disable-next-line react-refresh/only-export-components -- useSkin hook colocated with its provider by design
export function useSkin() {
  return useContext(SkinContext);
}
