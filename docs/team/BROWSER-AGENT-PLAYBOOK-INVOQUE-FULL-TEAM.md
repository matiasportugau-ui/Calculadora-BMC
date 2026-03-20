# Browser agent playbook — Invoque full team (Chrome extension)

**Purpose:** Exact, step-by-step instructions for a Chrome/Cloud web extension agent in browser mode. No searching, no exploration — execute only these steps in order. Each step has one action, one target, one outcome.

**Rule for the agent:** Do not search. Do not try alternative paths. If a step fails, stop and report: step number, selector used, and error. Do not waste tokens exploring the UI.

**Important:** The prompt asks the AI to read and write repo files (PROJECT-STATE, PROMPT-FOR-EQUIPO-COMPLETO, etc.). That only works if the AI has the **Calculadora-BMC** workspace open (e.g. Cursor with that folder as the project). If you use ChatGPT or Claude in the browser without repo access, they will only reply with text; they cannot update the files. For full automation, point the extension at Cursor (desktop or web) with Calculadora-BMC open.

---

## CONFIG — Set before running

Choose **one** target. Replace the placeholders with your actual values.

| Variable | Description | Example |
|----------|-------------|---------|
| **TARGET** | Which interface to use | `cursor` \| `chatgpt` \| `claude` |
| **TARGET_URL** | Exact URL to open first | See table below |
| **WORKSPACE_PATH** | Optional; only if the AI asks for repo path | e.g. `/Users/matias/Panelin calc loca/Calculadora-BMC` |

**TARGET_URL by TARGET:**

| TARGET | TARGET_URL |
|--------|------------|
| cursor | `https://cursor.com` or the exact URL of your Cursor web app / chat (e.g. if you use Cursor in browser, paste that URL here) |
| chatgpt | `https://chat.openai.com/` |
| claude | `https://claude.ai/` |

---

## PART 1 — Navigate to the chat surface

Execute in order. Do not skip.

### Step 1 — Open the target page

- **Action:** NAVIGATE
- **URL:** `{TARGET_URL}` (use the value from CONFIG)
- **Success:** Page loaded; you see the main app (chat or composer).
- **If fail:** Stop. Report: "Step 1 failed: NAVIGATE to TARGET_URL".

---

### Step 2 — Wait for the page to be ready

- **Action:** WAIT
- **Duration:** 2 seconds (2000 ms)
- **Reason:** Let the SPA mount and the main input appear.
- **Success:** Proceed to Step 3.

---

### Step 3 — Focus the main chat / composer input

Use the row that matches your **TARGET**. Click only that element.

**If TARGET = cursor (Cursor in browser):**

- **Action:** CLICK
- **Selector (try in order until one exists):**
  1. `textarea[placeholder*="Message"]`
  2. `textarea[placeholder*="Ask"]`
  3. `[contenteditable="true"][role="textbox"]`
  4. `div[data-placeholder]` (first one that looks like input)
- **Fallback:** If the app uses a single visible text area in the center or bottom, click it.
- **Success:** Cursor is inside the input (caret visible or field focused).
- **If fail:** Stop. Report: "Step 3 failed: no chat input found. TARGET=cursor. Tried: textarea, contenteditable, data-placeholder."

**If TARGET = chatgpt (ChatGPT):**

- **Action:** CLICK
- **Selector:** `#prompt-textarea` (ChatGPT’s main input)
- **Alternative:** `textarea[placeholder*="Message"]` or `textarea[data-id="root"]`
- **Success:** Input focused.
- **If fail:** Stop. Report: "Step 3 failed: #prompt-textarea not found."

**If TARGET = claude (Claude):**

- **Action:** CLICK
- **Selector:** `textarea[placeholder*="Message"]` or the main composer textarea (usually one large box at bottom).
- **Alternative:** `[contenteditable="true"]` if Claude uses contenteditable.
- **Success:** Composer focused.
- **If fail:** Stop. Report: "Step 3 failed: composer input not found. TARGET=claude."

