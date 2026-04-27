# AUTOTRACE — Development status

- Total commits documentados: **302**
- Distribución por tipo:
  - chore: 65
  - docs: 55
  - feat: 97
  - fix: 78
  - other: 2
  - test: 5
- Distribución por riesgo (tamaño/extensiones):
  - Amarillo: 31
  - Rojo: 2
  - Verde: 269
- Impacto release sugerido (heurística):
  - low: 196
  - med: 106

## Atención QA — posible regresión (heurística)

- `3a7b3bf` 2026-04-27 — fix(docker): add system Chromium to Dockerfile.bmc-dashboard for PDF generation — impacto: low
- `d12f8f1` 2026-04-27 — fix(pdf): install Alpine Chromium + fix html2pdf Shadow DOM fallback — impacto: med
- `5c41030` 2026-04-24 — fix(data): remove ISODEC_EPS_PARED — producto inexistente — impacto: med

---

_Las señales `possible_regression`, `tests_touched` y `release_impact` son heurísticas locales; validar en CI y smoke antes de release._
