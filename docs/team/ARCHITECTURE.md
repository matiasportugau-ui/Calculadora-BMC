# Calculadora BMC — Architecture

Living document. Source of truth for the system shape — actual flows in production today, and (per-flow) the wanted/target version where it differs.

Last inventory sync: 2026-05-13 — derived from 24 server routes, ~55 lib modules, 19 external services, 28 distinct end-to-end flows.

Sibling docs: [`PROJECT-STATE.md`](./PROJECT-STATE.md) (live state, recent changes), [`AGENTS.md`](../../AGENTS.md) (operational catalogue), [`docs/PRICING-ENGINE.md`](../PRICING-ENGINE.md) (pricing model deep-dive).

---

## 1. System Context (C4 Level 1)

```mermaid
flowchart LR
    operator([BMC Operator])
    customer([Customer])
    driver([Driver / Transportista])
    extai([External AI agents<br/>via /api/agent/superagent])

    bmc[(Calculadora BMC<br/>SPA + API + workers)]

    sheets[(Google Sheets)]
    gcs[(Google Cloud Storage)]
    drive[(Google Drive)]
    pg[(PostgreSQL<br/>transportista · wa_* · identity)]

    ml[MercadoLibre]
    wa[WhatsApp Cloud API]
    shop[Shopify Admin]
    goauth[Google OAuth 2.0]

    ai[Anthropic · OpenAI · Gemini · Grok]
    aigw[Vercel AI Gateway]
    smtp[Gmail SMTP]
    gh[GitHub Actions<br/>CI + cron]

    operator --> bmc
    customer -.-> wa
    customer -.-> ml
    customer -.-> shop
    driver --> bmc
    extai --> bmc

    bmc <--> sheets
    bmc --> gcs
    bmc --> drive
    bmc <--> pg
    bmc <-->|OAuth + webhook| ml
    bmc <-->|REST + webhook| wa
    bmc <-->|OAuth + webhook| shop
    bmc -->|OIDC| goauth

    bmc --> ai
    bmc -.->|optional| aigw --> ai
    bmc --> smtp
    gh -->|deploy + smoke| bmc
```

### Actors

| Actor | How they enter | Surfaces touched |
|---|---|---|
| **BMC Operator** | Browser → SPA | `/calculadora`, `/hub/*`, `/inspector`, `/fichas`, `/mi-espacio` |
| **Customer** | WA / ML / Shopify (never opens our SPA directly) | inbound via webhooks |
| **Driver** | PWA token link | `/conductor` |
| **External AI agents** | HTTP POST | `/api/agent/superagent`, `/api/internal/panelin/*` |

### External systems

| Service | Role | Auth | Direction | Critical |
|---|---|---|---|---|
| Google Sheets | CRM, Matriz, Wolfboard, Stock, Ventas | service-account JSON | outbound | Yes |
| Google Cloud Storage | quote PDFs, KB JSON, encrypted ML tokens | service-account / workload identity | outbound | Yes (prod) |
| Google Drive | quote HTML archives | service-account JSON | outbound | Optional |
| PostgreSQL | `transportista`, `wa_*`, `identity` schemas, optional `pgvector` | `DATABASE_URL` | outbound | Per-module |
| MercadoLibre | Q&A, listings, orders, auto-answer | OAuth2 PKCE | both (webhooks in / API out) | Optional |
| WhatsApp Cloud API | inbound/outbound messaging, delivery status | bearer token | both | Optional |
| Shopify Admin | questions, products, draft orders | OAuth2 + HMAC | both | Optional |
| Anthropic Claude | primary chat / parse / suggestion | bearer | outbound | Yes (default) |
| OpenAI | fallback + voice (Realtime) + Whisper | bearer | outbound | Fallback |
| Google Gemini | tertiary fallback | bearer | outbound | Optional |
| xAI Grok | tertiary fallback | bearer | outbound | Optional |
| Vercel AI Gateway | unified provider routing | OIDC or API key | outbound | Optional (rolling out) |
| Gmail SMTP | daily digest + WA magic-link | app password | outbound | Optional |
| Google OAuth 2.0 | identity (comprador phase) | OAuth2 | outbound | Optional |
| GitHub Actions | CI, deploys, scheduled smoke + antenna | — | both | Yes |

---

## 2. Containers (C4 Level 2)