---

### Step 4 — Paste the Invoque full team payload

- **Action:** PASTE
- **Target:** The same element you focused in Step 3 (still focused).
- **Value:** Paste **exactly** the content of the block below (from "Invoque full team." to the end of point 4).

**Payload to paste (copy everything between the triple dashes):**

```
Invoque full team.

You are the BMC/Panelin full team orchestrator. Do the following in order.

1) Read these files from the Calculadora-BMC repo (workspace root):
   - docs/team/PROJECT-STATE.md
   - docs/team/PROMPT-FOR-EQUIPO-COMPLETO.md
   - docs/team/IMPROVEMENT-BACKLOG-BY-AGENT.md
   - docs/team/PROJECT-TEAM-FULL-COVERAGE.md (section 2 for the 19 members)

2) Execute the full team run steps 0 through 9:
   - Step 0: You (Orchestrator) read state, prompt, backlog; resolve any pendientes you can.
   - Step 0b: Create docs/team/parallel-serial/PARALLEL-SERIAL-PLAN-YYYY-MM-DD-runN.md (use today's date and next run number).
   - Steps 1–8: Confirm state is current for Mapping, Dependencies, Contract, Networks, Design, Integrations, Reporter, Security, GPT/Cloud, Fiscal, Billing, Audit/Debug, Calc, Judge, Repo Sync. If no domain changes, state "estado vigente".
   - Step 9: Execute the "Próximos prompts" listed in PROMPT-FOR-EQUIPO-COMPLETO.md. Each prompt is assigned to a role; produce the deliverable (e.g. create a doc, run a command, verify in code). If a prompt requires manual action by Matias (tabs, deploy, npm --force), note it and do not block. Update IMPROVEMENT-BACKLOG-BY-AGENT.md with any completed criteria (mark ✓). Update the "Próximos prompts" section of PROMPT-FOR-EQUIPO-COMPLETO.md for the next run (add next pending items or "sin entregables automatizables" if only Matias items remain).

3) Update docs/team/PROJECT-STATE.md:
   - Add one line under "Cambios recientes" summarizing this run (date, run number, what was done in step 9, pendientes remaining).
   - Update "Última actualización" at the top with this run's date and run number.

4) Reply with a short summary: run number, what was done in step 9, and the list of pendientes for Matias or next run (e.g. tabs/triggers, deploy, npm audit --force, Repo Sync optional).
```

- **Success:** The input field now contains the full text above (no truncation).
- **If fail:** Stop. Report: "Step 4 failed: paste failed or input cleared. Length pasted: X chars."

---

### Step 5 — Send the message

Use the row that matches your **TARGET**. Click only that element.

**If TARGET = cursor:**

- **Action:** CLICK
- **Selector (try in order):**
  1. `button[type="submit"]`
  2. `button[aria-label*="Send"]`
  3. `button:has(svg)` near the input (send icon)
  4. `[data-testid="send-button"]`
- **Keyboard alternative:** If no button works, send with **Enter** (or **Ctrl+Enter** / **Cmd+Enter** if that is how Cursor sends).
- **Success:** Message is sent; a new message or response stream appears.
- **If fail:** Stop. Report: "Step 5 failed: send button not found. TARGET=cursor."

**If TARGET = chatgpt:**

- **Action:** CLICK
- **Selector:** `button[data-testid="send-button"]` or the button with the send/arrow icon next to the textarea.
- **Alternative:** Press **Enter** (ChatGPT often sends on Enter).
- **Success:** Message sent; response starts loading.
- **If fail:** Stop. Report: "Step 5 failed: send button not found. TARGET=chatgpt."

**If TARGET = claude:**

