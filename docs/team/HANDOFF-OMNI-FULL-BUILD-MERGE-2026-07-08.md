# HANDOFF — OMNI FULL BUILD: merge + deploy del programa completo

**Fecha:** 2026-07-08
**Sesión:** merge serial de los 5 PRs del programa OMNI FULL BUILD (paridad ≥8.6) + deploy + verificación prod.
**Epic:** [#623](https://github.com/matiasportugau-ui/Calculadora-BMC/issues/623)

## Qué se hizo

1. **Resolución de conflictos** — main avanzó ~15 commits (consola asistentes #638–#642, PDF real #620/#650, OpenRouter #652) mientras los 5 PRs esperaban merge. Cada branch se actualizó con `merge origin/main` en su worktree (`.claude/worktrees/gap*`), resolviendo conflictos:
   - `docs/team/PROJECT-STATE.md` (todas): entradas aditivas de "Cambios recientes" — se conservaron ambos lados.
   - `package.json` (#631, #633): unión de listas `test:core` (`mlWebhookOmni.test.js`, `omniSequenceWorker.test.js`, `quotePdf.test.js`).
2. **Validación local por branch** — tests propios de cada gap en verde antes de push (`mlWebhookOmni` 16/16, `omniMetaChannels` ok, `omniSequenceWorker` 14/14, `omniDealsStageEndpoint` 4/4, `omniHardening` 12/12; lint gap5: 0 errors).
3. **Merge serial** (squash) con required checks verdes en cada paso: **#622 → #631 → #630 → #633 → #632**. Branch protection (strict up-to-date + required checks) obligó a `gh pr update-branch`/merge local + espera de checks por PR.
4. **Deploy + verificación:**
   - CI main `2792cf96`: ✅ success
   - Deploy Cloud Run (workflow_dispatch tras aborto del guard SHA-tip por race): ✅ success
   - `smoke:prod` con Doppler (`bmc-backend/prd`): ✅ 9/9 — incl. `suggest-response` IA vía gemini
   - Vercel SPA: ✅ 200

## Estado del programa

| Item | Estado |
|------|--------|
| Spec (#622) · Gap 2 (#631) · Gap 3 (#630) · Gap 4 (#633) · Gap 5 (#632) | ✅ merged + deployed |
| Issues #625/#626/#627/#628 | ✅ cerrados (sesión anterior) |
| Epic #623 | 🟡 abierto — pendiente solo #624 |
| Gap 1 (#624) — email saliente prod | 🔴 human-gated: H1–H4 |

## Pendiente humano (protocolo blockers: no reintentar sin credenciales)

- **H1–H4 (#624):** SMTP2GO signup, DKIM/SPF en Cloudflare, Gmail send-as, verificación e2e reply desde cockpit.
- **cm-0:** Meta OAuth → activar `OMNI_IG_ENABLED` / `OMNI_FB_ENABLED` (código listo behind flags).
- **Gap 4 flag:** secuencias HITL detrás de flag OFF — activar cuando se decida.
- **`read:project` scope:** `gh auth refresh -s read:project` (interactivo) para gestionar el board «BMC Dev».

## Notas técnicas para el próximo agente

- Worktrees del programa en `.claude/worktrees/gap{2,3,4,5}-*` y `omni-full-build-spec` — pueden podarse (`git worktree remove`) ahora que las branches remotas fueron mergeadas.
- El guard "SHA is still tip of main" en `deploy-calc-api.yml` aborta deploys si main avanza durante la corrida — comportamiento correcto; re-dispatch con `gh workflow run deploy-calc-api.yml --ref main`.
- `smoke:prod` requiere `API_AUTH_TOKEN` (vía `doppler run -p bmc-backend -c prd`) para el check de suggest-response; sin él da 401 esperado.
