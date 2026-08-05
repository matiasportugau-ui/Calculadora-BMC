# Handoff — 2026-08-05 Envíos session close (persist)

**Current branch (product truth)**: `main`  
**Local branch at close**: may be `chore/wa-g8-one-click` or other — Envíos product is already on main.

## Uncommitted changes (ignore for Envíos)

- WA / verify scripts / product-media stashes may exist locally.
- Stashes of note: `wip-before-envios-closeout-persist`, `wip-product-media-*`, `wip-full-aside*`.
- **Do not** mix with Envíos work.

## Blockers

- **Ninguno** for Envíos wave close.
- P5 only if multi-device / shared trip / durability becomes real ops pain.

## Shipped on main (this multi-session wave)

| Track | PR(s) |
|-------|--------|
| U1 packing SoT + U2 bridge | #832 |
| 1-fila + bridge merge safety | #840 |
| Ops UX F1–F6 | #842–#849 |
| U3 STOP_STATUS FSM | #857 |
| SDD v1.4 + SCORECARD 96 | #863 |
| Residual: NO ENVIADO chip, live bridge, forced fila | #867 |

## Docs SoT

- `docs/sdd/bmc-envios/SDD.md` v1.4 As-Built  
- `docs/sdd/bmc-envios/audit/SCORECARD.json` composite **96** pass  
- `docs/sdd/bmc-envios/TARGET.md` U1/U2/U3 + F1–F6 DONE  
- Residual backlog: **P2 geocode · P3 CBM · P5 server ENV**

## Prod smoke (session)

- `GET /` 200 · `GET /logistica` 200  
- Lazy markers: Enviar a Logística, envios-app, remito-simple, Plan carga  
- `npm run smoke:prod` OK  

## Decision

**Leave Envíos.** Next context: WA or security auth drafts.  
Return to Envíos only for **P5** (multi-device) or a concrete operator bug.

## Open draft noise (do not bulk-merge)

#850 remito codes · #852 remolque · #855/#856 plan/fila (check vs #867) · #860 flete libre · #871 chip negation polish

## Next prompt to resume exactly

```
Continue from here: Envíos wave closed on main (#832 #840 #842–#849 #857 #863 #867). Leave Envíos unless multi-device P5 or a named prod bug. Next: WA cockpit / G8 or dashboard auth drafts (#843 family). Do not re-implement F1–F6.
```

## Key files

- `src/utils/logistica/*` (packing, bridge, chips, remito, packageDrop, loadPlan, stopStatusFsm)  
- `src/components/BmcLogisticaApp.jsx` · `FleteCotizarPanel.jsx` · `logistica/LogisticaCargoScene3d.jsx`  
- Prod: https://calculadora-bmc.vercel.app/logistica  
