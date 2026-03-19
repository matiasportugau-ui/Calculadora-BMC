# Report: Study Improvements — 2026-03-18

**Run type:** Analysis only (no implementation).  
**Source:** Full team evaluation of external study "Análisis Integral y Modernización de la Arquitectura de Gestión Comercial".  
**Input:** [STUDY-ANALYSIS-INPUT-2026-03-18.md](./STUDY-ANALYSIS-INPUT-2026-03-18.md).

---

## Executive summary

The full BMC Dashboard team (19 roles) evaluated the study and produced a single list of **improvements we can get** by area. All items are recommendations only; no code, config, or Sheets/triggers were changed. Priorities are P1 (high impact / align with roadmap), P2 (medium), P3 (nice-to-have).

---

## 1. Mapping (Planilla vs Dashboard)

| Prio | Improvement | Rationale |
|------|-------------|-----------|
| P1 | Align planilla-inventory with study topology: single transactional "Admin." tab (fact-table only), separate "view" tabs (Esperando, Histórico). | Study enforces decoupling view vs data; current CRM_Operativo mixes both; reduces trigger/UI drift. |
| — | **Nota:** Tab real en workbook Pagos 2026 es "Pendientes_"; "Pagos_Pendientes" es nombre lógico/API. planilla-inventory ya documenta esta distinción. | Evita confusión al mapear webhooks→Sheets. |
| P1 | Document column taxonomy in planilla-inventory: Cliente, Teléfono-Contacto, Orig., Dirección/Zona, Asig., Estado, Consulta, Relleno, Largo, Ancho, Color. | Study defines canonical columns; today we have Teléfono, Consulta/Pedido, etc.; alignment enables webhook→Sheets mapping. |
| P2 | Add Origen (WA, EM, ML, LL, CL) and Estado as first-class enums in planilla-inventory and DASHBOARD-INTERFACE-MAP. | Study uses strict dropdowns; we currently have free-text Estado; improves filtering and reporting. |
| P2 | Cross-reference DASHBOARD-INTERFACE-MAP with study "Platform→payload→Sheets" mapping (Meta Lead Ads, ML, WhatsApp). | Single source of truth for which UI block reads which column after webhook ingest. |

---

## 2. Design (UX/UI)

| Prio | Improvement | Rationale |
|------|-------------|-----------|
| P1 | Separate "Admin" (transactional) view from "read-only" views in dashboard; loading/error states per block. | Study: decouple view from data; time-saving and fewer misclicks. |
| P1 | Consistent loading and error states for all KPI cards and tables (skeleton, 503 message, retry). | Study emphasizes UX clarity; today some blocks fail silently or show raw errors. |
| P2 | Time-saving: one-click "Copiar WhatsApp" and "Marcar entregado" already exist; extend to bulk actions where study suggests (e.g. state "Enviado" batch). | Reduces repetitive actions. |
| P3 | Morning executive report (email) and stock-alert view (/admin/stock-alert) as in study. | Improves daily workflow without touching core data model. |

---

## 3. Dependencies (Service map & architecture)

| Prio | Improvement | Rationale |
|------|-------------|-----------|
| P1 | Add webhook entry point and Cloud Tasks to dependency graph and service-map.md: doPost(e) → 200 OK → enqueue → async processing. | Study v4.0 decouples response time from heavy work; we currently have no webhook path in service map. |
| P1 | Document FastAPI/Cloud Run (v4.0) as future dependency: gspread, Cloud Tasks, us-central1. | Aligns roadmap with study; dependencies.md today is Express/Node-only. |
| P2 | Map "RegEx parser → calculation engine → Matriz Costos 2026" as a dependency chain in dependencies.md. | Study defines clear pipeline; we have calc/5173 and Sheets; explicit chain helps Contract and Calc. |
| P2 | Add Apps Script (Code.gs, DialogEntregas, triggers) as first-class node in service map. | Study relies on Apps Script for ingest and automation; currently under-documented. |

