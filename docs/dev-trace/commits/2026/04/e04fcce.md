# Commit e04fcce

- Fecha: 2026-04-24
- Hora: 23:07:30
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: test
- Scope: ml-auto
- Commit: test(ml-auto): smoke test script for /api/ml/auto-mode endpoints

## Resumen
smoke test script for /api/ml/auto-mode endpoints

## Descripción
Este cambio registra el commit `test(ml-auto): smoke test script for /api/ml/auto-mode endpoints` dentro del sistema de trazabilidad del proyecto. Se modificaron 2 archivos: package.json, scripts/test-ml-auto-mode.sh.

Contexto del commit:
npm run test:ml-auto       — local :3001 (auto-starts server)
npm run test:ml-auto:prod  — Cloud Run production

10 checks: GET public, autoMode key, auth enforcement, bad body,
enable/GET/disable/GET round-trip, webhook events, questions trigger

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **low**
- Áreas (prefijos): scripts

## Archivos modificados
- package.json
- scripts/test-ml-auto-mode.sh

## Diff summary
```text
package.json                 |   2 +
 scripts/test-ml-auto-mode.sh | 132 +++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 134 insertions(+)
```

## Riesgo de cambio (tamaño / extensiones)
Verde
