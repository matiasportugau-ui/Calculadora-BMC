# 09 — Security Model

**Program:** EXPORT_SEAL::OMNICRM_AUTONOMOUS_TRANSFORMATION_PROGRAM_V2  
**Date:** 2026-06-22  
**ADR:** [ADR-007](adrs/ADR-007-security-model.md)

---

## 1. Current state summary

| Control | Status |
|---------|--------|
| JWT + refresh rotation | IMPLEMENTED |
| RBAC module grants | IMPLEMENTED |
| MFA TOTP | IMPLEMENTED |
| HMAC webhooks (ML/WA/Shopify) | IMPLEMENTED |
| Rate limiting | IMPLEMENTED (broad) |
| SSRF protection | NOT_FOUND |
| Zod validation | PARTIAL |
| Open CRM AI routes | **Gap** — suggest-response |

**Evidence:**
- Source: `docs/discovery/07-security-map.md`
- Section: Summary table
- Reasoning: Strong identity; gaps on SSRF and open endpoints

---

## 2. RBAC model

### Module catalog (existing)

Modules include: `canales`, `wa`, `ml`, `admin`, `cotizaciones`, etc.

**Evidence:** `identityAuth.js` L27–38

### OmniCRM permission matrix

| Resource | read | write | admin |
|----------|------|-------|-------|
| `/api/omni/conversations` | canales:read | canales:write | — |
| `/api/omni/conversations/:id/reply` | — | canales:write | — |
| `/api/omni/deals` | canales:read | canales:write | admin for force sync |
| `/api/omni/contacts/:id/merge` | — | — | admin |
| `/api/omni/automation/*` | admin:read | admin:write | admin |
| `/api/internal/omni/ai/run` | — | — | service token only |
| `/api/unified-crm-ingest` | — | — | HMAC webhook |
| `/api/crm/suggest-response` | **fix:** cockpit read or service | — | — |

### Frontend

`RequireGrant module="canales"` on `/hub/canales/*` omni panels.

---

## 3. Webhook security

| Webhook | Verification | Replay mitigation |
|---------|--------------|-------------------|
| WhatsApp Meta | `x-hub-signature-256` HMAC | Timestamp skew check (add) |
| MercadoLibre | ML HMAC | Notification id dedup |
| unified-crm-ingest | HMAC + `WEBHOOK_VERIFY_TOKEN` | idempotency_key |
| Email ingest | Bearer `API_AUTH_TOKEN` | Message-ID hash dedup |

**Raw body:** Preserve for WA HMAC (`server/index.js` L151–154).

**Dev mode:** HMAC skipped when secret unset — document; never in prod.

---

## 4. Secrets governance

| Secret | Storage | Rotation |
|--------|---------|----------|
| JWT signing key | Doppler `bmc-backend/prd` | Quarterly |
| API_AUTH_TOKEN | Doppler | On compromise |
| Meta/WA app secret | Doppler | Meta console |
| ML OAuth tokens | GCS token store | OAuth refresh |
| Webhook HMAC keys | Doppler per ingest endpoint | Per endpoint creation |

**Rules:**
- Never commit `.env`
- Cloud Run Secret Manager for Sheets SA
- No secrets in omni_automation `webhook_outbound` URLs logged

---

## 5. Threat model

### 5.1 Replay attacks

| Vector | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| Re-post old WA webhook | Medium | Duplicate message (blocked by dedup) | idempotency_key + optional timestamp window |
| Re-use JWT after logout | Low | Unauthorized access | Short access TTL 15min; refresh rotation |
| Replay unified-crm-ingest | Medium | Data pollution | HMAC includes timestamp nonce |

### 5.2 SSRF

| Vector | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| automation webhook_outbound to internal IP | Medium | Cloud metadata leak | **Allowlist** egress URLs; block RFC1918, 169.254.169.254 |
| Agent tool fetch arbitrary URL | Medium | Same | Extend calc loopback allowlist pattern |
| PDF generation URL fetch | Low | Same | Existing server-side — audit |

**Evidence:** SSRF NOT_FOUND in discovery — **P0 hardening**

### 5.3 Prompt injection

| Vector | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| Customer message manipulates AI suggest | High | Wrong outbound message | HITL before send; system prompt isolation |
| Injected "ignore instructions" in ML question | High | Data leak in response | Channel rules; no secrets in prompts |
| Auto-classify triggers wrong automation | Medium | Wrong deal/tag | Confidence thresholds; approval gates |

### 5.4 Privilege escalation

| Vector | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| Operator grants self admin | Low | Full access | identityAdmin requires admin grant |
| WA hybrid auth bypass | Low | Cross-account WA | requireWaAccess account scoping |
| API_AUTH_TOKEN leak | Medium | CRM write | Rotate; IP allowlist **ASSUMPTION_REQUIRED** |

### 5.5 Broken access control

| Vector | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| GET omni conversation without grant | Medium | PII leak | requireGrant on all /api/omni/* |
| suggest-response without auth | **High today** | AI cost + data | H1 fix |
| Cross-tenant contact access | Low | PII | Single-tenant BMC; UUID guess infeasible |

### 5.6 Data leakage

| Vector | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| PII in logs/traces | Medium | Compliance | Redact phone/email in spans |
| Sheets GET without auth | Medium | CRM exposure | Scope separately; not omni blocker |
| AI provider retention | Low | Third-party | Use enterprise zero-retention **ASSUMPTION_REQUIRED** |
| Error messages expose stack | Low | Info leak | Generic 500 in prod |

---

## 6. Omni-specific controls

1. **Merge admin API** — admin only + audit
2. **Automation simulate** — admin only; no production side effects
3. **Internal AI endpoint** — service token; rate limited
4. **Deal sync-crm** — write grant + audit to Sheets
5. **Export contacts** — admin + logged (future)

---

## 7. Compliance notes

- WA message TTL purge (`wa:purge-old`) separate from omni retention policy
- Uruguay Ley 18.331 personal data — retention review **ASSUMPTION_REQUIRED** legal
- Audit log retention 7 years for deal changes **ASSUMPTION_REQUIRED** finance policy

---

## 8. Security rollout (Track H)

| PR | Change | Priority |
|----|--------|----------|
| H1 | Auth on suggest-response | P0 — parallel week 1 |
| H2 | omni_audit_log triggers | P1 |
| H3 | Metrics + smoke | P1 |
| H4 | SSRF middleware | P0 |
| H5 | OTel PII redaction | P2 |

---

## References

- [07-security-map.md](../discovery/07-security-map.md)
- [requireGrant.js](../../server/middleware/requireGrant.js)
- [06-ai-governance.md](06-ai-governance.md) §Safety gates
