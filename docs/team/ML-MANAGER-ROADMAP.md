# ML Manager Dashboard — Implementation Roadmap

**Status:** Ready to implement. Design approved, master prompt at `~/goal-prompt-ml-manager-dashboard-wired.md`.  
**Visual mockup:** `~/.claude/jobs/52f8f1ba/tmp/ml-dashboard-mockup.html`  
**Plan detail:** `~/.claude/plans/if-you-have-purring-ullman.md`

---

## What gets built

A 6-tab account management dashboard at `/hub/ml-manager` inside the BMC Hub, wired to a new Cloud Run deployment of the MercadoLibre connector backend.

---

## Implementation order & file map

### Step 1 — Env vars (calculadora-bmc)

```
~/calculadora-bmc/.env              ← add VITE_ML_CONNECTOR_URL + VITE_ML_CONNECTOR_API_KEY
~/calculadora-bmc/.env.example      ← document the two vars
```

Also add to Doppler `bmc-frontend/prd`:
```bash
printf '%s' 'https://panelin-ml-connector-HASH.run.app' | doppler secrets set VITE_ML_CONNECTOR_URL --project bmc-frontend --config prd
printf '%s' '<random-32-char-key>' | doppler secrets set VITE_ML_CONNECTOR_API_KEY --project bmc-frontend --config prd
```

---

### Step 2 — Fetch helper

```
~/calculadora-bmc/src/components/hub/ml/utils/mlFetch.js
```
Reads `import.meta.env.VITE_ML_CONNECTOR_URL` + `VITE_ML_CONNECTOR_API_KEY`.  
Mirrors the `apiFetch` pattern in `src/components/hub/clientes/hooks/useClientes.js`.

---

### Step 3 — TanStack Query hooks

```
~/calculadora-bmc/src/components/hub/ml/hooks/useMlConnector.js
```

Exports (all use `useQuery` / `useMutation` from `@tanstack/react-query`):

| Hook | Endpoint |
|---|---|
| `useConnectorStatus()` | `GET /auth/ml/status` |
| `useListings(params)` | `GET /ml/listings` |
| `useListingVisits(id)` | `GET /ml/listings/:id/visits` |
| `useUnreadMessages()` | `GET /ml/messages/unread` |
| `useMessagePack(packId)` | `GET /ml/messages/packs/:packId` |
| `useCampaigns()` | `GET /ml/ads/campaigns` |
| `useCampaignAds(id)` | `GET /ml/ads/campaigns/:id/ads` |
| `useAdReports()` | `GET /ml/ads/reports/summary` |
| `useReputation()` | `GET /ml/analytics/reputation` |
| `useSales(params)` | `GET /ml/analytics/sales` |
| `useItemQuality()` | `GET /ml/analytics/items/quality` |
| `useDailyBrief()` | `GET /ai/daily-brief` |
| `useUpdateListingStatus()` | `PATCH /ml/listings/:id/status` |
| `useReplyToMessage()` | `POST /ml/messages/packs/:packId/reply` |
| `useUpdateCampaign()` | `PUT /ml/ads/campaigns/:id` |

---

### Step 4 — Module root

```
~/calculadora-bmc/src/components/hub/ml/MlManagerModule.jsx
```

- Root `<div className="adminCot" data-skin={skin}>` (import `SkinProvider` + `../admin-cotizaciones/styles.css`)
- Breadcrumb topbar: `Hub › ML Manager`
- OAuth status badge (green/red from `useConnectorStatus()`)
- Horizontal tab strip: Resumen / Publicaciones / Mensajes / Publicidad / Envíos / Analítica
- `<Suspense>` boundary per tab panel

---

### Step 5 — Tab components (create in order)

```
~/calculadora-bmc/src/components/hub/ml/tabs/OverviewTab.jsx
~/calculadora-bmc/src/components/hub/ml/tabs/ListingsTab.jsx
~/calculadora-bmc/src/components/hub/ml/tabs/MessagesTab.jsx
~/calculadora-bmc/src/components/hub/ml/tabs/AdsTab.jsx
~/calculadora-bmc/src/components/hub/ml/tabs/ShipmentsTab.jsx
~/calculadora-bmc/src/components/hub/ml/tabs/AnalyticsTab.jsx
```

**OverviewTab:** KPI stat strip (6 cards) + AI daily brief card + quick-action buttons  
**ListingsTab:** Toolbar + paginated table + quality bar + pause/activate + "Auditar IA" slide-in  
**MessagesTab:** Split-pane (thread list left, conversation right) + AI reply suggestion flow  
**AdsTab:** Spend KPIs + campaign table + ACOS coloring + "Optimizar IA" drawer; graceful degradation if endpoint 404  
**ShipmentsTab:** Orders table + expandable tracking timeline  
**AnalyticsTab:** Reputation ring + sales list + quality bar chart + per-listing AI audit button  

Visual spec for all tabs: see approved mockup at `~/.claude/jobs/52f8f1ba/tmp/ml-dashboard-mockup.html`

---

### Step 6 — Wire into App.jsx

```
~/calculadora-bmc/src/App.jsx
```

Add one lazy import near the other hub modules:
```js
const MlManagerModule = React.lazy(() => import("./components/hub/ml/MlManagerModule.jsx"));
```

