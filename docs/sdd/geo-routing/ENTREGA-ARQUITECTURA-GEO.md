# 📋 Entrega: Arquitectura de Geolocalización y Rutas BMC

**Fecha:** 2026-08-08  
**Arquitecto:** SD-Architech  
**Versión Especificación:** 1.0  
**Estado:** ✏️ En Revisión (Pendiente aprobación PO + Dev)

---

## 🎯 Resumen de la Propuesta

Se propone **extender incrementalmente** el sistema de geolocalización BMC en dos áreas clave:

### 1. **Calculadora — Paso 10 (NUEVO): Dirección de Entrega**
- Captura completa de punto de entrega: dirección legible + coordenadas (lat/lng)
- Componente `AddressPicker` con:
  - Input de texto + autocompletado Nominatim
  - Mapa interactivo (Fase 2)
  - Validación de coordenadas
- Persistencia de dirección + geo_timestamp + maps URL
- Alimenta cálculo de costos de logística

### 2. **Módulo Logística — Visualización y Optimización de Rutas**
- Mapa interactivo multi-marker (todos los stops, polyline de ruta)
- Reordenamiento manual de secuencia (drag-drop, Fase 2)
- Optimización automática de ruta (OSRM, Fase 2)
- Cálculos dinámicos: km totales, tiempo estimado, ETA por parada

### 3. **Preparación Futura: App de Choferes**
- Contratos API y modelo de datos diseñados para escalabilidad
- WebSockets para estado en tiempo real
- Endpoints normalizados para aplicación móvil

---

## 📦 Entregables Generados

### 1. Especificación Técnica Completa
- **Formato:** Interactive HTML Artifact
- **Ubicación:** Enlace compartido en Slack
- **Contenido:**
  - Análisis estado actual + gaps críticos
  - Diagramas flujo (Mermaid)
  - Modelo de datos completo (TypeScript)
  - Diseño de componentes UI/UX
  - Endpoints API (request/response samples)
  - 3 fases de implementación (MVP → Feature Complete → Mobile Ready)
  - Riesgos + mitigaciones
  - Stack tecnológico recomendado
  - ADRs (Architecture Decision Records)

### 2. Quick Start Dev Guide
- **Ubicación:** `/docs/sdd/geo-routing/QUICK-START.md`
- **Contenido:**
  - TL;DR checklist Fase 1 (qué implementar)
  - Modelo de datos MVP
  - Archivos a crear/editar
  - Stack tecnológico (librerías recomendadas)
  - Common pitfalls

### 3. Especificación Full Markdown
- **Ubicación:** `/tmp/claude-0/.../scratchpad/BMC-GEO-ROUTING-SPEC.md`
- **Secciones:** 15 secciones exhaustivas (análisis, arquitectura, datos, UI, API, riesgos, etc.)

---

## 🏗️ Arquitectura Propuesta (Resumen Visual)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CALCULADORA (12 PASOS)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Paso 1-9: Familia → Color → Dimensiones → Estructura              │
│                                                                     │
│  ╔═══════════════════════════════════════════════════════════════╗ │
│  ║  PASO 10 (NUEVO): DIRECCIÓN / PUNTO DE ENTREGA              ║ │
│  ║  ─────────────────────────────────────────────────────────── ║ │
│  ║  • AddressPicker: Text input + Nominatim autocomplete        ║ │
│  ║  • Mapa interactivo c/ pin draggable (Fase 2)               ║ │
│  ║  • MiniMap preview en resumen del paso                      ║ │
│  ║  • Persistencia: dirección_entrega + lat/lng + maps_url     ║ │
│  ╚═══════════════════════════════════════════════════════════════╝ │
│                                                                     │
│  Paso 11: FLETE (costos ajustados por distancia real)             │
│  Paso 12: DATOS DEL PROYECTO                                       │
│                                                                     │
│  [📤 EXPORTAR CON GEO] ────────────────────────────────────────────────┐
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                                                       │
                ┌──────────────────────────────────────────────────────┘
                │
                ▼
        ┌─────────────────────────────────────────────────────────────────┐
        │                    MÓDULO LOGÍSTICA (P3)                        │
        ├─────────────────────────────────────────────────────────────────┤
        │                                                                 │
        │  ╔════════════════════════╦════════════════════════════════╗   │
        │  ║  MULTI-MARKER MAP      ║  SECUENCIA DE PARADAS         ║   │
        │  ║  ─────────────────────  ║  ─────────────────────────── ║   │
        │  ║                        ║                              ║   │
        │  ║  • Leaflet (OSM)      ║  • Stop 1: Dirección + ETA  ║   │
        │  ║  • Markers coloreados  ║  • Stop 2: Dirección + ETA  ║   │
        │  ║  • Polyline (ruta)     ║  • Stop N: Dirección + ETA  ║   │
        │  ║                        ║                              ║   │
        │  ║  STATS:                ║  Controles:                  ║   │
        │  ║  • Total: X km         ║  ✓ Optimizar ruta           ║   │
        │  ║  • Duración: YY min    ║  ↔️ Reordenar (D&D)         ║   │
        │  ║  • ETA retorno: HH:MM  ║  🔗 Google Maps             ║   │
        │  ╚════════════════════════╩════════════════════════════════╝   │
        │                                                                 │
        └─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Modelo de Datos (Extensiones)

