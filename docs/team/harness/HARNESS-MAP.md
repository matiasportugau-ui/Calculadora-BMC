# HARNESS-MAP — Calculadora BMC

**System:** Harness Control System (HCS)  
**Layers:** A = Product agent runtime · B = Coding-agent outer harness  
**Updated:** 2026-07-17  
**Source of truth for** `npm run harness:score`

Legend: **G** = guide (feedforward) · **S** = sensor (feedback) · **C** = computational · **I** = inferential

---

## Plane 0 — Intent & Guides

| ID | Kind | Layer | Item | Path / command |
|----|------|-------|------|----------------|
| G-B-01 | G/I | B | Pilot checklist | `AGENTS.md` |
| G-B-02 | G/I | B | Architecture for coding agents | `CLAUDE.md` |
| G-B-03 | G/I | B | Rule provenance | `docs/team/harness/RULE-PROVENANCE.md` |
| G-B-04 | G/I | B | Skill progressive index | `docs/team/harness/SKILL-INDEX.md` |
| G-B-05 | G/I | B | HCS SDD | `docs/team/SDD-HARNESS-ENGINEERING.md` |
| G-B-06 | G/I | B | Live project state | `docs/team/PROJECT-STATE.md` |
| G-B-07 | G/I | B | Knowledge roles | `docs/team/knowledge/*` |
| G-A-01 | G/I | A | Chat / channel prompts | `server/lib/chatPrompts.js` |
| G-A-02 | G/C | A | Assistant registry | `server/lib/assistantRegistry.js` |
| G-A-03 | G/C | A | Feature flags / ASSISTANTS_ACTIVE | `server/config.js` |

---

## Plane 1 — Product agent runtime (Layer A)

| ID | Kind | Item | Path |
|----|------|------|------|
| R-A-01 | Runtime | agentCore multi-provider | `server/lib/agentCore.js` |
| R-A-02 | Runtime | agentTools + loopback calc | `server/lib/agentTools.js` |
| R-A-03 | Runtime | RAG / embeddings | `server/lib/rag.js`, `embeddings.js` |
| R-A-04 | Runtime | Training KB | `server/lib/trainingKB.js` |
| R-A-05 | Runtime | requireAssistantEnabled | `server/middleware/requireAssistantEnabled.js` |
| R-A-06 | Runtime | Human confirm writes | tools + routes (`user_confirmed`) |
| R-A-07 | Runtime | Cost telemetry | `server/lib/costTelemetry.js` |

---

## Plane 2 — Coding outer runtime (Layer B)

| ID | Kind | Item | Path |
|----|------|------|------|
| R-B-01 | Hook | SessionStart | `.claude/hooks/session-start.sh` |
| R-B-02 | Hook | PreToolUse deny-list | `.claude/hooks/pre-tool-use.sh` |
| R-B-03 | Hook | PostToolUse quality inject | `.claude/hooks/post-tool-use.sh` |
| R-B-04 | Skill | ship / live-fix / closeout / preflight | `~/.claude/skills/*` + repo skills |
| R-B-05 | Skill | harness-ratchet | `.claude/skills/harness-ratchet/SKILL.md` |
| R-B-06 | Memory | HANDOFF / BITACORA / checkpoints | `docs/team/HANDOFF-*.md`, `expert:checkpoint` |
| R-B-07 | Agents | Claude Code specialists | `.claude/agents/*` |

---

## Plane 3 — Sensors & gates

| ID | Kind | Layer | Item | Command |
|----|------|-------|------|---------|
| S-B-01 | S/C | B | Local gate | `npm run gate:local` |
| S-B-02 | S/C | B | Full gate + build | `npm run gate:local:full` |
| S-B-03 | S/C | B | Lint | `npm run lint` |
| S-B-04 | S/C | B | Unit + API offline tests | `npm test`, `npm run test:api` |
| S-B-05 | S/C | B | Env / secrets drift | `npm run check:env-drift`, `gate:secrets` |
| S-B-06 | S/C | B | Pre-deploy checklist | `npm run pre-deploy` |
| S-B-07 | S/C | B | Architecture fitness | `npm run test:fitness` |
| S-A-01 | S/C | A | Agent trajectory goldens | `npm run test:agent-golden` |
| S-A-02 | S/C | A | Catalog price golden-cases | `npm run test:catalog-goldens` |
| S-A-03 | S/I | A | promptfoo critical | `npm run eval:agent` |
| S-A-04 | S/C | A | Prod smoke | `npm run smoke:prod` |
| S-A-05 | S/C | A | Live-fix JSON harness | `scripts/live-fix-verify.sh` |
| S-A-06 | S/C | A | Control plane tests | `tests/assistantControlPlane.test.js` |
| S-B-08 | S/C | B | Pre-release composite | `npm run pre-release` |
| S-B-09 | S/C | B | Harness scorecard | `npm run harness:score` |

---

## Plane 4 — Improvement flywheel

| ID | Item | Path |
|----|------|------|
| F-01 | Ratchet skill | `.claude/skills/harness-ratchet/SKILL.md` |
| F-02 | Worked example | `docs/team/harness/RATCHET-EXAMPLE.md` |
| F-03 | Score history | `docs/team/harness/SCORECARD.json` |
| F-04 | PEV contract | `docs/team/harness/README.md` §PEV |

---

## Plane 5 — Governance & human gates (intentional non-autonomy)

| ID | Item | Enforcement |
|----|------|-------------|
| H-01 | OAuth / grants | `requireAuth`, `requireGrant` |
| H-02 | Finanzas module password | `finLocked`, `FinanzasUnlockGate` |
| H-03 | Sheet writes confirm | `user_confirmed` on write tools |
| H-04 | Human gates docs | `docs/team/HUMAN-GATES-ONE-BY-ONE.md` |
| H-05 | Meta / spend | No auto-spend; marketing ops human |

---

## Inventory counts (scorer inputs)

| Metric | Value |
|--------|------:|
| agentGolden cases | see `tests/agentGolden/cases/*.json` |
| catalog golden-cases | 4 (`evals/golden-cases/GC-*.test.mjs`) |
| Claude agents | 12 (`.claude/agents`) |
| Hook scripts | 3 (session-start, pre-tool-use, post-tool-use) |

---

## Non-goals (PASS when present)

- Full unattended channel outbound without human
- Auto-merge to production without CI
- Removing finanzas second factor
