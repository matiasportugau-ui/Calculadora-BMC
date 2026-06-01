# Cotizar + Presup Orchestrator — Phase A Scorecard

**Rama:** `wip/cotizar-and-presup`  
**Actualizado:** 2026-05-30  
**Definición 100/100:** Phase A exit + Cotizar E2E borrador (no merge a `claude/quote-accuracy-merged` salvo pedido explícito).

---

## Criterios y estado

| # | Criterio | Evidencia | Estado | Notas |
|---|----------|-----------|--------|-------|
| 1 | Spec Cotizar en `docs/google-sheets-module/COTIZAR-BUTTON-*` | README índice + 4 docs | ✅ | |
| 2 | Apps Script canónico `scripts/apps-script/cotizar-button/` | Code.gs + Sidebar.html | ✅ | CONFIG col 60 |
| 3 | Orchestrator docs + roadmap | `PRESUPUESTACION-ORCHESTRATOR-*` | ✅ | |
| 4 | Ruta `POST /api/internal/presup/run` montada | smoke HTTP 200 | ✅ | Wiring OK |
| 5 | **Prod smoke `status` ≠ error** | `npm run smoke:presup` vs Cloud Run | ⬜ | Requiere deploy + keys válidas |
| 6 | Anthropic message shape / sub-agent prompt | `agentCore` sanitize + `internal` channel | 🟡 | Código listo; falta deploy prod |
| 7 | promptfoo ≥ 7 casos | `evals/promptfoo/presup-orchestrator.yaml` | 🟡 | Ejecutar local con keys |
| 8 | PDF borrador real (no dummy blob) | `generateAndUploadPDF` → `/api/pdf/generate` | 🟡 | Requiere `PDF_DRIVE_FOLDER_ID` en Sheets |
| 9 | Smoke checklist humano Sheets | `SHEETS-COTIZAR-SMOKE-CHECKLIST.md` | ⬜ | Gate humano |
| 10 | Handoff + PROJECT-STATE | HANDOFF-2026-05-30* | 🟡 | Actualizar tras deploy |

**Score Phase A (automatable):** 6/10 ✅ · 4 pendientes (deploy/keys/humano)

---

## Comandos de verificación

```bash
# Local (API en :3001)
npm run start:api
npm run smoke:presup

# Producción
BMC_API_BASE=https://panelin-calc-q74zutv7dq-uc.a.run.app npm run smoke:presup

# promptfoo (requiere keys + API)
npx promptfoo eval -c evals/promptfoo/presup-orchestrator.yaml
```

**Smoke OK cuando:** `status` ∈ `{ awaiting_approval, completed, rejected_by_pricing }` — no `error`.

---

## Bloqueadores conocidos

1. **Cloud Run sin último fix** — deploy rama `wip/cotizar-and-presup` (commits `fa70da4`+ y sanitización Anthropic).
2. **Keys AI en prod** — `ANTHROPIC_API_KEY` válida; OpenAI 401 no debe ser único proveedor con key.
3. **PDF Drive** — crear carpeta borrador en Drive BMC y setear `PDF_DRIVE_FOLDER_ID` en `Code.gs` antes de E2E Sheets.

---

## Próximo paso recomendado

1. `npm run ml:cloud-run` (o Doppler sync) con keys válidas.  
2. Deploy Cloud Run desde `wip/cotizar-and-presup`.  
3. Re-run prod smoke hasta `awaiting_approval`.  
4. Checklist humano en Admin 2.0 (fila test ~9).
