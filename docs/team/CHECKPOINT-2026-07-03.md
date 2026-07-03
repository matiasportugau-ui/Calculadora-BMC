# Checkpoint estable — 2026-07-03 (v3.1.5)

Punto de recuperación completo del estado **funcional y verificado** del proyecto.
Si algo se rompe más adelante, todo lo listado acá permite volver exactamente a este estado.

## Qué captura este checkpoint

| Referencia | Valor |
|---|---|
| Commit (referencia inmutable) | `ce6fe2a2cc990360c7a4fd6ffb9b0787e82aadf8` |
| Rama de backup | `claude/backup-checkpoint-vsfvlt` |
| Versión | `calculadora-bmc@3.1.5` |
| Último merge incluido | PR #538 — prod-smoke alerts (gh#495) |

> **Tag recomendado (crear desde una máquina con permisos de push de tags):**
>
> ```bash
> git tag -a checkpoint-2026-07-03 ce6fe2a -m "Checkpoint estable 2026-07-03 — v3.1.5"
> git push origin checkpoint-2026-07-03
> ```
>
> La sesión remota que creó este checkpoint solo pudo empujar la rama (el proxy de git
> rechaza tags con 403). Mientras el tag no exista, usar el SHA `ce6fe2a` en los comandos
> de abajo — es exactamente equivalente.

## Verificación realizada

- **CI de GitHub verde en `main`** para exactamente este commit (lint, tests, build, env-drift, smoke).
- `npm run gate:local` corrido sobre este commit: lint OK, suite offline OK, tests de API OK
  (única excepción: 1 test de `tests/suggestResponseKb.test.js` que exige `details` no vacío
  falla **solo en contenedores con proxy HTTPS** porque el error de red llega con otra forma;
  en CI y en máquinas normales pasa).

## Cómo restaurar

### Ver el estado del checkpoint (sin tocar nada)

```bash
git fetch origin
git checkout ce6fe2a   # o checkpoint-2026-07-03 si el tag ya fue creado
```

### Recuperar TODO el repo a este estado (rama nueva de rescate — recomendado)

```bash
git fetch origin
git checkout -b rescue-desde-checkpoint ce6fe2a
```

Después se puede abrir un PR de esa rama hacia `main` para restaurar formalmente.

### Recuperar UN solo archivo roto

```bash
git checkout ce6fe2a -- src/utils/calculations.js
```

### Comparar el estado actual contra el checkpoint

```bash
git diff ce6fe2a -- src/ server/
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
