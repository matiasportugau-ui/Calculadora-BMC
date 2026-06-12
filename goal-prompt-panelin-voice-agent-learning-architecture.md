# Role
You are a senior full-stack architect and implementer specializing in multi-channel AI agents for production web applications. Your mission is to take the existing Panelin realtime Voice agent (WebRTC/OpenAI Realtime transport) from a partially isolated feature to a first-class, robust, correctly authenticated channel that is deeply integrated into the shared agent brain and the learning/training/RAG/auto-learn pipeline, while fixing current blockers and extending it for observability, cross-browser support, training data quality, and long-term maintainability ("and more").

# Context
The BMC/Panelin system (Calculadora BMC on Vercel + panelin-calc on Cloud Run) has a unified agent architecture: shared brain in server/lib/agentCore.js (with provider chain, tools), RAG over pgvector + trainingKB, autoLearnExtractor that pulls high-value Q/A pairs from conversation turns (with strict BMC-specific criteria for prices, panels, scenarios, installation, etc.), and multiple surfaces (text chat in PanelinChatPanel, ML, WhatsApp). 

Voice is implemented as a transport layer:
- Frontend: useVoiceSession.js (full WebRTC lifecycle: ephemeral session mint → RTCPeerConnection + data channel "oai-events" → mic + remote audio + function call relay via /api/agent/voice/action) + PanelinVoicePanel.jsx (mic UI, VU, transcripts, barge-in, explicit Safari/WebRTC blocker) + toggle in PanelinChatPanel.jsx via voiceMode state.
- Backend: server/routes/agentVoice.js (POST /agent/voice/session with requireAuth + rate limit, mints OpenAI ephemeral using trainingExamples from trainingKB + buildSystemPrompt, relays validated actions; plus health, errors ring buffer in voiceErrorLog.js).
- It already pulls some KB examples for the Realtime system prompt and supports the same calculator action tools as text mode.
- Separate simpler path: useDictation.js (MediaRecorder-based, better Safari tolerance).

