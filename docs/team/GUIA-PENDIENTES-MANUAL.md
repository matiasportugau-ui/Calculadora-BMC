# Guía — Cómo hacer los pendientes manuales

**Para:** Matias  
**Última actualización:** 2026-03-19

**Resueltos desde el proyecto:** Tabs/columnas (setup-sheets-tabs), kpi-report (200 ✓), Dockerfile.bmc-dashboard.

**Pendientes manuales:** Triggers Apps Script, deploy ejecución, npm audit --force (opcional), E2E checklist.

---

## Task 1 — Tabs y columnas (desde aquí o manual)

**Opción automática — desde el proyecto:**

```bash
cd "/Users/matias/Panelin calc loca/Calculadora-BMC"
npm run setup-sheets-tabs
```

Requisitos: `.env` con `BMC_PAGOS_SHEET_ID`, `BMC_VENTAS_SHEET_ID`, `BMC_STOCK_SHEET_ID`, `BMC_CALENDARIO_SHEET_ID` y `GOOGLE_APPLICATION_CREDENTIALS`. Cada workbook debe estar **compartido con la service account** (Editor).

---

**Opción manual — checklist:**

| Workbook | Qué crear | Nombre exacto |
|----------|-----------|---------------|
| Pagos Pendientes 2026 | Tab nueva | `CONTACTOS` (solo NOMBRE \| EMAIL) |
| 2.0 - Ventas | Tab nueva | `Ventas_Consolidado` (11 columnas) |
| Stock E-Commerce | Columna al final | `SHOPIFY_SYNC_AT` (con T) |
| Calendario vencimientos | Columna en cada tab mensual | `PAGADO` |

**Nota:** Si la columna en Stock E-Commerce quedó como `SHOPIFY_SYNC_A`, renombrarla a `SHOPIFY_SYNC_AT`.

---

## 1. Tabs y triggers en Google Sheets

### 1.1 Crear tab CONTACTOS (Workbook: Pagos Pendientes 2026)

1. Abrir: https://docs.google.com/spreadsheets/d/1AzHhalsZKGis_oJ6J06zQeOb6uMQCsliR82VrSKUUsI
2. Clic en el **+** abajo (añadir hoja)
3. Nombrar la hoja: `CONTACTOS`
4. En la fila 1, escribir: `NOMBRE` | `EMAIL` (columnas A y B)
5. Opcional: añadir filas con contactos que recibirán alertas de pagos vencidos

### 1.2 Crear tab Ventas_Consolidado (Workbook: 2.0 - Ventas)

1. Abrir: https://docs.google.com/spreadsheets/d/1IMZr_qEyVi8eIlNc_Nk64eY63LHUlAue
2. Clic en **+** para añadir hoja
3. Nombrar: `Ventas_Consolidado`
4. En fila 1, escribir estos headers (uno por columna):
   ```
   COTIZACION_ID | PROVEEDOR | CLIENTE_NOMBRE | FECHA_ENTREGA | COSTO | GANANCIA | SALDO_CLIENTE | PAGO_PROVEEDOR | FACTURADO | NUM_FACTURA | FECHA_INGRESO
   ```

### 1.3 Añadir columna SHOPIFY_SYNC_AT (Workbook: Stock E-Commerce)

1. Abrir: https://docs.google.com/spreadsheets/d/1egtKJAGaATLmmsJkaa2LlCv3Ah4lmNoGMNm4l0rXJQw
2. Ir a la **primera hoja** (la principal con productos)
3. En la **última columna vacía** a la derecha, escribir en la fila 1: `SHOPIFY_SYNC_AT`
4. Dejar las celdas vacías (el script las llenará)

### 1.4 Añadir columna PAGADO (Workbook: Calendario vencimientos)

