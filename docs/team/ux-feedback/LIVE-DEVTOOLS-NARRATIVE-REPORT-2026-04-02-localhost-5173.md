# LIVE-DEVTOOLS-NARRATIVE-REPORT — 2026-04-02 (localhost:5173)

Skill: `.cursor/skills/live-devtools-narrative-mcp/SKILL.md`. Invocación: **Live DevTools narrative** / **Narrativa en vivo DevTools** — URL acordada por contexto: entorno **local** de desarrollo.

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-02 |
| Base URL | `http://localhost:5173/` |
| Entorno | local (Vite) |
| Navegador / MCP | **chrome-devtools MCP:** `navigate_page` falló (perfil Chrome en uso — mismo hallazgo que sesión baseline). **cursor-ide-browser MCP:** navegación, snapshot, consola, red. |
| Participantes | Matias (invocación); agente (evidencia) |

## 2. Objetivo de la sesión

- **Goal (una frase):** Verificar carga y evidencia técnica de la Calculadora en **local** tras invocación de narrativa DevTools.
- **Criterios de éxito del usuario:** App responde en `localhost:5173`; módulos y shell principal visibles; sin fallos de red en carga inicial.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

_Sin transcripción adicional; invocación explícita con trabajo local en contexto._

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | t0 | Invocar narrativa DevTools con foco **local** | Vite sirve la app; shell calculadora + nav; módulos BMC accesibles |

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento | Tool / fuente | Hallazgo |
|----|---------|----------------|----------|
| E-01 | t0 | `project-0-Calculadora-BMC-chrome-devtools` → `navigate_page` | Error de perfil ya en uso (`chrome-devtools-mcp/chrome-profile`); no se usó DevTools canónico en esta corrida. |
| E-02 | t1 | `cursor-ide-browser` → `browser_navigate` → `http://localhost:5173/` | **200**, título **Calculadora BMC**; enlaces Wolfboard / Calculadora / Logística. |
| E-03 | t2 | `browser_snapshot` (compact) | Botones **Vendedor**, **Cliente**, **Config**, **Drive**, **Presupuestos 100**, **Limpiar**, **Imprimir**, **Siguiente**; nav **Módulos BMC**. |
| E-04 | t2 | `browser_console_messages` | `[vite] connecting` / `connected`; aviso React DevTools; **error** (nivel consola) por **React Router future flags** (`v7_startTransition`, `v7_relativeSplatPath`). Aviso histórico en buffer: `THREE.WebGLRenderer: Context Lost` asociado a sesión previa en **Vercel** (misma pestaña/browser log). |
| E-05 | t2 | `browser_network_requests` | Módulos **200** desde Vite: p. ej. `PanelinCalculadoraV3_backup.jsx`, `roofEncounterModel.js`, `roofSlopeMark.js`, `RoofPreview.jsx`, deps `three` / R3F / `lucide-react`. |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-02, E-03, E-05 | **Sí** | **E-01:** desbloquear chrome-devtools MCP si se requiere esa herramienta exacta. **E-04:** flags futuros de React Router — backlog opcional; WebGL context lost si aparece en local reproducible → revisar pestañas/canvas 3D. |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable |
|----|-----------|--------|---------|----------------|
| LDN-2026-04-02-08 | P2 | chrome-devtools MCP bloqueado (perfil) | Misma causa que informe baseline; usar otro `userDataDir` o cerrar instancia. | MCP / entorno |
| LDN-2026-04-02-09 | P3 | React Router v7 future flag warnings | Mensajes en consola (development); opt-in con flags documentados en reactrouter.com. | `react-router-dom` / router setup |
| LDN-2026-04-02-10 | P3 | WebGL context lost (buffer) | Registro ligado a URL Vercel en el mismo view; vigilar si se reproduce en local con techo 3D. | R3F / Three / GPU |

## 7. Recomendaciones y siguientes pasos

1. Para sesiones **local**: fijar en el chat **Base URL = `http://localhost:5173/`** (o ruta) al invocar la narrativa.
2. Si necesitás **chrome-devtools** estricto: resolver conflicto de perfil (ver **LDN-2026-04-02-08**).
3. Para cruce fino **U-xx ↔ E-xx**: pegar **ACTION / EXPECT** o pasos numerados mientras recorrés el wizard (techo, encuentros, etc.).

## 8. Verificación (checklist)

- [x] Reproducible en URL local indicada (esta sesión)
- [x] Red: módulos Vite **200** en la lista capturada
- [ ] Consola “limpia” P0: pendiente evaluar si los *warnings* de Router se consideran aceptables en dev
- [ ] Flujos funcionales específicos (usuario) — sin narrativa en este hilo

## 9. Anexos

- Informes hermanos: [`LIVE-DEVTOOLS-NARRATIVE-REPORT-2026-04-02-invocation-baseline.md`](./LIVE-DEVTOOLS-NARRATIVE-REPORT-2026-04-02-invocation-baseline.md), [`LIVE-DEVTOOLS-NARRATIVE-REPORT-2026-04-02-sesion-chat.md`](./LIVE-DEVTOOLS-NARRATIVE-REPORT-2026-04-02-sesion-chat.md).
