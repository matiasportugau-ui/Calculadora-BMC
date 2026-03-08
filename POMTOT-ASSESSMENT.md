# Pomtot Assessment — Calculadora BMC Panelin v3.0

**Agent:** Pomtot v1.0
**Date:** March 8, 2026
**Scope:** Full workspace review · 6 source files · 13 docs · 1 test suite · CI pipeline
**Project:** Calculadora de cotización de paneles BMC Uruguay (METALOG SAS)

---

## 1. Project Orientation

### What
Real-time construction quotation calculator for thermal and acoustic insulation panels. Generates complete Bills of Materials (BOM), PDF quotations, and WhatsApp summaries for roofing and wall insulation projects.

### Who
- **Client:** BMC Uruguay / METALOG SAS (Maldonado, Uruguay)
- **End users:** BMC sales representatives generating quotations for construction contractors
- **Market:** Uruguayan construction industry, specifically thermal/acoustic insulation

### How
| Aspect | Implementation |
|--------|---------------|
| Pattern | Single-page React app, modular file structure (v3.0) |
| State | React `useState` only — no external state, no persistence |
| Data flow | User inputs → `useMemo` → calculation engines → BOM → UI/PDF/WhatsApp |
| Pricing | Dual-list (`venta`/`web`) resolved by `p(item)`, all pre-VAT |
| Styling | 100% inline styles with design tokens |

### Where
| Target | Status |
|--------|--------|
| Vercel | Configured (`vercel.json`) |
| Docker | Configured (Dockerfile, Node 20 + Nginx 1.27) |
| Static hosting | Any HTTP server serving `dist/` |
| Claude.ai artifacts | Historical origin, single-file compatibility maintained |

### Why (Key Design Constraints)
1. **No external APIs** — Offline-first, no CORS, no latency dependencies
2. **No localStorage** — Originally designed for Claude.ai artifact sandbox
3. **Hardcoded prices** — Versionable, auditable pricing (updated from BROMYROS matrix)
4. **Inline styles** — No CSS build step dependency, artifact portability
5. **Math.ceil everywhere** — Construction materials must round up (never short on materials)

---

## 2. Environment Audit

### Development
| Aspect | Status | Notes |
|--------|--------|-------|
| Dev server | Vite 5 on `0.0.0.0:5173` | Hot reload via `@vitejs/plugin-react` |
| Entry point | `index.html` → `main.jsx` → `App.jsx` → `PanelinCalculadoraV3.jsx` | Clean chain |
| DX quality | Medium | No TypeScript, no auto-formatting, no pre-commit hooks |
| Local setup | `npm ci && npm run dev` | Simple, documented |

### Testing
| Aspect | Status | Notes |
|--------|--------|-------|
| Framework | Plain Node.js (`node tests/validation.js`) | No test runner |
| Assertions | 63 across 14 suites | Good breadth, limited depth |
| Coverage | ~40% of business logic | `calcPerfilesU`, `calcEsquineros`, integration tests missing |
| CI integration | Runs on push/PR | Blocks merge on failure |
| Watch mode | None | Must run manually |

### Linting / Quality
| Aspect | Status | Notes |
|--------|--------|-------|
| ESLint | v9 flat config | React, hooks, refresh plugins |
| Rules | `no-unused-vars: warn`, hooks rules enforced | Conservative |
| Formatting | None configured | No Prettier, no `.editorconfig` |
| Type safety | None | No TypeScript, no JSDoc types |

### Build
| Aspect | Status | Notes |
|--------|--------|-------|
| Tool | Vite 5 | Fast, modern |
| Output | `dist/` static files | Standard SPA output |
| Optimizations | Vite defaults | No custom chunk strategy, no bundle analysis |
| Source maps | Vite defaults | Production source maps not explicitly configured |

### CI/CD
| Aspect | Status | Notes |
|--------|--------|-------|
| Platform | GitHub Actions | 2 jobs: `validate` + `lint` |
| Triggers | Push to `main`/`develop`, PR to `main` | Good coverage |
| Node cache | `npm` cache enabled | Fast installs |
| Deployment | Manual (`vercel --prod` or Docker build) | No automated deploy pipeline |
| Monitoring | None | No error tracking, no analytics |

### Documentation
| Aspect | Status | Notes |
|--------|--------|-------|
| Coverage | Excellent | 13 markdown files covering every subsystem |
| Language | Spanish | Appropriate for the team/client |
| Accuracy | High (v3.0 current) | Some items resolved since EVALUATION_REPORT |
| Developer onboarding | Good | README + CONTRIBUTING + ARCHITECTURE |

---

## 3. Rating Scorecard

