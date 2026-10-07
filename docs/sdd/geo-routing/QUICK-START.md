# 🗺️ Geolocalización BMC — Quick Start Dev Guide

**Ubicación Repo:** `/docs/sdd/geo-routing/`  
**Especificación Completa:** Ver artifact interactivo (ver enlace de Slack)  
**Rama de Trabajo:** `claude/bmc-geolocation-routing-n7m4f5`

---

## 📍 TL;DR — Qué Hay que Implementar

### Fase 1 (MVP — 1-2 semanas)

#### Calculadora: Nuevo Paso 10

```
paso_11_flete → PASO 10 (NUEVO): DIRECCIÓN ENTREGA
                    │
                    ├─ AddressPicker (text input + Nominatim search)
                    ├─ MiniMapPreview (thumbnail static)
                    └─ Persistencia: direccion_entrega, entrega_lat, entrega_lng, geo_timestamp
```

**Archivo a crear:** `src/components/AddressPicker.jsx`

```jsx
<AddressPicker
  value={{ address, lat, lng, mapsUrl }}
  onChange={(newValue) => updateProyectoDatos(newValue)}
/>
```

#### Logística: Multi-Marker Map Básico

```
RouteOptimizerView
  ├─ Leaflet map (OSM tiles)
  ├─ Markers: pickup + stops
  ├─ RouteStats: km_total (haversine)
  └─ Lista de stops (non-interactive v1)
```

**Archivo a crear:** `src/components/logistica/RouteOptimizerView.jsx`

#### Backend: Mejorar Geocoding

```bash
# POST /api/envios/geocode (MEJORADO)
# - Agregar Redis caché (TTL: 7 días)
# - Response estructura: { hits: [{ lat, lng, label, placeId, confidence }] }
```

**Archivo a editar:** `server/routes/envios.js`

---

## 📊 Modelo de Datos MVP

### Extensión Proyecto (Paso 12)

```javascript
proyectoDatos: {
  // Existentes...
  titulo: "Obra XYZ",

  // NUEVOS (Paso 10)
  direccion_entrega: "Av. Libertador, 1000, Montevideo",
  entrega_lat: -34.9011,
  entrega_lng: -56.1645,
  entrega_maps_url: "https://www.google.com/maps/...",
  geo_timestamp: "2026-08-08T10:30:00Z",
  geo_source: "nominatim"
}
```

### Extensión Stop (Logística)

```javascript
stop: {
  id: "stop_001",
  orden: 1,
  cliente: "Cliente A",

  // NUEVO
  geo: {
    lat: -34.8833,
    lng: -56.1667,
    source: "nominatim",
    at: "2026-08-08T10:35:00Z"
  },

  checks: { datosOk: true, mapaOk: true }
}
```

---

## 🔧 Checklist Implementación Fase 1

### Frontend

- [ ] Crear `src/components/AddressPicker.jsx`
  - [ ] Text input + form validation
  - [ ] Nominatim search integration (fetch → /api/envios/geocode)
  - [ ] Debounce 300ms
  - [ ] Mobile-friendly (min 320px width)
  
- [ ] Crear `src/components/MiniMapPreview.jsx`
  - [ ] Static thumbnail (200×150)
  - [ ] Marker + label
  - [ ] Readonly en MVP

- [ ] Integrar AddressPicker en Paso 10
  - [ ] Ubicación: PanelinCalculadoraV3_backup.jsx, entre paso 9 (Selladores) y paso 11 (Flete)
  - [ ] Actualizar `SCENARIOS_DEF.solo_techo.wizardSteps` en constants.js
  - [ ] Agregar "proyecto" nuevas propiedades a estado

- [ ] Crear `src/components/logistica/RouteOptimizerView.jsx`
  - [ ] Leaflet + react-leaflet setup
  - [ ] Render pickup marker + stop markers
  - [ ] Display haversine distances
  - [ ] Stats: "X km" (haversine total)

- [ ] Integrar RouteOptimizerView en BmcLogisticaApp.jsx
  - [ ] Show cuando hay stops con geo válido

### Backend

- [ ] Mejorar `POST /api/envios/geocode` en `server/routes/envios.js`
  - [ ] Agregar Redis caché
  - [ ] Estructurar response: `{ success, hits: [{ lat, lng, label, ... }] }`
  - [ ] Manejo de errores (Nominatim fail → fallback msg)

- [ ] Crear `POST /api/envios/import-calc-address` (NUEVO)
  - [ ] Recibir calcState con dirección + coords
  - [ ] Crear o actualizar stop #1 en reparto
  - [ ] Return stop con geo + mapLink

### Testing

- [ ] Unit: `tests/geocode.test.js` (ampliar con reverse geocode)
- [ ] Integration: `tests/integration/geo-step10.test.js` (nuevo)
- [ ] E2E (optional): Playwright test Paso 10

---

## 🚀 Fase 2 Preview (No hacer ahora)

- Mapa interactivo en AddressPicker (draggable pin)
- Reverse geocode on drag
- Drag-drop reorder stops
- Endpoint `/api/envios/optimize-route` (OSRM)

---

## 📚 Archivos Relevantes Existentes

```
src/utils/logistica/geocode.js          ← Helpers (haversine, parseLatLng, etc)
src/components/BmcLogisticaApp.jsx      ← App principal logística
tests/geocode.test.js                   ← Tests existentes
```

---

## 🔗 Stack Técnico Recomendado (Fase 1)

| Componente | Librería | Versión | Razón |
|---|---|---|---|
| Mapas | Leaflet | ^1.9.4 | Ligero, sin API key, OSM integrado |
| React Leaflet | react-leaflet | ^4.2.0 | Bindings React nativos |
| Autocomplete | Downshift | ^8.2.0 | Componente tiny, accesible |
| HTTP | fetch (nativo) | — | Ya usado en proyecto |
| Caché | Redis (backend) | — | Ya disponible |

---

## 🎯 Key Metrics Éxito

✅ **Paso 10 funcional:** Usuario puede ingresar dirección y ver coords capturadas  
✅ **Persistencia:** Al exportar presupuesto, incluye geo datos  
✅ **Logística integrada:** RouteOptimizerView muestra stops con distancias  
✅ **UX:** <200ms latencia Nominatim search (con caché)  

---

## ⚠️ Common Pitfalls

❌ Confundir reverse geocode (coords → address) con forward (address → coords)  
❌ No cachear geocoding → rate-limit de Nominatim  
❌ Mapa Leaflet no renderiza sin `style={{ height: '500px' }}`  
❌ Olvidar validar coords antes de calcular haversine (puede ser NaN)  

---

## 📞 Contacto / Dudas

- **Especificación completa:** artifact interactivo (ver URL en Slack)
- **Rama:** `claude/bmc-geolocation-routing-n7m4f5`
- **Arquitecto:** @SD-Architech

---

**Status:** 📋 Propuesta Especificación 1.0 | En Revisión  
**Última actualización:** 2026-08-08
