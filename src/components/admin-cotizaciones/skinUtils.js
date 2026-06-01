/**
 * Skin system utilities for Admin Cot v2.
 * Non-component exports for fast refresh compatibility.
 */

export const SKINS = [
  { id: "macos", label: "macOS Sequoia" },
  { id: "bmc", label: "BMC Default" },
  { id: "gnome", label: "Linux GNOME" },
  { id: "anthropic", label: "Anthropic Warm" },
  { id: "linear", label: "Linear" },
];

const STORAGE_KEY = "bmc_admin_cot_skin";
const DEFAULT_SKIN = "macos";
const VALID = new Set(SKINS.map((s) => s.id));

export function loadSkin() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && VALID.has(raw)) return raw;
  } catch { /* ignore */ }
  return DEFAULT_SKIN;
}

export function persistSkin(skin) {
  try { localStorage.setItem(STORAGE_KEY, skin); } catch { /* ignore */ }
}

export function isValidSkin(skin) {
  return VALID.has(skin);
}

export const DEFAULT_SKIN_VALUE = DEFAULT_SKIN;
