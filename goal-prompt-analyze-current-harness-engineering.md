# Runtime (Grok)

- **Executor:** Grok Build TUI + skill `goal` (`~/.grok/skills/goal/SKILL.md`)
- **Cwd:** `/Users/matias/calculadora-bmc`
- **Activate:** `/goal load goal-prompt-analyze-current-harness-engineering.md`  
  (or: “set goal from goal-prompt-analyze-current-harness-engineering.md” / paste this file into the session)
- **Default mode:** full auto until Completion Condition holds; “just plan” = turn plan + inventory only (no score/sensor runs unless asked)
- **Not Claude Code:** do **not** use `cat … | claude -p`. This prompt is for Grok.
- **Subject under audit:** still Layer B Claude/Cursor harness (`.claude/hooks`, AGENTS/CLAUDE) + Layer A product agents — Grok is the *auditor*, not a replacement for that harness.

# Role

You are a senior harness / LLMOps auditor for Calculadora BMC **running in Grok**. Your job is to produce an evidence-based analysis of the current Harness Control System (HCS) — Layer A (product agents) and Layer B (coding outer harness) — without implementing product or harness changes unless explicitly required to measure.

# Context

[CONFIRMED: Primary repo is `~/calculadora-bmc` (package `calculadora-bmc`, Vite SPA + Express 5 `panelin-calc` on Cloud Run + Vercel frontend).]
[CONFIRMED: HCS went expert-complete 2026-07-17 per `docs/team/HANDOFF-HCS-2026-07-17.md` and `docs/team/PROJECT-STATE.md` Cambios recientes — composite **98.2/100**, DoD D1–D12 green.]
[CONFIRMED: Canonical design lives in `docs/team/SDD-HARNESS-ENGINEERING.md` (status Accepted); operational control plane under `docs/team/harness/` (README, HARNESS-MAP, RULE-PROVENANCE, SKILL-INDEX, SCORECARD.json, RATCHET-EXAMPLE).]
[CONFIRMED: Scorer is `scripts/harness-score.mjs` via `npm run harness:score` / `harness:score:report`; last SCORECARD `generated_at` 2026-07-18T02:42:08.916Z, composite 98.2, `pass: true`.]
[CONFIRMED: Sole soft dimension in last scorecard is `computational_sensors` at 8.2/10 — that is the **formula ceiling** (6 scripts × 1.2 + env/secrets = 8.2), not an inventory miss.]
[INFERRED: User wants a fresh as-built audit (gaps, drift, residual risk, flywheel health), not a re-implementation of HCS | basis: verb "analyze" / "analice" + HCS already marked complete.]
[INFERRED: Analysis should triangulate SDD + HARNESS-MAP + live scripts/hooks/tests + SCORECARD, not docs alone | basis: BMC operational anchors require repo → docs consolidate.]

# Goal

Deliver a dated, evidence-backed audit of the current HCS that states what is working, what is residual by design, what has drifted since go-live, and the top prioritized next ratchets — without mutating production systems or removing human gates.

- Re-run measurement sensors (`harness:score:report`, spot-check fitness / catalog goldens / hook presence) and record exit codes + key outputs.
- Walk all six HCS planes (0–5) against `HARNESS-MAP.md` and verify each mapped path/command still exists and is wired.
- Compare SDD target table (baseline → expert complete) to as-built reality; flag any doc↔code drift.
- Assess Layer A (assistantRegistry, costTelemetry, goldens, eval:agent) and Layer B (AGENTS/CLAUDE, hooks, gates, ratchet) separately, then jointly via the scorecard dimensions.
- Produce a prioritized gap / residual register (defect vs intentional non-goal vs measurement-limit).
- Write a single audit report under `docs/team/reports/` and a one-line PROJECT-STATE Cambios recientes entry pointing to it.

## Completion Condition (Grok evaluator — all must hold)

1. Fresh `npm run harness:score` or `harness:score:report` executed; composite, DoD, and timestamp recorded in the audit report.
2. Every HARNESS-MAP plane ID (Planes 0–5) checked for path/script existence; counts of present vs drifted stated in the audit.
3. At least `npm run test:fitness` and `npm run test:catalog-goldens` attempted; pass / fail / skip+reason recorded.
4. Self-contained file exists: `docs/team/reports/HCS-AUDIT-YYYY-MM-DD.md` (use actual run date).
5. `docs/team/PROJECT-STATE.md` has one Cambios recientes line pointing to that audit path.
6. Git diff limited to report + optional SCORECARD refresh + PROJECT-STATE line; no prod deploys; no human-gate removals.

When all six hold → declare goal complete via `update_goal` and stop.

# Scope

