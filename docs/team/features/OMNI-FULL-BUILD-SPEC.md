# OMNI FULL BUILD — Spec, Arquitectura y Benchmark

**Fecha:** 2026-07-08 · **Estado:** aprobado (plan de sesión) · **Owner:** @matiasportugau-ui
**Objetivo:** llevar el CRM omnicanal AI propio (Omni/Panelin) de score ~7.3 a **≥8.6** (paridad+ vs líderes comerciales), cerrando 5 gaps sobre la arquitectura existente. Decisión validada: **BUILD, no buy**.

---

## 1. Contexto y benchmark

### 1.1 Investigación de mercado (2026-07-08)

Se investigaron 40+ herramientas de gestión centralizada de leads con IA (WhatsApp + Instagram + Facebook + Email + MercadoLibre) en 5 tracks paralelos. Modelo de scoring ponderado: ML 25% · canales 20% · IA 20% · CRM 15% · precio 10% · fit LatAm 5% · API/reviews 5%.

**Top del mercado:**

| # | Herramienta | Score | Dato clave |
|--:|---|--:|---|
| 1 | Zenvia Customer Cloud (ex Sirena) | 8.2 | Único all-in-one verificado: ML pre+post-venta+órdenes, GenAI, USD 130/mes |
| 2 | Botmaker | 7.9 | Partner oficial ML, agentes IA fuertes; CRM débil |
| 3 | Kommo | 7.2 | Mejor pipeline/kanban; ML solo post-venta |
| 4 | Quick Answer | 7.2 | IA nativa para preguntas ML, ~USD 40/mes |
| 5 | Parrot CRM | 7.0 | CRM conversacional ML + ChatGPT, USD 29–99/mes |
| — | **BMC Omni/Panelin (hoy)** | **~7.3** | Ya supera a Kommo; moat de cotización único |

### 1.2 Dónde ganamos hoy (auditoría de código 2026-07-08)

- **ML auto-answer en fullAuto** (`server/lib/mlAutoAnswer.js` → `/answers`) — equivalente a lo que Quick Answer/GoBots cobran.
- **Moat de cotización**: calculadora → presupuesto → PDF → Drive → WA. Ningún vendor lo tiene.
- **Failover multi-LLM** (`agentCore.js`: claude→gemini→grok→openai, timeouts+cooldowns, prompt caching ~99%) — sin vendor lock-in.
- **RAG propio** sobre catálogo/precios (pgvector, `rag.js`).
- **HITL** (suggest→approve), team isolation, dedup+merge con auditoría (`013_contact_merge_log`).
- **Data ownership** total (Postgres) y costo marginal ≈ infra + tokens.

### 1.3 Los 5 gaps vs mercado

| # | Gap | Evidencia | Esfuerzo |
|--:|---|---|---|
| 1 | Email saliente no operativo en prod | `emailReply.js` listo (Gmail API→SMTP fallback) pero sin pata de envío en prd; runbook H1–H4 pendiente | XS (ops+verif) |
| 2 | Webhook ML sin procesamiento completo | `routes/webhooks.js:44` TODO: buffering + CRM sync trigger; postventa fuera del inbox omni | S |
| 3 | Instagram DM / FB Messenger ausentes | Sin adapters ni outbound; todos los competidores top los tienen | M |
| 4 | Secuencias de follow-up (drip/no-reply) | `automationEngine` solo dispara en `message.ingested`; sin triggers temporales | M |
| 5 | Kanban UI | `omni_deals` + `stageMachine.js` (ADR-006) existen; sin vista de tablero | S–M |

**Proyección post-build: ~8.6** — arriba de Zenvia, a costo de licencia $0.

---

## 2. Arquitectura objetivo

```
CANALES                     INGESTA (adapters → OmniInboundEvent)          NÚCLEO
WA Cloud API ──────────► omni/adapters/waWebhook.js ──┐
IG DM        [NUEVO] ──► omni/adapters/igWebhook.js ──┤    normalizer.js
FB Messenger [NUEVO] ──► omni/adapters/messengerWebhook.js ┤  ├ resolveContact (dedup phone/email/ml_user_id)
Email in (Gmail poll) ─► omni/adapters/emailIngest.js ─┼──► ├ omni_contacts/conversations/messages
ML questions (poll) ───► omni/adapters/mlCrmRow.js ────┤    ├ urgency.js (scoring)
ML webhook   [FIX] ────► omni/adapters/mlWebhook.js ───┘    ├ automationEngine (rules + HITL)
                                                            └ aiWorker (suggest-response, wa_crm_sync)
SALIDA                                                     OPERACIÓN
whatsappOutbound.js (Cloud API, ventana 24h + templates)   /hub/canales cockpit (inbox, HITL approve)
emailReply.js (Gmail API → SMTP fallback)   [ACTIVAR]      /hub/canales kanban  [NUEVO] (omni_deals)
mlAutoAnswer.js (fullAuto preguntas ML)                    /hub/clientes (customers 360)
igSend / messengerSend  [NUEVO] (Graph API + HUMAN_AGENT)
FOLLOW-UP
waFollowupsWorker + snoozeWorker (existentes)
sequenceWorker [NUEVO]: triggers temporales (conversation.no_reply, followup.due)
   sobre omni_automation_rules → acciones AI-draft con requires_approval=true
DEALS
omni_deals + deals/stageMachine.js (lead→qualified→proposal→negotiation→closed_won/lost)
   → deals/syncCrm.js → CRM_Operativo (stageToCrmEstado)
```

