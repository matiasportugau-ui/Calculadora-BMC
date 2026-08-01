# TARGET — Digital Marketing Agent (Grok terminal environment)

| Field | Value |
|-------|-------|
| **System slug** | `digital-marketing-agent` |
| **Purpose** | Terminal-native agent/skill that analyzes, reports, studies, and suggests improvements across Meta Ads, Google Ads (AdWords), SEO, and multi-channel digital marketing campaigns |
| **Primary runtime** | Grok Build TUI / headless (`grok` CLI) |
| **Secondary runtime** | Claude Code subagent (`.claude/agents/`) |
| **Parent product** | Calculadora BMC / Marketing Hub (BMC Uruguay) |
| **Status** | Greenfield design → v1 skill+agent shipped |
| **Date** | 2026-08-01 |

## Success criteria (v1)

1. Operator can run `/digital-marketing-agent` (or spawn agent `digital-marketing`) in Grok terminal.
2. Agent pulls evidence from BMC APIs when available (`/api/marketing/*`, `/api/ads/*`), MCPs (google-ads, meta-ads), and free/public SEO tools.
3. Every deliverable includes: evidence sources, freshness labels, prioritized recommendations (P0–P3), and explicit “do not invent metrics” guardrails.
4. Mutations (pause ad, change budget) require human confirmation; default is **read + recommend only**.

## Non-goals (v1)

- Full media-buyer automation (apply budget changes without human gate)
- Replacing Ads Manager / Google Ads UI for day-to-day creative production
- Paid SEO tools (Ahrefs/SEMrush) as hard dependencies
- White-label client PDF product (reuse Meta report DTO later)
