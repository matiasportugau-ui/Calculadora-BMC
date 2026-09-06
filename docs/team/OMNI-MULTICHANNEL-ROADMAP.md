# Omni multichannel — roadmap de integración unificada (gratis · persistente · propio)

> **Estado:** propuesta / roadmap (no ejecutado). No cambia código.
> **Objetivo:** llevar **MercadoLibre, Gmail/email e Instagram+Facebook** al mismo modelo unificado
> que ya tiene WhatsApp: **conectar desde el hub → ingestión canónica omni → inbox unificado
> (`/hub/canales`) + IA (classify/suggest) + sync a CRM** — y hacerlo de forma **gratis, persistente
> y propiedad de BMC** (sin BSP/intermediarios, con tokens que no caducan).

Este doc consolida el relevamiento de los 4 canales y define la secuencia. Complementa
`docs/transformation/adrs/ADR-001-omni-core.md` (tablas canónicas) y `ADR-009-migration-strategy.md`
(estrategia Shadow → Flip). El caso WhatsApp (coexistencia + scripts de terminal) está en
`docs/team/runbooks/wa-coexistence-onboarding.md` y `wa-connect-numero-coexistencia.md`.

---

## 1. Principio rector: gratis · persistente · propio (sin BSP)

El requisito central: cada conexión debe ser **de BMC**, **sin costo de intermediario** y **estable en
el tiempo** (que no se caiga cada N horas por un token vencido). Cómo se logra por canal:

| Dimensión | Cómo se resuelve "propio + gratis" | Cómo se resuelve "persistente" |
|---|---|---|
| **WhatsApp** | Cloud API oficial **directo** (sin Twilio/360dialog). Solo se paga el pricing de Meta por conversación, sin markup de BSP. | **System User token permanente** (no expira) generado en el Business propio de BMC. La coexistencia mantiene el número **en el teléfono** (propiedad física del número). |
| **MercadoLibre** | App propia de BMC (OAuth), API oficial. Sin costo por mensaje. | **Refresh token** rotado automáticamente por `mercadoLibreClient` → token de acceso siempre vigente. Guardado cifrado. |
| **Gmail / email** | App OAuth propia en el Google Cloud de BMC + dominio propio (Cloudflare Email Routing → Gmail). Sin costo. | **Refresh token** de Gmail (no expira salvo revocación) + rotación. Alternativa self-hosted: IMAP con credenciales propias. |
| **Instagram / Facebook** | App propia de BMC, API oficial (`/me/messages`). Sin costo por mensaje. | **Page token de larga duración / System User token** (permanente) en vez del page token corto. |

**El problema real de "persistencia" a resolver = expiración de tokens.** La solución transversal, ya
parcialmente construida en el repo:

- **Almacén cifrado propio:** `server/tokenStore.js` (AES-256-GCM, GCS/file) para ML, y el patrón nuevo
  `server/lib/secretBox.js` + `wa_connections` (PR #1089) para WhatsApp. Todos los tokens viven **en
  infraestructura de BMC** (Postgres/GCS cifrado con `TOKEN_ENCRYPTION_KEY`), no en un tercero.
- **Tokens permanentes donde existan:** Meta **System User tokens** (WhatsApp e IG/FB) no caducan →
  eliminan el problema de raíz. Es la palanca #1 de persistencia para todo lo Meta.
- **Rotación por refresh token** donde no haya permanente: ML y Google usan refresh tokens; el cliente
  renueva el access token solo. Ya implementado para ML (`mercadoLibreClient`), y para Gmail ingest
  (`GMAIL_INGEST_REFRESH_TOKEN`).

> **Acción de investigación pendiente (la que pediste):** confirmar contra doc de Meta 2026 que un
> **System User token** cubre tanto `whatsapp_business_messaging` como `pages_messaging` (IG/FB) para
> que **un solo token permanente de BMC** sirva a los 3 canales Meta. Si es así, la "property ownership"
> Meta se centraliza en: **1 Business Portfolio + 1 App + 1 System User Admin** de BMC → dueño de WA, IG
> y FB con un token que no vence. (El subagente de research de Graph API vigente alimenta esta parte.)

---

## 2. Estado actual por canal (relevado en código, no de memoria)

Leyenda ingestión: **canónico** (escribe omni como fuente) · **shadow** (escribe omni en paralelo, no
autoritativo) · **dormant** (código listo, flag OFF).

| Canal | Conexión (self-service?) | Ingestión omni | Outbound | Inbox unificado | Flags |
|---|---|---|---|---|---|
| **WhatsApp** | ✅ Embedded Signup coexistencia (PR #1089) `/api/wa/onboarding/*` + card en `/hub/wa` | **Canónico** (flip hecho, ADR-009) | `sendWaReply` + resolver `waCredentials` | ✅ `/hub/canales` + WA Cockpit | `WA_COEXISTENCE_ENABLED`, `OMNI_WA_CANONICAL`, `OMNI_WA_READS` |
| **MercadoLibre** | ⚠️ OAuth existe (`/auth/ml/start|callback`) pero **sin botón en el hub**; callback devuelve JSON pelado; **token único global** (no multi-cuenta) | **Shadow** (webhook + CRM-sync), **default OFF** | `sendMlReply` / `/answers` (solo preguntas; sin post-venta) | ✅ el inbox omni ya lista y responde `ml` (bajo shadow); + panel ML Manager aparte | `OMNI_ML_SHADOW_WRITE` (no hay `OMNI_ML_CANONICAL` ni `OMNI_ML_READS`) |
| **Gmail / email** | ❌ sin UI de alta; casillas **hard-seed SQL** + `config/accounts.json` (repo hermano); `GET /api/omni/accounts` read-only | **Shadow**, **default OFF**; autoritativo sigue siendo la **planilla CRM** | Gmail-API (`gmailSend`) preferido, SMTP fallback muerto | ✅ `/hub/canales` con filtro `email` + filtro por cuenta | `OMNI_EMAIL_SHADOW_WRITE`, `GMAIL_*` |
| **Instagram / Facebook** | ❌ sin flujo de connect; **page-token manual** por env | **Canónico por diseño pero DORMANT** (flags OFF, gate cm-0) | `sendIgReply`/`sendMessengerReply` (`/me/messages`, ventana 24h) | ⚠️ renderiza pero **falta opción de filtro ig/fb** + mismatch `channelMeta` (`ig`→`instagram`) | `OMNI_IG_ENABLED`, `OMNI_FB_ENABLED` (ambos OFF) |

**Lo que ya está construido y es reutilizable (no reescribir):**
- Modelo canónico omni: `normalizeAndPersist` (`server/lib/omni/normalizer.js`) emite `message.ingested`
  en el event bus → alimenta el AI worker (`aiWorker.js`) que encola **classify + suggest para cualquier
  canal** (no está gateado por canal; solo `wa_crm_sync` es WA-específico).
- Inbox unificado: `/hub/canales` → `OmniInboxPanel.jsx` + `useOmniConversations.js` (filtro por `channel`).
- Reply unificado: `POST /api/omni/conversations/:id/reply` ya rutea wa/ml/email/ig/fb.
- Adapters de ingest y outbound existen para los 4 canales.
- Almacén de tokens cifrado (`tokenStore.js`, `secretBox.js`).

---

## 3. Roadmap por tiers (secuencia recomendada)

Orden por **valor/riesgo**: primero lo que no depende de gates externos.

### Tier 0 — Quick wins de inbox (frontend, sin gates, sin flags)
- **Filtro IG/FB en `OmniInboxPanel.jsx`** (hoy solo wa/ml/email) → agregar opciones instagram/facebook.
- **Normalizar `channelMeta`** para que `ig`→`instagram` y `fb`→`facebook` (hoy caen al gris genérico).
- Resultado: los 4 canales se ven consistentes en el inbox unificado. Bajo riesgo, alto valor visible.

### Tier 1 — Validar shadow-write (encender flags en staging, medir paridad)
- ML: `OMNI_ML_SHADOW_WRITE=1` en staging → validar que preguntas/mensajes caen en omni con paridad vs
  Sheets. Email: `OMNI_EMAIL_SHADOW_WRITE=1` ídem. (IG/FB no aplica: ya es canónico-por-diseño, espera cm-0.)
- Sin cambio de fuente de verdad todavía (sigue Sheets/legacy). Reversible con apagar el flag.

### Tier 2 — Conexión self-service desde el hub ("connector"/"ingestor")
- **ML (más chico):** botón **"Conectar MercadoLibre"** en el hub → abre `/auth/ml/start`; hacer que
  `/auth/ml/callback` **redirija de vuelta a `/hub`** (hoy JSON pelado). El OAuth ya existe.
- **Gmail (mediano):** endpoint + UI de **alta/gestión de casillas** (hoy read-only + hard-seed); implica
  tokens multi-cuenta (hoy un refresh token compartido). Reusar `omni_email_accounts`.
- **IG/FB (detrás de gate):** análogo a `waOnboarding.js` — un `metaOnboarding` que conecte la Página vía
  Facebook Login for Business y guarde un **page/System-User token permanente** en el store cifrado.
- Todo detrás de flags OFF por default.

### Tier 3 — Flip canónico + convergencia de lectura (por canal, estilo ADR-009)
- ML: introducir `OMNI_ML_CANONICAL` + `OMNI_ML_READS` (hoy no existen) espejando el patrón WA
  (`server/lib/wa/ingestMode.js`, `wa-canonical-flip.md`) + job durable en `omni_ai_jobs`.
- Email: flip de fuente de verdad de la planilla CRM a Postgres (Fase 3 del `INBOX-AI-FIRST-BLUEPRINT.md`).
- IG/FB: al cerrar **cm-0**, `OMNI_IG_ENABLED=1`/`OMNI_FB_ENABLED=1` (ya es canónico) + tokens permanentes.
- Reconciliar rutas dobles de ingest (ML webhook vs CRM-sync; email Gmail-poll vs IMAP snapshot).

---

## 4. Gates externos (bloqueos que no dependen de código)

| Canal | Gate | Fix / timeline |
|---|---|---|
| WhatsApp | Business Verification + Advanced Access + `config_id` Embedded Signup | En curso (runbook WA); días si falta verificación |
| IG/FB | **cm-0**: App Review de Meta para permisos de messaging + Business Verification | Bloquea encender flags; System User token permanente resuelve la persistencia post-review |
| MercadoLibre | Scopes de la app ML (read/write questions) ya OK; multi-seller requiere más scopes | Bajo |
| Gmail | Verificación de la app OAuth de Google (si se agregan cuentas fuera del dominio) | Medio; el dominio propio vía refresh token ya funciona |

**Palanca de persistencia Meta (a confirmar en research):** un **System User Admin** en el Business de
BMC, asignado a la App + WABA + Páginas IG/FB, puede emitir **un token que no expira** para los 3 canales
Meta → resuelve de una vez "persistente + propio" para WhatsApp, Instagram y Facebook.

---

## 5. Próximos pasos concretos (cuando se apruebe salir del doc)

1. **Tier 0** (frontend, sin gates): fix filtro + `channelMeta` IG/FB — 1 PR chico.
2. **ML connect** (Tier 2): botón + redirect de callback — 1 PR chico, sin gate.
3. **Research de token permanente Meta** (System User multi-canal) → confirmar y documentar en runbook.
4. Recién después: flips canónicos (Tier 3) por canal, cada uno con su flag y su runbook estilo ADR-009.

## Archivos clave por canal (referencia)
- **Omni core:** `server/lib/omni/normalizer.js`, `eventBus.js`, `orchestrator/aiWorker.js`; inbox
  `src/components/hub/canales/panels/OmniInboxPanel.jsx`, `src/hooks/useOmniConversations.js`.
- **WhatsApp (referencia de paridad):** `server/routes/waOnboarding.js`, `server/lib/wa/{ingestMode,waCredentials}.js`, `docs/team/runbooks/wa-canonical-flip.md`.
- **ML:** `server/index.js` (`/auth/ml/*`), `server/mercadoLibreClient.js`, `server/lib/mlWebhookService.js`, `server/lib/omni/adapters/{mlWebhook,mlCrmRow,mlOutboundMirror}.js`, `src/components/hub/ml/*`.
- **Email:** `server/lib/gmailPoll.js`, `server/lib/omni/adapters/emailIngest.js`, `server/lib/{emailReply,gmailSend}.js`, migraciones `server/migrations/omni/{008,009,016}.sql`.
- **IG/FB:** `server/lib/omni/metaWebhookHandler.js`, `adapters/{igWebhook,messengerWebhook,metaMessaging}.js`, `outbound/{metaSend,igSend,messengerSend}.js`, migración `017_ig_fb_channels.sql`.
- **Persistencia/ownership:** `server/tokenStore.js`, `server/lib/secretBox.js`, `wa-package/migrations/019_wa_connections.sql`.
