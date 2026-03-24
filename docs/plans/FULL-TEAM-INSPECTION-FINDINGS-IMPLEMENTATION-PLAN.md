# Full implementation plan — Full-team inspection findings

**Source:** Inspection report (process vs repo): pre-deploy drift, env checks, missing gate scripts, git WIP, operational pendientes, doc nits.

**Goal:** Close every finding with either **code/script/docs change** or **explicit owner + evidence** where work is human-only (Sheets, OAuth, correo passwords).

**Success:** Pre-deploy reflects real backlog; local checks are one command; `AGENTS.md` matches `package.json`; git is clean or intentionally documented; `PROJECT-STATE` pendientes updated with evidence or moved to “Manual-only” with rationale.

---

## Phase A — Tooling (repo, high leverage)

| ID | Finding | Implementation | Files | Acceptance criteria |
|----|---------|----------------|-------|----------------------|
| **A1** | F1: `pre-deploy-check.sh` step 4 reads `docs/PROJECT-STATE.md` (redirect stub), not canonical backlog | Change step 4 to use **`docs/team/PROJECT-STATE.md`**. Optionally: if redirect file exists, print one line that canonical path is `docs/team/…`. Grep **open** checkboxes: `grep -E '^- \[ \]'` or equivalent on that file; print count or “none open”. | `scripts/pre-deploy-check.sh` | Running `npm run pre-deploy` lists pendientes from the **team** file; no false “file not found” when only redirect exists at old path. |
| **A2** | F2: Env vars show warnings when vars live only in `.env` | After `cd` to repo root, **option 1 (preferred):** `set -a; [ -f .env ] && . ./.env; set +a` before the loop (bash; no `export` needed if `.env` uses `KEY=val`). **option 2:** Keep current check but add footer: “If API is healthy, ignore when vars are in `.env` only.” | `scripts/pre-deploy-check.sh` | Step 2 matches reality when `.env` is present; document edge case: `.env` with spaces/special chars may need quoted values. |
| **A3** | F3: No single local gate command | Add npm scripts: `gate:local` → `npm run lint && npm test`; `gate:local:full` → `lint && test && build` (order per `AGENTS.md` habit). Optional: `check` alias to `gate:local`. | `package.json`, root `AGENTS.md`, `docs/AGENTS.md` (pointer row) | `npm run gate:local` exits 0 on clean tree; `gate:local:full` runs `version:data` via existing `prebuild` on build. |

**Order:** A1 → A2 → A3 (A1 independent; A2 can parallel A1; A3 after scripts are stable).

---

## Phase B — Documentation and protocol clarity

| ID | Finding | Implementation | Files | Acceptance criteria |
|----|---------|----------------|-------|----------------------|
| **B1** | F7: INVOQUE bullet says “0 → 0b” without naming 0a | **Single line fix:** “0 → **0a (MATPROMT)** → 0b → …” in the numbered “Qué hace” list. | `docs/team/INVOQUE-FULL-TEAM.md` | List matches table + PROMPT. |
| **B2** | PROMPT “Run 53” vs latest operational focus (correo) | Add **“Prioridad operativa actual (YYYY-MM-DD)”** subsection at top of `PROMPT-FOR-EQUIPO-COMPLETO.md` or in `SESSION-WORKSPACE-CRM.md`: one paragraph: correo `.env` + `panelsim-update` vs E2E/Go-live. Point to `PROJECT-STATE` Cambios recientes. | `docs/team/PROMPT-FOR-EQUIPO-COMPLETO.md` and/or `docs/team/SESSION-WORKSPACE-CRM.md` | Next full team run does not skip correo because only Run 53 roadmap is visible. |
| **B3** | Pre-deploy behavior change | Short note under “Comandos” or “Loops”: pre-deploy now reads team PROJECT-STATE; env step may use `.env`. | Root `AGENTS.md` | Developers know why step 4/2 changed. |

---

## Phase C — Git hygiene and link integrity (F6)

| ID | Finding | Implementation | Acceptance criteria |
|----|---------|----------------|----------------------|
| **C1** | `main` ahead of origin; large WIP | **Inventory:** `git status`, list **D** (deleted) and **??** (untracked). For each deleted `docs/team/matprompt/*` or `reports/*`: confirm replacement under `docs/team/panelsim/` or add redirect stubs. | No broken links from `AGENTS.md`, `PROMPT`, `PROJECT-STATE` to removed paths. |
| **C2** | Matprompt / SIM artifacts moved | If files moved to `docs/team/panelsim/matprompt/`, update **all** references in `PROJECT-TEAM-FULL-COVERAGE`, `AGENT-SIMULATOR-SIM`, `PROMPT`, orchestrator agent. | `rg 'MATPROMT-HANDOFF\|MATPROMT-RUN-THEME-SIM'` returns only valid paths. |
| **C3** | Commit strategy | Either **one** commit “chore: inspection plan tooling + doc fixes” or **two** commits: (1) scripts + package + AGENTS, (2) doc link fixes. Push `origin/main` when green. | CI (if enabled) passes; local `npm run gate:local:full` + `npm run pre-deploy` (API up) pass. |

