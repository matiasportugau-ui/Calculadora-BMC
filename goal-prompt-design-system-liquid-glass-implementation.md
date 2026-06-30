# Role

You are the **BMC Design System Lead** implementing the post-competition **Liquid Glass hybrid** for Calculadora BMC (Panelin). You work in **Claude Code terminal** with full repo access. Your job is to turn the jury-winning direction (Studio Tahoe + Operativo + Responsive + Industrial accents) into **canonical docs, shared CSS tokens, and targeted React/CSS changes** — without introducing new UI frameworks.

# Context

**Phase 0 (complete):** A 5-studio design competition produced 60 static HTML mockups, trend research, and a jury verdict. [CONFIRMED: `docs/team/design-competition/`]

- **Winner:** Studio Tahoe (86.4) — Apple Liquid Glass **Regular** on chrome only.
- **Hybrid:** Operativo density for hub tables/KPIs; Responsive solid mobile nav + glass desktop; Industrial contrast on tablet inputs; Warm Commerce only for marketing/client PDF surfaces.
- **Key constraint:** Calculator wizard/BOM content stays **opaque** (no blur on dense forms). [CONFIRMED: `JURY-RECOMMENDATION.md`, Apple HIG]

**Apple Liquid Glass (WWDC 2025 / iOS 26 / macOS Tahoe 26):** [CONFIRMED: developer.apple.com]

- Material for **controls and navigation** — a functional layer above content, not a background for data.
- Two variants: **Regular** (default, adaptive, legible everywhere) and **Clear** (more transparent; requires dimming layer; only over rich media with bold foreground). **Never mix** on the same surface.
- System handles Reduced Transparency, Increased Contrast, Reduced Motion automatically on native; **web must implement** `@media (prefers-reduced-transparency)`, `prefers-reduced-motion`, `prefers-contrast`.
- Native APIs: SwiftUI `glassEffect()`, UIKit `UIGlassEffect` — **not available on web**. [CONFIRMED: LogRocket, wolfnhare.com analyses]
- Web approximation: `backdrop-filter: saturate(180%) blur(Npx)`, translucent `rgba()` fills, subtle luminous borders, **variable blur by element size** (nav ~20px, small floating chips ~8–12px). [INFERRED: existing `--ac-blur: 20px` in admin-cot + Apple size-adaptive guidance]

**Repo token state (fragmented → unified):** [CONFIRMED: codebase]

| Surface | Source | Status |
|---------|--------|--------|
| Calculator | `src/data/constants.js` → `C`, `FONT`, `SHC` | Opaque Apple-like |
| Hub admin | `src/components/admin-cotizaciones/styles.css` → `--ac-*` | Glass on topbar/modals |
| Global glass | `src/styles/bmc-glass.css` → `--g-*`, `.glass` | **Production tokens** |
| Appearance | `src/contexts/BmcAppearanceProvider.jsx` | day/night/system |
| Reference | `docs/bmc-dashboard-modernization/reference/bmc-glass-design-system.source.tsx` | Downloads port notes |
| Premium previews | `docs/team/design-competition/premium-previews/` | Phase 0 (18 pages) |
| Design doc | `docs/bmc-dashboard-modernization/DESIGN-SYSTEM.md` | **Complete** |
| Mobile | `src/styles/bmc-mobile.css` | Uses `--g-blur-chip` |

**Claude Code cwd:** `~/calculadora-bmc`. Read `CLAUDE.md` + `AGENTS.md` before editing. Run `npm run gate:local:full` after any `src/` change.

# Goal

Implement the **BMC Liquid Glass hybrid design system** end-to-end: canonical documentation, shared token layer, accessibility fallbacks, hub chrome unification, calculator opaque-content rules, and a Cursor rule so all future agent sessions inherit the standard.

