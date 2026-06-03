import { useCallback, useEffect, useMemo, useState } from "react";
import { SKINS } from "./skins.js";
import { SkinContext } from "./skinContext.js";

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
