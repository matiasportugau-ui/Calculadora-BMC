# WACRM Fork Decision — BMC WhatsApp CRM Integration

**Date:** 2026-06-21  
**Status:** Pre-Fork Security Hardening Plan  
**Scope:** Inbox, Contacts, Pipelines modules only

---

## Executive Summary

This document outlines the decision to fork **wacrm** (WhatsApp CRM) into the BMC ecosystem with phased security hardening before any production use. Three high-value modules (Inbox, Contacts, Pipelines) will be extracted; lower-priority modules (Broadcasts, Automations, Flows, Members RBAC) are deferred to Phase 2+.

**Deployment Model:** Embed as a sub-module inside `calculadora-bmc` under `src/components/hub/wa-inbox/` to reuse auth, RBAC, and environment setup rather than managing a separate service.

---

## Modules to FORK

### 1. Inbox — Real-Time Conversation Hub
**Purpose:** 3-pane layout (conversation list / thread / contact sidebar) with real-time updates via Supabase subscriptions.

**Files to Copy:**
- `src/app/inbox/*`
- `src/components/inbox/*`

**Security Model:**
- Inherit HMAC signature validation on incoming Meta webhooks
- Add rate limiting per IP (prevent webhook floods)
- Add CSP enforcement (see **Critical Security Fixes** below)
- Supabase RLS: only messages from assigned account visible
- Audit logging on message send/receive

**Success Criteria:**
- Conversations load in <2s
- Real-time thread updates sync within 500ms
- No cross-account message visibility
- Webhook tampering rejected with 401 Unauthorized

---

### 2. Contacts — Address Book with Metadata
**Purpose:** Address book with tags, custom fields, notes, full-text search.

**Files to Copy:**
- `src/app/contacts/*`
- `src/components/contacts/*`

