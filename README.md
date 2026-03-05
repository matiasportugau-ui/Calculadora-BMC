# 🧮 Calculadora BMC — Panelin v3.0

**Cotizador profesional de paneles de aislamiento térmico y acústico para BMC Uruguay (METALOG SAS)**

![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)
![License](https://img.shields.io/badge/license-proprietary-red)
![Version](https://img.shields.io/badge/version-3.0.0-blue)

---

## 📋 Descripción

Calculadora de cotización en tiempo real para paneles de construcción (ISODEC, ISOROOF, ISOPANEL, ISOWALL). Un solo archivo React (`.jsx`) que incluye:

- **Motor de cálculo de techos** — paneles, autoportancia, fijaciones varilla/caballete, perfilería de bordes, selladores
- **Motor de cálculo de paredes** — paneles, perfiles U/K2/G2/5852, fijaciones por anclaje, esquineros, aberturas
- **4 escenarios de obra** — Solo techo, Solo fachada, Techo + Fachada, Cámara frigorífica
- **Doble lista de precios** — Precio BMC (venta directa) y Precio Web (Shopify)
- **Generador PDF** — Cotización imprimible con datos bancarios
- **WhatsApp copy** — Texto formateado listo para enviar

## 🏗 Arquitectura

```
PanelinCalculadoraV3.jsx (~1400 líneas)
├── §1  DESIGN TOKENS + CSS
├── §2  DATOS (PANELIN_PRECIOS_V3_UNIFICADO — fuente de verdad)
├── §3  ENGINE TECHO (calcTechoCompleto)
├── §4  ENGINE PARED (calcParedCompleto — fijaciones reescritas)
├── §5  ESCENARIOS + OVERRIDES + GEOMETRÍA
├── §6  UI COMPONENTS (13 sub-componentes)
├── §7  PDF GENERATOR + WhatsApp
└── §8  MAIN COMPONENT + RENDER
```

## 🚀 Uso Rápido

### Como Artifact en Claude.ai

1. Subir `PanelinCalculadoraV3.jsx` como artifact React
2. Se renderiza directamente — no requiere build

### En proyecto React existente

```bash
# Copiar el archivo
cp PanelinCalculadoraV3.jsx src/components/

# Importar y usar
import PanelinCalculadora from './components/PanelinCalculadoraV3';

function App() {
  return <PanelinCalculadora />;
}
```

### Dependencias

Solo React 18+ y lucide-react:

```bash
npm install react react-dom lucide-react
```

## 💰 Sistema de Precios

Todos los precios son **SIN IVA**. El IVA 22% se aplica **una sola vez** al total final.

| Lista | Descripción | Uso |
|-------|------------|-----|
| `venta` | Precio BMC directo | Clientes directos, presupuestos |
| `web` | Precio Shopify | Precio público web |

La función `p(item)` resuelve el precio según `LISTA_ACTIVA`:
```javascript
p({ venta: 37.76, web: 45.97 }) // → 45.97 si LISTA_ACTIVA === "web"
```

## 📐 Escenarios

| Escenario | Familias | Bordes | Autoportancia | Esquineros |
|-----------|----------|--------|---------------|------------|
| 🏠 Solo Techo | ISODEC, ISOROOF | ✅ | ✅ | ❌ |
| 🏢 Solo Fachada | ISOPANEL, ISOWALL | ❌ | ❌ | ✅ |
| 🏗 Techo + Fachada | Todas | ✅ | ✅ | ✅ |
| ❄️ Cámara Frigorífica | ISOPANEL, ISOWALL | ❌ | ❌ | ✅ |

## 🔧 Reglas de Cálculo Clave

### Fijaciones Techo
- **Varilla + tuerca** (ISODEC): puntos = `ceil((cantP × apoyos × 2) + (largo × 2 / 2.5))`
- **Caballete + tornillo** (ISOROOF): caballetes = `ceil((cantP × 3 × (largo/2.9 + 1)) + (largo × 2 / 0.3))`

### Fijaciones Pared (CORREGIDAS v3)
- **Kit anclaje H°**: cada 0.30m en perímetro inferior
- **Tornillo T2**: 5.5/m² para estructura metal/mixto
- **Remaches POP**: 2 por panel
- ⚠️ NO usa varilla/tuerca/arandela (eso es solo techo)

### Soporte Canalón (CORREGIDO v3)
```
mlSoportes = (cantP + 1) × 0.30
barrasSoporte = ceil(mlSoportes / largo_barra)
```

## 📁 Estructura del Repositorio

```
calculadora-bmc/
├── README.md                    # Este archivo
├── LICENSE
├── CONTRIBUTING.md
├── package.json
├── .gitignore
├── src/
│   └── PanelinCalculadoraV3.jsx # Componente principal (único archivo)
├── docs/
│   ├── ARCHITECTURE.md          # Arquitectura técnica detallada
│   ├── PRICING-ENGINE.md        # Motor de precios y listas
│   ├── CALC-TECHO.md            # Motor de cálculo de techos
│   ├── CALC-PARED.md            # Motor de cálculo de paredes
│   ├── UI-COMPONENTS.md         # Biblioteca de componentes UI
│   ├── SCENARIOS.md             # Escenarios y reglas de visibilidad
│   ├── API-REFERENCE.md         # Referencia de funciones
│   ├── DEPLOYMENT.md            # Guía de deploy
│   └── CHANGELOG.md             # Historial de cambios
├── tests/
│   └── validation.js            # Tests de validación
├── assets/
│   └── (screenshots, diagrams)
└── .github/
    └── workflows/
        └── ci.yml               # CI pipeline
```

## 📊 Catálogo de Paneles

### Techo
| Familia | AU (m) | Largo | Sistema | Espesores (mm) |
|---------|--------|-------|---------|----------------|
| ISODEC EPS | 1.12 | 2.3-14m | Varilla+tuerca | 100, 150, 200, 250 |
| ISODEC PIR | 1.12 | 3.5-14m | Varilla+tuerca | 50, 80, 120 |
| ISOROOF 3G | 1.00 | 3.5-8.5m | Caballete+tornillo | 30, 40, 50, 80, 100 |
| ISOROOF FOIL | 1.00 | 3.5-8.5m | Caballete+tornillo | 30, 50 |
| ISOROOF PLUS | 1.00 | 3.5-8.5m | Caballete+tornillo | 50, 80 |

### Pared
| Familia | AU (m) | Largo | Espesores (mm) |
|---------|--------|-------|----------------|
| ISOPANEL EPS | 1.14 | 2.3-14m | 50, 100, 150, 200, 250 |
| ISOWALL PIR | 1.10 | 3.5-14m | 50, 80, 100 |

## 🏢 Datos de la Empresa

- **Razón social**: METALOG SAS
- **Marca**: BMC Uruguay
- **RUT**: 120403630012
- **Ubicación**: Maldonado, Uruguay
- **Web**: [bmcuruguay.com.uy](https://bmcuruguay.com.uy)
- **Contacto**: 092 663 245
- **Banco**: BROU · Cta. Dólares: 110520638-00002

## 📝 Restricciones Técnicas

- Default export, sin props requeridos
- NO localStorage / sessionStorage
- NO fetch / APIs externas
- Inline styles only (no Tailwind)
- Datos hardcodeados en el archivo
- Un solo archivo .jsx
- `Math.ceil` para TODAS las cantidades
- Precios SIN IVA en todo el motor

## 📄 Licencia

Código propietario de BMC Uruguay / METALOG SAS. Uso restringido.

---

*Desarrollado con ❤️ para BMC Uruguay · 2026*
