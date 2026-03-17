# 🏗 Arquitectura Técnica — Panelin v3.0

## Visión General

Panelin v3 es un **monolito React de archivo único** (~1400 líneas) diseñado para ejecutarse como artifact en Claude.ai o como componente embebido en cualquier app React 18+.

### Decisiones de Diseño

| Decisión | Razón |
|----------|-------|
| Archivo único | Compatibilidad con Claude.ai artifacts, portabilidad |
| Inline styles | Sin dependencia de Tailwind/CSS modules en runtime |
| Sin APIs externas | Funciona offline, sin latencia, sin CORS |
| Sin localStorage | Restricción de seguridad de artifacts |
| Precios hardcodeados | Fuente de verdad versionada, auditable |

## Diagrama de Flujo de Datos

```
┌─────────────────────────────────────────────────────┐
│                    UI (React State)                  │
│  listaPrecios ─┐  scenario ─┐  techo/pared/camara   │
└────────────────┼────────────┼───────────────────────┘
                 │            │
                 ▼            ▼
┌────────────────────────────────────────────────────┐
│           LISTA_ACTIVA  →  p(item)                  │
│     Resuelve precio SIN IVA según lista activa      │
└─────────────────────┬──────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌──────────────────┐   ┌──────────────────┐
│  calcTechoCompleto│   │ calcParedCompleto │
│  ├─ Paneles       │   │ ├─ Paneles       │
│  ├─ Autoportancia │   │ ├─ Perfiles U    │
│  ├─ Fijaciones    │   │ ├─ Esquineros    │
│  │  ├─ Varilla    │   │ ├─ K2/G2/5852   │
│  │  └─ Caballete  │   │ ├─ Fijaciones   │
│  ├─ Perfilería    │   │ │  ├─ Anclaje H°│
│  │  ├─ Goteros    │   │ │  ├─ Tornillo T2│
│  │  ├─ Canalón    │   │ │  └─ Remaches  │
│  │  └─ Cumbrera   │   │ └─ Selladores   │
│  └─ Selladores    │   │    ├─ Silicona   │
│     ├─ Silicona   │   │    ├─ Cinta      │
│     └─ Cinta      │   │    ├─ Membrana   │
└──────────┬───────┘   │    └─ Espuma PU  │
           │           └──────────┬───────┘
           │                      │
           └──────────┬───────────┘
                      ▼
          ┌──────────────────────┐
          │  calcTotalesSinIVA   │
          │  subtotal + IVA 22%  │
          │  = total final       │
          └──────────┬───────────┘
                     │
          ┌──────────┴──────────┐
          │   BOM Groups        │
          │   + applyOverrides  │
          └──────────┬──────────┘
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
   ┌─────────────┐    ┌──────────────┐
   │ UI Results  │    │ PDF/WhatsApp │
   │ KPIs, Table │    │ Generator    │
   │ Totals      │    │              │
   └─────────────┘    └──────────────┘
```

## Secciones del Archivo

### §1 Design Tokens + CSS (líneas 1-45)
Constantes de diseño (colores, tipografía, sombras, transiciones), keyframes inyectados al DOM.

### §2 Datos — PANELIN_PRECIOS_V3_UNIFICADO (líneas 46-310)
**Fuente de verdad de precios.** Todos SIN IVA. Incluye:
- `PANELS_TECHO` — 5 familias, ~15 espesores con precio venta/web/costo y autoportancia
- `PANELS_PARED` — 2 familias, ~8 espesores
- `FIJACIONES` — 12 tipos de fijación con precio dual
- `SELLADORES` — 4 tipos (silicona, cinta, membrana, espuma)
- `PERFIL_TECHO` — ~10 tipos de perfil por familia y espesor
- `PERFIL_PARED` — Perfiles U, G2, K2, 5852, esquineros
- `SERVICIOS` — Flete
- `p()` / `pIVA()` — Resolvers de precio

