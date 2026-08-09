# Evidence — PEA research baseline (2026-08-09)

Source: repo audit + ChatGPT architecture pass (Vercel/Cloud Run/CI/auth/tools/budget).  
Tags: CONFIRMED in tree; UNKNOWN = live console not probed in this pass.

| Topic | Verdict |
|-------|---------|
| FE Vercel / API Cloud Run | CONFIRMED |
| Persist hybrid Sheets/PG/GCS/files | CONFIRMED |
| Pub/Sub | Not found; in-memory bus + PG jobs |
| omni_ai_jobs SKIP LOCKED | CONFIRMED pattern |
| Soft budget memory / default off | CONFIRMED |
| Staging isolated | Treat absent / UNKNOWN live |
| GapEvent → Architect | Not shipped (0%) |
| Header role / default director risk | CONFIRMED in audit narrative — verify on code touch IMP-05 |

Live probe checklist: IMP-PEA-00 → `live-probe.md`.
