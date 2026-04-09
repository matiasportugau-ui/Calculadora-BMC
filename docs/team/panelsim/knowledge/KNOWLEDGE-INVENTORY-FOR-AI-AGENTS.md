# Inventario de conocimiento para agentes IA (BMC / Panelin)

**Propósito:** mapa auditable de **dónde vive** el “cerebro” que alimenta GPT Custom, Panelin chat embebido, PANELSIM y flujos ML — y **cómo se alinea** con buenas prácticas (política, grounding, KB, evaluación, versionado).

**Audiencia:** equipo técnico, integraciones, quien mantenga prompts y KB.

**No sustituye:** el índice operativo [`PANELSIM-FULL-PROJECT-KB.md`](./PANELSIM-FULL-PROJECT-KB.md) (se complementa con rutas concretas y matriz de alineación).

**Última actualización:** 2026-04-04

---

## 1. Tabla maestra — Calculadora-BMC (este repo)

| Ruta / artefacto | Tipo | Consumidor típico | ¿Canónico? | Riesgo drift | Notas |
|------------------|------|-------------------|------------|--------------|--------|
| `server/lib/chatPrompts.js` (`IDENTITY`, `CATALOG`, `WORKFLOW`, `ACTIONS_DOC`) | System prompt | Panelin chat (`/api/agent/chat`) | Sí (texto agente calculadora) | Alto si no se sync con números | Dev mode puede reescribir secciones vía API |
| `server/routes/agentChat.js` + `buildSystemPrompt()` | Runtime | Panelin chat | — | Medio | Inyecta estado calculadora + ejemplos KB |
| `data/training-kb.json` | KB few-shot | Panelin chat (dev / token) | Sí (local) | Alto (no en git) | Gitignored; backup/export manual recomendado |
| `server/lib/trainingKB.js` | Persistencia KB | Train tab, `POST /api/agent/train` | — | Bajo | `permanent` prioriza matches |
| `docs/openapi-calc.yaml` | Contrato HTTP | Custom GPT Actions, clientes | Sí (API calc) | Alto | Alinear con `gptActions.js` / rutas reales |
| `docs/openapi-email-gpt.yaml` | Contrato HTTP | GPT solo correo | Sí (email GPT) | Medio | Acotado a mail |
| `docs/GPT-ENTRY-POINT-SCHEMA.md` | Esquema / doc | GPT / integradores | Espejo | Medio | Verificar vs despliegue |
| `server/gptActions.js` + `GET /capabilities` | Manifest acciones | GPT, MCP | Sí | Alto | Tras cambios de rutas |
| `src/data/constants.js` | Datos numéricos / escenarios | Motor UI, prompt CATALOG | **Sí (números)** | Bajo si CATALOG deriva de aquí | Fuente de precios y familias |
| `docs/team/knowledge/MATRIZ-CALCULADORA.md` | Doc proceso MATRIZ | Humanos, Calc specialist | Sí (proceso) | Medio | Puente planilla → código |
| `docs/team/knowledge/CALCULATOR-ENGINE-MATH-SPEC.md` | Especificación motor | Calc, auditoría | Sí | Bajo | Fórmulas y variables |
| `docs/team/panelsim/knowledge/PANELSIM-DIALOGUE-AND-CRITERIA.md` | Diálogo / guardrails | PANELSIM, GPT (espejo) | Sí (comercial) | Alto si duplicado sin sync | “Destilado GPT → repo” |
| `docs/team/panelsim/knowledge/ML-RESPUESTAS-KB-BMC.md` | KB Mercado Libre | ML, simulaciones | Sí (canal ML) | Medio | No es el mismo archivo que training-kb chat |
| `docs/team/panelsim/knowledge/ML-TRAINING-SYSTEM.md` | Proceso corpus / tandas | ML ops | Sí | Bajo | `ml:corpus-export`, auditorías |
| `docs/team/biblioteca-tecnica-productos/` | Material técnico-comercial | RAG humano, GPT Knowledge | Espejo / assets | Medio | Precios: validar vs MATRIZ/código |
| `docs/team/knowledge/GPTCloud.md` | Rol GPT/Cloud | Equipo | Sí | Bajo | Disciplina sync GPT ↔ Cloud |
| `docs/team/DEV-TRAINING-MODE-SCOPE.md` | Alcance training | Devs | Sí | Bajo | **Training KB = solo chat hoy** |
| `.cursor/skills/**/SKILL.md` (GPT, calc, sheets, email, deploy…) | Procedimientos agente Cursor | Cursor | Sí (proceso) | Bajo | No inyectados al Panelin prod |
| `docs/team/knowledge/knowledge-db.json` | Snapshot Antenna | Equipo / reporting | No (operativo interno) | Bajo | Evaluar si fragmentos pasan a KB producto |
| `docs/team/knowledge/references-catalog.json`, `impact-map.json` | Telemetría conocimiento | Equipo | No | Bajo | No son prompt del cliente |

