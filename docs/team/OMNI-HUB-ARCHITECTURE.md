# Omni-Hub Architecture — Unified Cross-Channel CRM & Orchestration

**Status:** Design frozen. Implementation roadmap in ML-MANAGER-ROADMAP.md.  
**Last updated:** 2026-06-21  
**Scope:** 4-phase rollout (Phase 1 ML Manager live; Phase 2-4 pending).

---

## 1. System Overview — 4-Layer Topology

```
Layer 1: Capture        ┌─ omnicrm-sync Chrome extension (WA/ML/FB/IG)
                        ├─ MercadoLibre OAuth webhook
                        ├─ WhatsApp Cloud API webhook
                        └─ Shopify Admin webhook

                              ↓ [events, API calls]

Layer 2: Backends        ┌─ mercadolibre-connector (Cloud Run service)
                        ├─ wacrm-fork (Supabase or standalone Cloud Run)
                        └─ (future: instagram-connector, facebook-connector)

                              ↓ [unified contact model, normalized events]

Layer 3: Aggregator      └─ calculadora-bmc Express API
                           ├─ omni_contacts, omni_conversations, omni_messages
                           ├─ /api/unified-crm-ingest (webhook receiver)
                           └─ /api/omni/* (contact/conversation/deal queries)

                              ↓ [REST + SSE]

Layer 4: Frontend        └─ React Hub
                           ├─ /hub/ml-manager (Phase 1)
                           ├─ /hub/wa-inbox (Phase 2)
                           └─ /hub/canales (Phase 3, unified view)
```

**Data flow example:**
1. Customer sends WhatsApp message → Cloud API webhook → `POST /api/wa/unified-ingest`
2. Backend normalizes to omni_messages + omni_conversations
3. AI classifier tags message `body_ai_category='order'`
4. Frontend queries `GET /api/omni/conversations?status=open` → inbox updates
5. Agent replies via Inbox UI → `PATCH /api/omni/conversations/:id/reply` → enqueued to WA

---

## 2. Data Model — SQL Definitions

### omni_contacts: Unified contact repository

```sql
CREATE TABLE omni_contacts (
  id UUID PRIMARY KEY,                  -- distributed ID
  integration_uuid VARCHAR(255) UNIQUE, -- global unique ID (canonical)
  ml_user_id BIGINT UNIQUE,            -- MercadoLibre user_id (sparse)
  wa_phone VARCHAR(20) UNIQUE,         -- E.164 format (sparse)
  chrome_ext_contact_id VARCHAR(255) UNIQUE, -- omnicrm-sync ID (sparse)
  
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  avatar_url VARCHAR(1024),
  properties JSONB,                    -- { "ml": {...}, "wa": {...} }
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Indexes on cross-channel IDs for O(1) deduplication
CREATE UNIQUE INDEX omni_contacts_ml_user_id ON omni_contacts(ml_user_id) WHERE ml_user_id IS NOT NULL;
CREATE UNIQUE INDEX omni_contacts_wa_phone ON omni_contacts(wa_phone) WHERE wa_phone IS NOT NULL;
```

### omni_conversations: Channel-specific threads

```sql
CREATE TABLE omni_conversations (
  id UUID PRIMARY KEY,
  contact_id UUID REFERENCES omni_contacts(id),
  
  channel VARCHAR(50),                -- 'ml', 'wa', 'facebook', 'instagram'
  channel_conversation_id VARCHAR(255), -- native conversation ID
  
  subject VARCHAR(512),
  status VARCHAR(50) DEFAULT 'open',  -- 'open', 'resolved', 'archived'
  priority INTEGER DEFAULT 0,         -- 0 (low) to 3 (urgent)
  tags TEXT[] DEFAULT '{}'::TEXT[],   -- searchable tags
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE UNIQUE INDEX omni_conversations_unique_channel 
  ON omni_conversations(contact_id, channel, channel_conversation_id);
```

### omni_messages: Individual messages

```sql
CREATE TABLE omni_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES omni_conversations(id),
  
  sender VARCHAR(50),                 -- 'bot', 'customer', 'agent'
  sender_id VARCHAR(255),
  
  body TEXT NOT NULL,
  body_ai_category VARCHAR(100),      -- 'product', 'order', 'issue', 'complaint', etc.
  
  attachments JSONB DEFAULT '[]'::JSONB, -- [{ name, url, mime_type }, ...]
  metadata JSONB DEFAULT '{}'::JSONB,    -- channel-specific metadata
  
  read_at TIMESTAMP,
  created_at TIMESTAMP
);
```

### omni_deals: Cross-channel opportunities