**Order:** C1 → C2 → C3 after Phase A so commits include script fixes.

---

## Phase D — Operational / human (evidence in PROJECT-STATE)

These are **not** fully automatable; the plan is to **execute**, **record evidence**, and **tighten or close** pendientes.

| ID | Finding | Owner | Steps | Evidence to add |
|----|---------|-------|-------|-----------------|
| **D1** | F5: Correo — 7 Netuy accounts; `.env` incomplete | Matias | Complete `.env` in repo `conexion-cuentas-email-agentes-bmc` per `EMAIL_*` / `IMAP-SETUP`; run `npm run panelsim-update`; read `PANELSIM-ULTIMO-REPORTE.md`. | `PROJECT-STATE` Cambios recientes + optional screenshot/hash of report date |
| **D2** | F4: E2E validation open | Matias + Audit | Run `docs/team/E2E-VALIDATION-CHECKLIST.md` against **Cloud Run** base URL; fill table; note 503 vs 200 per project rules. | Update checklist file + uncheck or check `PROJECT-STATE` E2E line |
| **D3** | F4: Go-live checklist | Matias | Advance `docs/bmc-dashboard-modernization/GO-LIVE-DASHBOARD-CHECKLIST.md` in order: 1.4 share workbook → 2.x tabs → 3.x Apps Script → 5.x deploy target → 6.x UI E2E. | Same doc checkboxes + `PROJECT-STATE` Go-live line |
| **D4** | F4: kpi-report runtime pendiente | Dev | With API restarted: `BMC_API_BASE=<prod or local> npm run test:contracts` or curl `/api/kpi-report`; expect 200 or 503, not 404. | Close or reword pendiente with URL + date |
| **D5** | Nested pendientes (stock/history, Pagos column doc) | Mapping + Sheets | Track in `IMPROVEMENT-BACKLOG-BY-AGENT` or split to separate checkbox rows. | Backlog row or new issue doc |

**Order:** D1 can parallel D4 (different systems). D2/D3 sequential after Cloud Run URL stable. D5 ongoing.

---

## Phase E — Optional hardening (post-MVP)

| ID | Item | Notes |
|----|------|--------|
| **E1** | `npm run verify:full-team-artifacts -- --suffix YYYY-MM-DD-runN` | Restores artifact completeness check after numbered runs; optional script from prior automation roadmap. |
| **E2** | GitHub Actions: contract job | Only with **staging URL** or **self-hosted** runner + secrets; keep PR workflow lint+test only until then. |
| **E3** | ESLint: exclude or fix `PanelinCalculadoraV3_backup.jsx` warnings | Reduces noise on `npm run lint`. |

---

## Execution order (recommended)

```text
Week 0 (same day)
  A1 → A2 → A3 → B1 → B3 → run gate:local:full + pre-deploy locally

Week 0–1
  C1 → C2 → C3 (commit + push)
  B2 (priority blurb in PROMPT or SESSION)

Parallel tracks (Matias / ops)
  D1 correo
  D4 kpi-report evidence

Week 1–2
  D2 E2E Cloud Run
  D3 Go-live steps as tabs/triggers allow

Ongoing
  D5 backlog / Sheets docs
  E1–E3 as needed
```

---

## Definition of done (global)

- [x] `scripts/pre-deploy-check.sh` uses **`docs/team/PROJECT-STATE.md`** for step 4 and loads **`.env`** for step 2 (or documents exception).
- [x] `package.json` exposes **`gate:local`** and **`gate:local:full`** (and **`check`**); **`AGENTS.md`** documents them.
- [x] `INVOQUE-FULL-TEAM.md` lists **0a** explicitly in the bullet flow (step 4: `0 → 0a (MATPROMT) → 0b → …`).
- [ ] No broken internal links for moved matprompt/SIM paths (run `rg` audit when git tree stabilizes).
- [ ] `git push` done or WIP explicitly documented in `SESSION-WORKSPACE-CRM.md`.
- [ ] `PROJECT-STATE` **Pendientes de sincronización** updated: E2E / Go-live / kpi-report / correo either **closed with evidence** or **scoped** under “Manual-only” with next action.
- [x] Entry in **`docs/team/PROJECT-STATE.md` → Cambios recientes** describing this implementation (per repo protocol).

---

## References

- Canonical state: `docs/team/PROJECT-STATE.md`
- Invocation: `docs/team/INVOQUE-FULL-TEAM.md`, `docs/team/PROMPT-FOR-EQUIPO-COMPLETO.md`
- Go-live: `docs/bmc-dashboard-modernization/GO-LIVE-DASHBOARD-CHECKLIST.md`
- E2E: `docs/team/E2E-VALIDATION-CHECKLIST.md`
- PANELSIM correo: `docs/team/panelsim/EMAIL-WORKSPACE-SETUP.md`, skill `.cursor/skills/panelsim-email-inbox/`
