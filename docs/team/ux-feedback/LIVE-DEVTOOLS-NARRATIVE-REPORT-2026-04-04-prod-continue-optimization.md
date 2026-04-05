# LIVE-DEVTOOLS-NARRATIVE-REPORT — continuación prod (optimización + MCP)

Skill: `.cursor/skills/live-devtools-narrative-mcp/SKILL.md`. Invocación: **Live DevTools narrative** / **Narrativa en vivo DevTools**.

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-04 |
| Base URL | `https://calculadora-bmc.vercel.app` |
| Entorno | prod |
| Navegador / MCP | `project-0-Calculadora-BMC-chrome-devtools` (Chrome ~146) |
| Participantes | Matías (objetivo sesión), agente (evidencia MCP) |

## 2. Objetivo de la sesión

- **Goal (una frase):** Continuar prueba en vivo y optimización de [Calculadora BMC](https://calculadora-bmc.vercel.app) con evidencia DevTools (consola + red + snapshot).
- **Criterios de éxito del usuario:** Detectar fallos reales en carga y primer paso del asistente; priorizar arreglos accionables (performance / ruido consola / a11y).

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | 1 | Abrir home prod | Carga sin errores de red ni errores de consola bloqueantes |
| U-02 | 2 | Avanzar wizard paso 1 → 2 (“Siguiente”) | UI paso 2; sin nuevos fallos de red |

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | Tras `navigate_page` → `/` | `list_console_messages` (error/warn/issue) | 1× `[issue]` form field sin `id` o `name` |
| E-02 | Tras carga inicial | `list_network_requests` | 17 req; todos 200/304; `GET accounts.google.com/gsi/client` 200 |
| E-03 | Tras carga inicial | `take_snapshot` | Shell calculadora OK; paso 1/13; modal **Panelin Asistente BMC** abierto; `textbox "Mensaje para Panelin"` |
| E-04 | Tras click `Siguiente` (paso 2) | `list_console_messages` (preserved) | `[warn]` meta Apple PWA deprecada; mismo `[issue]` form; **`[error]` Failed to load resource 405** |
| E-05 | Tras paso 2 | `list_network_requests` (preserved) | Nuevo **`POST /api/vitals` → 405**; imágenes panel/techo 200/304 |
| E-06 | Detalle | `get_network_request` reqid 22 | **POST** `https://calculadora-bmc.vercel.app/api/vitals`, body JSON LCP (`rating: poor`), respuesta vacía, `content-disposition: index.html` (no había función serverless) |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-01–E-03 | parcial | Sin `error` JS en primer filtro; sí **issue** a11y chat |
| U-02 | E-04–E-06 | no (antes del fix) | **POST /api/vitals 405** rompe expectativa de consola “limpia”; correlación directa con `sendBeacon` en `App.jsx` |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable |
|----|-----------|--------|---------|----------------|
| LDN-2026-04-04-07 | P1 | `POST /api/vitals` 405 en prod | `navigator.sendBeacon("/api/vitals", …)` desde `web-vitals` en `App.jsx`; en Vercel no existía `api/vitals.js`, el POST caía en SPA/static → **405** y error en consola | `api/vitals.js` (nuevo), deploy Vercel |
| LDN-2026-04-04-08 | P2 | Issue: campo de formulario sin id/name | DevTools: form field debe tener `id` o `name` — textarea del chat Panelin | `src/components/PanelinChatPanel.jsx` |
| LDN-2026-04-04-09 | P3 | Meta PWA Apple deprecada | Consola: usar también `mobile-web-app-capable` | `index.html` |
| LDN-2026-04-04-10 | P3 | LCP “poor” (métrica) | Beacon enviaba LCP ~11436 ms en la corrida MCP; seguimiento aparte (assets/video, TTFB, bundle) | performance / contenido |

## 7. Recomendaciones y siguientes pasos

1. **Desplegar** `api/vitals.js` (POST/OPTIONS → 204) para silenciar 405 y permitir evolución futura (logging/analytics) sin romper el cliente.
2. **Re-ejecutar MCP** tras deploy: confirmar ausencia de `405` en `/api/vitals` y de `error` de consola asociado.
3. **Performance:** si LCP sigue “poor”, perfilar con trace MCP o Lighthouse en ruta crítica (hero video, chunks `vendor-three`, imágenes Shopify).
4. **Flujo wizard:** repetir pasos 3–13 con la misma plantilla LDN para capturar regresiones de red en escenarios techo/fachada.

## 8. Verificación (checklist)

- [x] Reproducible en URL indicada (pre-fix)
- [x] Consola sin errores P0 **tras deploy** de `api/vitals.js` (MCP `list_console_messages` tras `reload` forzado: sin `error` / `warn` / `issue`)
- [x] **POST `/api/vitals`:** `curl -X POST` con body JSON → **HTTP 204** en `https://calculadora-bmc.vercel.app`
- [x] Criterios §2 cubiertos en hallazgos + cambios en repo (esta sesión)

### Post-deploy (misma skill, ejecución agente)

- Deploy: `npx vercel deploy --prod --yes` (proyecto enlazado `calculadora-bmc`).
- **Nota MCP:** en red, `sendBeacon` + `no-cors` puede listarse como `net::ERR_ABORTED` aunque el servidor acepte el POST; la señal fuerte es **consola sin “405”** + **curl 204**.


## 9. Cambios en repo (esta sesión)

- Nuevo [`api/vitals.js`](../../../api/vitals.js): acepta POST beacon, responde 204.
- [`PanelinChatPanel.jsx`](../../../src/components/PanelinChatPanel.jsx): `id` + `name` en textarea del chat.
- [`index.html`](../../../index.html): meta `mobile-web-app-capable`.

## 10. Anexos (opcional)

- JSON evidencia: no generado (poca densidad de ítems; tabla anterior suficiente).
