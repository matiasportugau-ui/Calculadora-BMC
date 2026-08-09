# Module pack — `logistica`

> OMFT seed pack. Edit success criteria before each live run.

---

## 1. Identity

| Field | Value |
|-------|--------|
| **Slug** | `logistica` |
| **Title** | Logística 3D — camión, carga, adjuntos |
| **Owner / product area** | Operaciones / logística BMC |
| **Default base URL** | `https://calculadora-bmc.vercel.app` |
| **Primary routes** | `/logistica` |
| **Auth required** | yes (operator session for real orders) |
| **Last pack update** | 2026-08-09 |

## 2. What this module is for

Configure truck length, visualize BMC cab/bed packing in 3D, load cargo from quotes/adjuntos (Drive/Dropbox via proxy-first path), and prepare an ops-usable loading view for real trips.

## 3. Primary screens / surfaces

| Surface | Route or entry | Notes |
|---------|----------------|-------|
| Logística app shell | `/logistica` | `BmcLogisticaApp` |
| 3D cargo scene | same | `TruckVisual` + `LogisticaCargoScene3d` |
| Adjunto / autocarga | same UI | proxy `POST /api/envios/adjunto-fetch` + browser fallback |
| Truck length / axles | length control | ≤6 m → 2 axles; else 3 |

## 4. Happy-path skeleton (optional)

1. Sign in → open `/logistica`
2. Select or import real cargo (quote / adjunto PDF)
3. Confirm adjunto status (proxy OK vs error copy)
4. Set truck length; check axles
5. Review 3D packing (cab nose away from bed, usable lighting)
6. Optional: free-drag package, cab lights
7. Leave state usable for trip organization / handoff to envíos if that is part of *this* run

## 5. Success criteria (operator POV — edit before run)

- [ ] Real order/cargo can be configured without dead ends
- [ ] Adjunto path is understandable when it fails (operator-facing errors)
- [ ] Cab orientation and lighting feel correct for ops review
- [ ] Truck length/axles match expectation
- [ ] _Add your trip-organization criteria here_

## 6. Real data / fixtures needed

| Need | Example | Secret? |
|------|---------|---------|
| Operator login | prod account | yes |
| Real quote / order | client name only in reports | redact |
| PDF adjunto | Drive or Dropbox | prefer test-safe links |

## 7. Out of scope (this pack)

- Full Envíos wizard (see pack `envios`) unless explicitly included in this run’s goal
- Sandbox Grok viewer deploy (not prod surface)
- Re-porting TruckVisual from sandbox without a NAV finding

## 8. Known recent context (refresh in PREP)

| Item | Value |
|------|--------|
| Campaign merges (2026-08-09) | #953 CSP, #955 adjunto, #960 parser, #962 cab+lights |
| Prod tip note | check `origin/main` at PREP time |
| Human residual | T6 cab lights click (optional manual) |

## 9. Related docs

- `docs/sdd/bmc-envios/` (logística ↔ envíos)
- Handoff: `docs/team/HANDOFF-2026-08-09-3d-logistica-glory.md`
- Sandbox SDD (reference only): private repo `3d-logistic-viewer`

## 10. Capture protocol

Same fixed OMFT protocol: ACTION / EXPECT / OBSERVED / Verdict / Fig / Severity.

## 11. Code touch hints (optional)

- `src/components/TruckVisual.jsx`
- `src/components/logistica/LogisticaCargoScene3d.jsx` (or current path)
- `src/utils/logistica/adjuntoInfer.js`
- `vercel.json` CSP `connect-src`
- BmcLogística app shell components under `src/`