```sql
CREATE TABLE omni_deals (
  id UUID PRIMARY KEY,
  contact_id UUID REFERENCES omni_contacts(id),
  
  title VARCHAR(512) NOT NULL,
  value_usd DECIMAL(12, 2),
  
  stage VARCHAR(50) DEFAULT 'lead',   -- 'lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'
  source_channel VARCHAR(50),         -- which channel originated the deal
  source_conversation_id UUID REFERENCES omni_conversations(id),
  
  owner_agent_id VARCHAR(255),        -- assigned to agent
  expected_close_date DATE,
  closed_at TIMESTAMP,
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

[Full schema with triggers, views, and audit table in `omni-hub-schema.sql`]

---

## 3. Auth Bridge — Token Unification

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React)                                               │
│  ├─ localStorage: bmc_jwt (issued by /auth/google or /auth/mfa)│
│  └─ request headers: Authorization: Bearer <bmc_jwt>            │
└─────────────────────┬───────────────────────────────────────────┘
                      │ POST /api/omni/conversations?search=...
                      ↓
┌─────────────────────────────────────────────────────────────────┐
│  calculadora-bmc API (Express)                                  │
│  ├─ middlewware/requireAuth.js: validates bmc_jwt via JWT.verify│
│  ├─ extracts user_id, module grants from token payload          │
│  └─ gate-keeps access to /api/omni/* routes                     │
└──┬──────────────────────────────────────────────────┬───────────┘
   │ (internal call to wacrm or connector)            │
   │ Authorization: Bearer <service_account_token>    │
   │                                                   │
   ↓                                                   ↓
┌──────────────────┐                           ┌──────────────────┐
│ wacrm-fork       │                           │ ml-connector     │
│                  │                           │                  │
│ POST /conversations │ (with Supabase         │ POST /messages   │
│ ├─ X-Api-Key     │  anon_key if Supabase)   │ ├─ X-Api-Key     │
│ └─ validate RLS  │                           │ └─ verify sig    │
│    via Supabase  │                           │                  │
└──────────────────┘                           └──────────────────┘
```

**[INFERRED]** Token flow:
1. User logs in via Google OAuth → `/auth/google/callback` → issues `bmc_jwt`
2. Frontend stores JWT in localStorage, includes in all API calls
3. BMC API validates JWT, extracts `user_id` + grants
4. BMC → connector/wacrm calls use internal bearer token (service account secret)
5. Each backend validates its own token (no shared JWT secret)

---

## 4. Service Topology — Deployment Targets

| Service | Location | Auth | Scope |
|---------|----------|------|-------|
| **mercadolibre-connector** | Cloud Run `panelin-ml-connector` us-central1 | `CONNECTOR_API_KEY` header (X-Api-Key) | ML OAuth, listings, messages, ads, analytics |
| **wacrm-fork** | Supabase project OR Cloud Run (TBD) | Supabase `anon_key` + RLS OR bearer token | WhatsApp Inbox, Messenger, Instagram |
| **calculadora-bmc (aggregator)** | Vercel frontend + Cloud Run `panelin-calc` backend | `bmc_jwt` + `API_AUTH_TOKEN` for ops endpoints | Unified CRM ingest, contact dedup, conversation query/reply |
| **omnicrm-sync** | Chrome Web Store extension | User browser automation | WA/ML/FB/IG capture → webhook POST to BMC aggregator |

**URLs:**
- Frontend: `https://calculadora-bmc.vercel.app/hub/ml-manager`, `/hub/wa-inbox`, `/hub/canales`
- Connector: `https://panelin-ml-connector-HASH.run.app` (env var `VITE_ML_CONNECTOR_URL`)
- API: `https://panelin-calc.us-central1.run.app/api/*` (Cloud Run backend)

---

## 5. Phased Roadmap — 4 Phases

### Phase 1: ML Manager Dashboard (IN PROGRESS)
- **Status:** Design approved, implementation started
- **Deliverable:** `/hub/ml-manager` with 6 tabs (Overview, Listings, Messages, Ads, Shipments, Analytics)
- **Milestone:** ML listings + message inbox live at `/hub/ml-manager` by EOW
- **Scope:** mercadolibre-connector deployed to Cloud Run; React hooks + TanStack Query wired; no Supabase required yet
- **Files:** Step 1-10 in ML-MANAGER-ROADMAP.md

### Phase 2: WhatsApp Inbox Integration
- **Status:** Dependent on wacrm fork security audit (F8/F4/F18)
- **Deliverable:** `/hub/wa-inbox` with unified inbox UI + reply flow
- **Milestone:** WA messages + conversations persisted in omni_* tables; inbox UI fetches from `GET /api/omni/conversations?channel=wa`
- **Scope:** Supabase setup + omni-hub-schema.sql applied; WA webhook receiver at `/api/wa/unified-ingest`; agent reply flow gated by `requireGrant` module='canales'
- **Blocker:** Supabase RLS policy audit (F8), CORS/CSP hardening (F4), SSRF on webhook (F18)

