# Handoff — 2026-08-05 BMC Envíos ship

**Current branch**: `feat/bmc-envios-u1-u2-sdd` (local)  
**Product truth**: already on **`main` @ `9746f29c`** via PR [#832](https://github.com/matiasportugau-ui/Calculadora-BMC/pull/832)  
**IN_PROGRESS_OP**: none

## Uncommitted changes (local — NOT Envíos product)

Do **not** ship these with Envíos docs without allowlist review. Unrelated WA/media + misc:

- Modified: `Dockerfile.bmc-dashboard`, `server/index.js`, `server/routes/wa.js`, `src/components/BmcWaCockpit.jsx`, `server/lib/marketIntel/data/keywordMonitorState.json`
- Untracked (sample): `docs/sdd/bmc-whatsapp-connection/`, `docs/wa-cockpit/*`, `server/lib/waMedia.js`, `scripts/wa-*`, `wa-package/migrations/018_wa_media.sql`, market-intel ads evidence, `goal-prompt-wa-media-richness-100.md`, `HANDOFF-2026-08-05-wa-media-100.md`
- Closeout docs written this session (may be unstaged): `docs/team/PROJECT-STATE.md`, `docs/team/BITACORA-MATIAS.md`, this file

## Blockers

- **None** product-blocking.
- Optional ops noise: GHA [Deploy Frontend run 30972626824](https://github.com/matiasportugau-ui/Calculadora-BMC/actions/runs/30972626824) failed only on post-deploy smoke “Could not locate App-*.js”; production deploy step succeeded and Client ID is in `App-CD6BJ7TH.js`.

## Shipped this session

| Layer | Status |
|-------|--------|
| U1 packing SoT | `src/utils/logistica/cargoPacking.js` (stack ops + column freight) |
| U2 bridge | `bridgePayload.js` + **Enviar a Logística** → `/logistica` import |
| UI | Liquid Glass `bmc-envios-glass.css` + `enviosTheme.js` |
| SDD | `docs/sdd/bmc-envios/` re-audit composite **98** |
| Tests | `cargoPacking.test.js`, `bridgePayload.test.js` in `test:core` |
| Prod | LIVE on https://calculadora-bmc.vercel.app (+ `/logistica`); API smoke OK |

## Residual (next session — product)

| ID | Topic | Action |
|----|--------|--------|
| [#837](https://github.com/matiasportugau-ui/Calculadora-BMC/pull/837) draft | Bridge must not wipe logistics drafts | Prefer first fix; open from `main` if draft is stale |
| [#836](https://github.com/matiasportugau-ui/Calculadora-BMC/pull/836) draft | Freight 1-fila overquote + bridge wipe | Triage overlap with #837; one clean PR |
| Manual E2E | Wizard Flete + panels → Cotizar → Enviar a Logística | 5 min on prod |
| Harness | Deploy smoke `App-*.js` locator | Optional `/harness-ratchet` — not blocking |
| Backlog | U3 FSM, P2 geocode, P3 CBM, P5 server ENV | Explicit non-goals until new goal |

## Next prompt to resume exactly

```
Continue from here: triage draft PRs https://github.com/matiasportugau-ui/Calculadora-BMC/pull/836 and https://github.com/matiasportugau-ui/Calculadora-BMC/pull/837 (freight 1-fila overquote + stop bridge wiping logistics drafts); prefer one clean fix PR from main @ 9746f29c; do not mix local WA/media dirty tree. Optional: harness-ratchet on Deploy Frontend smoke App-*.js locator; optional manual E2E Flete→Enviar a Logística with panels on https://calculadora-bmc.vercel.app. Product already shipped: PR #832 Envíos U1/U2.
```

## Key files touched (Envíos)

- `src/utils/logistica/cargoPacking.js`
- `src/utils/logistica/bridgePayload.js`
- `src/components/BmcLogisticaApp.jsx`
- `src/components/FleteCotizarPanel.jsx`
- `src/styles/bmc-envios-glass.css`
- `src/utils/enviosTheme.js`
- `src/main.jsx` (glass imports)
- `tests/cargoPacking.test.js`, `tests/bridgePayload.test.js`
- `docs/sdd/bmc-envios/**`
- `package.json` (`test:core` entries)

## Git hygiene for next Envíos work

```bash
cd ~/calculadora-bmc
git fetch origin
git checkout main && git pull origin main   # expect 9746f29c or later
# leave WA dirty on the old feature branch or stash separately
git checkout -b fix/envios-bridge-drafts
```

## Current state reference

- `docs/team/PROJECT-STATE.md` — entry **2026-08-05 (feat — BMC Envíos U1/U2 ship PR #832)**
- `docs/team/BITACORA-MATIAS.md` — **2026-08-05 N — BMC Envíos U1/U2 ship**
- Prod: https://calculadora-bmc.vercel.app/ and https://calculadora-bmc.vercel.app/logistica
