# `docs/archive/` — Archivo histórico (sólo referencia)

Esta carpeta contiene archivos retirados del código activo pero preservados físicamente en el repo por valor de referencia / auditoría.

**Reglas:**
- **No importar** desde código activo (`src/`, `server/`, `tests/`, `scripts/`).
- ESLint, build (Vite) y tests no procesan esta carpeta.
- El contenido refleja un punto en el tiempo. No mantener actualizado.

## Inventario

### `PanelinCalculadoraV3_legacy_inline.jsx`

- **Tamaño:** 2351 líneas
- **Origen:** `src/components/PanelinCalculadoraV3_legacy_inline.jsx`
- **Retirado de `src/`:** 2026-04-30 (commit del refactor `chore(calc): rename _backup → canonical`)
- **Último cambio funcional:** 2026-04-14
- **Importadores en código activo al momento del retiro:** ninguno
- **Razón de archivado:** versión monolítica original de la Calculadora BMC, anterior a la unificación / modularización que llevó al canónico actual (`src/components/PanelinCalculadoraV3.jsx`). Inlineaba lógica que hoy vive en módulos compartidos (`src/utils/calculations.js`, `src/data/constants.js`). No tiene contenido único respecto al canónico.

**Recuperación de versiones aún más viejas:**

```bash
# Lista los commits que tocaron el archivo (antes del retiro):
git log --oneline -- src/components/PanelinCalculadoraV3_legacy_inline.jsx

# Restaura una versión específica (reemplazá <sha> por el commit deseado):
git show <sha>:src/components/PanelinCalculadoraV3_legacy_inline.jsx > /tmp/legacy.jsx
```
