# `/set-goal` Master Prompts — Ship-Cycle Archive

Each file in this folder is a **master prompt** produced by the `/set-goal` skill
and consumed by `/goal` to execute a major workstream. They are kept here as a
durable record of:

- The locked-in **goal** (single-sentence outcome + 3-7 bullet expansion)
- The **scope** (what's IN and what's OUT)
- **Constraints & guardrails** the executor agreed to operate under
- **Inputs** (specific file paths, IDs, service URLs at the time of execution)
- **Anti-patterns** documenting what NOT to do, with the historical reasons
- **Success criteria** that were used to declare done
- **`[ASSUMPTION]` tags** that had to be verified before execution

Why commit these? Because the diff alone doesn't capture *why* a ship cycle
happened, what alternatives were considered and rejected, or what the executor
was forbidden to do. The PR description belongs in commit messages; the
**run-of-show**, including dead-end branches the team rejected upfront, belongs
here.

## Archive

| File | Ship date | Outcome |
|------|-----------|---------|
| [`goal-prompt-google-auth-open-registration.md`](./goal-prompt-google-auth-open-registration.md) | 2026-05-20 | Open Google registration live on calculadora-bmc.vercel.app (commit `9cfd9eb` + hotfix `e702c73`) |
| [`goal-prompt-hub-tasks-module.md`](./goal-prompt-hub-tasks-module.md) | 2026-05-18 | Tareas module Phase B (routes mounted, identity.modules seeded) |
| [`goal-prompt-hub-tasks-phase1.md`](./goal-prompt-hub-tasks-phase1.md) | 2026-05-18 | Tareas module Phase C — backend CRUD + hooks + UI (commits `4480bd3`/`b0bd565`/`6ea9808`) |
| [`goal-prompt-tareas-phase-c1-c3.md`](./goal-prompt-tareas-phase-c1-c3.md) | 2026-05-19 | Tareas OAuth PKCE + Cloud Scheduler sync (commits `d6526b5`/`4ee410d`/`494ae62`) |
| [`goal-prompt-user-platform-4-tracks.md`](./goal-prompt-user-platform-4-tracks.md) | 2026-05-20 | User Platform 4-track ship: `/hub/admin/users`, Mensajes, Tareas nav, TraKtiMe combobox (5 commits, ~3,100 LOC) |
| [`goal-prompt-user-activity-log-and-history.md`](./goal-prompt-user-activity-log-and-history.md) | 2026-05-21 | Unified activity log + per-user Historial + admin Analytics (5 commits, ~1,750 LOC, applied via Supabase MCP migration) |

## Convention

- Filename pattern: `goal-prompt-<kebab-case-slug>.md`
- Saved here ONLY after the ship cycle completes (so each file maps 1:1 to a
  shipped artifact set)
- New goal prompts are generated at the repo root by the `/set-goal` skill;
  they get moved here when the corresponding `/goal` execution finishes
