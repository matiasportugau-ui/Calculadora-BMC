# AI Interactive Team — Skill Builder Instructions

**Purpose:** Instructions for configuring or extending this skill. Use when integrating with the mapping agent, design agent, or other team members.

---

## Integration Points

### With Mapping Agent (bmc-planilla-dashboard-mapper)

When the mapping agent discovers a change that affects the dashboard:

1. Mapping agent outputs: **Discovery**, **Impact**, **Proposal**, **Log for Design**.
2. Design agent reads the log and outputs: **Integration design**, **Constraints**, **Log for Mapping**.
3. Both consume each other's outputs from shared artifacts: `planilla-inventory.md`, `DASHBOARD-INTERFACE-MAP.md`, cross-reference.

### With Design Agent (bmc-dashboard-design-best-practices)

When the design agent needs new data or a new contract:

1. Design agent outputs: **Required fields**, **Placement**, **Empty/error states**.
2. Mapping agent reads and outputs: **Canonical payload**, **API contract**, **Log for Design**.
3. Design agent implements using the canonical payload only (no raw sheet headers).

### With Networks Agent (networks-development-agent)

When infrastructure changes affect mapping or design:

1. Networks agent outputs: **Discovery** (hosting, migration, new endpoint), **Impact**, **Log for Mapping**, **Log for Design**.
2. Mapping agent: verifies sheets/API reachability, config drift, documents prod URLs.
3. Design agent: verifies URLs, CORS, relative paths; adds loading/error states if needed.
4. Networks agent: confirms nginx, env vars, migration checklist.

### With User (Human-in-the-loop)

- User reviews technical decisions before implementation.
- User is called when agents cannot reach unanimous approval.
- User can speak to multiple agents at once when their roles are invoked.

---

## Artifacts to Share

| From Mapping | To Design | Content |
|--------------|-----------|---------|
| planilla-inventory.md | Design | Tabs, columns, status (active_now, conditional, etc.) |
| API contract | Design | Canonical fields, required vs optional |
| Log for Design | Design | Step-by-step: what to add, where, how to consume |

| From Design | To Mapping | Content |
|-------------|------------|---------|
| DASHBOARD-INTERFACE-MAP | Mapping | Sections, blocks, data sources |
| Required fields | Mapping | What the UI needs from the API |
| Log for Mapping | Mapping | Contract adjustments, new endpoints |

| From Networks | To Mapping + Design | Content |
|---------------|--------------------|---------|
| Migration plan | Both | New URLs, ports, env vars |
| Log for Mapping | Mapping | Config drift, Sheets reachability |
| Log for Design | Design | CORS, base URL, relative paths |
| HOSTING-EN-MI-SERVIDOR.md | Both | Hosting checklist, nginx config |

---

## Escalation Checklist

Before looping, verify:

- [ ] Have both agents exchanged at least twice?
- [ ] Is there a concrete disagreement (e.g. field name, placement)?
- [ ] Can the user resolve it with a single decision?
- [ ] If yes to all → **Call the user.** Stop. Reply with summary and ask for direction.

---

## Invocation Phrases

Use this skill when the user says:

- "Mapping and design agents, collaborate on this change"
- "Both agents need to agree before implementing"
- "Share your outputs so the other can proceed"
- "Call me if you can't reach agreement"
- "AI interactive team" / "agent collaboration"
