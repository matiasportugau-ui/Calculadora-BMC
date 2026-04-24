# Commit 3a2ceb2

- Fecha: 2026-04-24
- Hora: 05:28:42
- Autor: matiasportugau-ui
- Email: matias.portugau@gmail.com
- Branch: main
- Tipo: fix
- Scope: smoke
- Commit: fix(smoke): add WhatsApp webhook liveness check to smoke-prod

## Resumen
add WhatsApp webhook liveness check to smoke-prod

## Descripción
Este cambio registra el commit `fix(smoke): add WhatsApp webhook liveness check to smoke-prod` dentro del sistema de trazabilidad del proyecto. Se modificaron 14 archivos: .accessible-base/kb.json, docs/dev-trace/AUTOTRACE-CHANGELOG.md, docs/dev-trace/AUTOTRACE-STATUS.md, docs/dev-trace/AUTOTRACE-UNRELEASED.md, docs/dev-trace/commits/2026/04/3cdcbde.md y 9 más.

Contexto del commit:
GETs /webhooks/whatsapp with probe token — accepts 200 or 403 (route alive),
fails on 404/5xx. Also security note: WHATSAPP_APP_SECRET must be set in
Cloud Run Secret Manager to enable HMAC verification.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

## Señales automáticas (QA / release)
- Posible regresión (heurística): **no**
- Tests / validación tocados: **no**
- Breaking mencionado: **no**
- Impacto release sugerido: **med**
- Áreas (prefijos): .accessible-base, docs, scripts, src

## Archivos modificados
- .accessible-base/kb.json
- docs/dev-trace/AUTOTRACE-CHANGELOG.md
- docs/dev-trace/AUTOTRACE-STATUS.md
- docs/dev-trace/AUTOTRACE-UNRELEASED.md
- docs/dev-trace/commits/2026/04/3cdcbde.md
- docs/dev-trace/commits/2026/04/51a7795.md
- docs/dev-trace/commits/2026/04/5adc909.md
- docs/dev-trace/commits/2026/04/ed1c034.md
- docs/dev-trace/commits/2026/04/f2709c3.md
- docs/dev-trace/commits/2026/04/fe9b447.md
- docs/dev-trace/commits/index.json
- docs/dev-trace/worklog/2026/04/2026-04-24.md
- scripts/smoke-prod-api.mjs
- src/data/calculatorDataVersion.js

## Diff summary
```text
.accessible-base/kb.json                     |  16 +--
 docs/dev-trace/AUTOTRACE-CHANGELOG.md        |   6 +
 docs/dev-trace/AUTOTRACE-STATUS.md           |  16 +--
 docs/dev-trace/AUTOTRACE-UNRELEASED.md       |   6 +
 docs/dev-trace/commits/2026/04/3cdcbde.md    |  57 +++++++++
 docs/dev-trace/commits/2026/04/51a7795.md    |  48 ++++++++
 docs/dev-trace/commits/2026/04/5adc909.md    |  45 +++++++
 docs/dev-trace/commits/2026/04/ed1c034.md    |  35 ++++++
 docs/dev-trace/commits/2026/04/f2709c3.md    |  57 +++++++++
 docs/dev-trace/commits/2026/04/fe9b447.md    |  39 ++++++
 docs/dev-trace/commits/index.json            | 175 +++++++++++++++++++++++++++
 docs/dev-trace/worklog/2026/04/2026-04-24.md | 109 +++++++++++++++++
 scripts/smoke-prod-api.mjs                   |  23 +++-
 src/data/calculatorDataVersion.js            |   2 +-
 14 files changed, 615 insertions(+), 19 deletions(-)
```

## Riesgo de cambio (tamaño / extensiones)
Amarillo
