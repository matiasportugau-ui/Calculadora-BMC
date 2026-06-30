# Liquid Glass on the Web — BMC Implementation Guide

**Audience:** Developers and AI agents working on Calculadora BMC / Panelin hub chrome.

**Canonical CSS:** `src/styles/bmc-glass.css`  
**Reference showcase (Tailwind, not runtime):** `docs/bmc-dashboard-modernization/reference/bmc-glass-design-system.source.tsx`  
**Premium previews (Phase 0):** `docs/team/design-competition/premium-previews/index.html`

---

## Apple Liquid Glass vs web

| Concept | Apple (WWDC 2025) | BMC web |
|---------|-------------------|---------|
| Regular | Default adaptive material on nav/controls | `.glass` / `.chrome-glass` with `--g-blur` 14–20px, `--g-sat` 165% |
| Clear | High transparency; needs dimming layer | **Not used** on ops surfaces — only documented for media overlays |
| Native APIs | `glassEffect()`, `UIGlassEffect` | **Not available** — `backdrop-filter` approximation |
| Refraction | System-rendered | Optional `.glass-refract` + SVG `#bmcGlass` (Chromium progressive enhancement) |
| Reduced transparency | System | `@media (prefers-reduced-transparency: reduce)` → solid `--g-solid-bg` |

**Rule (non-negotiable):** Glass on **chrome only** — nav, modals, command palette, wizard footer. Tables, BOM rows, wizard inputs use `.glass-content-solid` (opaque).

---

## Appearance (day / night / system)

| Mode | DOM | Storage |
|------|-----|---------|
| `system` | Follows `prefers-color-scheme` | `localStorage` key `bmc_appearance_v1` (default) |
| `day` | `data-appearance="day"` on `<html>` | persisted |
| `night` | `data-appearance="night"` | persisted |

Provider: `src/contexts/BmcAppearanceProvider.jsx`  
Toggle: `AppearanceToggle` in `BmcModuleNav` (Sun/Moon via lucide-react).

### Token table

| Token | Day | Night |
|-------|-----|-------|
| `--g-bg-page` | `#f5f5f7` | `#0a0f1e` |
| `--g-text` | `#1d1d1f` | `#e2e8f0` |
| `--g-accent` | `0, 113, 227` (#0071E3) | `57, 183, 214` (ice cyan) |
| `--g-brand` | `26, 58, 92` | `226, 232, 240` |
| `--g-solid-bg` | `#ffffff` | `#0c1322` |
| `--g-blur` | 14px (default) | 14px |
| `--g-blur-nav` | 20px | 20px |
| `--g-blur-chip` | 12px | 12px |
| `--g-frost` | 0.42 | 0.42 |
| `--g-sat` | 165% | 165% |

Hub admin bridge: `[data-appearance] .adminCot { --ac-glass; --ac-blur }` in `bmc-glass.css`.

---

## Blur matrix (where glass yes/no)

| Surface | Blur | Glass? |
|---------|------|--------|
| `BmcModuleNav` | `--g-blur-nav` (desktop); solid on mobile ≤833px | Yes chrome |
| `.adminCot__topbar` | `--ac-blur` | Yes |
| Modals / ⌘K palette | `--ac-blur` | Yes chrome; form fields solid |
| Wizard edge nav (mobile) | `--g-blur-chip` | Yes (small floating control) |
| Wizard step body / BOM / CRM rows | **0** | **No — opaque** |
| Calculator `C.*` surfaces | **0** | **No** |

---

## CSS classes

| Class | Use |
|-------|-----|
| `.glass` / `.chrome-glass` | Standard frosted chrome |
| `.glass-refract` | Adds SVG displacement (Chromium) |
| `.glass-interactive` | Hover/active micro-motion |
| `.glass-content-solid` | Forces opaque content layer |
| `.glass-minimal` | Higher frost, lower blur (chips) |
| `.chrome-glass-responsive-solid` | Solid nav on mobile, glass tablet+ |

---

## Chromium SVG displacement

`GlassFilterSvg` mounts once in `App.jsx` Shell (`#bmcGlass`). Used only when `.glass-refract` is present. Safari/Firefox ignore `url(#filter)` in `backdrop-filter` — blur-only fallback remains.

---

## Accessibility

- `prefers-reduced-transparency: reduce` — all glass → solid background
- `prefers-reduced-motion: reduce` — disable `.glass-interactive` transitions
- `@supports not backdrop-filter` — solid fallback

---

## Live showcase

Admin route: `/hub/design-system/glass` — token sliders + Correcto/Incorrecto demo (`GlassDesignShowcase.jsx`).

---

## Related docs

- `DESIGN-SYSTEM.md` — colors, typography, spacing
- `docs/team/design-competition/JURY-RECOMMENDATION.md` — hybrid jury direction
- `.cursor/rules/bmc-visual-style.mdc` — agent rule
