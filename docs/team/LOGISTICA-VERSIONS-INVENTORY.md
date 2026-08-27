# Logística versions inventory (ranked locals)

**Update 2026-08-26 (deep scan):** el desarrollo “perdido” de **mapa guiado por la ruta** y **estibas/pilas afuera del camión por cliente y tamaño** **no está en `main`**. Vive en el worktree sucio **mesa-depo** (Leaflet + polyline OSRM + `yardLayout` lanes/stacks + El Transportador). `main` solo tiene SVG de ruta + “Descargar camión” a pilas más simples (`buildYardDump` sin lanes WMS).

## Qué hay desarrollado (mapa de producto)

| Capacidad | `main` :5173 | **mesa-depo** :5174 (más completa) | Driver :5175 | 3D sandbox :8080 |
|-----------|--------------|--------------------------------------|--------------|------------------|
| Wizard Pedidos→Carga | sí | sí + mesa de ruta / depo BMC URUGUAY | — | — |
| Verificar con IA (paradas) | sí | sí | — | — |
| Geocode Nominatim | sí | sí | — | — |
| **Mapa OSM Leaflet + ruta OSRM** (polyline de camino, pins arrastrables) | no (SVG + link Maps) | **sí** `RouteLeafletMap` + `osrmPolyline` + `LogisticaMapColumn` | — | — |
| Share Maps/WA/GPX al transportista | sí | sí | — | — |
| **Pilas/estibas patio** por pedido, distinto tamaño | dump norte/sur simple | **lanes WMS + stacks** `yardLayout.js` (`buildYardLanes` / `buildYardStacks`), labels por cliente | — | visor 3D referencia |
| 3D camión + free-drag | sí | sí + CargoStudio / nudge / solid bodies (WIP untracked) | — | sandbox Three |
| **IA El Transportador** (visor, PiP, ACTION_JSON ruta/carga) | no | **sí** (dirty + freeze 22 ago) | — | — |
| Chofer PWA Outdoor Night | sí (merge #1078) | — | **login por link** `cf77e4cc` | — |
| OSRM en API `GET/POST /api/envios/route` | **no** | **sí** | — | — |

**Date:** 2026-08-26  
**Repo:** `matiasportugau-ui/Calculadora-BMC`  
**`origin/main` tip:** `31539f906447c90ef2fb3e92e5d33f5475fde2e8` — `feat(calc): productos sueltos use Agregar producto catalog UI (#1115)`  
**How this was ranked:** shipped completeness on `main` first, then unique **unmerged** surfaces the operator can open in a separate directory. Lines whose SHA is already an ancestor of `main` are **not** given a second checkout of the same code.

## Ranked table

| Rank | Line | Path | Branch | Tip SHA | Tip one-liner | Unique vs `main` | Completeness |
|------|------|------|--------|---------|---------------|------------------|--------------|
| 1 | **Envíos ops (shipped)** | `~/calculadora-bmc` | `main` | `31539f90` | productos sueltos catalog UI (#1115) | — (this **is** main) | **Most complete shipped product**: `/logistica` wizard, AI verify (#1019), geocode, transportista share (Maps/WA/GPX), Drive coordinaciones, packing 3D, Driver Loop **merged** (#1078). |
| 2 | **Mesa de ruta + OSRM/Leaflet + trucker IA** | `~/calculadora-bmc/.worktrees/logistica-mesa-depo` | `feat/logistica-mesa-depo-20260821` | **committed** `82a25e57` (worktree **behind origin by 2**; dirty WIP on disk) | `chore(env): document OSRM_ROUTE_URL` | **Yes** — ~85 files / +9k lines vs main: `LogisticaMapColumn`, `truckerAgent`, `osrmPolyline`, `uyGazetteer`, Leaflet/OSRM. Origin tip `b3b2fd68` adds XSS tooltip + archive-merge fixes. | **Most complete unmerged ops+maps+IA-agent** tree. Do not mix with `main`. |
| 3 | **Driver login paste-link** | `~/calculadora-bmc-driver-loop` | `fix/driver-login-paste-link` | `cf77e4cc` | login asks for the trip link, not a token | **Yes** — 4 files (`DriverLogin.jsx`, `useDriverSession.js`, `conductorUrl.js`, test). `feat/logistica-driver-loop` (`dac50af9`) **is already on main** (#1078). | Chofer PWA delta only (login UX). Rest of Driver Loop is on rank-1 main. |
| 4 | **3D logistic viewer sandbox** | `~/Projects/3d-logistic-viewer` | `main` (separate repo) | `4fec3980` | track viewer screenshots + gitignore | Different GitHub repo `matiasportugau-ui/3d-logistic-viewer` — **not** a Calculadora-BMC worktree. | Reference 3D SDD + viewer; **not** prod `/logistica`. |
| — | Envío wizard + AI-verify + geocode + transportista Maps | *(same as rank 1)* | merged | `1517c7f5` wizard · `ab9a464b` AI verify | — | **Merged into main** — no extra worktree. | Use rank 1. |
| — | Driver Loop feature branch | *(same as rank 1)* | `feat/logistica-driver-loop` | `dac50af9` | test Driver Loop URL/GPS | **Ancestor of main** (`git merge-base --is-ancestor` yes). | Use rank 1 + rank 3 for login-only delta. |
| — | Historical `logistica-local-control` | `~/calculadora-bmc/.worktrees/logistica-local-control` | `feat/logistica-local-control` | `fc4fc91a` | bake MATRIZ prices (#1054) | **Ancestor of main**; `git diff main...HEAD` empty. | **Do not treat as a unique version.** Path exists; skip a new checkout. |
| — | Historical Envíos closeout docs | `~/calculadora-bmc/.worktrees/docs-envios-closeout` | `docs/envios-closeout-2026-08-07` | `1a972625` | handoff Envíos capitalizar | **Ancestor of main**. | Docs only; already on main. |

### Rank 1 working tree note (not a separate line)

`~/calculadora-bmc` `main` currently has **uncommitted** logística wizard work from this session (Kingspan fecha/hora + Verificar con IA on Step Pedidos). That is session WIP on rank 1, not another checkout.

## Unique unmerged locals (open these)

Only **rank 2** and **rank 3** needed extra directories; both already existed (reused). Rank 4 is a separate repo. Rank 1 is the canonical clone.

Fast-forward of mesa → `origin/feat/logistica-mesa-depo-20260821` (`b3b2fd68`) was **not** applied: the worktree is dirty (trucker/map WIP + untracked `LOGISTICA-AGENT-STUDY-PACK.md`, cargo studio files). Inspect **as-is**.

## Check recipes

### 1 — Shipped Envíos (`main`)

```bash
cd ~/calculadora-bmc
# intended:
doppler run -- npm run dev          # Vite http://localhost:5173/
doppler run -- npm run start:api    # API  http://localhost:3001/
```

- **Open:** http://localhost:5173/logistica  
- **Prod:** https://calculadora-bmc.vercel.app/logistica  
- **This machine (2026-08-26):** Vite **:5173** LISTEN, API **:3001** LISTEN (main tree).

Expect: Configuración del envío (Pedidos → Flota → Levantes → Ruta → Carga), Verificar con IA, geocode, Maps/WA share, 3D carga.

### 2 — Mesa + Leaflet/OSRM + trucker agent

```bash
cd ~/calculadora-bmc/.worktrees/logistica-mesa-depo
# Do not run this on the same ports as rank 1 at the same time.
# If you start it: different terminal; stop main Vite/API first, or change ports.
doppler run -- npm run dev
doppler run -- npm run start:api
```

- **Open:** http://localhost:5173/logistica (only if this tree owns Vite)  
- Unique UI: `LogisticaMapColumn.jsx`, `LogisticaTruckerAgent.jsx`, OSRM (`osrmPolyline.js`, `OSRM_ROUTE_URL`).  
- Dirty extras on disk: `docs/team/LOGISTICA-AGENT-STUDY-PACK.md`, `PROMPT-PLAN-IA-RUTA-CARGA.md`, untracked cargo studio / `openLogisticaAgentWindow.js`.

### 3 — Driver PWA (paste trip link)

```bash
cd ~/calculadora-bmc-driver-loop
# Isolated from main. Typical:
doppler run -- npm run dev
```

- **Open:** http://localhost:5173/conductor (SPA; not `/calculadora/conductor`)  
- Unique: login asks for **trip link**, not a raw token (`cf77e4cc`).  
- Confirm-join + Outdoor Night PWA already live on **main** (`e1646783` / #1078).

### 4 — 3D sandbox (read-only inventory)

```bash
cd ~/Projects/3d-logistic-viewer
# Not Calculadora-BMC. See docs/sdd/3d-logistic-viewer/GLORY-HANDOFF.md
```

- **Do not** treat as `/logistica` prod. No BMC worktree add.

### Merged — no extra checkout

| Feature | Landed on main as | SHA |
|---------|-------------------|-----|
| Setup wizard | #909 | `1517c7f5` / `ef9c61c5` |
| Verificar con IA | #1019 | `ab9a464b` |
| Driver Loop (trips + PWA) | #1078 | `f2a2ebed` / `e1646783` |
| Autocarga A–C–B | #899 | `9e08eacf` |
| Envíos closeout docs | #938 | `acfa98b8` |
| `feat/logistica-local-control` tip | ancestor | `fc4fc91a` |

`origin/feat/logistica-ai-verify-stop` still exists (`b5b1bba3`) with 2 commits not in main’s history (merge-shaped); **the feature files are on main** via #1019. No worktree.

## Worktrees that exist but are not unique versions

| Path | Why listed |
|------|------------|
| `~/calculadora-bmc/.worktrees/logistica-local-control` | Historical; SHA ⊂ main |
| `~/calculadora-bmc/.worktrees/docs-envios-closeout` | Historical docs; SHA ⊂ main |
| `~/calculadora-bmc-jenerik`, `~/calculadora-bmc-paneli-mcp` | Not logística UI (out of scope) |

## Tests (main Envíos path)

From `~/calculadora-bmc`:

```bash
node tests/wizardState.test.js
node tests/aiVerifyStop.test.js
```

Captured under the goal scratch dir as `logistica-main-tests.log`.
