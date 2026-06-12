# Role
You are an expert full-stack frontend + AI UX engineer specializing in the BMC Calculadora / Panelin project. Your job is to deliver a polished, professional, and novel "always-on intelligent companion" experience for the Panelin character and chat system in one focused implementation pass.

# Context
[CONFIRMED: from repo state and previous implementation]
The main calculator is a complex React SPA (`src/components/PanelinCalculadoraV3_backup.jsx`) using `react-resizable-panels` (PanelGroup + Panel + PanelResizeHandle) for its core layout (left wizard/dimensions column + right quote/BOM area).

A standing Panelin character has been introduced:
- `src/components/PanelinCharacter.jsx` renders the exact existing video loop (`PANELIN_AGENT_VIDEO_SRC` = `panelin-lista-loop.mp4`).
- It shows external only when chat is closed, with idle breathing animation, occasional professional greetings (bubble), and speaking reactions.
- When chat is open, the same video appears inside the chat (via Avatar component in `PanelinChatPanel.jsx`).
- Chat defaults to a resizable right sidebar (added as third Panel in the main PanelGroup) and is fully non-blocking — user can continue editing the quote, visor, etc.
- There is a `chatPresentation` state (`'sidebar' | 'floating'`) and `toggleChatPresentation`.
- Current "floating" falls back to a detached browser popup window via `onOpenDetachedWindow`.
- Rich chat (`PanelinChatPanel.jsx`) supports skins, dev mode, voice mode (OpenAI Realtime via `useVoiceSession` + `PanelinVoicePanel`), and TTS (browser speechSynthesis, recently improved with better voice selection, rate/pitch tuning, and `isTtsSpeaking` state for character sync).
- The agent already has strong execution power via `handleChatAction` / `onChatAction` (setScenario, full setTecho with zonas, setLP / Precio BMC vs Web, wizard control, buildQuote, openLink, print, etc.) passed through `useChat`.
- 2D/3D roof visor lives in `QuoteVisualVisor.jsx` and related roof plan utils (data attributes and refs exist for some interactions).
- Animations must remain restrained/professional (no cartoonish effects). Everything must feel premium, alive, and "novedoso" while staying usable for operators building real quotes.

The user has explicitly accepted a prior refined scope and now wants targeted one-shot polish on four areas (listed verbatim in the original request).

# Goal
Deliver the four specific polish items so that the Panelin experience feels complete, delightful, and production-ready:

- Implement a **true in-page floating window** (draggable + resizable inside the same browser tab, not a popup) that contains the full chat and keeps the Panelin character visible inside it. The window must not block the main calculator.
- Further **polish the layout** (sensible default sidebar width, snap points / double-click reset behavior for the resizable handles, overall visual and interaction refinement for both sidebar and floating modes).
- Add **more dynamic reactions** to the Panelin character: make it visibly react when the agent is "thinking" (streaming / processing), and when the user opens or interacts with the 2D roof visor or other key visual moments.
- **Upgrade TTS further** for efficiency and quality: add a user-configurable speed control in the UI, and provide a high-quality server-side voice fallback option (leveraging existing backend voice infrastructure) that can be toggled for noticeably more natural/professional speech when desired.

The overall character + chat (sidebar or floating) must continue to feel professional, novel, and highly usable while the user works on real cotizaciones.

# Scope
**IN scope:**
- In-page floating chat window implementation (portal + drag + resize logic, with character inside).
- Layout refinements: default widths, snap/double-click reset on handles, visual polish (shadows, transitions, spacing) for sidebar and floating.
- Character reaction system: "thinking" state (tied to isStreaming / pending in chat), visor interaction reactions (detect open of 2D/3D roof preview).
- TTS upgrades: speed slider/control in the chat UI (affects browser TTS), plus a clean toggle or setting for server-side high-quality voice fallback (integrate with existing /agent/voice or add minimal backend support if needed for TTS audio).
- Wiring so that reactions and floating work seamlessly with the existing sidebar, embedded mode, voice mode, agent actions, and skins.
- Small CSS/animation additions that feel premium (subtle, performant, consistent with current design language).
- Verification that nothing regresses (sidebar still resizable and non-blocking, voice mode fully works, character visibility rules respected, agent execution power intact).

