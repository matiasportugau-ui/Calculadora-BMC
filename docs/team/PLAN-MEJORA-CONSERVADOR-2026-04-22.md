# Plan de mejora conservador — Calculadora BMC

**Fecha:** 2026-04-22
**Propósito:** Landing seguro de 4+ PRs pendientes sin tocar `main` hasta tener validación manual.
**Principio rector:** nada llega a producción (`main` → `calculadora-bmc.vercel.app`) sin un camino de rollback trivial.

---

## Estado actual (verificado)

| Recurso | Estado | Nota |
|---|---|---|
| `origin/main` | `391c695` (sin cambios) | Producción idéntica a antes de esta sesión. |
| `integration/2026-04-22` | `3baf6b4` | Rama **desechable**. Contiene `main + #76 + #83`. |
| Deploy de Vercel prod | Sirviendo `391c695` | No se tocó. |
| Vercel preview | Generado para `integration/2026-04-22` | URL automática para QA manual. |
| Tests locales | `349/349` unit · `17/17` API · `10/10` visual · build OK | Todos verdes en integración. |

**Rollback total de la sesión:**
```bash
git push origin --delete integration/2026-04-22
```
Eso devuelve todo al estado pre-sesión. Cero pérdida.

---

## Principios de seguridad (se aplican a todas las fases)