---

## 4. Contract (API vs study payloads)

| Prio | Improvement | Rationale |
|------|-------------|-----------|
| P1 | Define contract for webhook ingestion: POST body schema (Meta Lead Ads, ML, WhatsApp) → column mapping; 200 OK within &lt;200 ms. | Study specifies payload→column mapping; contract prevents drift when implementing doPost. |
| P1 | Extend API contract for new endpoints: e.g. GET /admin/stock-alert, POST /webhooks/meta, /webhooks/ml, /webhooks/wa with HMAC. | Ensures planilla-inventory and DASHBOARD-INTERFACE-MAP stay in sync with new routes. |
| P2 | Contract for "state" values (e.g. CONTACTAR, Enviado) and Origen enum so UI and Sheets validate consistently. | Study uses strict Estado/Origen; avoids typo-sensitive triggers. |

---

## 5. Networks (Hosting & infra)

| Prio | Improvement | Rationale |
|------|-------------|-----------|
| P1 | Plan webhook URLs for production: HTTPS, fixed host (Cloud Run or VPS Netuy), path /webhooks/*. | Study requires 200 OK fast; ngrok is dev-only; production needs stable URLs for Meta/ML/WA. |
| P1 | Document latency budget: webhook response &lt;200 ms, heavy processing via Cloud Tasks. | Study explicitly separates fast response from async; avoids timeouts and provider retries. |
| P2 | Evaluate Cloud Run us-central1 vs VPS Netuy for v4.0 (FastAPI, Docker, GitHub Actions). | Study recommends Cloud Run; we have existing Netuy option; decision affects CI/CD and cost. |

---

## 6. Integrations (WhatsApp, ML, Meta, Shopify)

| Prio | Improvement | Rationale |
|------|-------------|-----------|
| — | **Shopify:** Ya existe /webhooks/shopify. Usar como referencia para HMAC y payload→Sheets al implementar Meta/ML/WA. | service-map documenta Shopify; mismo patrón para nuevas integraciones. |
| P1 | WhatsApp Cloud API: HMAC/SHA-256 validation, messages.text.body→Consulta, wa_id→Teléfono-Contacto. | Study defines ingest; we have Shopify/ML; adding WA completes omnicanal. |
| P1 | Mercado Libre: ping-pull + token refresh; resource→GET→Consulta, Origen=ML. | Study mapping; we have OAuth; ensure refresh and payload→Sheets are documented and robust. |
| P1 | Meta Lead Ads: lead_id→Graph API→Cliente/Tel/Correo; webhook POST→200, enqueue. | Study flow; new integration; enables lead capture without manual entry. |
| P2 | Outbound WhatsApp: Template Message with PDF URL, state→"Enviado"; cron 7/3/1 days reminder. | Study outbound flow; we have coordinacion-logistica copy; automation reduces manual follow-up. |

---

## 7. Security

| Prio | Improvement | Rationale |
|------|-------------|-----------|
| P1 | HMAC validation for all webhook origins (Meta, ML, WhatsApp) before processing. | Study mandates; prevents forged payloads and replay. |
| P1 | No credentials in code; env-only (tokens, API keys); human checkpoints for sensitive steps (IA agent 15–20 min, no payment/CAPTCHA bypass). | Study security constraints; aligns with our AGENTS.md and bmc-security-reviewer. |
| P2 | 2FA and CAPTCHA: never bypass in automation; document in security runbook. | Study explicitly restricts IA agent; applies to any bot/cron. |

---

## 8. GPT/Cloud

| Prio | Improvement | Rationale |
|------|-------------|-----------|
| — | **Panelin Evolution (3847):** Ya implementa chat GPT + fallback respuesta rápida. Mantener alineado con migración Assistants→Responses. | Link #invoque → localhost:3847; docs/team/PANELIN-EVOLUTION-FLOW.md. |
| P1 | Plan migration from OpenAI Assistants API to Responses API + Agents SDK before deprecation (Aug 2026). | Study calls out deprecation; we use GPT Builder and OpenAPI; avoid last-minute break. |
| P1 | Keep OpenAPI and GPT Builder in sync with new webhook and admin endpoints when implemented. | Prevents drift between Cloud runtime and GPT actions. |
| P2 | Document "IA agent constraints" (Cursor/Claude in Chrome): config only Meta/DB, no credentials, 15–20 min sessions. | Study limits; useful for future agent-based tooling. |

---

## 9. Fiscal (Oversight & efficiency)

| Prio | Improvement | Rationale |
|------|-------------|-----------|
| P1 | Quantify efficiency gain: manual data entry vs automated ingest (webhooks, RegEx parser). | Study emphasizes automation; fiscal oversight benefits from cost-of-delay and time savings. |
| P1 | Align new flows (cobranza, señas, 40/60/100%) with PROJECT-STATE and FISCAL-PROTOCOL-STATE-RANKING. | Any new billing/state logic must be overseen per protocol. |
| P2 | Document alternativas (energía/tiempo/dinero) for v4.0 and webhook rollout. | Supports go/no-go and prioritization with Matias. |

---

## 10. Billing (Facturación)

| Prio | Improvement | Rationale |
|------|-------------|-----------|
| P1 | Cobranza preventiva: use study cron (7/3/1 days before due) and state "Enviado" to drive reminder list. | Reduces late payments; aligns with existing Pagos_Pendientes and FECHA_VENCIMIENTO. |
| P1 | Señas and 40/60/100%: document in planilla-inventory and billing-error-review scope. | Study references payment stages; we have MONTO, ESTADO; explicit rules reduce admin errors. |
| P2 | Monthly close: ensure audit trail (AUDIT_LOG) covers any new PUSH from webhooks and state changes. | Billing reviewer needs to trace origin of changes. |

---

## 11. Audit/Debug (Observability)

| Prio | Improvement | Rationale |
|------|-------------|-----------|
| P1 | Log webhook receipt and 200 OK timing; alert if response &gt;200 ms. | Study requires fast response; observability prevents silent degradation. |
| P1 | Structured logs for Cloud Tasks enqueue and processing (when implemented). | Run audit and debug without guessing where a payload was dropped. |
| P2 | Dashboard health: extend run_audit and E2E checklist to webhook endpoints and Apps Script triggers. | Ensures full stack visibility post–v4.0. |

---

## 12. Calc (Calculadora, BOM, PDF, 5173)

| Prio | Improvement | Rationale |
|------|-------------|-----------|
| P1 | RegEx parser: extract panel type (isopanel/isodec/isofrig), thickness (mm), dimensions (e.g. 20×12 m) → Relleno, Largo, Ancho. | Study automates Consulta→structured fields; today manual; 5173 and Drive can consume structured data. |
| P1 | Calculation engine: kerf, waste_total_m, accessories from "Matriz de Costos y Ventas 2026". | Study ties parser output to matrix; we have calc and Sheets; single source for margins. |
| P1 | PDF generation: template sheet clone, replaceText, hide empty rows, getAs('application/pdf'), save to Drive 2026 folder, link back to row. | Study flow; we have PDF in Calculadora; reuse pattern for Admin-Hub quotes. |
| P2 | Link PDF URL to outbound WhatsApp template message. | Closes loop: quote → PDF → send to client. |

---

## 13. Reporter (Implementation plans)

| Prio | Improvement | Rationale |
|------|-------------|-----------|
| P1 | Produce implementation plan (Solution/Coding) that sequences: webhook contract → Apps Script doPost → Cloud Tasks (optional) → RegEx + PDF → outbound WA. | Study gives phases; Reporter can break into handoffs and acceptance criteria. |
| P2 | Keep REPORT-SOLUTION-CODING and IMPLEMENTATION-PLAN in sync with this study report when work starts. | Single backlog; no duplicate or conflicting tasks. |

---

## 14. Sheets Structure (Tabs & dropdowns)

| Prio | Improvement | Rationale |
|------|-------------|-----------|
| P1 | Origen: dropdown (WA, EM, ML, LL, CL). Estado: dropdown (e.g. CONTACTAR, Enviado, …). Protected headers; no merged cells, no blank rows in fact tab. | Study data normalization; reduces typos and trigger failures (Matias-only edits). |
| P2 | Fact-table-only "Admin." tab; view tabs fed from formulas or scripts. | Study decoupling; structural change, not just validation. |

---

## 15. Orchestrator

| Prio | Improvement | Rationale |
|------|-------------|-----------|
| P2 | Use this report as input to next full team run: add "Study improvements" to PROMPT-FOR-EQUIPO-COMPLETO or IMPROVEMENT-BACKLOG-BY-AGENT. | Ensures follow-up runs consider study when implementing. |
| P2 | Optional: dedicate a run to "webhook + contract" only (Mapping, Contract, Security, Integrations). | Focused execution before broader v4.0. |

---

## 16. Judge

| Prio | Improvement | Rationale |
|------|-------------|-----------|
| P3 | Record this run in JUDGE-REPORT: analysis-only, 19/19 roles contributed to REPORT-STUDY-IMPROVEMENTS; no code changes. | Keeps historical record of analysis runs. |

---

## 17. Parallel/Serial

| Prio | Improvement | Rationale |
|------|-------------|-----------|
| P2 | When implementing study items: run Contract + Security in parallel after Mapping; run Integrations (WA, ML, Meta) in parallel where no shared state. | Study touches many areas; parallelization shortens time to value. |

---

## 18. Repo Sync

| Prio | Improvement | Rationale |
|------|-------------|-----------|
| P3 | When code/config changes from study are implemented, sync bmc-dashboard-2.0 and bmc-development-team; include this report in docs/team/reports/ in both repos if needed. | No sync this run (analysis only); future runs will push artifacts. |

---

## 19. Consolidated priorities (cross-cutting)

| Priority | Theme | Actions |
|----------|--------|--------|
| **P1** | Data quality & contract | Origen/Estado dropdowns; planilla-inventory column taxonomy; webhook POST contract and column mapping. |
| **P1** | Webhook & async | doPost(e) → 200 OK &lt;200 ms; HMAC; enqueue Cloud Tasks; Meta/ML/WA payload→Sheets. |
| **P1** | Calculadora & PDF | RegEx parser (Consulta→Relleno/Largo/Ancho); kerf/matrix; PDF template→Drive→link; WhatsApp template with PDF URL. |
| **P1** | Security & GPT | HMAC all webhooks; no credentials in code; plan Assistants→Responses API + Agents SDK migration. |
| **P2** | UX & observability | Admin vs view tabs; loading/error states; webhook and Task logging; cron 7/3/1 and stock-alert. |
| **P2** | Billing & fiscal | Cobranza preventiva; señas/40/60/100% in scope; efficiency and protocol alignment. |
| **P3** | Governance | Judge record; Repo Sync when implementing; Orchestrator backlog update. |

---

## 20. Fases de implementación

| Fase | Depende de | Items |
|------|-------------|-------|
| **1** | — | Contract webhook, HMAC, Origen/Estado dropdowns |
| **2** | 1 | doPost(e), Cloud Tasks, payload→Sheets |
| **3** | 2 | RegEx parser, PDF template→Drive, outbound WhatsApp |

**Quick wins (sin dependencias):** Origen/Estado dropdowns, loading/error states, documentar Apps Script en service-map.

---

**End of report.** No implementation was performed. Output for PROJECT-STATE: one entry in Cambios recientes (2026-03-18, full team analysis run, deliverable this file).
