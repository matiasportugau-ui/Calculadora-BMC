import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loadSkin, persistSkin, isValidSkin } from "./skinUtils.js";

/**
 * Skin system for Admin Cot v2.
 *
 * Pattern: each skin sets `data-skin="<id>"` on the `.adminCot` wrapper, and
 * `styles.css` overrides a subset of `--ac-*` CSS custom properties per skin.
 * The token registry (with semantics for each variable) lives in the header
 * comment block of `admin-cotizaciones/styles.css`.
 *
 * To add a new skin, append it to SKINS in skinUtils.js and add a matching CSS block.
 * See styles.css for the step-by-step contract.
 */

const DEFAULT_SKIN = "macos";

const SkinContext = createContext({ skin: DEFAULT_SKIN, setSkin: () => {} });

export function SkinProvider({ children }) {
  const [skin, setSkinState] = useState(() => loadSkin());
  const setSkin = useCallback((next) => {
    if (!isValidSkin(next)) return;
    setSkinState(next);
    persistSkin(next);
  }, []);
  useEffect(() => { persistSkin(skin); }, [skin]);
  const value = useMemo(() => ({ skin, setSkin }), [skin, setSkin]);
  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- useSkin hook is contextual to SkinProvider and must be exported together
export function useSkin() {
  return useContext(SkinContext);
}
