# Production Audit — Logística / Envíos

**Date:** 2026-08-10 (~03:10–03:13 UTC)  
**Auditor:** Grok (live MCP: Playwright + Panelin HTTP)  
**Primary UI:** https://calculadora-bmc.vercel.app/logistica  
**API:** https://panelin-calc-q74zutv7dq-uc.a.run.app  

| Field | Value |
|-------|--------|
| API version | 3.1.5 (`gitSha` `9039b284…`) |
| UI load | Vercel `/logistica` → **200** (~170 ms) |
| Cloud Run SPA | `/logistica` & `/calculadora/logistica` → **404** |
| Overall | **🟡 Degraded** — shell & packing UX OK; data pipeline quality + chip semantics weak |

Evidence screenshots (session cwd):
- `logistica-prod-audit.png` — empty draft shell
- `logistica-prod-ventas-loaded.png` — after **Cargar actuales**

---

## Summary

| Severity | Count | Theme |
|----------|------:|-------|
| 🔴 Critical | 0 | No hard outage of `/logistica` on Vercel |
| 🟠 High | 3 | Chip dates, API junk filter, Cloud Run SPA 404 |
| 🟡 Medium | 4 | Dup IDs, empty próximas-entregas, geocode auth, residual junk in UI |
| 🟢 Low / backlog | 4 | Sheet data quality, console 401 noise, CBM/TSP, conflict UI |

**Operator can use Logística today** (search Ventas, cloud draft, truck diagram, remito tabs).  
**Cannot trust** coordination chips, API `?logistica=1` consumers, or Cloud Run as UI host.

---

## What works (live)

| Check | Evidence |
|-------|----------|
| SPA boots | Title *Calculadora BMC*, h1 *BMC Uruguay — Logística de Carga* |
| ENV draft | `ENV-260810-001 · 2026-08-10`, autosave **Cloud rev N · ✓** |
| Cloud draft write | `PUT …/api/envios/drafts/ENV-260810-001` → **200** (from browser) |
| Ventas CSV load | **Cargar actuales** → *184 filas leídas · 23 operativas* (client-side junk filter) |
| Result cards | Cliente, `#pedido`, chip, dir/tel, **+ Parada**, PDF when link exists |
| Tabs / packing UI | Detalle / Remito / Diagrama 3D, camión 6–14 m, strategies, isométrica |
| Module nav | Wolfboard, Calculadora, Logística, etc. |
| API health | `/health` allOk; Sheets tabs present |
| Tabs list | `GET /api/ventas/tabs` includes *Ventas y Coordinaciones* |

---

## Issues found

### 1. [🟠 High] Chips de coordinación casi siempre “POR COORDINAR”

**Description:** After load, every visible card showed **POR COORDINAR**, including rows with dates like `07/08`, `22/05`, `24/07`.

**Root cause (code):** `classifyVentasCoordination` only treats `fechaEntrega` as coordinated when it matches **strict ISO** `YYYY-MM-DD`:

```js
const coordDateIso = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
```

Sheet reality is `dd/mm`, free text (`Falta pagar la seña`, `Coordinar`, `Mayo / Junio`).

**Expected:** `07/08` → Coordinado · 07/08 (batch color).  
**Actual:** Por coordinar for all date-like strings.

**Fix:** Parse `dd/mm`, `dd/mm/yy`, `dd/mm/yyyy` (assume current year if missing); optional fuzzy “coordinad*” in estado; keep non-dates (seña/stock) as por_coordinar. Tests in `coordinationStatus` / ventasSearch.

---

### 2. [🟠 High] `GET /api/ventas?logistica=1` leaks header / garbage rows

**Description:** Server filter `ventasRowIsLogisticaRow` only drops empty / “semana del” / “origen”. Live payload includes:

- Repeated header clones: `COTIZACION_ID: "ID. Pedido"`, `CLIENTE_NOMBRE: "NOMBRE"`
- Cell with **Python** `import pandas as pd…` in `FECHA_ENTREGA`
- Labels as IDs: `Encargar`
- Note rows as clients

