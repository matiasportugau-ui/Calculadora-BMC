# Omni Hub Discovery — Index

**Audit:** EXPORT_SEAL::OMNI_HUB_DISCOVERY_MASTER_V1  
**Date:** 2026-06-22  
**Repo SHA:** `d04a7f4`  
**Repository:** calculadora-bmc (BMC Uruguay / Panelin)

Read-only architectural discovery. No code changes. Every claim in child documents includes evidence blocks.

---

## Deliverables

| # | Document | Scope |
|---|----------|-------|
| 1 | [01-current-system-map.md](01-current-system-map.md) | Modules, domains, services, integrations, jobs, workers, cron, channel adapters |
| 2 | [02-channel-map.md](02-channel-map.md) | WhatsApp, MercadoLibre, Email, Instagram, Facebook |
| 3 | [03-api-map.md](03-api-map.md) | ~375 HTTP endpoints (340 router + ~35 inline) |
| 4 | [04-database-map.md](04-database-map.md) | Postgres, Supabase, SQLite, Sheets; omni_* focus |
| 5 | [05-frontend-map.md](05-frontend-map.md) | `/hub/canales`, `/hub/wa-inbox`, `/hub/ml-manager` |
| 6 | [06-ai-map.md](06-ai-map.md) | agentCore, agentChat, classifiers, RAG, providers |
| 7 | [07-security-map.md](07-security-map.md) | JWT, RBAC, HMAC, rate limits, SSRF, validation |
| 8 | [08-omni-gap-analysis.md](08-omni-gap-analysis.md) | Current vs target OmniCRM architecture |
| 9 | [09-scorecard.md](09-scorecard.md) | 0–100 scores per area |
| 10 | [10-architecture-review.md](10-architecture-review.md) | Omni Normalizer, migrations, engines, PR roadmap |

---

## Key findings (executive)

1. **WhatsApp and MercadoLibre** are production-grade (**75/100** each): webhooks, auth, outbound, CRM integration.
2. **Email, Instagram, Facebook** are partial (**25/100**): classification or ingest only; no full channel stack.
3. **Omni Hub** is **documented only** (**25/100**): `omni_*` DDL in docs; zero runtime in `server/`.
4. **Interim omnichannel** runs on **Google Sheets CRM_Operativo** + `/hub/canales`, not omni Postgres.
5. **API surface:** 340+ mounted router endpoints; `webhooks.js` stub not mounted.
6. **Security:** Strong JWT/RBAC/HMAC; factual open routes on CRM AI and many Sheets GETs.

---

## Classification legend

| Status | Meaning |
|--------|---------|
| IMPLEMENTED | Runtime code present and wired |
| PARTIAL | Some layers exist |
| DOCUMENTED_ONLY | Design/docs only |
| NOT_FOUND | No evidence in repo |

---

## Related canonical docs

- [OMNI-HUB-ARCHITECTURE.md](../team/OMNI-HUB-ARCHITECTURE.md)
- [omni-hub-schema.sql](../team/omni-hub-schema.sql)
- [google-sheets-module/README.md](../google-sheets-module/README.md)

---

## Transformation package (implementation design)

**Program:** EXPORT_SEAL::OMNICRM_AUTONOMOUS_TRANSFORMATION_PROGRAM_V2  
**Date:** 2026-06-22

Discovery audit → full transformation design (20 documents + 10 ADRs). Design only — no runtime code.

| Entry | Document |
|-------|----------|
| Index | [../transformation/README.md](../transformation/README.md) |
| Executive | [../transformation/01-executive-summary.md](../transformation/01-executive-summary.md) |
| Target state | [../transformation/02-target-state.md](../transformation/02-target-state.md) |
| Migration | [../transformation/12-migration-strategy.md](../transformation/12-migration-strategy.md) |
| PR roadmap | [../transformation/13-pr-roadmap.md](../transformation/13-pr-roadmap.md) |
| ADRs | [../transformation/adrs/](../transformation/adrs/) |
| Self-critique | [../transformation/SELF-CRITIQUE.md](../transformation/SELF-CRITIQUE.md) |
