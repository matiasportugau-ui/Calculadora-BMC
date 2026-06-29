# Trend Research 2026 — 5 Studio Design Competition

Consolidated trend notes for Calculadora BMC design competition. Each studio cites ≥3 external sources with epistemic tags.

---

## Studio 1 — Tahoe (Liquid Glass Regular)

**Philosophy:** Apple-style translucent chrome layer; opaque content.

| Trend | Tag | Source |
|-------|-----|--------|
| Liquid Glass as functional nav layer, not content background | [CONFIRMED: Apple Adopting Liquid Glass](https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass) | Apple Developer Documentation |
| Regular vs Clear variants — never mix on same surface | [CONFIRMED: WWDC25 Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/356) | Apple WWDC 2025 |
| Reduce transparency / reduce motion accessibility fallbacks | [CONFIRMED: Adopting Liquid Glass § Visual refresh](https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass) | Apple HIG |
| `backdrop-filter: saturate(180%) blur(20px)` web approximation | [INFERRED: basis: existing `--ac-glass` in admin-cotizaciones/styles.css] | BMC repo |
| Sparingly apply glass to custom controls only | [CONFIRMED: Applying Liquid Glass to custom views](https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views) | Apple SwiftUI docs |

**BMC fit:** Extends existing macOS skin (`SkinProvider` id `macos`) and `--ac-*` tokens. Hub topbar, command palette, modals — not wizard forms.

---

## Studio 2 — Operativo Dense (Time-saving ops)

**Philosophy:** Maximum information density; KPI strip + table row actions; minimal decoration.

| Trend | Tag | Source |
|-------|-----|--------|
| Table + row actions reduce clicks vs drill-down | [CONFIRMED: DESIGN-PROPOSAL-TIME-SAVING.md §1] | BMC internal doc |
| KPI strip above list for scan-without-scroll | [CONFIRMED: DESIGN-PROPOSAL-TIME-SAVING.md §1] | BMC internal doc |
| Sticky headers on long operational tables | [CONFIRMED: DESIGN-PROPOSAL-TIME-SAVING.md §3 Opción A] | BMC internal doc |
| Dashboard density patterns (Stripe Atlas, Linear ops) | [INFERRED: basis: bmc-dashboard-design-best-practices reference.md patterns] | BMC skill |
| Skeleton loading states for Sheets-backed blocks | [CONFIRMED: docs/team/knowledge/Design.md § Convenciones] | BMC Design role KB |

**BMC fit:** Aligns with CRM cockpit, cotizaciones admin, finanzas tables. Blur optional or minimal (8px) on sticky header only.

---

## Studio 3 — Warm Commerce (Applied AI)

**Philosophy:** Warm neutrals, serif display, border-over-fill, client-trust aesthetic.

| Trend | Tag | Source |
|-------|-----|--------|
| Off-white `#FAF9F6`, clay accent `#C96442`, no heavy shadows | [CONFIRMED: .claude/skills/applied-ai-design/SKILL.md] | BMC skill |
| Content-first; one primary action per view | [CONFIRMED: applied-ai-design § Core principles] | BMC skill |
| Borders over fills for cards; anti-gradient | [CONFIRMED: applied-ai-design § Anti-patterns] | BMC skill |
| Editorial serif + sans UI pairing (Anthropic/claude.ai pattern) | [INFERRED: basis: applied-ai-design token block] | Industry reference |
| Trust-forward quoting UX for B2B construction | [ASSUMPTION: warm palette reduces operator anxiety on large USD totals | verify with user testing] | — |

**BMC fit:** Client-facing PDF preview tone, Panelin chat skin `anthropic`, marketing `/hub/marketing`. No glass.

---

## Studio 4 — Field Industrial (Construction / tablet)

**Philosophy:** High contrast, solid surfaces, large touch targets, readable in sunlight.

| Trend | Tag | Source |
|-------|-----|--------|
| Construction-bold PDF template aesthetic (strong headers, high contrast) | [CONFIRMED: src/pdf-templates/construction-bold] | BMC repo |
| 44px+ touch targets for gloved / field use | [CONFIRMED: WCAG 2.5.5 Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html) | W3C |
| Reduced translucency outdoors (legibility) | [INFERRED: basis: Liquid Glass research — blur excluded from dense forms] | BMC session |
| Safety yellow highlight bars for warnings (obra context) | [ASSUMPTION: common construction SaaS pattern | verify brand] | — |
| Tablet-first layout (834px) as primary field breakpoint | [CONFIRMED: plan breakpoint matrix 834px tablet] | Competition brief |

**BMC fit:** Inspector/conductor routes, logística, dimension entry on obra. Solid `#FFFFFF` cards, `#263238` brand bar.

---

## Studio 5 — Responsive Systems Lab (Mobile-first progressive)

**Philosophy:** Mobile defaults; glass nav only at desktop; container-aware layouts.

| Trend | Tag | Source |
|-------|-----|--------|
| Mobile-first CSS (base styles = 390px, enhance upward) | [CONFIRMED: MDN Mobile-first responsive design](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Responsive/Mobile_first) | MDN |
| Container queries for component-level responsiveness | [CONFIRMED: CSS container queries (2023+ baseline)](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries) | MDN |
| Progressive enhancement: solid mobile nav → glass desktop | [INFERRED: basis: performance + touch reliability on mobile] | BMC session |
| 44px minimum interactive targets | [CONFIRMED: Apple HIG Touch Targets](https://developer.apple.com/design/human-interface-guidelines/accessibility) | Apple HIG |
| Hub hamburger + single-column wizard on mobile | [CONFIRMED: src/styles/bmc-mobile.css existing patterns] | BMC repo |

**BMC fit:** Unified `@media (min-width: 1024px)` glass on `.chrome-glass` only; calculator wizard stacks visor below form on mobile.

---

## Cross-studio synthesis

| Dimension | Winner direction |
|-----------|------------------|
| Hub chrome | Studio Tahoe tokens + Responsive mobile fallback |
| Calculator content | Operativo density + Industrial contrast on inputs |
| Client/marketing surfaces | Warm Commerce |
| Field/tablet | Industrial + Responsive touch targets |
| Glass discipline | Tahoe rules: nav/modals only, never BOM/table |

See [`JURY-RECOMMENDATION.md`](JURY-RECOMMENDATION.md) for scored outcome and hybrid integration plan.
