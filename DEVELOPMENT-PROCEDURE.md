# Development Procedure — Panelin Ecosystem

**Author:** Pomtot Assessment Agent
**Date:** March 8, 2026
**For:** Matias Portugau — BMC Uruguay Development

---

## The Problem You Have

You have multiple systems (Calculadora-BMC on Vercel, GPT-PANELIN, chatbots) that each store their own copy of prices, rules, and knowledge. When something needs to change, you don't have a clear workflow. Here is the procedure to fix that, permanently.

---

## Part 1 — Understanding the Architecture of Your Problem

### Current State (what causes the confusion)

```
BROMYROS Matrix (source of truth — Excel/PDF from supplier)
     │
     ├──→ constants.js (Calculadora-BMC) ← hardcoded, manual copy
     │        deployed on Vercel, frozen until next push
     │
     ├──→ GPT Knowledge Base (GPT-PANELIN) ← separate copy
     │        uploaded to OpenAI, frozen until next upload
     │
     └──→ Your memory ← the only place that knows everything
              you are the sync mechanism (this is why you feel lost)
```

**You are the single point of failure.** Every price, every rule, every panel spec lives in your head as the only bridge between systems. When you forget one, things drift.

### Target State (what we are building)

```
SINGLE SOURCE OF TRUTH
     │
     panelin-data.json (one file, one format, one location)
     │
     ├──→ constants.js (auto-generated) → Vercel auto-deploy
     ├──→ GPT knowledge base (auto-generated) → OpenAI upload
     └──→ Validation suite (auto-runs) → catches errors before deploy
```

**The key shift:** Instead of manually editing each system, you edit ONE file and the system propagates the change everywhere.

---

## Part 2 — The Update Procedure (Use This Today)

Even before building the automated pipeline, follow this procedure every time you need to update anything.

### Step 1 — Capture Your Intent

Before touching any code, write down WHAT you want to change and WHY. Create an issue or write it in a file.

```
WHAT: Update ISODEC EPS 100mm price from 45.97 to 48.50 (web)
WHY:  BROMYROS price update received March 8, 2026
WHERE: constants.js line 48, GPT knowledge base
RISK: Affects all quotations using ISODEC EPS 100mm
```

This is not bureaucracy — this is how you stop losing track. One sentence for each of WHAT / WHY / WHERE / RISK.

### Step 2 — Edit the Source

In `src/data/constants.js`, find the item and change it:

```javascript
// src/data/constants.js — ISODEC EPS, espesor 100
100: { venta: 37.76, web: 48.50, costo: 33.93, ap: 5.5 },
//                          ^^^^^ changed from 45.97
```

### Step 3 — Validate Locally

Run these three commands in sequence:

```bash
# 1. Run the test suite — must pass
npm test

# 2. Run linting — must have 0 errors
npm run lint

# 3. Build — must succeed
npm run build
```

If any of these fail, fix the problem BEFORE proceeding. Never skip validation.

### Step 4 — Visual Verification

Start the dev server and manually verify:

```bash
npm run dev
```

Check in the browser:
- [ ] Select the affected panel family
- [ ] Select the affected espesor
- [ ] Verify the price shows the new value
- [ ] Switch between Precio BMC and Precio Web
- [ ] Check that the PDF shows the correct price
- [ ] Check that the total (subtotal + IVA) makes sense

### Step 5 — Commit with a Clear Message

```bash
git add src/data/constants.js
git commit -m "prices: update ISODEC EPS 100mm web price to 48.50 (BROMYROS March 2026)"
```

Use the commit convention from CONTRIBUTING.md:
- `prices:` for price updates
- `fix:` for bug fixes
- `feat:` for new features

### Step 6 — Push and Deploy

```bash
git push origin main
```

If Vercel is connected to your GitHub repo, it auto-deploys on push to `main`.
If not, run: `npx vercel --prod`

### Step 7 — Verify Production

Open the Vercel URL and repeat the visual checks from Step 4 on the live site.

### Step 8 — Update Related Systems

If GPT-PANELIN uses the same data:
1. Update the corresponding knowledge base file
2. Re-run `scripts/validate_gpt_files.py`
3. Re-upload to OpenAI

---

## Part 3 — The Error Identification Procedure

When you suspect something is wrong but aren't sure what, follow this diagnostic flow.

### Level 1 — Identify the Symptom

| Symptom | Likely Cause | Where to Look |
|---------|-------------|---------------|
| Wrong price in quotation | Price data in `constants.js` | §3 or §4 in constants.js |
| Wrong quantity of materials | Calculation formula | `calculations.js` |
| Missing panel or espesor | Data not in constants | §3/§4 in constants.js |
| PDF shows wrong info | PDF generator | `helpers.js` → `generatePrintHTML` |
| Feature doesn't work | UI wiring issue | `PanelinCalculadoraV3.jsx` |
| Test fails after change | Regression | `tests/validation.js` |

### Level 2 — Locate the Exact File and Line

Use this mapping:

