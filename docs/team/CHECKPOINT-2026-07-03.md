# Checkpoint estable — 2026-07-03 (v3.1.5)

Punto de recuperación completo del estado **funcional y verificado** del proyecto.
Si algo se rompe más adelante, todo lo listado acá permite volver exactamente a este estado.

## Qué captura este checkpoint

| Referencia | Valor |
|---|---|
| Commit | `ce6fe2a2cc990360c7a4fd6ffb9b0787e82aadf8` |
| Tag git (inmutable) | `checkpoint-2026-07-03` |
| Rama de backup | `claude/backup-checkpoint-vsfvlt` |
| Versión | `calculadora-bmc@3.1.5` |
| Último merge incluido | PR #538 — prod-smoke alerts (gh#495) |

## Verificación realizada

- **CI de GitHub verde en `main`** para exactamente este commit (lint, tests, build, env-drift, smoke).
- `npm run gate:local` corrido sobre este commit: lint OK, suite offline OK, tests de API OK
  (única excepción: 1 test de `tests/suggestResponseKb.test.js` que exige `details` no vacío
  falla **solo en contenedores con proxy HTTPS** porque el error de red llega con otra forma;
  en CI y en máquinas normales pasa).

## Cómo restaurar

### Ver el estado del checkpoint (sin tocar nada)

```bash
git fetch --tags origin
git checkout checkpoint-2026-07-03
```

### Recuperar TODO el repo a este estado (rama nueva de rescate — recomendado)

```bash
git fetch --tags origin
git checkout -b rescue-desde-checkpoint checkpoint-2026-07-03
```

Después se puede abrir un PR de esa rama hacia `main` para restaurar formalmente.

### Recuperar UN solo archivo roto

```bash
git checkout checkpoint-2026-07-03 -- src/utils/calculations.js
```

### Comparar el estado actual contra el checkpoint

```bash
git diff checkpoint-2026-07-03 -- src/ server/
```

### Volver `main` atrás (solo si un merge rompió producción)

**No usar `reset --hard` sobre `main`.** Revertir el merge malo preserva el historial:

```bash
git revert -m 1 <sha-del-merge-malo>
```

## Qué NO cubre este checkpoint

- **Secretos / `.env`** — nunca se versionan. Los valores viven en Vercel, Cloud Run
  (Secret Manager) y la copia local de cada operador.
- **Datos de Postgres** (Transportista, WA Cockpit, TraKtiMe) — el esquema se recrea con
  `npm run transportista:migrate` / `wa:migrate` / `traktime:migrate`, pero los datos
  dependen del backup de la base.
- **Planillas de Google Sheets** — viven en Drive, fuera del repo.
- **Deploys**: Vercel guarda cada deployment (rollback desde el dashboard de Vercel);
  Cloud Run guarda revisiones del servicio `panelin-calc` (rollback de revisión en la consola).

## Regla de mantenimiento

Antes de un cambio grande o riesgoso, crear un nuevo checkpoint con el mismo patrón:

```bash
git tag -a checkpoint-AAAA-MM-DD <sha-verde-en-CI> -m "Checkpoint estable AAAA-MM-DD"
git push origin checkpoint-AAAA-MM-DD
```

y documentarlo con un archivo como este en `docs/team/`.
