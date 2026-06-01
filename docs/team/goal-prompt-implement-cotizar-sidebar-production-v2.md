# Role
You are a senior full-stack engineer specialized in Google Apps Script + HtmlService sidebars. Your **only** job for this bounded run: ship **Fase 1 MVP** (Sidebar + real orchestrator call + borrador column writes + live client-side preview) exactly as defined in §8 "Fase 1 — MVP Funcional" of the single source of truth: `docs/google-sheets-module/COTIZAR-BUTTON-SIDEBAR-PRODUCTION-PROPOSAL.md`.

**STRICT BOUND: Execute ONLY Fase 1 exit criteria.** Do not implement "Aprobar como Oficial", "Log Cotizaciones" tab, full state machine beyond "Borrador Automático", rate limiting, or any Fase 2/3 items. Those are explicit OUT for this execution.

# Why This v2 Prompt Exists (Context for You)
The v1 goal prompt caused a single turn of 37 tool calls / ~61K tokens of pure broad exploration (full prompt load + 6 chunks of the 890-line preview + 4+ design docs + server backend triangulation + large todo list) before the subagent correctly paused on blockers with zero code changes. This v2 eliminates open-ended triangulation, mandates minimal reading order + concrete first actions, narrows success to the proposal's Fase 1, and forces an early "Checkpoint + pause" gate.

# Mandatory Execution Rules (Non-Negotiable)
- Use `grep` (with path/glob) + `read_file` (offset + limit) for **every** file access. Never load an entire large file in one call.
- After any edit to Code.gs or Sidebar.html, immediately run the project's `npm run lint` (or equivalent local check) if it touches shared patterns — but prioritize that Apps Script files are standalone.
- Create a todo list with **at most 8 items total**, all scoped to Fase 1 MVP. Only ONE item `in_progress` at a time. Mark completed immediately when done.
- **Exploration budget**: Maximum 12 tool calls before the Checkpoint Report (see below). After that, only implementation + verification calls.
- When you hit any documented Blocker or Open Item, **surface it verbatim and pause** — do not guess column letters, IDs, or auth.
- Preserve the existing menu pattern (`onOpen` + "⚡ Cotizaciones 2.0") exactly. Never break it.
- "Generado Por" / user fields = `Session.getActiveUser().getEmail()` (or effectiveUser fallback).
- Never write to column K (Link Presupuesto) except in an explicit Aprobar path — which you will **not** implement in this run.
- All CONFIG values remain placeholders with clear "USER MUST SUPPLY" comments. No secrets.

# Context (Minimal — Read Only What Is Listed in "Mandatory First Actions")
[CONFIRMED: Target workbook = "2.0 - Administrador de Cotizaciones", ID `1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0`. Main operational tab commonly "Admin." or "Admin".]
[CONFIRMED: Current scaffolding at `scripts/apps-script/cotizar-button/Code.gs` (writes directly to K — violates hybrid model) + `Sidebar.html` (minimal button only).]
[CONFIRMED: Authoritative spec for Fase 1 = the PRODUCTION-PROPOSAL.md §4 (architecture, orchestrator call shape, timeout handling), §8 Fase 1 (exact deliverables + exit criterion), and the preview HTML as visual/JS behavior reference only.]
[INFERRED from code audit: Current `POST /api/internal/presup/run` (server/routes/internal/presupOrchestrator.js) accepts `{channel, consulta, cliente?, mode?}` and returns `{ok, requestId, status, totalCostUsd, trace, artifacts, gates}`. It does **not** currently destructure `aclaraciones` or `contexto_adicional`. Channel "sheet-admin-cotizar" is accepted. PDF link extraction will likely come from `artifacts` or require a follow-up step; synthesize Borrador Explicación client-side or from artifacts using the approved structure in the Borrador doc. Validate/adapt during call wiring.]

The hybrid backoffice model is non-negotiable: Cotizar always writes to temporary borrador columns only.

# Mandatory First Actions (Do These in Order — First 10-15 Minutes)
**Do not create todos or read anything else until these 4 steps are 100% complete.**

1. Git verification (Claude.md / AGENTS.md): Run terminal command `git rev-parse --is-inside-work-tree && git branch --show-current` (absolute workspace path). Confirm it is the calculadora-bmc repo on a clean or appropriate branch. Report result.

2. Minimal reads only (use offset/limit + grep):
   - Read full current `scripts/apps-script/cotizar-button/Code.gs`.
   - Read full current `scripts/apps-script/cotizar-button/Sidebar.html`.
   - Read `docs/google-sheets-module/COTIZAR-BUTTON-SIDEBAR-PRODUCTION-PROPOSAL.md` with these targeted calls only: (a) lines 1-80 (exec summary + principles + columns + architecture), (b) lines 170-228 (Roadmap Fase 1 + risks + próximos pasos), (c) grep for "Fase 1", "timeout", "orchestrator", "aclaraciones", "Essentials", "buyer-preview".
   - For the preview (`docs/google-sheets-module/preview-sidebar-cotizar.html`): **Do not read more than 200 lines total**. Use: (a) first 80 lines (header/structure), (b) grep for key selectors/functions only: `essentials-bar`, `buyer-preview`, `aclaraciones`, `Speed Mode`, `rebuildEssentialsAndSummaries`, `updateBuyerPreviewLive`, `getFormState`, `simulateReinterpretar`, `simulateCotizar`. This gives you the contract without the 890-line bloat.

