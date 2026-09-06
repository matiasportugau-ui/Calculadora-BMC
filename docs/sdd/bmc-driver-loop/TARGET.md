# TARGET — BMC Driver Loop

**Slug:** `bmc-driver-loop`  
**Date:** 2026-08-21  
**Status:** Draft → Implementing  
**Repo:** `calculadora-bmc` (branch `feat/logistica-driver-figma-loop`)  
**Sibling:** [`../bmc-envios/`](../bmc-envios/) — packing / ENV / REP stay SoT.  
**Parent:** [`../bmc-logistica/`](../bmc-logistica/) — `/logistica` is the **only** route-feed source.

## Product outcome

Operador confirma un **REP** en `/logistica` → el chofer abre **BMC Driver** (`/conductor`) en el celular (PWA, visual spec Outdoor Night) → el cliente ve `/seguimiento/:token` sin datos de otros destinos.

**Feed rule:** Driver **displays** the assigned trip / `plan_snapshot` (origin, dest, stops, qty, remito). It does **not** invent stops or cities. Empty-session demo copy is labeled demo and never overrides a live trip.

## Surfaces (must stay one product, two visual languages)

Tab map on session screens: **Inicio / Carga / Listo / Perfil** (Listo includes the same bar).

| Surface | Route | Visual spec | Role |
|---------|-------|-------------|------|
| Driver Login | `/conductor` (no session) | `evidence/svg-kit-2026-09-06/login.svg` | Token / offline shell |
| Trips admin (home) | `/conductor` (session) | `evidence/svg-kit-2026-09-06/home.svg` | Viaje asignado + actividad |
| Trip phases (carga) | `/conductor/carga` | `evidence/svg-kit-2026-09-06/load.svg` | FSM fábrica |
| Trip done | `/conductor/listo` | `evidence/svg-kit-2026-09-06/done.svg` | Peak–end after last delivery |
| User profile | `/conductor/perfil` | `evidence/svg-kit-2026-09-06/profile.svg` | Nombre, tema, offline, logout |
| Customer track | `/seguimiento/:token` | (existing light page) | Cliente |
| Operator join | `/logistica` Confirmar | Liquid Glass (envíos) | Mints trip + links |

Visual SoT is the **2026-09-06 Outdoor Night SVG kit** (`evidence/svg-kit-2026-09-06/`). The JPG pack under `evidence/screens/` is archival / not layout SoT.

## DoD

| ID | Criterion |
|----|-----------|
| D1 | Confirm REP (API) creates `trips` row + `driver_url` on SPA `/conductor?t=` |
| D2 | `/conductor/*` has **no** operator Shell / Google header |
| D3 | Five driver screens match the SVG kit (dark navy + orange) at 390×844; one tab bar Inicio/Carga/Listo/Perfil |
| D4 | Driver events use existing FSM (`factory_*`, `stop_*`, `delivery_*`, GPS) |
| D5 | Customer tokens hashed; GPS only in transit ≤30 min |
| D6 | No native store app; no replacement of ENV drafts |
| D7 | Home/Carga/Listo bind `GET /api/driver/trips` + `plan_snapshot` (logistics feed); no hardcoded production cities |

## Non-goals

Native iOS/Android · HR driver roster (v1 UUID-from-phone) · auto-WA to customers · AR long-haul BA→Córdoba fiction in copy (UY stops from REP).
