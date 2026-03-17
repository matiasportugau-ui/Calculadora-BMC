# Universe brief: Invoque Panelin

**Source:** IA report (recommendation only); no implementation in DASHBOARD-VISUAL-MAP or evaluation report.

---

## Scope

- **From IA report:** “Invoque Panelin” is expected to evolve into an **OpenAI/GPT-powered agent module**. Not present in current docs or code as a dashboard section or feature.
- **Recommended (IA report):** **Hybrid** — (1) **Standalone section:** top-level nav item for a dedicated chat/agent experience; (2) **Transversal:** same agent available inside other modules (e.g. “Ask Panelin” in Cotizaciones, Operaciones, Finanzas) for contextual help.

## Data

- **Uncertain:** No data sources or APIs documented. Likely: OpenAI/GPT API, optional backend proxy (run_proxy_openai.sh in package.json), session or conversation state. No Sheets or dashboard API tied to Invoque Panelin in repo.

## Tech

- **Entry:** None today. Future: one route or view for “Invoque Panelin” (standalone) and embedded entry points in other modules.
- **Stack:** Uncertain — iframe, same SPA, or separate backend; repo has `npm run proxy:openai` (run_proxy_openai.sh). No UI component or route found for Invoque Panelin.
- **Key files:** None identified; GPT/OpenAI integration may live in skills (e.g. openai-gpt-builder-integration, panelin-gpt-cloud-system) or external config.

## Users / personas

- **Inferred:** Any dashboard user wanting assistance: “help with this quote,” “explain this KPI,” “suggest next steps.” Not documented.

## Current pain points

- **From IA report:** Invoque Panelin not in docs; role and placement undefined. Need to add to IA as hybrid and document.

## Dependencies

- **On Shell:** Nav item “Invoque Panelin” and a route/view for standalone mode; ability to embed or open assistant in other sections.
- **On Cotizaciones / Operaciones / Finanzas:** Transversal entry points (e.g. floating button or “Ask Panelin” in header) that pass context (quote, delivery, KPI).
- **On Infra:** Possibly proxy or backend for GPT; auth if needed.

## Transversal entry points (spec, Step 4.2)

- **Modules:** Cotizaciones (Calculadora), Operaciones (/finanzas #operaciones), Finanzas (/finanzas #finanzas).
- **Placement options:** (a) One "Ask Panelin" in the **shell header** (visible on all sections). (b) Per-section button in each of the three modules.
- **Recommendation:** Shell header first for visibility; per-section can be added later for context.

## Uncertainties

- Full tech stack (iframe vs SPA vs external GPT Builder). Whether actions/instructions are in repo or only in OpenAI config. Exact UX for transversal (sidebar, modal, inline). No code or UI exists in repo for this module.
