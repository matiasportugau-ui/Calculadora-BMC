# Central Session State Dashboard — 2026-10-15

**Last Updated:** 2026-10-15 · 09:50 UTC-3  
**Scope:** Active sessions, pending decisions, critical blockers  
**Dashboard Purpose:** Single source of truth for in-flight work, handoffs, and next steps

---

## 🔴 Critical Path — Blockers & Next Actions

| Priority | Item | Blocker | Type | Owner | Action |
|----------|------|---------|------|-------|--------|
| 🔴 P0 | **Desk API Deploy** | None | ✅ Ready | Matias | `npm run pre-deploy` → create PR → merge |
| 🔴 P0 | **Gmail Token: Phase 1** | User must run `gcloud secrets versions add` | Execution | Matias | Run command from clipboard, then Phase 2–6 |
| 🟠 P1 | **WhatsApp Token** | Expired 2026-10-02 (error 190) | Missing credential | Matias | Mint new in Meta Business Manager |
| 🟠 P1 | **Gmail Token (bmctecnopanel)** | Invalid grant dry-run | Credential | Matias | Re-mint as bmctecnopanel@gmail.com |
| 🟠 P1 | **MCP Re-auth** | Shopify + Gmail OAuth | Credential/scope | Matias | Run `/mcp`, add `read_orders` scope |
| 🟠 P1 | **Go-Live Task 3.x** | Options A or B decision | Decision | Matias | Approve Option A or B |
| 🟠 P1 | **DAC Alarms** | Alarms #1009/#1010/#1013 | Escalation | Matias | Sync with DAC |
| 🟡 P2 | **PR #1356** | Dockerfile mismatch | Code review | Matias | Review, approve, or close |
| 🟡 P2 | **rotate-ingest-secrets.sh** | --verify tests old revision | Bug | Agent | Fix to test new revision first |

---

## 📊 Active Worktrees & Sessions

| Worktree | Branch | Status | Handoff File | Resume Command |
|----------|--------|--------|--------------|-----------------|
| **desk-api-deploy** | worktree-desk-api-deploy | ✅ Ready | (Complete) | Create PR & merge to main |
| **good-update-connections** | worktree-good-update-connections | ⏳ Blocked | HANDOFF-2026-10-15-0938.md | Confirm traffic pin, fix verify, await tokens |
| **go-live-hardening** | worktree-go-live-hardening | ⏳ Blocked | HANDOFF-go-live-hardening | Approve Options A or B for Task 3.x |
| **fix-backend-deploy** | worktree-fix-backend-deploy | ⏳ Blocked | PR #1356 (open) | Review Dockerfile mismatch |
| **closeout-handoff** | (archive) | 📦 Historical | Multiple | Reference only |

---

## 🔄 In-Flight Operations

### 1. Desk API Production Migration (COMPLETE ✅)
- **Status:** Ready for PR merge
- **Deliverable:** matrizSnapshot.freezeMatriz() + production migration runbook
- **Next:** Create PR, review, merge to main

### 2. Gmail Ingest Token Refresh (PHASE 1 BLOCKED ⏳)
- **Status:** Token minted, Phase 1 awaiting execution
- **Blocker:** User must run Phase 1 command (gcloud secrets versions add)
- **Plan:** /Users/matias/.claude/plans/qu-hacer-1-en-playful-iverson.md (6 phases)
- **Full details:** docs/team/HANDOFF-2026-10-15-gmail-token-refresh.md

### 3. Good Update: Channel Recovery (MULTIPLE BLOCKERS ⏳)
- **Worktree:** good-update-connections
- **Service:** panelin-calc 01138 operational (100% traffic)
- **Blockers:** WhatsApp token expired, Gmail token (bmctecnopanel) invalid, MCP re-auth needed, DAC alarms pending
- **Full details:** docs/team/HANDOFF-2026-10-15-0938.md

### 4. Go-Live Hardening Task 3.x (DECISION PENDING ⏳)
- **Worktree:** go-live-hardening
- **Status:** Tasks 1.4+2.x complete, Task 3.x awaiting Option A or B decision
- **Cloud Run:** Confirmed 01138-wlp is correct pin

### 5. PR #1356 Review (CODE ISSUE ⏳)
- **Branch:** worktree-fix-backend-deploy
- **Issue:** Frontend Dockerfile in backend PR
- **Status:** Open, not in draft

### 6. Personal Agent Project (READY ✅)
- **Worktree:** fix-ia-team-recursion (in Projects/personal-agent)
- **Status:** 3 services live (:8787, :3857, :5179), all deliverables complete
- **Full details:** HANDOFF-2026-10-15-closeout.md in that worktree

---

## 📚 Resume Prompts (Copy-Paste Ready)

### Desk API Deploy
```
The Desk API implementation is complete: matrizSnapshot.freezeMatriz() + production 
migration runbook. Branch: worktree-desk-api-deploy. Commit: d91c665b.
Next: Create PR, review, merge to main.
Then: Execute DESK-API-PROD-MIGRATION.md when ready for prod deploy.
```

### Gmail Token Refresh
```
The GMAIL_INGEST_REFRESH_TOKEN refresh is 1 phase complete and waiting for execution.
Token is copied to clipboard. Run Phase 1:

pbpaste | tr -d '\n\r ' | gcloud secrets versions add GMAIL_INGEST_REFRESH_TOKEN \
  --data-file=- --project chatbot-bmc-live

Then proceed through Phases 2–6 per ~/.claude/plans/qu-hacer-1-en-playful-iverson.md
```

### Good Update Channels
```
Continue from here:
(1) Confirm who pinned panelin-calc traffic to 01138 and whether allUsers invoker is intended
(2) Fix --verify step in scripts/rotate-ingest-secrets.sh (test new revision before promoting)
(3) Wait for fresh WhatsApp and Gmail tokens, then run rotation script and Gmail dry-run

Full context: docs/team/HANDOFF-2026-10-15-0938.md
```

### Go-Live Hardening
```
Go-Live hardening ready for decision. Tasks 1.4+2.x complete with automation.
Task 3.x analysis ready with Options A and B.
Pending: Approve Option A or B for Task 3.x implementation.
Branch: worktree-go-live-hardening
```

---

## 🎯 Recommended Next Steps (Priority)

1. **MERGE Desk API** (5 min) — lowest risk, unblocks prod migration
2. **EXECUTE Gmail Phase 1** (2 min) — unblocks token distribution  
3. **PROVIDE Tokens** — WhatsApp + Gmail (external dependency)
4. **DECIDE Go-Live Option** — Option A or B for Task 3.x
5. **REVIEW PR #1356** — approve or close

---

**Generated:** 2026-10-15 09:50 UTC-3  
**Next Review:** After P0 blockers clear or daily standup  
**Documents:** SESSION-STATE-CENTRAL-2026-10-15.md

