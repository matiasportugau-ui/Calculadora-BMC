# HANDOFF — 2026-08-07 Logística autocarga LIVE in production

**Status:** **SHIPPED · DOCUMENTED · LIVE**  
**PR:** [#899](https://github.com/matiasportugau-ui/Calculadora-BMC/pull/899) merged `9e08eacf`  
**Feature commit:** `9ac9b85f`  
**Prod URL:** https://calculadora-bmc.vercel.app/logistica  
**API:** https://panelin-calc-q74zutv7dq-uc.a.run.app  

## What shipped (A → C → B → D)

| Phase | Deliverable | Live check |
|-------|-------------|------------|
| **A** | Ventas candidate filter + toast labels | Cargar actuales no lista basura; toasts con nombre/`#pedido`/`fila N` |
| **C** | `adminQuoteMatch` multi-key + wire from `agregarStop` | Module + `POST /api/envios/match-quotes` (**401** unauth = route live) |
| **B** | `POST /api/envios/adjunto-fetch` + client proxy | **401** unauth; Alvaro Drive PDF fetched server-side in training |
| **D** | Evidence + HOWTO + this handoff | Paths below |

## Operator smoke (prod)

1. Hard refresh https://calculadora-bmc.vercel.app/logistica  
2. **Cargar actuales** → ~20+ filas con clientes reales (Petinho, Alvaro, …)  
3. **+ Parada** on a row with ENCARGO PDF → autocarga toast with client label  
4. Optional: Alvaro Drive link should use API proxy when front has auth token to Cloud Run  

## Key code (on `main`)

| Area | Path |
|------|------|
| Ventas filter / labels | `src/utils/logistica/ventasSheetMap.js` |
| Admin match | `src/utils/logistica/adminQuoteMatch.js` |
| Accessory dims | `src/utils/logistica/packageDims.js` |
| Ops UI | `src/components/BmcLogisticaApp.jsx` |
| API | `server/routes/envios.js` (`match-quotes`, `adjunto-fetch`, `ventas-csv`) |
| Tests | `tests/ventasSheetMap.test.js`, `adminQuoteMatch.test.js`, `packageDims.test.js` |

## Docs SoT

- Goal: `goal-prompt-logistica-autocarga-a-c-b-d.md` + `docs/team/goal-prompts/` copy  
- Evidence: `docs/sdd/bmc-envios/evidence/autocarga-training-2026-08-07.md`  
- Operator HOWTO: `docs/sdd/bmc-envios/HOW-IT-WORKS-VENTAS-LOGISTICA.md`  
- Narrative state: `docs/team/PROJECT-STATE.md` (Cambios recientes 2026-08-07)  

## Prod probe (2026-08-07T05:50Z UTC)

```
FE /logistica          200
API /health            200
POST match-quotes      401  (auth required — route present)
POST adjunto-fetch     401  (auth required — route present)
Deploy Frontend        success (GHA)
Deploy Calculator API  success (GHA Cloud Run)
```

## Residual / next

- Live Admin match needs Sheets-backed `GET /api/cotizaciones` in the environment.  
- Filename-only infer still defaults quantities to 1.  
- Follow-on on main tip: reparto coordinación [#903](https://github.com/matiasportugau-ui/Calculadora-BMC/pull/903) — orthogonal to autocarga.  

## Next prompt (if continuing logistica)

```
Prod logistica autocarga is LIVE via #899. Smoke Cargar actuales + Alvaro PDF proxy.
Next only if needed: Admin Sheets match in prod, or qty parse from PDF text.
Do not re-implement A/C/B filters.
```
