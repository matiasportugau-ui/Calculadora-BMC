# Role
You are a harness engineer closing three small HCS ratchets from the 2026-07-19 as-built audit: map path S-A-05, agentGolden inventory count, and a live `GOLDEN_REQUIRED=1` agent-golden proof with the API up.

# Context
[CONFIRMED: Repo `~/calculadora-bmc`, remote `https://github.com/matiasportugau-ui/Calculadora-BMC.git`, branch recently worked as `feat/panelin-build-max-b01-done`.]
[CONFIRMED: HCS audit at `docs/team/reports/HCS-AUDIT-2026-07-19.md` — composite 98.2/100, DoD 12/12; residuals R5 (inventory count), R6 (S-A-05 path), R4 (live agent-golden not proven).]
[CONFIRMED: `HARNESS-MAP.md` Plane 3 row S-A-05 still lists `scripts/live-fix-verify.sh`, but that file is **not** in-repo; actual script is `~/.claude/skills/live-fix/scripts/live-fix-verify.sh`.]
[CONFIRMED: Inventory table in `HARNESS-MAP.md` currently says `see tests/agentGolden/cases/*.json` (not the literal `15`); SCORECARD notes `agentGolden cases: 19`; on-disk case JSON count is 19.]
[CONFIRMED: `npm run test:agent-golden` → `tests/agentGolden/runner.mjs`; with `GOLDEN_REQUIRED=1`, skip becomes failure; default `API_BASE=http://127.0.0.1:3001`.]
[CONFIRMED: `pre-release` already chains `GOLDEN_REQUIRED=1 npm run test:agent-golden` after gate/fitness/catalog/score.]
[INFERRED: Preferred S-A-05 fix is a thin in-repo wrapper at `scripts/live-fix-verify.sh` that execs the skill script when present | basis: keeps map path stable for agents/CI and matches audit ratchet #1 “wrapper or map fix”.]
[INFERRED: Explicit inventory value **19** in the map is clearer than a vague pointer | basis: audit R5 + SCORECARD already records 19.]

# Goal
Close audit ratchets R5 + R6 + R4: make S-A-05 path real in-repo, publish agentGolden count **19** on the harness map, and prove all agent goldens under `GOLDEN_REQUIRED=1` with a live local API.

- Confirm cwd `~/calculadora-bmc` and whether `:3001` / `:5173` already respond (do not duplicate `dev:full` if healthy).
- Add thin wrapper `scripts/live-fix-verify.sh` that invokes `~/.claude/skills/live-fix/scripts/live-fix-verify.sh` (clear stderr + non-zero if missing); keep map S-A-05 pointing at `scripts/live-fix-verify.sh` OR update map if you choose path-only fix — prefer wrapper.
- Update `docs/team/harness/HARNESS-MAP.md` inventory: agentGolden cases → **19**; bump map `Updated` date; fix any stale “15” claims in harness docs (not historical PROJECT-STATE go-live prose).
- Start API if needed (`npm run start:api` or `doppler run -- npm run start:api` / `dev:full`); wait for `/health`.
- Run `GOLDEN_REQUIRED=1 npm run test:agent-golden` (optionally `API_BASE=http://127.0.0.1:3001`); capture full result.
- Refresh `npm run harness:score:report`; append PROJECT-STATE Cambios recientes + short note on the audit report or a tiny closeout snippet.

# Scope
IN:
- `scripts/live-fix-verify.sh` (new wrapper) and/or S-A-05 row text in `docs/team/harness/HARNESS-MAP.md`
- Inventory counts section of `HARNESS-MAP.md` (19)
- Live local API bring-up for goldens only
- `GOLDEN_REQUIRED=1 npm run test:agent-golden` evidence
- `docs/team/harness/SCORECARD.json` via `harness:score:report`
- `docs/team/PROJECT-STATE.md` one Cambios recientes line
- Optional one-paragraph update on `docs/team/reports/HCS-AUDIT-2026-07-19.md` marking R4/R5/R6 closed or still open

OUT:
- Changing harness score formulas (`dimComputationalSensors`, etc.)
- Expanding AGENTS.md / new standing rules without RULE-PROVENANCE
- Catalog golden / price / constants.js changes
- Product SKU/`au` matrix ratchets
- GTIS / Grok-terminal SDD restore
- Deploy to Vercel or Cloud Run
- Weakening human gates
- Full `pre-release` (gate:local:full + build) unless goldens already green and you have spare time — not required for this goal

# Inputs
- Audit: `docs/team/reports/HCS-AUDIT-2026-07-19.md` [CONFIRMED]
- Map: `docs/team/harness/HARNESS-MAP.md` (S-A-05 + Inventory counts) [CONFIRMED]
- Skill script: `/Users/matias/.claude/skills/live-fix/scripts/live-fix-verify.sh` [CONFIRMED exists]
- Runner: `tests/agentGolden/runner.mjs` [CONFIRMED]
- Cases dir: `tests/agentGolden/cases/*.json` (expect 19) [CONFIRMED]
- Package scripts: `start:api`, `dev:full`, `test:agent-golden`, `harness:score:report` [CONFIRMED]
- Health probe: `http://127.0.0.1:3001/health` [CONFIRMED]
- Agent probe used by runner: `http://127.0.0.1:3001/api/agent/ai-options` [CONFIRMED from prior audit skip message]
- Secrets: Doppler `bmc-backend/prd` or local `.env` for LLM keys on API [ASSUMPTION: keys available via doppler or .env | verify before executing]

# Tools & MCPs
- Bash: health curls, start API if needed, `GOLDEN_REQUIRED=1 npm run test:agent-golden`, `harness:score:report`, `chmod +x` on wrapper
- Read / Edit / Write: map, wrapper script, PROJECT-STATE, optional audit closeout note
- Tools NOT needed: Vercel MCP, Sheets mutations, browser automation, Shopify
- [ASSUMPTION: If `claude -p` credits are empty, execute the same prompt in Cursor | verify before executing]

# Constraints & Guardrails
- DO NOT deploy to production.
- DO NOT remove or bypass human gates.
- DO NOT invent PASS if goldens fail or skip under `GOLDEN_REQUIRED=1` — fix env or report FAIL with stderr.
- DO NOT duplicate API/Vite if already healthy on :3001 / :5173.
- DO NOT commit secrets or `.env`.
- DO NOT change catalog prices / `constants.js` to green goldens.
- DO prefer wrapper over rewriting only the map to a home-directory path (home path breaks other machines).
- DO keep wrapper executable (`chmod +x`) and idempotent.
- DO update map `Updated:` date when touching HARNESS-MAP.

# Anti-patterns
- DO NOT treat silent skip under `GOLDEN_REQUIRED=0` as release proof.
- DO NOT claim inventory “15→19” fixed if the map still lacks an explicit **19**.
- DO NOT leave S-A-05 pointing at a non-existent in-repo path.
- DO NOT hardcode API tokens or Anthropic keys into scripts.
- DO NOT use zombie `panelin-api-642127786762` — local target is `panelin-calc` Express on :3001.
- DO NOT run `npm audit fix --force`.
- DO NOT amend unrelated dirty worktree files; touch only ratchet files + state notes.

# Deliverables
1. `scripts/live-fix-verify.sh` — thin wrapper → skill script (preferred) **or** documented map-only path change if wrapper rejected
2. `docs/team/harness/HARNESS-MAP.md` — S-A-05 consistent with reality; inventory agentGolden = **19**; Updated date
3. Evidence of `GOLDEN_REQUIRED=1 npm run test:agent-golden` (exit 0, or blocked with explicit reason)
4. `docs/team/harness/SCORECARD.json` refreshed
5. `docs/team/PROJECT-STATE.md` — Cambios recientes one-liner
6. Optional: short “Ratchets closed” note on `docs/team/reports/HCS-AUDIT-2026-07-19.md`
7. Commit/PR only if the user explicitly asks after the work (default: no commit)

# Success Criteria
- `test -x scripts/live-fix-verify.sh` succeeds (if wrapper approach) OR map S-A-05 path resolves on this machine
- `grep -n "S-A-05" docs/team/harness/HARNESS-MAP.md` shows a path that exists
- Inventory line shows **19** for agentGolden cases; `ls tests/agentGolden/cases/*.json | wc -l` equals 19
- `curl -sf http://127.0.0.1:3001/health` succeeds before goldens
- `GOLDEN_REQUIRED=1 npm run test:agent-golden` exits 0 with cases run (not skipped)
- `npm run harness:score:report` still ≥ 90 / DoD green
- PROJECT-STATE Cambios recientes mentions the three ratchets and golden result

# Operational Anchors
- Source hierarchy: planilla validada (operativa) > repos vigentes (lógica) > docs de fórmulas (documental) > dashboards viejos (auxiliar). For THIS task repo filesystem + runner exit codes beat stale audit prose if they disagree.
- State labeling: mark golden outcome and path fix as `hecho confirmado` / `inferencia` / `duda abierta`.
- Triangulation: HARNESS-MAP → filesystem → SCORECARD/audit → consolidate.
- Read-only by default on Sheets, master prices, fiscal data.
- If API lacks LLM keys: surface blocker; do not fake green goldens.

# Open Items
- [ASSUMPTION: Local LLM provider keys (Anthropic and/or Gemini fallback) are available via Doppler or `.env` so agent goldens can run live | verify before executing]
- [ASSUMPTION: Prefer thin wrapper at `scripts/live-fix-verify.sh` over map-only home path | verify before executing]
- [ASSUMPTION: No git commit unless user asks after execution | verify before executing]
- [ASSUMPTION: Historical “15 cases” lines in HANDOFF-HCS-2026-07-17 / PROJECT-STATE go-live entry stay as historical record; only HARNESS-MAP inventory must show 19 | verify before executing]
