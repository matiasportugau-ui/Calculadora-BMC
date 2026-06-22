# Role

You are a senior React 18 / Vite 7 engineer implementing the MercadoLibre Manager dashboard inside an existing BMC hub application. You work autonomously, make no unnecessary pauses, and complete all steps before stopping.

---

# Context

The BMC Hub (`~/calculadora-bmc`) is a React 18 / Vite 7 SPA deployed to Vercel. It has an existing hub at `/hub` with modules for ML Operativo, WA, Clientes, Tareas, and others. You are adding a new module: **ML Manager** at `/hub/ml-manager` — a 6-tab MercadoLibre account management dashboard.

The visual design is **fully approved**. The approved mockup is at:
`~/.claude/jobs/52f8f1ba/tmp/ml-dashboard-mockup.html`
Open it in a browser to see the exact layout for all 6 tabs before writing any component.

The ML connector backend runs locally at `http://localhost:3001` during development (already built at `~/mercadolibre-connector`, branch `claude/determined-brown-lvvrda`). In production it will be a Cloud Run service (URL TBD — use the env var).

**Current state of the repo:**
- Branch: `main`, clean (0 uncommitted changes) [CONFIRMED]
- `src/components/hub/ml/` may be empty or non-existent — check before writing [CONFIRMED: ls shows partial state]
- No `VITE_ML_CONNECTOR_*` vars exist yet in `.env` or `.env.example` [CONFIRMED]
- No `/hub/ml-manager` route in `App.jsx` [CONFIRMED]

---

# Goal

Implement all frontend components for the ML Manager dashboard (Steps 1–7) in a single working session, ending with a passing `npm run gate:local` and one clean commit on a feature branch.

- Create `feat/ml-manager-dashboard` branch from `main`
- Add env vars to `.env` (local dev values) and `.env.example` (documented placeholders)
- Write `mlFetch.js` fetch helper reading connector URL + API key from Vite env
- Write `useMlConnector.js` with 12 query hooks + 3 mutation hooks (TanStack Query v5)
- Write `MlManagerModule.jsx` root component with `.adminCot` design system, breadcrumb, OAuth badge, 6-tab strip
- Write all 6 tab components matching the approved mockup exactly
- Register `/hub/ml-manager` route in `App.jsx` (lazy, RequireGrant)
- Add ML Manager card to `BmcWolfboardHub.jsx` hub landing grid
- Run `npm run gate:local`, fix any issues, commit as `feat(hub): add ML Manager dashboard`

---

# Scope

IN:
- `src/components/hub/ml/` — all new files (create directory tree if needed)
- `src/App.jsx` — one lazy import + one Route only
- `src/components/BmcWolfboardHub.jsx` — one card tile only
- `.env` — two new lines
- `.env.example` — two documented lines

OUT:
- Do NOT touch any existing routes, components, or hooks outside `hub/ml/`
- Do NOT modify `panelin-calc` backend or any `server/` files
- Do NOT add tests (project has none for frontend components)
- Do NOT run `npm audit fix` (forbidden in this repo — has broken Vite before)
- Do NOT touch `hub/ml` (the existing ML Operativo module at `/hub/ml`)

---

# Inputs

**Design reference (READ FIRST):**
- `~/.claude/jobs/52f8f1ba/tmp/ml-dashboard-mockup.html` — approved visual spec; open in browser, match it exactly