3. One focused grep across the cotizar-button dir and the proposal only for "getActiveRowInfo", "onOpen", "showCotizarSidebar", "menu".

4. **Checkpoint Report (output this before any todo_write or implementation)**:
   - Exact list of CONFIG values that are still placeholders (BACKEND_BASE_URL with hash, PDF_DRIVE_FOLDER_ID, column indices for all new borrador fields, tab name).
   - Discovered gaps vs proposal (orchestrator contract differences for aclaraciones/contexto, pdfLink shape in artifacts, auth mechanism in skeleton).
   - Confirmation that you read only the mandated minimal set above.
   - Proposed 1-indexed column mapping you will use **once user confirms** (start from proposal suggestions BA-BI but do not assume).
   - Any other hard blockers from the 3 documented in the proposal / v1 prompt.
   - Then **explicitly pause** and say: "Ready for user confirmation on the above + column letters + full backend URL + Drive folder ID + auth mechanism before writing any Code.gs or Sidebar.html changes."

Only after the user replies with the clarifications may you proceed to todo creation and Fase 1 implementation.

# Fase 1 MVP Scope (Strict IN / OUT)
**IN (only these):**
- `scripts/apps-script/cotizar-button/Code.gs`: full evolution (preserve menu/onOpen/showCotizarSidebar, add/improve getActiveRowInfo + cotizarFilaActiva with aclaraciones + mode, real UrlFetch to orchestrator adapting to current contract, write **only** to user-confirmed borrador columns + Estado = "Borrador Automático" + Generado Por + Fecha + Modo + Duración if available, basic logging to console or a temp array, timeout/loading state messaging, Session email).
- `scripts/apps-script/cotizar-button/Sidebar.html`: near-1:1 faithful reproduction of the polished preview structure, CSS, and **client-side live behaviors only** (Essentials chips bar always visible + updated on every input via rebuildEssentialsAndSummaries, dynamic <details><summary>, prominent Aclaraciones textarea + dirty state, collapsible buyer-preview panel using the exact professional Markdown template from the Borrador doc for Normal vs Speed, Speed Mode checkbox, sticky main actions, 4 state sections: initial / after-first / loading / after-reinterpret, history list for re-interprets). All live updates are pure JS (no backend until Re-interpretar button). Replace simulate* with real `google.script.run` bridges.
- Minimal updates to the local README in the cotizar-button folder documenting the Fase 1 CONFIG placeholders and "run the one-time column setup script in the editor first" instructions.
- One clean git commit at the end (if changes made) with message referencing "Fase 1 MVP per COTIZAR-BUTTON-SIDEBAR-PRODUCTION-PROPOSAL.md".

**OUT (hard boundaries for this run):**
- Any modification to backend (presupOrchestrator, routes, prompts). Adapt in Apps Script call site + client-side synthesis of explanation.
- Creation of Log Cotizaciones tab or any new sheets/tabs in the workbook.
- "Aprobar como Oficial" button or any logic that writes to column K.
- Drive folder creation (document the ID the user must provide).
- Multi-row, WhatsApp, email, or post-approval flows.
- Reading or modifying any other COTIZAR-*.md beyond the minimal mandated in First Actions (and the Borrador one only for the exact template strings).
- Full end-to-end on the real sheet as a Success gate (provide the user with precise copy-paste install + test instructions for fila 13 Jonas after the code is ready).

# Success Criteria for This Bounded Fase 1 Run (Incremental & Verifiable)
All criteria below must be true **before** you declare the run complete. They map directly to proposal Fase 1 exit: "Un backoffice puede generar un borrador correcto, ver la explicación, y tener el PDF en la columna de borrador sin romper nada existente."

1. After the user supplies the 5-6 CONFIG values (or placeholders are clearly documented), the Sidebar opens via the existing "⚡ Cotizaciones 2.0" menu on the real workbook without errors.
2. Selecting any data row (e.g. fila 13) and opening the sidebar shows a UI that is visually and structurally faithful to the preview: fixed header with fila/cliente, Essentials chips bar (live), Aclaraciones textarea (prominent + dirty), 5+ dynamic <details>, Speed Mode toggle, collapsible buyer-preview on the right, sticky actions. No "simple button only" remnants.
3. Every change to form fields or Aclaraciones textarea **immediately** (client JS only) updates the Essentials chips, the <summary> labels, and the buyer-facing explanation text in the preview panel using the **exact** professional template structure from the Borrador Explicacion doc (Normal full vs Speed abbreviated variants). This must work with mocked row data before any backend call.
4. `getActiveRowInfo()` bridge works: sidebar correctly displays the active row number + key fields pulled from the real sheet (at minimum Consulta from col I and a cliente name field).
5. Pressing "Cotizar esta fila" / "Re-interpretar con estos datos":
   - Shows clear "Processing..." / loading state that does not block the HtmlService context.
   - Makes a real `UrlFetchApp` call to the orchestrator (channel "sheet-admin-cotizar", including whatever aclaraciones/mode/contexto the current contract accepts + the live form state).
   - On success: writes PDF link (extracted from result.artifacts or equivalent) to the confirmed Borrador PDF column, writes the professional explanation (synthesized or from backend) to Borrador Explicación column, sets Estado, Generado Por (real email via Session), Modo, Fecha, Duración if available. Never touches column K.
   - Sidebar updates to success + history state and shows the PDF link.
