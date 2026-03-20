# Full prompt for Chrome / Cloud Web extension — Invoque full team

Copy the entire block below into your Chrome extension or cloud automation. When the extension sends this to Cursor (or your AI agent), it will run the full BMC team.

---

## Block to copy (start below this line)

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

---

## Block to copy (end above this line)

---

## How to use with a Chrome / Cloud extension

1. **One-shot trigger:** Configure the extension to send the text between the start/end lines above to Cursor (or your AI endpoint) when you click a button or use a shortcut.
2. **Where to send:** Paste the prompt into the Cursor chat input, or into whatever field your extension uses to talk to the AI (e.g. ChatGPT, Claude, or Cursor API).
3. **Workspace:** The AI must have access to the Calculadora-BMC repo so it can read and write the files listed (PROJECT-STATE, PROMPT-FOR-EQUIPO-COMPLETO, IMPROVEMENT-BACKLOG, parallel-serial plan, etc.).
4. **Run number:** If you run multiple times per day, the prompt says to use "runN" — you can either let the AI infer the next number from existing PARALLEL-SERIAL-PLAN files, or add a placeholder like `runX` and replace X in the extension before sending.

---

## Short version (trigger only)

If your extension only needs to send a minimal trigger and the AI already knows the protocol, use:

```
Invoque full team. Run steps 0–9: read docs/team/PROJECT-STATE.md, PROMPT-FOR-EQUIPO-COMPLETO.md, IMPROVEMENT-BACKLOG-BY-AGENT.md; execute Próximos prompts from PROMPT-FOR-EQUIPO-COMPLETO; update PROJECT-STATE, PROMPT, and backlog; reply with run summary and pendientes.
```

---

**Reference:** docs/team/INVOQUE-FULL-TEAM.md, .cursor/agents/bmc-dashboard-team-orchestrator.md
