# DESIGN-UI — BMC Driver (Outdoor Night)

**Module:** `bmc-driver-loop`  
**Tokens:** `src/styles/bmc-driver.css` (`--drv-*`)  
**Not** Liquid Glass (operator `/logistica`) and **not** Applied AI (Hub). Chofer works outdoors / at night.

Visual specs (source of truth for layout):

| # | File | Screen |
|---|------|--------|
| 1 | `evidence/screens/01-login.jpg` | Login |
| 2 | `evidence/screens/02-profile.jpg` | Perfil |
| 3 | `evidence/screens/03-trip-phases-carga.jpg` | Secuencia de carga |
| 4 | `evidence/screens/04-trips-admin-home.png` | Home / administración de viajes |
| 5 | `evidence/screens/05-trip-done.png` | Viaje completado |

---

## 1. Tokens

| Token | Value | Use |
|-------|-------|-----|
| `--drv-bg` | `#07111f` | Canvas |
| `--drv-card` | `#122033` | Cards |
| `--drv-text` | `#f4f7fb` | Primary text |
| `--drv-mute` | `#8b9bb0` | Labels |
| `--drv-orange` | `#f15a24` | Primary CTA (Ingresar, Iniciar carga, FAB) |
| `--drv-navy` | `#1e3a8a` | Secondary (offline login) |
| `--drv-green` | `#22c55e` | Done / success |
| `--drv-blue` | `#2563eb` | In-progress step / remitos |
| `--drv-radius` | `16px` | Cards |
| `--drv-cta-h` | `52px` | Thumb CTA |

Night/outdoor is the **default**. Profile “Outdoor / Night” is on; light theme deferred.

Phone compact **390×844**. CTA in bottom 40%. Hit ≥ 48px. `100dvh` + `env(safe-area-inset-*)`. Inputs `font-size: 16px`.

---

## 2. Screen contracts

### 2.1 Login — `/conductor` without session

**Primary action:** Ingresar (orange, full width).  
**Secondary:** Trabajá sin conexión (navy).

| Spec | Integration |
|------|-------------|
| Usuario / Contraseña | v1: **Usuario** = display name (profile). **Contraseña** = opaque driver token if the chofer opens the app without `?t=`. Magic link `?t=` skips this form. No password table. |
| Crystal BMC logo | CSS/SVG mark; warehouse photo is atmosphere (CSS overlay), not a second product. |
| Offline | Uses last `localStorage` token + IndexedDB outbox. |

### 2.2 Profile — `/conductor/perfil`

Hero: avatar, name, “Chofer - BMC Uruguay”, conductor id, license chip, Editar perfil.  
Cards: datos, preferencias (tema, texto), notificaciones, offline+sync, Cerrar sesión.  
Tab bar: Viajes · Historial · Mapa · Documentos · **Perfil**.

**v1 wiring:** name/phone from `bmc-driver-profile-v1` + trip snapshot. Cerrar sesión clears token. Offline badge = pending outbox count. Mapa/Documentos/Historial = same trip views or “próximamente” — do not invent a second document store.

### 2.3 Trip phases — `/conductor/carga`

Title **Carga en fábrica**. Ordered steps mapped 1:1 to events:

| UI | Event |
|----|--------|
| Llegué a fábrica | `factory_arrived` |
| Inicié carga | `load_started` |
| Carga lista | `load_completed` |
| Salí de fábrica | `factory_departed` |

Current step = blue “En progreso”; done = green; pending = mute.  
Resumen de carga from `plan_snapshot` (tipo, qty, destino, peso/m³ if present).  
**Ver carga en 3D** → optional deep-link `/logistica` is **operator**; v1 hide or open read-only note.  
Orange CTA = action for the **current** step (not a parallel UUID field).  
After `factory_departed`, UI switches to delivery stops (`stop_arrived` / `delivery_completed`) then **listo**.

### 2.4 Trips admin (home) — `/conductor` with session

Greeting **Hola {name}**. Offline banner if `navigator.onLine === false` or outbox > 0.  
Card **Viaje en curso**: origin → destination from first pickup + last delivery (UY, not BA–Córdoba placeholder). Progress from event count. Stats: salida, carga, ETA if snapshot has them.  
Acciones rápidas: Mis rutas (home), Carga 3D (deferred), Remitos (photo evidence), Mapa (OSM of last ping).  
Actividad reciente = `timeline` events.  
Bottom: Inicio · Rutas · **+ Registrar** (evidence) · Remitos. `+` is photo POD, not a new trip (operator assigns).

**API today:** one trip per driver session. List of historical trips = TARGET (same table, extra query). v1: current trip + timeline as activity.

### 2.5 Trip accomplished — `/conductor/listo`

Shown when `delivery_completed` for all delivery stops **or** trip `closed`.  
Stats: paradas, km (haversine from snapshot geos if any), remitos (`evidence_committed` count), incidencias.  
Resumen de paradas with times from events.  
CTA primary **Ver remitos** (evidence list). Secondary **Nueva ruta** → home (does **not** create a trip).

Peak–end: this is the last screen of the job; keep it calm and green.

---

## 3. Navigation map

```
Login ──?t= / Ingresar──► Home (admin)
                              ├─ Carga (phases)
                              ├─ Listo (done)
                              └─ Perfil
```

No `BmcModuleNav`. No Google `AuthHeader`. Safe-area tab bar.

---

## 4. Copy / locale

Spanish (UY). Destinations come from REP stops (`cliente`, `direccion`), never mock AR cities in production UI.

---

## 5. Anti-patterns

- Operator Liquid Glass on driver phone.
- Raw UUID “Stop ID” field (replaced by named stops).
- Changing global PWA `start_url` away from `/calculadora`.
- Username/password against identity JWT (that is Hub, not chofer).
- Auto-send customer WhatsApp.
