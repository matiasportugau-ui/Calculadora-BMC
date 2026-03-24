# PANELSIM — Estado de sesión (full run)

**Generado (UTC):** 2026-03-24T03-12-02Z
**Repo Calculadora-BMC:** `/Users/matias/Panelin calc loca/Calculadora-BMC`

## Resumen ejecutivo

| Área | Estado |
|------|--------|
| Planillas / Google (ensure-panelsim-sheets-env) | ok |
| Correo IMAP + reporte (panelsim-email-ready) | ok |
| API local (http://127.0.0.1:3001) | HTTP health: **200** — iniciada en background; PID en /tmp/panelsim-session-api.pid (log /tmp/panelsim-session-api-28082.log) |
| MATRIZ vía API | GET /api/actualizar-precios-calculadora → **500** |
| UI Vite (:5173) | No se arranca en este script; usá `npm run dev` o `npm run dev:full` si necesitás la calculadora en navegador. |

## 1. Planillas y credenciales

```text
    === PANELSIM — entorno planillas (Sheets API) ===

    .env ya existe — no se modifica.
    Service account (compartir cada workbook en Drive como Lector o superior):
      bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com

    ✓ GOOGLE_APPLICATION_CREDENTIALS → archivo legible: /Users/matias/Panelin calc loca/Calculadora-BMC/docs/bmc-dashboard-modernization/service-account.json

    IDs de planilla (vacío = no configurado; MATRIZ tiene default en server/config.js si omitís la var):
      ✓ BMC_SHEET_ID=1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg
      ○ BMC_MATRIZ_SHEET_ID (vacío) → default código: 1VBbVay7pwPgC40CWCIr35VbKVuxPsKBZ
      ✓ BMC_PAGOS_SHEET_ID=1AzHhalsZKGis_oJ6J06zQeOb6uMQCsliR82VrSKUUsI
      ✓ BMC_CALENDARIO_SHEET_ID=1bvnbYq7MTJRpa6xEHE5m-5JcGNI9oCFke3lsJj99tdk
      ✓ BMC_VENTAS_SHEET_ID=1KFNKWLQmBHj_v8BZJDzLklUtUPbNssbYEsWcmc0KPQA
      ✓ BMC_STOCK_SHEET_ID=1egtKJAGaATLmmsJkaa2LlCv3Ah4lmNoGMNm4l0rXJQw

    MATRIZ efectiva para GET /api/actualizar-precios-calculadora: 1VBbVay7pwPgC40CWCIr35VbKVuxPsKBZ
      Doc: .cursor/skills/actualizar-precios-calculadora/SKILL.md

    --- Prueba opcional de API (si no corre el servidor, ignorá los errores) ---
    ○ API no responde en http://localhost:3001 (arrancá: npm run start:api)

    Listo. PANELSIM debe usar: npm run start:api y luego GET /api/* o /api/actualizar-precios-calculadora para precios.
    Mapa de accesos: docs/google-sheets-module/SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md
```

## 2. Correo

```text
    >>> PANELSIM email — repo: /Users/matias/Panelin calc loca/conexion-cuentas-email-agentes-bmc
    >>> Ejecutando: npm run panelsim-update 
    
    > conexion-cuentas-email-agentes-bmc@0.1.0 panelsim-update
    > node src/cli/index.js sync
    
    Fetching bmc-administracion…
      4 mensajes
    Fetching bmc-info…
      244 mensajes
    Fetching bmc-ml…
      38 mensajes
    Fetching expresoeste-mportugau…
      5 mensajes
    Fetching bmc-mportugau…
      133 mensajes
    Fetching bmc-ventas…
      71 mensajes
    PANELSIM_EMAIL_RESULT:{"snapshot":"/Users/matias/Panelin calc loca/conexion-cuentas-email-agentes-bmc/data/snapshot-latest.json","report":"/Users/matias/Panelin calc loca/conexion-cuentas-email-agentes-bmc/data/reports/PANELSIM-ULTIMO-REPORTE.md","status":"/Users/matias/Panelin calc loca/conexion-cuentas-email-agentes-bmc/data/reports/PANELSIM-STATUS.json","count":495,"byCategory":{"otros":346,"facturacion":49,"interno":8,"ventas":71,"proveedores":21},"byAccount":{"bmc-administracion":4,"bmc-info":244,"bmc-ml":38,"expresoeste-mportugau":5,"bmc-mportugau":133,"bmc-ventas":71},"syncHealth":{"bmc-administracion":{"status":"ok","messageCount":4,"error":null,"at":"2026-03-24T03:12:03.854Z"},"bmc-info":{"status":"ok","messageCount":244,"error":null,"at":"2026-03-24T03:12:04.894Z"},"bmc-ml":{"status":"ok","messageCount":38,"error":null,"at":"2026-03-24T03:14:46.790Z"},"expresoeste-mportugau":{"status":"ok","messageCount":5,"error":null,"at":"2026-03-24T03:14:48.054Z"},"bmc-mportugau":{"status":"ok","messageCount":133,"error":null,"at":"2026-03-24T03:14:52.331Z"},"bmc-ventas":{"status":"ok","messageCount":71,"error":null,"at":"2026-03-24T03:15:07.875Z"}},"fetchedAt":"2026-03-24T03:15:18.661Z"}
    Listo: leé /Users/matias/Panelin calc loca/conexion-cuentas-email-agentes-bmc/data/reports/PANELSIM-ULTIMO-REPORTE.md o /Users/matias/Panelin calc loca/conexion-cuentas-email-agentes-bmc/data/reports/PANELSIM-STATUS.json (495 mensajes)
    
    Listo. Artefactos:
      - /Users/matias/Panelin calc loca/conexion-cuentas-email-agentes-bmc/data/reports/PANELSIM-ULTIMO-REPORTE.md
      - /Users/matias/Panelin calc loca/conexion-cuentas-email-agentes-bmc/data/reports/PANELSIM-STATUS.json
```

Archivo **PANELSIM-STATUS.json** (extracto):

```json
{
  "generatedAt": "2026-03-24T03:15:18.895Z",
  "fetchedAt": "2026-03-24T03:15:18.661Z",
  "daysBack": 30,
  "count": 495,
  "byCategory": {
    "otros": 346,
    "facturacion": 49,
    "interno": 8,
    "ventas": 71,
    "proveedores": 21
  },
  "byAccount": {
    "bmc-administracion": 4,
    "bmc-info": 244,
    "bmc-ml": 38,
    "expresoeste-mportugau": 5,
    "bmc-mportugau": 133,
    "bmc-ventas": 71
  },
  "syncHealth": {
    "bmc-administracion": {
      "status": "ok",
      "messageCount": 4,
      "error": null,
      "at": "2026-03-24T03:12:03.854Z"
    },
    "bmc-info": {
      "status": "ok",
      "messageCount": 244,
      "error": null,
      "at": "2026-03-24T03:12:04.894Z"
    },
    "bmc-ml": {
      "status": "ok",
      "messageCount": 38,
      "error": null,
      "at": "2026-03-24T03:14:46.790Z"
    },
    "expresoeste-mportugau": {
      "status": "ok",
      "messageCount": 5,
      "error": null,
      "at": "2026-03-24T03:14:48.054Z"
    },
    "bmc-mportugau": {
      "status": "ok",
      "messageCount": 133,
      "error": null,
      "at": "2026-03-24T03:14:52.331Z"
    },
    "bmc-ventas": {
      "status": "ok",
      "messageCount": 71,
      "error": null,
      "at": "2026-03-24T03:15:07.875Z"
    }
  },
  "reportPath": "/Users/matias/Panelin calc loca/conexion-cuentas-email-agentes-bmc/data/reports/PANELSIM-ULTIMO-REPORTE.md",
  "snapshotPath": "/Users/matias/Panelin calc loca/conexion-cuentas-email-agentes-bmc/data/snapshot-latest.json"
}
```

## 3. API y Mercado Libre

- **Health:** `200`
- **GET /auth/ml/status** (extracto):

```json
{"ok":true,"userId":179969104,"scope":"offline_access read urn:global:admin:info:/read-only urn:global:admin:info:/read-write urn:global:admin:oauth:/read-only urn:global:admin:oauth:/read-write urn:global:admin:users:/read-only urn:global:admin:users:/read-write urn:ml:all:comunication:/read-write urn:ml:all:publish-sync:/read-write urn:ml:mktp:ads:/read-write urn:ml:mktp:comunication:/read-write urn:ml:mktp:invoices:/read-write urn:ml:mktp:metrics:/read-only urn:ml:mktp:offers:/read-write urn:ml:mktp:orders-shipments:/read-write urn:ml:mktp:publish-sync:/read-write urn:ml:vis:comunication:/read-write urn:ml:vis:publish-sync:/read-write write","updatedAt":"2026-03-23T23:23:01.500Z","expiresAt":1774329781500}
```

- **GET /capabilities** (primeros caracteres):

```
{"ok":true,"schema_version":"1","description":"Single index for AI agents: Calculator GPT Actions + BMC Dashboard API + UI entry points.","public_base_url":"http://localhost:3001","calculator":{"prefix":"/calc","canonical":{"gpt_entry_point":"http://localhost:3001/calc/gpt-entry-point","openapi_yaml":"http://localhost:3001/calc/openapi","informe":"http://localhost:3001/calc/informe","catalogo":"http://localhost:3001/calc/catalogo","escenarios":"http://localhost:3001/calc/escenarios"},"actions":[{"operationId":"obtener_informe_completo","method":"GET","path":"/calc/informe","summary":"Informe completo con precios, reglas de asesoría y fórmulas.","whenToUse":"Llamar al INICIO de sesión para cargar contexto completo. Devuelve catálogo, matriz de precios, fijaciones, selladores, reglas de asesoría y fórmulas de cálculo.","url":"http://localhost:3001/calc/informe"},{"operationId":"obtener_catalogo","method":"GET","path":"/calc/catalogo","summary":"Catálogo de paneles, espesores, colores y opciones.","whenToUse":"Para conocer familias válidas, espesores, colores y precios antes de cotizar. Guía la conversación con el usuario.","url":"http://localhost:3001/calc/catalogo"},{"operationId":"obtener_escenarios","method":"GET","path":"/calc/escenarios","summary":"Escenarios disponibles con campos requeridos y opcionales.","whenToUse":"Para saber qué datos pedir según el tipo de proyecto (solo techo, fachada, techo+fachada, cámara frigorífica).","url":"http://localhost:3001/calc/escenarios"},{"operationId":"calcular_presupuesto_libre","method":"POST","path":"/calc/cotizar/presupuesto-libre","summary":"Calcula presupuesto libre (líneas manuales por catálogo).","whenToUse":"Cuando el cliente pide partidas sueltas (paneles por m², perfilería por barra, tornillería, selladores, flete manual, extraordinarios) sin cotización techo/pared automática.","url":"http://localhost:3001/calc/cotizar/presupuesto-libre"},{"operationId":"calcular_cotizacion","method":"POST","path":"/calc/cotizar","summary":"Calcula cotización completa con BOM, precios y textos.","whenToUse":"Cuando el usuario tiene dimensiones y opciones definidas. Devuelve resumen, BOM, texto WhatsApp y texto resumen.","url":"http://localhost:3001/calc/cotizar"},{"operationId":"generar_cotizacion_pdf","method":"POST","path":"/calc/cotizar/pdf","summary":"Genera PDF profesional y devuelve link para compartir.","whenToUse":"Cuando el cliente quiere la cotización en PDF. Incluir objeto cliente (nom
```

## 4. Próximos pasos sugeridos

- **Calculadora en el navegador:** `npm run dev` (puerto 5173 típico) o `npm run dev:full` (API+Vite si preferís un solo comando y no usás el API ya levantado).
- **OAuth ML:** si `/auth/ml/status` indica sin token, abrí `/auth/ml/start` según `docs/ML-OAUTH-SETUP.md`.
- **Detener API** iniciada por este script: `kill $(cat /tmp/panelsim-session-api.pid)` (solo si se creó PID en esta corrida).