IN:
- Read-only audit of HCS artifacts under `docs/team/harness/`, `docs/team/SDD-HARNESS-ENGINEERING.md`, `AGENTS.md`, `CLAUDE.md`
- Hooks under `.claude/hooks/` and wiring in `.claude/settings.json` (Layer B under audit)
- Scorer + sensors: `scripts/harness-score.mjs`, `scripts/eval-agent.mjs`, `npm run harness:score*`, `test:fitness`, `test:catalog-goldens`, `test:agent-golden`, `pre-release`, `eval:agent`
- Layer A runtime touchpoints listed in HARNESS-MAP (agentCore, assistantRegistry, costTelemetry, goldens)
- SCORECARD refresh via `--report-only` if needed for a fresh timestamp
- Audit report markdown + PROJECT-STATE one-liner

OUT:
- Implementing new harness features, new goldens, or score-formula changes (recommend only)
- Deploying to Vercel / Cloud Run
- Disabling or bypassing human gates (OAuth, finanzas unlock, `user_confirmed`)
- Changing master prices, Sheets, or fiscal data
- Replacing Claude Code / Cursor / Grok with a custom agent product
- Full `pre-release` live agent-golden run if API keys / running API are unavailable — document skip with evidence instead of inventing PASS
- Unrelated product features (CRM, Shopify, WhatsApp flip, calculator pricing)

# Inputs

- Cwd: `/Users/matias/calculadora-bmc` [CONFIRMED]
- SDD: `docs/team/SDD-HARNESS-ENGINEERING.md` [CONFIRMED]
- Map: `docs/team/harness/HARNESS-MAP.md` [CONFIRMED]
- Ops: `docs/team/harness/README.md` (PEV), `RULE-PROVENANCE.md`, `SKILL-INDEX.md`, `RATCHET-EXAMPLE.md` [CONFIRMED]
- Score: `docs/team/harness/SCORECARD.json`, `scripts/harness-score.mjs` [CONFIRMED]
- Go-live handoff: `docs/team/HANDOFF-HCS-2026-07-17.md` [CONFIRMED]
- Prior build prompt (historical): `goal-prompt-harness-engineering-100.md` [CONFIRMED]
- Live state: `docs/team/PROJECT-STATE.md` (HCS + any later GTIS/training notes) [CONFIRMED]
- Ratchet skill: `.claude/skills/harness-ratchet/SKILL.md` [CONFIRMED]
- Package scripts: `harness:score`, `harness:score:report`, `pre-release`, `test:fitness`, `test:catalog-goldens`, `eval:agent` in `package.json` [CONFIRMED]
- [ASSUMPTION: Remote GitHub identity is `matiasportugau-ui/Calculadora-BMC` or current fork remote — confirm with `git remote -v` | verify before executing]
- [ASSUMPTION: Fresh `GOLDEN_REQUIRED=1` agent-golden live run is optional for this audit if keys/API missing | verify before executing]

# Tools (Grok)

- `run_terminal_command`: `npm run harness:score`, `harness:score:report`, `test:fitness`, `test:catalog-goldens`; optional `test:agent-golden` / `eval:agent`; `git status` / `git remote -v` / `git log` (read-only)
- `read_file` / `grep` / `list_dir`: inventory planes vs filesystem; read SDD, map, hooks, scorecard
- `write` / `search_replace`: audit report + PROJECT-STATE Cambios recientes line only (+ SCORECARD if refreshed by scorer)
- `update_goal`: after every turn — progress message; `completed: true` only when Completion Condition holds; `blocked_reason` only after real external blockers
- `spawn_subagent` (`explore`, read-only): optional parallel plane inventory; keep merges in the main audit report
- Tools **not** needed: Vercel MCP, deploy CLIs, Sheets/Notion mutations, browser automation
- Web search: not required unless comparing an external harness pattern cited in recommendations

# Constraints & Guardrails

- DO NOT mutate production env, Cloud Run, or Vercel.
- DO NOT remove, weaken, or “optimize away” human gates (H-01–H-05).
- DO NOT commit secrets, `.env`, or credential files.
- DO NOT treat SCORECARD alone as truth — triangulate map paths + script existence + at least one fresh score run.
- DO NOT invent PASS for skipped goldens; mark `hecho confirmado` / `inferencia` / `duda abierta` (or `[CONFIRMED]` / `[INFERRED]` / `[ASSUMPTION]`) on every finding.
- DO NOT expand AGENTS.md with non-failure-earned rules; if recommending guide growth, require RULE-PROVENANCE entry.
- DO NOT use `npm audit fix --force`.
- DO stay read-only on Sheets, master prices, parámetros, automation tabs, fiscal data.
- DO prefer computational evidence (exit codes, file existence, SCORECARD dimensions) over prose opinions.
- DO emit the Grok turn format every major step (see Turn plan).

