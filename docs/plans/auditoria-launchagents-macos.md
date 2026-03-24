# Plan: Auditoría LaunchAgents macOS

**Origen:** `~/.cursor/plans/auditoría_launchagents_macos_104d5796.plan.md`  
**Estado:** Implementado. El script de auditoría forma parte de la revisión (run_audit.sh paso 10).

## Objetivo

Profundizar el reporte con verificación en disco: alinear riesgos con el contenido real de los plists, enlazar `com.bmc.drive-cleanup` con el repo, detectar **nuevos** y **regenerados** (archivamos, la app los recreó), y documentar cuándo y para qué está cada uno.

## Artefactos en el repo

| Artefacto | Uso |
|-----------|-----|
| [scripts/audit-launchagents-matias.sh](../../scripts/audit-launchagents-matias.sh) | Audit: plutil, paths, vendor/custom, score, status new/regenerated |
| [scripts/launchagents-manifest.md](../../scripts/launchagents-manifest.md) | Descripciones: cuándo corre cada plist y para qué |
| [scripts/mac-launchagents-unload-blocklist.sh](../../scripts/mac-launchagents-unload-blocklist.sh) | Descartar/archivar plists por blocklist |
| [scripts/mac-launchagents-restore-from-archive.sh](../../scripts/mac-launchagents-restore-from-archive.sh) | Restaurar desde `~/Library/LaunchAgents-disabled/` |
| [LAUNCHAGENTS-AUDIT-REPORT.md](../LAUNCHAGENTS-AUDIT-REPORT.md) | Informe detallado, rankings, decisiones DB/Dropbox |

## Integración en la revisión

El audit se ejecuta en el **paso 10** de `run_audit.sh` (Super Agente BMC / bmc-dashboard-audit-runner):

```bash
bash .cursor/skills/super-agente-bmc-dashboard/scripts/run_audit.sh --output=.cursor/bmc-audit/latest-report.md
```

## Detección

- **Nuevos:** plists en `~/Library/LaunchAgents/` que no están en la lista conocida.
- **Regenerados:** plists que archivamos (existen en `~/Library/LaunchAgents-disabled/`) y la app los recreó en LaunchAgents.

## Priorización (del plan original)

- **Rojo:** Mercado, Autopilot — auditar contenido y necesidad.
- **Ámbar:** drive-cleanup, Lacan+, PostgreSQL, MongoDB — custom o DB.
- **Verde:** Dropbox vacíos, uTorrent, Epic, Sandbox, MEGA, Atlas — bajo riesgo o limpieza.
