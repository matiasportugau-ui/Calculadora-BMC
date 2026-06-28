# Studio Preview Briefs — Premium Liquid Glass

Per-studio direction for BMC design competition Phase 0 (premium previews). Each section: **Recommended**, **Most used**, **Alternative A**, **Alternative B**.

---

## Studio 1 — Tahoe (Apple Liquid Glass Regular)

**Recommended:** `--g-blur` 14–20px on nav/modals; `saturate(165%)`; frost `0.42`. Glass on chrome only. [hecho confirmado: WWDC25, existing `--ac-glass`]

**Most used:** macOS Sequoia vibrancy — matches [`admin-cotizaciones/styles.css`](../../../src/components/admin-cotizaciones/styles.css) skin `macos`.

**Alternative A:** CSS-only materialize transition when modals open (opacity + scale 180ms).

**Alternative B:** Strict Regular variant — never Clear on forms or tables.

**Day/night:** Day = light `#F5F5F7` + `#0071E3`; Night = dark bg + cyan accent optional on nav only.

---

## Studio 2 — Operativo Dense

**Recommended:** Glass **only** on sticky KPI strip header (`--g-blur: 8px`, high frost). Tables and CRM rows 100% opaque.

**Most used:** Linear / Stripe ops dashboards — border-only cards, zero blur on data.

**Alternative A:** Compact glass pill filters above table (single row).

**Alternative B:** Split-pane — solid list + glass inspector drawer chrome.

---

## Studio 3 — Warm Commerce

**Recommended:** **Exclude** glass from operational surfaces. Solid cards with warm borders `#E8E4DD`, clay accent `#C96442`.

**Most used:** Anthropic / Applied AI editorial — serif display, one primary CTA, no heavy shadows.

**Alternative A:** Soft glass on marketing CTA band only (frost 0.7, short height).

**Alternative B:** Glass nav only + paper-like solid quote cards.

---

## Studio 4 — Field Industrial

**Recommended:** Solid `#FFFFFF` / `#0c1322` content panels. Glass limited to **floating action bar** at bottom.

**Most used:** Construction SaaS — yellow alert bars, 4px radius, high contrast for sunlight.

**Alternative A:** "Outdoors mode" — zero glass, 2px borders on inputs.

**Alternative B:** Tablet-only glass on collapsible sidebar (desktop).

---

## Studio 5 — Responsive Systems Lab

**Recommended:** Mobile (390px): **solid** nav bar. Tablet+: glass chrome. Desktop: optional `.glass-refract`.

**Most used:** Mobile-first CSS; container queries for KPI grid.

**Alternative A:** Bottom sheet with glass chrome (mobile hub actions).

**Alternative B:** Floating island nav (iOS 26 tab bar trend).

---

## Studio 6 — BMC Glass Premium (Downloads reference)

**Recommended:** Full Downloads showcase — dark `#0a0f1e`, ice cyan `rgb(57,183,214)`, token playground, SVG displacement on Chromium.

**Most used:** `backdrop-filter` + optional `url(#bmcGlass)` refract; fallback to blur-only.

**Alternative A:** Day/night toggle on same page (production requirement).

**Alternative B:** Tint presets — neutro / frío / marca / cálido.

**Source:** [`bmc-glass-design-system.source.tsx`](../../../bmc-dashboard-modernization/reference/bmc-glass-design-system.source.tsx)

---

## Hybrid jury preview (post Phase 0)

| Layer | Winner direction |
|-------|------------------|
| Day hub chrome | Studio 1 Tahoe + Studio 6 tokens |
| Night hub chrome | Studio 6 Premium |
| Hub content | Studio 2 Operativo |
| Calculator | Opaque content; glass header/footer only |
| Marketing | Studio 3 Warm |
| Field/tablet | Studio 4 Industrial inputs |
