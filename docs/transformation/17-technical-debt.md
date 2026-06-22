# 17 — Technical Debt Register

**Program:** EXPORT_SEAL::OMNICRM_AUTONOMOUS_TRANSFORMATION_PROGRAM_V2  
**Date:** 2026-06-22

---

## Priority legend

| Priority | Meaning |
|----------|---------|
| P0 | Blocks omni migration or security |
| P1 | High impact on operator UX or reliability |
| P2 | Medium — address during related track |
| P3 | Low — backlog |

---

## Debt items

### TD-001: omni_* documented but not implemented

| Field | Value |
|-------|-------|
| **Description** | Full DDL and API routes in docs; zero runtime in server/ |
| **Impact** | Doc/code drift; false confidence in omni readiness |
| **Risk** | High — teams build against non-existent APIs |
| **Priority** | P0 |
| **Remediation** | Track A PRs A1–A4 |
| **Owner** | Platform / Omni Core |

**Evidence:** `docs/discovery/04-database-map.md` — grep omni_ in server NOT_FOUND

---

### TD-002: Three parallel CRM data models

| Field | Value |
|-------|-------|
| **Description** | wa_*, CRM_Operativo Sheets, clientes.* without unified graph |
| **Impact** | Duplicate operator workflows; inconsistent contact data |
| **Risk** | High — migration complexity |
| **Priority** | P0 |
| **Remediation** | [12-migration-strategy.md](12-migration-strategy.md) |
| **Owner** | CRM Architecture |

---

### TD-003: Open suggest-response endpoint

| Field | Value |
|-------|-------|
| **Description** | POST /api/crm/suggest-response without auth |
| **Impact** | AI cost abuse; data exposure |
| **Risk** | High |
| **Priority** | P0 |
| **Remediation** | PR H1 |
| **Owner** | Security |

**Evidence:** `docs/discovery/07-security-map.md`; bmcDashboard.js L2311

---

### TD-004: SSRF protection absent

| Field | Value |
|-------|-------|
| **Description** | No outbound URL allowlist for agent/automation webhooks |
| **Impact** | Cloud metadata access if URL injectable |
| **Risk** | High before automation webhook_outbound |
| **Priority** | P0 |
| **Remediation** | SSRF middleware PR (H4 extension) |
| **Owner** | Security |

---

### TD-005: /hub/wa-inbox NOT_FOUND

| Field | Value |
|-------|-------|
| **Description** | Planned route missing; WaInboxPanel Phase 2 stub |
| **Impact** | UX fragmentation; wacrm fork pressure |
| **Risk** | Medium |
| **Priority** | P1 |
| **Remediation** | G1–G2 evolve canales (ADR-010) |
| **Owner** | Frontend / Workspace |

---

### TD-006: /hub/ml-manager PARTIAL

| Field | Value |
|-------|-------|
| **Description** | Frontend calls missing endpoints (e.g. /ml/messages/unread) |
| **Impact** | Broken ML manager tabs |
| **Risk** | Medium |
| **Priority** | P1 |
| **Remediation** | ML-MANAGER-ROADMAP backend routes OR defer scope |
| **Owner** | ML channel |

**Evidence:** useMlConnector.js L36–42

---

### TD-007: Three separate operator workspaces

| Field | Value |
|-------|-------|
| **Description** | /hub/canales, /hub/wa, /hub/ml — no shared thread view |
| **Impact** | Operator context switching; training burden |
| **Risk** | Medium |
| **Priority** | P1 |
| **Remediation** | Track G |
| **Owner** | Workspace |

---

### TD-008: Email channel PARTIAL (25/100)

| Field | Value |
|-------|-------|
| **Description** | Ingest API only; no UI; no SMTP outbound; external IMAP |
| **Impact** | Incomplete omni channel coverage |
| **Risk** | Medium |
| **Priority** | P2 |
| **Remediation** | Email adapter E1–E3; optional in-repo IMAP Phase 5 |
| **Owner** | Channels |

---

### TD-009: Instagram/Facebook filter-only

| Field | Value |
|-------|-------|
| **Description** | surface.js labels; no Meta Graph webhooks; sync-all skips |
| **Impact** | Cannot close omni on Meta channels |
| **Risk** | Medium — blocked on cm-0 |
| **Priority** | P2 |
| **Remediation** | Human gate then Meta adapters |
| **Owner** | Channels + Matias (cm-0) |

---

### TD-010: No centralized APM/tracing

| Field | Value |
|-------|-------|
| **Description** | pino only; no OTel |
| **Impact** | Hard to debug dual-write issues |
| **Risk** | Medium |
| **Priority** | P1 |
| **Remediation** | [10-observability-model.md](10-observability-model.md), H3 |
| **Owner** | Platform |

---

### TD-011: RAG disabled by default

| Field | Value |
|-------|-------|
| **Description** | RAG_ENABLED=false in config |
| **Impact** | Chat KB retrieval opt-in only |
| **Risk** | Low for omni v1 |
| **Priority** | P3 |
| **Remediation** | Enable RAG after pgvector prod validation |
| **Owner** | AI |

---

### TD-012: webhooks.js stub not mounted

| Field | Value |
|-------|-------|
| **Description** | Generic webhook router exists but unused |
| **Impact** | Confusion; dead code |
| **Risk** | Low |
| **Priority** | P3 |
| **Remediation** | Mount for unified-crm-ingest or delete |
| **Owner** | Platform |

---

### TD-013: Orphan CanalesModule.jsx NOT_MOUNTED

| Field | Value |
|-------|-------|
| **Description** | Component not in App.jsx routes |
| **Impact** | Dead code; maintenance noise |
| **Risk** | Low |
| **Priority** | P3 |
| **Remediation** | Delete or wire during G1 |
| **Owner** | Frontend |

---

### TD-014: ML auto-mode file-based

| Field | Value |
|-------|-------|
| **Description** | .ml-automode.json not in omni automation |
| **Impact** | Inconsistent automation config |
| **Risk** | Medium |
| **Priority** | P2 |
| **Remediation** | E3 migrate to omni_automation_rules |
| **Owner** | Automation |

---

### TD-015: clientes.automation_rules unwired

| Field | Value |
|-------|-------|
| **Description** | Schema exists; no runtime |
| **Impact** | Duplicate automation modeling |
| **Risk** | Low |
| **Priority** | P3 |
| **Remediation** | Bridge or deprecate in favor of omni rules |
| **Owner** | CRM Architecture |

---

### TD-016: PROJECT-STATE omni entries stale

| Field | Value |
|-------|-------|
| **Description** | Docs describe routes ahead of code |
| **Impact** | Agent/human confusion |
| **Risk** | Medium |
| **Priority** | P2 |
| **Remediation** | docs-sync after each track merge |
| **Owner** | Docs sync agent |

---

### TD-017: WACRM fork decision vs evolve canales

| Field | Value |
|-------|-------|
| **Description** | Conflicting strategies in team docs |
| **Impact** | Wrong implementation path |
| **Risk** | Medium |
| **Priority** | P1 |
| **Remediation** | ADR-010 — evolve canales; defer fork |
| **Owner** | Architecture |

---

## Summary by priority

| Priority | Count |
|----------|-------|
| P0 | 4 |
| P1 | 5 |
| P2 | 5 |
| P3 | 3 |

---

## References

- [08-omni-gap-analysis.md](../discovery/08-omni-gap-analysis.md)
- [09-scorecard.md](../discovery/09-scorecard.md)