### §3 Engine Techo (líneas 311-510)
8 funciones de cálculo que usan `p()` para todos los precios:
1. `resolveSKU_techo` — Busca perfil por tipo/familia/espesor
2. `calcPanelesTecho` — Cantidad, área, costo
3. `calcAutoportancia` — Verificación de span
4. `calcFijacionesVarilla` — Sistema ISODEC
5. `calcFijacionesCaballete` — Sistema ISOROOF
6. `calcPerfileriaTecho` — Bordes, goteros, canalón (soporte corregido)
7. `calcSelladoresTecho` — Silicona + cinta
8. `calcTechoCompleto` — Orquestador

### §4 Engine Pared (líneas 511-720)
Completamente reescrito respecto a v2:
1. `resolvePerfilPared` — Resolver perfil pared
2. `calcPanelesPared` — Con descuento de aberturas
3. `calcPerfilesU` — Base + coronación
4. `calcEsquineros` — Exteriores + interiores
5. `calcFijacionesPared` — **NUEVO**: anclaje H° + T2 + remaches (NO varilla)
6. `calcPerfilesParedExtra` — **NUEVO**: K2 + G2 + 5852
7. `calcSelladorPared` — **NUEVO**: silicona + cinta + membrana + espuma
8. `calcParedCompleto` — Orquestador

### §5 Escenarios + Overrides + Geometría (líneas 721-870)
- `SCENARIOS_DEF` — 4 escenarios con familias permitidas
- `VIS` — Reglas de visibilidad por sección
- `BORDER_OPTIONS` — Opciones de borde por lado
- Override system — `applyOverrides`, `bomToGroups`

### §6 UI Components (líneas 871-1070)
13 componentes inline-styled:
`AnimNum`, `CustomSelect`, `StepperInput`, `SegmentedControl`, `Toggle`, `KPICard`, `ColorChips`, `AlertBanner`, `Toast`, `TableGroup`, `BorderConfigurator`

### §7 PDF Generator + WhatsApp (líneas 1071-1180)
- `generatePrintHTML` — HTML completo para impresión A4
- `openPrintWindow` — Popup con `window.print()`
- `buildWhatsAppText` — Texto formateado para copiar

### §8 Main Component (líneas 1181-1366)
- Estado React con `useState`
- Cálculo reactivo con `useMemo`
- Layout responsive: left panel (inputs) + right panel (results)
- Header sticky con branding BMC

## Gestión de Estado

```
State
├── listaPrecios: "venta" | "web"
├── scenario: "solo_techo" | "solo_fachada" | "techo_fachada" | "camara_frig"
├── proyecto: { tipoCliente, nombre, rut, telefono, direccion, descripcion, ... }
├── techo: { familia, espesor, color, largo, ancho, tipoEst, borders, opciones }
├── pared: { familia, espesor, color, alto, perimetro, numEsqExt, numEsqInt, aberturas, ... }
├── camara: { largo_int, ancho_int, alto_int }
├── flete: number
├── overrides: { [lineId]: { field, value, reason } }
├── collapsedGroups: { [title]: boolean }
└── UI: { activeStep, toast, showTransparency }
```

## Flujo de Recálculo

1. Usuario cambia un input → `useState` update
2. `useMemo` detecta dependencia cambiada
3. Llama `calcTechoCompleto` / `calcParedCompleto`
4. Motor usa `p()` que lee `LISTA_ACTIVA` global
5. Retorna `{ paneles, fijaciones, perfileria, selladores, totales, allItems, warnings }`
6. `bomToGroups` organiza items en grupos para la tabla
7. `applyOverrides` aplica ediciones manuales
8. `calcTotalesSinIVA` calcula total final con IVA

## Convenciones

- **Math.ceil** para TODAS las cantidades (nunca redondear hacia abajo)
- **toFixed(2)** para todos los precios
- **SIN IVA** en todo el motor, IVA solo en `calcTotalesSinIVA`
- **p(item)** siempre para resolver precios (nunca acceder `.venta` o `.web` directamente)