### Proyecto (Calculadora, Paso 12)
```javascript
{
  // Existentes
  titulo: "Obra XYZ",
  empresa: "BMC",
  
  // NUEVOS (Paso 10)
  direccion_entrega: "Av. Libertador, 1000, Montevideo",
  entrega_lat: -34.9011,
  entrega_lng: -56.1645,
  entrega_maps_url: "https://www.google.com/maps/...",
  entrega_place_id: "nominatim_12345",
  entrega_formatted_address: "Avenida Libertador, 1000",
  geo_timestamp: "2026-08-08T10:30:00Z",
  geo_source: "nominatim"
}
```

### Stop (Logística)
```javascript
{
  id: "stop_001",
  orden: 1,
  cliente: "Cliente A",
  direccion: "Calle 10, Apto 5",
  
  // NUEVO
  geo: {
    lat: -34.8833,
    lng: -56.1667,
    source: "nominatim",
    at: "2026-08-08T10:35:00Z",
    accuracy: "rooftop"
  },
  
  mapLink: "https://www.google.com/maps/...",
  checks: { datosOk: true, mapaOk: true }
}
```

---

## 🎨 Componentes UI a Implementar

| Componente | Ubicación | Propósito | Fase |
|---|---|---|---|
| **AddressPicker** | `src/components/AddressPicker.jsx` | Captura dirección + coords en Paso 10 | 1 |
| **MiniMapPreview** | `src/components/MiniMapPreview.jsx` | Thumbnail en resumen de paso | 1 |
| **RouteOptimizerView** | `src/components/logistica/RouteOptimizerView.jsx` | Mapa + lista + stats en logística | 1 |
| MapContainer (Leaflet) | RouteOptimizerView.jsx | Render mapa OSM | 1 |
| PickupMarker | RouteOptimizerView.jsx | Marcador base (depósito) | 1 |
| StopMarkers | RouteOptimizerView.jsx | Marcadores stops (por estado) | 1 |
| RoutePolyline | RouteOptimizerView.jsx | Línea de ruta | 1 |
| StopSequencePanel | RouteOptimizerView.jsx | Lista ordenable (D&D Fase 2) | 2 |

---

## 🔌 Endpoints API a Implementar

### Mejora Existente
- **POST /api/envios/geocode**
  - Agregar Redis caché (TTL: 7 días)
  - Fallback a Google si Nominatim falla
  - Response normalizada

### Nuevos Endpoints
- **POST /api/envios/optimize-route**
  - Input: pickup point + stops array
  - Output: Route with stops_ordered, km_total, polyline_geojson
  - Métodos: haversine (MVP) → OSRM/Google (Fase 2)

- **POST /api/envios/import-calc-address**
  - Input: calcState con dirección_entrega + coords
  - Output: Stop creado con geo completo
  - Interfaz Calculadora ↔ Logística

---

## 📅 Fases Implementación

### **Fase 1: MVP (1-2 semanas)**
**Objetivo:** Paso 10 funcional + visualización básica rutas

**Deliverables:**
- ✅ AddressPicker (sin mapa aún)
- ✅ MiniMapPreview
- ✅ Integración Paso 10 en Calculadora
- ✅ RouteOptimizerView básico (Leaflet + haversine)
- ✅ Mejorar /api/envios/geocode (caché Redis)
- ✅ Crear /api/envios/import-calc-address

