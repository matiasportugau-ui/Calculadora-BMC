# LIVE-DEVTOOLS-NARRATIVE-REPORT — local seguir revisando (MCP)

Plantilla base: [`TEMPLATE-LIVE-DEVTOOLS-NARRATIVE-REPORT.md`](./TEMPLATE-LIVE-DEVTOOLS-NARRATIVE-REPORT.md). Skill: [`.cursor/skills/live-devtools-narrative-mcp/SKILL.md`](../../.cursor/skills/live-devtools-narrative-mcp/SKILL.md).

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-04 |
| Base URL | `http://localhost:5173/` |
| Entorno | local (Vite dev) |
| Navegador / MCP | `project-0-Calculadora-BMC-chrome-devtools` |
| Participantes | Matías + agente |

## 2. Objetivo de la sesión

- **Goal (una frase):** Abrir la calculadora en **local** para seguir revisando el flujo (asistente vendedor Solo techo).
- **Criterios de éxito del usuario:** Página local carga; poder inspeccionar pasos del wizard; validar UX reciente (p. ej. foco en Largo en paso 7).

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | 1 | Pedir **Live DevTools narrative** abriendo **local** | MCP navega a `localhost:5173` y deja evidencia de consola/red/snapshot |

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | Inicio | `navigate_page` | `http://localhost:5173/` cargada OK |
| E-02 | Tras carga | `wait_for` `["Panelin","Calculadora","BMC"]` | Texto encontrado; snapshot: **PASO 1 DE 13**, modo vendedor, visor visible |
| E-03 | Panel chat | `click` uid cerrar panel | **Timeout** (elemento no interactivo en 5s) |
| E-04 | Panel chat | `evaluate_script` | Clic programático en botón con `aria-label` / texto «Cerrar» → `{ ok: true, label: "Cerrar panel" }` |
| E-05 | Estado wizard | `take_snapshot` | **PASO 7 DE 13** — **Dimensiones (metros o paneles)**; bajo **LARGO (M)** hay `textbox` **`focusable focused`** `value="2"` (`uid=9_17`) — coherente con **autofocus en Largo zona 1** al entrar al paso |
| E-06 | Consola (buffer conservado) | `list_console_messages` (`error`/`warn`/`issue`, `includePreservedMessages: true`) | Sin `error` de React en la muestra local pura; en buffer mezclado: `warn` React Router v7 future flags (×2); `error` **404** recurso (ver E-08); `issue` campos form sin `id`/`name`; `warn` meta Apple PWA deprecada (sesión previa prod en buffer) |
| E-07 | Red (buffer conservado) | `list_network_requests` | Mezcla **prod + local** por `includePreservedRequests`; en tráfico **local**: `GET localhost:5173/`, `@vite/client`, módulos `200`/`304`, Shopify `200`, etc. |
| E-08 | Red local | `list_network_requests` página con reqs locales | **`POST http://localhost:5173/api/vitals` → `404`** (`reqid=1316`) — el front intenta vitals contra el origen Vite sin proxy hacia API `:3001` |

**Nota sobre mezcla prod/local:** E-06/E-07 usan mensajes/requests preservados de navegaciones anteriores (p. ej. prod). Los hallazgos **atribuibles solo a local** son: E-01, E-02, E-05, E-08 y los `msgid` 173–174 (React Router) en la sesión actual.

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-01, E-02, E-05, E-07 | sí (parcial) | Carga local OK; paso 7 observado con foco en Largo; **vitals 404** en local documentado |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable |
|----|-----------|--------|---------|----------------|
| LDN-2026-04-04-12 | P2 | Vitals `POST /api/vitals` 404 en Vite solo | En dev, si solo corre `vite` sin proxy de `/api` a Node `:3001`, el beacon de vitals devuelve 404. Usar `npm run dev:full` o proxy según `vite.config`. | `vite` proxy / `npm run dev:full` |
| LDN-2026-04-04-13 | P3 | Cerrar panel chat vía MCP `click` timeout | El botón «Cerrar panel» no quedó clicable para la automatización en el primer intento; `evaluate_script` funcionó. | a11y / capas / foco modal |

## 7. Recomendaciones y siguientes pasos

1. Para revisar **sin ruido 404**: arrancar **API + front** (`npm run dev:full`) o configurar proxy de `/api` en Vite.
2. Repetir snapshot en **paso 7** tras **Limpiar** + recorrer wizard desde cero si se necesita evidencia «fría» del solo autofocus.
3. Si el modal de Panelin molesta en QA automatizado, considerar no abrirlo por defecto en dev o atajo de cierre estable (`Escape` no cerró en esta sesión).

## 8. Verificación (checklist)

- [x] Reproducible en `http://localhost:5173/`
- [x] Consola: sin error P0 bloqueante en flujo observado; 404 vitals explicado
- [x] Red: 404 documentado (`/api/vitals` en origen 5173)
- [x] Criterio foco Largo paso 7: **sí** según snapshot (`focused` en textbox Largo)

## 9. Anexos (opcional)

- Evidencia focal: snapshot YAML fragment — `PASO 7 DE 13`, `Dimensiones`, `textbox focusable focused` junto a **LARGO (M)**.