**Stats (tab Ventas y Coordinaciones, logistica=1):** ~38 rows → ~16 junk / ~22 good under a stricter filter.  
**UI is better** (184→23) but API still pollutes any other consumer (Panelin tools, dashboards).

**Fix:** Harden `ventasRowIsLogisticaRow` (+ unit tests):

- Reject if id ∈ `{ID. Pedido, ID Pedido, COTIZACION_ID}` or name ∈ `{NOMBRE, Nombre}`
- Reject if name/fecha contains `import pandas`, multi-line code, “escaneo de CI”, etc.
- Prefer id matching `\d{5,}` **or** non-empty name with at least one of tel/dir/fecha/carpeta
- Optionally reject pure instructional rows

---

### 3. [🟠 High] Cloud Run does not serve Logística SPA

| URL | Status |
|-----|--------|
| `https://calculadora-bmc.vercel.app/logistica` | **200** |
| `https://panelin-calc-…run.app/logistica` | **404** |
| `https://panelin-calc-…run.app/calculadora/logistica` | **404** |

**Impact:** Operators / docs that point at Cloud Run for UI get a dead link; only API is reliable there.

**Fix options:**
1. **Docs/nav:** Canonical UI = Vercel; Cloud Run = API only (quick).
2. **Deploy:** Restore SPA static + fallback for `/logistica` on Cloud Run (align with older v3.1.3 notes).

---

### 4. [🟡 Medium] Duplicate / weak pedido IDs

Live examples:

| ID | Clients |
|----|---------|
| `1345869` | UAM **and** Vanesa Soto (ML) |
| `1345892` | Walter Herrera **and** Nario (no llega ecopanel) |
| empty / placeholder | Abril `#1345xxx`, Roger `#134xxxxxx`, Bulpes |

**Impact:** Wrong PDF/carpeta association; ambiguous stops; remito confusion.

**Fix:**
- UI: warn when adding stop if ID already used by another name
- Sheet hygiene SOP: one row per pedido or composite key (pedido+nombre)
- Prefer sheet row index as stable key for write-back (`logistica-fecha-entrega`)

---

### 5. [🟡 Medium] `proximas-entregas` / `coordinacion-logistica` empty

- `GET /api/proximas-entregas` → `data: []`
- `GET /api/coordinacion-logistica` → `count: 0`

May be “no deliveries this week” **or** filter/source misaligned with Ventas (23 open coords exist). Dashboard “próximas entregas” is useless while Ventas has active rows.

**Fix:** Audit mapping source sheet/tab vs operator expectation; if próximas is Master_Cotizaciones-only, document and add bridge from Ventas coords with fecha this week.

---

### 6. [🟡 Medium] Residual junk still in UI list after client filter

Still shown after “23 operativas”:

- *Hacer un escaneo de CI cuando entregamos Pedir Celular* (instruction row)
- *Bulpes* (empty shell)
- Rows with fake pedido masks `#1345xxx`

