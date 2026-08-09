# BMC Inbound Messages Research — July 2026 Summary + Action

**Source PDF:** `~/Library/Mobile Documents/com~apple~CloudDocs/Descargas Icloud /BMC_Inbound_Messages_Research_Report_July2026.pdf` (3 pages, dated 2026-07-08)

**Title:** BMC CONVERSATIONAL OS — Inbound Message Management Platform Research — Modular Architecture Recommendation

---

## Executive Summary (from report)

- Mercado Libre (ML) is LATAM-dominant and region-locked. Deep coupling risks downgrading the global/pack appeal of BMC Conversational OS.
- **Core Recommendation**: Decouple ML into a **pluggable, optional module/adapter**.
- Primary inbound engine should be built on best-in-class **global conversational CRMs**: 
  - **Kommo** (amoCRM) — strong pipelines, LATAM presence, ~$15/user/mo.
  - **Respond.io** — superior AI agents, unified inbox, workflows, ~$99+/mo team plans (MAC pricing).
- Other notables: Crisp, Spur, eDesk (ecom context), Trengo.
- Recommended layered architecture:
  1. **Core Inbound Engine** (Kommo or Respond.io): WA + IG + FB + Email + unified AI + lead/CRM.
  2. **ML Pluggable Adapter** (optional): Lightweight (FastAPI + webhooks + Albato bridge) to pull orders/questions/claims into core or dedicated queue. Toggleable per region/deployment.
  3. AI Agent Layer + Data/Sync + Custom frontend (or embed).
- Benefits: Keeps core premium/global while retaining LATAM power via adapter. Avoids "polluting" architecture.

**Roadmap phases (high-level):**
- Phase 0: Current state audit (sources, volumes, pain points, existing ML flows).
- Phase 1: Prototype core on Kommo/Respond trial.
- Phase 2: ML adapter MVP.
- etc.

**Risks**: Sync issues (use webhooks + queues), lock-in (maintain abstraction), costs (workspace pricing).

---

## Current BMC State (as of 2026-07-08, Wolfboard HUB + omni)

BMC has **already built significant custom "Conversational OS" pieces** aligned with (and in some ways ahead of) the report's layered idea:

### Wolfboard HUB (`/hub`)
- Central operator dashboard (`BmcWolfboardHub.jsx`).
- Existing inbound-related cards (pre-research):
  - **Mercado Libre · Operativo** (`/hub/ml`)
  - **Mercado Libre · Manager** (`/hub/ml-manager`) — edit listings, questions, orders.
  - **WhatsApp · Operativo** (`/hub/wa`)
  - **Canales · Inbox unificado** (`/hub/canales`) — "tabla única ML + WA + IG/FB", sync to planilla, copy AF, save quote links. Powers Omni Inbox (Chatwoot-style), WA Inbox, ML Manager panels, Contacts, Deals Kanban.
  - **Ingreso y actualización Admin** (`/hub/admin-ingreso`) — IA interpretation of sheet consultas (col I → J/K/L), chat with Gemini/Panelin, save before quoting.
  - Admin Cotizaciones / Admin 2.0 (`/hub/admin` or `/hub/cotizaciones`).
- New **provisional card added** (this investigation): "Conversational OS · Inbound (Provisional)" — surfaces the report + links directly to working tools as "core + adapter".

### Backend / Data
- Heavy investment in **omni layer** (`server/lib/omni/`, omni_* Postgres tables, ai_jobs, suggestions).
- WA canonical + crm sync jobs (wa_crm_sync), feature flags (`OMNI_*`, `VITE_OMNI_INBOX`, `VITE_OMNI_DEALS`).
- ML: dedicated clients, webhooks, ml-crm-sync, ETL.
- **Presupuestacion orchestrator** + sheet quote pipeline + Panelin IA for turning inbound → structured quotes/PDFs/WA.
- Primary source of truth: Google Sheets (`CRM_Operativo`).
- Recent (Jun-Jul 2026): Massive omni/WA unification work, admin-ingreso launch, control plane for assistants (`canales;ml;panelin`).