1. **Nunca se hace `push --force` a `main`.** Nunca.
2. **Nunca se borra una rama remota sin confirmación explícita por rama.**
3. **Nunca se cierra un PR sin avisar al autor/asignado.**
4. **Cada cambio a `main` se hace vía PR** (aunque seamos nosotros mismos), no vía fast-forward silencioso — así queda revisable.
5. **Cherry-pick > rebase** para PRs con historia divergente (como #81, #59). Cirugía, no reescritura de historia.
6. **Gate obligatorio antes de cualquier merge a `main`:**
   - `npm run gate:local:full` ✓
   - `npm run test:api` ✓
   - Vercel preview carga y la UI responde ✓
   - CI de GitHub Actions en verde ✓

---

## FASE A — Ya completada (sin riesgo)

- [x] Sync local de `main` (fast-forward desde `origin/main`).
- [x] Crear `integration/2026-04-22` desde `origin/main`.
- [x] Merge de #76 (dependabot, 1 commit, CI verde) → integración.
- [x] Merge de #83 (chatbot Panelin, 5 commits squashed) → integración.
- [x] Diagnóstico: #81 y #59 tienen historia disjunta → **NO rebasear**, se hará cherry-pick en fase D/E.

---

## FASE B — Validación manual del preview (YO ESPERO, TÚ HACES)

**Qué hacer:**

1. Ir al PR/branch `integration/2026-04-22` en GitHub → buscar el comentario de Vercel con la URL de preview.
2. Abrir la URL de preview en el navegador.
3. Probar:
   - [ ] Cotización de techo (1 zona simple)
   - [ ] Cotización combinada (techo + pared)
   - [ ] Cámara frigorífica
   - [ ] Vista 2D del plano de cotas
   - [ ] Panel de chat Panelin (nuevo de #83) — enviar 3 mensajes, verificar que no se repiten
   - [ ] Dev Mode (Ctrl+Shift+D) — la nueva UI de KB con búsqueda/paginación carga sola
   - [ ] Exportar PDF
4. Si algo falla, reportar antes de avanzar.

**Tiempo estimado:** 10-15 minutos.

**Si falla:** nos detenemos. Integración queda pausada. Producción sigue intacta.

---

## FASE C — Promover `integration` → `main` (solo si Fase B fue OK)

**NO hacemos fast-forward directo.** Abrimos un PR "integración" y lo mergeamos con audit trail.

### Paso C.1 — Abrir PR de integración
```bash
# Ya pusheamos la rama; abrimos PR desde integration/2026-04-22 → main
gh pr create --base main --head integration/2026-04-22 \
  --title "release: integration 2026-04-22 (#76 deps + #83 chat)" \
  --body "Batch: PR #76 (deps bump) + PR #83 (Panelin chatbot). Ya validados en Vercel preview."
```
(Usaré el MCP de GitHub, no `gh`.)

### Paso C.2 — Merge del PR de integración
Método: **merge commit** (preserva que fueron 2 PRs distintos, no 1 squash).

### Paso C.3 — Verificación post-merge
```bash
git checkout main && git pull --ff-only origin main
npm run gate:local:full   # validación final contra main real
```

### Paso C.4 — Monitoreo de Vercel producción
- Vercel auto-despliega `main` en prod tras el merge.
- Smoke test en `calculadora-bmc.vercel.app` — mismo checklist que Fase B.

### Rollback si algo rompe después del merge
```bash
# Revertir PRs individuales (crea commits de reverso, no borra historia)
git revert -m 1 <merge_sha>
git push origin main
```
Vercel redeploya automáticamente el estado anterior en ~2 min.

---

## FASE D — Recuperar PR #81 (pricing + security) por cherry-pick

**Por qué cherry-pick:** #81 tiene historia disjunta con `main` (sin merge base común). Rebasar borraría la base del proyecto. Los dos commits realmente valiosos son:

- `294c4fe` — *"fix: resolve pricing anomalies, SKU dupes, security gaps…"* (+423 / −84, 9 archivos)
- `46814fe` — *"Add full budget log CSV export with BOM line item details"*

### Paso D.1 — Crear rama limpia desde `main` actualizado
```bash
git checkout main && git pull --ff-only origin main
git checkout -b recovery/81-pricing-security
```

### Paso D.2 — Cherry-pick de los commits reales
```bash
git cherry-pick 294c4fe 46814fe
```

### Paso D.3 — Si hay conflictos: PARO y reporto
No auto-resuelvo. Te muestro diff y decidimos juntos.

### Paso D.4 — Si cherry-pick limpio: gate local
```bash
npm run gate:local:full
npm run test:api
```

### Paso D.5 — Abrir PR nuevo contra `main`
```bash
git push -u origin recovery/81-pricing-security
# Abrir PR nuevo: "recover: PR #81 — pricing anomalies + SKU + security (cherry-picked)"
```

### Paso D.6 — Cerrar PR #81 original
Con un comentario que linkee al PR nuevo. **No se borra la rama original** — queda como archivo.

### Rollback
- Si el cherry-pick sale mal antes de pushear: `git reset --hard main` en la rama de recuperación.
- Si ya pusheé: cerrar el PR sin mergear. `main` intacto.

---

## FASE E — Recuperar PR #59 (roof preview display modes) por cherry-pick

Mismo procedimiento que Fase D, con los commits:
- `4740548` — *"feat: add local roof preview display modes and stabilize panel layout verification"*
- `cbf3713` — *"chore: polish roof preview mode sync and verification messaging"*

Rama de recuperación: `recovery/59-display-modes`.

---

## FASE F — PR #79 (ALSA headers CI fix, bajo riesgo)

Este PR sí tiene merge base válido (solo 4 commits detrás de main). Procedimiento normal:

1. Retarget `base` del PR #79 de `claude/fix-optional-key-access-Ybkq9` → `main` (vía MCP).
2. Verificar mergeable.
3. Squash-merge a `main`.
4. Verificar CI.

**Riesgo:** casi cero. Es un cambio de `.github/workflows/*.yml` (ALSA headers para el workflow de knowledge-antenna).

---

## FASE G — Limpieza de ramas viejas (NO SE HACE HOY)

Producir tabla de 18 ramas ≥200 commits atrás (ya está en el reporte de la sesión). Decidir **una por una** contigo, en una sesión futura.

**NO se borra nada ni se cierra ningún PR en automático.**

---

## Checkpoints de seguridad (cada N pasos)

Después de cada fase crítica:

- [ ] `git log origin/main -1` — ¿está donde debería estar?
- [ ] `calculadora-bmc.vercel.app` — ¿carga y funciona?
- [ ] Smoke manual: una cotización simple debe dar el mismo total que ayer.
- [ ] `npm run gate:local:full` — ¿verde?

Si cualquiera de estos falla: **stop, investigar, no avanzar.**

---

## Orden sugerido

| Orden | Fase | ¿Quién actúa? | Riesgo |
|---|---|---|---|
| 1 | A (hecha) | yo | 0 |
| 2 | B — QA manual del preview | **tú** | 0 (es lectura) |
| 3 | C — promover a main | yo | bajo (PR + CI + rollback vía revert) |
| 4 | F — #79 CI fix | yo | muy bajo |
| 5 | D — recovery de #81 | yo | bajo (cherry-pick en rama nueva) |
| 6 | E — recovery de #59 | yo | bajo (cherry-pick en rama nueva) |
| 7 | G — limpieza de ramas viejas | **tú decides caso por caso** | 0 hasta decisión |

---

## Qué NO haremos bajo ningún caso

- ❌ `git push --force` a `main` o a cualquier rama no propia.
- ❌ Borrar ramas remotas sin confirmación explícita.
- ❌ Cerrar PRs de otros autores sin avisar.
- ❌ Mergear con tests rojos.
- ❌ Mergear sin preview de Vercel OK.
- ❌ Modificar historia de `main`.
- ❌ Tocar `.env`, `tokenStore.js` o credenciales sin revisión de seguridad explícita.

---

## Contexto de emergencia

Si en cualquier momento algo se siente mal:

```bash
# 1. Ver dónde está main realmente
git fetch origin && git log origin/main -5

# 2. Ver qué commits nuevos hay en integración que NO están en main
git log origin/main..origin/integration/2026-04-22 --oneline

# 3. Rollback completo de la sesión (borra integración, no toca main)
git push origin --delete integration/2026-04-22
```

Si producción muestra un bug después de promover:

```bash
# Revertir el último merge a main (crea commit de reverso, NO reescribe historia)
git checkout main && git pull
git revert -m 1 <sha-del-merge>
git push origin main
# Vercel redeploya en ~2 min
```
