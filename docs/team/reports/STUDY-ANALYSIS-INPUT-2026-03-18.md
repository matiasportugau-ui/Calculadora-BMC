# Study Analysis Run — 2026-03-18

**Run type:** ANALYSIS ONLY — evaluate improvements from external study. **Do not implement anything.**

---

## Instruction for Full Team (Orchestrator + all 19 roles)

1. **Read** this document and the study summary below.
2. **Execute** a full team run (steps 0→0b→1→…→8→9) with this **single agenda**:
   - Each role evaluates the study **from its area** (Sheets, Dashboard, Infra, Integrations, Security, GPT/Cloud, etc.) and lists **improvements we can get** from the study (prioritized, with rationale). No code or config changes.
   - **Reporter** consolidates all inputs into one artifact: `docs/team/reports/REPORT-STUDY-IMPROVEMENTS-2026-03-18.md`.
3. **Orchestrator** updates `docs/team/PROJECT-STATE.md` (Cambios recientes) with this run.
4. **No implementation:** No edits to bmcDashboard.js, Sheets, triggers, deploy, or any codebase. Output is evaluation and recommendations only.

---

## Study Summary: "Análisis Integral y Modernización de la Arquitectura de Gestión Comercial"

**Source:** External technical/architectural study (provided to the user 2026-03-18).

**Scope:** Planilla de Cotizaciones, Ventas Dashboard, flujos de automatización, and roadmap to "Panelin Admin-Hub v4.0".

### Main topics in the study

- **Current state:** Google Sheets as CRM backbone ("2.0 - Administrador de Cotizaciones", "2.0 - Ventas Dashboard"); multicanal (WhatsApp, Mercado Libre, email, phone); manual data entry; unstructured "Consulta" vs structured Relleno/Largo/Ancho/Color.
- **Vulnerabilities:** No referential integrity; no strict validation (Origen, Estado); presentation mixed with data; typo-sensitive triggers.
- **Proposed improvements:**
  - **Data normalization:** Dropdowns for Origen (WA, EM, ML, LL, CL) and Estado; protected headers; fact-table-only "Admin." tab; no merged cells, no blank rows.
  - **Decoupling:** Separate "view" tabs from transactional data tables.
  - **Webhooks / Apps Script:** doPost(e) web app; ingest from Meta Lead Ads, Mercado Libre (ping-pull + token refresh), WhatsApp Cloud API (HMAC/SHA-256 validation); payload→column mapping; 200 OK fast response; async processing (Cloud Tasks in v4.0).
  - **RegEx parser:** Extract panel type (isopanel/isodec/isofrig), thickness (mm), dimensions (e.g. 20 x 12 m), write to Relleno/Largo/Ancho; then calculation engine (kerf, waste_total_m, accessories from "Matriz de Costos y Ventas 2026").
  - **PDF generation:** Template sheet clone, replaceText, hide empty rows, flush(), getAs('application/pdf'), save to Drive 2026 folder, link back to row.
  - **Outbound WhatsApp:** Template Message with PDF URL; update state to "Enviado"; cron for reminder (7/3/1 days before due), stock alerts (/admin/stock-alert), morning executive report email.
- **v4.0 / Backend:** FastAPI, Cloud Run (us-central1), Docker, GitHub Actions CI/CD; Sheets as thin DB + UI; gspread; Cloud Tasks to decouple webhook response (<200ms) from heavy IA processing; migration from OpenAI Assistants API (deprecation Aug 2026) to Responses API + Agents SDK.
- **IA agent (Cursor/Claude in Chrome):** Config Meta apps (WhatsApp/Instagram), DB integrations; security: no credentials, no payment gateways, no CAPTCHA/2FA bypass; 15–20 min sessions; human checkpoints for sensitive steps.

### Key tables from the study

- Column taxonomy: Cliente, Teléfono-Contacto, Orig., Dirección/Zona, Asig., Estado, Consulta, Relleno, Largo, Ancho, Color.
- Platform→payload→Sheets mapping: Meta Lead Ads (lead_id→Graph API→Cliente/Tel/Correo); ML (resource→GET→Consulta, Origen=ML); WhatsApp (messages.text.body→Consulta, wa_id→Teléfono-Contacto).
- Flow phases: 1) Omnicanal capture (POST→200, enqueue Cloud Tasks); 2) Parse + sync (GET APIs, RegEx, append row "CONTACTAR"); 3) Parametric computation (kerf, matrix, margins); 4) PDF generation (template→Drive→link); 5) Outbound + alerts (WhatsApp template, state "Enviado", cron reminders/stock).

---

## What each role should deliver (evaluation only)

| Role | Focus | Output |
|------|--------|--------|
| Mapping | Planilla vs study topology; Admin/Esperando/Histórico; column alignment | Improvements for planilla-inventory, DASHBOARD-INTERFACE-MAP |
| Design | UX/UI for Admin vs view tabs; loading/error states; time-saving | UI/UX improvements from study |
| Dependencies | Service map, webhooks, Cloud Tasks, FastAPI↔Sheets | Dependency/architecture improvements |
| Contract | API contracts vs study payloads and endpoints | Contract improvements |
| Networks | Hosting, Cloud Run, latency, webhook URLs | Infra improvements |
| Integrations | WhatsApp, ML, Meta Lead Ads, token refresh, HMAC | Integration improvements |
| Security | HMAC, tokens, no credentials in code, checkpoints | Security improvements |
| GPT/Cloud | OpenAPI, deprecation, Responses API, Agents SDK | GPT/Cloud improvements |
| Fiscal | Efficiency, cost of manual vs automated, protocol alignment | Oversight improvements |
| Billing | Cobranza preventiva, señas, 40/60/100% | Billing improvements |
| Audit/Debug | Observability, logs, 200 OK timing | Audit improvements |
| Calc | BOM, kerf, matriz costos, PDF, 5173 | Calculadora/cotizaciones improvements |
| Reporter | Consolidate all into REPORT-STUDY-IMPROVEMENTS-2026-03-18.md | Single report |
| Others | As per PROJECT-TEAM-FULL-COVERAGE §2 | Brief improvement list for Reporter |

---

**End of input. Orchestrator: run full team with above agenda; Reporter: produce consolidated report.**
