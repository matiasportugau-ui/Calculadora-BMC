# LIVE-DEVTOOLS-NARRATIVE-REPORT — local stack + baseline MCP

Skill: `.cursor/skills/live-devtools-narrative-mcp/SKILL.md` + `.cursor/skills/live-devtools-transcript-action-plan/SKILL.md`. Invocación: arranque local para probar como prod + narrativa DevTools.

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-05 |
| Base URL | `http://localhost:5173/` (paridad con [Calculadora BMC en producción](https://calculadora-bmc.vercel.app/)) |
| Entorno | local |
| Navegador / MCP | `project-0-Calculadora-BMC-chrome-devtools` (`navigate_page`, `list_console_messages`, `list_network_requests`, `take_snapshot`) |
| Participantes | Matías (solicitud); agente Cursor |

## 2. Objetivo de la sesión

- **Goal (una frase):** Levantar API + Vite en local y capturar una línea base de consola/red/UI con MCP para seguir probando alineado a producción.
- **Criterios de éxito del usuario:** `GET /health` en `:3001` y carga de la app en `:5173`; sin errores de consola bloqueantes en la primera pantalla.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | 1 | Pedir correr todos los servidores y probar local como [calculadora-bmc.vercel.app](https://calculadora-bmc.vercel.app/) | API y frontend locales respondiendo |
| U-02 | 2 | Invocar Live DevTools narrative + plan transcripción/DevTools | Evidencia MCP (consola, red, snapshot) sin inventar datos |

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | Tras `npm run dev:full` | Shell `curl` | `http://localhost:3001/health` → **200**; `http://localhost:5173/` → **200** |
| E-02 | Post-navegación | `list_console_messages` (tipos `error`, `warn`, `issue`) | **2** avisos **warn** de React Router v7 future flags (`v7_startTransition`, `v7_relativeSplatPath`); **0** errores |
| E-03 | Post-navegación | `list_network_requests` | **90** solicitudes; todas **200** o **206** (vídeo); **1** `blob:…` **pending**; externos: `cdn.shopify.com` imágenes **200**, `accounts.google.com/gsi/client` **200** |
| E-04 | Post-navegación | `take_snapshot` | Título **Calculadora BMC**; nav BMC (Wolfboard, Calculadora, Logística); wizard paso **1/13** Escenario; visor **ISOROOF PLUS 3G**; diálogo modal **Panelin Asistente BMC** visible en árbol a11y |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-01 | sí | Stack: `npm run dev:full` (API `start:api` + Vite `dev` con `predev` disk check) |
| U-02 | E-02, E-03, E-04 | sí | Sin transcript adicional del usuario; beats derivados del pedido únicamente |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable (`src/` / `server/` / env / deploy) |
|----|-----------|--------|---------|-----------------------------------------------------|
| LDN-2026-04-05-01 | P2 | React Router future flags | Dos warnings de migración v7 en consola al cargar | `src/` (router / `App.jsx`) |
| LDN-2026-04-05-02 | P2 | Blob request pending | `GET blob:…` figura como **pending** en el listado de red tras carga | posible uso de object URL (revisar si es transitorio al reproducir vídeo) |
| LDN-2026-04-05-03 | P3 | Panelin modal en snapshot inicial | El asistente aparece como **dialog** modal en el snapshot; verificar si es intencional al cargar home | `PanelinChatPanel.jsx` / estado apertura panel |

## 7. Recomendaciones y siguientes pasos

1. **Probar flujos:** recorrer wizard (dimensiones, estructura) y repetir MCP tras cada paso; si el usuario pega transcripción con **ACTION / EXPECT**, generar cruce fino y tickets.
2. **Opcional v7:** opt-in a flags `v7_startTransition` y `v7_relativeSplatPath` en la config de React Router cuando se planee upgrade.
3. **Contratos API:** con stack local, `npm run test:contracts` (requiere API en 3001) para alinear con Cloud Run en pruebas de integración.

## 8. Verificación (checklist)

- [x] Reproducible en URL indicada (`http://localhost:5173/`)
- [x] Consola: sin errores P0 en carga inicial; warnings P2 documentados
- [x] Red: sin 4xx/5xx en el documento y assets principales del flujo inicial
- [x] Criterios §2 cubiertos para arranque; pruebas funcionales pendientes de narrativa del usuario

## 9. Anexos (opcional)

- Comando usado: `npm run dev:full` desde la raíz del repo (ver `package.json`: `concurrently` → `start:api` + `dev`).
- Para parar: interrumpir el proceso en la terminal donde corre `dev:full` (PID registrado en sesión del agente).