### Archivos adicionales en `docs/team/panelsim/knowledge/`

| Archivo | Rol |
|---------|-----|
| `PANELSIM-FULL-PROJECT-KB.md` | Índice global proyecto / SIM |
| `SIM.md` / `SIM-REV.md` | Atajos a canónico y revisor |
| `ML-RESPUESTAS-KB-BMC.md` | Voz y reglas ML |
| `ML-TRAINING-SYSTEM.md` | Corpus y simulación |

---

## 2. Repos y ubicaciones fuera de este árbol (hermanos)

| Ámbito | Identificador típico | Qué inventariar en un segundo pase |
|--------|----------------------|-------------------------------------|
| Custom GPT (ChatGPT) | Cuenta OpenAI / Builder | Instrucciones completas; archivos Knowledge; URL del esquema OpenAPI; lista de Actions |
| Correo / bandeja | Repo `conexion-cuentas-email-agentes-bmc`; `BMC_EMAIL_INBOX_REPO` | Docs PANELSIM correo, prompts clasificación, `PANELSIM-ULTIMO-REPORTE` |
| Dashboard 2.0 / legacy | `bmc-dashboard-2.0` (según Repo Sync) | Solo textos y reglas que deban reflejarse en respuestas de agente o CRM |

Completar filas con **path local real** cuando el repo esté clonado en la máquina del inventario.

---

## 3. Duplicados y conflictos a vigilar

| Tema | Lugares | Riesgo |
|------|---------|--------|
| Precios USD/m² y familias | `chatPrompts.js` CATALOG vs `constants.js` | Respuesta numérica incorrecta |
| Acciones / tools | OpenAPI vs `ACTIONS_DOC` vs `VALID_ACTION_TYPES` | Acción rechazada o UI rota |
| Tono y flujo cotización | GPT Builder vs `PANELSIM-DIALOGUE-AND-CRITERIA.md` vs `IDENTITY`/`WORKFLOW` | Experiencia inconsistente |
| FAQ comercial | GPT Knowledge vs `training-kb.json` vs ML KB | Tres “verdades” distintas |
| Training “global” | Expectativa CRM/ML vs realidad | [`DEV-TRAINING-MODE-SCOPE.md`](../../DEV-TRAINING-MODE-SCOPE.md): KB entrenamiento **solo** alimenta chat |

---

## 4. Huecos conocidos (prioridad sugerida)

| Gap | Impacto | Próximo paso |
|-----|-----------|--------------|
| Conjunto **golden** de diálogos cotización (evaluación/regresión) | Alto | Definir 10–20 casos en MD o hoja; correr tras cambios de `chatPrompts` / KB |
| Backup versionado de `training-kb.json` | Medio | Export periódico a almacenamiento privado o rama interna |
| Single source para CATALOG textual | Medio | Script opcional desde `constants.js` o checklist manual en cada cambio MATRIZ |
| Extensión training KB → CRM suggest | Bajo hasta decisión negocio | Ver extensión en `DEV-TRAINING-MODE-SCOPE.md` |

---

## 5. Prioridad de extracción (contenido → agente)

