# Calculadora-BMC

**Real-time quotation calculator for BMC Uruguay (METALOG SAS) — sandwich panels (EPS, PIR, 3G).**

Brands: ISOFRIG, ISOPANEL, ISOWALL, ISOROOF, ISODEC.  
Dual price lists (web / venta), 22% IVA, complex dimension-based calculations for walls and roofs.

**Live:** https://calculadora-bmc.vercel.app  
**API health:** https://panelin-calc-q74zutv7dq-uc.a.run.app/health (HTTP 200)

## Quick Start (Local)

```bash
# 1. Clone + install
git clone <repo>
cd calculadora-bmc
npm install

# 2. Environment (copy example, fill required keys for full features)
cp .env.example .env
# Required for full stack: DATABASE_URL, GOOGLE_APPLICATION_CREDENTIALS (or Secret Manager), etc.
# See server/config.js for all options.

# 3. Run full stack (API :3001 + Vite :5173)
npm run dev:full
# Or separately:
#   npm run start:api   # backend only
#   npm run dev         # frontend only (after version:data)

# 4. Gates (run before any PR)
npm run gate:local          # lint + test + test:api
npm run gate:local:full     # + build
npm run smoke:prod          # against live API (MATRIZ CSV is critical)
```

First local run will open the calculator at http://localhost:5173.

## Architecture Overview

**Frontend (Vercel):** React 18 + Vite SPA.  
Main calculator (lazy-loaded), 20+ operator hub modules (/hub/*), 3D/2D roof visualization, PDF generation, Google Drive GIS integration, RBAC via BmcAuthProvider + RequireGrant.

**Backend (Cloud Run):** Express 5 monolith (`server/index.js`, 1196 lines).  
Public calc routes, AI agent surface (SSE + tools with calc loopback), all operator APIs, webhooks (WA, ML, Shopify with signature verification), background workers (WA SLA, follow-ups, market intel, etc.).

**Data & Integrations:**
- Pricing source of truth: Google Sheets MATRIZ (BROMYROS) + baked constants + reconcile scripts.
- CRM / operations: Multiple Sheets tabs (CRM_Operativo, Admin., etc.) + Supabase (auth, tasks+Calendar, pgvector RAG, WA tables).
- Channels: MercadoLibre (OAuth + webhooks + auto-answer), WhatsApp Cloud API + cockpit + browser extension, Shopify (separate shop-chat-agent sub-project), email bridge (external).
- Drive: User OAuth (GIS, drive.file) for quote storage + service account for mirrors.

**Deployment:** Vercel SPA with proxy rewrites for /api /calc /auth → Cloud Run. Strong security headers on edge. Secrets increasingly in GCP Secret Manager.

See SYSTEM-DESIGN.md for diagrams and detailed flows. See ARCHITECTURE-DECISIONS.md for key trade-offs (monolith, Sheets+Supabase hybrid, etc.).

## Running Full Stack

```bash
npm run dev:full          # concurrent API + Vite
npm run start:api         # API only (watch mode: npm run dev:api)
./run_full_stack.sh       # alternative launcher
```

Disk precheck runs automatically before dev/build (disable with BMC_DISK_PRECHECK_SKIP=1 if needed).

## API Reference

See [API-REFERENCE.md](API-REFERENCE.md) for full endpoint list, schemas, auth requirements, and examples.

Key surfaces:
- Calculator: `POST /calc/cotizar`, `POST /calc/cotizar/pdf`
- Agent: `POST /api/agent/chat` (SSE)
- Identity: `/api/identity/me`, Google OAuth, MFA
- Channels: `/webhooks/whatsapp`, `/webhooks/ml`, `/webhooks/shopify`
- Operator: `/api/quotes`, `/api/crm/*`, `/api/wolfboard/*`, `/api/tasks/*`

## Contributing

1. Read `AGENTS.md` (mandatory for agents and humans).
2. `npm run lint` after any `src/` change.
3. `npm run gate:local` before opening PR.
4. Update `docs/team/PROJECT-STATE.md` under "Cambios recientes" for behavioral changes.
5. Never commit secrets. Use `.env` + `server/config.js`.

Pre-deploy checklist: `npm run pre-deploy`.

## Deployment

- Frontend: Vercel (automatic on push to main via workflow).
- Backend: Cloud Run via Cloud Build / GitHub Actions.
- Smoke after deploy: `npm run smoke:prod` (MATRIZ CSV + health + suggest-response are critical).

See `docs/procedimientos/` and `.github/workflows/` for details. Recent infra hardening moved secrets to Secret Manager and tightened IAM.

## License

UNLICENSED (BMC Uruguay / METALOG SAS internal + partners).

---
*Professional README generated as part of the 2026-06-07 technical audit. Cross-references: SYSTEM-DESIGN.md, API-REFERENCE.md, IMPROVEMENTS-ROADMAP.md, AGENTS.md.*