**Key alignment**: 
- ML handling is already somewhat separated (dedicated modules + syncs) → good candidate for "pluggable adapter".
- Canales/omni + admin-ingreso + presup = in-house "core inbound + AI + quoting" (provisional implementation of report's vision).
- No current usage of Kommo, Respond.io, Albato, or n8n/Zapier for core inbox (research is fresh).

**Gaps vs report**:
- No external unified conversational CRM trial yet.
- Custom stack = high control + maintenance (monolith risks noted in audits).
- Sheets as CRM may limit advanced pipeline/AI depth vs Kommo/Respond.
- Volumes/pain points audit (Phase 0) not explicitly documented in one place.

---

## Recommended Immediate Action (Pragmatic)

**Preferred path per user objective**: "research and adapt a provisional module in wolfboard HUB **or just integrate an already existing and working tool right now**".

→ **Just integrate / surface the already-working tools + adapt Wolfboard with provisional visibility**.

**Done in this session**:
- Added prominent provisional card in `BmcWolfboardHub.jsx` ("Conversational OS · Inbound (Provisional)") with:
  - Report context (core vs ML adapter).
  - Direct CTAs to **existing production tools**: Canales (core), Admin Ingreso (interpret), ML Manager (adapter).
- Minor update to ML Operativo card to label it as "pluggable adapter".
- This makes the research immediately actionable inside the operator hub without new vendor onboarding, trials, or big refactors.

**Next quick wins (Phase 0 style)**:
1. Map current inbound sources/volumes (Sheets + omni tables + ML/WA metrics) — use existing `/api/omni/*`, wolfboard endpoints, or run a quick audit script.
2. Make ML sync more explicit "adapter" (toggleable, dedicated lightweight service surface if needed, or document Albato/Zapier paths).
3. Evaluate 7-14 day trials of Kommo or Respond.io **in parallel** (low risk): focus on WA/IG unified inbox + AI agents + Sheets/CRM export + API/MCP extensibility. Use as "core" while keeping custom quoting (presup orchestrator) + Wolfboard frontend.
4. If staying custom: promote Canales/omni as the "core", harden the abstraction layer, finish omni feature flags rollout.
5. Update docs (this file + PROJECT-STATE) and run operator training on the new provisional card + existing flows.

**Why not full external immediately?**
- Strong existing investment in working omni + presup + wolfboard (delivers value today).
- "Provisional module" in HUB + links lets operators use best current tools while architecture discussion continues.
- Modular recommendation from report is **already partially realized** by the separation of ML cards/modules vs canales/omni.

---

## References & Links (internal)

- PDF: iCloud Descargas Icloud / BMC_Inbound_Messages_Research_Report_July2026.pdf
- Hub: `src/components/BmcWolfboardHub.jsx` (provisional card added)
- Canales: `src/components/BmcCanalesUnificadosModule.jsx`, `src/components/hub/canales/`
- Wolfboard routes: `server/routes/wolfboard.js`
- Omni/WA: `server/lib/omni/`, `server/routes/omni.js` (and wa*)
- Presup: `server/lib/presupOrchestrator.js`
- Admin ingreso: `src/components/AdminIngresoModule.jsx`, `/hub/admin-ingreso`
- Feature flags: VITE_OMNI_INBOX, OMNI_*, ASSISTANTS_ACTIVE
- Related: sheet-quote-pipeline skill, presupuestacion-orchestrator skill, useOmniConversations hook

**Report conclusion (verbatim spirit)**: "Separating Mercado Libre as a modular, optional component is the correct strategic move."

Current BMC custom stack + this provisional surfacing in Wolfboard = pragmatic bridge to that architecture.

---
Generated during investigation 2026-07-08. Update as trials or audits progress.
