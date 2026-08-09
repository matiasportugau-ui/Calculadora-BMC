# Domain store analysis (post user review)

## Misread corrected
The Grok UI shows folders like "Obra Industrial Norte - Techos EPS". That is **sample content**, not the data model.

## Required durable objects
1. **Customers** — master commercial party (RUT, phones, address, tags, channel source)
2. **Quotes** — first-class cotización (code, totals, status, payload_json, links)
3. **Files** — arbitrary artifacts (PDF/XLSX/img/plan) linked to customer/project/quote/session
4. **Projects** — flexible containers (any obra name); optional customer link
5. **Sessions** — chat+workflow instances; optional quote link
6. **ChangeRequests** — HITL for quote revisions + knowledge/skills
7. **KnowledgeDocs** — proposed/indexed corpus
8. **Workflows/Skills/AgentConfig** — control plane

## As-built (`000_init.sql`)
Has: workspaces, projects, sessions, files, knowledge, skills, workflows, agent_configs, change_requests (limited types), telemetry.  
**Missing P0:** customers, quotes, quote-typed CRs, rich file metadata.

## Search/filter UX target
- Global search across customers / quotes / files
- Sidebar: Customers | Projects | Quotes | Files | Sessions
- Not fixed "Obra Norte" hardcode

## Integration later
- Omni `omni_contacts` / CRM Sheets: link external_id, do not block MVP store