| # | Dimension | Weight | Score | Weighted | Justification |
|---|-----------|--------|-------|----------|---------------|
| 1 | **Architecture** | 15% | 7.5 | 1.13 | Clean modular split (data/utils/components). Calculation engines are pure functions. Single global mutable state (`LISTA_ACTIVA`) is the main design flaw. |
| 2 | **Code Quality** | 15% | 7.0 | 1.05 | Well-structured, consistent conventions (`Math.ceil`, `p()`, `toFixed(2)`). Some dead code (unused imports), override UI built but not wired. |
| 3 | **Test Coverage** | 12% | 5.5 | 0.66 | 63 assertions across 14 suites cover core formulas. Missing integration tests, error paths, and combined scenarios. No test runner framework. |
| 4 | **Documentation** | 10% | 9.0 | 0.90 | 13 detailed docs in Spanish covering architecture, each engine, pricing, deployment, changelog. Among the best-documented projects at this scale. |
| 5 | **Data Integrity** | 12% | 7.0 | 0.84 | Single source of truth via `constants.js` + `p()`. SKU inconsistencies exist (BUG-05). Some pricing anomalies unverified (BUG-06). |
| 6 | **UX Completeness** | 10% | 5.5 | 0.55 | Core flow works. Tabs are cosmetic (BUG-02), override UI unimplemented (BUG-03), combined scenario has selector/KPI bugs. No mobile optimization. |
| 7 | **CI/CD** | 8% | 7.0 | 0.56 | Solid validate+lint pipeline. Missing: automated deployment, coverage reports, dependency auditing. |
| 8 | **Security** | 8% | 7.5 | 0.60 | No backend = reduced attack surface. Clipboard error handling missing. `document.write` used in PDF (XSS risk in theory). No secrets in repo. |
| 9 | **Performance** | 5% | 8.0 | 0.40 | Tiny bundle (React + lucide only). All computation is local and synchronous. No unnecessary re-renders detected. Inline styles avoid CSS payload. |
| 10 | **Maintainability** | 5% | 6.5 | 0.33 | Good file organization post-v3 refactor. No TypeScript makes large changes risky. Contributing guide helps onboarding. Global mutable state complicates testing. |

### Composite Score

| Metric | Value |
|--------|-------|
| **Weighted Total** | **7.02 / 10** |
| **Grade** | **B** (Solid foundation, needs targeted fixes before production) |
| **Trend** | Improving (v3.0 refactor addressed major structural issues from v2) |

---

## 4. FODA Analysis

### Fortalezas (Strengths)

| # | Fortaleza | Evidence | Impact |
|---|-----------|----------|--------|
| F1 | **Pure calculation engines** — All calc functions are deterministic, side-effect-free | `src/utils/calculations.js` — 359 lines of pure functions | High |
| F2 | **Exceptional documentation** — 13 files covering every subsystem in detail | `docs/` directory, `README.md`, `CONTRIBUTING.md` | High |
| F3 | **Single source of truth for pricing** — All prices flow through `p(item)` | `src/data/constants.js:32-36` — pricing engine | High |
| F4 | **Offline-first architecture** — No APIs, no network dependency, instant results | Zero `fetch` calls in codebase | Medium |
| F5 | **Dual pricing system** — Seamless BMC/Web price switching | `LISTA_ACTIVA` toggle with full BOM recalculation | Medium |
| F6 | **Comprehensive BOM output** — PDF, WhatsApp, and UI views of same data | `src/utils/helpers.js` — three output formats | Medium |
| F7 | **CI pipeline catches regressions** — Tests + lint run on every push/PR | `.github/workflows/ci.yml` — 2 parallel jobs | Medium |
| F8 | **Domain-accurate formulas** — 31 real quotations validated against LibreOffice original | `docs/CHANGELOG.md` — v1.x validation history | High |

### Oportunidades (Opportunities)

| # | Oportunidad | Evidence | Impact | Actionability |
|---|-------------|----------|--------|---------------|
| O1 | **TypeScript migration** — Eliminate runtime type errors, improve IDE support | No `.ts` files exist; all data structures are implicit | High | Long-term |
| O2 | **Vitest adoption** — Watch mode, coverage reports, better DX | `tests/validation.js` uses manual `assert()` pattern | Medium | Short-term |
| O3 | **Client data persistence** — Save quotation drafts for returning users | No `localStorage` currently (artifact constraint lifted in v3) | High | Short-term |
| O4 | **Multi-quotation comparison** — Let users compare 2-3 panel options side by side | Single quotation flow only | High | Long-term |
| O5 | **API integration for live pricing** — Connect to Shopify/ERP for real-time prices | Prices hardcoded, updated manually from BROMYROS matrix | Medium | Long-term |
| O6 | **Mobile-first redesign** — Capture field sales use case (contractors on-site) | Inline styles don't include responsive breakpoints | High | Short-term |
| O7 | **Automated deployment** — Add Vercel/Netlify auto-deploy on `main` push | Manual `vercel --prod` currently | Medium | Immediate |
| O8 | **PDF to actual file** — Generate downloadable PDF instead of print popup | Uses `window.open` + `document.write` pattern | Medium | Short-term |
| O9 | **Analytics / usage tracking** — Understand which panels/scenarios are most quoted | No telemetry exists | Low | Long-term |
| O10 | **i18n readiness** — UI is Spanish-only; could expand to Portuguese (Brazil market) | All strings hardcoded in Spanish | Low | Long-term |