```mermaid
flowchart TB
    user([Browser / Mobile / Driver PWA])

    subgraph vercel[Vercel hosting]
        spa[React 18 + Vite SPA<br/>routes: /calculadora · /hub/wa · /hub/ml<br/>/hub/canales · /hub/admin · /conductor<br/>/inspector · /fichas · /mi-espacio]
    end

    subgraph cr[Google Cloud Run · panelin-calc · us-central1]
        subgraph api[Express 5 API · :3001]
            routes[~24 route files<br/>/calc · /api/agent/* · /api/wa/*<br/>/api/transportista/* · /auth/* · /webhooks/*]
            workers[In-process workers<br/>· transportistaOutboxWorker<br/>· waEnricherWorker<br/>· waSlaWorker<br/>· waFollowupsWorker<br/>· WA 5-min auto-flush<br/>· waConv GC hourly]
            loop[Calc loopback client<br/>127.0.0.1:3001/calc/*<br/>used by agent tools]
            routes -. uses .- loop
            workers -. same process .- routes
        end
    end

    subgraph stores[Stateful stores]
        sheets[(Google Sheets<br/>BMC · CRM · Wolfboard · Matriz · Stock · Ventas)]
        pg[(PostgreSQL<br/>schemas: transportista · wa_* · identity<br/>pgvector optional)]
        gcs[(GCS · bmc-cotizaciones · KB)]
        drive[(Drive folder)]
        tok[(Encrypted token store<br/>disk or GCS)]
        kb[(SQLite · questions.db)]
        jsonl[(Local JSONL<br/>feedback · KB events)]
    end

    subgraph ext[External services]
        ai[AI providers<br/>Anthropic · OpenAI · Gemini · Grok]
        aigw[Vercel AI Gateway]
        ml[MercadoLibre]
        wa[WhatsApp Cloud API]
        shop[Shopify Admin]
        smtp[Gmail SMTP]
        goauth[Google OAuth]
    end

    subgraph ci[GitHub Actions]
        cii[ci.yml]
        dv[deploy-vercel.yml]
        dc[deploy-calc-api.yml]
        sm[smoke-prod-scheduled.yml<br/>cron 0 8,20 * * *]
        ka[knowledge-antenna<br/>cron 20 10 * * *]
    end

    user --> spa
    spa -->|fetch · SSE| api
    api --> sheets
    api --> pg
    api --> gcs
    api --> drive
    api --> tok
    api --> kb
    api --> jsonl
    api --> ai
    api -.->|optional| aigw --> ai
    api <-->|webhooks · OAuth| ml
    api <-->|webhooks · REST| wa
    api <-->|webhooks · OAuth| shop
    api --> smtp
    api -->|OIDC| goauth

    cii --> dv --> vercel
    cii --> dc --> cr
    sm -. HTTPS .-> api
    ka -. HTTPS .-> api
```

### Background workers (all in-process inside the Cloud Run container)

| Worker | File | Schedule | What it does |
|---|---|---|---|
| `transportistaOutboxWorker` | `server/lib/transportistaOutboxWorker.js` | `setInterval` | Claims up to 20 outbox rows via `SELECT … FOR UPDATE SKIP LOCKED`, sends WA, exponential backoff (max 12 attempts → `failed`) |
| `waEnricherWorker` | `server/lib/waEnricherWorker.js` | self-scheduling `setTimeout` | Classifies intent, generates LLM suggestions, UPSERTs `wa_suggestions`. Governed by `enricher.enabled` flag |
| `waSlaWorker` | `server/lib/waSlaWorker.js` | `setInterval` | Flags conversations exceeding business-hours response SLA → `wa_sla_breaches` |
| `waFollowupsWorker` | `server/lib/waFollowupsWorker.js` | `setInterval` | Auto follow-up scheduling against `wa_messages` |
| WA conversations GC | `server/index.js:573` | `setInterval` 1h | Drops in-memory `waConversations` entries older than 24h |
| WA 5-min auto-flush | `server/index.js:741` | `setInterval` 60s | Flushes inactive WA conversations to CRM via AI parse + autolearn pipeline |

No `node-cron`, no BullMQ. All workers stop on SIGTERM.

---

