---
name: panelin-voice-agent-learning-architecture
description: Executes the full production-grade integration of the Panelin realtime Voice agent (WebRTC/OpenAI Realtime) as a first-class, authenticated, learnable channel. Wires voice transcripts into autoLearnExtractor/trainingKB/RAG with source "panelin_voice", fixes auth/Unauthorized and browser (Safari dictation fallback), adds observability + admin tools, and completes "and more" per the master goal. Use when the user says "panelin voice goal", "voice agent learning architecture", "make voice train the agent", "run the voice learning goal", "panelin-voice-learning", or references goal-prompt-panelin-voice-agent-learning-architecture.md.
---

# Panelin Voice Agent — Learning Architecture (Goal Skill)

This skill turns the existing voice transport (good WebRTC + actions) into a **peer channel** in the unified BMC/Panelin agent system: same auth, same conversation model + provenance, same learning loop (autoLearnExtractor → trainingKB → RAG), plus production robustness, cross-browser support, observability, and admin surfaces.

**Canonical specification (do not deviate):**  
The complete role, context, goal, scope (IN/OUT), inputs, constraints, anti-patterns, deliverables, success criteria, operational anchors, open items, and blockers are in the master prompt file:

**`goal-prompt-panelin-voice-agent-learning-architecture.md`** (repo root)

Always start by reading that file in full. It is the binding contract for the run. The text you are reading now is the **invocation wrapper + execution guidance**.

## When to Use This Skill

- User explicitly says: "panelin voice goal", "voice learning architecture", "implement the voice agent learning goal", "make voice conversations train the agent", "panelin-voice first-class channel", "run set-goal voice" or similar.
- User pastes or references `goal-prompt-panelin-voice-agent-learning-architecture.md` and says "execute", "implement", "do the goal", or "use the skill".
- After a fresh `/set-goal` or `set-goal` on voice produces (or updates) the prompt file and the user wants the implementation phase.
- When voice is partially working (Chrome only, transcripts lost to learning, 401s on agent surfaces, raw API_AUTH_TOKEN prompts leaking, no Safari path) and the objective is to close the architectural gaps.

## Mandatory First Steps (Every Run)

1. Read the **full** `goal-prompt-panelin-voice-agent-learning-architecture.md` (current version at root).
2. Read `docs/team/PROJECT-STATE.md` (current state + recent changes).
3. Read key inputs listed in the goal prompt (start with these confirmed ones):
   - `src/hooks/useVoiceSession.js`
   - `src/components/PanelinVoicePanel.jsx`
   - `src/components/PanelinChatPanel.jsx` (full — voiceMode, authHeader, transcript wiring, onChatAction, useDictation + TTS usage)
   - `server/routes/agentVoice.js`
   - `server/lib/autoLearnExtractor.js` (EXTRACT_PROMPT + turn handling + BMC criteria)
   - `server/lib/trainingKB.js` (findRelevantExamples, hasSimilarQuestion)
   - `src/components/AgentAdminModule.jsx` (VoiceTab)
   - `server/routes/agentChat.js` (patterns for auth + learning feed)
   - Any central conversation/useChat hook or state used by PanelinChatPanel