**Pattern files to copy from (read before writing new files):**
- `src/components/hub/clientes/hooks/useClientes.js` — canonical TanStack Query hook pattern
- `src/components/admin/users/UserAdminModule.jsx` — adminCot page layout pattern
- `src/components/admin-cotizaciones/styles.css` — CSS token reference (import this, don't duplicate)
- `src/components/admin-cotizaciones/StatStrip.jsx` — KPI strip pattern
- `src/components/admin-cotizaciones/QuotesTable.jsx` — table + pills + kebab pattern

**Connector API (all endpoints on `VITE_ML_CONNECTOR_URL`):**
```
GET  /auth/ml/status
GET  /ml/listings              ?limit=&offset=
GET  /ml/listings/:id/visits   ?last=7d
GET  /ml/messages/unread
GET  /ml/messages/packs/:packId
POST /ml/messages/packs/:packId/reply   body: { text }
GET  /ml/ads/campaigns
GET  /ml/ads/campaigns/:id/ads
GET  /ml/ads/reports/summary
GET  /ml/analytics/reputation
GET  /ml/analytics/sales       ?limit=&offset=
GET  /ml/analytics/items/quality
GET  /ai/daily-brief
PATCH /ml/listings/:id/status  body: { status: "active"|"paused"|"closed" }
PUT  /ml/ads/campaigns/:id     body: { budget?, status? }
POST /ai/answer-question       body: { questionId }
POST /ai/optimize-ads          body: { campaignId }
POST /ai/listing-quality/:id
```

All requests need header: `Authorization: Bearer <VITE_ML_CONNECTOR_API_KEY>`

---

# Tools & MCPs

- **Bash**: git operations, `npm run gate:local`, `openssl rand -hex 32` for key generation
- **Read / Edit / Write**: implement all files
- **Browser / screenshot**: open the mockup HTML to verify design before writing components
- Tools NOT needed: Vercel MCP, Doppler CLI, gcloud (those are for steps 8–10, out of scope here)

---

# Constraints & Guardrails

- DO create branch `feat/ml-manager-dashboard` before writing any file — never commit to `main` directly
- DO import `../admin-cotizaciones/styles.css` in `MlManagerModule.jsx` — do not write inline CSS that duplicates tokens
- DO use `useBmcAuth()` from `../../../../contexts/BmcAuthProvider.jsx` for auth context — NOT `useCockpitOperatorAuth`
- DO use TanStack Query v5 (`useQuery`/`useMutation` from `@tanstack/react-query`) — NOT manual `useState` + `useEffect` fetch
- DO handle the "no ML token" state gracefully in every tab — show an empty state with message, not an error or crash
- DO make all AI actions operator-confirmed before sending to MercadoLibre (show suggestion, user clicks Send)
- DO make the Publicidad tab degrade gracefully if `/ml/ads/*` returns 404/403 — show "Publicidad no disponible" empty state
- DO NOT import `@anthropic-ai/sdk` in any React component — all Claude calls go through the connector `/ai/*` endpoints
- DO NOT run `npm audit fix --force` — forbidden
- DO NOT modify `src/App.jsx` beyond adding one lazy import and one Route
- DO generate `CONNECTOR_API_KEY` with `openssl rand -hex 32` and put it in `.env` for local dev

---

# Anti-patterns

- DO NOT use `useCockpitOperatorAuth` — that is the legacy cockpit pattern for the ML Operativo module
- DO NOT duplicate CSS tokens from `admin-cotizaciones/styles.css` — import, don't copy
- DO NOT forget the `.adminCot` className and `data-skin` attribute on the module root div
- DO NOT call ML API endpoints directly from React components — all calls go through the TanStack Query hooks in `useMlConnector.js`
- DO NOT use `console.log` in production code paths
- DO NOT skip the `RequireGrant` wrapper on the route — the ML module must be gated

---

# File Deliverables

Create this exact directory tree (use `mkdir -p` first):

```
src/components/hub/ml/
├── utils/
│   └── mlFetch.js
├── hooks/
│   └── useMlConnector.js
├── tabs/
│   ├── OverviewTab.jsx
│   ├── ListingsTab.jsx
│   ├── MessagesTab.jsx
│   ├── AdsTab.jsx
│   ├── ShipmentsTab.jsx
│   └── AnalyticsTab.jsx
└── MlManagerModule.jsx
```

**mlFetch.js** — thin fetch helper:
```js
const BASE = import.meta.env.VITE_ML_CONNECTOR_URL ?? 'http://localhost:3001';
const KEY  = import.meta.env.VITE_ML_CONNECTOR_API_KEY ?? '';

export async function mlFetch(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const err = new Error(`ML connector ${res.status}`);
    err.status = res.status;
    try { err.payload = await res.json(); } catch {}
    throw err;
  }
  return res.json();
}
```

**useMlConnector.js** — export all hooks listed in the Goal section. Query keys follow `['ml', 'resource', params]` pattern. staleTime: 30_000, gcTime: 5 * 60_000. Disable queries when `VITE_ML_CONNECTOR_URL` is missing (show empty state, not error).

**MlManagerModule.jsx** — root wrapper with:
- `import '../admin-cotizaciones/styles.css'`
- `<div className="adminCot" data-skin="macos">`
- Breadcrumb: `Hub › ML Manager` (Hub links to `/hub`)
- OAuth status badge: green "Cuenta conectada" / red "Sin cuenta" based on `useConnectorStatus()`
- Tab strip: Resumen / Publicaciones / Mensajes (with unread badge from `useUnreadMessages()`) / Publicidad / Envíos / Analítica
- `useState` for active tab, `React.lazy` + `Suspense` for each tab panel

**Tab components** — match the approved mockup exactly:
- **OverviewTab**: 6-card KPI strip (`.adminCot__stats` grid) + AI daily brief card + quick-action buttons
- **ListingsTab**: search input + status filter + table with quality bar + pause/activate toggle + "Auditar IA" button per row
- **MessagesTab**: 280px left thread list + right conversation pane + AI suggestion box + confirm-then-send flow
- **AdsTab**: 4 spend KPI cards + campaign table with ACOS coloring + "Optimizar IA" per row + graceful 404 fallback
- **ShipmentsTab**: orders table + click-to-expand tracking timeline
- **AnalyticsTab**: reputation ring + sales list + quality bar chart + per-row AI audit button

**App.jsx** — add near the existing `/hub/ml` entry:
```js
const MlManagerModule = React.lazy(() => import('./components/hub/ml/MlManagerModule.jsx'));
```
```jsx
<Route path="/hub/ml-manager" element={
  <RequireGrant module="canales" minLevel="read">
    <MlManagerModule />
  </RequireGrant>
} />
```

**BmcWolfboardHub.jsx** — add one card tile near the existing ML Operativo card:
```jsx
<Link to="/hub/ml-manager" style={{ ...cta, background: '#0071e3' }}>
  ML Manager
</Link>
```
(match the exact inline style pattern used by adjacent cards in that file)

**.env** — append:
```
VITE_ML_CONNECTOR_URL=http://localhost:3001
VITE_ML_CONNECTOR_API_KEY=<output of openssl rand -hex 32>
```

**.env.example** — append (only if `VITE_ML_CONNECTOR_URL` not already present):
```
# ML Manager connector (hub/ml-manager)
VITE_ML_CONNECTOR_URL=http://localhost:3001
VITE_ML_CONNECTOR_API_KEY=
```

---

# Success Criteria

- `npm run gate:local` exits 0 (lint + test + test:api all pass)
- `npm run build` completes with no errors (Vite tree-shakes unused imports cleanly)
- Visiting `http://localhost:5173/hub/ml-manager` in dev renders the Overview tab with the KPI strip (even if connector is down — empty state, not error)
- The Mensajes tab shows an unread badge on the tab button when `useUnreadMessages()` returns data
- No `console.error` in browser devtools for the happy path (connector offline = empty state, not thrown error)
- One commit on `feat/ml-manager-dashboard`: `feat(hub): add ML Manager dashboard`

---

# Operational Anchors

- Branch `main` is live on Vercel — always work on `feat/ml-manager-dashboard`
- Error semantics: 503 = connector unavailable → empty state; 401 = no ML token → "Conectar cuenta" CTA; 404 = feature unavailable → graceful empty state
- Node 24.x required (`engines.node = "24.x"` in `package.json`)
- Import paths: use relative paths from the file's location — not `@/` aliases (no path aliases configured in this project)
- `VITE_` prefix is mandatory for env vars to be accessible in browser code

---

# Open Items

- [CONFIRMED: feature branch `feat/ml-manager-dashboard`]
- [CONFIRMED: dev connector URL = `http://localhost:3001`]
- [CONFIRMED: CONNECTOR_API_KEY generated by executor via `openssl rand -hex 32`]
- [CONFIRMED: Publicidad tab degrades gracefully on 404/403]
- [CONFIRMED: AI actions require operator confirmation before sending]
- [ASSUMPTION: `hub/ml/` directory is empty or does not exist — verify with `ls src/components/hub/ml/` before writing | if files exist, read them first to avoid overwriting]

---

# How to run this

Open a NEW terminal:
```bash
cd ~/calculadora-bmc
claude   # interactive mode — paste this prompt or reference this file
```

Do NOT use `claude -p` for this task (fails with nested model availability). Use interactive `claude` from inside the repo directory.
