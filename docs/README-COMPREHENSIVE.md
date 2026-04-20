# Calculadora BMC — Panelin v3.1.5

## Complete Reference Manual

**Professional quotation calculator for thermal and acoustic insulation panels**
**BMC Uruguay (METALOG SAS)**

[![CI](https://github.com/matiasportugau-ui/Calculadora-BMC/actions/workflows/ci.yml/badge.svg)](https://github.com/matiasportugau-ui/Calculadora-BMC/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![Node](https://img.shields.io/badge/Node-20-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/license-UNLICENSED-red)

**Live production URL:** [https://calculadora-bmc.vercel.app](https://calculadora-bmc.vercel.app)

---

## Table of Contents

1. [Overview](#1-overview)
2. [For End Users — How to Use the Calculator](#2-for-end-users--how-to-use-the-calculator)
3. [For End Users — Application Modules](#3-for-end-users--application-modules)
4. [Panel Catalog](#4-panel-catalog)
5. [Quick Start (Developers)](#5-quick-start-developers)
6. [Tech Stack](#6-tech-stack)
7. [Architecture](#7-architecture)
8. [Frontend SPA — React + Vite](#8-frontend-spa--react--vite)
9. [Backend API — Express + Node.js](#9-backend-api--expressjs)
10. [AI Chatbot System — Panelin Agent](#10-ai-chatbot-system--panelin-agent)
11. [Calculation Engines](#11-calculation-engines)
12. [Pricing Engine](#12-pricing-engine)
13. [CRM & Sales Operations](#13-crm--sales-operations)
14. [MercadoLibre Integration](#14-mercadolibre-integration)
15. [WhatsApp Business Integration](#15-whatsapp-business-integration)
16. [Shopify Integration](#16-shopify-integration)
17. [Google Sheets Dashboard — Finanzas](#17-google-sheets-dashboard--finanzas)
18. [Transportista — Logistics Module](#18-transportista--logistics-module)
19. [Knowledge Antenna — Continuous Learning](#19-knowledge-antenna--continuous-learning)
20. [Environment Variables](#20-environment-variables)
21. [Testing](#21-testing)
22. [CI/CD Pipeline](#22-cicd-pipeline)
23. [Deployment](#23-deployment)
24. [Scripts Reference](#24-scripts-reference)
25. [Development Rules & Conventions](#25-development-rules--conventions)
26. [AI Agent Ecosystem](#26-ai-agent-ecosystem)
27. [Project Management Tools](#27-project-management-tools)
28. [Security](#28-security)
29. [Troubleshooting](#29-troubleshooting)
30. [Company Information](#30-company-information)

---

## 1. Overview

**Calculadora BMC** (package name `calculadora-bmc`) is a full-stack professional quotation system for insulation sandwich panels, developed for **BMC Uruguay / METALOG SAS**. It generates real-time material quotations for construction projects, covering everything from roof panels and wall panels to fixings, sealants, profiles, and corner pieces.

### What the system does

- **Instant BOM generation** — Enter dimensions, select panel type and scenario, get a complete Bill of Materials with pricing
- **Multi-scenario support** — Roof-only, wall-only, roof + wall combined, and cold storage chambers
- **PDF export** — Professional A4 quotation document ready to print or email
- **WhatsApp sharing** — Pre-formatted text to share quotations via WhatsApp
- **AI-powered assistant** — Built-in chat agent that helps users configure quotations using natural language
- **Live price sync** — Prices pulled from the BROMYROS cost matrix (Google Sheets)
- **MercadoLibre auto-responder** — AI answers buyer questions on MercadoLibre listings
- **WhatsApp CRM** — Receives and routes WhatsApp Business messages to the CRM
- **Shopify integration** — Product sync and order management
- **Financial dashboard** — Real-time KPIs from Google Sheets (quotations, deliveries, pending payments)
- **Logistics tracking** — Complete transport management with driver app, evidence collection, and delivery workflows

### Who uses it

| User type | What they do |
|-----------|-------------|
| **Sales representatives** | Create quotations, share via WhatsApp/PDF, manage pricing |
| **Operations managers** | Monitor dashboard KPIs, manage deliveries, track payments |
| **End customers** | Use the public calculator to explore panel options and get instant pricing |
| **Developers / AI agents** | Extend functionality, manage integrations, maintain the system |
| **Customer support** | Answer MercadoLibre questions, handle email inquiries via AI assist |
| **Logistics drivers** | Track deliveries, upload evidence (photos, signatures), manage routes |

---

## 2. For End Users — How to Use the Calculator

### Step 1: Choose your scenario

When you open the calculator at [calculadora-bmc.vercel.app](https://calculadora-bmc.vercel.app), select your project type:

| Scenario | Icon | What it covers |
|----------|------|----------------|
| **Solo Techo** (Roof Only) | 🏠 | Roof panels, fixings (varilla/caballete), gutters, ridge profiles, sealants |
| **Solo Fachada** (Wall Only) | 🏢 | Wall panels, U-profiles, corner pieces, wall fixings, sealants |
| **Techo + Fachada** (Roof + Wall) | 🏗 | Complete building: roof + all wall materials + corners |
| **Cámara Frigorífica** (Cold Storage) | ❄️ | Specialized cold storage configuration with wall panels and corners |

### Step 2: Enter dimensions

- **Roof**: Length (largo) × Width (ancho) in meters, slope percentage
- **Wall**: Perimeter and height, or individual wall dimensions
- **Select panel family**: ISODEC EPS, ISODEC PIR, ISOROOF 3G, etc.
- **Select thickness**: Each family offers multiple insulation thicknesses (mm)

### Step 3: Review your quotation

The calculator instantly generates:

- **Bill of Materials (BOM)** grouped by category: Panels, Fixings, Profiles, Sealants
- **Individual line prices** in USD (without IVA)
- **Subtotal** + **IVA 22%** = **Total final**

### Step 4: Export and share

- **📄 PDF** — Click to generate an A4 professional quotation document
- **📱 WhatsApp** — Click to get a pre-formatted text message for WhatsApp
- **✏️ Manual overrides** — Edit quantities or unit prices before exporting
- **🤖 AI Chat** — Open the Panelin chat to ask questions in natural language

### The AI Chat Assistant

Open the chat panel (bottom-right corner) and ask questions like:
- "Necesito cotizar un techo de 12×8 metros con ISODEC EPS de 100mm"
- "¿Qué diferencia hay entre ISODEC y ISOROOF?"
- "Cambiá el panel a PIR de 80mm"
- "¿Cuánto cuesta un galpón de 20×15 metros?"

The assistant understands your context, can auto-configure the calculator, and applies changes directly via action commands.

---

## 3. For End Users — Application Modules

The system is organized into several modules accessible via the top navigation bar:

| Route | Module | Description |
|-------|--------|-------------|
| `/` or `/calculadora` | **Panelin Calculator** | Main quotation calculator |
| `/hub` | **Wolfboard Hub** | Central dashboard with KPIs and module access |
| `/hub/ml` | **MercadoLibre Operativo** | MercadoLibre question management and AI auto-response |
| `/hub/wa` | **WhatsApp Operativo** | WhatsApp message management and CRM routing |
| `/logistica` | **Logística** | Logistics module: deliveries, cargo, routes |
| `/conductor` | **Conductor (Driver)** | Driver-facing mobile app for delivery tracking and evidence |
| `/especificaciones` | **Spec Sandbox** | Technical specification management |
| `/presentacion-licitacion` | **Bid Presentation** | Professional bid/tender presentation generator |

---

## 4. Panel Catalog

### Roof Panels (Techo)

| Family | Useful Width | Length Range | Fixing Type | Thicknesses (mm) |
|--------|-------------|-------------|-------------|-------------------|
| **ISODEC EPS** | 1.12 m | 2.3 – 14.0 m | Threaded rod + nut + washer | 100, 150, 200, 250 |
| **ISODEC PIR** | 1.12 m | 3.5 – 14.0 m | Threaded rod + nut + washer | 50, 80, 120 |
| **ISOROOF 3G** | 1.00 m | 3.5 – 8.5 m | Saddle bracket + screw | 30, 40, 50, 80, 100 |
| **ISOROOF FOIL** | 1.00 m | 3.5 – 8.5 m | Saddle bracket + screw | 30, 50 |
| **ISOROOF PLUS** | 1.00 m | 3.5 – 8.5 m | Saddle bracket + screw | 50, 80 |

### Wall Panels (Pared / Fachada)

| Family | Useful Width | Length Range | Thicknesses (mm) |
|--------|-------------|-------------|-------------------|
| **ISOPANEL EPS** | 1.14 m | 2.3 – 14.0 m | 50, 100, 150, 200, 250 |
| **ISOWALL PIR** | 1.10 m | 3.5 – 14.0 m | 50, 80, 100 |

### Insulation Cores

| Core | Material | Use Case |
|------|----------|----------|
| **EPS** | Expanded Polystyrene | General purpose, cost-effective thermal insulation |
| **PIR** | Polyisocyanurate | Superior fire resistance, better thermal performance |

---

## 5. Quick Start (Developers)

**Requirements:** Node.js 20+, npm

```bash
# 1. Clone the repository
git clone https://github.com/matiasportugau-ui/Calculadora-BMC.git
cd Calculadora-BMC

# 2. Install dependencies (requires libasound2-dev on Linux for native MIDI module)
# On Ubuntu/Debian:
sudo apt-get install -y libasound2-dev
npm install

# 3. Set up environment
npm run env:ensure    # creates .env from .env.example (safe — non-destructive)

# 4. Start the frontend only
npm run dev           # → http://localhost:5173

# 5. Or start the full stack (API + frontend)
npm run dev:full      # API at :3001, Vite at :5173
```

### Verify everything works

```bash
npm run gate:local       # lint + test (quick check)
npm run gate:local:full  # lint + test + build (before commits)
curl http://localhost:3001/health  # API health check
```

---

## 6. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React | 18 |
| **Build** | Vite | 7 |
| **Backend API** | Express | 5 |
| **Runtime** | Node.js | 20 LTS |
| **Module System** | ES Modules | `"type": "module"` |
| **3D Rendering** | Three.js + React Three Fiber | 0.169 / 8.x |
| **Routing** | React Router DOM | 6 |
| **AI (Claude)** | @anthropic-ai/sdk | 0.80+ |
| **AI (OpenAI)** | openai | 6.x |
| **AI (Gemini)** | @google/generative-ai | 0.24 |
| **Database** | PostgreSQL (pg) | 8.x |
| **Google APIs** | googleapis | 144 |
| **Logging** | Pino + pino-http | 10.x / 11.x |
| **PDF** | html2pdf.js | 0.14 |
| **PWA** | vite-plugin-pwa | 1.2 |
| **Linting** | ESLint | 9 |
| **Testing** | Custom (Node.js assert-based) | — |

---

## 7. Architecture

### High-Level Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Vite :5173)                          │
│                                                                          │
│  React 18 SPA                                                            │
│  ├── PanelinCalculadoraV3  ← Main calculator component (1400+ lines)    │
│  ├── PanelinChatPanel      ← AI chatbot drawer (SSE streaming)          │
│  ├── BmcLogisticaApp       ← Logistics module                          │
│  ├── DriverTransportistaApp ← Driver mobile app                        │
│  ├── BmcMlOperativoModule  ← MercadoLibre management                   │
│  ├── BmcWaOperativoModule  ← WhatsApp management                       │
│  ├── BmcWolfboardHub       ← Central dashboard                         │
│  ├── QuoteVisualVisor      ← Visual quotation viewer                   │
│  ├── BidPresentation       ← Tender presentation                       │
│  └── RoofPanelRealisticScene ← 3D roof panel visualization             │
│                                                                          │
│  Data Layer:                                                             │
│  ├── src/data/constants.js ← SINGLE SOURCE OF TRUTH for prices/panels  │
│  ├── src/utils/calculations.js ← Pure calculation engines               │
│  └── src/utils/helpers.js  ← BOM, PDF, WhatsApp formatting              │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ HTTP / SSE
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        BACKEND API (Express :3001)                       │
│                                                                          │
│  server/index.js ← Entry point, CORS, security headers, route mounting  │
│                                                                          │
│  Routes:                                                                 │
│  ├── /calc/*          ← Calculator API (GPT Actions, quotation engine)  │
│  ├── /api/agent/chat  ← AI chatbot SSE streaming (Claude/Grok/Gemini)  │
│  ├── /api/agent/*     ← Training KB, conversations, analytics           │
│  ├── /api/*           ← Dashboard, CRM, pricing, MATRIZ                │
│  ├── /auth/ml/*       ← MercadoLibre OAuth flow                        │
│  ├── /webhooks/whatsapp ← WhatsApp Business webhook                    │
│  ├── /webhooks/shopify  ← Shopify webhook                              │
│  ├── /api/driver/*    ← Transportista driver endpoints                  │
│  ├── /api/shopify/*   ← Shopify integration                            │
│  ├── /health          ← Health check (tokens, sheets, config)          │
│  └── /capabilities    ← AI agent discovery manifest                     │
│                                                                          │
│  Libraries (server/lib/):                                                │
│  ├── chatPrompts.js   ← System prompt builder (10 blocks)              │
│  ├── chatLogger.js    ← Conversation persistence + analysis            │
│  ├── antiRepetition.js ← Repetition detection + prompt injection       │
│  ├── trainingKB.js    ← Knowledge base for training examples           │
│  ├── aiCompletion.js  ← Multi-provider AI completion                   │
│  ├── crmOperativoLayout.js ← CRM spreadsheet layout                    │
│  ├── transportistaFsm.js  ← Transport state machine                   │
│  └── whatsappOutbound.js  ← WhatsApp message sending                  │
│                                                                          │
│  External Services:                                                      │
│  ├── Google Sheets API ← Prices, CRM, dashboard data                   │
│  ├── MercadoLibre API  ← OAuth, questions, orders                      │
│  ├── WhatsApp Cloud API ← Incoming/outgoing messages                   │
│  ├── Shopify API       ← Products, orders, draft orders                │
│  ├── Google Cloud Storage ← Token persistence, evidence                │
│  └── PostgreSQL        ← Transportista module (trips, events)          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Repository Structure

```
Calculadora-BMC/
├── src/                          # Frontend React (Vite)
│   ├── main.jsx                  # Entry point
│   ├── App.jsx                   # Root component with routing
│   ├── data/
│   │   ├── constants.js          # SINGLE SOURCE OF TRUTH — panels, prices, fixings, sealants
│   │   ├── pricing.js            # Dynamic pricing helpers
│   │   └── matrizPreciosMapping.js # BROMYROS cost matrix mapping
│   ├── utils/
│   │   ├── calculations.js       # Pure calculation engines (roof + wall)
│   │   ├── helpers.js            # BOM, PDF, WhatsApp
│   │   ├── scenarioOrchestrator.js # Scenario visibility rules
│   │   └── ...                   # 40+ utility modules
│   ├── hooks/
│   │   ├── useChat.js            # AI chat hook (SSE consumer, state, providers)
│   │   └── useRoofPreviewPlanLayout.js
│   ├── components/               # 25+ React components
│   └── styles/                   # Global styles
│
├── server/                       # Backend API (Express 5)
│   ├── index.js                  # Entry point — mounts all routes, serves /finanzas
│   ├── config.js                 # Environment configuration (60+ variables)
│   ├── gptActions.js             # GPT Action definitions (shared with /capabilities)
│   ├── routes/
│   │   ├── calc.js               # Calculator API (/calc/*)
│   │   ├── agentChat.js          # AI chatbot SSE streaming
│   │   ├── agentTraining.js      # Training KB management
│   │   ├── agentConversations.js # Conversation analytics API
│   │   ├── bmcDashboard.js       # Financial dashboard routes (/api/*)
│   │   ├── shopify.js            # Shopify integration
│   │   ├── transportista.js      # Logistics/driver routes
│   │   ├── followups.js          # Follow-up tracker
│   │   └── teamAssist.js         # Team assistance routes
│   └── lib/                      # 23 library modules
│
├── tests/                        # Validation tests (run without server)
│   ├── validation.js             # 335 assertions — core calculations
│   ├── roofVisualQuoteConsistency.js # 10 visual consistency checks
│   ├── cockpitTokenOrigin.js     # Auth origin tests
│   ├── calc-routes.validation.js # API route tests (needs server)
│   └── chat-hardening.js         # Chat security tests
│
├── scripts/                      # 100+ automation scripts
├── data/                         # Runtime data (training KB, conversations)
│   └── knowledge/                # AI knowledge documents (~660 lines)
├── docs/                         # 50+ documentation files
│   ├── team/                     # Team coordination, PROJECT-STATE.md
│   ├── google-sheets-module/     # Sheets integration hub
│   ├── bmc-dashboard-modernization/ # Dashboard setup
│   └── procedimientos/           # Operational procedures
│
├── .github/workflows/            # CI/CD (6 workflows)
├── Dockerfile                    # Frontend-only container (nginx)
├── Dockerfile.bmc-dashboard      # Full-stack container (API + SPA)
├── vercel.json                   # Vercel deployment config
└── package.json                  # 130+ npm scripts
```

---

## 8. Frontend SPA — React + Vite

### Main Calculator Component

The core calculator lives in `src/components/PanelinCalculadoraV3_backup.jsx` (canonical file, ~1400 lines). The file `src/PanelinCalculadoraV3.jsx` is a re-export.

**Key features:**
- Scenario selection (roof, wall, roof+wall, cold storage)
- Panel family and thickness selection per scenario
- Real-time BOM calculation as inputs change
- Manual quantity/price overrides
- PDF A4 export via `html2pdf.js`
- WhatsApp text formatting
- 3D roof panel preview with Three.js
- Floor plan 2D editor with dimension annotations
- AI chat drawer (Panelin agent)

### Routing (`src/App.jsx`)

Uses React Router v6 with lazy-loaded routes:

| Path | Component | Lazy |
|------|-----------|------|
| `/` | `PanelinCalculadora` | ✅ |
| `/calculadora` | `PanelinCalculadora` | ✅ |
| `/hub` | `BmcWolfboardHub` | ❌ |
| `/hub/ml` | `BmcMlOperativoModule` | ❌ |
| `/hub/wa` | `BmcWaOperativoModule` | ❌ |
| `/logistica` | `BmcLogisticaApp` | ✅ |
| `/conductor` | `DriverTransportistaApp` | ✅ |
| `/especificaciones` | `SpecManagementSandbox` | ✅ |
| `/presentacion-licitacion` | `BidPresentation` | ✅ |

### Core Web Vitals

The app reports LCP, INP, and CLS metrics via `web-vitals` to `POST /api/vitals` (beacon API).

### PWA Support

The app is a Progressive Web App (via `vite-plugin-pwa`), enabling offline access and install-to-home-screen on mobile devices.

---

## 9. Backend API — Express.js

### Server Entry Point

`server/index.js` creates an Express 5 application with:

- **CORS** — Open in development, restricted in production
- **Security headers** — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- **Rate limiting** — 10 req/min (public), 30 req/min (dev mode with token)
- **Structured logging** — Pino + pino-http with UUID request IDs
- **Health check** — `GET /health` reports config, tokens, Sheets status

### Route Map

| Mount | Router | Description |
|-------|--------|-------------|
| `/calc/*` | `routes/calc.js` | Calculator API — GPT Actions, quotation engine |
| `/api/agent/chat` | `routes/agentChat.js` | AI chatbot (SSE streaming) |
| `/api/agent/training*` | `routes/agentTraining.js` | Training KB CRUD + bulk ops |
| `/api/agent/conversations*` | `routes/agentConversations.js` | Conversation logs + analytics |
| `/api/*` | `routes/bmcDashboard.js` | Dashboard: CRM, pricing, MATRIZ, ventas |
| `/api/followups` | `routes/followups.js` | Follow-up tracker |
| `/api/team-assist/*` | `routes/teamAssist.js` | Team assistance |
| `/api/shopify/*` | `routes/shopify.js` | Shopify integration |
| `/api/driver/*` | `routes/transportista.js` | Driver/logistics endpoints |
| `/auth/ml/*` | `server/index.js` | MercadoLibre OAuth flow |
| `/webhooks/whatsapp` | `server/index.js` | WhatsApp Business webhook |
| `/webhooks/shopify` | `routes/shopify.js` | Shopify webhook |
| `/capabilities` | `server/index.js` | AI agent discovery manifest |
| `/health` | `server/index.js` | System health check |

### Key API Endpoints

#### Calculator Endpoints (`/calc/*`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/calc/informe` | Complete report: prices, advisory rules, formulas |
| `GET` | `/calc/catalogo` | Panel catalog with prices |
| `GET` | `/calc/escenarios` | Available scenarios with required/optional fields |
| `POST` | `/calc/cotizar/presupuesto-libre` | Free-form quotation with manual line items |
| `POST` | `/calc/cotizar/techo` | Roof quotation |
| `POST` | `/calc/cotizar/pared` | Wall quotation |
| `POST` | `/calc/cotizar/completo` | Complete quotation (roof + wall) |
| `GET` | `/calc/gpt-entry-point` | GPT Actions discovery schema |
| `GET` | `/calc/openapi` | OpenAPI YAML schema |

#### CRM & Dashboard (`/api/*`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/actualizar-precios-calculadora` | CSV MATRIZ — live prices from Google Sheets |
| `GET/POST` | `/api/crm/cockpit/*` | CRM cockpit: quote-link, approval, mark-sent, send-approved |
| `POST` | `/api/crm/suggest-response` | AI-powered response suggestion for customer questions |
| `POST` | `/api/crm/ingest-email` | Email ingestion into CRM |
| `GET` | `/api/email/panelsim-summary` | Email inbox summary (IMAP bridge) |
| `POST` | `/api/email/draft-outbound` | AI-drafted outbound email (supplier/client) |
| `GET` | `/api/ventas/*` | Sales data from Google Sheets |
| `GET/POST` | `/api/followups` | Follow-up reminders CRUD |

#### AI Agent (`/api/agent/*`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/agent/chat` | SSE streaming chat (multi-provider) |
| `GET` | `/api/agent/ai-options` | Available AI providers and models |
| `GET` | `/api/agent/conversations` | List conversation logs (filtered) |
| `GET` | `/api/agent/conversations/:id` | Full conversation with all turns |
| `GET` | `/api/agent/conversations/:id/analysis` | Rule-based conversation analysis |
| `GET` | `/api/agent/conversations/report/aggregate` | Aggregate analytics report |
| `GET/POST/PUT/DELETE` | `/api/agent/training-kb/*` | Training KB entries CRUD |
| `POST` | `/api/agent/training-kb/bulk` | Bulk import training entries |
| `GET` | `/api/agent/training-kb/export` | Export full KB as JSON |

---

## 10. AI Chatbot System — Panelin Agent

### Overview

The Panelin AI agent is a conversational assistant built into the calculator. It can:
- Answer questions about panels, pricing, and construction techniques
- Auto-configure the calculator (change scenarios, panel families, dimensions)
- Provide quotation summaries
- Explain technical differences between products

### Architecture

```
Frontend                           Backend
───────                            ───────
PanelinChatPanel.jsx (1413 lines)  POST /api/agent/chat (SSE)
  └── useChat.js (512 lines)       └── agentChat.js
                                      ├── chatPrompts.js (system prompt builder)
                                      ├── trainingKB.js (knowledge base matching)
                                      ├── chatLogger.js (conversation persistence)
                                      └── antiRepetition.js (response diversity)
```

### AI Providers (Failover Chain)

The system supports 4 AI providers with automatic failover:

| Priority | Provider | Default Model | API Key |
|----------|----------|---------------|---------|
| 1 | **Claude (Anthropic)** | `claude-haiku-4-5-20251001` | `ANTHROPIC_API_KEY` |
| 2 | **Grok (xAI)** | `grok-3-mini` | `GROK_API_KEY` |
| 3 | **Gemini (Google)** | `gemini-2.0-flash` | `GEMINI_API_KEY` |
| 4 | **OpenAI** | `gpt-4o-mini` | `OPENAI_API_KEY` |

If the primary provider fails, the system automatically tries the next one in the chain.

### System Prompt (10 Blocks)

The system prompt is assembled from 10 blocks per request:

| # | Block | Type |
|---|-------|------|
| 1–5 | IDENTITY, CONSTRUCTION, CATALOG, WORKFLOW, ACTIONS_DOC | Hardcoded expert knowledge |
| 6 | PRECIOS CANÓNICOS | Auto-generated from `src/data/constants.js` |
| 7 | DOCUMENTACIÓN TÉCNICA | Loaded from `data/knowledge/*.md` (60s cache) |
| 8 | ESTADO ACTUAL | Dynamic — live calculator state per request |
| 9 | CORRECCIONES ENTRENAMIENTO | KB matches (top-5 relevant examples) |
| 10 | MODO DESARROLLADOR | Dev-mode only (when Ctrl+Shift+D activated) |
| 11 | ANTI-REPETICIÓN | Dynamic — injected only when repetition detected |

### SSE Event Types

| Event | Description |
|-------|-------------|
| `text` | Streaming text chunk |
| `action` | Calculator action command (e.g., `setTecho`, `setEscenario`) |
| `kb_match` | Training KB match information (dev mode) |
| `info` | Informational metadata |
| `calc_validation` | Calculation verification result |
| `done` | Stream complete (includes `conversationId`) |
| `error` | Error message |

### Action Types (10 Whitelisted)

The chatbot can auto-configure the calculator via these action commands:

- `setEscenario` — Change scenario (roof/wall/both/cold-storage)
- `setTecho` — Configure roof parameters
- `setPared` — Configure wall parameters
- `setFamilia` — Change panel family
- `setEspesor` — Change panel thickness
- `setLargo` — Set panel length
- `setDimensiones` — Set dimensions
- `setCamara` — Configure cold storage
- `setListaPrecios` — Switch price list (venta/web)
- `addLinea` — Add a manual BOM line

### Anti-Repetition System

The `antiRepetition.js` module detects when the assistant starts repeating itself:
- **Jaccard 4-gram similarity** between consecutive responses
- **Repeated phrase detection** (3-word phrases across messages)
- **Structural pattern detection** (same response format used 3+ times)

When detected, a dynamic `## DIRECTIVA ANTI-REPETICIÓN` block is injected into the system prompt.

### Conversation Logging

Every conversation turn is persisted to `data/conversations/{id}.json` with:
- User message, assistant response, emitted actions
- KB match count, calculation validation result
- Provider used, model, response duration
- Full conversation analysis (rule-based): strengths, issues, suggestions

### Training Knowledge Base

- Storage: `data/training-kb.json` (flat JSON)
- Matching: Token overlap scoring (≥3 char tokens), permanent entries +100 bonus
- Categories: `sales`, `math`, `product`, `conversational`
- Knowledge docs: `data/knowledge/*.md` (~660 lines, 60s TTL cache)
- Dev mode: Ctrl+Shift+D → requires `API_AUTH_TOKEN`; shows per-message feedback

### Max Tokens

Configurable via `PANELIN_CHAT_MAX_TOKENS` environment variable (default: 2048, range: 512–4096).

---

## 11. Calculation Engines

All calculation functions are **pure** (no side effects, no React dependencies) in `src/utils/calculations.js`.

### Roof Engine — `calcTechoCompleto()`

Orchestrates:
1. `calcPanelesTecho` — Panel count based on dimensions and useful width
2. `calcAutoportancia` — Self-supporting structure calculation
3. `calcFijacionesVarilla` / `calcFijacionesCaballete` — Fixing type depends on panel family
4. `calcPerfileriaTecho` — Gutters (goteros), channels (canalón), ridge (cumbrera)
5. `calcSelladoresTecho` — Silicone, tape, membrane

### Wall Engine — `calcParedCompleto()`

Orchestrates:
1. `calcPanelesPared` — Wall panel count from perimeter and height
2. `calcPerfilesU` — U-profiles for panel mounting
3. `calcEsquineros` — Corner pieces (interior + exterior)
4. `calcFijacionesPared` — Concrete anchors, T2 screws, rivets
5. `calcPerfilesParedExtra` — Additional K2, G2, 5852 profiles
6. `calcSelladorPared` — Silicone, tape, membrane, PU foam

### Totals — `calcTotalesSinIVA()`

- Sums all line item subtotals
- Applies **IVA 22%** once on the final total
- Returns: `{ subtotal, iva, total }`

### Key Rules

| Rule | Implementation |
|------|---------------|
| Quantities always round up | `Math.ceil()` — never `round()` or `floor()` |
| Prices resolved dynamically | `p(item)` function from `constants.js` |
| IVA applied once | Only in `calcTotalesSinIVA()`, never per-line |
| All prices in USD | Without IVA throughout the engine |

---

## 12. Pricing Engine

### Price Lists

| List | Variable | Use Case |
|------|----------|----------|
| `venta` | `LISTA_ACTIVA = "venta"` | BMC direct price — for clients and quotations |
| `web` | `LISTA_ACTIVA = "web"` | Public Shopify price |

### How Prices Work

```js
// constants.js — each product has multiple price lists:
{ venta: 37.76, web: 45.97, costo: 28.32 }

// p() resolves the active price:
p({ venta: 37.76, web: 45.97 })
// → 37.76 if LISTA_ACTIVA === "venta"
// → 45.97 if LISTA_ACTIVA === "web"
```

### BROMYROS Cost Matrix

The canonical price source is the **MATRIZ de COSTOS y VENTAS 2026** Google Sheet. The API endpoint `GET /api/actualizar-precios-calculadora` returns a CSV with current prices from this sheet.

Scripts for matrix management:
- `npm run matriz:pull-csv` — Download latest prices
- `npm run matriz:reconcile` — Reconcile calculator vs. matrix prices
- `npm run matriz:rename-headers` — Rename BROMYROS headers
- `npm run matriz:sync-fijaciones-isodec` — Sync ISODEC fixing prices
- `npm run matriz:sync-silicona-300` — Sync silicone 300ml prices

---

## 13. CRM & Sales Operations

### CRM Cockpit

Protected by `API_AUTH_TOKEN` (Bearer token or `X-Api-Key` header).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/crm/cockpit/row` | GET | Read a CRM row from the master sheet |
| `/api/crm/cockpit/quote-link` | POST | Generate and store quote link (column AH) |
| `/api/crm/cockpit/approval` | POST | AI-powered approval recommendation |
| `/api/crm/cockpit/mark-sent` | POST | Mark quotation as sent (column AJ) |
| `/api/crm/cockpit/send-approved` | POST | Send approved quote via ML or WhatsApp |

### AI Response Suggestion

`POST /api/crm/suggest-response` — Uses the same AI provider chain to generate intelligent responses for customer questions (from MercadoLibre, email, or WhatsApp).

### Email Integration

- **Ingest:** `npm run email:ingest-snapshot` reads IMAP snapshot and posts to CRM
- **Summary:** `GET /api/email/panelsim-summary` reads inbox status
- **Draft:** `POST /api/email/draft-outbound` generates AI-drafted emails (does NOT send)

---

## 14. MercadoLibre Integration

### OAuth Flow

1. Configure `ML_CLIENT_ID`, `ML_CLIENT_SECRET` in `.env`
2. Start API: `npm run start:api`
3. Open `http://localhost:3001/auth/ml/start` in browser
4. Authorize → callback stores encrypted tokens in `.ml-tokens.enc`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/ml/start` | Initiate OAuth flow |
| `GET` | `/auth/ml/callback` | OAuth callback |
| `GET` | `/auth/ml/status` | Token status |
| `GET` | `/ml/users/me` | Current ML user info |
| `GET` | `/ml/items/:id` | Item details |
| `GET` | `/ml/questions` | Unanswered questions |
| `POST` | `/ml/questions/:id/answer` | Answer a question |
| `POST` | `/webhooks/ml` | ML webhook receiver |

### ML Audit & Training Tools

| Command | Description |
|---------|-------------|
| `npm run ml:verify` | Check OAuth status and token validity |
| `npm run ml:ai-audit` | AI-powered audit of all ML questions/orders |
| `npm run ml:corpus-export` | Export full Q&A history to JSON |
| `npm run ml:sim-batch` | Export simulation batches for training |
| `npm run ml:pending-workup` | Analyze unanswered questions with AI |
| `npm run ml:cloud-run` | Sync ML config to Cloud Run |

---

## 15. WhatsApp Business Integration

### Setup

1. Configure in Meta Business → WhatsApp → Configuration → Webhook
2. Set `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` in `.env`
3. Webhook URL: `https://<your-domain>/webhooks/whatsapp`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/webhooks/whatsapp` | Webhook verification (Meta challenge) |
| `POST` | `/webhooks/whatsapp` | Receive incoming messages |

### Features

- Incoming message routing to CRM
- HMAC signature verification (`WHATSAPP_APP_SECRET`)
- AI-suggested responses via CRM cockpit
- Outbound message sending via `whatsappOutbound.js`

### Verification

```bash
npm run wa:cloud-check  # Check WhatsApp Cloud API configuration
```

---

## 16. Shopify Integration

### Configuration

Set `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_WEBHOOK_SECRET` in `.env`.

### Features

- Product catalog sync
- Order management
- Draft order creation
- Webhook processing
- Questions tab in Google Sheets (`SHOPIFY_QUESTIONS_SHEET_TAB`)

### Tools

```bash
npm run visor:shopify-map       # Build product mapping
npm run visor:shopify-families  # Build family groupings
npm run visor:shopify-sync      # Full sync (map + families)
```

---

## 17. Google Sheets Dashboard — Finanzas

### Overview

The financial dashboard reads/writes data from multiple Google Sheets workbooks:

| Workbook | Env Variable | Content |
|----------|-------------|---------|
| Admin Cotizaciones | `BMC_SHEET_ID` | Master quotation sheet |
| Pagos Pendientes | `BMC_PAGOS_SHEET_ID` | Pending payments |
| Calendario | `BMC_CALENDARIO_SHEET_ID` | Due date calendar |
| Ventas | `BMC_VENTAS_SHEET_ID` | Sales data |
| Stock E-Commerce | `BMC_STOCK_SHEET_ID` | Shopify stock levels |
| MATRIZ Costos | `BMC_MATRIZ_SHEET_ID` | Cost/pricing matrix |

### Setup

1. Create a Google Cloud service account with Sheets API (read + write)
2. Download JSON key → save as `docs/bmc-dashboard-modernization/service-account.json`
3. Share each spreadsheet with the service account email as Editor
4. Set `GOOGLE_APPLICATION_CREDENTIALS` in `.env`

### One-Click Setup

```bash
./run_dashboard_setup.sh           # Full setup: validate, install, start
./run_dashboard_setup.sh --check-only  # Verify config only
```

### Dashboard Ports

| Component | Port | Start Command |
|-----------|------|---------------|
| Express API | 3001 | `npm run start:api` |
| Vite frontend | 5173 | `npm run dev` |
| Dashboard standalone | 3849 | `npm run bmc-dashboard` |

### Performance Tuning

| Variable | Default | Description |
|----------|---------|-------------|
| `BMC_SHEETS_TAB_NAMES_TTL_MS` | 120000 | Tab names cache TTL (ms) |
| `BMC_SHEETS_VENTAS_MERGE_TTL_MS` | 90000 | Sales merge cache TTL (ms) |
| `BMC_SHEETS_READ_MAX_RETRIES` | 5 | Max retries on 429/quota errors |
| `BMC_SHEETS_READ_RETRY_BASE_MS` | 500 | Base backoff for retries (ms) |

---

## 18. Transportista — Logistics Module

### Overview

A complete transport management system with:
- **Trip management** — Create, assign, track deliveries
- **Driver mobile app** — `/conductor` route with delivery interface
- **Evidence collection** — Photo upload, digital signatures
- **State machine** — Lifecycle: `created → assigned → in_transit → delivered → confirmed`
- **Outbox worker** — Background WhatsApp notifications

### Database

Uses PostgreSQL (`DATABASE_URL` in `.env`). Migrations:

```bash
npm run transportista:migrate  # Apply pending migrations
```

### Configuration

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `TRANSPORTISTA_GCS_BUCKET` | GCS bucket for evidence |
| `TRANSPORTISTA_DRIVER_TOKEN_TTL_HOURS` | Driver token lifetime (default: 24h) |
| `TRANSPORTISTA_OUTBOX_INTERVAL_MS` | Outbox polling interval (default: 15s) |
| `TRANSPORTISTA_STRICT_POD` | Require proof of delivery |

---

## 19. Knowledge Antenna — Continuous Learning

### Overview

The Knowledge Antenna is an automated system that scans external sources (industry news, building codes, competitor updates) and ranks findings by relevance to the BMC product catalog.

### Commands

| Command | Description |
|---------|-------------|
| `npm run knowledge:scan` | Scan sources for new articles (max 8 per source, min score 0.45) |
| `npm run knowledge:rank` | Rank scanned items by relevance |
| `npm run knowledge:impact` | Assess business impact (last 14 days) |
| `npm run knowledge:db` | Update knowledge database |
| `npm run knowledge:direction` | Track market direction trends |
| `npm run knowledge:magazine` | Generate knowledge magazine |
| `npm run knowledge:run` | Full pipeline: env → preflight → scan → rank → impact → db → direction |
| `npm run knowledge:report` | Generate report |

### Scheduled Execution

```bash
npm run knowledge:schedule:install    # Install macOS LaunchAgent for automatic scanning
npm run knowledge:schedule:uninstall  # Remove schedule
```

---

## 20. Environment Variables

The `.env.example` file documents **60+ environment variables**. Here are the most important groups:

### Required for basic operation

| Variable | Description |
|----------|-------------|
| `BMC_SHEET_ID` | Google Sheets workbook ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON |
| `ML_CLIENT_ID` | MercadoLibre OAuth client ID |
| `ML_CLIENT_SECRET` | MercadoLibre OAuth client secret |

### AI Providers (at least one required for chat)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key (primary) |
| `OPENAI_API_KEY` | OpenAI API key (fallback) |
| `GEMINI_API_KEY` | Google Gemini API key (fallback) |
| `GROK_API_KEY` | xAI Grok API key (fallback) |

### Security

| Variable | Description |
|----------|-------------|
| `API_AUTH_TOKEN` | Bearer token for protected endpoints |
| `TOKEN_ENCRYPTION_KEY` | 64-hex key for ML token encryption |
| `WHATSAPP_APP_SECRET` | HMAC signature for WhatsApp webhooks |

### Frontend Build-Time (Vite)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL (for Vercel builds) |
| `VITE_SAME_ORIGIN_API` | Set to `1` when SPA and API share the same origin |
| `VITE_BMC_API_AUTH_TOKEN` | Auth token for internal builds |

### Setup

```bash
npm run env:ensure  # Creates .env from .env.example (non-destructive)
```

---

## 21. Testing

### Test Suites

| Command | Suite | Tests | Requires Server |
|---------|-------|-------|-----------------|
| `npm test` | Offline validation | 335 + 10 + cockpit origin | ❌ |
| `npm run test:api` | API route validation | Variable | ✅ :3001 |
| `npm run test:contracts` | API contract validation | Variable | ✅ :3001 |
| `npm run test:chat` | Chat hardening tests | Variable | ❌ |

### What the tests cover

**`tests/validation.js`** (335 assertions):
- Panel calculation accuracy for all families and thicknesses
- Fixing calculations (varilla, caballete, anchors)
- Profile calculations (goteros, canalón, cumbrera)
- Sealant quantities
- Total/subtotal/IVA calculations
- Edge cases (minimum dimensions, maximum lengths)
- Multi-zone calculations
- Combined material scenarios

**`tests/roofVisualQuoteConsistency.js`** (10 checks):
- Visual quote model consistency with calculation results

**`tests/cockpitTokenOrigin.js`**:
- CRM cockpit auth origin validation

### Running Tests

```bash
npm test                   # Quick: offline tests only
npm run gate:local         # lint + test
npm run gate:local:full    # lint + test + build
npm run test:contracts     # Requires: npm run start:api first
```

---

## 22. CI/CD Pipeline

### GitHub Actions Workflows

Located in `.github/workflows/`:

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `ci.yml` | Push to `main`/`develop`, PR to `main` | Validate + lint + build |
| `deploy-calc-api.yml` | Manual / release | Deploy API to Cloud Run |
| `deploy-frontend.yml` | Manual / release | Deploy frontend to Vercel |
| `dev-trace.yml` | Manual | Development traceability |
| `knowledge-antenna-scheduled.yml` | Schedule | Automated knowledge scanning |
| `knowledge-antenna-reusable.yml` | Called by other workflows | Reusable antenna pipeline |

### CI Jobs (`ci.yml`)

| Job | Steps |
|-----|-------|
| **validate** | `npm ci` → `node tests/validation.js` → `npm run build` |
| **lint** | `npm ci` → `npm run lint` |
| **channels_pipeline** | Smoke prod + follow-ups + snapshot + humanGate |

---

## 23. Deployment

### Vercel (Frontend — Recommended)

**Production URL:** [https://calculadora-bmc.vercel.app](https://calculadora-bmc.vercel.app)

```bash
npx vercel --prod
```

Configuration in `vercel.json`: framework `vite`, output `dist/`, SPA rewrites.

### Google Cloud Run (API)

**Service:** `panelin-calc` · **Region:** `us-central1`

```bash
npm run ml:cloud-run                    # Sync env vars to Cloud Run
./scripts/cloud-run-matriz-sheets-secret.sh  # Mount Sheets credentials
npm run pre-deploy                      # Pre-deploy validation
```

### Docker

**Frontend only (nginx):**
```bash
docker build -t calculadora-bmc:latest .
docker run --rm -p 8080:80 calculadora-bmc:latest
```

**Full stack (API + SPA):**
```bash
docker build -f Dockerfile.bmc-dashboard -t bmc-fullstack:latest .
docker run --rm -p 3001:3001 bmc-fullstack:latest
```

### Build

```bash
npm run build     # Production build → dist/
npm run preview   # Local preview of build
```

---

## 24. Scripts Reference

The project has **130+ npm scripts**. Here are the most important ones, organized by category:

### Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (frontend only, :5173) |
| `npm run dev:full` | API (:3001) + Vite (:5173) |
| `npm run dev:api` | API with `--watch` (auto-reload) |
| `npm run start:api` | API (production mode) |
| `npm run dev:full-stack` | Full stack + Panelin Evolution viewer |

### Quality Gates

| Command | Description |
|---------|-------------|
| `npm run lint` | ESLint on `src/` |
| `npm test` | Offline tests (335 + 10 + cockpit) |
| `npm run gate:local` | lint + test |
| `npm run gate:local:full` | lint + test + build |
| `npm run check` | Alias for `gate:local` |

### Deployment

| Command | Description |
|---------|-------------|
| `npm run build` | Production Vite build → `dist/` |
| `npm run pre-deploy` | Pre-deploy checklist (health, contracts, env, open items) |
| `npm run smoke:prod` | Smoke test against production API |
| `npm run ml:cloud-run` | Sync env vars to Cloud Run |

### Data & Pricing

| Command | Description |
|---------|-------------|
| `npm run matriz:pull-csv` | Download MATRIZ prices from Sheets |
| `npm run matriz:reconcile` | Reconcile calculator vs. matrix |
| `npm run capabilities:snapshot` | Regenerate agent capabilities manifest |

### AI & Training

| Command | Description |
|---------|-------------|
| `npm run panelin:train:import` | Import training data |
| `npm run training:report` | Generate training report |
| `npm run ml:ai-audit` | AI audit of all ML interactions |
| `npm run ml:corpus-export` | Export full ML conversation corpus |

### Project Management

| Command | Description |
|---------|-------------|
| `npm run program:status` | Master program progress |
| `npm run project:compass` | Unified tracking: program + follow-ups |
| `npm run followup` | Follow-up reminders CLI |
| `npm run channels:onboarding` | Channel setup (WA → ML → Email) |
| `npm run channels:automated` | Machine-only pipeline: smoke + follow-ups + humanGate |
| `npm run panelsim:session` | Full PANELSIM session (env + email + ML + smoke + report) |

### Knowledge & Learning

| Command | Description |
|---------|-------------|
| `npm run knowledge:run` | Full knowledge pipeline |
| `npm run knowledge:magazine` | Knowledge magazine |
| `npm run magazine:daily` | Daily digest |
| `npm run magazine:daily:send` | Daily digest via email |

### Infrastructure

| Command | Description |
|---------|-------------|
| `npm run env:ensure` | Create `.env` from `.env.example` |
| `npm run disk:precheck` | Check available disk space |
| `npm run mac:storage-audit` | macOS disk/memory audit |
| `npm run credentials:registry` | Credentials master registry |

---

## 25. Development Rules & Conventions

### Code Conventions

| Rule | Detail |
|------|--------|
| **Module system** | ES Modules only (`import`/`export`) — no `require()` |
| **Quantities** | Always `Math.ceil()` — never `round()` or `floor()` |
| **Prices** | Use `p(item)` — never hardcode prices |
| **IVA** | Applied once at the end in `calcTotalesSinIVA()` |
| **Styles** | Inline only — tokens `C` and `FONT` from `constants.js` |
| **State** | `React.useState` only — no `localStorage`, no external fetch |
| **Logging** | Use `pino` / `pino-http` — no `console.log` in production |
| **Error semantics** | `503` = Sheets unavailable, `200 + empty data` = no data, never `500` for Sheets |
| **Sheet IDs** | Never hardcoded — always from `config.*` or `process.env.*` |
| **Credentials** | Never in code — only in `.env` (not committed) |

### Git Workflow

```bash
# Before committing changes in src/
npm run gate:local:full    # lint → test → build

# Commit message format
feat: add cold storage scenario support
fix: correct panel count for widths < 2m
refactor: extract roof calculation into separate module
docs: update API reference
prices: actualizar Matriz BROMYROS [2026-04-15]
```

### Adding a New Panel

1. Add entry in `PANELS_TECHO` or `PANELS_PARED` in `constants.js`
2. Add corresponding profiles in `PERFIL_TECHO` or `PERFIL_PARED`
3. Add to `SCENARIOS_DEF[].familias` for the correct scenario
4. Verify `resolveSKU` resolves correctly
5. Run `npm test`

### Updating Prices (BROMYROS Matrix)

1. Edit section §2 of `constants.js`
2. Update `venta`, `web`, `costo` for affected products
3. If new thicknesses exist, add to the panel's `esp` object
4. Run `npm test`
5. Commit: `prices: actualizar Matriz BROMYROS [fecha]`

---

## 26. AI Agent Ecosystem

The project uses a team of **coordinated AI agents** for development and operations. Agent definitions live in `.claude/agents/` (Claude Code) and `.cursor/agents/` (Cursor).

### Agent Roles

| Agent | Role |
|-------|------|
| `bmc-orchestrator` | Coordinates full team runs |
| `bmc-calc-specialist` | Pricing, BOM, panel calculations |
| `bmc-panelin-chat` | Chat UI, training KB, dev mode |
| `bmc-api-contract` | API response drift detection |
| `bmc-security` | OAuth, CORS, credential audits |
| `bmc-deployment` | Vercel + Cloud Run deploy/rollback |
| `bmc-fiscal` | IVA/IRAE/BPS fiscal oversight |
| `bmc-docs-sync` | PROJECT-STATE.md and docs sync |
| `bmc-judge` | Run reports, agent rankings |
| `bmc-sheets-mapping` | Google Sheets CRM integration |
| `calculo-especialist` | 2D roof plan SVG dimensioning |

### Key Agent Files

| File | Description |
|------|-------------|
| `AGENTS.md` | Commands and conventions for AI agents |
| `CLAUDE.md` | Claude Code-specific context |
| `docs/team/PROJECT-STATE.md` | Live project state (always updated) |
| `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` | Full team coverage matrix |

---

## 27. Project Management Tools

### PANELSIM Session

A comprehensive operational session that validates all integrations:

```bash
npm run panelsim:session
# Runs: env:ensure → panelsim:env → panelsim:email-ready → API start →
#        ml:verify → project:compass → channels:automated → ML-CRM sync →
#        generates SESSION-STATUS report
```

Quick mode: `npm run panelsim:session -- --quick`

### Follow-Up Tracker

```bash
npm run followup          # CLI interface
npm run followup list     # List all follow-ups
npm run followup due      # Show overdue items
```

Also available via API: `GET/POST /api/followups`

### Daily Magazine

```bash
npm run magazine:daily        # Generate digest
npm run magazine:daily:send   # Generate + send via SMTP
npm run magazine:daily:dry    # Preview without writing
```

### Expert Workflow

```bash
npm run expert:workflow       # Local → prod flow with gates
npm run expert:checkpoint     # Save development snapshot
npm run expert:checkpoints    # List all checkpoints
npm run expert:restore-hint   # Steps to restore a checkpoint
```

---

## 28. Security

### Authentication

| Mechanism | Endpoints | Config |
|-----------|-----------|--------|
| Bearer token / X-Api-Key | CRM cockpit, dev mode, training | `API_AUTH_TOKEN` |
| MercadoLibre OAuth 2.0 | `/auth/ml/*`, `/ml/*` | `ML_CLIENT_ID`, `ML_CLIENT_SECRET` |
| Shopify OAuth | `/auth/shopify/*` | `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET` |
| Driver JWT | `/api/driver/*` | Auto-generated, `TRANSPORTISTA_DRIVER_TOKEN_TTL_HOURS` |

### Input Validation

- Chat: max 60 messages, 4000 chars/msg
- Action type whitelist (10 types only)
- Input sanitization against prompt injection
- CORS allowlist: `calculadora-bmc.vercel.app`, `localhost:5173/3000`, `*.vercel.app`
- Rate limiting: 10 req/min (public), 30 req/min (dev mode)

### Webhook Security

- WhatsApp: HMAC signature verification (`WHATSAPP_APP_SECRET`)
- Shopify: Signature verification (`SHOPIFY_WEBHOOK_SECRET`)
- ML: Verify token challenge (`WEBHOOK_VERIFY_TOKEN`)

### Token Storage

- Local: Encrypted file `.ml-tokens.enc` (AES with `TOKEN_ENCRYPTION_KEY`)
- Production: Google Cloud Storage (`ML_TOKEN_GCS_BUCKET`)

---

## 29. Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| `npm install` fails on Linux | Install ALSA headers: `sudo apt-get install -y libasound2-dev` |
| Disk precheck fails | Set `BMC_DISK_PRECHECK_SKIP=1` or free disk space |
| API returns 503 for Sheets | Check `GOOGLE_APPLICATION_CREDENTIALS` path and sheet sharing |
| ML OAuth fails | Verify `ML_CLIENT_SECRET`, run `npm run ml:verify` |
| Chat returns "AI not configured" | Set at least one AI API key (`ANTHROPIC_API_KEY`, etc.) |
| CORS errors in browser | Check `PUBLIC_BASE_URL` and CORS allowlist |
| Build fails with large chunks warning | This is a warning, not an error — build still succeeds |

### Health Check

```bash
curl http://localhost:3001/health
# Returns:
# {
#   "ok": true,
#   "appEnv": "development",
#   "hasTokens": false,     ← ML OAuth tokens
#   "hasSheets": true,      ← Google Sheets configured
#   "missingConfig": []     ← Missing required env vars
# }
```

### Smoke Test (Production)

```bash
npm run smoke:prod           # Full smoke against production API
npm run smoke:prod -- --json # JSON output
npm run smoke:prod -- --skip-matriz  # Skip MATRIZ check
```

Tests: `/health`, `/capabilities`, `public_base_url`, MATRIZ CSV, ML status, AI suggest-response.

---

## 30. Company Information

| Field | Value |
|-------|-------|
| **Legal Name** | METALOG SAS |
| **Brand** | BMC Uruguay |
| **RUT** | 120403430012 |
| **Location** | Maldonado, Uruguay |
| **Website** | [bmcuruguay.com.uy](https://bmcuruguay.com.uy) |
| **Phone** | 092 663 245 |
| **Bank** | BROU · USD Account: 110520638-00002 |

---

## License

Proprietary code — BMC Uruguay / METALOG SAS. All rights reserved.

---

*This document was generated for Calculadora BMC v3.1.5. For the latest project state, see `docs/team/PROJECT-STATE.md`.*
