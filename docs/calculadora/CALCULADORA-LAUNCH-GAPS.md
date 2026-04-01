# Gaps de producto — cierre antes del launch oficial (Calculadora)

Lista de trabajo para **cerrar o validar** antes de declarar el release **v1 oficial** de la Calculadora en producción canónica ([`CANONICAL-PRODUCTION.md`](./CANONICAL-PRODUCTION.md)). No sustituye el checklist de release operativo ([`RELEASE-CHECKLIST-CALCULADORA.md`](./RELEASE-CHECKLIST-CALCULADORA.md)).

---

## Alcance del launch vs otros workstreams

| Área | Relación con launch Calculadora |
|------|----------------------------------|
| **Calculadora** (`/calculadora/`) | **In scope** — mobile, PDF, costeo, MATRIZ, shell principal |
| **Logística** (`/logistica/`, prototipos en `docs/…/logistica-carga-prototype`) | **Fuera del launch core** salvo decisión explícita; verificar que el selector en [`src/App.jsx`](../../src/App.jsx) no rompa la ruta por defecto de la calculadora |
| **CRM / ML / correo / Finanzas** | Capacidades del mismo servicio Cloud Run; **no** bloquean el launch de “cotizador + precios” si no están en el contrato comercial del release |

---

## 1. Mobile y pantallas

- [ ] **Viewport:** Comportamiento aceptable en ~375px y tablet (layout compacto, sin solapamiento crítico).
- [ ] **Tabla BOM:** Scroll horizontal donde aplique; totales legibles.
- [ ] **Barra inferior móvil:** Accesos WA/PDF operativos.
- [ ] **Modales (PDF preview):** Botones y iframe usables en pantalla pequeña.

**Código de referencia:** [`src/components/PanelinCalculadoraV3_backup.jsx`](../../src/components/PanelinCalculadoraV3_backup.jsx) (responsive + `MobileBottomBar` + `PDFPreviewModal`).

---

## 2. PDF y hoja cliente

- [ ] **PDF A4:** Márgenes y tipografía legibles; tabla BOM no cortada de forma inaceptable.
- [ ] **Vista previa / imprimir:** Flujo completo sin error de consola bloqueante.
- [ ] **Hoja visual cliente:** Contenido alineado a política comercial (IVA explícito según corresponda).

**Utilidades:** [`src/utils/helpers.js`](../../src/utils/helpers.js), [`src/utils/quotationViews.js`](../../src/utils/quotationViews.js).

---

## 3. Costeo (administración)

- [ ] **Informe de costeo:** `buildCostingReport` recibe estructura `groups` correcta; PDF/HTML de costeo muestra totales, por grupo y líneas sin costo.
- [ ] **Cobertura de margen:** Entendimiento claro cuando falta costo de flete u otros ítems.

**Código:** [`src/utils/bomCosting.js`](../../src/utils/bomCosting.js), `generateCosteoHTML` en `quotationViews.js`.

---

## 4. MATRIZ y precios

- [ ] **Cargar desde MATRIZ:** `GET /api/actualizar-precios-calculadora` OK en prod (CSV con cabeceras esperadas incl. `venta_web` / `venta_web_iva_inc` según contrato actual).
- [ ] **PricingEditor:** Import CSV local, overrides, duplicados detectados; opcional **Escribir en MATRIZ** con token si aplica al proceso interno.

**Referencias:** [`docs/team/knowledge/MATRIZ-CALCULADORA.md`](../team/knowledge/MATRIZ-CALCULADORA.md), smoke `npm run smoke:prod`.

---

## 5. Shell y routing (`App.jsx`)

- [ ] **Ruta por defecto:** La calculadora sigue siendo el entry principal esperado.
- [ ] **Rutas adicionales** (`/logistica`, `?app=logistica`): No regresiones de carga ni conflictos con `VITE_BASE` en Vercel (rewrites) y en Cloud Run (`/calculadora/`).

**Código:** [`src/App.jsx`](../../src/App.jsx).

---

## 6. Google Drive (alcance opcional)

Decisión de release:

- [ ] **Incluido en v1:** `VITE_GOOGLE_CLIENT_ID` en build de imagen Cloud Run + orígenes OAuth para la URL base `.run.app`.
- [ ] **Excluido del v1:** Documentar en [`RELEASE-BRIEF-OFFICIAL.md`](./RELEASE-BRIEF-OFFICIAL.md) como “diferido”; la calculadora sigue usable sin Drive.

---

*Última actualización: 2026-03-31.*
