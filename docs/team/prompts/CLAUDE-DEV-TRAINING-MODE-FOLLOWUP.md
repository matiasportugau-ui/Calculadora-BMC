# Claude Code terminal plan — Panelin Developer Training Mode follow-up

> **How to use:** Copy everything below the `---` line and paste as a single prompt into Claude Code in the terminal (`claude` CLI), opened at the Calculadora-BMC repo root.

---

You are working in repo **Calculadora-BMC** (`/Users/matias/Panelin calc loca/Calculadora-BMC`).

Read `AGENTS.md` at the repo root first — follow its gates (`npm run lint` after `src/` edits, `npm test` after logic, `npm run gate:local:full` before committing `src/` changes). Use ES modules everywhere. Never hardcode sheet IDs, tokens, or prod URLs.

## Context

The "Panelin Developer Training Mode" plan was implemented and evaluated. Report: `docs/team/ux-feedback/LIVE-DEVTOOLS-NARRATIVE-REPORT-2026-04-03-panelin-dev-training-mode.md`. Four gaps remain (LDN-2026-04-03-01 through 04). Your job is to close them.

## Files you must read before coding (do this first)

```
src/components/PanelinChatPanel.jsx      # Chat drawer — renders messages at line ~340, DEV button at ~238-253, mounts PanelinDevPanel at ~481-496
src/components/PanelinDevPanel.jsx       # Dev panel — Train/KB/Prompt tabs
src/components/PanelinCalculadoraV3_backup.jsx  # Main app — devMode state at ~2153, toggleDevMode at ~2270, DEV toolbar button at ~3532-3547, PanelinChatPanel mount at ~4821-4838
src/hooks/useChat.js                     # Chat hook — devMode flag at ~43, saveCorrection/reloadTrainingKB/etc
server/routes/agentTraining.js           # Training REST API — POST /agent/train, GET /agent/training-kb, etc
server/routes/agentChat.js               # Chat SSE — devMode branch at ~167, kb_match at ~231, calc_validation at ~289-300
server/lib/trainingKB.js                 # KB CRUD
server/lib/chatPrompts.js               # buildSystemPrompt — trainingExamples injection at ~195-220
```

## Tasks (do them in this order)

### Task 1 — Hide DEV button from regular users (LDN-2026-04-03-03)

The plan specified dev mode should be **invisible** to end users. Today the DEV button is rendered unconditionally in two places.

**What to do:**

1. In `PanelinCalculadoraV3_backup.jsx` (~line 3532-3547): wrap the DEV toolbar button so it only renders when `devMode` is already active. The shortcut `Ctrl/Cmd+Shift+D` at ~line 2290-2298 stays — that's how Matias activates it without visible chrome.

2. In `PanelinChatPanel.jsx` (~line 238-253): same — only show the chat header DEV button when `devMode` prop is `true`. The condition `{onToggleDevMode && (` should become `{devMode && onToggleDevMode && (`.

3. When devMode is false, there should be **zero** visible dev-related UI. The keyboard shortcut `Ctrl/Cmd+Shift+D` remains the only entry point.

### Task 2 — Per-message Good/Correction buttons (LDN-2026-04-03-02)

The plan described per-message "Good" / "Needs correction" controls. Currently the only correction flow is the bottom textarea in PanelinDevPanel.

**What to do:**

1. In `PanelinChatPanel.jsx`, inside the `messages.map()` loop (~line 340-395), after the action badges block (~line 379-391) and only when `devMode && !isUser && msg.content`, add two small inline buttons:
   - **"✓ Good"** — calls `onSaveCorrection({ category: "conversational", question: <previous user message>, goodAnswer: msg.content, context: "rated-good" })`.
   - **"✗ Correct"** — sets a local state `correctingMsgId` to `msg.id`, which shows a small inline textarea + Save button right under that message. On save, calls `onSaveCorrection({ category: "conversational", question: <previous user message>, badAnswer: msg.content, goodAnswer: <textarea value>, context: "" })` and clears `correctingMsgId`.

2. The "previous user message" is the last `role: "user"` message that appears before `msg` in the `messages` array. If none found, use `""`.

3. Style: 11px, pill buttons matching the existing action badges aesthetic (line ~385-388). Use existing colors `PRIMARY`, `SUBTEXT`, `BORDER`, `SURFACE` from the file.

4. Do NOT remove the existing correction flow in PanelinDevPanel — it stays as an alternative.

### Task 3 — Document architecture scope (LDN-2026-04-03-01)

The plan's mermaid diagram shows training feeding CRM (`suggest-response`) and ML rules. In reality, training KB only feeds `agentChat.js` → `chatPrompts.js`.

**What to do:**

1. Create a short file `docs/team/DEV-TRAINING-MODE-SCOPE.md` that states:
   - Training KB today is **chat-only** (injected as few-shot in `buildSystemPrompt` via `agentChat.js`).
   - CRM suggest-response (`server/lib/aiCompletion.js`) and ML sync (`server/ml-crm-sync.js`) do **not** consume training KB entries.
   - Future: if business decides to extend, the `findRelevantExamples()` function from `trainingKB.js` can be imported into those modules.
   - This is a deliberate scope choice, not a bug.

2. Do NOT wire CRM/ML — that's out of scope for now.

### Task 4 — Update PROJECT-STATE.md

Add a **single** entry at the top of "Cambios recientes" in `docs/team/PROJECT-STATE.md` summarizing the changes from tasks 1-3, linking to `DEV-TRAINING-MODE-SCOPE.md`.

### Task 5 — Verify

1. Run `npm run lint` — must pass.
2. Run `npm test` — must pass.
3. Run `npm run build` — must pass (set `BMC_DISK_PRECHECK_SKIP=1` if disk precheck fails).
4. Briefly confirm the structure makes sense: devMode off = zero dev chrome; devMode on = per-message buttons + bottom panel.

Do NOT create a git commit — just leave the changes staged for me to review.

## Constraints

- ES modules only (`import`/`export`), no `require()`.
- Match existing React patterns (inline styles, no CSS modules or Tailwind in this codebase).
- Keep PanelinDevPanel.jsx changes minimal (task 2 goes in PanelinChatPanel.jsx).
- Do not touch server files unless strictly necessary (tasks 1-3 are frontend + docs only).
- No new npm dependencies.
