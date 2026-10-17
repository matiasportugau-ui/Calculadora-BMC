# Handoff — 2026-10-15 · Gmail Ingest Token Refresh (bmctecnopanel@gmail.com)

**Status**: INCOMPLETE · Phase 1 BLOCKED on user action

**What was done this session**:
- ✅ Created structured 6-phase plan for re-minting GMAIL_INGEST_REFRESH_TOKEN
- ✅ Guided user through Gmail OAuth flow to mint fresh token as `bmctecnopanel@gmail.com`
- ✅ User confirmed token is copied to clipboard
- ⏳ **Phase 1 NOT YET RUN** — token not yet added to GCP Secret Manager

**Current blocker**:
User has the fresh refresh token copied to clipboard but has not executed the Phase 1 `gcloud secrets versions add` command to persist it to GCP. All remaining phases (2–6) are blocked until Phase 1 completes.

**Next prompt to resume exactly**:

```
The GMAIL_INGEST_REFRESH_TOKEN refresh is 1 phase complete and waiting for execution.

User has the token copied to clipboard. They need to run:

  pbpaste | tr -d '\n\r ' | gcloud secrets versions add GMAIL_INGEST_REFRESH_TOKEN --data-file=- --project chatbot-bmc-live

Once that command succeeds with a version number, we proceed:
- Phase 2: Verify new version in GCP
- Phase 3: Sync to Doppler bmc-backend/prd (classifier-gated, I'll run)
- Phase 4: Trigger Cloud Run redeploy
- Phase 5: Test the poller endpoint
- Phase 6: Cleanup (optional)

The detailed 6-phase plan is in ~/.claude/plans/qu-hacer-1-en-playful-iverson.md
```

**Key files & references**:
- **Plan**: `/Users/matias/.claude/plans/qu-hacer-1-en-playful-iverson.md` (complete 6-phase walkthrough)
- **Ingest code**: `server/lib/gmailPoll.js` (reads token, queries Gmail)
- **Send code**: `server/lib/gmailSend.js` (uses token for replies)
- **GCP Secret**: `chatbot-bmc-live` project, secret `GMAIL_INGEST_REFRESH_TOKEN` (currently v5 from 2026-07-11)
- **Doppler**: `bmc-backend/prd` config, holds `GMAIL_INGEST_REFRESH_TOKEN`
- **Cloud Run**: `panelin-calc` service (us-central1)
- **Memory context**: `project-email-admin-system.md` (lines 96–109 document the bmctecnopanel migration + known gotchas)

**Critical gotcha** (from memory):
The token MUST be minted with the **dedicated Gmail OAuth client** (`GMAIL_OAUTH_CLIENT_ID/SECRET`), NOT the Drive client. If Drive client is used, it auto-revokes every ~2h. Consent MUST be as `bmctecnopanel@gmail.com` (not matias.portugau@gmail.com). The user already corrected this on the second consent attempt. ✅

**Verification after Phase 1 succeeds**:
- Run `gcloud secrets versions list GMAIL_INGEST_REFRESH_TOKEN --project chatbot-bmc-live --limit 3`
- New version should appear at the top in `enabled` state
- Then proceed to Phase 2 (verification) and beyond

**No git changes in this session** — this is an operational task, not a code commit.