| Data Type | File | Section |
|-----------|------|---------|
| Panel prices | `src/data/constants.js` | `PANELS_TECHO` or `PANELS_PARED` |
| Fixing prices | `src/data/constants.js` | `FIJACIONES` |
| Sealant prices | `src/data/constants.js` | `SELLADORES` |
| Profile prices | `src/data/constants.js` | `PERFIL_TECHO` or `PERFIL_PARED` |
| Calculation formulas | `src/utils/calculations.js` | Function matching the calc type |
| BOM grouping | `src/utils/helpers.js` | `bomToGroups()` |
| PDF output | `src/utils/helpers.js` | `generatePrintHTML()` |
| UI behavior | `src/components/PanelinCalculadoraV3.jsx` | Search for the state/feature name |
| Design tokens | `src/data/constants.js` | §1 `C`, `FONT`, `SHC` |

### Level 3 — Fix, Test, Deploy

Follow Steps 2–7 from Part 2 above.

---

## Part 4 — Cross-Project Synchronization Checklist

Every time you make a change to the Calculadora-BMC, ask yourself these questions:

### Data Changes (prices, panels, espesores)

- [ ] Did I update `constants.js`?
- [ ] Do the tests still pass? (`npm test`)
- [ ] Does the GPT-PANELIN knowledge base need the same update?
- [ ] Is the OpenAPI spec still accurate? (`docs/openapi.yaml` in GPT-PANELIN)

### Formula Changes (calculation logic)

- [ ] Did I update `calculations.js`?
- [ ] Did I add or update a test in `validation.js`?
- [ ] Is the corresponding doc still accurate? (`docs/CALC-TECHO.md` or `docs/CALC-PARED.md`)
- [ ] Does the GPT need to know about this formula change?

### UI Changes (new features, layout)

- [ ] Did I update `PanelinCalculadoraV3.jsx`?
- [ ] Is `docs/UI-COMPONENTS.md` still accurate?
- [ ] Does the GPT assistant need to know about new UI capabilities?

### Deployment Changes

- [ ] Did CI pass? (Check GitHub Actions)
- [ ] Did Vercel deploy succeed?
- [ ] Did I verify the live URL?

---

## Part 5 — The Empathic Intent System

This is the system that understands YOUR intentions and helps you decide what to do next.

### How to Use It

Before each development session, answer these three questions:

**1. What is broken right now?**
List concrete problems: wrong prices, broken features, missing data.

**2. What should I improve?**
List things that work but could be better: UX, performance, coverage.

**3. What is my goal for this session?**
One sentence: "Fix the ISODEC 100mm price and add the new ISOROOF 120mm espesor."

### Priority Matrix

Plot every task on this grid:

```
                    HIGH IMPACT
                        │
           ┌────────────┼────────────┐
           │  DO FIRST   │  SCHEDULE  │
           │  (broken    │  (improves │
           │   prices,   │   revenue, │
           │   wrong     │   but not  │
           │   formulas) │   broken)  │
    LOW ───┼────────────┼────────────┤─── HIGH
   EFFORT  │  DO QUICK   │  DELEGATE  │  EFFORT
           │  (typos,    │  OR SKIP   │
           │   labels,   │  (full     │
           │   small     │   rewrite, │
           │   fixes)    │   nice to  │
           │             │   have)    │
           └────────────┼────────────┘
                        │
                    LOW IMPACT
```

### Current Priority Queue (from Pomtot Assessment)

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| DO FIRST | Confirm/fix SKU mismatches with BMC catalog | 30 min | Fixes wrong PDF SKUs |
| DO FIRST | Confirm/fix pricing anomalies (web < venta) | 30 min | Fixes potential revenue loss |
| DO QUICK | Add pre-commit hook (husky) | 30 min | Prevents broken deploys |
| DO QUICK | Add `npm audit` to CI | 15 min | Security baseline |
| SCHEDULE | Fix techo_fachada combined scenario | 6 hours | Unblocks major use case |
| SCHEDULE | Wire override UI | 3 hours | Unlocks built feature |
| SCHEDULE | Mobile responsive redesign | 2-3 days | Field sales enablement |

---

## Part 6 — Quick Reference Commands

### Daily Development

```bash
# Start working
cd "/Users/matias/Panelin calc loca/Calculadora-BMC"
git pull                    # Get latest from remote
npm run dev                 # Start dev server

# Before committing
npm test                    # Run validation (must pass)
npm run lint                # Run linting (0 errors)
npm run build               # Build check (must succeed)

# Commit and deploy
git add .
git commit -m "prices: description of change"
git push origin main        # Triggers Vercel auto-deploy
```

### Finding Things

```bash
# Find a price
grep -n "45.97" src/data/constants.js

# Find a calculation function
grep -n "function calc" src/utils/calculations.js

# Find where a panel is defined
grep -n "ISODEC_EPS" src/data/constants.js
```

### Verifying Production

After deploying, always check the live Vercel URL to confirm:
1. The app loads without errors
2. Changed prices show correctly
3. Calculations produce reasonable results

---

## Summary — Your Development Workflow in 3 Minutes

```
1. INTENT    → Write down WHAT you want to change and WHY
2. EDIT      → Change the source file (constants.js, calculations.js, etc.)
3. VALIDATE  → npm test && npm run lint && npm run build
4. VERIFY    → npm run dev → check in browser
5. COMMIT    → git commit with clear message using conventions
6. DEPLOY    → git push → Vercel auto-deploys
7. CONFIRM   → Check live URL
8. SYNC      → Update GPT/other systems if needed
```

When in doubt, run Pomtot (`POMTOT-ASSESSMENT.md`) to get a fresh scorecard and priority queue.

---

*Procedure designed by Pomtot v1.0 — Development Methodology for Panelin Ecosystem*
