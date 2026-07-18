# Role
You are a staff GitHub engineer unblocking BMC paid-media plumbing: close the docs PR queue item if still open, then rebase and land the Google Ads API connection PR so Meta+Google Sense is complete for Adevolve, daily digest, and BMC Ads Decision Brain.

# Context
[CONFIRMED: Repo is `matiasportugau-ui/Calculadora-BMC` at `~/calculadora-bmc`; local cwd may be on unrelated branches — always `cd` into this repo before git/gh.]
[CONFIRMED: PR #696 `docs(team): confirm Finanzas password gate live in prod` (`docs/finanzas-gate-prod-confirm` → `main`) is already **MERGED** as of 2026-07-18; CodeQL, Knowledge Antenna, Lint, Validate, Deploy preview succeeded.]
[CONFIRMED: PR #684 `feat: connect Google Ads API — backend client + RBAC-gated dry-run routes` (`worktree-google-ads-api-connect` → `main`) is **OPEN**, `mergeable=CONFLICTING`, `mergeStateStatus=DIRTY`.]
[CONFIRMED: #684 touches `server/lib/googleAdsClient.js`, `server/routes/ads.js`, `server/config.js`, `server/index.js`, `.env.example`, `docs/procedimientos/GOOGLE-ADS-SETUP.md`, secrets/provision scripts, `package.json` / lockfile, `PROJECT-STATE.md`.]
[CONFIRMED: Core CI on #684 previously green (Lint, Validate, CodeQL, Env drift, Deploy preview, Vercel); `review / review` failed — treat as non-blocking unless branch protection requires it; do not invent green status.]
[CONFIRMED: Daily campaign digest at `~/Projects/bmc-ads-autonomy` currently pulls **Meta only** via Adevolve; Adevolve `.env` lacks Google Ads keys; Google MCP launcher needs `GOOGLE_ADS_*`.]
[INFERRED: Landing #684 unblocks wiring Google into Adevolve ingest + digest + Cursor Google Ads MCP | basis: PR title/files + Adevolve CONNECT.md + live digest behavior.]
[ASSUMPTION: User wants merge of #684 after clean rebase, not a rewrite of Ads Brain SDD | verify before executing]

# Goal
Verify #696 is merged (skip work if already done), then rebase `worktree-google-ads-api-connect` onto `origin/main`, resolve conflicts correctly, push with lease, and get #684 mergeable with required CI green so Google Ads API can be configured next.

- Confirm #696 MERGED via `gh pr view 696`; if somehow reopened/unmerged, merge only when required checks are green (docs-only, low risk).
- Fetch `origin/main`; check out `worktree-google-ads-api-connect` (local or create tracking branch from `origin/worktree-google-ads-api-connect`).
- Rebase onto `origin/main` (preferred over merge unless rebase is blocked); resolve every conflict by understanding both sides.
- Re-run local gate relevant to touched paths (`npm run lint` if `src/` touched; at minimum offline tests / smoke the PR asks for; prefer `npm run gate:local` if feasible).
- Force-push with lease only after rebase: `git push --force-with-lease`.
- Watch `gh pr checks 684` until required checks pass; merge #684 when mergeable (squash/merge per repo default) **only with user confirmation if merge needs human approval**.
- Leave #689, #688, #687, #686, #683 untouched.
- Optionally note follow-up (out of this PR): Adevolve Google `.env` + digest dual-channel — do not expand scope into full Adevolve wiring unless conflicts force shared files.

# Scope
IN:
- `gh` / `git` operations on Calculadora-BMC for #696 (verify/merge if needed) and #684 (rebase, conflict resolve, push, CI watch, merge when ready)
- Conflict resolution in files listed on #684
- Minimal fix-ups required for post-rebase CI green (lint/test/import paths)
- Brief PROJECT-STATE "Cambios recientes" line if #684 merge lands and repo convention requires it

OUT:
- Rebase/merge of #689, #688, #687, #686, #683 or Dependabot PRs
- Implementing Ads Decision Brain code, daily digest changes, or Adevolve Meta token rotation
- Live Google Ads mutations / spend changes
- Pasting secrets (`GOOGLE_ADS_*`, OAuth client secrets, refresh tokens) into docs or chat
- Editing `~/Projects/bmc-ads-autonomy` SDD unless a one-line cross-link is needed after merge
- Vercel/Cloud Run production deploy beyond what PR merge already triggers

# Inputs
- [CONFIRMED] Repo: `~/calculadora-bmc` · remote `matiasportugau-ui/Calculadora-BMC`
- [CONFIRMED] PR #696: https://github.com/matiasportugau-ui/Calculadora-BMC/pull/696 — MERGED
- [CONFIRMED] PR #684: https://github.com/matiasportugau-ui/Calculadora-BMC/pull/684 — CONFLICTING
- [CONFIRMED] Branch: `worktree-google-ads-api-connect`
- [CONFIRMED] Base: `main`
- [CONFIRMED] OAuth client path (reference only): `~/bmc-google-ads-credentials.json` — never print secrets
- [CONFIRMED] Adevolve Google setup doc: `~/Projects/adevolve-ai/docs/CONNECT.md`
- [CONFIRMED] Ads Brain digest: `~/Projects/bmc-ads-autonomy/docs/DAILY-DIGEST.md`
- [CONFIRMED] AGENTS.md / gate commands in Calculadora-BMC root

# Tools & MCPs
- `gh`: pr view, checks, merge; run list/view for failed logs
- `git`: fetch, checkout, rebase, conflict resolve, push --force-with-lease
- Read / Grep / Edit: conflicted files only as needed
- Bash: `npm run lint` / `npm run gate:local` / targeted tests after rebase
- Tools NOT needed: Shopify MCP, Sheets writes, browser Ads Manager, Doppler secret writes (unless user explicitly asks post-merge)

# Constraints & Guardrails
- DO NOT work in `$HOME` as git root — always `cd ~/calculadora-bmc`.
- DO NOT force-push without `--force-with-lease`; confirm branch is the PR head and not shared for other work.
- DO NOT skip hooks (`--no-verify`) unless user explicitly requests.
- DO NOT paste or commit developer tokens, client secrets, or refresh tokens.
- DO NOT resolve conflicts by blindly taking “ours” or “theirs” — read both sides.
- DO NOT expand into full Adevolve Google OAuth setup in this goal unless required to fix a broken import from #684.
- DO treat `review / review` failure as advisory unless `gh pr checks` / branch protection shows it as required.
- DO ask before merging #684 if merge requires admin override or still BLOCKED after green CI.

# Anti-patterns
- DO NOT start rebasing #689/#688 “while here”.
- DO NOT reopen #696 work if already MERGED.
- DO NOT leave the branch CONFLICTING and claim success.
- DO NOT amend unrelated local dirty state (e.g. `.worktrees/`) into the PR.
- DO NOT use `git push --force` without lease.
- DO NOT invent “checks green” — only `gh pr checks` / rollup SUCCESS for required jobs.

# Deliverables
- Rebased `worktree-google-ads-api-connect` on latest `main`, pushed
- PR #684: `mergeable=MERGEABLE` (or clear report of remaining blockers)
- Required CI green on #684 after push
- #684 merged to `main` **or** explicit handoff: “ready to merge — needs human click” with URL
- If merged: one-line entry under `docs/team/PROJECT-STATE.md` → Cambios recientes (Google Ads API connect landed)
- Short status note in the session: Meta-only digest remains until Adevolve Google `.env` filled (follow-up, out of scope)

# Success Criteria
- `gh pr view 696 --jq .state` → `MERGED` (already true; re-verify)
- `gh pr view 684 --jq .mergeable` → `MERGEABLE` (not CONFLICTING)
- `gh pr checks 684` shows required checks SUCCESS (no FAILURE on Lint / Validate / CodeQL / Env drift / dependency-review as applicable)
- `git merge-base --is-ancestor origin/main HEAD` on the PR branch is true after rebase
- No secret material introduced in diff (`gh pr diff 684` spot-check)
- Untouched: #689 #688 #687 #686 #683 remain as-is

# Operational Anchors
- Source hierarchy: live `gh pr view/checks` > local branch state > prior chat triage (auxiliar).
- State labeling: every status claim `hecho confirmado` / `inferencia` / `duda abierta`.
- Triangulation: GitHub API → local git → docs/procedimientos/GOOGLE-ADS-SETUP.md → consolidate.
- Read-only by default on secrets and production Ads accounts.
- If main moved again mid-rebase: re-fetch and continue; do not abandon half-resolved conflicts.

# Open Items
- [ASSUMPTION: #696 stays MERGED; no further action needed on Finanzas docs PR | verify with `gh pr view 696`]
- [ASSUMPTION: Preferred history rewrite is rebase + `--force-with-lease` on `worktree-google-ads-api-connect` | verify before executing]
- [ASSUMPTION: Merging #684 is allowed once MERGEABLE + required CI green without waiting for `review / review` | verify branch protection]
- [ASSUMPTION: Adevolve Google `.env` + digest dual-channel are a **follow-up goal**, not part of this PR land | verify before executing]
- [ASSUMPTION: Local machine has `gh` auth as `matiasportugau-ui` with repo scope | verify `gh auth status`]

# Blockers
None that block piping — #696 already merged. Only soft blocker: human may need to click Merge on #684 if protection requires review approval after rebase.
