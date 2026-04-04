# LIVE-DEVTOOLS-NARRATIVE-REPORT — Panelin Developer Training Mode

Plantilla base: `TEMPLATE-LIVE-DEVTOOLS-NARRATIVE-REPORT.md`. Skill: Live DevTools narrative. Plan evaluado: `~/.cursor/plans/panelin_developer_training_mode_56131a10.plan.md`.

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-03 |
| Base URL | `https://calculadora-bmc.vercel.app/?chat=1` |
| Entorno | prod |
| Navegador / MCP | chrome-devtools MCP (`navigate_page`, `wait_for`, `take_snapshot`, `list_console_messages`, `list_network_requests`, `handle_dialog`, `evaluate_script`) |
| Participantes | Agente (evaluación plan + prueba UI); sin narrativa de usuario en vivo |

## 2. Objetivo de la sesión

- **Goal (una frase):** Contrastar el plan “Panelin Developer Training Mode” con el código desplegado y comprobar en producción el comportamiento del Developer Mode (UI, gating, panel de entrenamiento).
- **Criterios de éxito del usuario:** Todos los ítems del plan marcados `completed` verificables en repo; smoke visual en prod de modo dev y ausencia de errores de consola obvios en el flujo chat.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | Paso 1 | Abrir prod con `?chat=1` y esperar carga del drawer Panelin | Chat visible, sin errores JS |
| U-02 | Paso 2 | Limpiar `sessionStorage` `panelin-dev-mode` / `panelin-dev-token` y recargar | UI “usuario final”: sin sufijo “Developer Mode” ni pestañas Train/KB/Prompt |
| U-03 | Paso 3 | Observar UI con dev activo (sesión previa MCP antes del clear) | Panel `PanelinDevPanel`: Train / KB / Prompt, Verify calc, Save correction |

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | Tras `navigate_page` + `wait_for` | `take_snapshot` / salida de `wait_for` | Chat abierto: “Asistente BMC Uruguay”, botones DEV (toolbar y header chat), historial de mensajes; con dev persistido: “ · Developer Mode”, pestañas **Train**, **KB**, **Prompt**, “KB match: 0”, “Calc check: n/a”, **Verify calc**, campos de corrección |
| E-02 | Tras reload con storage limpio | `wait_for` + snapshot `uid=4_*` | Título chat solo “Asistente BMC Uruguay” (sin Developer Mode); **no** aparecen Train/KB/Prompt; botón **DEV** sigue visible (`description` Developer mode / Ctrl/Cmd+Shift+D) |
| E-03 | Intento de click en DEV | `click` uid chat | Timeout (elemento no interactivo a tiempo); `take_snapshot` dejó diálogo nativo `prompt` para token — cerrado con `handle_dialog` **dismiss** |
| E-04 | Post-navegación | `list_console_messages` (`error`/`warn`, preserved) | Sin mensajes |
| E-05 | Post-navegación | `list_network_requests` (fetch) | Lista vacía en la salida devuelta por la tool (sin asumir ausencia real de tráfico) |
| E-06 | Repo | `rg` / lectura de archivos | Implementación presente: `PanelinDevPanel.jsx`, `server/routes/agentTraining.js`, `server/lib/trainingKB.js`, `useChat.js` (`devMode`), `agentChat.js` (KB + SSE), `App.jsx` lazy `PanelinCalculadoraV3_backup.jsx` |
| E-07 | CLI | `npm run training:report` | Exit 0: “No training sessions found yet.” (esperable sin `data/training-sessions/*.jsonl`) |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-01, E-04 | sí | Red no corroborada en salida MCP (E-05) |
| U-02 | E-02 | sí | Botón DEV visible para cualquier visitante (ver LDN-2026-04-03-03) |
| U-03 | E-01 | parcial | Sin token válido no se validaron llamadas `/api/agent/*` desde el panel en esta sesión |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable (`src/` / `server/` / env / deploy) |
|----|-----------|--------|---------|-----------------------------------------------------|
| LDN-2026-04-03-01 | P2 | Plan vs código: alcance “tres superficies IA” | El diagrama del plan enlaza training a CRM `suggest-response` y motor ML; en código la KB y `devMode` están acotados al **chat** (`agentChat.js` + `chatPrompts.js`). No se encontró inyección de training en rutas CRM/ML en el barrido de `server/`. | `server/` |
| LDN-2026-04-03-02 | P2 | Funcionalidades planificadas no vistas en UI | Sin botones explícitos **good / needs correction** por mensaje; sin selector de **perfil de cliente / escenario** de ventas del plan. El flujo de corrección es textarea + **Save correction**. | `src/components/PanelinDevPanel.jsx` |
| LDN-2026-04-03-03 | P2 | “Invisible para usuarios finales” vs botón DEV público | Con `sessionStorage` limpio, el panel dev **no** se muestra (correcto), pero el botón **DEV** permanece visible en toolbar y en el chat (cualquiera ve la affordance). El plan pedía modo oculto. | `src/components/PanelinCalculadoraV3_backup.jsx`, `PanelinChatPanel.jsx` |
| LDN-2026-04-03-04 | P3 | KB en panel | Pestaña KB lista entradas (slice 8); el plan mencionaba edición/eliminación/promoción permanente vs contextual — no verificado en UI en esta revisión. | `src/components/PanelinDevPanel.jsx`, `server/lib/trainingKB.js` |

## 7. Recomendaciones y siguientes pasos

1. **E2E con token real:** Con `API_AUTH_TOKEN` válido en Cloud Run, activar dev mode, enviar un mensaje y confirmar `POST /api/agent/chat` con `devMode: true`, eventos SSE (`kb_match`, etc.) y `GET /api/agent/training-kb` **200** (no ejecutado aquí por secreto).
2. **Alinear producto con el plan o con el doc:** Decidir si CRM/ML deben consumir la misma KB; si no, actualizar el diagrama del plan para evitar expectativa incorrecta.
3. **Descubribilidad vs stealth:** Si se requiere ocultación total, retirar o degradar el botón DEV para usuarios sin token (p. ej. solo shortcut sin UI, o flag build interno).

## 8. Verificación (checklist)

- [x] Reproducible en URL indicada
- [x] Consola limpia de errores P0 / o documentado (sin error/warn en el muestreo MCP)
- [ ] Red: sin 4xx/5xx inesperados en flujo principal (no verificado por salida vacía de `list_network_requests`)
- [x] Criterios de éxito del usuario (§2) cubiertos en alcance de revisión estática + UI sin dev storage

## 9. Anexos (opcional)

- Plan fuente: `panelin_developer_training_mode_56131a10.plan.md` (todos los todos en frontmatter `status: completed`).
- Archivos clave de implementación: `server/routes/agentTraining.js`, `server/lib/trainingKB.js`, `server/routes/agentChat.js`, `src/hooks/useChat.js`, `src/components/PanelinChatPanel.jsx`, `src/components/PanelinDevPanel.jsx`, `src/components/PanelinCalculadoraV3_backup.jsx`, `npm run training:report` → `scripts/training-report.mjs`.