4. Verify the three big assumptions in the Open Items section of the goal prompt (conversation state shape is #1 priority — do this in the first 30-60 min).
5. Run a quick local unauth vs authed probe (terminal + browser MCP) for `/api/auth/me`, `/api/agent/voice/*` etc. before touching code.

## High-Level Execution Workflow

Follow the goal prompt's structure. Use this as a tracking overlay (copy into your todo list):

```text
Voice Learning Architecture Execution:
- [ ] 0. Read canonical goal prompt + PROJECT-STATE + critical source files + verify assumptions (esp. conversation state shape for voice turn injection)
- [ ] 1. Auth hardening: consistent authHeader / Bearer propagation for Panelin chat + voice surfaces; eliminate 401s for valid sessions; remove/hide raw "Pegá API_AUTH_TOKEN" dialog from normal flows
- [ ] 2. Browser support: keep strict Realtime block for unsupported (correct), improve messaging + promote first-class dictation + TTS fallback (useDictation) for Safari/WebKit; clear UI signals + toggle behavior
- [ ] 3. Architectural unification: treat voice as channel `source: "panelin_voice"` (peer to "panelin_chat", "ml", "wa"); normalize and append user/assistant turns (transcripts + audio_transcript deltas) to the central conversation array/turns consumed by autoLearnExtractor + persistence
- [ ] 4. Learning integration: ensure voice turns flow through autoLearnExtractor (with source tagging), produce high-value pairs under the same strict BMC criteria, land in trainingKB, and become retrievable via RAG. Verify at least one voice-derived fact appears and is surfaced
- [ ] 5. "And more" production features: VoiceTab enhancements (recent transcripts, contributed training pairs, error context); voice error ring buffer + health visibility; graceful barge-in/stop; session metadata/observability; minimal docs updates (CLAUDE.md, AGENTS.md, relevant panelin docs)
- [ ] 6. Small reusable pieces only if they keep diffs clean (e.g. voiceTranscriptNormalizer or channel adapter). Prefer reuse of existing patterns (calcLoopbackClient, provenance, requireAuth + rate limit)
- [ ] 7. Verification & gates: live browser snapshots (auth, toggle, transcripts in UI), no regression on text chat/TTS/dictation/calc; `npm run lint`, `npm test`, `npm run gate:local` (or full); voice health check; optional .runtime/ voice-smoke artifact
- [ ] 8. Update PROJECT-STATE.md (Cambios recientes) + any propagation notes. Close with clear "how voice conversations train the agent" documentation
```

Track progress with the project's `todo_write` tool (or equivalent) for the multi-step nature. Mark items done only when the concrete success evidence exists.

## Key Constraints & Anti-Patterns (Non-Negotiable — from the goal)

- Ephemeral tokens only for the browser. Never log or expose long-lived OpenAI keys.
- `requireAuth` + rate limiting on all `/agent/voice/*`; preserve existing VALID_ACTION_TYPES and onAction → calcLoopbackClient pattern.
- Voice-derived data goes through the **same quality gates** as other channels (MIN_CONFIDENCE, dedup, category rules, BMC-specific factual criteria in autoLearnExtractor). Conversational noise is expected — keep the bar high.
- Do **not** duplicate brain/tool/prompt logic. Voice is a transport.
- Do **not** leave transcripts only in local component state.
- Defensive browser detection (feature detection > raw UA sniffing).
- No new unauthenticated surface on voice routes.
- "Modo Tutorial", skins, devMode paths, and all non-voice agent surfaces must continue working.
- Prefer small, reviewable diffs that follow existing patterns.

See the full "Constraints & Guardrails" and "Anti-patterns" sections in the master goal prompt.

## Deliverables (Minimum to Claim Done)

The exact list lives in the goal prompt under **# Deliverables**. At a minimum you will touch/update:

- Voice UI/hooks (useVoiceSession.js, PanelinVoicePanel.jsx, PanelinChatPanel.jsx integration)
- Backend voice (agentVoice.js + supporting if needed)
- Learning wiring (append normalized turns with `source: "panelin_voice"` + optional convId into the structure read by autoLearnExtractor; updates to extractor/KB callers only if voice source needs special casing — keep criteria strict)
- Admin (VoiceTab in AgentAdminModule.jsx)
- Supporting (normalizer/adapter if clean) + docs (voice channel explanation, browser matrix, auth requirements)
- At least one concrete verification artifact (test, .runtime/ log, or explicit note)

## Success Criteria (Must All Be Demonstrably True)

Again, the canonical list is in the goal prompt **# Success Criteria**. Highlights:

- Chrome/Edge + valid auth: clean start, bidirectional transcripts, calculator actions execute, clean stop.
- Safari: helpful path (hidden/disabled toggle + message, or working dictation+TTS fallback). Hard Realtime blocker only for the premium path.
- No 401/Unauthorized on agent/voice or related chat surfaces for properly authed sessions. Raw API_AUTH_TOKEN prompt does not leak into normal flows.
- Voice turns (user + assistant audio_transcript) are appended with source tagging and are processed by the extractor (or dedicated voice path).
- At least one voice-derived high-value pair (price, panel, scenario, installation, etc.) exists in trainingKB and is RAG-retrievable.
- Voice health is healthy (when Realtime configured); errors visible in ring buffer + admin UI.
- Zero regression on text chat, TTS, dictation, calculator scenarios (gate:local passes).
- Teammate-readable documentation of "how voice conversations train the agent."

## Operational Anchors (Follow These)

- Running code in HEAD > recent docs/prior goal prompts > older plans. Triangulate repo files + architecture docs + live MCP behavior.
- **Every** turn fed to learning (voice included) carries `source` ("panelin_voice", "panelin_chat", "ml", "wa", ...) + optional `convId`.
- Label your own analysis: "hecho confirmado" / "inferencia" / "duda abierta".
- Small diffs, existing patterns (ephemeral only, validated actions, strict extractor, calcLoopback for side effects).
- Auth: use the same requireAuth + header propagation as the rest of the agent surface. Surface drift immediately.
- Voice = transport. Brain, tools, prompts, and learning logic stay shared.

## Verification Guidance

- Use available browser MCPs (playwright, etc.) for: navigate to calculator, open Panelin chat, toggle voice mode, inspect network/auth headers, capture console + UI snapshots of transcripts/fallbacks (audio itself is secondary — focus on transcripts, errors, UI state, action execution).
- Terminal: `npm run start:api` (background), health checks, `npm run lint`, `npm test`, `npm run gate:local`, voice health job behavior.
- After changes: confirm voice turns reach the extractor path (you may need to trigger extraction or inspect the conversation state + KB surface).
- Do **not** perform paid real voice calls in tests unless you control the session and it is necessary for a minimal verification.

## References & Related

| Item | Path / Note |
|------|-------------|
| Master goal prompt (canonical) | `goal-prompt-panelin-voice-agent-learning-architecture.md` (root) |
| Voice transport + UI | `src/hooks/useVoiceSession.js`, `src/components/PanelinVoicePanel.jsx`, `src/components/PanelinChatPanel.jsx` |
| Voice backend | `server/routes/agentVoice.js`, `server/lib/voiceErrorLog.js` |
| Learning core | `server/lib/autoLearnExtractor.js`, `server/lib/trainingKB.js`, `server/lib/rag.js` + embeddings |
| Chat patterns | `server/routes/agentChat.js`, calcLoopbackClient |
| Admin surface | `src/components/AgentAdminModule.jsx` (VoiceTab) |
| Project docs | `CLAUDE.md`, `AGENTS.md`, `docs/EXTERNAL-CONNECTIONS.md`, `docs/team/PROJECT-STATE.md`, any panelin/agent KB files |
| CI | `.github/workflows/ci.yml` (voice_health job) |
| Other voice-adjacent skill | `.cursor/skills/voice-say-last-answer/SKILL.md` (TTS speak last answer; unrelated to realtime learning) |

## Invocation Examples

- "Use the panelin voice agent learning architecture skill"
- "Run the voice learning goal"
- "Implement panelin-voice first-class training channel"
- "Execute goal-prompt-panelin-voice-agent-learning-architecture.md"
- "Make voice conversations contribute to the KB and RAG like chat/ML/WA"

After execution, if the ship cycle completes successfully, the goal prompt file should be considered for archiving under `docs/team/goal-prompts/` (following the convention in that README) and PROJECT-STATE.md must be updated.

This skill exists so that the detailed, self-contained master prompt can be reliably loaded and driven to completion without losing scope, constraints, or success bar on every future invocation.
