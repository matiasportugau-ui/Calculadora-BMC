# Handoff — 2026-10-15 Cloud Run Recovery + PR Plan

**Current branch**: `feat/panelin-front-idle-closeout`

**Uncommitted changes**:
- `src/data/calculatorDataVersion.js` (unrelated; safe to discard)
- `scripts/setup-go-live-hardening.mjs` (unrelated; safe to discard)

**Blockers**:
- None active. Traffic pinned, API restored.

---

## What was done

1. ✅ **Read recovery report** (`/Users/matias/reports/Recover panelin calc Cloud Run service.md`)
   - Root cause confirmed: `Dockerfile` (frontend nginx image) was deployed to `panelin-calc` backend service on 2026-10-15 11:03:37 UTC (revision 01139-bvv)
   - Resulted in 405 errors on POST routes, Vite HTML on GET routes
   - Impact: Cloud Scheduler, Gmail polls, webhooks all failed; inbound events lost during ~40min window

2. ✅ **Pinned traffic to panelin-calc-01138-wlp** (last known-good revision built from `server/Dockerfile`)
   - Command: `gcloud run services update-traffic panelin-calc --region=us-central1 --project=chatbot-bmc-live --to-revisions=panelin-calc-01138-wlp=100`
   - Probe result: `/calc/catalogo` returned **HTTP 200 + application/json** — API restored
   - No data loss (nginx wrote no state; event loss is provider-side retry risk, not data corruption)

3. ⚠️ **Discarded old worktree** (`.claude/worktrees/fix-backend-deploy`)
   - It contained edits to the wrong `Dockerfile` (root nginx frontend, not backend)
   - The recovery report clarifies: root `Dockerfile` is for `panelin-calc-web` (frontend), not `panelin-calc` (backend)
   - Worktree can be safely removed

---

## Next prompt to resume exactly

```
Create PR with four Dockerfile fixes to prevent recurrence:

1. Rename root Dockerfile → Dockerfile.web (clarify it's frontend-only, for panelin-calc-web service)
2. Add COPY src/lib/ ./src/lib/ to server/Dockerfile (fixes missing imports that caused boot failures on 01140/01141)
3. Add CI guard in deploy-calc-api.yml to reject --source deploys of panelin-calc (force -f server/Dockerfile only)
4. Update workflow to deploy with no_traffic: true + tag: canary, and point smoke tests at canary URL before promotion

Validate locally first:
  docker build -f server/Dockerfile -t panelin-calc:test .
  docker run -e PORT=8080 -p 8080:8080 panelin-calc:test
  curl -s http://localhost:8080/calc/catalogo | head -c 300

Then create PR with title: "infra: harden Cloud Run deploy gates + fix server/Dockerfile missing src/lib"

Do NOT merge until canary gates are tested against prod-like environment.
```

---

## Key files touched

- `/Users/matias/reports/Recover panelin calc Cloud Run service.md` (analysis only, not edited)
- No code changes yet (recovery was traffic pin only)

---

## Current state reference

- **Service**: `panelin-calc` (Google Cloud Run, project `chatbot-bmc-live`, region `us-central1`)
- **Pinned to**: revision `panelin-calc-01138-wlp` (100% traffic, started serving after pin)
- **Reversible with**: `gcloud run services update-traffic panelin-calc --to-revisions=panelin-calc-01139-bvv=100` (if 01138 fails — but 01139 is nginx, do not use operationally)
- **Last known good**:
  - Built with `server/Dockerfile` at commit `d477a44e` (still `origin/main` tip)
  - 57 env vars + 25 secret-backed entries, 1Gi memory
  - Image digest: `sha256:91d9748f826217b1fc8f5a4e11b52cb135aa40924bfa5832e793f773b231e268`

---

## Additional context

- **Recovery report details**: `/Users/matias/reports/Recover panelin calc Cloud Run service.md` (comprehensive analysis, open questions marked `[O]`)
- The **pin is temporary stabilization**; the **PR is the durable fix** preventing a manual `--source .` from deploying the frontend image to the backend service again
- **Environment drift noted**: 18 extra env keys on 01138 vs workflow (replace-vs-merge behavior of `deploy-cloudrun@v3` unknown) — canary validation will catch this before promotion
- **Procedure for next fix**: read-only pre-checks first, local docker build, then canary probe, then promotion only after probe passes