**Tests:**
- Unit: geocode.test.js (ampliar)
- Integration: geo-step10.test.js (nuevo)

---

### **Fase 2: Interactividad (1-2 semanas)**
**Objetivo:** Mapa interactivo + optimización automática

**Nuevas features:**
- Mapa interactivo en AddressPicker (click para pin, drag)
- Reverse geocode on pin drag
- Drag-drop reorder stops en logística
- Endpoint /api/envios/optimize-route (OSRM)
- Botón "Optimizar ruta automática"
- Google Maps directions URL

---

### **Fase 3: Preparación Mobile (1-2 semanas)**
**Objetivo:** Base para futura app de choferes

**Nuevas features:**
- Endpoint GET /api/envios/reparto/{id}/route
- WebSockets para estado en tiempo real
- Persistencia de actualizaciones (real_arribo, estado)
- Documentación contratos API
- Testing mobile-ready

---

## 🧠 Stack Tecnológico Recomendado

### Frontend
```json
{
  "leaflet": "^1.9.4",
  "react-leaflet": "^4.2.0",
  "downshift": "^8.2.0",
  "react-beautiful-dnd": "^13.1.1"
}
```

### Backend
- Redis para caché geocoding
- OSRM API (público o self-hosted)
- Nominatim (OSM, libre)

### APIs Externas
- **Nominatim (OSM):** Geocoding (libre, 1 req/seg)
- **OSRM:** Routing (libre, público)
- **Google Maps (optional):** Directions, Distance Matrix ($$)

---

## ⚠️ Riesgos Identificados

| Riesgo | Severidad | Probabilidad | Mitigation |
|--------|-----------|--------------|-----------|
| Nominatim rate-limit (1/s) | 🟡 Media | 🔴 Alta | Redis caché 7 días |
| Google Maps costs | 🔴 Alta | 🟡 Media | MVP con OSRM, feature flag |
| Breaking change Calculadora | 🔴 Alta | 🟢 Baja | Versionado JSON + feature flag |
| Mobile UX mapa | 🟡 Media | 🟡 Media | Touch handlers, responsive |
| Reverse geocode lag | 🟡 Media | 🟡 Media | Debounce 500ms |
| OSRM API no disponible | 🟡 Media | 🟢 Baja | Fallback haversine |

---

## 📝 Próximos Pasos (Recomendados)

### Paso 1: Revisión Especificación
- [ ] PO + Dev Team revisan especificación completa
- [ ] Validar estimaciones (1-2 semanas por fase)
- [ ] Aprobar priorización (Fase 1 vs alternativas)

### Paso 2: Task Breakdown
- [ ] Crear tasks en Jira/GitHub (desglosadas por fase)
- [ ] Assign a Dev + QA
- [ ] Establecer milestone (ej: "Sep 15 - Geo MVP")

### Paso 3: Kickoff
- [ ] Crear rama `claude/bmc-geolocation-routing-n7m4f5` (ya existe)
- [ ] Dev inicia Fase 1
- [ ] Daily standup: estado AddressPicker, tests, integración

### Paso 4: QA + Merge
- [ ] Tests pasan (unit + integration + E2E)
- [ ] Gate local pasa: lint + test + contracts
- [ ] Code review (focus en geocoding edge cases)
- [ ] Merge a `main` + deploy

---

## 📚 Referencias

**Especificación Completa:**  
→ Artifact interactivo (link en Slack)

**Quick Start Dev:**  
→ `/docs/sdd/geo-routing/QUICK-START.md`

**Full Spec Markdown:**  
→ `Especificación full en scratchpad`

---

## 🎓 Glosario

- **Nominatim:** OSM reverse geocoder (openstreetmap.org/nominatim)
- **Haversine:** Fórmula great-circle para distancia entre coords
- **OSRM:** Open Source Routing Machine (routing.openstreetmap.de)
- **GeoJSON:** Formato estándar para geometrías geoespaciales
- **place_id:** Identificador único en Nominatim/Google

---

**Fin de Entrega**

**Estado:** ✏️ Especificación Propuesta 1.0  
**Aprobación Requerida:** PO + Lead Dev  
**Fecha Propuesta Implementación:** Sep 2026  

---

*Elaborado por: SD-Architech*  
*Repositorio: matiasportugau-ui/calculadora-bmc*  
*Rama de trabajo: claude/bmc-geolocation-routing-n7m4f5*
