# AUTOTRACE — Development status

- Total commits documentados: **334**
- Distribución por tipo:
  - chore: 69
  - docs: 64
  - feat: 108
  - fix: 86
  - other: 2
  - test: 5
- Distribución por riesgo (tamaño/extensiones):
  - Amarillo: 32
  - Rojo: 2
  - Verde: 300
- Impacto release sugerido (heurística):
  - low: 213
  - med: 121

## Atención QA — posible regresión (heurística)

- `da4afca` 2026-04-29 — fix(security): require API_AUTH_TOKEN on interaction-log + voice-session — impacto: med
- `6cc7b08` 2026-04-27 — fix(kb): await GCS init before KB reads — cold-start race condition — impacto: med
- `3a7b3bf` 2026-04-27 — fix(docker): add system Chromium to Dockerfile.bmc-dashboard for PDF generation — impacto: low
- `d12f8f1` 2026-04-27 — fix(pdf): install Alpine Chromium + fix html2pdf Shadow DOM fallback — impacto: med
- `5c41030` 2026-04-24 — fix(data): remove ISODEC_EPS_PARED — producto inexistente — impacto: med

---

_Las señales `possible_regression`, `tests_touched` y `release_impact` son heurísticas locales; validar en CI y smoke antes de release._