## 3. CI / Deploy / cron

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | push/PR to main, develop | validate (`tests/validation.js`) + lint + build + channels_pipeline + voice_health + knowledge_antenna (reusable) |
| `deploy-vercel.yml` | `workflow_run` after green CI / PR / dispatch | Vite build → Vercel (preview per PR, prod after main) |
| `deploy-calc-api.yml` | `workflow_run` after green CI / dispatch | Cloud Run deploy with Secret Manager env mounting |
| `smoke-prod-scheduled.yml` | cron `0 8,20 * * *` + dispatch | twice-daily prod smoke via `smoke-prod-api.mjs` |
| `knowledge-antenna-scheduled.yml` | cron `20 10 * * *` + dispatch | daily antenna corpus refresh |
| `knowledge-antenna-reusable.yml` | `workflow_call` | reusable antenna job invoked by both CI and scheduled |
| `drive-oauth-verify.yml` | dispatch only | validate `VITE_GOOGLE_CLIENT_ID` format |
| `drive-oauth-dist-verify.yml` | dispatch only | confirm Vite baked Google Client ID into `dist/` |

---

## 4. Per-flow sequences

Each flow has an **Actual** sequence (what the code does today) and, where relevant, a **Wanted** sequence (what it should do). Diagrams below are paper-derived from a code-verified trace (file:line refs in step notes). Real DevTools + server-log traces can be layered on top once dev stack is running.