- **Action:** CLICK
- **Selector:** Button with send/arrow icon next to the composer, or `button[type="submit"]`.
- **Alternative:** **Ctrl+Enter** or **Cmd+Enter**.
- **Success:** Message sent; response starts.
- **If fail:** Stop. Report: "Step 5 failed: send not found. TARGET=claude."

---

### Step 6 — Wait for the first response content

- **Action:** WAIT
- **Duration:** 5 seconds (5000 ms)
- **Reason:** Allow the AI to start streaming the reply.
- **Success:** Proceed to Step 7.

---

### Step 7 — Confirm the run was received (optional but recommended)

- **Action:** CHECK
- **What to look for:** In the assistant’s response area, presence of at least one of: "run", "Paso 0", "PROJECT-STATE", "pendientes", "Orchestrator", "step 9".
- **Selector (generic):** The main response/message container. For ChatGPT: `[data-message-author-role="assistant"]`. For Claude: the last message block. For Cursor: the assistant message panel.
- **Success:** At least one of the phrases above appears in the visible response.
- **If not found after 10 s:** Do not retry. Report: "Step 7: no run-related content in response after 10 s. Check manually that the prompt was sent and the workspace is Calculadora-BMC."

---

## PART 2 — Optional: Capture the result

Only if your extension is designed to capture the final reply.

### Step 8 — Wait for response to complete (optional)

- **Action:** WAIT
- **Duration:** 60–120 seconds (or until no new text appears for 5 seconds).
- **Note:** Full team run can be long; adjust timeout to your needs.
- **Success:** Response appears complete (no more streaming).

---

### Step 9 — Read the summary from the response (optional)

- **Action:** READ
- **Target:** The full assistant message (same container as Step 7).
- **What to extract:** The short summary (run number, what was done in step 9, list of pendientes). It is usually in the last paragraph or a "Resumen" / "Pendientes" section.
- **Success:** Return that summary to the user or to the extension’s output.

---

## Selector reference (quick copy-paste)

Use these only for the TARGET you selected. No guessing.

| TARGET   | Input selector (Step 3)     | Send (Step 5)                    | Response container (Step 7)           |
|----------|-----------------------------|----------------------------------|----------------------------------------|
| cursor   | `textarea[placeholder*="Message"]` or `textarea[placeholder*="Ask"]` or `[contenteditable="true"][role="textbox"]` | `button[type="submit"]` or Enter | Assistant message panel / last message |
| chatgpt  | `#prompt-textarea`          | `button[data-testid="send-button"]` or Enter | `[data-message-author-role="assistant"]` |
| claude   | `textarea[placeholder*="Message"]` | `button[type="submit"]` or Ctrl+Enter | Last message block in composer        |

---

## Error handling (agent rules)

1. **One step fails:** Stop immediately. Report: step number, action, selector, and (if available) a short error message or screenshot hint.
2. **Page structure changed:** If the selector for your TARGET no longer matches, stop and report: "Selectors outdated for TARGET=X. Update BROWSER-AGENT-PLAYBOOK-INVOQUE-FULL-TEAM.md."
3. **No workspace/repo:** The AI may reply that it cannot read the repo. That is an environment issue (e.g. Cursor must have Calculadora-BMC as the open workspace). Do not retry from the browser agent; report to the user.
4. **Do not:** Search the page for "send" or "input", try more than two selectors per step, or navigate away from TARGET_URL except as specified.

---

## Checklist before each run

- [ ] CONFIG: TARGET and TARGET_URL set.
- [ ] Payload in Step 4 is the full text (no truncation).
- [ ] Cursor (or the chosen AI) has **Calculadora-BMC** as the active workspace so it can read/write the docs and create the parallel-serial plan.
- [ ] Browser is logged in to the chosen service (Cursor/ChatGPT/Claude) so the chat loads.

---

**Reference:** docs/team/INVOQUE-FULL-TEAM.md, docs/team/PROMPT-FOR-EQUIPO-COMPLETO.md, .cursor/agents/bmc-dashboard-team-orchestrator.md
