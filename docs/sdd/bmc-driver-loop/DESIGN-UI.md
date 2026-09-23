# DESIGN-UI — BMC Driver (Outdoor Night)

**Module:** `bmc-driver-loop`  
**Tokens:** `src/styles/bmc-driver.css` (`--drv-*`)  
**Not** Liquid Glass (operator `/logistica`) and **not** Applied AI (Hub). Chofer works outdoors / at night.

Visual specs (source of truth for layout) — **SVG kit 2026-09-06**, not the old JPG pack:

| # | File | Screen |
|---|------|--------|
| 1 | `evidence/svg-kit-2026-09-06/login.svg` | Login |
| 2 | `evidence/svg-kit-2026-09-06/home.svg` | Home / viaje en curso |
| 3 | `evidence/svg-kit-2026-09-06/load.svg` | Carga en fábrica |
| 4 | `evidence/svg-kit-2026-09-06/done.svg` | Viaje completado |
| 5 | `evidence/svg-kit-2026-09-06/profile.svg` | Perfil |

JPG files under `evidence/screens/` are archival. Do not treat them as layout SoT.

**Route feed:** origin, dest, stops, qty, remito, next step come from the assigned trip `plan_snapshot` produced by `/logistica` confirm (`joinRepartoToTrip`). Driver never invents stops. Montevideo→Pando in the SVG kit is **demo sample content** only.

---

## 1. Tokens

| Token | Value | Use |
|-------|-------|-----|
| `--drv-bg` | `#07111f` | Canvas |
| `--drv-card` | `#122033` | Cards |
| `--drv-text` | `#f4f7fb` | Primary text |
| `--drv-mute` | `#8b9bb0` | Labels |
| `--drv-orange` | `#f15a24` | Primary CTA (Ingresar, current factory step) |
| `--drv-navy` | `#1e3a8a` | Secondary (offline login) |
| `--drv-green` | `#22c55e` | Done / success |
| `--drv-blue` | `#2563eb` | In-progress step / remitos |
| `--drv-radius` | `16px` | Cards |
| `--drv-cta-h` | `52px` | Thumb CTA |

Night/outdoor is the **default**. Profile “Outdoor / Night” is on; light theme deferred.

Phone compact **390×844**. CTA in bottom 40%. Hit ≥ 48px. `100dvh` + `env(safe-area-inset-*)`. Inputs `font-size: 16px`.

---

## 2. Screen contracts

### 2.1 Login — `/conductor/ingresar` (optional)

`/conductor` **opens the PWA without email or token** (guest). Magic `?t=` still skips the form. Login is optional: Home/Perfil → Ingresar, or `/conductor/ingresar`.

**Primary action:** Ingresar (orange, full width) — email/celular + contraseña, or token.  
**Secondary:** Entrar a la app (navy) — guest shell, no credentials. If a saved driver token exists, reuse it.

| Spec | Integration |
|------|-------------|
| Usuario / Contraseña | v1: **Usuario** = display name (profile). **Contraseña** = opaque driver token if the chofer opens the app without `?t=`. Magic link `?t=` skips this form. No password table. |
| Crystal BMC logo | CSS/SVG mark; warehouse photo is atmosphere (CSS overlay), not a second product. |
| Offline | Uses last `localStorage` token + IndexedDB outbox. |

### 2.2 Profile — `/conductor/perfil`

Hero: avatar, name, “Chofer - BMC Uruguay”, conductor id. Outdoor Night (not a light profile).  
Cards: datos, preferencias (tema Outdoor/Night activo), offline+sync, Cerrar sesión.  
Tab bar: **Inicio · Carga · Listo · Perfil** (Perfil selected).

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
Header counter is **N de 4** where N is the in-progress step (not “always 1”).  
Resumen de carga from `plan_snapshot` (tipo, qty, destino, peso/m³ if present).  
**Carga 3D** is deferred (“Próximamente”); do not deep-link the chofer into operator `/logistica`.  
Orange CTA = action for the **current** step (not a parallel UUID field).  
After `factory_departed`, UI switches to delivery stops (`stop_arrived` / `delivery_completed`) then **listo**.  
Tab bar: Inicio · **Carga** · Listo · Perfil.

### 2.4 Trips admin (home) — `/conductor` with session

Greeting **Hola {name}**. Offline banner if `navigator.onLine === false` or outbox > 0.  
Card **Viaje en curso**: origin → destination from `projectDriverTripFeed` (pickup / last delivery on `plan_snapshot`). UY stops from REP, not BA–Córdoba.  
Acciones rápidas: Mis rutas (carga), Remitos (photo evidence). Carga 3D and Mapa = muted **Próximamente**. No `+` FAB.  
Actividad reciente = `timeline` events.  
Bottom tab bar: **Inicio** · Carga · Listo · Perfil. Operator assigns trips; Driver never mints a route.

**API today:** one trip per driver session. List of historical trips = TARGET (same table, extra query). v1: current trip + timeline as activity.

### 2.5 Trip accomplished — `/conductor/listo`

Shown when `delivery_completed` for all delivery stops **or** trip `closed`.  
Stats: paradas, km (haversine from snapshot geos if any), remitos (`evidence_committed` count), incidencias.  
Resumen de paradas with times from events.  
CTA primary **Ver remitos** (evidence / home). Secondary **Nueva ruta** → home (does **not** create a trip). Split those two; do not combine “Ver remitos / inicio”.  
Same tab bar as other session screens, **Listo** selected.

Peak–end: this is the last screen of the job; keep it calm and green. No fake iOS chrome in the PWA (Figma device frames are OK).

---

## 3. Navigation map

```
Login ──?t= / Ingresar──► Home (Inicio)
                              ├─ Carga
                              ├─ Listo   (same tab bar)
                              └─ Perfil
```

One tab bar: Inicio / Carga / Listo / Perfil. No `BmcModuleNav`. No Google `AuthHeader`. Safe-area tab bar. No fake iPhone status bar in the shipped PWA.

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
- Treating the old JPG pack as layout SoT.
- Hardcoding production cities (Montevideo/Pando) when a live trip exists.