**Fix:** Align client filter with server rules (#2); block names matching operational notes; hide rows without usable id **and** without tel/dir unless operator toggles “mostrar incompletos”.

---

### 7. [🟡 Medium] Auth surface mixed

| Call | Status | Note |
|------|--------|------|
| `/api/auth/me`, refresh | 401 | Expected logged-out; console noise |
| `PUT /api/envios/drafts/…` | **200** | Draft write without session visible |
| `GET /api/envios/drafts/…` | 401 | Asymmetric |
| `POST /api/envios/geocode` | 401 | Expected without token |

**Fix:** Confirm intended public draft PUT (anonymous multi-device P5) vs require same auth as GET; reduce console spam for expected 401 on anonymous logistica.

---

### 8. [🟢 Low] Sheet data quality (ops, not code-only)

Among operative rows: many missing `LINK_UBICACION` / `ZONA` / teléfono; typos *Retita en BMC*, *Ciudad de Madonado*; free-text fechas.

**Fix:** Operator checklist + optional geocode assist (P2 already in product) after login.

---

### 9. [🟢 Backlog product] (already in SDD TARGET)

| ID | Item | Status |
|----|------|--------|
| P3 | CBM non-panel tariff | OPEN |
| P2b | Distance Matrix / TSP | OPEN |
| P5b | Autosave conflict UI | OPEN |
| Roadmap | QR labels, firma/foto, multi-camión | “Próximamente” in UI |

---

## Network snapshot (anonymous session)

```
GET  /api/auth/me          → 401
POST /api/auth/refresh     → 401
PUT  /api/envios/drafts/ENV-260810-001 → 200
GET  bmc-chat …/inquiries  → 200 (after abort)
```

Console errors: only the two expected auth 401s (no React crash, no SVG height=auto regression observed in this pass).

---

## Plan de fixes (recommended order)

### Wave A — 1–2 días (high ROI, low risk)

| # | Fix | Files | DoD |
|---|-----|-------|-----|
| A1 | Parse fechas `dd/mm[/yy[yy]]` for **Coordinado** chips | `coordinationStatus.js` + tests | Cards with `07/08` show Coordinado · 07/08 |
| A2 | Harden `ventasRowIsLogisticaRow` | `bmcDashboard.js` + tests | `?logistica=1` has 0 header/`import pandas` rows |
| A3 | Mirror same junk rules in UI CSV path | `BmcLogisticaApp.jsx` / ventasSearch | Instruction row + Bulpes-empty gone (or behind toggle) |
| A4 | Document canonical UI URL | README / calculadora docs | Cloud Run 404 explained; Vercel is SoT for SPA |

### Wave B — 3–5 días

| # | Fix | DoD |
|---|-----|-----|
| B1 | Dup-pedido warning on + Parada | Toast if same ID different cliente |
| B2 | Align or document `proximas-entregas` vs Ventas | Non-empty when week has fechas, or explicit empty-state copy |
| B3 | Draft auth symmetry | Same policy for GET/PUT drafts; note in SDD P5 |
| B4 | Optional: restore SPA on Cloud Run | `/logistica` 200 on panelin-calc |

### Wave C — product backlog

P3 CBM · P2b Matrix/TSP · P5b conflict UI · sheet hygiene campaign (zona/maps/tel).

---

## Suggested first PR

**Title:** `fix(logistica): coord chips dd/mm + ventas logistica junk filter`  
**Scope:** A1+A2 (+A3 if small)  
**Verify:**

```bash
cd ~/calculadora-bmc
npm run gate:local
# manual: open /logistica → Cargar actuales → chips Coordinado on dated rows
curl -sS "$API/api/ventas?tab=Ventas%20y%20Coordinaciones&logistica=1" | jq '[.data[] | select(.COTIZACION_ID=="ID. Pedido")] | length'  # expect 0
```

---

## Limits of this audit

- Anonymous browser (no OAuth): no write to Sheets col G, no geocode with user token, no multi-device conflict test.
- Did not fully exercise packing with real panels / 3D WebGL load (timeout on + Parada role locator).
- Did not re-run `verify:logistica-dual` e2e suite.

---

## Next step

Implement **Wave A** (chips + junk filter) unless you prefer Cloud Run SPA restore first.

---

## Wave A implementation (2026-08-10)

| Item | Status | Change |
|------|--------|--------|
| A1 dd/mm chips | **DONE** | `parsePlanillaFechaToIso` accepts `DD/MM`; `classifyVentasCoordination` uses it |
| A2 API junk filter | **DONE** | `ventasRowIsLogisticaRow` → shared `isVentasLogisticaCandidate` |
| A3 client filter | **DONE** | instruction/pandas noise + name-only min length 3 |
| A4 docs | **DONE** | `HOW-IT-WORKS-VENTAS-LOGISTICA.md` canonical Vercel + chip table |

**Branch:** `fix/logistica-wave-a-chips-junk`  
**Tests:** `coordinationStatus`, `ventasSheetMap`, `ventasSearchFilter`
