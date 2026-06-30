# Reference: bmc-glass-design-system.source.tsx

Copied from `/Users/matias/Downloads/bmc-glass-design-system.tsx` (2026-06-26).

**Porting notes for production (`src/`):**

- Remove Tailwind — use [`src/styles/bmc-glass.css`](../../../src/styles/bmc-glass.css) instead.
- `Glass` component → [`src/components/glass/Glass.jsx`](../../../src/components/glass/Glass.jsx).
- Token prefix `--g-*` is canonical; hub `--ac-*` aliases in day mode.
- Refract (`url(#bmcGlass)`) is Chromium-only progressive enhancement.
- Day/night via `BmcAppearanceProvider` + `data-appearance` on `<html>`.
- Do not glass BOM/table/form bodies — see calc demo §03 in source.

**Live showcase:** `/hub/design-system/glass` (admin).
