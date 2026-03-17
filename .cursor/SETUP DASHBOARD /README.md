# Calculadora BMC — Panelin v3.0

Cotizador profesional de paneles de aislamiento térmico y acústico para **BMC Uruguay (METALOG SAS)**.

[![CI](https://github.com/matiasportugau-ui/Calculadora-BMC/actions/workflows/ci.yml/badge.svg)](https://github.com/matiasportugau-ui/Calculadora-BMC/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Node](https://img.shields.io/badge/Node-20-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/license-proprietary-red)

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

```bash
git clone https://github.com/matiasportugau-ui/Calculadora-BMC.git
cd Calculadora-BMC
npm install
npm run dev        # http://localhost:5173
```

### Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo Vite (puerto 5173) |
| `npm run dev:full` | API (3001) + Vite (5173) — app completa con pestaña Finanzas |
| `npm run start:api` | Solo API Express (3001) |
| `npm run bmc-dashboard` | Servidor standalone Finanzas/Operaciones (3849) |
| *BMC Dashboard (entrada única)* | **http://localhost:3001** — raíz redirige a /finanzas. Ver [IA.md](../../docs/bmc-dashboard-modernization/IA.md). |
| `npm run build` | Build de producción → `dist/` |
| `npm run preview` | Preview local del build |
| `npm test` | Suite de validación (63 assertions) |
| `npm run lint` | ESLint sobre `src/` (0 errores, 0 advertencias) |

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
src/
├── main.jsx                          # Punto de entrada React
├── App.jsx                           # Componente raíz
├── data/
│   └── constants.js                  # Tokens, precios, paneles, perfiles, escenarios
├── utils/
│   ├── calculations.js               # Motores de cálculo puros (sin React)
│   └── helpers.js                    # BOM, PDF, WhatsApp
└── components/
    └── PanelinCalculadoraV3.jsx      # Componente principal
```

### `src/data/constants.js` — fuente de verdad

| Sección | Contenido |
|---------|-----------|
| §1 Design Tokens | Colores (`C`), tipografía (`FONT`) |
| §2 Motor de Precios | `LISTA_ACTIVA`, `p()`, `pIVA()` |
| §3 Paneles Techo | `PANELS_TECHO` — 5 familias |
| §4 Paneles Pared | `PANELS_PARED` — 2 familias |
| §5 Fijaciones | `FIJACIONES` — varilla, tuerca, arandela, anclaje, tornillo T2, remaches |
| §6 Selladores | `SELLADORES` — silicona, cinta, membrana, espuma PU |
| §7 Perfilería | `PERFIL_TECHO`, `PERFIL_PARED` |
| §8 Escenarios | `SCENARIOS_DEF`, `VIS`, `BORDER_OPTIONS` |

### `src/utils/calculations.js` — motores de cálculo

Funciones puras, sin dependencias de React.

**Techo:** `calcTechoCompleto()` orquesta `calcPanelesTecho`, `calcAutoportancia`, `calcFijacionesVarilla` / `calcFijacionesCaballete`, `calcPerfileriaTecho`, `calcSelladoresTecho`.

**Pared:** `calcParedCompleto()` orquesta `calcPanelesPared`, `calcPerfilesU`, `calcEsquineros`, `calcFijacionesPared`, `calcPerfilesParedExtra`, `calcSelladorPared`.

**General:** `calcTotalesSinIVA()` — subtotal + IVA 22% = total final.

### `src/utils/helpers.js` — utilidades de salida

| Función | Propósito |
|---------|-----------|
| `applyOverrides()` | Aplica ediciones del usuario al BOM |
| `bomToGroups()` | Transforma resultados de cálculo en grupos de BOM |
| `fmtPrice()` | Formatea números como moneda |
| `generatePrintHTML()` | Genera HTML A4 para PDF |
| `openPrintWindow()` | Abre diálogo de impresión |
| `buildWhatsAppText()` | Formatea el BOM para WhatsApp |

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
npm run dev:api        # http://localhost:3001
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
| **validate** | `npm ci` → `node tests/validation.js` → `npm run build` |
| **lint** | `npm ci` → `npm run lint` |

---

## Reglas de desarrollo

| Regla | Detalle |
|-------|---------|
| Cantidades | `Math.ceil()` siempre — nunca `round()` ni `floor()` |
| Precios | `p(item)` para resolver precios — nunca hardcodeados |
| IVA | Una sola vez al final en `calcTotalesSinIVA()` |
| Estilos | Inline styles únicamente — tokens `C` y `FONT` de `constants.js` |
| Estado | Solo `React.useState` — sin `localStorage` ni fetch externo |
| Props | El componente principal no requiere props |

Ver [`CONTRIBUTING.md`](CONTRIBUTING.md) para la guía completa de contribución.

---

## Documentación adicional

| Documento | Contenido |
|-----------|-----------|
| [`docs/bmc-dashboard-modernization/IMPLEMENTATION.md`](docs/bmc-dashboard-modernization/IMPLEMENTATION.md) | Setup completo del dashboard (4 fases, triggers, testing) |
| [`docs/bmc-dashboard-modernization/README.md`](docs/bmc-dashboard-modernization/README.md) | Quick start Phase 1–2 + dashboard |
| [`docs/NGROK-USAGE.md`](docs/NGROK-USAGE.md) | ngrok: URL, puerto, front (Vite) vs API (Express), revisión de tráfico 200/404 |
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

## Licencia

Código propietario de BMC Uruguay / METALOG SAS. Todos los derechos reservados.
