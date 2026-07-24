# Calculadora BMC — Panelin v3.1.5

Cotizador profesional de paneles de aislamiento térmico y acústico para **BMC Uruguay (METALOG SAS)**.

[![CI](https://github.com/matiasportugau-ui/Calculadora-BMC/actions/workflows/ci.yml/badge.svg)](https://github.com/matiasportugau-ui/Calculadora-BMC/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![Node](https://img.shields.io/badge/Node-20-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/license-UNLICENSED-red)

<!-- AUTO-GENERATED-BLOCK: scripts/generate-readme-presentation.mjs -->

## Estado del repo (auto)

| Campo | Valor |
|-------|-------|
| **Fecha generación (UTC)** | `2026-05-06` · timestamp ISO en `public/presentation-data.json` |
| **package.json** | `3.1.5` |
| **Git** | `0bd4d7f` · `copilot/update-readme` |
| **CALCULATOR_DATA_VERSION** | `45e744c8db` |
| **README smoke** | `384` passed (`validation.js`) + `10` ok (`roofVisualQuoteConsistency.js`) |
| **Presentación Matrix** | [Local :5173](http://localhost:5173/matrix-presentation.html) · [Vercel](https://calculadora-bmc.vercel.app/matrix-presentation.html) |

**Regenerar:** `npm run readme:sync` · solo README/JSON: `npm run readme:generate` · comprobar: `npm run readme:check`.


---

## ¿Qué hace?

Genera cotizaciones de materiales en tiempo real para obras con paneles sandwich. Ingresás las dimensiones, elegís el tipo de panel y el escenario, y obtenés:

- Lista de materiales (BOM) desglosada por grupo
- Subtotal + IVA 22% = total final
- PDF A4 listo para imprimir
- Texto preformateado para compartir por WhatsApp

---

## Inicio rápido

**Requisitos:** Node.js 20+

> En Linux, `npm install` / `npm ci` puede requerir `libasound2-dev` por la dependencia nativa de `easymidi`.

```bash
git clone https://github.com/matiasportugau-ui/Calculadora-BMC.git
cd Calculadora-BMC
npm install
npm run env:ensure    # crea .env desde .env.example si falta
npm run dev:full      # API :3001 + Vite :5173
```

### Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Solo frontend Vite (puerto 5173) |
| `npm run dev:full` | API Express (3001) + Vite (5173) |
| `npm run start:api` | Solo API Express (3001) |
| `npm run dev:api` | API con `--watch` |
| `npm run build` | Build de producción → `dist/` |
| `npm test` | Suite offline principal del repo (sin servidor) |
| `npm run test:api` | Suite offline de rutas y contratos internos de la API |
| `npm run lint` | ESLint sobre `src/` |
| `npm run gate:local` | `lint` + `test` + `test:api` |
| `npm run gate:local:full` | `gate:local` + `build` |
| `npm run test:contracts` | Valida contratos HTTP con la API corriendo en :3001 |
| `npm run smoke:prod` | Smoke de la API pública canónica |
| `npm run capabilities:snapshot` | Regenera `docs/api/AGENT-CAPABILITIES.json` |
| `npm run readme:sync` | `version:data` + README generado + `public/presentation-data.json` (presentación Matrix) |
| `npm run readme:generate` | Solo README + JSON de presentación (sin recalcular `CALCULATOR_DATA_VERSION`) |
| `npm run readme:check` | Falla en CI si `README.md` no coincide con el template |

---

## IA, agentes y módulos operativos

- **`AGENTS.md`** — índice de comandos y convenciones para agentes de código (Cursor, Claude, etc.).
- **`docs/team/PROJECT-STATE.md`** — estado canónico del proyecto, cambios recientes y próximos pasos.
- **Panelin Chat / MCP** — el backend expone capacidades para chat in-app, tools y manifest externos desde `server/`.
- **WA Cockpit / módulos hub** — la SPA incluye rutas operativas como `/hub`, `/hub/wa`, `/hub/ml`, `/hub/canales` y `/hub/admin`.
- **Presentación Matrix** — HTML estático con lluvia de código y panel de datos vivo: abrí `http://localhost:5173/matrix-presentation.html` con `npm run dev`. Los datos salen de `public/presentation-data.json` (regenerado por `npm run readme:generate` o `readme:sync`). El cliente puede **refrescar** datos o hacer polling automático.

---

## Escenarios soportados

| Escenario | Techo | Fachada | Esquineros |
|-----------|:-----:|:-------:|:----------:|
| 🏠 Solo Techo | ✅ | — | — |
| 🏢 Solo Fachada | — | ✅ | ✅ |
| 🏗 Techo + Fachada | ✅ | ✅ | ✅ |
| ❄️ Cámara Frigorífica | — | ✅ | ✅ |

---

## Catálogo de paneles

### Techo

| Familia | Ancho útil | Largo (m) | Fijación | Espesores (mm) |
|---------|-----------|-----------|----------|----------------|
| ISODEC EPS | 1.12 m | 2.3 – 14.0 | Varilla + tuerca + arandela | 100, 150, 200, 250 |
| ISODEC PIR | 1.12 m | 3.5 – 14.0 | Varilla + tuerca + arandela | 50, 80, 120 |
| ISOROOF 3G | 1.00 m | 3.5 – 8.5 | Caballete + tornillo | 30, 40, 50, 80, 100 |
| ISOROOF FOIL | 1.00 m | 3.5 – 8.5 | Caballete + tornillo | 30, 50 |
| ISOROOF PLUS | 1.00 m | 3.5 – 8.5 | Caballete + tornillo | 50, 80 |

### Fachada / Pared

| Familia | Ancho útil | Largo (m) | Espesores (mm) |
|---------|-----------|-----------|----------------|
| ISOPANEL EPS | 1.14 m | 2.3 – 14.0 | 50, 100, 150, 200, 250 |
| ISOWALL PIR | 1.10 m | 3.5 – 14.0 | 50, 80, 100 |

---

## Arquitectura

```
src/                                  # SPA React + Vite
├── main.jsx                          # Bootstrap + error boundary
├── App.jsx                           # Router principal y módulos /hub/*
├── PanelinCalculadoraV3.jsx          # Re-export del componente canónico
├── components/
│   └── PanelinCalculadoraV3_backup.jsx
├── data/                             # Catálogo, precios, escenarios
└── utils/                            # Cálculo, exportes, helpers

server/                               # API Express 5
├── index.js                          # Entry point, middleware, health, mount de rutas
├── config.js                         # Env/config centralizada
├── routes/                           # /api, /calc, /auth, /webhooks
└── lib/                              # Integraciones, auth, agent tools, workers

tests/                                # Suites offline y validaciones de contrato
scripts/                              # Tooling, smoke, snapshots, automation
```

### Frontend React

| Archivo | Rol |
|---------|-----|
| `src/App.jsx` | Router de la calculadora y módulos operativos |
| `src/components/PanelinCalculadoraV3_backup.jsx` | Calculadora canónica |
| `src/PanelinCalculadoraV3.jsx` | Re-export estable del componente principal |
| `src/data/constants.js` | Catálogo base, escenarios, perfiles y pricing helpers |
| `src/utils/calculations.js` | Motor de cálculo puro para techo/pared |
| `src/utils/helpers.js` | PDF, WhatsApp, BOM y formateadores |

### Backend y operaciones

| Área | Puntos clave |
|------|--------------|
| API | `server/index.js` monta `/calc`, `/api/*`, `/auth/*`, `/webhooks/*` |
| Dashboard / Wolfboard | Rutas operativas centralizadas en `server/routes/` y módulos `/hub/*` |
| Integraciones | MercadoLibre, Google Sheets, WhatsApp, GCS, OpenAI y MCP |
| Validación | Tests offline en `tests/` + smoke/contratos desde `scripts/` |

---

## Sistema de precios

Todos los precios son **sin IVA**. El IVA 22% se aplica una sola vez al total final con `calcTotalesSinIVA()`.

| Lista | Variable | Uso |
|-------|----------|-----|
| `venta` | `LISTA_ACTIVA = "venta"` | Precio BMC directo — clientes y presupuestos |
| `web` | `LISTA_ACTIVA = "web"` | Precio público Shopify |

La función `p(item)` resuelve el precio activo:

```js
p({ venta: 37.76, web: 45.97 })
// → 37.76 si LISTA_ACTIVA === "venta"
// → 45.97 si LISTA_ACTIVA === "web"
```

Ver [`docs/PRICING-ENGINE.md`](docs/PRICING-ENGINE.md) para más detalles.

---

## Backend MercadoLibre

El repositorio incluye un servidor Express en `server/` para integrar OAuth de MercadoLibre.

```bash
cp .env.example .env   # completar ML_CLIENT_SECRET y TOKEN_ENCRYPTION_KEY
npm run start:api      # http://localhost:3001
```

Endpoints disponibles:
- `GET /auth/ml/start` — inicia el flujo OAuth (abrir en navegador la primera vez)
- `GET /ml/users/me` — datos del usuario autenticado
- `GET /ml/items/:id` — detalle de ítem de MercadoLibre

---

## Desarrollo completo — Dashboard BMC

El proyecto integra un **dashboard de Finanzas** (cotizaciones, entregas, pagos pendientes, KPIs) alimentado por Google Sheets. Todo el stack se configura con un solo comando.

### One-Click Setup

```bash
./run_dashboard_setup.sh
```

El script valida `.env`, credenciales de Google, instala dependencias, inicia la API y opcionalmente ngrok. Opciones:

- `--check-only` — solo verifica configuración, no inicia servicios
- `--no-ngrok` — no inicia túnel ngrok

### Requisitos previos (manual, una vez)

1. **Google Cloud:** Crear service account con Sheets API (lectura + escritura). Descargar JSON → guardar en `docs/bmc-dashboard-modernization/service-account.json`.
2. **Spreadsheet:** Compartir "2.0 - Administrador de Cotizaciones" con el email del service account como **Editor**.
3. **Apps Script (Phase 1–2):** Pegar `Code.gs`, agregar `DialogEntregas.html`, ejecutar `runInitialSetup`, configurar triggers según [`docs/bmc-dashboard-modernization/IMPLEMENTATION.md`](docs/bmc-dashboard-modernization/IMPLEMENTATION.md).

### Stack del dashboard

| Componente | Puerto | Descripción |
|------------|--------|-------------|
| **API principal** | 3001 | Express: `/calc`, `/api/*`, `/auth/ml`, `/finanzas` |
| **Vite (front)** | 5173 | App React con pestañas Invocar Panelin + Finanzas |
| **Dashboard standalone** | 3849 | `npm run bmc-dashboard` — solo dashboard (opcional) |
| **ngrok** | — | Túnel HTTPS para OAuth/webhooks externos |

### Variables de entorno (`.env`)

| Variable | Uso |
|----------|-----|
| `BMC_SHEET_ID` | ID del spreadsheet (de la URL de Google Sheets) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Ruta absoluta al JSON del service account |
| `ML_CLIENT_ID`, `ML_CLIENT_SECRET` | OAuth MercadoLibre |
| `ML_REDIRECT_URI_DEV` | Callback HTTPS (ej. ngrok) para OAuth |

### Versionado y changelog

```bash
./scripts/bump_version.sh [major|minor|patch] ["Mensaje para el changelog"]
```

Criterios: **MAJOR** = breaking; **MINOR** = nuevas features; **PATCH** = fixes, refactors, docs.

---

## Deploy

### Vercel (recomendado)

```bash
npx vercel --prod
```

Configuración en `vercel.json` (framework: vite, output: `dist/`).

### Docker

```bash
docker build -t calculadora-bmc:latest .
docker run --rm -p 8080:80 calculadora-bmc:latest
# Disponible en http://localhost:8080
```

### Build estático

```bash
npm run build
# Servir la carpeta dist/ con cualquier servidor HTTP estático
```

Ver [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) para más opciones.

---

## CI/CD

Pipeline de GitHub Actions en `.github/workflows/ci.yml`. Se ejecuta en push a `main`/`develop` y en PR a `main`.

| Job | Pasos |
|-----|-------|
| **validate** | `npm ci --include=dev` → `node tests/validation.js` → `npm run build` |
| **lint** | `npm ci --include=dev` → `npm run lint` |
| **env-drift** | Verifica desvíos entre `.env.example` y el runtime esperado |
| **smoke** | Smoke de la API pública en pushes a `main` |
| **channels_pipeline** | Corre `channels:automated` en CI |
| **voice_health** | Verifica `/api/agent/voice/health` en producción |
| **knowledge_antenna** | Ejecuta el workflow reusable de knowledge antenna |

---

## Reglas de desarrollo

| Regla | Detalle |
|-------|---------|
| Módulos | ES modules (`import` / `export`) en frontend y backend |
| Rutas API | Las rutas `/api` viven en `server/routes/` |
| Sheets | `503` = Sheets no disponible; no hardcodear IDs ni credenciales |
| Secrets | Solo en `.env` / runtime; nunca commitear tokens |
| Logging | Usar `pino` / `pino-http` en backend |
| Gate local | Antes de PR: `npm run gate:local` o `npm run gate:local:full` |

Ver [`CONTRIBUTING.md`](CONTRIBUTING.md) para la guía completa de contribución.

---

## Documentación adicional

| Documento | Contenido |
|-----------|-----------|
| [`AGENTS.md`](AGENTS.md) | Comandos y convenciones para agentes de IA |
| [`docs/team/PROJECT-STATE.md`](docs/team/PROJECT-STATE.md) | Estado vivo del proyecto y changelog operativo |
| [`docs/readme/README.template.md`](docs/readme/README.template.md) | Plantilla del README (no editar `README.md` a mano en bloques auto) |
| [`docs/wa-cockpit/README.md`](docs/wa-cockpit/README.md) | Hub del módulo WhatsApp Cockpit |
| [`docs/api/AGENT-CAPABILITIES.json`](docs/api/AGENT-CAPABILITIES.json) | Snapshot de capacidades expuestas a agentes/MCP |
| [`docs/bmc-dashboard-modernization/IMPLEMENTATION.md`](docs/bmc-dashboard-modernization/IMPLEMENTATION.md) | Setup completo del dashboard (4 fases, triggers, testing) |
| [`docs/bmc-dashboard-modernization/README.md`](docs/bmc-dashboard-modernization/README.md) | Quick start Phase 1–2 + dashboard |
| [`docs/ML-OAUTH-SETUP.md`](docs/ML-OAUTH-SETUP.md) | Configuración OAuth MercadoLibre |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitectura técnica detallada |
| [`docs/CALC-TECHO.md`](docs/CALC-TECHO.md) | Motor de cálculo de techos |
| [`docs/CALC-PARED.md`](docs/CALC-PARED.md) | Motor de cálculo de paredes |
| [`docs/PRICING-ENGINE.md`](docs/PRICING-ENGINE.md) | Motor de precios y listas |
| [`docs/SCENARIOS.md`](docs/SCENARIOS.md) | Escenarios y reglas de visibilidad |
| [`docs/UI-COMPONENTS.md`](docs/UI-COMPONENTS.md) | Componentes de interfaz |
| [`docs/API-REFERENCE.md`](docs/API-REFERENCE.md) | Referencia de funciones |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Guía de deploy |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Historial de cambios |

---

## Empresa

| Campo | Valor |
|-------|-------|
| Razón social | METALOG SAS |
| Marca | BMC Uruguay |
| RUT | 120403430012 |
| Ubicación | Maldonado, Uruguay |
| Web | [bmcuruguay.com.uy](https://bmcuruguay.com.uy) |
| Contacto | 092 663 245 |
| Banco | BROU · Cta. Dólares: 110520638-00002 |

---

## Documentation Agent

- **Daily auto-update** via GitHub Actions (`.github/workflows/update-docs.yml`, cron `0 6 * * *` UTC + `workflow_dispatch` only — not on every `main` push).
- **Pipeline**: scan repo → Gemini writer → deterministic safety gate (length + required anchors) → Gemini critic (sees current + proposed) → rewrite `README.md` only if both approve.
- **Scope**: commits `README.md` only (never stages `docs/` / `CHANGELOG.md`).
- **Local run**: `export GEMINI_API_KEY='…'` then `python3 scripts/doc_agent.py`
- **Required secret** (repo → Settings → Secrets → Actions): `GEMINI_API_KEY`
- `GITHUB_TOKEN` is provided automatically by Actions.

## Licencia

Código propietario de BMC Uruguay / METALOG SAS. Todos los derechos reservados.
