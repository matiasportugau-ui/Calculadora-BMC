# LIVE-DEVTOOLS-NARRATIVE-REPORT — prod console / logística

Skill: `.cursor/skills/live-devtools-narrative-mcp/SKILL.md`. Invocación: **Live DevTools narrative** + URL prod.

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-03 |
| Base URL | `https://calculadora-bmc.vercel.app` |
| Entorno | prod |
| Navegador / MCP | chrome-devtools MCP (`project-0-Calculadora-BMC-chrome-devtools`) — `navigate_page`, `list_console_messages`, `list_network_requests`, `take_snapshot`, `click`, `get_console_message` |
| Participantes | Usuario (solicitud); agente |

## 2. Objetivo de la sesión

- **Goal (una frase):** Conectar DevTools a producción y detectar errores en consola y red.
- **Criterios de éxito del usuario:** Encontrar errores reales (no inferidos) con evidencia MCP.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | 1 | Invocar Live DevTools narrative sobre `https://calculadora-bmc.vercel.app/` | Ver errores en consola o fallos de red si existen |

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | Tras `navigate_page` → `/` | `list_console_messages` (todos los tipos) | Sin mensajes en consola en carga inicial |
| E-02 | Tras `/` | `list_network_requests` | 8 requests: documento + `gsi/client` + chunks JS **200** / **304**; imagen Shopify **200** |
| E-03 | Tras `click` Config (calculadora) | `list_console_messages` + `includePreservedMessages` | **1 issue:** “A form field element should have an id or name attribute (count: 3)” |
| E-04 | Tras `navigate_page` → `/hub` | consola + red | Sin mensajes consola; 4 requests **200**/**304** |
| E-05 | Tras `navigate_page` → `/logistica` | `list_console_messages` | **error:** `<svg> attribute height: Expected length, "auto".`; **issues:** sin label en campos (6); campos sin id/name (11) |
| E-06 | Detalle error SVG | `get_console_message` msgid 2 | Stack en bundle `index-CaPsw0ag.js` (React commit) |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-01–E-06 | parcial | En `/` y `/hub` no hubo errores JS; en `/logistica` sí error SVG + issues de formulario; Config modal suma issue de id/name |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable (`src/` / `server/` / env / deploy) |
|----|-----------|--------|---------|-----------------------------------------------------|
| LDN-2026-04-03-01 | P1 | SVG `height="auto"` inválido en Logística | Chrome registra **error** de parseo: el atributo `height` de `<svg>` no admite `"auto"` (sí es válido en CSS). Origen: [`BmcLogisticaApp.jsx`](../../../src/components/BmcLogisticaApp.jsx) (cuatro `<svg>` con atributo inválido `height="auto"`). **Corrección en repo:** eliminado ese atributo; se mantiene `style={{ …, height: "auto" }}`. | `src/components/BmcLogisticaApp.jsx` |
| LDN-2026-04-03-02 | P2 | Issues de accesibilidad / autofill (formularios) | DevTools **Issues:** inputs sin `id`/`name` y sin `<label>` asociado (modal Config en calculadora; pantalla Logística con más instancias). Mejora UX/a11y y autofill; no rompe ejecución. | `src/components/BmcLogisticaApp.jsx`, modal config en calculadora |

## 7. Recomendaciones y siguientes pasos

1. **Desplegar** el cambio de SVG a Vercel para que prod deje de emitir el error en `/logistica`.
2. **Formularios:** añadir `id`/`name` y `htmlFor`/`label` en inputs de Config y Logística para cerrar issues P2.
3. Si el usuario ve otro error en un flujo concreto (Presupuestos, Drive, API), repetir sesión con esa narrativa y mismas herramientas MCP.

## 8. Verificación (checklist)

- [x] Reproducible en URL indicada (`/logistica` antes del fix en código)
- [x] Causa técnica identificada (`height="auto"` en DOM SVG)
- [x] Red: sin 4xx/5xx en rutas probadas (`/`, `/hub`, `/logistica`)
- [ ] Consola prod limpia post-deploy del fix SVG

## 9. Anexos (opcional)

- JSON hermano: [`LIVE-DEVTOOLS-NARRATIVE-EVIDENCE-2026-04-03-prod-console-logistica.json`](./LIVE-DEVTOOLS-NARRATIVE-EVIDENCE-2026-04-03-prod-console-logistica.json)