**OUT of scope (do not touch unless strictly required for the above):**
- New video assets or 3D character models (reuse the exact existing `panelin-lista-loop.mp4`).
- Changes to core quote calculation, BOM, PDF generation, or agent tool definitions beyond what's needed for TTS/character reactions.
- Mobile-first floating behavior (desktop priority is fine).
- Full persistence of floating vs sidebar preference across full reloads (sessionStorage is acceptable).
- Major refactoring of useChat, agentCore, or backend prompts unless directly needed for the TTS fallback or reaction signals.
- Any changes outside the calculator SPA (`/`) unless the server TTS fallback absolutely requires a tiny route addition.

# Constraints & Guardrails
- Must reuse the exact `PANELIN_AGENT_VIDEO_SRC` video for the character (both external and inside chat).
- Animations and reactions must be **professional and restrained** — subtle breathing, clean rings/pulses, purposeful state changes. No flashy or childish effects.
- The main calculator must remain fully interactive at all times when the chat (sidebar or floating) is open.
- Voice mode (the full Realtime duplex experience via PanelinVoicePanel) must continue to work without regression.
- Respect existing skin tokens, `embedded` prop behavior, and the current `chatPresentation` / `openChat` / `closeChat` / `toggleChatPresentation` API.
- All new floating logic must be in-page (no new browser popups for the primary "in-page" feature).
- TTS changes must not break the existing "lectura en voz alta" toggle or the new `isTtsSpeaking` integration with the character.
- [CONFIRMED from repo] Use `react-resizable-panels` patterns for any layout snap/reset behavior.
- No hard-coded secrets or new external dependencies unless tiny and justified.

# Inputs
- Primary source file: `src/components/PanelinCalculadoraV3_backup.jsx` (main layout, PanelGroup, chatPresentation state, character placement, visor integration points).
- Character: `src/components/PanelinCharacter.jsx` (current breathing/greet/speaking implementation).
- Chat UI: `src/components/PanelinChatPanel.jsx` (Avatar, TTS logic, voice mode, embedded support, header buttons).
- Supporting: `src/utils/panelinAgentVideoSrc.js`, `src/hooks/useChat.js`, `src/hooks/useVoiceSession.js`, `src/components/PanelinVoicePanel.jsx`.
- Roof/visor interaction points: `src/components/QuoteVisualVisor.jsx` and related roof plan files (for character reaction triggers).
- Server (only if TTS fallback is chosen): `server/routes/agentVoice.js` and related voice libs (for high-quality fallback option).

# Tools & MCPs
Standard Claude Code tools for code editing, search, and terminal verification are sufficient. No special external MCPs are required beyond what's already in the project (React, browser APIs for drag/resize/pointer events, Web Speech API or existing backend voice routes).

Use `PanelGroup` / `Panel` / `PanelResizeHandle` for any new layout consistency.
For in-page floating: use `createPortal` + pointer event drag handlers + a resizable container (CSS resize or custom handle, matching existing sash style).

# Anti-patterns
- Do not implement the in-page floating as another browser `window.open` popup — the user explicitly wants it inside the same tab.
- Do not make the character reactions distracting or overly frequent (professional restraint).
- Do not break the existing sidebar resizability or the "calculator remains interactive" contract.
- Do not duplicate the video element logic — keep a single source of truth for the animation asset.
- Avoid heavy new animation libraries; use CSS + lightweight React state.
- Do not regress voice mode or the current agent action execution surface.
- Do not change default behavior to floating — sidebar must remain the default when clicking the character.
- When adding snap points or layout polish, do not fight the existing `react-resizable-panels` autoSaveId / double-click reset patterns.

# Deliverables
1. In-page floating chat implementation:
   - New or extended logic (in `PanelinCalculadoraV3_backup.jsx` or a small new `FloatingChatWindow.jsx`) that renders the full chat content (via `PanelinChatPanel` in a suitable mode) inside a draggable + resizable portal window when `chatPresentation === 'floating'`.
   - The window must include the Panelin character visibly inside it.
   - Drag on header, resize (bottom-right or edges), close/minimize controls.
   - Smooth enter/exit transitions.
   - "Back to sidebar" action that returns it to the resizable Panel.

2. Layout polish:
   - Sensible default width for the chat sidebar (e.g. 32-35% or a good pixel value that works with current left/quote split).
   - Snap points or improved double-click reset behavior on the relevant `PanelResizeHandle`s (including the new chat sash).
   - Visual and spacing refinements (shadows, borders, header polish, responsive feel) for both sidebar and floating states.
   - Ensure the external character placement remains clean and non-overlapping.