Current state [CONFIRMED from code + live MCP captures + prior reports]:
- Works for authenticated users on Chrome/Edge (full duplex, VAD, live function calls that drive the calculator, transcripts).
- Hard client-side block on Safari ("El modo voz fluido requiere Chrome o Edge. Safari no soporta WebRTC con OpenAI Realtime.") — intentional because of Realtime API requirements.
- "Unauthorized" (401) errors appear on /api/auth/me, /api/auth/refresh, and agent/voice/* when no valid authHeader (JWT from login or API_AUTH_TOKEN Bearer) is passed — the public calculator UI renders anonymously, but Panelin AI features (chat + voice) are gated.
- An intrusive "Pegá API_AUTH_TOKEN" prompt dialog appears in some states (dev convenience leaking into prod-like flows).
- Voice transcripts are emitted to local UI state (onTranscriptDelta) but are not appended to the main conversation turns used by autoLearnExtractor, trainingKB ingestion, or RAG across channels.
- Admin surface (VoiceTab in AgentAdminModule) can test health/session/errors.
- CI has a voice_health job. Error logging exists but voice sessions are not yet first-class training data.

The voice feature is valuable for natural interaction with the quote builder but is architecturally incomplete: transport is good, but it is not yet a peer channel in the agent's learning loop, auth is brittle, browser UX is binary (full voice or "use text"), and "and more" (observability of voice convos, training data quality signals from voice, graceful degradation, persistent metadata, evaluation, etc.) is missing.

# Goal
Make the Panelin Voice agent (realtime fluid voice conversations) production-correct, cleanly architected as a transport on the shared agent brain, and fully wired into the learning/auto-training/RAG system so voice interactions generate high-quality training data, contribute to KB growth, and improve the agent over time — while eliminating current "Unauthorized" and browser friction, ensuring reliability, and adding the necessary extensions for a complete voice channel ("and more").

- Fix auth so authenticated users (or valid token holders) never see Unauthorized on voice or the broader Panelin chat/agent features; remove or hide the raw API_AUTH_TOKEN prompt in normal flows.
- Make browser support robust: keep the high-quality Realtime path for Chrome/Edge, add/promote a first-class dictation + TTS fallback (leveraging useDictation + existing TTS) for Safari/WebKit, with clear UI signaling.
- Architecturally unify: treat voice as a channel (source: "panelin_voice") equivalent to text chat / ML / WA — route transcripts + actions through the same conversation model, provenance, and onAction handlers used by agentCore / calcLoopback.
- Integrate with learning: wire live voice transcripts (user and assistant) into autoLearnExtractor (with source tagging), trainingKB, and RAG retrieval so voice-derived facts (prices, scenarios, objections, installation details) are extracted and become retrievable.
- Add "and more" production capabilities: voice-specific observability (transcripts + metadata in logs/admin, error surfacing), session health/metrics, graceful stop/barge-in reliability, admin tools for reviewing voice training contributions, basic evaluation hooks or quality signals from voice turns, and documentation of the voice channel in the agent system.

# Scope
IN:
- All voice transport and UI code (useVoiceSession.js, PanelinVoicePanel.jsx, integration points and state in PanelinChatPanel.jsx).
- Backend voice routes and libs (agentVoice.js, voiceErrorLog.js, any shared prompt/build logic).
- Wiring voice turns into the shared conversation persistence / autoLearnExtractor / trainingKB / RAG paths (and any central conversation store or useChat hook).
- Auth flow fixes and propagation of authHeader / Bearer token for agent/voice and agent/chat surfaces.
- Browser detection + fallback improvements (Safari dictation path, UI messaging, toggle visibility).
- Admin/observability (VoiceTab enhancements, error + transcript visibility, health).
- Any supporting utils, types, or small backend additions for voice transcript ingestion.
- Updates to docs, prompts, or CI voice_health if they directly support the above.
- Live verification using available browser MCPs or terminal (where audio is not strictly required).

OUT:
- Changes to the core shared brain (agentCore.js) or non-voice channels unless strictly necessary for unification.
- New LLM providers or major Realtime model changes.
- Full end-to-end voice quality benchmarking or human eval harness (flag as future work unless simple hooks).
- Migration of existing voice error data or KB entries.
- Non-Panelin voice (e.g. WA voice calls).
- Anything requiring new paid services beyond existing OpenAI keys.

# Inputs
- src/hooks/useVoiceSession.js [CONFIRMED]
- src/components/PanelinVoicePanel.jsx [CONFIRMED]
- src/components/PanelinChatPanel.jsx (full file, especially voiceMode, authHeader prop, transcript handling, onChatAction, use of useDictation/TTS) [CONFIRMED + needs deeper read]
- server/routes/agentVoice.js [CONFIRMED]
- server/lib/autoLearnExtractor.js (the turn-based extractor and EXTRACT_PROMPT with BMC criteria) [CONFIRMED]
- server/lib/trainingKB.js + findRelevantExamples / hasSimilarQuestion (used by voice session mint) [CONFIRMED]
- server/lib/rag.js + embeddings (for confirming voice-derived content becomes retrievable) [INFERRED from agent architecture]
- server/routes/agentChat.js (for patterns on how text chat feeds learning and uses auth) [INFERRED]
- src/components/AgentAdminModule.jsx (VoiceTab for health/errors/session test) [CONFIRMED]
- Any central conversation / useChat hook or persistence layer used by PanelinChatPanel (to append voice turns) [ASSUMPTION: exists and is the right integration point; verify]
- docs/EXTERNAL-CONNECTIONS.md, CLAUDE.md, AGENTS.md, and any agent/panelin docs mentioning voice or auto-learn [CONFIRMED]
- .github/workflows/ci.yml for voice_health job [CONFIRMED]
- Existing patterns for provenance ("source"), calcLoopbackClient for actions, and multi-channel handling [CONFIRMED from prior agent work]

# Tools & MCPs
- read_file, grep, search_replace (primary for code archaeology and precise edits).
- run_terminal_command (npm run lint, npm test, npm run gate:local, npm run start:api in background for contract testing, voice_health checks).
- chrome-devtools or playwright MCP (for live browser navigation to the calculator, opening Panelin chat, toggling voice mode, capturing console/network/auth headers, snapshots of the voice UI and fallback; note audio capture is limited but transcripts and errors are observable).
- list_dir on src/components and server/routes/server/lib as needed.
- web_fetch or open_page only for external OpenAI Realtime docs if required for architecture decisions (low priority).
- Do NOT use tools that mutate external state (no real voice calls that cost money unless explicitly in a test session you control; prefer devMode + mocks where possible).
- Tools NOT needed for core work: direct DB writes (use the KB libs), Sheet edits (voice learning is repo + pgvector), GitHub PR creation unless the executor decides on a final ship step.

# Constraints & Guardrails
- DO NOT expose or log long-lived OpenAI keys — only ephemeral client_secrets are sent to the browser (already the case; preserve this invariant).
- Voice sessions must continue to use requireAuth + rate limiting; ephemeral tokens only.
- All voice-derived training data must go through the same quality gates as other channels (MIN_CONFIDENCE, dedup, category rules, BMC-specific factual criteria in autoLearnExtractor).
- Preserve existing calculator action validation (VALID_ACTION_TYPES) and the onAction → calcLoopback pattern.
- Do not break text-mode Panelin chat, TTS, dictation, or non-voice agent surfaces.
- Read-only by default on any master price data, training KB seeds, or fiscal content; only add derived voice pairs via the normal extractor path.
- Auth changes must not introduce new unauthenticated attack surface on /agent/voice/*.
- Browser detection must be defensive (feature detection over UA sniffing where possible).
- "Modo Tutorial" and existing skins/devMode paths must continue to work.

# Anti-patterns
- DO NOT treat voice as a completely separate brain or duplicate the tool definitions / system prompt logic (it must reuse the shared patterns).
- DO NOT leave transcripts only in component state — past pattern of "channel-specific state that never feeds learning" has happened with other surfaces; avoid it.
- DO NOT rely on raw UA sniffing without feature detection for Safari (previous browser bugs in the repo were fixed only after explicit testing).
- DO NOT let the API_AUTH_TOKEN prompt or 401 dialogs leak into normal authenticated user flows (it was a dev convenience that surfaced in prod-like deploys before).
- DO NOT start WebRTC on unsupported browsers (current hard block is correct; improve the messaging and fallback instead).
- DO NOT assume all voice turns are high-value for training — the extractor is deliberately strict; voice will produce more conversational noise, so keep the quality bar.
- Past deploy drift on keys (ANTHROPIC/OPENAI etc. dropped from Cloud Run sets) must not recur for OPENAI_REALTIME_MODEL or related.

# Deliverables
- Updated src/hooks/useVoiceSession.js (if any robustness/auth cleanups needed).
- Updated src/components/PanelinVoicePanel.jsx (improved fallback messaging, perhaps tighter integration with dictation, clearer "why Chrome/Edge" copy).
- Updated src/components/PanelinChatPanel.jsx (auth-aware voice toggle visibility, wiring of voice transcripts into the central conversation array/turns with source: "panelin_voice", onSwitchToText + dictation promotion on unsupported browsers, clean stop on mode change).
- Updated server/routes/agentVoice.js (minor if needed for better error surfacing or source tagging on relayed actions).
- New or updated integration: code that appends normalized voice turns (role/content + source/convId) to the structure consumed by autoLearnExtractor (exact location determined by reading the chat hook/state — likely inside PanelinChatPanel or a shared useChat-like module).
- Updates to server/lib/autoLearnExtractor.js or callers if voice source needs special handling or the EXTRACT_PROMPT needs a voice note (keep strict criteria).
- Enhancements to VoiceTab in src/components/AgentAdminModule.jsx (show recent voice transcripts or training pairs contributed, better error context).
- Any small supporting lib (e.g. voiceTranscriptNormalizer or channel adapter) if it keeps the change clean and reusable.
- Documentation updates in relevant README / CLAUDE.md / docs/team/ files describing the voice channel, its learning integration, browser matrix, and auth requirements.
- If a small backend TTS proxy or dictation relay is added for Safari fallback quality, the minimal route + client wiring.
- At minimum one concrete verification artifact (e.g. updated test or a .runtime/ voice-smoke log) or note in the PR description.

# Success Criteria
- On Chrome/Edge with valid auth (login or Bearer API_AUTH_TOKEN), voice mode starts cleanly, produces bidirectional transcripts, executes calculator actions (e.g. setScenario, buildQuote), and the session can be stopped without leaks.
- On Safari, the voice toggle either is hidden/disabled with a helpful message or switches to a working dictation + TTS fallback; the hard Realtime blocker message is still shown only for the premium path.
- No 401/Unauthorized on /api/agent/voice/* or related agent chat calls for properly authenticated sessions; the raw "Pegá API_AUTH_TOKEN" dialog does not appear in normal flows.
- Voice turns (user speech transcripts + assistant audio_transcript deltas) are appended to the conversation state with clear source tagging and are processed by autoLearnExtractor in subsequent extractions (or a dedicated voice ingestion path).
- At least one voice-derived high-value pair (price, panel family, scenario, installation fact, etc.) appears in trainingKB after a voice session (verifiable via KB surface or admin tools).
- RAG retrieval can surface knowledge that originated from a voice conversation.
- Voice health endpoint returns healthy when OpenAI Realtime is configured; errors are visible in the ring buffer and admin UI.
- Existing text chat, TTS, dictation, and all calculator scenarios continue to work without regression (run gate:local or equivalent).
- Lint, type checks (if any), and relevant tests pass.
- The change is documented enough that a teammate can understand "how voice conversations train the agent."

# Operational Anchors
- Source hierarchy for facts and implementation: running code in HEAD > recent docs / previous goal prompts / STATUS reports > older plans. Triangulate repo (the files listed) + agent architecture docs + live behavior (MCP browser + terminal).
- Every conversation turn fed to learning (including voice) must carry source ("panelin_voice", "panelin_chat", "ml", "wa", etc.) and optional convId for traceability.
- State labeling in any analysis or comments the executor adds: hecho confirmado / inferencia / duda abierta.
- Prefer small, reviewable diffs that follow existing patterns (ephemeral tokens only, validated actions, strict extractor, calcLoopback for side effects).
- When auth is involved, prefer the same requireAuth + header propagation pattern used by the rest of the agent surface; surface any drift immediately.
- Voice is a transport. The brain, tools, prompts, and learning logic stay shared.

# Open Items
- [ASSUMPTION: The conversation state inside PanelinChatPanel (or the hook it uses) is the canonical place to append normalized voice turns so they flow to autoLearnExtractor the same way text turns do | verify by reading the full component and any useChat / conversation persistence logic before editing]
- [ASSUMPTION: Adding voice as a source to the existing extractor + KB is sufficient for "learn and be trained"; a dedicated voice quality signal or separate voice KB collection is out of scope unless it emerges naturally from the code]
- [ASSUMPTION: For Safari fallback we can reuse/enhance useDictation + existing browser TTS without new backend audio synthesis unless a minimal proxy is trivial]
- [INFERRED: Voice sessions should be treated as short-lived like today; persistent long-term voice session storage in Postgres is not required for the learning goal unless transcripts are already being logged elsewhere]
- Any other gaps discovered during code reading must be tagged and either resolved or listed here before claiming done.

# Blockers
None identified that would prevent starting implementation. Auth drift and the exact conversation state shape for voice turn injection should be verified in the first 30-60 minutes of execution (read the relevant files + run a quick unauth vs authed test). If the main conversation model is more fragmented than expected, surface it and propose the minimal unification adapter.