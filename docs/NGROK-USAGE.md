# ngrok — Uso y revisión de tráfico

Documentación para entender cómo ngrok se usa en este repo y cómo interpretar el tráfico (200/404) al revisar logs o exports.

---

## URL y puerto

| ngrok apunta a | Puerto | Comando típico | Qué sirve |
|----------------|--------|----------------|-----------|
| **Express (API)** | 3001 | `ngrok http 3001` | API REST, `/finanzas` (dashboard static), redirect en `/` |
| **Vite (front)** | 5173 | `ngrok http 5173` | SPA Calculadora (React) |

**Recomendado:** `ngrok http 3001` — entrada única que sirve API + dashboard. La Calculadora (5173) se abre desde un link en el nav del dashboard.

---

## Front vs API

| Componente | Puerto | Tecnología | Ruta principal |
|------------|--------|-------------|----------------|
| **Front (Calculadora)** | 5173 | Vite + React | `GET /` → HTML SPA (~3KB) |
| **API (Express)** | 3001 | Express | `GET /` → 302 a `/finanzas`; `GET /finanzas` → dashboard HTML |

Cuando ngrok apunta a **3001**, el servidor Express:
- `GET /` con `Accept: text/html` → **302** redirect a `/finanzas`
- `GET /favicon.ico` → **204** No Content
- `GET /finanzas` → dashboard estático (Finanzas + Operaciones)

Cuando ngrok apunta a **5173**, Vite sirve la SPA:
- `GET /` → **200** con HTML de la Calculadora
- `GET /favicon.svg` → 200 (favicon en `public/`)

---

## Interpretación de tráfico (200 vs 404)

Si en un export de tráfico ngrok ves **GET /** alternando entre 200 y 404:

| Respuesta | Causa probable |
|-----------|----------------|
| **200** + `text/html` (~3KB) | ngrok apuntaba a **Vite (5173)** — SPA Calculadora |
| **404** + `application/json` | ngrok apuntaba a **Express (3001)** antes de la corrección de root/favicon; o el cliente no envió `Accept: text/html` |

**Corrección aplicada:** Express ahora responde `GET /` con 302 a `/finanzas` para clientes HTML, y `GET /favicon.ico` con 204. Con ngrok → 3001, ya no deberían verse 404 en `/` ni en `/favicon.ico` para peticiones de navegador normales.

---

## Comandos de arranque

```bash
# 1. Arrancar stack completo
npm run dev:full   # API 3001 + Vite 5173

# 2. Exponer con ngrok (elegir uno)
ngrok http 3001    # Recomendado: API + dashboard
ngrok http 5173    # Solo Calculadora
```

El inspector ngrok corre en `http://127.0.0.1:4040` cuando el agente está activo.

---

## Share Localhost (compartir el dashboard)

Para **configurar Share Localhost** y exponer el dashboard con una URL pública HTTPS (ngrok Agent CLI, auth token, opcional OAuth): ver **[SHARE-LOCALHOST-DASHBOARD.md](SHARE-LOCALHOST-DASHBOARD.md)**. Desde la raíz del repo también podés usar:

```bash
./scripts/run_share_dashboard.sh        # dashboard en :3849
./scripts/run_share_dashboard.sh 3001   # API + dashboard en :3001
```

---

## Referencias

- [SHARE-LOCALHOST-DASHBOARD.md](SHARE-LOCALHOST-DASHBOARD.md) — Configurar Share Localhost para el dashboard (quickstart ngrok)
- [IA.md](bmc-dashboard-modernization/IA.md) — Primary entry URL, favicon, root
- [DASHBOARD-VISUAL-MAP.md](bmc-dashboard-modernization/DASHBOARD-VISUAL-MAP.md) — Puertos y servicios (§2)