**Principios:**
1. **Extensión, no greenfield** — cada gap reutiliza un patrón ya probado (adapter, worker, rules engine, stage machine).
2. **Feature flags default-off** para todo lo que dependa de human gates (`OMNI_IG_ENABLED`, `OMNI_FB_ENABLED`).
3. **HITL por defecto** en toda acción de IA saliente nueva (`requires_approval=true`); fullAuto solo donde ya está aprobado (preguntas ML).
4. **Idempotencia** en toda ingesta (`buildIdempotencyKey(channel, msgId)`) y en runs de automatización (patrón `omni_automation_runs`).
5. Convenciones repo: ES modules, pino, 503 para Sheets, secrets vía `config.*`, PRs <500 LOC.

---

## 3. Spec por gap

### Gap 1 — Email saliente (XS, human-gated)

**Estado actual:** `emailReply.js` prefiere Gmail API (`isGmailSendConfigured`) con fallback SMTP por casilla (`accounts.json` del repo hermano). Las casillas NetUy están muertas; MX → Cloudflare Email Routing (solo inbound). No hay `GMAIL_SEND_FROM` ni bloques `smtp` en prd.

**Alcance:**
- Ejecutar runbook `docs/team/runbooks/email-cuentas-bmcuruguay-plan-operativo.md`:
  - **[H1]** Alta SMTP2GO free + DKIM del dominio (humano)
  - **[H2]** SPF merge en Cloudflare (humano)
  - **[H3]** Forwarding por vendedor + Gmail "Send mail as" por casilla (humano)
  - **[H4]** Verificación end-to-end (asistida)
- Automatizable ahora: verificación de env prod (`GMAIL_SEND_FROM`, secrets en Cloud Run), smoke de `sendEmailReply` con transport inyectado, wiring del fallback SMTP en `emailReply.js` si el runbook lo pide, checklist de H1–H4 en el issue.

**Criterios de aceptación:**
- [ ] Reply desde cockpit CRM llega al cliente desde la casilla correcta (e2e verificado)
- [ ] `smoke:prod` (o smoke dedicado) cubre el path de envío sin falsos verdes
- [ ] Runbook actualizado con evidencia de H1–H4

### Gap 2 — Webhook ML → inbox omni (S)

**Estado actual:** `routes/webhooks.js` verifica firma/token ML pero el procesamiento es TODO (línea 44); las preguntas entran por polling (`mlCrmRow.js`); postventa no llega al inbox.

**Alcance:**
- Nuevo `server/lib/omni/adapters/mlWebhook.js`: notification ML → `OmniInboundEvent` (`channel: "ml"`, idempotency `ml:<resource_id>`, `contact_hint.ml_user_id`).
- Resolver el TODO: mover buffering de eventos + trigger de CRM sync a un servicio (patrón `triggerWaCrmSyncNow`).
- Rutear mensajes postventa (topic `messages`) y preguntas (topic `questions`) al inbox; preguntas siguen elegibles para `mlAutoAnswer` (sin doble respuesta — idempotencia por resource).
- Validar límites reales de la API de mensajería postventa ML (1 msg por acción del comprador, ventanas) y documentarlos en el adapter.

**Criterios de aceptación:**
- [ ] Notification ML (question/message) crea/actualiza conversación omni con contacto resuelto
- [ ] Sin duplicados frente a re-entregas de webhook (test de idempotencia)
- [ ] Postventa visible y respondible desde cockpit (HITL)
- [ ] Tests offline (patrón `omniHardening.test.js`) en `test:core` o `test:api`

### Gap 3 — Instagram DM + FB Messenger (M, gate cm-0)

**Estado actual:** ausentes. Ya existe webhook Meta para WA (verify + firma) reutilizable.

**Alcance:**
- Adapters `igWebhook.js` / `messengerWebhook.js` → `OmniInboundEvent` (`channel: "ig" | "fb"`), firma `X-Hub-Signature-256` compartida con WA.
- Outbound `igSend.js` / `messengerSend.js` (Graph API `/me/messages`), respetando ventana de 24h + tag `HUMAN_AGENT` cuando aplique.
- Extensión de enum de canal en `omni/types.js` + migración si hay constraint en DB.
- Flags `OMNI_IG_ENABLED` / `OMNI_FB_ENABLED` (default off) en `server/config.js`.
- **Human gate cm-0 (Meta OAuth/app review)** según `docs/team/HUMAN-GATES-ONE-BY-ONE.md`: la conexión de la app Meta, permisos `instagram_manage_messages` / `pages_messaging` y app review son pasos humanos. Todo el código se buildea y testea behind flags sin esperar el gate.
- suggest-response reusa asistente `canales` (sin asistente nuevo).