1. **Números y reglas de producto:** siempre desde `constants.js` + MATRIZ; el texto del agente solo explica.
2. **Política “no inventar totales” y flujo wizard:** `chatPrompts.js` + alinear GPT Builder.
3. **FAQ y objeciones:** de Knowledge GPT / ML KB → entradas `training-kb.json` (pregunta corta + `goodAnswer`).
4. **Herramientas:** mantener OpenAPI y `ACTIONS_DOC` en lockstep.

---

## 6. Buenas prácticas → alineación BMC

| Práctica | Panelin local | Custom GPT | Estado / gap |
|----------|---------------|------------|----------------|
| Política explícita | `IDENTITY`, `WORKFLOW` | Instrucciones Builder | Sincronizar tras cada iteración comercial |
| Grounding | `calcState` en prompt + `ACTION_JSON` | Actions → mismo API | Vigilar drift OpenAPI |
| RAG / KB | `training-kb.json` + match por query | Knowledge files | Dedupe con inventario §3 |
| HITL | Train tab, Good/Correct en dev | Edición manual | Criterios unificados con ML KB donde aplique |
| Evaluación | `npm run test:chat` (técnico) | Manual | **Falta** golden set negocio (§4) |
| Versionado | Git (`chatPrompts`) | Export manual | KB local sin git → export |
| Seguridad | Rate limit, `sanitizeForPrompt`, auth dev | Políticas OpenAI | Revisar al ampliar contexto |
| Observabilidad | SSE, `training-sessions` | Logs plataforma | Opcional: correlación conversación |

---

## 7. Golden set inicial (borrador para completar)

Usar como checklist manual o plantilla. Cada fila: **entrada usuario**, **estado calculadora mínimo** (opcional), **criterio de éxito** (texto o acciones esperadas).

| # | Tema | Ejemplo entrada | Criterio de éxito (resumido) |
|---|------|-----------------|------------------------------|
| 1 | No total sin datos | “¿Cuánto me sale 100 m² de techo?” | Pide dimensiones, lista, familia, etc.; no inventa total |
| 2 | FOIL colores | “¿ISOROOF FOIL en blanco?” | Alineado a catálogo: Gris/Rojo en FOIL; ofrece alternativas |
| 3 | ISODEC pared vs ISOPANEL | “Quiero ISODEC en la pared” | Menciona `ISODEC_EPS_PARED` vs ISOPANEL según escenario |
| 4 | Mínimos m² | “ISOROOF 3G blanco 80 m²” | Menciona mínimo 500 m² Blanco si aplica |
| 5 | Acción válida | Usuario confirma zona 10×5 | Emite `ACTION_JSON` con números JSON, no strings |
| 6 | advanceWizard | Pregunta al final + “?” | No emite `advanceWizard` en la misma respuesta que pregunta |
| 7 | Lista precios | “Soy distribuidor” | `setLP` venta o explica web vs venta |
| 8 | IVA | “Precio con IVA” | Explica 22% aplicado en app; no inventa total sin estado |

Ampliar hasta cubrir `solo_fachada`, `camara_frig`, `presupuesto_libre` según prioridad comercial.

---

## 8. Mantenimiento

- Tras cambios en **MATRIZ** o `constants.js`: revisar **CATALOG** en `chatPrompts.js` y entrada en **Cambios recientes** de `PROJECT-STATE.md` si el cambio es visible al usuario.
- Tras cambios en **GPT Builder**: actualizar este inventario solo si cambia lista de Knowledge/Actions o política nueva.
- Revisión trimestral: duplicados §3 + golden set §7.

---

## Referencias cruzadas

- [`PANELSIM-FULL-PROJECT-KB.md`](./PANELSIM-FULL-PROJECT-KB.md)
- [`DEV-TRAINING-MODE-SCOPE.md`](../../DEV-TRAINING-MODE-SCOPE.md)
- [`GPTCloud.md`](../../knowledge/GPTCloud.md)
- [`ML-TRAINING-SYSTEM.md`](./ML-TRAINING-SYSTEM.md)