### Debilidades (Weaknesses)

| # | Debilidad | Evidence | Impact | Actionability |
|---|-----------|----------|--------|---------------|
| D1 | **Global mutable state** — `LISTA_ACTIVA` is a module-level `let`, makes testing fragile | `src/data/constants.js:30` — `export let LISTA_ACTIVA = "web"` | High | Short-term |
| D2 | **Override UI is built but not wired** — Feature fully coded, never exposed to users | `src/utils/helpers.js:9-18` — `applyOverrides` exists, `TableGroup` never receives props | High | Immediate |
| D3 | **Progress tabs are decorative** — `activeStep` state changes but no content is filtered | `src/components/PanelinCalculadoraV3.jsx` — `useState(0)` for tabs | Medium | Short-term |
| D4 | **Combined scenario (techo_fachada) has multiple bugs** — Panel selector, KPIs, PDF all show incomplete data | BUG-02, CQ-01, CQ-02, CQ-03 in `EVALUATION_REPORT.md` | High | Short-term |
| D5 | **Test coverage at ~40%** — Integration tests, error paths, and combined scenarios untested | `tests/validation.js` — 63 assertions but major gaps | Medium | Short-term |
| D6 | **SKU inconsistencies** — Multiple entries share SKUs with different prices | BUG-05 in `EVALUATION_REPORT.md` — 4 confirmed mismatches | Low | Immediate |
| D7 | **No input validation layer** — User can enter negative dimensions, extreme values | No `validateTechoInputs()` or similar guards | Medium | Short-term |
| D8 | **No error boundary** — React errors crash the entire app | No `ErrorBoundary` component | Medium | Short-term |
| D9 | **`document.write` in PDF** — Deprecated pattern, CSP-incompatible | `src/utils/helpers.js:82` — `w.document.write(html)` | Low | Short-term |
| D10 | **No pre-commit hooks** — Code can be committed without passing lint/tests | No `.husky/` or `lint-staged` config | Low | Immediate |

### Amenazas (Threats)

| # | Amenaza | Evidence | Impact | Actionability |
|---|---------|----------|--------|---------------|
| A1 | **Price data staleness** — Hardcoded prices drift from actual BROMYROS matrix | `constants.js` prices last updated v3.0 (March 2026) | High | Ongoing |
| A2 | **Single developer bus factor** — CODEOWNERS shows one owner (`@matiasportugau-ui`) | `.github/CODEOWNERS` — single person | High | Long-term |
| A3 | **React 18 EOL** — React 18 will eventually lose support as React 19+ evolves | `package.json` — `react: ^18.2.0` | Low | Long-term |
| A4 | **No monitoring in production** — Errors or pricing bugs go undetected | No Sentry, LogRocket, or similar | Medium | Short-term |
| A5 | **Competitor tooling** — Other panel companies may adopt digital quotation tools | Market observation | Medium | Long-term |
| A6 | **Dependency vulnerabilities** — No automated audit in CI | `npm audit` not in pipeline | Medium | Immediate |
| A7 | **Browser compatibility** — Inline styles + modern JS without polyfills may break on older browsers | No `browserslist`, no Babel config for legacy | Low | Long-term |

---

## 5. Evolving Queries

### Tier 1 — Foundational (Answer Now)

| # | Query | Who Should Answer | Context |
|---|-------|-------------------|---------|
| Q1 | **Are the 4 SKU mismatches (BUG-05) data entry errors or intentional catalog decisions?** | BMC product manager | Affects PDF quotation accuracy — `GF120DC` used for both 80mm and 120mm ISODEC |
| Q2 | **Are the 3 pricing anomalies (web < venta) intentional?** | BMC commercial team | `tuerca_38`, `arandela_carrocero`, `anclaje_h` all have web prices 42-67% cheaper than venta |
| Q3 | **Should the override UI (manual BOM editing) be activated?** | Product owner | The feature is fully built (`applyOverrides` in helpers.js) but never wired to the UI |
| Q4 | **Is the `techo_fachada` combined scenario actively used by sales reps?** | BMC sales team | Multiple bugs exist (panel selector, KPIs, PDF) — if unused, can deprioritize fixes |

