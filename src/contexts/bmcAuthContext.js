// ═══════════════════════════════════════════════════════════════════════════
// bmcAuthContext.js — Context + hook helpers separados del Provider para que
// Fast Refresh (Vite + react-refresh) trate BmcAuthProvider.jsx como
// archivo "components-only".
// (Top-30 run 2026-05-12 #A13)
// ═══════════════════════════════════════════════════════════════════════════

import { createContext, useContext } from "react";

export const BmcAuthContext = createContext(null);

export function useBmcAuthContext() {
  const ctx = useContext(BmcAuthContext);
  if (!ctx) throw new Error("useBmcAuth must be used inside <BmcAuthProvider>");
  return ctx;
}