3. Enhanced Panelin character reactions:
   - "Thinking" state (tied to chat `isStreaming` or pending assistant turn) — e.g. subtle processing pulse, different ring color, or slow "idle" variation on the video container.
   - Reactions to 2D/3D visor interactions (e.g. when user opens or focuses the roof visor / QuoteVisualVisor, the character does a small "looking" or helpful gesture — scale + brief highlight or directional animation).
   - Pass the necessary state props from the main calculator and chat components.
   - Keep all animations using the existing keyframe system or minimal additions.

4. TTS upgrades:
   - User-configurable speed control (slider or buttons 0.8x – 1.3x) exposed in the chat UI (visible when TTS is enabled, affects `utterance.rate`).
   - Optional high-quality server-side voice fallback:
     - UI toggle/setting ("Usar voz premium del servidor" or similar).
     - If enabled, instead of (or in addition to) browser speechSynthesis, call an existing or lightly extended backend endpoint (e.g. via the voice routes or a new lightweight TTS proxy) to play higher-quality audio (OpenAI TTS or similar if available in the stack).
     - Graceful fallback to browser TTS if server is unavailable.
   - Ensure the character still receives accurate `isSpeaking` / `isTtsSpeaking` signals regardless of backend or browser path.
   - Keep the existing `ttsEnabled` toggle and per-message auto-read behavior.

5. Wiring, integration, and non-regression:
   - All new features respect `chatOpen`, `chatPresentation`, `embedded`, skins, dev mode, and the existing character visibility rules.
   - The "Flotar" button (or equivalent) now triggers the new in-page floating instead of (or in addition to) the detached popup.
   - Update any relevant comments or small docs in the touched files.
   - No breaking changes to voice mode, agent actions, or core calculator interactivity.

# Success Criteria
- On `npm run dev`, clicking the standing character opens the resizable sidebar (default).
- Toggling to floating produces a true in-page draggable + resizable window (same tab) that contains the full chat + visible Panelin character. The main calculator remains fully interactive underneath.
- The floating window can be dragged by its header and resized; a control returns it cleanly to sidebar mode.
- Sidebar has an improved default width and snap/double-click reset behavior on the handles.
- The Panelin character visibly reacts (distinct, professional animation) when the agent is streaming/thinking and when the user opens or interacts with the 2D roof visor.
- TTS toggle still works. A speed control appears and changes playback rate in real time. An optional "voz premium" / server fallback toggle exists; when used it produces noticeably higher quality audio (or gracefully falls back).
- Voice mode (Realtime) button and full experience remain fully functional in both sidebar and floating modes.
- `npm run lint` passes with no new errors.
- Manual verification: character feels alive and professional, layout feels polished and consistent, no visual or interaction regressions in the quote-building flow, all four requested items are demonstrably present and working.

# Operational Anchors
- Source of truth for layout: existing `PanelGroup` / `Panel` / `PanelResizeHandle` usage and the current three-panel sidebar pattern.
- Character must always use the exact `PANELIN_AGENT_VIDEO_SRC` asset (no new media).
- Animation language: restrained, purposeful, skin-token aware where possible. Prefer CSS transforms + opacity over heavy re-renders.
- Agent integration: continue to surface actions via the existing `onChatAction` / `handleChatAction` system. New character reactions should be driven by existing chat state (`isStreaming`, visor refs/events) rather than inventing new protocols.
- State management: extend the existing `chatPresentation`, `chatOpen`, and internal chat states rather than adding parallel systems.
- Epistemic hygiene: any assumption about server TTS capabilities must be treated as [ASSUMPTION] and implemented with graceful degradation.

# Open Items
- [ASSUMPTION] Whether the project already has a lightweight server TTS endpoint (OpenAI audio or similar) ready for the "fallback a voz del servidor" item. The prompt assumes we can either wire to the existing voice session infrastructure or add a minimal proxy if needed; implement the UI + fallback logic and note any small backend addition required.
- Exact default sidebar percentage and snap values can be tuned during implementation for best visual balance with the current left (≈35%) / quote (≈65%) split.
- How aggressively to detect "visor open" (data attribute on the visor host, event, or ref check) — choose the cleanest non-brittle option that exists in the current visor code.
- Whether the in-page floating window should remember its last size/position within the session (recommended for polish).

# Blockers
None known. All requested items build directly on the already-implemented sidebar + character + TTS + agent action foundation. The main risk is scope creep on the floating implementation — keep it focused on in-page drag + resize + character visibility + clean return to sidebar.