# TARGET — BMC Torre de Control

**Slug:** `bmc-control-tower`  
**Date:** 2026-08-27  
**Status:** Implementing (Fase 1 live board)  
**Parent:** [`../bmc-logistica/`](../bmc-logistica/) · sibling [`../bmc-driver-loop/`](../bmc-driver-loop/)  
**Repo:** `calculadora-bmc`

## Product outcome

Operador confirma un REP → el viaje entra a **Torre** (mapa + online/offline + evidencias) → chofer PWA pinea GPS → cliente sigue viendo solo su `/seguimiento/:token`.

## Surfaces

| Surface | Route | Role |
|---------|-------|------|
| Plan (packing) | `/logistica` | Wizard ENV/REP (sin cambio) |
| Torre live | `/logistica?vista=torre` · alias `/torre` | Flota en curso |
| Chofer | `/conductor` | PWA; GPS se apaga si `trip.status === closed` |
| Cliente | `/seguimiento/:token` | Sin otros destinos (Fase 3 = Order ID) |

## DoD

| ID | Criterion | Fase |
|----|-----------|------|
| T1 | `GET /api/torre/live` lista trips no cerrados + último ping | 1 |
| T2 | UI Torre: mapa OSM + lista online/offline (ping &lt; 90s) | 1 |
| T3 | `location_ping` y `presence` son eventos FSM válidos | 1 |
| T4 | `watchPosition` no corre si el trip está `closed` | 1 |
| T5 | Roster + alta HITL (mail/teléfono/password) | 2 |
| T6 | Asignar REP a usuario registrado → inbox chofer | 2 |
| T7 | Lookup público Order ID → misma proyección sanitizada | 3 |
| T8 | Agente Torre HITL ≠ El Transportador | 4 |

## Non-goals

Microservicio nuevo · Samsara/Onfleet · auto-WA · directivas IA sin humano · app nativa · self-signup de choferes.
