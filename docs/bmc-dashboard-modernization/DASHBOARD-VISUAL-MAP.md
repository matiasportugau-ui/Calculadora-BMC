# BMC Dashboard — Mapa Visual de Configuración Total

**IA (secciones y navegación):** [IA.md](./IA.md). Este documento describe la arquitectura técnica; la IA define BMC Dashboard (producto), Finanzas, Operaciones, Cotizaciones, Ventas e Invoque Panelin.

## 1. Arquitectura general

```mermaid
flowchart TB
    subgraph client [Cliente / Navegador]
        Vite[localhost:5173 - Vite React]
        Finanzas[localhost:3001/finanzas - Dashboard HTML]
        API[localhost:3001 - API Express]
    end

    subgraph backend [Backend]
        Express[Express Server :3001]
        bmcAPI[bmcDashboard Router]
        calc[calcRouter]
        legacy[legacyQuoteRouter]
        shopify[Shopify Router]
    end

    subgraph data [Fuentes de datos]
        Sheets[Google Sheets API]
        GDrive[Google Drive API]
        ML[MercadoLibre API]
    end

    subgraph infra [Infraestructura]
        ngrok[ngrok :4040]
    end

    Vite --> Express
    Finanzas --> bmcAPI
    API --> Express
    Express --> bmcAPI
    Express --> calc
    Express --> legacy
    Express --> shopify
    bmcAPI --> Sheets
    Vite --> GDrive
    Express --> ML
    ngrok -.->|túnel HTTPS| Express
```

---

## 2. Puertos y servicios

| Puerto | Servicio | Comando | URL |
|--------|----------|---------|-----|
| 5173 | Vite (React SPA) | `npm run dev` | http://localhost:5173 |
| 3001 | Express API | `npm run start:api` | http://localhost:3001 |
| 3001/finanzas | Sección Finanzas + Operaciones (static) | (servido por API) | http://localhost:3001/finanzas |
| 3849 | Servidor standalone (alternativo) | `npm run bmc-dashboard` | http://localhost:3849 |
| 4040 | ngrok inspector | (ngrok http 3001) | http://127.0.0.1:4040 |

Ver [NGROK-USAGE.md](../NGROK-USAGE.md) para URL, puerto, front (Vite) vs API (Express) y revisión de tráfico.

---

## 3. Flujo de datos — Dashboard

```mermaid
flowchart LR
    subgraph sheet [Google Sheet]
        CRM[CRM_Operativo]
        Master[Master_Cotizaciones]
        Pagos[Pagos_Pendientes]
        Audit[AUDIT_LOG]
        Metas[Metas_Ventas]
    end

    subgraph api [API /api]
        cotiz[GET /cotizaciones]
        prox[GET /proximas-entregas]
        coord[GET /coordinacion-logistica]
        kpi[GET /kpi-financiero]
        audit[GET /audit]
        marcar[POST /marcar-entregado]
    end

    subgraph ui [Dashboard UI]
        entregas[Próximas entregas]
        logistica[Coordinación logística]
        kpiCards[KPIs financieros]
        auditTable[Audit log]
    end

    CRM -->|BMC_SHEET_SCHEMA=CRM_Operativo| cotiz
    Master -->|schema default| cotiz
    Pagos --> kpi
    Metas --> kpi
    Audit --> audit

    cotiz --> entregas
    prox --> entregas
    coord --> logistica
    kpi --> kpiCards
    audit --> auditTable
```

---

## 4. Esquema de Sheets (BMC vs CRM)

```mermaid
flowchart TB
    subgraph bmc [Schema Master_Cotizaciones - BMC]
        MC[Master_Cotizaciones]
        VR[Ventas realizadas y entregadas]
        PP[Pagos_Pendientes]
        AL[AUDIT_LOG]
        MV[Metas_Ventas]
    end

    subgraph crm [Schema CRM_Operativo - Bnesser]
        CO[CRM_Operativo]
        Manual[Manual]
        Param[Parametros]
        Dash[Dashboard]
        Auto[Automatismos]
    end

    config[BMC_SHEET_SCHEMA] -->|Master_Cotizaciones| bmc
    config -->|CRM_Operativo| crm
```

---

## 5. Componentes React (Vite 5173)

