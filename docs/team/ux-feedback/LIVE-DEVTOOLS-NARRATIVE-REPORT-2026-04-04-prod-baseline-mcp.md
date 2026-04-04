# LIVE-DEVTOOLS-NARRATIVE-REPORT — prod baseline (MCP)

Skill: `.cursor/skills/live-devtools-narrative-mcp/SKILL.md`. Invocación: **Live DevTools narrative** / **Narrativa MCP DevTools**.

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-04 |
| Base URL | `https://calculadora-bmc.vercel.app/` |
| Entorno | **prod** (Vercel) |
| Navegador / MCP | `project-0-Calculadora-BMC-chrome-devtools` — `navigate_page`, `wait_for`, `list_console_messages`, `list_network_requests` |
| Participantes | Usuario (invocación skill) · agente (corrida MCP) |

## 2. Objetivo de la sesión

- **Goal (una frase):** Verificación **baseline** de la Calculadora BMC en producción tras cambios recientes (visor 3D, roof debug, PWA): carga inicial, **consola**, **red** y **árbol accesible** principal.
- **Criterios de éxito del usuario:** App usable en paso 1; sin errores críticos de consola; red sin fallos bloqueantes en el documento y bundles principales.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | Paso único | Invocar **Live DevTools narrative** sobre prod default. | Evidencia real de MCP (no solo inferencia); informe en repo + cruce expectativa/observado. |

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | t0 | `navigate_page` `type=url` → `https://calculadora-bmc.vercel.app/` | Navegación OK; pestaña seleccionada en la URL canónica. |
| E-02 | Tras carga | `wait_for` textos `["Calculadora","Panelin","BMC"]`, timeout 15000 ms | Coincidencia encontrada; **snapshot** accesible devuelto por la tool (root `Calculadora BMC`). |
| E-03 | Misma carga | `list_console_messages` `pageSize=50` | **2 mensajes:** 1× `warn` (meta PWA Apple deprecada), 1× `issue` (campo formulario sin `id`/`name`). **Sin `error`.** |
| E-04 | Misma carga | `list_network_requests` `pageSize=40` | **19 requests.** Documento + chunks JS/CSS + manifest + Shopify image + vídeo + GSI: en su mayoría **200** / **304**. **2×** `POST https://calculadora-bmc.vercel.app/api/vitals` → **`net::ERR_ABORTED`**. |
| E-05 | Incluido en E-02 | Snapshot a11y (resumen) | Nav **Módulos BMC** (Wolfboard, Calculadora, Logística); modo Vendedor; paso **1/13** Escenario; acordeón **VISOR VISUAL**; modal **Panelin Asistente** presente en el snapshot. |

### 4.1 Nota sobre snapshot

El snapshot mezcla el flujo principal del asistente con el **diálogo modal** “Panelin Asistente BMC” (starters, textbox). No se cerró el modal en esta corrida; el hallazgo **no** implica fallo, solo estado UI al momento del `wait_for`.

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-01–E-05 | **Parcial / sí** para carga y bundles | **P2:** vitals `ERR_ABORTED`; **P2/P3:** warn meta + issue a11y formulario (ver §6). |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable |
|----|-----------|--------|---------|----------------|
| LDN-2026-04-04-04 | P2 | `POST /api/vitals` abortado | Dos solicitudes a `https://calculadora-bmc.vercel.app/api/vitals` con **`net::ERR_ABORTED`** en la sesión MCP. Puede ser **navegación/unload**, **política de red**, o **beacon** cortado; conviene confirmar en DevTools humano si el beacon llega en **Payload/Network** estable. | `src/` (instrumentación vitals) · Vercel route `/api/vitals` |
| LDN-2026-04-04-05 | P3 | Meta `apple-mobile-web-app-capable` deprecada | Consola **warn**: usar también `mobile-web-app-capable` según mensaje del motor. | `index.html` / layout PWA |
| LDN-2026-04-04-06 | P2 | Campo sin `id`/`name` | Consola **issue**: un control de formulario sin `id` o `name` (conteo 1). Revisar formularios visibles en home (asistente / config). | Componentes con inputs en landing calculadora |

## 7. Recomendaciones y siguientes pasos

1. **Vitals:** reproducir en Chrome manual: pestaña Network → filtrar `vitals` → comprobar si el POST completa al quedarse en la página 10–20 s (sin navegar). Si siempre aborta, auditar el cliente que dispara el beacon (`fetch` + `keepalive`, `sendBeacon`, etc.).
2. **PWA meta:** añadir `<meta name="mobile-web-app-capable" content="yes">` junto al tag Apple existente para silenciar el warning y alinear recomendación actual.
3. **A11y:** localizar el input del issue (DevTools → Issues) y asignar `id`/`name` + `label` asociado.

## 8. Verificación (checklist)

- [x] Reproducible en URL indicada (MCP)
- [x] Consola: sin `error` en esta carga; warn/issue documentados
- [ ] Red: sin anomalías — **parcial** (`/api/vitals` abortado; documentado)
- [x] Criterios §2 cubiertos a nivel **carga inicial**; profundizar flujo techo 13 pasos en otra corrida si se requiere DoD visual 3D

## 9. Anexos (opcional)

- Snapshot textual: ver salida **E-02** en el hilo de tools (no pegado íntegro aquí por tamaño).