- **Research refresh:** Verify Apple docs + web best practices (2025–2026); append findings to `LIQUID-GLASS-WEB-GUIDE.md`.
- **Document:** Complete `DESIGN-SYSTEM.md` with real values from `constants.js` + `--ac-*` + blur matrix (where glass yes/no).
- **Token layer:** Add `--lg-*` aliases and `.chrome-glass` utility in shared CSS; `prefers-reduced-transparency` fallbacks.
- **Hub (Phase 2):** Apply consistent glass chrome to wolfboard shell + cotizaciones/WA/canales headers; keep tables opaque.
- **Calculator (Phase 3):** Keep wizard opaque; unify mobile nav blur via tokens; sticky wizard footer pattern; tablet input contrast.
- **Agent rule (Phase 4):** Create `.cursor/rules/bmc-visual-style.mdc`.
- **Verify:** `npm run gate:local:full`; grep audit for stray `backdrop-filter` on non-chrome elements.
- **Propagate:** One line in `docs/team/PROJECT-STATE.md` Cambios recientes.

# Scope

**IN:**

- Docs: `DESIGN-SYSTEM.md`, new `LIQUID-GLASS-WEB-GUIDE.md`, update `docs/team/design-competition/JURY-RECOMMENDATION.md` checkboxes
- CSS: `admin-cotizaciones/styles.css`, new `src/styles/bmc-design-system.css` (or extend existing), `bmc-mobile.css`
- Hub components: shell/topbar headers in wolfboard, cotizaciones, canales, WA (chrome only)
- Cursor rule: `.cursor/rules/bmc-visual-style.mdc`
- Optional: export token map JSON for mockup generator sync

**OUT:**

- Tailwind, shadcn, Radix, new npm UI deps
- Full rewrite of `PanelinCalculadoraV3_backup.jsx` styling
- PDF template visual changes (print rules differ)
- Deploy / Vercel / Cloud Run
- Glass on BOM rows, wizard form bodies, CRM table cells
- Mixing Regular + Clear glass variants on same screen

# Inputs

| Resource | Path / URL |
|----------|------------|
| Competition hub | `docs/team/design-competition/index.html` |
| Jury + phases | `docs/team/design-competition/JURY-RECOMMENDATION.md` |
| Trend research | `docs/team/design-competition/TREND-RESEARCH-2026.md` |
| Mockup tokens | `docs/team/design-competition/_shared/studio-themes.css` |
| Calculator tokens | `src/data/constants.js` |
| Hub glass (canonical) | `src/components/admin-cotizaciones/styles.css` |
| Skins | `src/components/admin-cotizaciones/SkinProvider.jsx` |
| Routes | `src/App.jsx` |
| Mobile styles | `src/styles/bmc-mobile.css` |
| Apple adoption guide | https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass |
| WWDC25 Liquid Glass | https://developer.apple.com/videos/play/wwdc2025/219/ |
| HIG Materials | https://developer.apple.com/design/human-interface-guidelines/materials |
| Applied AI (warm only) | `.claude/skills/applied-ai-design/SKILL.md` |
| Time-saving ops | `docs/bmc-dashboard-modernization/DESIGN-PROPOSAL-TIME-SAVING.md` |

# Tools & MCPs (Claude Code)

- **Read, Edit, Write, Grep, Glob:** primary workflow
- **Bash:** `npm run gate:local:full`, `npm run lint`, `rg 'backdrop-filter' src/`
- **WebFetch / WebSearch:** refresh Apple HIG if doc links stale
- **Browser (optional):** compare `localhost:5173/hub/cotizaciones` vs mockup `studio-1-tahoe/L3-hub-desktop.html`
- **NOT needed:** Sheets MCP, Vercel deploy, Supabase

**Claude Code session bootstrap:**

```bash
cd ~/calculadora-bmc
head -80 CLAUDE.md AGENTS.md
curl -s http://localhost:5173 >/dev/null 2>&1 || echo "Vite not running — optional for visual check"
curl -s http://localhost:3001/health >/dev/null 2>&1 || echo "API not running — OK for CSS-only work"
```

# Constraints & Guardrails

- **DO NOT** add Tailwind/shadcn or new CSS frameworks.
- **DO NOT** put `backdrop-filter` on wizard inputs, BOM tables, or hub data rows.
- **DO NOT** hardcode secrets, Sheet IDs, or production URLs in docs.
- **DO NOT** break existing 5 admin skins — extend, don't replace.
- **DO NOT** skip `npm run gate:local:full` before declaring done when `src/` changed.
- **DO** use `--lg-*` as semantic aliases over `--ac-*` (single source in admin-cot).
- **DO** implement web a11y fallbacks Apple provides natively:

