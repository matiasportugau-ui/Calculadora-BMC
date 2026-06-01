# Role
You are a precise, minimal-surface-area implementation agent. Your mission is to complete the "seg" (seguimiento / follow-up) capability for the presupuestacion-orchestrator skill so the Post-Mortem & Learning sub-agent can actually schedule follow-ups, while keeping every change as small, atomic, and merge-friendly as possible on the `wip/cotizar-and-presup` branch.

# Context
[CONFIRMED] The presupuestacion-orchestrator (created 2026-05-29) is the conductor for 100% presup automation. Phase A delivered the skeleton + four prompt modules + promptfoo harness. The Post-Mortem & Learning sub-agent is defined in the spec and referenced in the example flow (`schedulePostMortem`), but it currently does nothing concrete.

[CONFIRMED] A mature, reusable followup system already exists:
- `server/lib/followUpStore.js` + local JSON store
- `scripts/followup.mjs` CLI
- `server/routes/followups.js` API
- WA-specific support in the wa-package

"seg and run" (user's terse instruction) is interpreted as: make the seg specialist real and give the team a way to exercise a presup flow that reaches it.

# Goal (single outcome)
Add a working Post-Mortem & Learning ("seg") specialist to the presupuestacion-orchestrator that can create scheduled follow-ups using the existing infrastructure, with the smallest possible, easiest-to-review diff.

# Scope — Strict (Mergability First)
**IN (only these):**
- One new prompt module for the seg / Post-Mortem & Learning specialist inside the orchestrator skill file (following the exact style and length of the existing Phase A modules).
- Minimal wiring in the conductor scaffolding example (update the `closeFlow` / `schedulePostMortem` pseudocode so it actually calls the new specialist).
- 2–3 promptfoo test cases for the new specialist (added to the existing yaml).
- One short paragraph or small section in the orchestrator skill's "Integration Points" or "Evolution Path".
- (Optional, only if it stays tiny) A 10–20 line documented invocation pattern or tiny helper script.

**OUT (hard boundaries):**
- No new files outside the orchestrator skill + the existing promptfoo yaml unless they are <30 lines and clearly justified.
- No production backend changes, no hub-tasks wiring, no Cloud Run / Vercel changes.
- No new persistence, no modifications to `followUpStore.js` or the WA followups table.
- No UI, no Apps Script, no large "run harness" scripts.

If you feel you need something outside this surface, stop and document the exact blocker + proposed minimal alternative in the handoff.

# Inputs (read these first, in this order)
1. The current presupuestacion-orchestrator skill file (your primary source of truth).
2. The four existing Phase A prompt modules (for style consistency).
3. `server/lib/followUpStore.js` + `scripts/followup.mjs` (understand the exact API for creating items).
4. The current `evals/promptfoo/presup-orchestrator.yaml`.
5. Latest relevant entries in `docs/team/PROJECT-STATE.md` and any HANDOFF-2026-05-29/30 files.

# Constraints & Guardrails (Non-Negotiable)
- Feature freeze is active. Everything must be skill-internal + promptfoo + minimal docs.
- Reuse only. Never invent new storage, new APIs, or new CLI commands.
- All changes must be reviewable in one sitting (target < 300–400 lines total diff).
- Prefer prompt-only changes over code changes. The specialist lives primarily as a prompt module.
- Every handoff the seg specialist produces must be explicit and minimal (same contract as the other sub-agents).

# Anti-patterns (Especially Important for Mergability)
- DO NOT create a large "run harness" script or complex example. A documented 5–10 line invocation pattern + one tiny helper (if truly needed) is the ceiling.
- DO NOT refactor the conductor scaffolding aggressively. Only touch the `schedulePostMortem` / closeFlow area.
- DO NOT add new dependencies or change existing module boundaries.
- DO NOT over-engineer the seg specialist prompt (keep it in the same style and length as the Pricing Reviewer / Document Gatekeeper modules).

# Deliverables (in strict priority order)
1. **Primary (highest value, smallest surface):** A complete, well-formatted prompt module for the Post-Mortem & Learning / "seg" specialist inside the orchestrator skill (Spanish, structured output, clear veredict + scheduled followup artifact).
2. Minimal update to the conductor scaffolding example so `schedulePostMortem` actually invokes the new specialist and records the result.
3. 2–3 high-signal promptfoo cases for the seg specialist (added to the existing yaml).
4. One small, high-signal documentation update (usually 1–3 paragraphs) in the orchestrator skill file.
5. This improved goal prompt left as the handoff artifact (with your final notes).

# Success Criteria (verifiable by you before finishing)
- The seg specialist prompt is written in the exact same style, tone, and structure as the four existing Phase A modules.
- When the prompt is given a realistic post-flow outcome object, it produces a clear, actionable recommendation that includes at least one concrete followup item (channel, due date, owner, context).
- The conductor example now shows the seg step being called in the close path.
- The promptfoo cases load and would exercise the new specialist without syntax errors.
- Total diff is small and focused (easy for a human to review in <15 minutes).
- You have produced a short "What to review / merge" note at the end of this run.

# Recommended Execution Order (for best performance + mergability)
1. Read the orchestrator skill + existing modules (understand the exact voice and structure expected).
2. Study `followUpStore` + the CLI just enough to know the minimal shape of a created followup.
3. Write the seg specialist prompt module first (this is 70% of the value).
4. Make the smallest possible edit to the conductor scaffolding to wire it.
5. Add the promptfoo cases.
6. Add the tiny doc update.
7. Run `npm run lint` + relevant tests on changed files only.
8. Write a crisp handoff note (what was done, what the diff touches, any remaining assumptions).

# Operational Anchors
- Source hierarchy respected: orchestrator skill spec > actual followup implementation code > recent PROJECT-STATE entries.
- Prefer the smallest possible change that delivers the capability.
- Every assumption that affects scope or interpretation must be explicitly called out at the end.

# Open Items / Assumptions (validate these early)
- [ASSUMPTION] "seg and run" primarily means adding the missing Post-Mortem & Learning specialist + minimal wiring, not building a full execution engine or large harness.
- [ASSUMPTION] The followup should be created in the general `followUpStore` (not necessarily the WA table) unless the flow context clearly indicates a WhatsApp channel.
- [ASSUMPTION] The "run" part is satisfied by a documented invocation pattern inside the skill rather than a new standalone script.

If any of the above feel wrong based on fresh reading of the files, document the alternative interpretation and proceed with the higher-leverage one while noting the deviation.

# Final Handoff Format (you must produce this)
At the end of the run, output a short, structured note with:
- One-sentence summary of what was delivered
- Exact files changed + rough line counts
- Any remaining [ASSUMPTION] or open decisions
- Recommended commit message(s) or PR title
- How to verify the seg step works (promptfoo + manual invocation)

This prompt is intentionally tighter and more mergability-focused than the previous version. Use it directly.