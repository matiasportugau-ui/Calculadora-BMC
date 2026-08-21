# TARGET — BMC Driver Loop

**Slug:** `bmc-driver-loop`  
**Date:** 2026-08-21  
**Status:** Draft → Implementing  
**Repo:** `calculadora-bmc` (branch `feat/logistica-driver-loop`)  
**Sibling:** [`../bmc-envios/`](../bmc-envios/) — packing / ENV / REP stay SoT.

## Product outcome

Operador confirma un **REP** en `/logistica` → el chofer abre **BMC Driver** (`/conductor`) en el celular (PWA, visual spec Outdoor Night) → el cliente ve `/seguimiento/:token` sin datos de otros destinos.

## Surfaces (must stay one product, two visual languages)

| Surface | Route | Visual spec | Role |
|---------|-------|-------------|------|
| Driver Login | `/conductor` (no session) | `evidence/screens/01-login.jpg` | Token / offline shell |
| Trips admin (home) | `/conductor` (session) | `evidence/screens/04-trips-admin-home.png` | Viaje asignado + actividad |
| Trip phases (carga) | `/conductor/carga` | `evidence/screens/03-trip-phases-carga.jpg` | FSM fábrica |
| Trip done | `/conductor/listo` | `evidence/screens/05-trip-done.png` | Peak–end after last delivery |
| User profile | `/conductor/perfil` | `evidence/screens/02-profile.jpg` | Nombre, tema, offline, logout |
| Customer track | `/seguimiento/:token` | (existing light page) | Cliente |
| Operator join | `/logistica` Confirmar | Liquid Glass (envíos) | Mints trip + links |

## DoD

| ID | Criterion |
|----|-----------|
| D1 | Confirm REP (API) creates `trips` row + `driver_url` on SPA `/conductor?t=` |
| D2 | `/conductor/*` has **no** operator Shell / Google header |
| D3 | Five driver screens match visual specs (dark navy + orange) at 390×844 |
| D4 | Driver events use existing FSM (`factory_*`, `stop_*`, `delivery_*`, GPS) |
| D5 | Customer tokens hashed; GPS only in transit ≤30 min |
| D6 | No native store app; no replacement of ENV drafts |

## Non-goals

Native iOS/Android · HR driver roster (v1 UUID-from-phone) · auto-WA to customers · AR long-haul BA→Córdoba fiction in copy (UY stops from REP).
