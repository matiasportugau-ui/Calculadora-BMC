# `docs/team/architecture/`

Documentos de **referencia arquitectónica** del Calculadora-BMC / Panelin. Distinto a `docs/team/housekeeping/` (operacional) o `docs/team/knowledge/` (especificaciones técnicas).

## Documentos

- **`system-map-and-pending.md`** — vista única del sistema (Mermaid) + mapa de los PRs abiertos sobre los módulos + impact analysis si se mergeara. Es un doc *vivo*: refresca cada ~2-4 semanas o tras cleanups grandes.

## Cómo regenerar `system-map-and-pending.md`

1. Invocar la skill `bmc-branch-cleanup` para obtener snapshot de branches + PRs.
2. Correr `gh pr list --state open --json number,headRefName,title,mergeable,reviewDecision,additions,deletions,changedFiles` y volcar el JSON.
3. Mapear cada PR no-draft a un módulo según los archivos que toca (usar la tabla §2 del doc).
4. Actualizar el diagrama overlay (§3) con colores por bucket (rojo=conflicts, amarillo=failing, verde=ready).
5. Re-escribir las PR cards (§4) y la simulación (§5).
6. Ajustar la secuencia de merge (§6) según las dependencias actuales.

Renderiza nativo en GitHub web, Cursor, VSCode (Mermaid soportado desde 2022).