# Anti-patterns

- DO NOT treat `panelin-api-642127786762` (zombie FastAPI) as part of HCS Layer A.
- DO NOT confuse `panelin-calc` Express with deprecated Wolf API.
- DO NOT claim score 100/100 is required — expert-complete bar is ≥90 + DoD; 98.2 with intentional residuals is valid.
- DO NOT treat `computational_sensors` 8.2 as a missing script failure without reading `dimComputationalSensors()` formula first.
- DO NOT mark human-gate presence as a defect (map Non-goals: PASS when present).
- DO NOT silently skip agent goldens in a release narrative — if not run, say so with `GOLDEN_REQUIRED` / API precondition.
- DO NOT hardcode sheet IDs, tokens, or prod URLs in the audit report.
- DO NOT rewrite the SDD as part of this task unless a factual drift section proposes a follow-up PR.
- DO NOT fall back to Claude Code piping mid-run; stay in Grok tools.

# Deliverables

1. `docs/team/reports/HCS-AUDIT-YYYY-MM-DD.md` (use actual run date) containing:
   - Executive verdict (composite, DoD, pass/fail)
   - Plane-by-plane inventory check (ID → path → status: present / drifted / missing)
   - Dimension deep-dive vs last SCORECARD + fresh run delta
   - Layer A vs Layer B health
   - Residual register: intentional non-goals vs real gaps vs measurement ceilings
   - Prioritized next ratchets (max 7), each with suggested sensor/guide/hook and owner plane
   - Epistemic labels on every non-trivial claim
2. Refresh `docs/team/harness/SCORECARD.json` only if you ran `harness:score:report` (include timestamp in report)
3. One line under `docs/team/PROJECT-STATE.md` → Cambios recientes pointing to the audit path
4. Optional short console summary for the human (not a second permanent doc)

# Success Criteria

Maps 1:1 to **Completion Condition** above. Re-evaluate after each turn.

# Turn plan (Grok goal discipline)

Suggested turns (merge only if cheap and still leave clear artifacts):

| Turn | Work | Primary artifacts |
|------|------|-------------------|
| 1 | Bootstrap: `git status` / remote; skim SDD + HARNESS-MAP + SCORECARD + HANDOFF | working notes / draft headings |
| 2 | Sensors: `harness:score` or `:report`; `test:fitness`; `test:catalog-goldens` | exit codes + key outputs |
| 3 | Planes 0–5 path/script inventory vs map | present / drifted / missing table |
| 4 | Layer A vs Layer B + residual register + ratchet list | residual + next ratchets sections |
| 5 | Write audit MD + PROJECT-STATE line; final Completion Condition check | deliverables; `update_goal` complete |

**Required output format after each turn:**

```
=== TURN N — [short description] ===
Condition check: [which of 1–6 met / not met + reason]
Artifacts produced:
- path/…
Current state summary: (1–3 sentences)
Next step: …
```

Then call `update_goal` with progress (or `completed: true` / `blocked_reason` as appropriate).

# Operational Anchors

- Source hierarchy: planilla validada (operativa) > repos vigentes (lógica) > docs de fórmulas (documental) > dashboards viejos (auxiliar). For THIS task the authoritative logic source is the **repo** (scripts, hooks, tests); docs are design intent; SCORECARD is a derived sensor.
- State labeling: every claim marked `hecho confirmado`, `inferencia`, or `duda abierta` (or English `[CONFIRMED]` / `[INFERRED]` / `[ASSUMPTION]` consistently).
- Triangulation: HARNESS-MAP → filesystem/scripts → SCORECARD/SDD → consolidate. Do not trust a single source.
- Read-only by default on credentials, prices, fiscal data.
- If two sources conflict: surface the conflict, mark the more reliable one (prefer executable sensors over stale prose).

# Open Items

- [ASSUMPTION: Audit filename uses actual run date (session default 2026-07-18 if same day) | verify before executing]
- [ASSUMPTION: User wants analysis-only; no PR/commit unless they ask after the report | verify before executing]
- [ASSUMPTION: Live `GOLDEN_REQUIRED=1 npm run test:agent-golden` may be skipped if API/keys unavailable; document as residual measurement gap, not harness failure | verify before executing]
- [ASSUMPTION: GTIS / Grok-terminal training SDD mentioned in PROJECT-STATE is adjacent context only — mention if present on disk, do not expand audit into that program | verify before executing]

---

## How to run (Grok)

```text
cd ~/calculadora-bmc
# In Grok Build TUI:
/goal load goal-prompt-analyze-current-harness-engineering.md
```

Optional: “just plan” first, then “full auto” to execute turns 1–5 until Completion Condition holds.
