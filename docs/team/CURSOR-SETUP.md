# Cursor Setup for Calculadora BMC / Panelin

This document explains the sophisticated Cursor configuration that exists specifically for this repository.

**Goal**: Make it trivial for any human or agent (Cursor, Claude Code, Grok, etc.) to open the project and immediately have the correct context, tools, and guardrails.

---

## Recommended Way to Open This Project

### Best Option (Standalone, Recommended for Deep Work)

1. In Cursor: **File → Open Workspace from File...**
2. Select `calculadora-bmc.code-workspace` (in the repo root)

This gives you:
- Focused sidebar with the most important folders
- Project-specific search excludes
- Proper TypeScript/ESLint/Tailwind integration
- All custom rules + skills active

### Alternative (Multi-repo)

Use the home-level workspace:
- `~/bmc.code-workspace` (created 2026-05-29)

This includes Calculadora BMC as the starred primary folder + a few supporting repos.

**Never** open the raw `~/calculadora-bmc` folder for long sessions if you have the workspace file (the workspace file is superior).

---

## What Makes This Cursor Config Special

This is one of the most heavily instrumented AI development environments for a production codebase:

- **18 Cursor Rules** (`.cursor/rules/*.mdc`)
- **66 Custom Skills** (`.cursor/skills/*/SKILL.md`)
- **24 Custom Agents** (`.cursor/agents/*.md`)
- Custom MCP servers
- Deep integration with the project's own state system (`PROJECT-STATE.md`, handoffs, etc.)

### Core Rules (Always or High Priority)

| Rule | Purpose | Trigger |
|------|---------|---------|
| `00-bootstrap-state.mdc` | Forces reading AGENTS.md + CLAUDE.md + PROJECT-STATE.md + latest HANDOFF before work | On folder open + most session starts |
| `workspace-autostart-on-open.mdc` | Attempts to bring up local API + Vite safely | On folder open |
| `human-gates-bmc.mdc` | Strict playbook for Meta WA, ML OAuth, email ingest (cm-0/1/2) | When touching those areas |
| `contribut-input-mode.mdc` | Two-phase input refinement (draft → ACEPTO BORRADOR) before heavy work | Explicit or via skill |
| `start-workspace.mdc` | `npm run workspace:start` + environment checklist | User says "start workspace", "preparar proyecto" |
| `calculator-modifications.mdc` | Specialist behavior + canonical sources for price/logic changes | Calculator edits |
| `bmc-holistic-project-health.mdc` | Executive + cross-area status reports | "project health", "estado del proyecto", "snapshot" |
| `disk-space-recovery.mdc` | Safe cleanup when disk is low | Disk warnings or explicit |

Other rules cover: live devtools narrative, video dev, CEO agent, networks, Spanish replies, panelin-gym, etc.

### Key Skills (Reusable Agent Behaviors)

Notable ones (full list in `.cursor/skills/`):

- `bmc-calculadora-deploy-from-cursor` — Deploy + smoke + rollback workflows from inside Cursor
- `bmc-calculadora-specialist` — Deep calculator engine knowledge
- `presupuestacion-orchestrator` (global, under `~/.grok/skills/`) — Full 100% automation conductor for quote pipeline
- `bmc-holistic-project-health`
- `actualizar-precios-calculadora`
- `bmc-google-drive-oauth`
- `bmc-team-judge`, `matprompt`, `chat-equipo-interactivo`, etc.

Many skills are self-documenting via their `SKILL.md`.

### Agents

24 specialized agents live in `.cursor/agents/`. Examples:
- `bmc-dashboard-*` family (audit, debug, IA reviewer, team orchestrator, etc.)
- `bmc-docs-and-repos-organizer`
- `ceo-ai-agent`
- `bmc-dgi-impositivo` (fiscal)

---

## Session Protocol (Mandatory for Good Results)

1. Open via `calculadora-bmc.code-workspace`
2. The `00-bootstrap-state.mdc` rule should fire automatically
3. Agent reads:
   - `AGENTS.md`
   - `CLAUDE.md`
   - `docs/team/PROJECT-STATE.md`
   - Latest `docs/team/HANDOFF-*.md`
4. Agent summarizes current state + proposes next action or waits for your task
5. When done: say **"close"**, **"cerrar"**, or **"next time"** → agent must write a proper handoff in `docs/team/`

---

## Global Skills That Complement This Repo

These live at user level but are designed for BMC work:

- `nxt` (executive snapshot + prioritized TODOs)
- `ship` (full local-verify → commit → push → prod-verify loop)
- `live-fix` (production-only bugs)
- `mac-rescue`
- `presupuestacion-orchestrator` (the big one for 100% quote automation)

---

## MCP Servers

Project-local (`.cursor/mcp.json`):
- `chrome-devtools` (Playwright-style browser automation via MCP)

Home/workspace level (recommended to have available):
- GitHub, Notion, Memory, Vercel, Grok tools, etc.

---

## Maintenance

- When you add a major new capability (new module, new orchestrator phase, new human gate), consider:
  - New or updated rule in `.cursor/rules/`
  - New skill in `.cursor/skills/`
  - Update this document + AGENTS.md
- Rules should follow the `NN-description.mdc` naming for load order clarity.
- Keep `PROJECT-STATE.md` as the single source of truth — the Cursor system exists to make agents actually read and respect it.

---

**Last major update**: 2026-05-29 (workspace bootstrap rule + this document + dedicated .code-workspace)

This Cursor setup is a competitive advantage for the project. Treat it as first-class infrastructure.