1. Abrir: https://docs.google.com/spreadsheets/d/1bvnbYq7MTJRpa6xEHE5m-5JcGNI9oCFke3lsJj99tdk
2. Ir a la hoja **MARZO 2026** (o la del mes actual)
3. En la **última columna vacía**, escribir en la fila de headers: `PAGADO`
4. Repetir para las demás hojas mensuales (ABRIL 2026, MAYO 2026, etc.)

### 1.5 Configurar triggers (Apps Script)

Para cada workbook, seguir estos pasos:

**Pagos Pendientes 2026:**
1. Extensiones > Apps Script
2. Si no existe, pegar el contenido de `docs/bmc-dashboard-modernization/PagosPendientes.gs`
3. Guardar (Ctrl+S)
4. Editar > Activadores del proyecto actual > Añadir activador
5. Crear 2 triggers:
   - Función: `alertarPagosVencidos` | Tipo: Time-driven | Diario | 8:00–9:00
   - Función: `onEdit` | Tipo: Al editar

**2.0 - Ventas:**
1. Extensiones > Apps Script
2. Pegar `docs/bmc-dashboard-modernization/VentasConsolidar.gs` si no existe
3. Crear 2 triggers:
   - `consolidarVentasDiario` | Time-driven | Diario | 7:00–8:00
   - `alertarVentasSinFacturar` | Time-driven | Semanal | Lunes 9:00–10:00

**Stock E-Commerce:**
1. Extensiones > Apps Script
2. Pegar `docs/bmc-dashboard-modernization/StockAlertas.gs` si no existe
3. Crear 2 triggers:
   - `alertarBajoStock` | Time-driven | Diario | 8:30–9:30
   - `onEdit` | Al editar

**Calendario vencimientos:**
1. Extensiones > Apps Script
2. Pegar `docs/bmc-dashboard-modernization/CalendarioRecordatorio.gs` si no existe
3. Crear trigger: `recordatorioVencimientosSemana` | Time-driven | Semanal | Lunes 8:00–9:00