Add one route near `/hub/ml`:
```jsx
<Route path="/hub/ml-manager" element={
  <RequireGrant module="canales" minLevel="read">
    <MlManagerModule />
  </RequireGrant>
} />
```

---

### Step 7 — Hub landing card

```
~/calculadora-bmc/src/components/BmcWolfboardHub.jsx
```

Add one card tile alongside the existing "ML Operativo" card.  
Style: same card pattern, blue accent `#0071e3`, link to `/hub/ml-manager`.

---

### Step 8 — Improve AI prompts (connector)

```
~/mercadolibre-connector/src/ai/prompts.js   (branch: claude/determined-brown-lvvrda)
```

Improvements per prompt:
- `ANSWER_QUESTION` → add 2 few-shot examples (question + ideal answer pairs in Spanish)
- `AD_OPTIMIZATION` → add structured JSON schema: `{ actions: [{ type, target, value, reason }] }`
- `LISTING_QUALITY` → add scoring rubric (title: /10, images: /10, attributes: /10, description: /10)
- `DAILY_BRIEF` → inject seller name and country in system prompt for localized advice

---

### Step 9 — Dockerfile (connector)

```
~/mercadolibre-connector/Dockerfile   (new file, branch: claude/determined-brown-lvvrda)
```

```dockerfile
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "src/index.js"]
```

---

### Step 10 — Deploy connector to Cloud Run

```bash
cd ~/mercadolibre-connector
git checkout claude/determined-brown-lvvrda

gcloud run deploy panelin-ml-connector \
  --source . \
  --project chatbot-bmc-live \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,ML_CLIENT_ID=742811153438318" \
  --set-secrets "ML_CLIENT_SECRET=ML_CLIENT_SECRET:latest,TOKEN_ENCRYPTION_KEY=TOKEN_ENCRYPTION_KEY:latest,ANTHROPIC_API_KEY=API_KEY_ANTHROPIC:latest,CONNECTOR_API_KEY=ML_CONNECTOR_API_KEY:latest"
```

Then update `VITE_ML_CONNECTOR_URL` in Doppler + Vercel with the resulting `*.run.app` URL.

---

## Key constraints to remember

- All Claude calls go through connector `/ai/*` — never import `@anthropic-ai/sdk` in React
- `CONNECTOR_API_KEY` must be non-empty in production (empty = auth bypass in dev mode)
- Use `printf '%s'` not `echo` when setting secrets via CLI (trailing newline gotcha)
- Publicidad tab must degrade gracefully if ads API returns 404/403 (Uruguay availability unconfirmed)
- AI actions always require operator confirmation before sending to MercadoLibre

---

## Phase 2 — WhatsApp Inbox Integration

**Status:** Ready to implement after wacrm fork decision. Security fixes (F8/F4/F18) must be completed first.

### Step 1 — Fork wacrm Inbox module
- Clone https://github.com/ArnasDon/wacrm into ~/wacrm-fork
- Copy src/app/inbox/* and src/components/inbox/* → ~/calculadora-bmc/src/components/hub/wa-inbox/
- Apply the 3 critical security fixes (CSP, RLS, SSRF) per WACRM-FORK-DECISION.md

### Step 2 — Supabase project setup
- Provision Supabase project (or use existing if embedding in BMC stack)
- Load Meta WhatsApp Cloud API credentials to Secret Manager / Doppler bmc-backend/prd
- Set env vars: SUPABASE_URL, SUPABASE_ANON_KEY, WHATSAPP_BUSINESS_ACCOUNT_ID, WHATSAPP_API_TOKEN

### Step 3 — Unified schema bootstrap
- Run omni-hub-schema.sql against PostgreSQL (BMC's existing db or new Supabase database)
- Create tables: omni_contacts, omni_conversations, omni_messages, omni_deals

### Step 4 — Wire webhook receiver
- Create ~/calculadora-bmc/server/routes/wa-unified.js
- POST /api/wa/unified-ingest — receives messages from either:
  - Meta Cloud API webhooks (native WA Business messages)
  - omnicrm-sync webhook (captured WA Business interactions)
- Validate HMAC-SHA256 per Meta spec + X-Api-Key for omnicrm-sync
- Insert into omni_conversations + omni_messages

---

## Phase 3 — Unified Contact Graph + IP-4 Wiring

**Status:** Dependent on Phase 2 schema. No backend blockers.

### Step 1 — Deduplication service
- Create ~/calculadora-bmc/server/lib/contactDedup.js
- Logic: when a new contact arrives (from ML, WA, omnicrm-sync), match against omni_contacts by:
  - ml_user_id (if ML origin)
  - wa_phone (if WA origin)
  - email (fallback fuzzy match)
- Upsert or link to existing contact

### Step 2 — IP-4 Wiring (zero-code win)
- Configure omnicrm-sync chrome extension to POST to BMC endpoint:
  - Target: https://calculadora-bmc.vercel.app/api/unified-crm-ingest
  - Auth: X-Api-Key header (use connector API key or new BMC key)
  - CRM type: webhook (already implemented in crm-connector.js)
  - No code change needed on BMC side!

### Step 3 — Unified dashboard shell
- CanalesModule.jsx at /hub/canales (see Phase 1 Step 6 for structure)
- Tabs: ML Manager | WA Inbox | Unified Contacts
- Each tab queries omni_* tables for cross-channel view