**Criterios de aceptación:**
- [ ] Con flags ON en un entorno con tokens: DM de IG y mensaje de página FB crean conversación omni y permiten respuesta HITL
- [ ] Con flags OFF: cero cambio de comportamiento (default prod hasta cerrar cm-0)
- [ ] Firma inválida → 401/403 (test)
- [ ] Checklist cm-0 documentado en el issue con permisos exactos requeridos

### Gap 4 — Secuencias de follow-up (M)

**Estado actual:** `automationEngine.js` corre reglas solo en `message.ingested`; followups almacenables (`customer_followups`, `followUpStore`, `waFollowupsWorker` emite webhook al vencer); sin motor de secuencias.

**Alcance:**
- `server/lib/omni/orchestrator/sequenceWorker.js` (patrón `waFollowupsWorker`/`snoozeWorker`): loop que evalúa triggers temporales y despacha por `automationEngine`.
- Nuevos `trigger_event` en `omni_automation_rules`: `conversation.no_reply` (X horas sin respuesta del cliente con conversación abierta) y `followup.due` (fecha explícita). Migración omni nueva (`01X_sequence_triggers.sql`).
- Acción `ai_draft_followup`: genera borrador vía suggest-response con `requires_approval=true` (HITL siempre en v1).
- Canal WA: si fuera de ventana 24h → exigir template aprobado o degradar a tarea para humano (nunca enviar libre fuera de ventana).
- UI mínima en cockpit: lista de reglas de secuencia + toggle enable/disable (reutiliza endpoints de automation existentes si ya exponen CRUD; si no, `GET/PATCH /api/omni/automation/rules`).

**Criterios de aceptación:**
- [ ] Conversación sin respuesta X horas genera sugerencia de follow-up pendiente de aprobación
- [ ] Nunca hay envío automático sin approve en v1 (test)
- [ ] Ventana 24h WA respetada (test de degradación a template/tarea)
- [ ] Idempotencia: una regla no genera duplicados por re-evaluación (patrón `omni_automation_runs`)

### Gap 5 — Kanban UI sobre omni_deals (S–M)

**Estado actual:** `omni_deals`, `stageMachine.js` (stages + `canTransition()`), `deals/syncCrm.js` → CRM_Operativo ya existen. Falta la vista.

**Alcance:**
- Vista kanban en `/hub/canales` (pestaña «Pipeline»): columnas = `DEAL_STAGES`, cards = deals con contacto/canal/monto/última actividad.
- Drag&drop con validación `canTransition()` server-side (endpoint `PATCH /api/omni/deals/:id/stage`) + grant `canales:write` (RBAC `requireGrant`).
- Transición inválida → 409 con mensaje del stage machine; terminal stages no arrastrables.
- Sync a CRM_Operativo vía código existente (`stageToCrmEstado`).

**Criterios de aceptación:**
- [ ] Board renderiza los 6 stages con deals reales
- [ ] Transiciones inválidas bloqueadas en server (test) y UI
- [ ] Usuario sin `canales:write` ve el board read-only
- [ ] `gate:local` + build verdes

---

## 4. Plan de ejecución

| Orden | Item | Esfuerzo | Dependencia | Human gate |
|--:|---|---|---|---|
| 0 | Este spec + issues en «BMC Dev» | XS | — | — |
| 1 | Gap 1 email-out | XS | — | H1–H4 |
| 2 | Gap 2 ML webhook | S | — | — |
| 3 | Gap 3 IG/FB | M | — | cm-0 (flags off hasta cerrar) |
| 4 | Gap 4 secuencias | M | idealmente tras 2 | — |
| 5 | Gap 5 kanban | S–M | — | — |
| 6 | Verify-close: gates, PROJECT-STATE, re-score | XS | 1–5 | — |

- Cada gap = 1+ PRs <500 LOC; `gate:local` verde por PR; entrada en «Cambios recientes» de `PROJECT-STATE.md` por merge.
- Blockers (credencial faltante, gate humano): parar, documentar en el issue, no reintentar.

## 5. Fuentes

- Benchmark de mercado y gap analysis: sesión Copilot 2026-07-08 (COMPARISON-BOARD + GAP-ANALYSIS, 5 tracks de research con URLs por herramienta).
- Auditoría de código: `server/lib/omni/*`, `server/routes/webhooks.js`, `server/lib/emailReply.js`, `server/lib/mlAutoAnswer.js`, `server/lib/waFollowupsWorker.js`, migraciones `server/migrations/omni/*`.
- Estado del proyecto: `docs/team/PROJECT-STATE.md` (entradas 2026-07-04 → 2026-07-08).
