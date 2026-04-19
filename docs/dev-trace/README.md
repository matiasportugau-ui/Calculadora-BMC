# Dev trace (AUTOTRACE)

Sistema opcional de **trazabilidad por commit** que complementa el changelog editorial en [`../CHANGELOG.md`](../CHANGELOG.md).

## Qué genera

| Artefacto | Descripción |
|-----------|-------------|
| `commits/<YYYY>/<MM>/<short>.md` | Ficha del commit (autor, archivos, diff stat, señales QA). |
| `worklog/.../YYYY-MM-DD.md` | Worklog diario append-only. |
| `commits/index.json` | Índice maestro para rebuild y release notes. |
| `AUTOTRACE-UNRELEASED.md` | Vista tipo changelog agrupada por tipo. |
| `AUTOTRACE-CHANGELOG.md` | Lista compacta de commits documentados. |
| `AUTOTRACE-STATUS.md` | Conteos + lista de commits marcados posible **regresión** (heurística). |
| `AUTOTRACE-RELEASE.md` / `.html` | Release notes para un tag o rango (`release_notes.py`). |

## Señales automáticas (regresión / impacto)

Heurísticas locales basadas en mensaje, tipo de commit y rutas (p. ej. `fix` + palabras clave, toques en `tests/`, `breaking` en cuerpo). **No sustituyen** CI, smoke ni revisión humana.

## Instalación de hooks

Desde la raíz del repo:

```bash
bash tools/release-traceability/bootstrap/install_hooks.sh
```

Para **un commit sin** regenerar AUTOTRACE (p. ej. cierre de lotes de docs):

```bash
SKIP_AUTOTRACE=1 git commit ...
```

Durante `git rebase`, los hooks **no** ejecutan AUTOTRACE (evita ensuciar el índice a mitad del rebase).

## Comandos npm

- `npm run dev-trace:rebuild` — regenera markdown desde el índice.
- `npm run dev-trace:release` — genera `AUTOTRACE-RELEASE.md` y `.html` (último tag → HEAD por defecto).

## Mejores prácticas

1. **Conventional Commits** (`feat:`, `fix(scope):`, …) para clasificación limpia.
2. Incluir en el cuerpo del commit **contexto** y palabras clave cuando haya riesgo (`regression`, `revert`, etc.).
3. Antes de release: revisar `AUTOTRACE-STATUS.md` y la vista HTML.
4. Mantener `docs/CHANGELOG.md` como narrativa de producto; AUTOTRACE es **telemetría de repo**.
