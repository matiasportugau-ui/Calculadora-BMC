# Contribut input mode (refinar input antes de ejecutar)

Two-phase workflow: refine and enrich the user's raw message into a clear "official input" before doing heavy work.

## Activation and state

| Command / phrase | Effect |
|-----------------|--------|
| `CONTRIBUT ON` or "activá modo Contribut" / "modo Contribut" | Mode **active** in this session until `CONTRIBUT OFF`. |
| `CONTRIBUT OFF` | Mode **inactive**; normal responses resume. |
| `CONTRIBUT SKIP` | **This message only**: skip refinement and respond normally. Next message returns to Phase 1 if mode is still ON. |
| `ACEPTO BORRADOR` | Closes Phase 1. Optionally paste the refined text below. Claude then executes Phase 2 (full response / code / searches). |

## When this mode applies

- The user invokes it explicitly: `/contribut`, `CONTRIBUT ON`, "modo Contribut", "refinar mi input", etc.
- `CONTRIBUT ON` was already established in this session and `CONTRIBUT OFF` has not been sent.

## Confirming activation

When you detect `CONTRIBUT ON` (or equivalent), respond briefly confirming the mode is active and remind the user of:
- `CONTRIBUT OFF` to exit
- `CONTRIBUT SKIP` for a one-off direct reply
- `ACEPTO BORRADOR` to close the draft and proceed

## Phase 1 — Draft only (mode ON, message without `CONTRIBUT SKIP`)

Given a raw user message, respond **only** with the following block. No solution code, no large diffs, no final answer — just the draft.

### Mandatory template (show all four headings):

#### Tu intención (resumida)

1–3 sentences: what the user wants to accomplish in this turn.

#### Supuestos

- Short list of reasonable assumptions inferred from the conversation and repo context.
- If something is not backed by evidence in the repo or message: mark **`NEEDS_CONFIRMATION`** and add a concrete question.

#### Input refinado propuesto

Ready-to-copy text to use as the **official input** (paragraph or numbered list): objective, scope, constraints, definition of done.

#### Preguntas mínimas (si aplican)

At most **3** questions, only if they block quality or there is risky ambiguity. If none are needed: write *Ninguna.*

#### Cómo seguir

Fixed closing line (in Spanish):

> Cuando estés conforme, envía **`ACEPTO BORRADOR`** (y opcionalmente pega el texto refinado que quieras usar). Ahí paso a ejecutar / responder en serio.

## Phase 2 — After `ACEPTO BORRADOR`

- Treat the **refined input** (the one proposed or pasted by the user) as the source of truth.
- Now proceed with tools, code, plans, searches — whatever the task requires.

## Combined-turn shortcut

If the user's message includes both the refined text **and** `ACEPTO BORRADOR` in one turn, skip the extra Phase 1 round and go directly to Phase 2 using that text as the official input.

## Language

Respond in **Spanish** when the user writes in Spanish. Technical terms and commands can stay in English for clarity.

## Project context (BMC)

If the repository has `docs/team/PROJECT-STATE.md` or another session doc the user is referencing, consider reading it when the message touches project state, pending tasks, or handoff — without blocking the flow if the file doesn't exist.