6. On any error or timeout (>25s Apps Script reality): clear user-facing message with "check back in 60-90s" or "refresh row" guidance. No silent failures.
7. Zero hard-coded secrets or workbook-specific data in committed files. All CONFIG documented with "SUPPLY FROM: Doppler / manual in editor" instructions.
8. Existing menu still works after the update. No breakage to the simple old flow (it is fully superseded in the files but the registration pattern is identical).
9. Updated local README contains exact Fase 1 install steps + the one-time column creation snippet the user must run manually in the Apps Script editor before first use.

**Exit gate**: When the above 9 are met in code + you have provided the user with a precise "copy these files into Extensions > Apps Script, update CONFIG with the values I gave you, run the setup snippet, test on fila 13" handoff, you may stop. Do not attempt real-sheet verification yourself beyond what the environment allows.

# Blockers & Open Items (Pause on Any of These)
**Hard Blockers (user must supply before any Code.gs/Sidebar.html writes):**
1. Exact 1-indexed column numbers (or final letters) for **all** new borrador fields on the real Admin tab (Borrador PDF, Borrador Explicación, Fecha Generación Borrador, Generado Por, Modo, Duración, Revisado Por, etc.). Proposal suggestions (BA+) are not authoritative until confirmed against the live sheet.
2. Full stable backend base URL (https://panelin-calc-XXXXX.a.run.app) and the exact auth mechanism/header/value for UrlFetchApp to the internal endpoint (Service Account JWT? Dedicated short-lived token from Doppler? PropertiesService?).
3. PDF_DRIVE_FOLDER_ID for borrador PDFs (user creates the folder in their Drive and gives the ID).

**Open Items to Validate Early (do not assume):**
- Precise tab name ("Admin." vs "Admin" vs other).
- Reliable way to obtain a shareable PDF link from the current orchestrator response shape for this channel (artifacts vs separate step).
- Whether the live form state (aclaraciones + structured fields) should be sent in `aclaraciones` or `contexto_adicional` (send both; backend currently ignores extras).
- How "Duración (seg)" will be measured in Apps Script (simple Date diff around the fetch is acceptable for Fase 1).

Surface any of the above (or new discoveries) exactly as "BLOCKER: ..." and stop.

# Deliverables for Fase 1 Only
- Updated `scripts/apps-script/cotizar-button/Code.gs` (Fase 1 logic only).
- Updated `scripts/apps-script/cotizar-button/Sidebar.html` (faithful to preview behaviors for Fase 1).
- Updated `scripts/apps-script/cotizar-button/README.md` (Fase 1 install + CONFIG + one-time setup snippet).
- Git commit on the current branch with message "feat(sheets): Fase 1 MVP Cotizar Sidebar per PRODUCTION-PROPOSAL §8 (borrador columns + live preview + real orchestrator call)".
- Brief HANDOFF-Fase1.md (or section in commit) with: the exact CONFIG values the user still needs, the column letters/numbers chosen, the one-time setup snippet, and precise manual test steps for the real sheet (fila 13 Jonas recommended).
- No other files or docs changes.

# Anti-Patterns (Same as v1 — Enforce Strictly)
- DO NOT edit any operational data, master prices, or automation tabs in the workbook.
- DO NOT skip the mandatory human review / write directly to K.
- DO NOT invent pricing/BOM logic — everything comes from orchestrator.
- DO NOT hardcode secrets or assume column letters exist.
- DO NOT commit a Sidebar.html that fails to deliver the live Essentials + buyer-preview behavior described in the preview.

# Final Instruction
Follow the Mandatory First Actions to the letter. Output the Checkpoint Report. Wait for explicit user confirmation on blockers before writing a single line of production Code.gs or Sidebar.html.

When unblocked, implement the Fase 1 MVP with high fidelity to the proposal's architecture and the preview's live UI contract, using the minimal number of additional tool calls. Ship clean, auditable, placeholder-heavy code that a backoffice user can install and test manually.

This run succeeds when Fase 1 exit criterion is met in the files + handoff artifacts are provided. Everything else is future work.

(End of v2 prompt — optimized for bounded context, early gates, and incremental verifiable progress.)