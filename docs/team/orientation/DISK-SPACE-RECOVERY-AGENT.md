# Agente de recuperación de disco (espacio + reanudar)

Procedimiento para **Cursor** cuando falta espacio y se interrumpe un flujo.

## Enlace técnico

| Artefacto | Ruta |
|-----------|------|
| Regla Cursor (`alwaysApply: true`) | `.cursor/rules/disk-space-recovery.mdc` |
| Skill operativa | `.cursor/skills/disk-space-recovery-resume/SKILL.md` |
| Límites de seguridad | `.cursor/skills/drive-space-optimizer/SKILL.md` |
| Chequeo antes de dev/build | `npm run disk:precheck` → `scripts/disk-space-precheck.sh` |
| Auditoría solo lectura | `npm run mac:storage-audit` |

## Resumen

1. **Palabra final del usuario:** ningún borrado ni vaciado sin **aprobación explícita** sobre el plan agrupado.
2. **Activación automática en el repo:** `npm run dev` y `npm run build` ejecutan `disk:precheck` antes; si falta espacio, el comando falla y el mensaje invita a usar el agente en Cursor (proponer → aprobar → ejecutar → **reanudar** el `dev`/`build` o la tarea que falló).
3. Auditoría sin cambios: `npm run mac:storage-audit`.

## Variables de entorno (`disk-space-precheck`)

| Variable | Efecto |
|----------|--------|
| `BMC_DISK_PRECHECK_SKIP=1` | Omite el chequeo (CI, emergencia). |
| `BMC_DISK_MIN_FREE_MIB` | Mínimo de MiB libres (default **1024**). |
| `BMC_DISK_PRECHECK_MODE=warn` | Solo imprime advertencia; **no** falla `dev`/`build`. |