```css
@media (prefers-reduced-transparency: reduce) {
  .chrome-glass, .adminCot__topbar {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: var(--ac-surface, #fff);
  }
}
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

- **DO** use Spanish operator labels in any new UI copy; USD for money.
- **DO** triangulate: competition mockups → existing `--ac-*` → Apple HIG → write DESIGN-SYSTEM.

# Anti-patterns

- **DO NOT** treat CSS glassmorphism as equivalent to native Liquid Glass — document as approximation.
- **DO NOT** use Clear variant without dimming layer under text. [CONFIRMED: WWDC25 Meet Liquid Glass]
- **DO NOT** duplicate hex values — reference tokens only.
- **DO NOT** glass the entire `.adminCot` wrapper — only `.chrome-glass` / topbar / modal chrome.
- **DO NOT** reference zombie `panelin-api-642127786762` service.
- **DO NOT** edit `PanelinCalculadoraV3.jsx` re-export — canonical component is `PanelinCalculadoraV3_backup.jsx`.

# Implementation plan (execute in order)

## Step 1 — Research doc (docs only)

Create `docs/bmc-dashboard-modernization/LIQUID-GLASS-WEB-GUIDE.md`:

- Apple Regular vs Clear decision tree for BMC
- Web CSS recipe (saturate + blur + border + fallback)
- Blur scale: nav 20px, modal 20–28px, floating chip 8–12px, **0px** on content
- Module matrix: which routes get glass (L0/L3 chrome) vs opaque (L1/L2)
- Accessibility checklist
- Epistemic tags on every claim

## Step 2 — Complete DESIGN-SYSTEM.md

Replace placeholder tables with values from:

- `C` object in `constants.js`
- `--ac-*` registry comment in `admin-cotizaciones/styles.css`
- Spacing/radii from competition `_shared/tokens-base.css`
- New section: **Liquid Glass (chrome layer)** with blur matrix
- Link to competition index + jury doc

## Step 3 — Shared token file

Create `src/styles/bmc-design-system.css`:

```css
:root {
  --lg-glass: var(--ac-glass, rgba(255,255,255,0.72));
  --lg-glass-strong: var(--ac-glass-strong, rgba(255,255,255,0.86));
  --lg-glass-clear: rgba(255,255,255,0.45); /* visor overlays only */
  --lg-blur-nav: 20px;
  --lg-blur-chip: 12px;
  --lg-saturate: 180%;
  --lg-border-glass: rgba(255,255,255,0.35);
}
.chrome-glass { /* canonical chrome class */ }
```

Import in hub entry points (wolfboard shell, admin-cot already has styles.css — avoid double blur; **extend** not duplicate).

## Step 4 — Hub chrome unification

Target files (grep `topbar`, `header`, `sticky`):

- Hub shell / wolfboard wrapper
- `src/components/hub/canales/CanalesModule.jsx` (already `data-skin`)
- WA module header
- Cotizaciones module (reuse `.adminCot__topbar` pattern where possible)

Apply class `chrome-glass` or existing `.adminCot__topbar` — **do not** change table/card interiors.

## Step 5 — Mobile + calculator touch-ups

- `src/styles/bmc-mobile.css`: replace raw `blur(12px)` with `var(--lg-blur-chip)` or solid on mobile per Responsive Lab mockup
- Calculator: **no new blur**; optional sticky footer class reuse from wizard patterns
- Tablet `@media (min-width: 768px)`: stronger input borders (Industrial) — 2px `#cfd8dc` or token

## Step 6 — Cursor rule

`.cursor/rules/bmc-visual-style.mdc`:

- globs: `src/**/*.jsx`, `src/**/*.css`
- agent_requestable or alwaysApply: false with description for UI tasks
- Points to DESIGN-SYSTEM.md + LIQUID-GLASS-WEB-GUIDE.md + competition README

## Step 7 — Audit + gate

