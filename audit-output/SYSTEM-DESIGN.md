# SYSTEM-DESIGN.md

**Project:** Calculadora-BMC  
**Date:** 2026-06-07

## High-Level Architecture (ASCII)

```
Users / Operators
       │
       ▼
Vercel (SPA + static) ───────────────────────────────────────┐
  - React 18 + Vite, lazy-loaded hub modules (/hub/*)        │
  - GIS Drive (client), PDF preview, 2D/3D roof viz          │
  - Auth: BmcAuthProvider + RequireGrant (RBAC)              │
       │  rewrites (/api, /calc, /auth)                      │
       ▼                                                     │
Cloud Run (panelin-calc, us-central1)  ◄─────────────────────┘
  Express monolith (server/index.js 1196 lines)
  ├─ /calc/*          → calc.js + utils/calculations.js
  ├─ /api/agent/*     → agentChat (SSE), superAgent, tools (loopback to calc)
  ├─ /api/* (crm, quotes, wolfboard, bmcDashboard, identity, tasks, ...)
  ├─ /webhooks/whatsapp, /webhooks/ml, /webhooks/shopify
  ├─ Background: WA SLA/followup/enricher workers, marketIntel scheduler,
  │                transportista outbox, traktime mirror, orphan closer
  └─ Integrations:
       - Google Sheets (MATRIZ pricing + CRM_Operativo via service account)
       - Supabase (auth, tasks+Calendar, pgvector RAG, WA tables)
       - Drive (user GIS + service account uploads)
       - ML (OAuth + webhooks + auto-answer)
       - WA Cloud API + cockpit + extension
       - Shopify (shop-chat-agent sub-project)
       - Email bridge (external)

Third Parties
  - MercadoLibre, WhatsApp Meta, Shopify, Google (Sheets/Drive/Tasks/Calendar/Auth)
  - Supabase, Vercel, Cloud Run (GCP)
```

## Component Map
- **Frontend (src/):** Calculator (PanelinCalculadoraV3*), Hub modules (AdminCotizaciones, MlOperativo, WaCockpit, Wolfboard, Tareas, TrakTime, etc.), Auth, PDF, 3D/2D viz, contexts (BmcAuthProvider).
- **Backend Core (server/):** index.js (monolith), routes/* (30+), lib/* (agentCore, calcLoopbackClient, signatures, identityAuth, workers), config.js (single source of truth for all env).
- **Sub-projects:** shop-chat-agent/ (independent Node/Prisma for Shopify questions/quotes).
- **Data:** Sheets (business editable), Supabase (structured + auth + vector), GCS (tokens, PDFs, quotes).
- **External:** ML UY, WA Cloud, Google ecosystem.

## Data Flow — Quotation Pipeline (simplified)
1. User configures panels (walls/roof/custom) in React calculator.
2. POST /calc/cotizar (or via agent tool loopback) → pricing from baked constants + live MATRIZ reconcile.
3. Result → PDF (server Chromium or html2pdf), optional Drive upload (user scope), quote registry.
4. Operator side: quote appears in Admin Cotizaciones / Wolfboard → Sheets CRM_Operativo (dual write).
5. Channel intake (ML questions, WA messages, Shopify) → suggest-response (AI) → operator approve → publish answer or create quote.

## API Contract Summary (selected)
- Public-ish: /calc/cotizar, /calc/cotizar/pdf, /calc/cotizaciones (some auth optional).
- Operator: /api/crm/*, /api/quotes, /api/agent/chat (SSE), /api/identity/me, /api/tasks/*, /api/wolfboard/*, /hub/* (SPA).
- Webhooks: /webhooks/whatsapp (HMAC), /webhooks/ml (signature + verify token), /webhooks/shopify.
- Internal: /api/internal/panelin, /api/internal/presup (for agent tools).

See API-REFERENCE.md for full schemas.

## Database / Storage
- Google Sheets: multiple tabs (MATRIZ canonical, CRM_Operativo, Admin., Pagos, etc.).
- Supabase Postgres: identity tables, tasks (with due_time, recurrence, calendar_event_id), pgvector for RAG, wa_* tables (via wa-package migrations), transportista, traktime.
- GCS: quote PDFs, tokens (ML), signed evidence.

## Deployment
- Frontend: Vercel (vercel.json proxy + strong headers).
- Backend: Cloud Run (single service, Secret Manager for keys, Cloud Build deploys).
- CI: GitHub Actions (lint, test:api, gate, smoke:prod with MATRIZ canary, scheduled jobs).

**Current reality:** One-process monolith behind split frontend/backend deployment. Strong recent moves toward contracts (loopback) and secret hygiene.

---
*Update this document on major boundary changes. Cross-references: ARCHITECTURE-DECISIONS.md, SYSTEM-DESIGN.md (this file), README.md.*