**Security Model:**
- RLS via Supabase: account isolation (users only see their org's contacts)
- Audit logs on all modifications (create, update, delete)
- Custom fields validated server-side (no code injection)
- Search queries parameterized (no SQL injection)

**Success Criteria:**
- Contacts CRUD fully audit-logged
- Search scales to 10k+ contacts per account
- No RLS bypass possible (test: cross-account access denied)
- Custom fields safe from injection

---

### 3. Pipelines — Kanban Deal Boards
**Purpose:** Kanban-style deal management with drag-drop, multi-pipeline support, deal stages.

**Files to Copy:**
- `src/app/pipelines/*`
- `src/components/pipelines/*`

**Security Model:**
- Row-level access control (users only see deals assigned to them or their team)
- Pipeline ownership bound to account
- Drag-drop operations validate user permission before moving deal
- Audit log on deal status changes

**Success Criteria:**
- Drag-drop updates atomic (no partial states visible)
- Deal visibility respects assigned user + team scope
- No horizontal escalation possible (user cannot see competitors' pipelines)

---

## Modules to SKIP (Phase 2+ Candidates)

| Module | Reason |
|--------|--------|
| **Broadcasts** | Lower MVP priority; evaluate after Inbox stability |
| **Automations** | Contains F18 SSRF, complex workflow state; requires deeper refactor |
| **Flows** | UI-heavy, low initial ROI; defer to roadmap iteration |
| **Members RBAC** | Reuse pattern from `calculadora-bmc/src/lib/panelinInternalRbac.js`; no fork needed |

---

## Critical Security Fixes (MUST DO before any commit)

### F8 / F9: CSP is Report-Only — MUST FIX

**Current State:**
```typescript
// next.config.ts
headers: [{ 
  key: 'Content-Security-Policy-Report-Only',  // ← Report-only, NOT enforced
  value: "default-src 'self'; script-src 'unsafe-eval' 'unsafe-inline' ..."
}]
```

**Risk:** Inline scripts + eval allowed in production; XSS not blocked, only reported.

**Fix:**
```typescript
// next.config.ts
headers: [{ 
  key: 'Content-Security-Policy',  // ← Enforced
  value: "default-src 'self'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; ..."
}]
```

**Implementation Steps:**
1. Use Next.js 16 `generateNonce()` in App Router middleware
2. Replace inline scripts with nonce-based `<script nonce={nonce}>`
3. Replace Tailwind JIT unsafe-eval with static build output
4. Verify no `eval()` calls in dependencies; audit `node_modules/` for violations
5. Test CSP with browser DevTools; confirm no violations in console

**Completion Criteria:**
- CSP enforced (not report-only)
- Zero violations logged in 1-hour stress test
- unsafe-eval and unsafe-inline removed from policy

---

### F4: RLS Bypass Audit — MUST FIX

**Current State:**
Many routes accept `account_id` from request body and use service-role client to write:
```typescript
// src/app/api/automations/route.ts (example)
const { account_id } = req.body
const { data, error } = await supabase
  .from('automations')
  .insert({ account_id, ...payload })
```

**Risk:** Attacker can forge `account_id` and insert data into any account.

**Fix Pattern:**
```typescript
// AFTER: resolve account_id from session, use RLS + SECURITY DEFINER RPC

async function POST(req: Request) {
  const { user } = await auth()
  if (!user) return res(401)
  
  // Resolve account_id from user's team
  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)
    .single()
  
  if (!membership) return res(403, 'No team membership')
  
  // Call SECURITY DEFINER RPC (validates account_id server-side)
  const { data, error } = await supabase
    .rpc('create_automation_secure', {
      p_team_id: membership.team_id,
      p_webhook_url: req.body.webhook_url,
      ...
    })
  
  return res(data, error)
}
```

**SECURITY DEFINER RPC Example:**
```sql
-- src/database/rls/automations_secure.sql
CREATE OR REPLACE FUNCTION create_automation_secure(
  p_team_id uuid,
  p_webhook_url text
) RETURNS json AS $$
DECLARE
  v_account_id uuid;
BEGIN
  -- Verify RLS: caller owns this team
  v_account_id := (
    SELECT account_id FROM teams 
    WHERE id = p_team_id AND account_id = current_user_id()
    LIMIT 1
  )
  
  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: team not owned by user';
  END IF
  
  -- Insert, bound to verified account_id
  INSERT INTO automations (team_id, account_id, webhook_url, ...)
  VALUES (p_team_id, v_account_id, p_webhook_url, ...)
  RETURNING row_to_json(automations.*);
END
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Test Case (Required):**
```typescript
// tests/security/rls-bypass.test.ts
describe('RLS Bypass Prevention', () => {
  it('should deny cross-account data access', async () => {
    const user1 = createTestUser('account-1')
    const user2 = createTestUser('account-2')
    
    // User 1 tries to write to account 2
    const res = await POST_createAutomation(user1, {
      account_id: 'account-2',  // not user1's account
      webhook_url: 'https://evil.com'
    })
    
    expect(res.status).toBe(403)
    expect(res.error).toContain('Unauthorized')
  })
})
```

**Completion Criteria:**
- All create/update/delete routes use SECURITY DEFINER RPC
- RLS bypass test passes
- Service role client ONLY used for admin-only operations (migrations, analytics)

---

### F18: SSRF on Automations Webhook — MUST FIX

**Current State:**
Automations send arbitrary HTTP requests to user-supplied `webhook_url`:
```typescript
// src/lib/automations.ts
async function triggerAutomation(automation) {
  const response = await fetch(automation.webhook_url)  // ← No validation
  return response.json()
}
```

**Risk:** Attacker can supply internal URLs (e.g., `http://169.254.169.254` for AWS metadata, `http://localhost:5432` for database).

**Fix:**
```typescript
// src/lib/automations.ts
async function triggerAutomation(automation) {
  // SSRF Blocklist
  const blockedPatterns = [
    /^https?:\/\/(localhost|127\.0\.0\.\d+)/i,
    /^https?:\/\/169\.254\.169\.254/i,  // AWS metadata
    /^https?:\/\/192\.168\./i,          // Private networks
    /^https?:\/\/10\./i,
    /^https?:\/\/172\.(1[6-9]|2[0-9]|3[01])\./i,
  ]
  
  const url = new URL(automation.webhook_url)
  
  for (const pattern of blockedPatterns) {
    if (pattern.test(automation.webhook_url)) {
      throw new Error('SSRF attempt blocked: private/metadata URL not allowed')
    }
  }
  
  // Also validate IP does not resolve to private range
  const resolved = await dns.promises.resolve4(url.hostname)
  const isPrivateIP = resolved.some(ip => 
    /^(127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(ip)
  )
  
  if (isPrivateIP) {
    throw new Error('SSRF attempt blocked: hostname resolves to private IP')
  }
  
  // Safe to fetch
  const response = await fetch(automation.webhook_url, {
    timeout: 5000,
    signal: AbortSignal.timeout(5000)
  })
  
  return response.json()
}
```

**Test Case (Required):**
```typescript
// tests/security/ssrf.test.ts
describe('SSRF Prevention', () => {
  it('should block localhost URLs', async () => {
    const res = await triggerAutomation({
      webhook_url: 'http://localhost:5432'
    })
    expect(res).rejects.toThrow('SSRF attempt blocked')
  })
  
  it('should block AWS metadata', async () => {
    const res = await triggerAutomation({
      webhook_url: 'http://169.254.169.254/latest/meta-data/'
    })
    expect(res).rejects.toThrow('SSRF attempt blocked')
  })
})
```

**Completion Criteria:**
- All 3 blocklist patterns tested and passing
- DNS resolution validated (no private IPs)
- Timeout enforced (5s max)
- Automations module not forked until this is complete

---

## Other Critical Findings (19 Total)

| ID | Title | Severity | Action | Status |
|---|---|---|---|---|
| F1 | NoSQL Injection in Tag Filter | HIGH | Parameterize queries | ✅ Audit |
| F2 | Unvalidated Redirect in OAuth | HIGH | Validate redirect_uri against allowlist | ✅ Audit |
| F3 | Missing Rate Limiting | MEDIUM | Add Vercel Rate Limiting | In Plan |
| F4 | RLS Bypass via account_id | CRITICAL | See above | 🔴 MUST FIX |
| F5 | Missing CORS headers | MEDIUM | Add CORS check | In Plan |
| F6 | Weak Session Timeout | MEDIUM | Reduce from 30d to 7d | In Plan |
| F7 | Plaintext API Keys in Logs | HIGH | Scrub logs | ✅ Audit |
| F8 | CSP Report-Only | CRITICAL | See above | 🔴 MUST FIX |
| F9 | unsafe-eval in CSP | CRITICAL | See above | 🔴 MUST FIX |
| F10 | No Webhook Signature Validation | HIGH | Validate HMAC | ✅ Audit |
| F11 | Missing XSS Protection Headers | MEDIUM | Add X-Content-Type-Options | In Plan |
| F12 | SQL Injection in Pipeline Filter | HIGH | Parameterize | ✅ Audit |
| F13 | Missing Audit Logs | MEDIUM | Add to all sensitive ops | In Plan |
| F14 | Weak Password Requirements | MEDIUM | Enforce 12+ chars, complexity | In Plan |
| F15 | No 2FA Enforcement | MEDIUM | Optional 2FA support | Phase 2 |
| F16 | Missing HSTS Header | MEDIUM | Add HSTS: max-age=31536000 | In Plan |
| F17 | Unencrypted Database Backups | HIGH | Enable TLS for backup transfer | In Plan |
| F18 | SSRF on Webhook URL | CRITICAL | See above | 🔴 MUST FIX |
| F19 | No Input Validation on Custom Fields | HIGH | Server-side schema validation | In Plan |

**30-day Risk Acceptance:** All non-CRITICAL findings reviewed; risk accepted or mitigated by Design/Ops. No production use until 🔴 CRITICAL fixes complete.

---

## Deployment Model

### Option A: Separate Service
Deploy wacrm fork as standalone Next.js service on Vercel or Cloud Run.
- **Pros:** Isolated deployments, independent scaling
- **Cons:** Additional service operational overhead; separate auth, env, monitoring

### Option B: Embedded Sub-module (RECOMMENDED)
Embed wacrm fork as `src/components/hub/wa-inbox/` inside `calculadora-bmc`.
- **Pros:**
  - Single Auth instance (reuse calculadora-bmc OAuth flow)
  - Shared RBAC (no separate permission system)
  - Unified env vars (no separate .env.local management)
  - One CI/CD pipeline, one observability stack
  - Simpler team onboarding
- **Cons:** Slightly larger monorepo; single deployment

**Decision: OPTION B** — Embed in calculadora-bmc to reduce operational complexity.

---

## Pre-fork Checklist

### Phase 1: Security Hardening (BLOCKING)
- [ ] **F8/F9 CSP Fix**: Enforce CSP (not report-only), remove unsafe-eval/unsafe-inline
  - [ ] Next.js nonce middleware implemented
  - [ ] All inline scripts converted to nonce-based
  - [ ] Tailwind JIT → static build verified
  - [ ] Zero CSP violations in 1h stress test
  
- [ ] **F4 RLS Audit**: RLS bypass test passes
  - [ ] All create/update routes use SECURITY DEFINER RPC
  - [ ] Cross-account access test fails with 403
  - [ ] Test committed to `tests/security/rls-bypass.test.ts`
  
- [ ] **F18 SSRF Blocker**: SSRF test passes
  - [ ] Localhost, AWS metadata, private networks blocked
  - [ ] DNS resolution validated
  - [ ] SSRF test committed to `tests/security/ssrf.test.ts`

### Phase 2: Other Critical Findings (30-day window)
- [ ] F1: NoSQL injection parametrized
- [ ] F2: Redirect validation
- [ ] F7: Log scrubbing (API keys)
- [ ] F10: Webhook HMAC validation
- [ ] F12: SQL injection parametrized
- [ ] F17: Database backup encryption
- [ ] F19: Custom field input validation

### Phase 3: Infrastructure Setup
- [ ] Supabase project provisioned (or confirm reusing calculadora-bmc's project)
- [ ] Meta WhatsApp Cloud API credentials loaded into Doppler (`bmc-frontend/prd`)
  - `META_WHATSAPP_ACCESS_TOKEN`
  - `META_WHATSAPP_PHONE_NUMBER_ID`
  - `META_WHATSAPP_WEBHOOK_SECRET`
- [ ] Webhook endpoint registered with Meta
- [ ] SSL certificate pinning (optional, for production)

### Phase 4: Testing & QA
- [ ] Unit tests: RLS, SSRF, CSP pass
- [ ] Integration tests: Inbox sync, Contacts CRUD, Pipeline drag-drop
- [ ] Security regression tests added to CI
- [ ] Load test: 10k+ concurrent webhooks, <2s inbox load
- [ ] Team UAT on staging

### Phase 5: Monitoring & Rollout
- [ ] Error tracking (Sentry) configured for wa-inbox module
- [ ] Audit log queries available in /hub/admin/analytics
- [ ] Gradual rollout: first internal team, then beta customers
- [ ] 48h production soak before full launch

---

## Risk Acceptance & Sign-Off

**Security Review Date:** 2026-06-21

**Findings Summary:**
- 3 CRITICAL: F4 (RLS), F8/F9 (CSP)
- 6 HIGH: F1, F2, F7, F10, F12, F17, F19
- 10 MEDIUM: F3, F5, F6, F11, F13, F14, F15, F16, F18(drift)

**Decision:** Proceed with fork under Phase 1 (blocking security fixes) and Phase 2 (30-day hardening window). No production user data until all CRITICAL and HIGH fixes complete.

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **Phase 1: Security Hardening** | 5 days | CSP, RLS, SSRF fixes + tests committed |
| **Phase 2: Broader Security** | 10 days | F1, F2, F7, F10, F12, F17, F19 fixed |
| **Phase 3: Infrastructure** | 3 days | Supabase, Meta webhooks, Doppler secrets live |
| **Phase 4: Testing** | 7 days | Unit, integration, load, UAT passing |
| **Phase 5: Rollout** | 5 days | Internal team → beta customers → general availability |
| **Total** | ~30 days | Production-ready wa-inbox integration |

---

## Contacts & Escalation

| Role | Owner | Slack |
|------|-------|-------|
| Security Review | Matias | @matias.portugau |
| Backend (RLS/SSRF) | [TBD] | — |
| Frontend (CSP) | [TBD] | — |
| DevOps (Supabase/Doppler) | [TBD] | — |
| QA & UAT | [TBD] | — |

---

**Next Step:** Upon approval, branch from `main` and create worktree at `.claude/worktrees/wacrm-fork/` to begin Phase 1 security hardening.