### Phase 3: Unified Contact Graph + IP-4 Wiring
- **Status:** Blocked by Phase 2 schema
- **Deliverable:** `/hub/canales` as unified dashboard (ML + WA side-by-side); IP-4 (omnicrm-sync webhook) wired
- **Milestone:** Contact dedup service live; omnicrm-sync → BMC `/api/unified-crm-ingest` webhook flow tested
- **Scope:** `contactDedup.js` service; cross-channel contact linking; omnicrm-sync extension config updated
- **Effort:** ~3 days backend + 2 days frontend

### Phase 4: Cross-Channel Pipeline & Kanban
- **Status:** Future (post-Phase 3)
- **Deliverable:** `/hub/canales/kanban` with deals across channels; AI-driven next-action suggestions
- **Scope:** omni_deals table queries; stage automation; AI agent integration for proposal generation

---

## 6. Integration Points — The 5 Gaps

**[CONFIRMED]** Five architectural gaps from the unified CRM plan:

### IP-1: omnicrm-sync ML routing
**Gap:** omnicrm-sync Chrome extension captures ML interactions but doesn't route through ML connector (loss of encryption, retry SLA, API consistency).  
**Fix:** Add `connectorMode` flag to omnicrm-sync config. When ON:
- ML API calls redirect to connector `/ml/api-proxy`
- Connector decrypts token, calls native ML API, re-encrypts response
- omnicrm-sync stores encrypted response locally

### IP-2: ML classification unification
**Gap:** omnicrm-sync has its own ML classifier (on-device); connector has another (Claude-powered). Inconsistent categorization.  
**Fix:** Unified taxonomy in `server/lib/messageClassifier.js`. Both omnicrm-sync and connector delegate to a shared model or API endpoint.

### IP-3: AI invocation unification
**Gap:** Connector `/ai/suggest-response` uses Claude directly; BMC `/api/agent/chat` uses separate agentCore. Different system prompts, tool definitions, training.  
**Fix:** Connector delegates to BMC agentCore via HTTP `POST /api/internal/ai/suggest` (internal endpoint). Single source of truth for AI behavior.

### IP-4: omnicrm-sync webhook reception
**Gap:** NONE — already wired. omnicrm-sync can POST to BMC `/api/unified-crm-ingest` with proper HMAC validation.  
**Status:** Zero-code win. Needs config (target URL + API key) in extension settings, no backend code change.

### IP-5: ML message API routing
**Gap:** omnicrm-sync makes direct API calls to MercadoLibre (no encryption, token visible in memory).  
**Fix:** Route through connector `/ml/api-proxy` with token encryption + retry logic.

---

## 7. Security & Compliance

**Endpoint auth:**
- All `/api/omni/*` endpoints require `bmc_jwt` (validated via `requireAuth` middleware)
- Webhook endpoints (`/api/wa/unified-ingest`, `/api/unified-crm-ingest`) use HMAC-SHA256 signature validation
- Internal calls between services use bearer token (stored in Secret Manager, rotated quarterly)

**Access control:**
- Contact/conversation read: require `module='canales' + level='read'`
- Message reply/status update: require `module='canales' + level='write'`
- Deal close/assignment: require `module='canales' + level='admin'`
- Implemented via `server/middleware/requireGrant.js`

**Webhook security (F8/F4/F18):**
- HMAC-SHA256 signature on all inbound webhooks (ML, WA, omnicrm-sync)
- Whitelist of allowed webhook origins in `.env` (checked at handler entry)
- RLS enforcement at Supabase layer (if using Supabase for wacrm)
- URL validation on outbound automations (prevent SSRF)

---

## 8. Epistemic Tags

- **[CONFIRMED]** omni_contacts deduplication via cross-channel IDs (ml_user_id, wa_phone, chrome_ext_contact_id, integration_uuid)
- **[CONFIRMED]** Phase 1 (ML Manager) architecture and file structure per ML-MANAGER-ROADMAP.md
- **[CONFIRMED]** omni-hub-schema.sql with 4 core tables + 3 helper views + audit log
- **[INFERRED]** Phase 2-4 depend on Supabase RLS audit completion (F8/F4/F18 security fixes)
- **[INFERRED]** Token unification via BMC `bmc_jwt` for all frontend calls; internal service-to-service auth via bearer tokens
- **[ASSUMPTION]** wacrm fork will be provisioned as new Supabase project (not embedded in BMC's existing db)
- **[ASSUMPTION]** omnicrm-sync webhook receiver requires no backend changes (already compatible with crm-connector.js pattern)

---

## References

- **ML Manager detail:** `docs/team/ML-MANAGER-ROADMAP.md` (10-step implementation guide)
- **Schema DDL:** `docs/team/omni-hub-schema.sql` (tables, triggers, views, constraints)
- **Project state:** `docs/team/PROJECT-STATE.md` (current blockers, recent changes)
- **Security audit:** `docs/team/SECURITY-HARDENING-REPORT-202604.md` (F8/F4/F18 context)
- **CRM hub spec:** `docs/team/WORKSPACE-CRM-HUB.html` (visual mockup)