Canonical Calculadora: **PanelinCalculadoraV3** (App.jsx). PanelinCalculadoraV3.jsx = alternate single-file build. Ver [IA.md](./IA.md).

```mermaid
flowchart TB
    App[App.jsx]
    Calc[PanelinCalculadoraV3]
    Drive[GoogleDrivePanel]
    Log[Budget Log Panel]
    PDF[PDFPreviewModal]

    App --> Calc
    Calc --> Drive
    Calc --> Log
    Calc --> PDF

    Calc -->|constants.js| Precios[PANELS_TECHO, PANELS_PARED]
    Calc -->|calculations.js| Motor[Motores de cálculo]
    Calc -->|helpers.js| BOM[BOM, PDF, WhatsApp]
    Calc -->|googleDrive.js| GDrive[Save/Load Drive]
```

---

## 6. Endpoints API (resumen)

| Método | Ruta | Fuente datos | Schema |
|--------|------|--------------|--------|
| GET | /health | — | — |
| GET | /api/cotizaciones | CRM_Operativo o Master_Cotizaciones | Ambos |
| GET | /api/proximas-entregas | Idem | Ambos |
| GET | /api/coordinacion-logistica | Idem | Ambos |
| GET | /api/kpi-financiero | Pagos_Pendientes, Metas_Ventas | Solo BMC |
| GET | /api/audit | AUDIT_LOG | Solo BMC |
| GET | /api/pagos-pendientes | Pagos_Pendientes | Solo BMC |
| GET | /api/metas-ventas | Metas_Ventas | Solo BMC |
| POST | /api/marcar-entregado | Master + Ventas realizadas | Solo BMC |

---

## 7. Configuración (.env)

```mermaid
flowchart LR
    subgraph required [Requeridos Dashboard]
        BMC_ID[BMC_SHEET_ID]
        CREDS[GOOGLE_APPLICATION_CREDENTIALS]
        SCHEMA[BMC_SHEET_SCHEMA]
    end

    subgraph ml [MercadoLibre]
        ML_ID[ML_CLIENT_ID]
        ML_SEC[ML_CLIENT_SECRET]
        ML_URI[ML_REDIRECT_URI_DEV]
    end

    subgraph vite [Vite]
        VITE_ID[VITE_GOOGLE_CLIENT_ID]
        VITE_URL[VITE_API_URL]
    end

    BMC_ID --> bmcAPI
    CREDS --> bmcAPI
    SCHEMA --> bmcAPI
```

---

## 8. Comandos de arranque

| Objetivo | Comando |
|----------|---------|
| Solo frontend | `npm run dev` |
| API + frontend | `npm run dev:full` |
| API + frontend + Evolution viewer | `./run_full_stack.sh` |
| Dashboard standalone | `npm run bmc-dashboard` |
| Setup completo + ngrok | `./run_dashboard_setup.sh` |

---

## 9. Mapeo CRM_Operativo → Dashboard

| Columna CRM | Columna normalizada |
|-------------|---------------------|
| ID | COTIZACION_ID |
| Fecha | FECHA_CREACION |
| Cliente | CLIENTE_NOMBRE |
| Teléfono | TELEFONO |
| Ubicación / Dirección | DIRECCION |
| Fecha próxima acción | FECHA_ENTREGA |
| Estado | ESTADO |
| Responsable | ASIGNADO_A |
| Consulta / Pedido | NOTAS |

---

## 10. Archivos clave

| Archivo | Rol |
|---------|-----|
| `server/index.js` | Express, rutas, /finanzas static |
| `server/routes/bmcDashboard.js` | API Sheets, mapeo CRM |
| `server/config.js` | bmcSheetSchema, env vars |
| `docs/bmc-dashboard-modernization/dashboard/` | HTML/CSS/JS del dashboard |
| `docs/bmc-dashboard-modernization/service-account.json` | Credenciales GCP |
| `src/components/PanelinCalculadoraV3.jsx` | Calculadora + Drive + Log |
| `src/components/GoogleDrivePanel.jsx` | Panel Drive |
| `.env` | BMC_SHEET_ID, BMC_SHEET_SCHEMA, GOOGLE_APPLICATION_CREDENTIALS |
