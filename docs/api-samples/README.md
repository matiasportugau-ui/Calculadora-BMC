# Muestras de respuesta API

**Propósito:** JSON de ejemplo por endpoint. Para validar contratos y que Mapping/Contract detecten drift.

**Cómo generar:** Con el servidor corriendo, ejecutar:
```bash
curl -s http://localhost:3001/api/kpi-financiero | jq . > docs/api-samples/kpi-financiero.json
```

---

## Endpoints documentados

| Endpoint | Archivo |
|----------|---------|
| /api/kpi-financiero | kpi-financiero.json |
| /api/proximas-entregas | proximas-entregas.json |
| /api/kpi-report | kpi-report.json |

---

## Nota

Los archivos .json pueden estar vacíos o ser placeholders hasta que se ejecute el servidor con datos reales. Actualizar tras cada cambio de contrato.
