# Flujo Cotizaciones → Sheets

**Propósito:** Qué campos se envían, en qué orden, qué validaciones. Integración Calculadora con Master_Cotizaciones.

---

## PUSH desde Calculadora (5173)

| Acción | Endpoint | Campos clave |
|--------|----------|--------------|
| Crear cotización | POST /api/cotizaciones | COTIZACION_ID, CLIENTE_NOMBRE, items, total, etc. |
| Actualizar | PATCH /api/cotizaciones/:id | Campos a actualizar |

---

## Campos enviados (referencia)

| Campo | Origen | Destino Sheet |
|-------|--------|---------------|
| COTIZACION_ID | Generado o existente | Master_Cotizaciones / CRM_Operativo |
| CLIENTE_NOMBRE | Formulario | Idem |
| Items / BOM | Cálculo | Serializado |
| Total | calcTotalesSinIVA | Idem |

---

## Validaciones

- COTIZACION_ID único
- Campos requeridos según planilla-inventory
- AUDIT_LOG: append en cada PUSH

---

## Referencias

- server/routes/bmcDashboard.js (POST /api/cotizaciones)
- planilla-inventory
- DASHBOARD-INTERFACE-MAP