- [4.1 Quote creation (UI → calc → PDF)](#41-quote-creation--ui--calc--pdf) — critical
- [4.2 Agent chat (SSE → tools → calc loopback)](#42-agent-chat--sse--tools--calc-loopback) — critical
- [4.3 WA inbound → 5-min flush → CRM / autolearn](#43-wa-inbound--5min-flush--crm--autolearn) — critical
- [4.4 ML webhook → CRM sync → auto-answer](#44-ml-webhook--crm-sync--auto-answer) — critical

The **wanted** version per flow is added only where the target differs from actual.

### 4.1 Quote creation — UI → calc → PDF

**Actual.** Operator clicks "PDF Cliente" → SPA builds memoized print-ready HTML → POST `/api/pdf/generate` → server-side Playwright/Chromium renders vectorial A4 → returns PDF buffer → SPA triggers download. If the server endpoint fails, `pdfGenerator.js` transparently falls back to client-side `html2pdf.js` (raster, hidden iframe). No external services touched on this path — Chromium is bundled via `@sparticuz/chromium`.

```mermaid
sequenceDiagram
    autonumber
    actor U as Operator
    participant SPA as React SPA<br/>PanelinCalculadoraV3
    participant PG as pdfGenerator.js
    participant API as Express<br/>POST /api/pdf/generate
    participant CR as Playwright + Chromium

    U->>SPA: click "PDF Cliente"
    Note over SPA: handleClientePdf()<br/>PanelinCalculadoraV3_backup.jsx:3629
    SPA->>SPA: buildClientePdfHtml (memoized)
    SPA->>PG: htmlToPdfBlob(html, filename)
    PG->>API: POST {html, filename}<br/>pdfGenerator.js:14
    API->>CR: launch + setContent + emulate "print"<br/>pdf.js:67-108
    CR-->>API: PDF buffer A4 vectorial<br/>pdf.js:110
    API-->>PG: blob (HTTP 200)
    alt server unavailable / chromium fails
        PG->>PG: html2pdf.js fallback (raster, hidden iframe)<br/>pdfGenerator.js:37-72
    end
    PG-->>SPA: PDF Blob
    SPA->>U: createObjectURL → "a.download" click → revoke<br/>file saved as BMC-YYYY-{ref}-{client}.pdf
```

**Wanted.** Server-only PDF (no client fallback). SSE progress events (`received` → `rendering` → `uploaded` → `ready`). Upload to GCS, return signed URL. Auto-persist quote to CRM (`Master_Cotizaciones`) and quote registry. Per-PDF audit log row in Postgres with content hash.

```mermaid
sequenceDiagram
    autonumber
    actor U as Operator
    participant SPA as React SPA
    participant API as Express<br/>POST /api/pdf/generate (SSE)
    participant CR as Playwright + Chromium
    participant GCS as Google Cloud Storage
    participant Sheets as Sheets · Master_Cotizaciones<br/>+ quote registry
    participant Audit as Postgres · pdf_audit_log

    U->>SPA: click "PDF Cliente"
    SPA->>API: POST {html, filename, quoteCtx, userId}
    API-->>SPA: event {step:"received"}
    API->>CR: launch + setContent + emulate "print"
    API-->>SPA: event {step:"rendering"}
    CR-->>API: PDF buffer
    API->>API: sha256(buffer) → hash
    API->>GCS: upload bmc-cotizaciones/{quoteId}.pdf
    GCS-->>API: signed URL
    API-->>SPA: event {step:"uploaded"}
    par persist
        API->>Sheets: write Master_Cotizaciones row
        API->>Audit: INSERT (userId, ts, hash, gcsPath, quoteId)
    end
    API-->>SPA: event {step:"ready", url}
    SPA->>U: open url → browser downloads PDF
    Note over SPA,API: NO client-side html2pdf fallback —<br/>hard error toast if any step fails
```

### 4.2 Agent chat — SSE → tools → calc loopback

**Actual.** Operator sends a message via `useChat` → `POST /api/agent/chat` opens an SSE stream → server runs rate-limit/auth/budget, retrieves KB examples and (optionally) RAG context via pgvector, builds the system prompt and compacts history → chooses a provider (Claude default; fallback grok → gemini → openai) → LLM streams text and may emit a `tool_use` block → `executeTool` calls calc via loopback `127.0.0.1:3001/calc/cotizar` (same endpoint the UI uses, ensures one source of truth) → result is fed back as a user message → LLM continues until done. Post-stream the server fires conversation log + autolearn extract (fire-and-forget, ≥4-turn sessions in prod).

```mermaid
sequenceDiagram
    autonumber
    actor U as Operator
    participant UI as PanelinChatPanel<br/>+ useChat
    participant API as Express<br/>POST /api/agent/chat (SSE)
    participant Core as agentCore<br/>provider chain
    participant Claude as Anthropic Claude
    participant Tools as agentTools.executeTool
    participant LB as Calc loopback<br/>127.0.0.1:3001

    U->>UI: send message
    UI->>API: POST {messages, calcState, aiProvider, conversationId}<br/>useChat.js:301
    Note over API: rate-limit · CORS · dev-auth · budget<br/>agentChat.js:516-567
    API->>API: KB retrieval · optional RAG (pgvector) ·<br/>buildSystemPrompt + summarizeHistory<br/>agentChat.js:697-786
    API->>Core: pick provider<br/>(Claude default · fallback grok→gemini→openai)
    Core->>Claude: anthropic.messages.stream(...)<br/>with AGENT_TOOLS + system + history
    API-->>UI: open SSE
    loop streaming
        Claude-->>API: text_delta
        API-->>UI: event {type:"text", delta}
    end
    Claude-->>API: content_block tool_use<br/>(calcular_cotizacion + input)
    API-->>UI: event {type:"tool_call"}
    API->>Tools: executeTool("calcular_cotizacion", input)<br/>agentChat.js:927
    Tools->>LB: POST /calc/cotizar (loopback)<br/>agentTools.js:1084
    LB-->>Tools: {ok, allItems, totales, ...}
    Tools-->>API: summarized result
    API-->>UI: event {type:"verified_quote", payload}
    API->>Claude: feed tool result as user message<br/>agentChat.js:968
    loop more streaming
        Claude-->>API: text_delta
        API-->>UI: event {type:"text", delta}
    end
    Claude-->>API: stop (no more tool_use)
    API-->>UI: event {type:"done"}
    Note over API: post-stream fire-and-forget:<br/>conversation log + autolearn extract
```

**Wanted.** Vercel AI Gateway is the primary path (4-SDK chain becomes fallback only). Conversation history durable in Postgres (`conv_turns`, `conv_checkpoints`). Auto-summary checkpoint every N turns. Structured tool-use telemetry (`tool_telemetry`) per call: tool name, args hash, latency, outcome.

```mermaid
sequenceDiagram
    autonumber
    actor U as Operator
    participant UI as PanelinChatPanel
    participant API as Express<br/>POST /api/agent/chat (SSE)
    participant PG as Postgres<br/>conv_turns · conv_checkpoints · tool_telemetry
    participant AIGW as Vercel AI Gateway (primary)
    participant SDK as SDK fallback chain<br/>Claude→Grok→Gemini→OpenAI
    participant Tools as agentTools
    participant LB as Calc loopback

    U->>UI: send message
    UI->>API: POST {message, conversationId, calcState}
    API->>PG: SELECT recent turns + latest checkpoint
    PG-->>API: history + summary
    API->>API: KB + RAG + buildSystemPrompt
    alt AIGW healthy
        API->>AIGW: routed call (Claude default)
    else AIGW unavailable
        API->>SDK: fallback chain (legacy behavior)
    end
    loop streaming
        AIGW-->>API: text_delta
        API-->>UI: event {type:"text"}
    end
    AIGW-->>API: tool_use (calcular_cotizacion)
    API->>Tools: executeTool
    Tools->>LB: POST /calc/cotizar
    LB-->>Tools: result
    Tools-->>API: summarized result
    API->>PG: INSERT tool_telemetry<br/>(tool, args_hash, latency_ms, outcome)
    API->>AIGW: feed tool result
    loop more streaming
        AIGW-->>API: text_delta
    end
    AIGW-->>API: stop
    API-->>UI: event {type:"done"}
    API->>PG: INSERT conv_turn (user + assistant)
    alt turn_count % N == 0
        API->>API: summarize last N turns
        API->>PG: INSERT conv_checkpoint
    end
```

### 4.3 WA inbound → 5-min flush → CRM / autolearn

**Actual.** Two intertwined paths sharing state — the in-memory `waConversations` Map and Postgres `wa_messages` / `wa_conversations` tables. The webhook handler is idempotent (`ON CONFLICT msg_id DO NOTHING`) and responds 200 *before* processing (Meta requires <20s). Every 60s a ticker scans for conversations idle ≥5 min and fires `processWaConversation` once (fire-and-forget). Both the AI parse (CRM extraction) and the autolearn extractor run as separate fire-and-forget chains off the critical path. HMAC verification is configurable; if `WHATSAPP_APP_SECRET` is unset, it's skipped with a warn (except in `appEnv==="test"`).

#### (a) Inbound webhook

```mermaid
sequenceDiagram
    autonumber
    participant Meta as Meta<br/>WhatsApp Cloud API
    participant API as Express<br/>POST /webhooks/whatsapp
    participant Sig as whatsappSignature
    participant Map as waConversations<br/>(in-memory Map)
    participant PG as Postgres<br/>wa_messages + wa_conversations

    Meta->>API: POST webhook (raw body)<br/>index.js:751
    API->>Sig: verify HMAC sha256
    alt invalid signature
        Sig--xAPI: ok:false → 401
    else no app secret (skipped, warn)
        Sig-->>API: ok:true skipped
    else verified
        Sig-->>API: ok:true
    end
    API-->>Meta: 200 OK (before processing)<br/>index.js:773
    par statuses fan-out
        loop each status
            API->>PG: UPDATE wa_messages SET status WHERE rank(old)<rank(new)<br/>index.js:802
        end
    and messages fan-out
        loop each text msg
            API->>Map: set/update {chatId, messages[], lastUpdate}<br/>index.js:841
            API->>PG: INSERT wa_conversations ON CONFLICT UPDATE
            API->>PG: INSERT wa_messages ON CONFLICT (msg_id) DO NOTHING<br/>idempotent on retries
            API->>PG: UPDATE last_msg_in_at
            alt text contains 🚀
                API->>API: processWaConversation (rocket bypass)<br/>index.js:895
            end
        end
    end
```

#### (b) 5-min inactivity flush → CRM + autolearn

```mermaid
sequenceDiagram
    autonumber
    participant Tick as setInterval(60s)<br/>index.js:741
    participant Map as waConversations
    participant Proc as processWaConversation
    participant Parse as /api/crm/parse-conversation<br/>(loopback)
    participant AI as AI gateway / providers
    participant Sheets as Google Sheets
    participant Core as callAgentOnce<br/>(channel:"wa")
    participant KB as autoLearnExtractor → KB

    Tick->>Map: scan entries
    alt now-lastUpdate ≥ 5min AND messages>0
        Tick->>Proc: processWaConversation (fire-and-forget)
        Proc->>Parse: POST {dialogo}<br/>index.js:605
        Parse->>AI: provider chain (OpenAI → Claude)
        AI-->>Parse: parsed.data
        Parse-->>Proc: {cliente, telefono, resumen_pedido, urgencia, ...}
        Proc->>Sheets: append 'Form responses 1' A:P<br/>index.js:635
        Proc->>Sheets: write CRM_Operativo B:K · R:T · V:W<br/>index.js:658-679
        Proc->>Core: callAgentOnce(waMessages, channel:"wa")
        Core-->>Proc: {text, provider}
        Proc->>Sheets: write CRM_Operativo!AF:AG (respuesta + provider)
        Note over Proc,KB: setImmediate fire-and-forget
        Proc->>KB: extractLearnablePairs (Claude haiku)<br/>filter conf ≥ 0.70 · dedup vs KB
        KB-->>Proc: pairs[]
        Proc->>KB: addTrainingEntry (status: active if conf≥0.92 else pending)
        Proc->>Sheets: write tail defaults AH:AK
        Proc->>Map: delete(chatId)
    end
```

**Wanted.** HMAC mandatory in prod (no skip-with-warn). Inactivity window configurable via `WA_INACTIVITY_MS` (default 180_000 = 3 min). The flush becomes an outbox-based pipeline: ticker enqueues to `wa_outbox_crm` instead of fire-and-forget; `waCrmOutboxWorker` claims rows with `FOR UPDATE SKIP LOCKED`, runs parse+CRM+AI+autolearn, deletes on success, retries with exponential backoff on failure. AI suggestion also written into `wa_messages` (`direction='out_suggested'`) so cockpit shows the full conversation.

```mermaid
sequenceDiagram
    autonumber
    participant Meta
    participant API as Express<br/>POST /webhooks/whatsapp
    participant Sig as whatsappSignature (mandatory)
    participant Map as waConversations
    participant PG as Postgres<br/>wa_* + wa_outbox_crm
    participant Worker as waCrmOutboxWorker (new)
    participant Parse as parse-conversation (loopback)
    participant Sheets
    participant Core as callAgentOnce (channel:"wa")
    participant KB

    Meta->>API: POST webhook (raw body)
    API->>Sig: verify HMAC sha256
    alt no secret OR invalid (no skip path in prod)
        Sig--xAPI: reject
        API-->>Meta: 401
    else verified
        Sig-->>API: ok
    end
    API-->>Meta: 200 OK
    par
        API->>PG: UPDATE wa_messages status (existing)
    and
        API->>Map: update conv
        API->>PG: INSERT wa_messages (direction='in')
    end
    Note over Map: ticker @ WA_INACTIVITY_MS (default 180_000)<br/>scans for idle ≥ window
    Map->>PG: INSERT wa_outbox_crm (chatId, dialogo, attempt=0)
    Map->>Map: delete(chatId)
    Worker->>PG: SELECT FOR UPDATE SKIP LOCKED (up to 20)
    Worker->>Parse: POST {dialogo}
    Parse-->>Worker: parsed.data
    Worker->>Sheets: write Form responses 1 + CRM_Operativo
    Worker->>Core: callAgentOnce(channel:"wa")
    Core-->>Worker: {text, provider}
    Worker->>Sheets: write CRM_Operativo!AF:AG
    Worker->>PG: INSERT wa_messages (direction='out_suggested', text)
    Worker->>KB: extractLearnablePairs → addTrainingEntry
    alt success
        Worker->>PG: DELETE wa_outbox_crm row
    else failure
        Worker->>PG: UPDATE attempt+=1, next_retry_at=now()+backoff(attempt)
        Note over Worker,PG: after max attempts (12) → status='failed'
    end
```

### 4.4 ML webhook → CRM sync → auto-answer

**Actual.** ML POSTs `/webhooks/ml` → **two security layers**: (1) HMAC signature verify via `verifyMLSignature` (`server/lib/mlSignature.js`) with 5-min replay window — skip-with-warn if `ML_CLIENT_SECRET` unset (shipped in PR #106 / commit `9685ef5`); (2) optional `WEBHOOK_VERIFY_TOKEN` defence-in-depth. Event recorded to a 250-entry ring buffer → server responds 200 immediately → fire-and-forget `syncUnansweredQuestions` pulls UNANSWERED questions from ML, enriches with nickname + item title/price, dedupes by Q-id against existing Sheet rows, then writes new rows to `CRM_Operativo` (cols B–AK including a templated suggestion in AF). If `autoMode.fullAuto === true` (`server/.ml-automode.json`), `autoAnswerPipeline` generates an AI answer per row via `callAgentOnce(channel:"ml")` (max 350 chars, no markdown, "Saludos BMC!" closer), POSTs it to ML `/answers`, and stamps `enviadoEl` in AJ.

```mermaid
sequenceDiagram
    autonumber
    participant ML as MercadoLibre
    participant API as Express<br/>POST /webhooks/ml
    participant Sig as mlSignature<br/>(PR #106)
    participant Sync as ml-crm-sync<br/>syncUnansweredQuestions
    participant MLApi as ML REST API
    participant Sheets as Google Sheets<br/>CRM_Operativo
    participant Auto as mlAutoAnswer<br/>autoAnswerPipeline
    participant Core as agentCore<br/>callAgentOnce (channel:"ml")

    ML->>API: POST webhook (topic, body)<br/>index.js:473
    API->>Sig: verifyMLSignature(clientSecret, x-signature,<br/>dataId, x-request-id)<br/>index.js:476-485
    alt invalid HMAC (and secret set)
        Sig--xAPI: ok:false → 401
    else ML_CLIENT_SECRET unset (skipped, warn)
        Sig-->>API: ok:true skipped
    else verified
        Sig-->>API: ok:true
    end
    alt WEBHOOK_VERIFY_TOKEN mismatch
        API--xML: 401 reject
    end
    API->>API: log to ring buffer (max 250)<br/>index.js:512
    API-->>ML: 200 OK (before processing)<br/>index.js:573
    alt topic == "questions"
        API->>Sync: syncUnansweredQuestions (fire-and-forget)
        Sync->>MLApi: GET /users/me + /questions/search (UNANSWERED, limit 50)
        loop each question
            Sync->>MLApi: GET /users/{uid} + /items/{item_id}
        end
        Sync->>Sheets: read Observaciones, dedup by Q-id regex
        loop each new question
            Sync->>Sheets: write CRM_Operativo B-AK (Canal=ML, Categoría, Estado, AF=template suggestion)
        end
        alt autoMode.fullAuto == true
            API->>Auto: autoAnswerPipeline(rows)
            loop each row
                Auto->>Core: callAgentOnce(consulta, channel:"ml")<br/>(max 350 chars · no markdown · Saludos BMC!)
                Core-->>Auto: {text, provider}
                Auto->>Sheets: write CRM_Operativo!AF (respuestaSugerida)
                Auto->>MLApi: POST /answers {question_id, text}<br/>(Bearer access_token)
                Auto->>Sheets: stamp AJ (enviadoEl)
            end
        else autoMode off
            Note over API,Sheets: rows queued for manual reply<br/>(/hub/ml or /hub/canales)
        end
    else topic == "orders"
        Note over API: ring buffer only · no downstream processing
    end
```

**Wanted.** _HMAC enforcement already shipped in PR #106 / `9685ef5` — removed from this list._ Three remaining deltas: (1) Orders topic processed by a new `ml-orders-sync` handler (CRM row + optional Transportista trip creation); (2) Auto-mode flag persisted in Postgres (`ml_auto_mode` row per seller) instead of local JSON file; (3) Answer posting goes through an outbox worker (`mlAnswerOutboxWorker`) with exponential backoff and dead-letter on max attempts. The "no skip path in prod" toggle (refuse-start if `ML_CLIENT_SECRET` unset) is optional hardening on top.

```mermaid
sequenceDiagram
    autonumber
    participant ML
    participant API as Express<br/>POST /webhooks/ml
    participant Sig as mlSignature (enforced)
    participant PG as Postgres<br/>ml_outbox_answers · ml_auto_mode
    participant Sync as ml-crm-sync
    participant Orders as ml-orders-sync (new)
    participant MLApi
    participant Sheets
    participant Worker as mlAnswerOutboxWorker (new)
    participant Core as callAgentOnce (channel:"ml")

    ML->>API: POST webhook
    API->>Sig: HMAC verify (mandatory)
    alt invalid signature
        Sig--xAPI: reject
        API-->>ML: 401
    end
    API-->>ML: 200 OK
    alt topic == "questions"
        API->>Sync: syncUnansweredQuestions
        Sync->>Sheets: write CRM rows
        API->>PG: SELECT ml_auto_mode WHERE seller_id=X
        alt fullAuto == true
            API->>PG: INSERT ml_outbox_answers (rows)
        end
    else topic == "orders"
        API->>Orders: handleOrder(orderId)
        Orders->>MLApi: GET /orders/{id}
        Orders->>Sheets: write fulfillment row
        Orders->>PG: optional Transportista trip creation
    end
    Worker->>PG: SELECT FOR UPDATE SKIP LOCKED outbox (attempt<6, next_retry_at<=now)
    Worker->>Core: callAgentOnce(channel:"ml")
    Core-->>Worker: {text, provider}
    Worker->>Sheets: write CRM_Operativo!AF
    Worker->>MLApi: POST /answers
    alt success
        Worker->>Sheets: stamp AJ
        Worker->>PG: DELETE outbox row
    else failure
        Worker->>PG: UPDATE attempt+=1, next_retry_at=now()+backoff(attempt)
        Note over Worker,PG: after max attempts → status='failed' (dead-letter)
    end
```

---

## Appendix A — Full flow catalog (28)

Numbered to match the inventory; critical paths are bold.

1. **User opens calculator and produces a quote** — SPA → `POST /calc/cotizar` → `calculations.js` → JSON totals.
2. **User exports quote as PDF** — UI → `POST /api/pdf/generate` → Playwright/Chromium → binary PDF.
3. **User shares quote on WhatsApp** — client-side WA deep link via `helpers.js`; no backend round-trip.
4. **Signed-in user exports a saved quote** — `/mi-espacio` → `GET /api/me/quotes/:id/export.{json,csv,pdf,html}` (requires user JWT).
5. Admin bulk export of quotes — admin UI → `POST /api/admin/export` (role=admin).
6. **Operator chats with Panelin agent** — `/hub/agent-admin` → SSE `POST /api/agent/chat` → tool loop → calc loopback → streamed response.
7. Operator runs a one-shot agent tool — UI → `POST /api/agent/exec-tool`.
8. **SuperAgent single-call quote for external AI** — external POST → `/api/agent/superagent` → calc loopback → return.
9. MercadoLibre OAuth onboarding — `GET /auth/ml/start` → ML → `GET /auth/ml/callback` → token storage.
10. **ML webhook → CRM sync → auto-answer** — `POST /webhooks/ml` → HMAC verify → `syncUnansweredQuestions` → if `autoMode.fullAuto`, `autoAnswerPipeline`.
11. **ML order arrives via webhook** — `POST /webhooks/ml` topic=orders → in-memory ring → downstream sync via `panelsim-ml-crm-sync.js`.
12. **WhatsApp inbound message** — Meta `POST /webhooks/whatsapp` → HMAC verify → `wa_messages` + in-memory map → status updates.
13. **WA conversation auto-flush after 5 min inactivity** — `setInterval` 60s → `processWaConversation` → AI parse → Sheets `Form responses 1` + `CRM_Operativo` + suggested reply (col AF) → autolearn → KB.
14. **Operator sends WA outbound from cockpit** — `/hub/wa` → `POST /api/wa/...` → 24h window + cap enforcement → Meta API.
15. WA enricher background suggestions — `waEnricherWorker` polls → intent + suggestion + (if quote params) `runWaQuote` → `wa_suggestions`.
16. WA SLA breach detection — `waSlaWorker` → `wa_sla_breaches`.
17. **Transportista trip → driver gets WA push** — admin creates trip → outbox row → `transportistaOutboxWorker` → Meta → driver PWA at `/conductor`.
18. **Shopify webhook** — `POST /webhooks/shopify` (raw body for HMAC) → `routes/shopify.js`.
19. Shopify product catalog read — `/hub/canales` → `GET /api/shopify/products`.
20. ML competitor search — agent/UI → `routes/mlSearch.js` (Bearer, 30-min cache, 60 req/min).
21. Price-monitor ETL trigger — operator → `routes/mlEtlRun.js` POST → spawns `scripts/price-monitor-etl.mjs`.
22. **Finanzas dashboard read** — `/finanzas` static UI → `routes/bmcDashboard.js` GETs → Sheets. 503 on Sheets unavailable, 200+empty on no-data, never 500.
23. **CRM suggest-reply & parse-email** — `POST /api/crm/suggest-response` or `/api/crm/parse-email` → AI fallback chain Grok→Claude→OpenAI→Gemini.
24. Follow-up tracker CRUD — `/hub/admin` → `routes/followups.js`.
25. PDF plant-2D preview — `/inspector`, `/fichas` → `routes/pdf.js` server-rendered Chromium → PDF.
26. Daily prod smoke — GitHub Actions cron `0 8,20 * * *` → `smoke-prod-api.mjs`.
27. Daily knowledge antenna ingest — GitHub Actions cron `20 10 * * *` → `knowledge-antenna-run.mjs`.
28. CI gate on push/PR — `ci.yml` → validate + lint + build + channels + voice + antenna; gates both `workflow_run` deploys.
