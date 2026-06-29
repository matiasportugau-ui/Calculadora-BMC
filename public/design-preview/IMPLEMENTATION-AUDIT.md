# Glass Implementation Audit — backdrop-filter in `src/`

**Date:** 2026-06-26  
**Command:** `rg "backdrop-filter|webkit-backdrop-filter" src/`

## Summary

All `backdrop-filter` usage is confined to **chrome** layers (nav, admin topbars/modals, mobile wizard edge nav). No blur on calculator BOM/table cell components.

## Findings

| File | Lines | Surface | Verdict |
|------|-------|---------|---------|
| `src/styles/bmc-glass.css` | 108–186 | `.glass`, `.chrome-glass`, a11y fallbacks | ✅ Chrome primitives |
| `src/styles/bmc-mobile.css` | 120–121 | `.bmc-wizard-edge-nav` | ✅ Small floating control |
| `src/components/admin-cotizaciones/styles.css` | 165–654 | `.adminCot__topbar`, modals, palette | ✅ Hub chrome |
| `src/pdf-templates/simple-ocean.js` | 25 | PDF client grid (print) | ✅ Out of SPA scope |

## Not found (expected)

- No `backdrop-filter` in `PanelinCalculadoraV3_backup.jsx`
- No blur on BOM row components under `src/utils/` or calculator wizard step bodies

## Day/night manual checklist

- [ ] Toggle in `BmcModuleNav` switches `data-appearance` on `<html>`
- [ ] Preference persists after reload (`bmc_appearance_v1`)
- [ ] `/hub/cotizaciones` topbar uses `--ac-glass` bridged from `--g-*`
- [ ] Calculator wizard table/BOM remains opaque in both modes
- [ ] `prefers-reduced-transparency` → solid chrome (DevTools emulation)

## Gate

Run: `npm run gate:local:full`

**Result (2026-06-26):** ✅ PASS — lint, test, test:api, build green.