**BMC crm_automatizado (Workbook 1):**
1. Extensiones > Apps Script
2. En Code.gs, buscar `sendWeeklyAlarmDigest`
3. Crear trigger: `sendWeeklyAlarmDigest` | Time-driven | Semanal | Lunes 8:00–9:00
4. Configurar Script Properties (Proyecto > Configuración del proyecto > Propiedades del script):
   - `PAGOS_SHEET_ID` = 1AzHhalsZKGis_oJ6J06zQeOb6uMQCsliR82VrSKUUsI
   - `VENTAS_SHEET_ID` = 1IMZr_qEyVi8eIlNc_Nk64eY63LHUlAue
   - `STOCK_SHEET_ID` = 1egtKJAGaATLmmsJkaa2LlCv3Ah4lmNoGMNm4l0rXJQw
   - `CALENDARIO_SHEET_ID` = 1bvnbYq7MTJRpa6xEHE5m-5JcGNI9oCFke3lsJj99tdk
   - `DASHBOARD_URL` = URL del dashboard (ej. http://localhost:3001/finanzas o la URL de producción)

---

## 2. Deploy a producción

### ⚠️ Revisión previa — qué stack usar

El proyecto tiene **dos servidores** distintos:

| Script | Puerto | Uso |
|--------|--------|-----|
| `server/index.js` (`npm run start:api`) | **3001** | **Stack actual** — API Express + rutas BMC, KPI, Shopify, ML |
| `sheets-api-server.js` (`npm run bmc-dashboard`) | 3849 | Legacy/standalone — solo Sheets API |

**Para deploy productivo usar siempre:** `npm run start:api` y puerto **3001**.

---

### Primeros pasos (VPS Netuy) — revisados

| Paso | Acción | Notas |
|------|--------|-------|
| 1 | SSH al servidor | `ssh usuario@tu-servidor.netuy.com.uy` |
| 2 | Node.js 18+ | `node -v` — si no está: `nvm install 18` o instalar desde distro |
| 3 | Clonar repo | `git clone https://github.com/matiasportugau-ui/Calculadora-BMC.git` |
| 4 | `npm install` | `cd Calculadora-BMC && npm install` |
| 5 | Build frontend | `npm run build` — genera `dist/` para servir estático |
| 6 | Crear `.env` | Copiar de tu Mac o usar `.env.example` como plantilla |
| 7 | Subir service account | Copiar `service-account.json` a una ruta segura en el servidor |
| 8 | Probar local | `npm run start:api` → `curl http://localhost:3001/health` |
| 9 | PM2 | `pm2 start npm --name bmc-dashboard -- run start:api` |
| 10 | Nginx | Reverse proxy 80/443 → 3001 |
| 11 | Certbot | `certbot --nginx -d tudominio.com` |

### Variables `.env` mínimas para deploy

```bash
BMC_SHEET_ID=...
BMC_PAGOS_SHEET_ID=...
BMC_CALENDARIO_SHEET_ID=...
BMC_VENTAS_SHEET_ID=...
BMC_STOCK_SHEET_ID=...
GOOGLE_APPLICATION_CREDENTIALS=/ruta/absoluta/en/servidor/service-account.json
PORT=3001
PUBLIC_BASE_URL=https://tu-dominio.com   # si usas OAuth ML/Shopify
```

---

**Docker (listo):**
```bash
docker build -f Dockerfile.bmc-dashboard -t bmc-dashboard .
docker run -p 3001:3001 --env-file .env bmc-dashboard
```

**Opción A — Cloud Run:** `gcloud builds submit -f Dockerfile.bmc-dashboard .` + `gcloud run deploy`. Ver HOSTING-EN-MI-SERVIDOR.md.

**Opción B — VPS Netuy:** Pasos arriba. Guía detallada: `docs/bmc-dashboard-modernization/HOSTING-EN-MI-SERVIDOR.md`.

---

## 3. npm audit fix (vulnerabilidades)

**Opción segura (sin breaking):**
```bash
cd "/Users/matias/Panelin calc loca/Calculadora-BMC"
npm audit fix
```
Si no aplica cambios, las vulnerabilidades requieren `--force`.

**Opción con breaking (vite@8):**
```bash
git checkout -b fix/npm-audit-force
npm audit fix --force
npm run test
npm run build
npm run test:contracts
```
Si todo pasa, revisar y hacer merge. Si falla algo, revertir el branch.

---

## 4. Repo Sync (opcional)

**Ya configurado:** Los repos están en `.env`:
- `BMC_DASHBOARD_2_REPO`
- `BMC_DEVELOPMENT_TEAM_REPO`

**No requiere acción manual.** El paso 7 del full team run sincroniza automáticamente cuando ejecutas "Invoque full team".

Si quieres sincronizar manualmente: ejecutar otro full team run.

---

## 5. Verificar kpi-report (rápido)

```bash
cd "/Users/matias/Panelin calc loca/Calculadora-BMC"
npm run start:api
```
En otra terminal:
```bash
curl http://localhost:3001/api/kpi-report
```
Debe dar 200 (o 503 si Sheets no configurado). Si da 404, reiniciar el servidor (Ctrl+C y volver a `npm run start:api`).

---

## Orden sugerido

1. **Tabs** (1.1–1.4) — 15 min en Google Sheets
2. **Triggers** (1.5) — 20 min en Apps Script
3. **kpi-report** (sección 5) — 2 min
4. **npm audit fix** (sección 3) — 5 min
5. **Deploy** (sección 2) — cuando decidas ir a producción
6. **Repo Sync** — automático en next full team run

---

**Referencias:** [AUTOMATIONS-BY-WORKBOOK.md](../google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md), [IMPLEMENTATION-PLAN-POST-GO-LIVE.md](../bmc-dashboard-modernization/IMPLEMENTATION-PLAN-POST-GO-LIVE.md)
