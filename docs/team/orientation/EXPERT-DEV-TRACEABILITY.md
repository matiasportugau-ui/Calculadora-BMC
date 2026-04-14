# Expert dev traceability — local workflow, prod updates, checkpoints

Objetivo: **trazabilidad** entre versión de `package.json`, commit Git y momentos del flujo experto (local → calidad → pre-deploy → producción), con **checkpoints** restaurables vía Git.

## Comandos npm

| Comando | Uso |
|--------|-----|
| `npm run expert:workflow` | Imprime el flujo recomendado (URLs y gates). |
| `npm run expert:checkpoint` | Guarda un snapshot JSON en `.cursor/dev-checkpoints/` (gitignored). |
| `npm run expert:checkpoint -- --message="texto"` | Igual, con nota libre. |
| `npm run expert:checkpoints` | Lista snapshots (más reciente primero). |
| `npm run expert:restore-hint -- <id-o-archivo>` | Muestra pasos manuales de restauración (`git checkout`, gates). |

## Qué guarda cada checkpoint

- `package.version` / `package.name`
- `node` (versión de Node)
- Git: `sha`, rama, si hay cambios sin commitear (líneas de `git status --porcelain`)
- Enlaces de workflow: `gate:local:full`, `pre-deploy`, `smoke:prod`, URLs local/prod
- `restore.gitCheckout`: comando sugerido para volver al commit exacto (HEAD del momento)

Los archivos **no** sustituyen a `git tag` para releases compartidos: sirven como **bitácora local** antes de cambios arriesgados o entre sesiones.

## Flujo recomendado (alto nivel)

1. **Arranque:** `npm run workspace:start`
2. **Desarrollo:** `npm run dev:full` — API `http://localhost:3001/health`, Vite `http://localhost:5173`
3. **Antes de un cambio grande:** `npm run expert:checkpoint -- --message="antes de refactor X"`
4. **Calidad:** `npm run gate:local` o `npm run gate:local:full`
5. **Pre-deploy (API local o `BMC_API_BASE`):** `npm run pre-deploy`
6. **Producción:** deploy según [`.cursor/skills/bmc-calculadora-deploy-from-cursor/SKILL.md`](../../../.cursor/skills/bmc-calculadora-deploy-from-cursor/SKILL.md); verificación `npm run smoke:prod`
7. **Cadena opcional (conocimiento + brújula + gate):** `npm run development:chain` / `development:chain:full`

## Restauración

1. Ver checkpoints: `npm run expert:checkpoints`
2. Ver instrucciones: `npm run expert:restore-hint -- cp-2026-04-09T12-30-00-000Z` (ajustar al nombre del archivo sin `.json` si aplica)
3. Ejecutar en terminal los `git` indicados; luego `npm run gate:local:full`

Para releases de equipo, preferir **tags** Git y entradas en `docs/team/PROJECT-STATE.md` (Cambios recientes). **Índice semver desde el inicio del repo:** [`VERSION-HISTORY-BMC-CALC.md`](./VERSION-HISTORY-BMC-CALC.md).
