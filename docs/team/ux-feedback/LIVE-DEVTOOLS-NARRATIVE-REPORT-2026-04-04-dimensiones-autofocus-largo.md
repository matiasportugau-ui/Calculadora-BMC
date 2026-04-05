# LIVE-DEVTOOLS-NARRATIVE-REPORT — dimensiones autofocus Largo (paso 7/13)

Basado en [`TEMPLATE-LIVE-DEVTOOLS-NARRATIVE-REPORT.md`](./TEMPLATE-LIVE-DEVTOOLS-NARRATIVE-REPORT.md). Skill: [`.cursor/skills/live-devtools-transcript-action-plan/SKILL.md`](../../.cursor/skills/live-devtools-transcript-action-plan/SKILL.md).

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-04 |
| Base URL | `https://calculadora-bmc.vercel.app` (MCP carga inicial); verificación del **autofocus** en build local / tras deploy |
| Entorno | prod (MCP baseline) + cambio en `src/` (pendiente de deploy para prod) |
| Navegador / MCP | `project-0-Calculadora-BMC-chrome-devtools` |
| Participantes | Matías (intención UX) + agente |

## 2. Objetivo de la sesión

- **Goal (una frase):** Al entrar al paso **Dimensiones** (7/13, Solo techo, modo vendedor), el cursor debe quedar en el **Largo (m)** de la **primera zona** para poder escribir el número sin hacer clic.
- **Criterios de éxito del usuario:** `activeWizardStepId === "dimensiones"` → foco + `select()` en el `<input>` del primer `StepperInput` Largo.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | 1 | Avanzar el asistente hasta el paso 7 (Dimensiones) | El campo **Largo (m)** de la zona principal recibe foco automáticamente |
| U-02 | 2 | Escribir medidas | Poder teclear de inmediato (sin clic previo en el input) |

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | Tras abrir sesión | `navigate_page` | `https://calculadora-bmc.vercel.app/` cargada OK |
| E-02 | Post-carga | `list_console_messages` (`error` / `warn` / `issue`) | 2 mensajes: `[warn]` meta `apple-mobile-web-app-capable` deprecado; `[issue]` form field sin `id`/`name` (count 1). Sin `error`. |
| E-03 | Post-carga | `list_network_requests` (primeros 17) | Documento y assets `200`/`304`; sin 4xx/5xx en el listado devuelto |

**Nota:** La evidencia MCP anterior corresponde a la **home** en prod; el comportamiento de **autofocus** se implementó en código (`PanelinCalculadoraV3_backup.jsx`) y debe validarse en **local** (`npm run dev`) o prod **después** del deploy, recorriendo Solo techo → paso Dimensiones.

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-01–E-03 | parcial | Baseline prod OK; foco en paso 7 no observable en este MCP sin automatizar el wizard completo |
| U-02 | — | pendiente verificación manual | Tras deploy/local: confirmar que el primer dígito reemplaza/selecciona el valor mostrado |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable (`src/` / `server/` / env / deploy) |
|----|-----------|--------|---------|-----------------------------------------------------|
| LDN-2026-04-04-11 | P2 | Autofocus Largo en paso Dimensiones | `StepperInput` acepta `inputRef`; `dimensionesLargoInputRef` + `useEffect` cuando `activeWizardStepId === "dimensiones"` hace `focus` + `select` en `requestAnimationFrame` + `setTimeout(0)`; ref solo en zona `idx === 0`. | `src/components/PanelinCalculadoraV3_backup.jsx` |

## 7. Recomendaciones y siguientes pasos

1. Verificar en local: modo vendedor → Solo techo → avanzar hasta **Dimensiones** → comprobar foco en **Largo (m)** zona 1.
2. Tras deploy: repetir smoke MCP o manual en prod.
3. Si el foco se pierde por re-render agresivo, considerar dependencias adicionales del `useEffect` (solo si hay bug reportado).

## 8. Verificación (checklist)

- [ ] Reproducible en URL indicada (post-deploy o local)
- [x] Consola prod (carga home): sin `error` en muestra MCP; warn/issue documentados
- [x] Red (carga home): sin 4xx/5xx en muestra MCP
- [ ] Criterios §2 cubiertos en entorno con el bundle nuevo

## 9. Anexos (opcional)

- Implementación: `StepperInput` prop `inputRef`; `dimensionesLargoInputRef`; efecto ligado a `activeWizardStepId` y `wizardStep`.
