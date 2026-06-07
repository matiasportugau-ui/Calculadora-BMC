# API-REFERENCE.md

**Project:** Calculadora-BMC  
**Date:** 2026-06-07  
**Base URLs:**  
- Local: http://localhost:3001  
- Prod: https://panelin-calc-q74zutv7dq-uc.a.run.app (proxied via Vercel for SPA)

Authentication:  
- Service/cron: `Authorization: Bearer ${API_AUTH_TOKEN}` or `X-Api-Key`.  
- Operator users: Supabase identity JWT (via BmcAuthProvider) + module grants (read/write/admin).  
- Public calc paths: often optional auth.

Error semantics: 503 = external (Sheets/DB) unavailable; 200 + empty = no data (never 500 for transient external).

## Core Calculator

### POST /calc/cotizar
Generate quotation for wall or roof configuration.

**Request (example):**
```json
{
  "tipo": "techo" | "pared",
  "escenario": "...",
  "perfil": "...",
  "largo": 10.5,
  "ancho": 6.2,
  ...
}
```

**Response:** Quotation object with items, totals (sin IVA), BOM, etc.  
**Auth:** Optional for basic use; required for persistence.  
**Rate limit:** None (public calculator).

### POST /calc/cotizar/pdf
Generate PDF (server-side Chromium preferred, html2pdf fallback).

**Auth:** Optional.

### GET /calc/cotizaciones
List persisted quotes (with filters).

**Auth:** requireAuth (dual token/JWT).

## Agent / AI Surface

### POST /api/agent/chat
Server-Sent Events (SSE) conversational agent with tool use (calc, quotes, knowledge).

**Auth:** API token or user JWT (dev mode can relax).

**Special internal routes (for agents/tools):**
- /api/internal/panelin
- /api/internal/presup

## Identity & Auth

- GET/POST /api/identity/me
- /auth/google/* (Google OAuth login + MFA)
- /auth/mfa/*
- TOTP setup/challenge flows.

**RBAC:** RequireGrant for module-scoped actions (used on admin export, tasks, certain quotes).

## Operator / CRM

- /api/quotes (CRUD + export)
- /api/crm/* (suggest-response, parse, ingest-email, cockpit)
- /api/wolfboard/*
- /api/bmc-dashboard/* (Sheets-backed)
- /api/admin/* (users, grants, analytics — superadmin)

## Channels & Webhooks

### WhatsApp
- GET /webhooks/whatsapp (Meta verification — requires WHATSAPP_VERIFY_TOKEN)
- POST /webhooks/whatsapp (messages/statuses — requires WHATSAPP_APP_SECRET for HMAC x-hub-signature-256; skips if absent with warning)

### MercadoLibre
- POST /webhooks/ml (signature verification via x-signature + client secret; secondary verify_token)
- /auth/ml/* (OAuth start/callback/status)
- /ml/* (questions, orders, users/me, answer publication)

### Shopify
- /webhooks/shopify (raw body + HMAC via SHOPIFY_WEBHOOK_SECRET)
- /auth/shopify/* (OAuth)

## Tasks / Transportista / TrakTime

- /api/tasks/* + /auth/tasks (Google Tasks + Calendar pairing, PKCE OAuth)
- /api/transportista/*
- /api/traktime/*

## Other Notable

- /api/pdf (generate/preview)
- /api/marketing, /api/aiAnalytics
- /api/followups
- Legacy: /legacyQuote

## Pagination, Sorting, Errors
- Most list endpoints support cursor/keyset or offset/limit where appropriate.
- Standard error shape: `{ ok: false, error: string, ... }`
- 401/403 for auth failures; 503 for external dependency unavailable.

Full OpenAPI fragments and examples live in `docs/openapi*.yaml` and individual route files.

For agent tool contracts see `server/lib/agentTools.js` and docs/team/panelsim/AE-AGENT-CALC-CONTRACT.md.

---
*Generated from live route mounts in server/index.js + config + route files. Update on new top-level surfaces.*