### Tier 2 — Tactical (Answer This Sprint)

| # | Query | Who Should Answer | Context |
|---|-------|-------------------|---------|
| Q5 | **Should we implement client data persistence (localStorage)?** | Product owner | The artifact constraint is gone in v3; quotation drafts could be saved locally |
| Q6 | **What is the mobile usage percentage for this calculator?** | Analytics / BMC team | No responsive breakpoints exist — if field reps use phones, this is a critical gap |
| Q7 | **Should the progress tabs filter content or be removed?** | UX designer / PM | Currently decorative (BUG-02) — two valid solutions, need direction |
| Q8 | **Is there an ERP or Shopify API that could replace hardcoded pricing?** | BMC IT / developer | Eliminates price staleness threat (A1) but introduces API dependency |
| Q9 | **Should we add `npm audit` to the CI pipeline?** | Developer | Zero cost, catches known vulnerabilities in `lucide-react` and transitive deps |

### Tier 3 — Strategic (Answer This Quarter)

| # | Query | Who Should Answer | Context |
|---|-------|-------------------|---------|
| Q10 | **Is TypeScript migration worth the effort for this team size?** | Lead developer | Improves maintainability (D1 category) but adds build complexity |
| Q11 | **Should quotations be storable in a backend (multi-device, history)?** | Product owner + BMC | Transforms from calculator to quotation management system |
| Q12 | **Is there appetite for a comparison mode (2-3 panels side by side)?** | BMC sales team | Common request in construction quotation tools |
| Q13 | **Should the calculator be embedded in bmcuruguay.com.uy?** | BMC marketing | Currently standalone — integration could drive leads |
| Q14 | **What is the plan for React 19 migration?** | Developer | Not urgent but should be on the roadmap |
| Q15 | **Can BROMYROS price updates be automated via a shared spreadsheet or API?** | BMC operations | Current manual process is the top staleness risk |

---

## 6. Recommended Action Plan

### Immediate (This Week)

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| P0 | Wire override UI — pass `onOverride`/`onRevert` to `TableGroup` | 3h | Unlocks a fully built feature |
| P0 | Add `npm audit --production` to CI pipeline | 15m | Closes threat A6 |
| P0 | Add pre-commit hook (husky + lint-staged) | 30m | Prevents broken commits |
| P1 | Confirm SKU mismatches with BMC catalog (Q1) | 30m | Closes BUG-05 |
| P1 | Confirm pricing anomalies with BMC (Q2) | 30m | Closes BUG-06 |

### Short-Term (This Sprint, 2 Weeks)

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| P1 | Fix `techo_fachada` combined scenario (D4) — panel selector, KPIs, PDF | 6h | Unblocks a major use case |
| P1 | Implement tab-based content filtering or remove decorative tabs (D3) | 2h | UX clarity |
| P1 | Add input validation layer with error messages (D7) | 3h | Prevents nonsensical quotations |
| P1 | Add `ErrorBoundary` component (D8) | 1h | Graceful failure instead of white screen |
| P2 | Eliminate global `LISTA_ACTIVA` — make `p()` accept `lista` parameter (D1) | 4h | Pure functions, testable engines |
| P2 | Migrate to Vitest (O2) | 3h | Watch mode, coverage, better DX |
| P2 | Add integration tests for `calcTechoCompleto` and `calcParedCompleto` (D5) | 3h | Covers critical paths |

### Long-Term (This Quarter)

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| P2 | Mobile responsive redesign (O6) | 2-3 days | Field sales enablement |
| P2 | Replace `document.write` with Blob URL pattern (D9) | 2h | Modern, CSP-compatible |
| P3 | TypeScript migration (O1) | 1 week | Long-term maintainability |
| P3 | Automated Vercel deployment on `main` push (O7) | 1h | CI/CD completeness |
| P3 | Client data persistence with localStorage (O5) | 4h | Quotation drafts |

---

## 7. Score Evolution Tracking

Use this table to track score changes across Pomtot reassessments:

| Dimension | v1 (Mar 8, 2026) | v2 | v3 | Trend |
|-----------|-------------------|----|----|-------|
| Architecture | 7.5 | — | — | — |
| Code Quality | 7.0 | — | — | — |
| Test Coverage | 5.5 | — | — | — |
| Documentation | 9.0 | — | — | — |
| Data Integrity | 7.0 | — | — | — |
| UX Completeness | 5.5 | — | — | — |
| CI/CD | 7.0 | — | — | — |
| Security | 7.5 | — | — | — |
| Performance | 8.0 | — | — | — |
| Maintainability | 6.5 | — | — | — |
| **Composite** | **7.02** | — | — | — |

---

*Assessment generated by Pomtot v1.0 — Strategic Project Assessment Agent*
