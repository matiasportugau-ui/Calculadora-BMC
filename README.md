# 🧮 Calculadora BMC — Panelin v3.0

**Cotizador profesional de paneles de aislamiento térmico y acústico para BMC Uruguay (METALOG SAS)**

![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite&logoColor=white)
![Node](https://img.shields.io/badge/Node-20-339933?logo=node.js&logoColor=white)
![CI](https://github.com/matiasportugau-ui/Calculadora-BMC/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-proprietary-red)
![Version](https://img.shields.io/badge/version-3.0.0-blue)

---

## 📋 Tabla de Contenidos

1. [Descripción](#-descripción)
2. [Características](#-características)
3. [Arquitectura del Proyecto](#-arquitectura-del-proyecto)
4. [Estructura del Repositorio](#-estructura-del-repositorio)
5. [Inicio Rápido](#-inicio-rápido)
6. [Scripts Disponibles](#-scripts-disponibles)
7. [Sistema de Precios](#-sistema-de-precios)
8. [Escenarios de Obra](#-escenarios-de-obra)
9. [Catálogo de Paneles](#-catálogo-de-paneles)
10. [Motores de Cálculo](#-motores-de-cálculo)
11. [Componentes UI](#-componentes-ui)
12. [Deploy](#-deploy)
13. [CI/CD](#-cicd)
14. [Restricciones Técnicas](#-restricciones-técnicas)
15. [Datos de la Empresa](#-datos-de-la-empresa)
16. [Licencia](#-licencia)

---

## 📋 Descripción

Calculadora de cotización en tiempo real para paneles de aislamiento térmico y acústico (ISODEC, ISOROOF, ISOPANEL, ISOWALL) fabricados por BMC Uruguay. Permite generar presupuestos detallados de materiales con lista de materiales (BOM) completa, exportación a PDF imprimible y texto formateado para WhatsApp.

---

## ✨ Características

- **Motor de cálculo de techos** — conteo de paneles, verificación de autoportancia, fijaciones varilla/caballete, perfilería de bordes (gotero, canalón, cumbrera, contra), selladores
- **Motor de cálculo de paredes** — paneles con deducción de aberturas, perfiles U base/corona, perfiles K2/G2/aluminio 5852, esquineros interior/exterior, fijaciones por anclaje H°/tornillo T2/remaches POP, selladores
- **4 escenarios de obra** — Solo techo, Solo fachada, Techo + Fachada, Cámara frigorífica
- **Doble lista de precios** — Precio BMC venta directa y Precio Web (Shopify)
- **BOM editable** — Override de cantidades y precios por ítem
- **Generador PDF** — Cotización A4 imprimible con datos bancarios y logo
- **Compartir por WhatsApp** — Texto de presupuesto preformateado
- **Verificación de autoportancia** — Alerta si la luz libre supera el límite del panel

---

## 🏗 Arquitectura del Proyecto

El proyecto sigue una arquitectura modular con separación de capas:

```
src/
├── main.jsx                         # Punto de entrada React
├── App.jsx                          # Componente raíz
├── data/
│   └── constants.js                 # Fuente de verdad: tokens, precios, paneles, perfiles
├── utils/
│   ├── calculations.js              # Motores de cálculo puros (sin React)
│   └── helpers.js                   # BOM, PDF, WhatsApp
└── components/
    └── PanelinCalculadoraV3.jsx     # Componente principal (~643 líneas)
```

### Capa de Datos (`src/data/constants.js`)

| Sección | Contenido |
|---------|-----------|
| §1 Design Tokens | Colores (`C`), tipografía (`FONT`), sombras, transiciones |
| §2 Motor de Precios | `LISTA_ACTIVA`, `p()`, `pIVA()` |
| §3 Paneles Techo | `PANELS_TECHO` — 5 familias con espesores y precios |
| §4 Paneles Pared | `PANELS_PARED` — 2 familias con espesores y precios |
| §5 Fijaciones | `FIJACIONES` — varilla, tuerca, arandela, kit anclaje, tornillo T2, remaches |
| §6 Selladores | `SELLADORES` — silicona, cinta, membrana, espuma PU |
| §7 Perfilería | `PERFIL_TECHO`, `PERFIL_PARED` — gotero, canalón, cumbrera, perfiles U, esquineros |
| §8 Escenarios | `SCENARIOS_DEF`, `VIS`, `BORDER_OPTIONS` |

### Capa de Cálculo (`src/utils/calculations.js`)

Funciones puras sin dependencias de React:

**Motor de techo:**
- `resolveSKU_techo()` — localiza perfil por tipo/familia/espesor
- `calcPanelesTecho()` — conteo de paneles y área
- `calcAutoportancia()` — verificación de luz libre
- `calcFijacionesVarilla()` — fijaciones varilla+tuerca+arandela (ISODEC)
- `calcFijacionesCaballete()` — fijaciones caballete+tornillo (ISOROOF)
- `calcPerfileriaTecho()` — perfiles de bordes
- `calcSelladoresTecho()` — silicona y cinta
- `calcTechoCompleto()` — orquestador

**Motor de pared:**
- `resolvePerfilPared()` — localiza perfil de pared
- `calcPanelesPared()` — paneles con deducción de aberturas
- `calcPerfilesU()` — perfiles U base y corona
- `calcEsquineros()` — esquineros interior/exterior
- `calcFijacionesPared()` — anclajes H°, tornillos T2, remaches POP
- `calcPerfilesParedExtra()` — perfiles K2, G2, aluminio 5852
- `calcSelladorPared()` — selladores de pared
- `calcParedCompleto()` — orquestador

**General:**
- `calcTotalesSinIVA()` — subtotal + IVA 22% = total final

### Capa de Utilidades (`src/utils/helpers.js`)

| Función | Propósito |
|---------|-----------|
| `applyOverrides()` | Aplica ediciones del usuario sobre ítems del BOM |
| `bomToGroups()` | Transforma resultados de cálculo en grupos de BOM |
| `fmtPrice()` | Formatea números como moneda |
| `generatePrintHTML()` | Genera HTML A4 completo para PDF |
| `openPrintWindow()` | Abre diálogo de impresión |
| `buildWhatsAppText()` | Formatea el BOM para compartir por WhatsApp |

---

## 📁 Estructura del Repositorio

```
Calculadora-BMC/
├── README.md                        # Este archivo
├── CONTRIBUTING.md                  # Guía de contribución
├── LICENSE                          # Licencia propietaria
├── package.json                     # Metadatos y scripts del proyecto
├── vite.config.js                   # Configuración de Vite (dev port 5173, build → dist/)
├── eslint.config.js                 # Reglas ESLint para src/
├── index.html                       # Punto de entrada HTML
├── Dockerfile                       # Imagen multi-stage (Node→build + Nginx runtime)
├── vercel.json                      # Configuración de deploy en Vercel
├── .gitignore                       # Excluye node_modules/, dist/, .env, etc.
├── src/
│   ├── main.jsx                     # Renderiza <App /> en #root
│   ├── App.jsx                      # Importa y renderiza PanelinCalculadora
│   ├── data/
│   │   └── constants.js             # Fuente de verdad (329 líneas)
│   ├── utils/
│   │   ├── calculations.js          # Motores de cálculo puros (359 líneas)
│   │   └── helpers.js               # BOM, PDF, WhatsApp (93 líneas)
│   └── components/
│       └── PanelinCalculadoraV3.jsx # Componente principal (643 líneas)
├── tests/
│   └── validation.js                # Suite de validación (63 assertions)
├── docs/
│   ├── ARCHITECTURE.md              # Arquitectura técnica detallada
│   ├── PRICING-ENGINE.md            # Motor de precios y listas
│   ├── CALC-TECHO.md                # Motor de cálculo de techos
│   ├── CALC-PARED.md                # Motor de cálculo de paredes
│   ├── UI-COMPONENTS.md             # Biblioteca de componentes UI
│   ├── SCENARIOS.md                 # Escenarios y reglas de visibilidad
│   ├── API-REFERENCE.md             # Referencia de funciones
│   ├── DEPLOYMENT.md                # Guía de deploy
│   └── CHANGELOG.md                 # Historial de cambios
└── .github/
    └── workflows/
        └── ci.yml                   # Pipeline CI (validate + lint)
```

---

## 🚀 Inicio Rápido

### Requisitos

- **Node.js** 20+
- **npm** 8+

### Instalación y desarrollo local

```bash
# 1. Clonar el repositorio
git clone https://github.com/matiasportugau-ui/Calculadora-BMC.git
cd Calculadora-BMC

# 2. Instalar dependencias
npm install

# 3. Iniciar servidor de desarrollo (http://localhost:5173)
npm run dev
```

### Usar como componente en otro proyecto React

```bash
# Instalar dependencias necesarias
npm install react react-dom lucide-react
```

```jsx
import PanelinCalculadora from './components/PanelinCalculadoraV3';

function App() {
  return <PanelinCalculadora />;
}
```

> El componente no requiere props. Toda la lógica y el estado son internos.

---

## 🛠 Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia servidor de desarrollo Vite en `http://localhost:5173` |
| `npm run build` | Compila para producción → carpeta `dist/` |
| `npm run preview` | Previsualiza el build de producción localmente |
| `npm test` | Ejecuta la suite de validación (`node tests/validation.js`, 63 assertions) |
| `npm run lint` | ESLint sobre `src/` — debe retornar 0 errores y 0 advertencias |

---

### Backend MercadoLibre (OAuth + Connector)

El repositorio ahora incluye un backend en `server/` para integrar OAuth de MercadoLibre y exponer endpoints base.

1) Copiar variables de entorno:

```bash
cp .env.example .env
```

2) Completar en `.env`:
- `ML_CLIENT_SECRET` (manual, privado)
- `ML_REDIRECT_URI_PROD` (si aplica)
- `TOKEN_ENCRYPTION_KEY` recomendado para cifrar tokens

3) Instalar y ejecutar:

```bash
npm install
npm run dev:api
```

4) Iniciar OAuth inicial (login manual):
- Abrir `http://localhost:3001/auth/ml/start`
- Al volver al callback quedará guardado el token para llamadas API

5) Probar conectores:
- `GET http://localhost:3001/ml/users/me`
- `GET http://localhost:3001/ml/items/{ITEM_ID}`

## 💰 Sistema de Precios

Todos los precios en el motor son **SIN IVA**. El IVA 22% se aplica **una sola vez** al total final mediante `calcTotalesSinIVA()`.

| Lista | Variable | Descripción | Uso |
|-------|----------|-------------|-----|
| `venta` | `LISTA_ACTIVA = "venta"` | Precio BMC directo | Clientes directos, presupuestos |
| `web` | `LISTA_ACTIVA = "web"` | Precio Shopify | Precio público web |

La función `p(item)` resuelve el precio activo:

```javascript
// En src/data/constants.js
p({ venta: 37.76, web: 45.97 })
// → 37.76 si LISTA_ACTIVA === "venta"
// → 45.97 si LISTA_ACTIVA === "web"
```

Ver [`docs/PRICING-ENGINE.md`](docs/PRICING-ENGINE.md) para documentación detallada.

---

## 📐 Escenarios de Obra

| Escenario | Familias disponibles | Bordes | Autoportancia | Esquineros |
|-----------|---------------------|--------|---------------|------------|
| 🏠 Solo Techo | ISODEC EPS, ISODEC PIR, ISOROOF 3G/FOIL/PLUS | ✅ | ✅ | ❌ |
| 🏢 Solo Fachada | ISOPANEL EPS, ISOWALL PIR | ❌ | ❌ | ✅ |
| 🏗 Techo + Fachada | Todas las familias | ✅ | ✅ | ✅ |
| ❄️ Cámara Frigorífica | ISOPANEL EPS, ISOWALL PIR | ❌ | ❌ | ✅ |

Ver [`docs/SCENARIOS.md`](docs/SCENARIOS.md) para reglas de visibilidad completas.

---

## 📊 Catálogo de Paneles

### Paneles de Techo

| Familia | Ancho útil | Largo (m) | Sistema de fijación | Espesores disponibles (mm) |
|---------|-----------|-----------|---------------------|---------------------------|
| ISODEC EPS | 1.12 m | 2.3 – 14.0 | Varilla + tuerca + arandela | 100, 150, 200, 250 |
| ISODEC PIR | 1.12 m | 3.5 – 14.0 | Varilla + tuerca + arandela | 50, 80, 120 |
| ISOROOF 3G | 1.00 m | 3.5 – 8.5 | Caballete + tornillo | 30, 40, 50, 80, 100 |
| ISOROOF FOIL | 1.00 m | 3.5 – 8.5 | Caballete + tornillo | 30, 50 |
| ISOROOF PLUS | 1.00 m | 3.5 – 8.5 | Caballete + tornillo | 50, 80 |

### Paneles de Pared

| Familia | Ancho útil | Largo (m) | Espesores disponibles (mm) |
|---------|-----------|-----------|---------------------------|
| ISOPANEL EPS | 1.14 m | 2.3 – 14.0 | 50, 100, 150, 200, 250 |
| ISOWALL PIR | 1.10 m | 3.5 – 14.0 | 50, 80, 100 |

---

## 🔧 Motores de Cálculo

### Reglas generales

- **Cantidades**: siempre `Math.ceil()` — nunca `round()` ni `floor()`
- **Precios**: siempre `p(item)` — nunca hardcodeados en las funciones de cálculo
- **IVA**: se calcula una sola vez al final, no en cada línea del BOM

### Fijaciones de Techo

**Varilla + tuerca** (familias ISODEC):
```
puntos_fijacion = ceil((cantPaneles × apoyos × 2) + (largo × 2 / 2.5))
```

**Caballete + tornillo** (familias ISOROOF):
```
caballetes = ceil((cantPaneles × 3 × (largo / 2.9 + 1)) + (largo × 2 / 0.3))
```

### Fijaciones de Pared

| Componente | Cálculo |
|------------|---------|
| Kit anclaje H° | 1 kit cada 0.30 m en perímetro inferior |
| Tornillo T2 | 5.5 unidades por m² (estructura metal/mixto) |
| Remaches POP | 2 por panel |

> ⚠️ Las paredes **NO** usan varilla/tuerca/arandela — esos son exclusivos de techo.

### Soporte Canalón

```
ml_soportes   = (cantPaneles + 1) × 0.30
barras_soporte = ceil(ml_soportes / largo_barra)
```

Ver [`docs/CALC-TECHO.md`](docs/CALC-TECHO.md) y [`docs/CALC-PARED.md`](docs/CALC-PARED.md) para documentación completa de cada función.

---

## 🖥 Componentes UI

El componente principal incluye 13 sub-componentes con estilos en línea. No se usa Tailwind ni CSS modules — solo tokens del objeto `C` (colores) y `FONT` (tipografía) definidos en `constants.js`.

| Componente | Descripción |
|------------|-------------|
| `AnimNum` | Número animado con transición suave |
| `CustomSelect` | Dropdown con estilo personalizado |
| `StepperInput` | Input numérico con botones +/− |
| `SegmentedControl` | Selector de pestañas (lista venta/web) |
| `Toggle` | Interruptor on/off |
| `KPICard` | Tarjeta de métrica (área, cantidad, precio) |
| `ColorChips` | Selector de color de panel |
| `AlertBanner` | Alertas informativas/advertencia/éxito |
| `Toast` | Notificación temporal |
| `TableGroup` | Tabla BOM colapsable con edición en línea |
| `BorderConfigurator` | Configurador de bordes de techo |

Ver [`docs/UI-COMPONENTS.md`](docs/UI-COMPONENTS.md) para detalles de cada componente.

---

## 🌐 Deploy

### Vercel (recomendado)

```bash
npm install
npx vercel --prod
```

La configuración está en `vercel.json` (framework: vite, output: `dist/`).

### Docker

```bash
# Build de imagen multi-stage (Node 20 Alpine → Nginx 1.27 Alpine)
docker build -t calculadora-bmc:latest .

# Ejecutar en puerto 8080
docker run --rm -p 8080:80 calculadora-bmc:latest
```

La aplicación queda disponible en `http://localhost:8080`.

### Build estático

```bash
npm run build
# Archivos listos en dist/ — servir con cualquier servidor HTTP estático
```

Ver [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) para opciones adicionales de deploy.

---

## ⚙️ CI/CD

El pipeline de GitHub Actions (`.github/workflows/ci.yml`) se activa en push a `main`/`develop` y en PR a `main`.

| Job | Pasos | Propósito |
|-----|-------|-----------|
| **validate** | `npm ci` → `node tests/validation.js` → `npm run build` | Validar cálculos y asegurar que el build es exitoso |
| **lint** | `npm ci` → `npm run lint` | Verificar calidad del código (0 errores, 0 advertencias) |

---

## 📝 Restricciones Técnicas

| Regla | Detalle |
|-------|---------|
| Estado | Solo `React.useState` — NO `localStorage`, NO APIs externas |
| Estilos | Inline styles únicamente — no Tailwind, no CSS modules |
| Cantidades | `Math.ceil()` para TODAS las cantidades de materiales |
| Precios | `p(item)` para resolver precios — nunca hardcodeados |
| IVA | Una sola vez al final en `calcTotalesSinIVA()` |
| Props | El componente principal no requiere props |
| Dependencias | Solo React 18, ReactDOM y lucide-react |

---

## 🏢 Datos de la Empresa

| Campo | Valor |
|-------|-------|
| Razón social | METALOG SAS |
| Marca | BMC Uruguay |
| RUT | 120403630012 |
| Ubicación | Maldonado, Uruguay |
| Web | [bmcuruguay.com.uy](https://bmcuruguay.com.uy) |
| Contacto | 092 663 245 |
| Banco | BROU · Cta. Dólares: 110520638-00002 |

---

## 📄 Licencia

Código propietario de BMC Uruguay / METALOG SAS. Todos los derechos reservados. Uso restringido.

---

*Desarrollado con ❤️ para BMC Uruguay · 2026*
