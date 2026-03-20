# E2E Validation Checklist — Dashboard BMC

**Owner:** Audit/Debug + Matias  
**Referencia:** IMPLEMENTATION-PLAN-POST-GO-LIVE.md §D1  
**Última actualización:** 2026-03-20

Completar antes de presentar el dashboard a usuarios finales. Marcar con ✓ cuando se verifique.

---

## URLs producción (opcional — mismo checklist sustituyendo base URL)

| Entorno | Base URL | Notas |
|---------|----------|--------|
| **Cloud Run** | `https://panelin-calc-642127786762.us-central1.run.app` (o la URL actual de `gcloud run services describe panelin-calc`) | API: `<BASE>/api/...`; Calculadora: `<BASE>/calculadora`; Finanzas: `<BASE>/finanzas`. |
| **Vercel** | `https://calculadora-bmc.vercel.app` | Front calculadora; API debe apuntar a Cloud Run (`VITE_API_URL`) para datos Sheets. |

Ejemplo: `curl -sS -o /dev/null -w "%{http_code}" "https://…/api/health"` o `/api/kpi-report` (esperar 200 o 503 según config).

---

## Pre-requisitos

- [ ] Servidor API corriendo (`npm run start:api` o equivalente)
- [ ] Workbook principal compartido con la service account (email del JSON de credenciales)
- [ ] .env con BMC_SHEET_ID (y workbooks adicionales si aplica)

---

## Checklist E2E

| ID | Check | Cómo verificar | Estado |
|----|-------|----------------|--------|
| D1.1 | Compartir workbook principal con service account | En Google Drive: compartir el workbook con el email del service account (lectura/escritura según necesidad) | ⬜ |
| D1.2 | /api/cotizaciones con datos reales | `curl http://localhost:3001/api/cotizaciones` → 200 y array con al menos un elemento (o 503 si Sheets no disponible) | ⬜ |
| D1.3 | /api/kpi-financiero retorna monedas reales | `curl http://localhost:3001/api/kpi-financiero` → 200 y payload con monedas/periodos | ⬜ |
| D1.4 | /api/kpi-report 200 | `curl http://localhost:3001/api/kpi-report` → 200 (o 503 si Sheets no configurado). Si 404: reiniciar servidor (ruta existe en bmcDashboard.js línea ~1130, montada en /api). | ⬜ |
| D1.5 | Marcar entregado en UI → verificar en Sheet | En dashboard #operaciones: "Marcar entregado" en una fila → abrir la Sheet y comprobar que el estado/campo se actualizó | ⬜ |
| D1.6 | Notificaciones bell → verificar datos | Clic en campana; ver que cargan notificaciones (o mensaje vacío si no hay) | ⬜ |
| D1.7 | Calculadora 5173 → PDF → Drive | Abrir Calculadora (puerto 5173); generar PDF; verificar que aparece en Google Drive configurado | ⬜ |
| D1.8 | Shopify webhook test | Si aplica: enviar webhook de prueba; verificar que se recibe y se procesa (o documentar skip) | ⬜ |

---

## Notas

- **kpi-report 404:** La ruta está definida en `server/routes/bmcDashboard.js` y el router se monta en `server/index.js` como `app.use("/api", createBmcDashboardRouter(config))`. Si el servidor se inició antes de añadir la ruta, hace falta reiniciar.
- **503:** Respuesta esperada cuando Sheets no está configurado o no hay credenciales; no es fallo de ruta.
- Al completar, actualizar PROJECT-STATE (Pendientes) y opcionalmente JUDGE si fue run formal.