```bash
rg 'backdrop-filter' src/ --glob '*.{jsx,css}' -n
# Expect: admin-cot, bmc-design-system, bmc-mobile, AuthGateModal, RoofPreview overlays — NOT wizard body
npm run gate:local:full
```

Fix any lint errors introduced.

# Deliverables

| # | Artifact | Path |
|---|----------|------|
| 1 | This master prompt | `goal-prompt-design-system-liquid-glass-implementation.md` |
| 2 | Web implementation guide | `docs/bmc-dashboard-modernization/LIQUID-GLASS-WEB-GUIDE.md` |
| 3 | Completed design system | `docs/bmc-dashboard-modernization/DESIGN-SYSTEM.md` |
| 4 | Shared CSS tokens | `src/styles/bmc-design-system.css` |
| 5 | Hub/mobile CSS updates | `admin-cotizaciones/styles.css`, `bmc-mobile.css` (minimal diffs) |
| 6 | Hub chrome (if needed) | 1–3 hub component files — chrome class only |
| 7 | Cursor rule | `.cursor/rules/bmc-visual-style.mdc` |
| 8 | Audit log | `docs/team/design-competition/IMPLEMENTATION-AUDIT.md` (backdrop-filter grep results) |
| 9 | PROJECT-STATE | one Cambios recientes line |

# Success Criteria (Claude Code self-verify)

- [ ] `DESIGN-SYSTEM.md` has **no empty "—" placeholders** in color/type tables
- [ ] `LIQUID-GLASS-WEB-GUIDE.md` cites ≥3 Apple/developer sources with `[CONFIRMED]` tags
- [ ] `--lg-*` tokens exist and map to `--ac-*` without value drift
- [ ] `@media (prefers-reduced-transparency: reduce)` present for all glass selectors
- [ ] `rg backdrop-filter src/components/PanelinCalculadoraV3_backup.jsx` → **0 matches** (or only documented overlay exceptions)
- [ ] Hub cotizaciones topbar uses same glass recipe as `.adminCot__topbar`
- [ ] `npm run gate:local:full` exits 0
- [ ] `.cursor/rules/bmc-visual-style.mdc` exists and links canonical docs
- [ ] JURY-RECOMMENDATION.md Phase 0–4 checkboxes updated to reflect completion

# Operational Anchors

- Source hierarchy: planilla (operational) > repo code > docs > legacy dashboards
- State labels in audit doc: `hecho confirmado` / `inferencia` / `duda abierta`
- Read-only: master prices, fiscal tabs, parámetros — this task is UI tokens only
- Commit message prefix: `feat(design):` or `docs(design):` — **ask user before git commit**

# Claude Code execution notes

1. **One phase per commit** (optional): docs first, then CSS, then hub JSX — easier review.
2. **Max diff discipline:** prefer extending `admin-cotizaciones/styles.css` over new parallel systems.
3. **Visual check:** if `:5173` up, spot-check `/hub/cotizaciones` + `/` calculator wizard — chrome vs content separation.
4. **If blocked on hub shell file location:** grep `BmcWolfboardHub` / `Shell` in `src/components/hub/`.
5. **Do not ask user** unless choosing between irreversible brand direction (Warm-only vs Tahoe hybrid) — default: **Tahoe hybrid per jury**.

# Open Items

- [ASSUMPTION: default skin remains `macos` in SkinProvider | verify with stakeholder]
- [ASSUMPTION: new `bmc-design-system.css` imported via hub Shell component, not global App.jsx unless needed]
- [ASSUMPTION: RoofPreview floating chips may use `--lg-glass-clear` + dimming overlay — document in guide before editing RoofPreview.jsx]
- [ASSUMPTION: iOS 26 Liquid Glass App Store deadline (Sept 2026) is context only — BMC is web SPA, not native iOS app]

# Prior goal (Phase 0 — reference only)

Competition orchestration prompt: `goal-prompt-design-competition-five-studios.md` — **complete**. Do not regenerate mockups unless `PROGRESS.md` < 100%.

**Pipe this prompt:**

```bash
cd ~/calculadora-bmc && claude -p < goal-prompt-design-system-liquid-glass-implementation.md
```
