# LIVE-DEVTOOLS-NARRATIVE-REPORT — localhost smoke

Skill: `.cursor/skills/live-devtools-narrative-mcp/SKILL.md`. Invocación: **Live DevTools narrative**.

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-05 |
| Base URL | `http://localhost:5173/` |
| Entorno | local |
| Navegador / MCP | Chrome controlado por **chrome-devtools** MCP (proyecto Cursor) |
| Participantes | Matías (intención vía chat); agente (MCP + terminal) |

**Stack local:** `npm run dev:full` en el repo (API `http://127.0.0.1:3001`, Vite `http://127.0.0.1:5173`). Verificación previa: `GET /` → 200 y `GET /health` → 200.

## 2. Objetivo de la sesión

- **Goal (una frase):** Probar la Calculadora BMC en **localhost** con evidencia de consola y red vía MCP.
- **Criterios de éxito del usuario:** La app carga en local, el flujo principal es navegable y no hay fallos de red críticos en la primera interacción.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | Paso 1 | Ejecutar prueba en **localhost** en lugar de producción | Vite responde y la shell de la calculadora aparece |
| U-02 | Paso 2 | Verificar carga inicial | Sin errores de consola bloqueantes; assets locales 200 |
| U-03 | Paso 3 | Avanzar el asistente / wizard | Paso 2 del flujo visible tras “Siguiente” |
| U-04 | Paso 4 | Abrir otra ruta del mismo origen | `/hub` (Wolfboard) renderiza |

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | Tras arranque | Terminal + `curl` | `5173` y `3001/health` en **200** |
| E-02 | Post-navegación | `navigate_page` → `http://localhost:5173/` | Título **Calculadora BMC**; paso **1 de 13** “Escenario de obra”; nav BMC (Wolfboard / Calculadora / Logística) |
| E-03 | Misma vista | `take_snapshot` | Visor visual, tablas de presupuesto, totales USD; diálogo modal **Panelin Asistente BMC** presente en el árbol a11y |
| E-04 | Carga inicial | `list_console_messages` (`error`,`warn`) | **2× warn** React Router v7 future flags (`v7_startTransition`, `v7_relativeSplatPath`) |
| E-05 | Cierre panel | `click` uid botón “Cerrar panel” | **Timeout** (“element did not become interactive”) |
| E-06 | Cierre panel | `evaluate_script` | Clic en `button[aria-label*="Cerrar"]` **dentro** de `[role="dialog"]` → `"clicked-dialog-close"` |
| E-07 | Wizard | `click` → “Siguiente” | Paso pasa a **2 de 13** — **“Caída del techo”**; botones “1 Agua…”, “2 Aguas…”; “Siguiente” **deshabilitado** hasta elegir opción |
| E-08 | Tras paso wizard | `list_console_messages` (preservados) | Nuevo **error** consola: recurso **404** (sin URL en el mensaje del tool) |
| E-09 | Red acumulada | `list_network_requests` (`includePreservedRequests: true`) | **86→94** solicitudes; **POST `http://localhost:5173/api/vitals` → 404**; **blob:** URL en **pending**; resto document/scripts/imágenes Shopify y locales mayormente **200** |
| E-10 | Ruta hub | `navigate_page` → `/hub` + `take_snapshot` | **Wolfboard** con enlaces a Calculadora, Logística, Panelin (`?chat=1`) |
| E-11 | Hub | `list_console_messages` | Mismos **2 warnings** React Router; sin `error` en esta navegación limpia |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-01, E-02 | sí | Stack levantado explícitamente porque los puertos estaban caídos al inicio |
| U-02 | E-04, E-09 | parcial | No hay error P0 en consola inicial; aparece **404** en `/api/vitals` al usar la app (E-08–E-09) |
| U-03 | E-07 | sí | Wizard avanza correctamente; “Siguiente” deshabilitado es coherente con UX de selección obligatoria |
| U-04 | E-10, E-11 | sí | Hub OK; warnings de router persisten |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable (`src/` / `server/` / env / deploy) |
|----|-----------|--------|---------|-----------------------------------------------------|
| LDN-2026-04-05-01 | P2 | `POST /api/vitals` devuelve 404 en dev | El cliente postea métricas a **`http://localhost:5173/api/vitals`**; Vite no expone esa ruta → consola “Failed to load resource… 404” | `src/` (instrumentación web-vitals) + proxy Vite o desactivar en dev |
| LDN-2026-04-05-02 | P2 | Avisos React Router v7 | Dos warnings de **future flags** en cada carga | `src/` + config del router |
| LDN-2026-04-05-03 | P3 | Panelin “Cerrar” y automatización MCP | `click` por **uid** falló por timeout; cierre funcionó vía script acotado al `dialog` | Accesibilidad / capas z-index / foco, o timing del MCP |
| LDN-2026-04-05-04 | P3 | Request `blob:` en pending | Una petición **blob:** quedó **pending** en el listado de red | Revisar uso de object URLs / cleanup |

## 7. Recomendaciones y siguientes pasos

1. **Vitals en local:** proxy en `vite.config` de `/api/vitals` → `http://localhost:3001`, **o** silenciar el envío en `import.meta.env.DEV`, **o** implementar handler en el servidor de desarrollo — para eliminar el 404 ruidoso.
2. **React Router:** adoptar future flags (`v7_startTransition`, `v7_relativeSplatPath`) según la guía de migración v6→v7 y quitar warnings.
3. **Siguiente sesión MCP:** si hace falta cerrar Panelin con `click`, probar **foco** previo o `wait_for` de texto estable; documentar si el modal debe quedar abierto por defecto en dev.

## 8. Verificación (checklist)

- [x] Reproducible en URL indicada (`http://localhost:5173/`, `/hub`)
- [ ] Consola limpia de errores P0 / o documentado — **404 vitals documentado (P2)**
- [ ] Red: sin 4xx/5xx inesperados en flujo principal — **404 en `/api/vitals`**
- [x] Criterios de éxito del usuario (§2) cubiertos o ticket abierto — carga y wizard OK; vitals pendiente de decisión técnica

## 9. Anexos (opcional)

- JSON hermano: no generado (sesión corta; se puede añadir `LIVE-DEVTOOLS-NARRATIVE-EVIDENCE-2026-04-05-localhost-smoke.json` si se requiere trazabilidad máquina-legible).
